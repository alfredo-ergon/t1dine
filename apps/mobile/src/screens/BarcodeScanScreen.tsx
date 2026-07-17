// Barcode lookup (Slice: barcode scanning). Two entry paths into the SAME
// lookup logic:
//   - Native (iOS/Android): a live `expo-camera` `CameraView` scan.
//   - Web (`Platform.OS === "web"`): live camera scanning is unreliable in a
//     browser preview, so this never renders a camera there — only a manual
//     numeric-entry fallback, which shares the exact same lookup as a native
//     scan. The whole feature is therefore fully usable on web.
//
// A scanned/typed code is looked up FIRST in the catalog already loaded on
// this device (`foods` — App.tsx's `allFoods`, i.e. every food this app
// currently knows about, unfiltered by area, so a scan never "misses" a food
// just because an area/cuisine filter happens to be active elsewhere in the
// app). A catalog miss offers an explicit Open Food Facts (OFF) fallback
// lookup (`../api`'s `fetchOffProduct`, proxied through the T1Dine API) —
// ALWAYS presented as a clearly LOW-CONFIDENCE, attributed candidate the user
// must explicitly confirm (add to the meal, or review/correct and save as
// their own food), never as an authoritative catalog entry (CLAUDE.md:
// "User-created and AI-estimated foods must display uncertainty and
// provenance" — the same bar applies to any third-party-sourced candidate).
// A miss on BOTH the catalog and OFF falls through to the existing "not
// found" state, which hands the code off to CreateFoodScreen's pre-fill,
// never silently discarding it.
//
// This screen is pure food/catalog UI — it has no connection whatsoever to
// `@t1dine/dose-engine` or `src/dose/*` (CLAUDE.md: keep clinical calculation
// UI separate from food-estimation UI).

import { useCallback, useRef, useState } from "react";
import { Linking, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import type { CanonicalFood } from "@t1dine/food-schema";

import { ApiError, fetchOffProduct, isConnectivityError, type OffLookupResult } from "../api";
import { ConfidenceBadge } from "../components/ConfidenceBadge";
import { FadeIn } from "../components/FadeIn";
import { Mascot } from "../components/Mascot";
import { PressableScale } from "../components/PressableScale";
import { Skeleton } from "../components/Skeleton";
import { useLanguage } from "../i18n";
import { carbPer100g, displayName, nutrient } from "../search";
import { colors, elevation, fontWeights, gradients, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

export interface BarcodeScanScreenProps {
  /** Every food this app currently knows about (catalog + the user's own
   * custom foods), unfiltered by any area/cuisine selection — mirrors
   * App.tsx's `allFoods`. */
  foods: CanonicalFood[];
  onFound: (food: CanonicalFood) => void;
  onNotFound: (barcode: string) => void;
  onCancel: () => void;
  /** Adds an Open Food Facts LOW-CONFIDENCE candidate straight to the current
   * meal — the SAME add-to-meal path used everywhere else in the app
   * (App.tsx's `handleAddToMeal`), so it merges/totals into the Diário and
   * dose review exactly like any other food, carrying its
   * `confidence: "unverified"` nutrient with it (MealScreen's uncertainty
   * banner already reacts to that). This candidate is never silently saved
   * as the user's own food — see `onSaveOffCandidate` below for that
   * separate, explicit action. */
  onAddOffCandidate: (food: CanonicalFood) => void;
  /** Routes to CreateFoodScreen with the OFF candidate's barcode/name/carbs
   * PRE-FILLED but fully editable — "Guardar como o meu alimento" never
   * silently trusts OFF data; the user reviews and explicitly saves it as
   * their own (unverified, candidate) food, exactly like any other custom
   * food (see ../customFood.ts). */
  onSaveOffCandidate: (barcode: string, food: CanonicalFood) => void;
}

type OffLookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; result: OffLookupResult }
  | { status: "not_found" }
  | { status: "error"; messageKey: string };

/** Maps a failed `fetchOffProduct()` call to an i18n key for a fail-closed,
 * user-facing message — NEVER the server's raw `message`/`error` text.
 * `not_found` (HTTP 404) is handled separately by the caller as its own
 * `OffLookupState`, not as an error. */
function offLookupErrorKey(error: unknown): string {
  if (isConnectivityError(error)) return "barcode.offOfflineError";
  if (error instanceof ApiError && error.code === "off_unavailable") return "barcode.offUnavailableError";
  return "barcode.offGenericError";
}

// EAN-13/EAN-8/UPC-A/UPC-E cover the retail barcodes a packaged food is
// realistically labelled with — no 2D/QR types, which this feature does not
// target.
const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e"] as const;

function findFoodByBarcode(foods: CanonicalFood[], code: string): CanonicalFood | undefined {
  return foods.find((food) => food.barcodes.includes(code));
}

/** Loose plausibility check for manual entry — digits only, a realistic
 * barcode length. Deliberately not a checksum validator: a slightly
 * non-standard code should still be allowed through to the lookup (and, on a
 * miss, to the create/submit fallback) rather than being rejected outright. */
function isPlausibleBarcode(value: string): boolean {
  return /^[0-9]{6,14}$/.test(value.trim());
}

function ManualEntryForm({ onSubmit }: { onSubmit: (code: string) => void }) {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!isPlausibleBarcode(trimmed)) {
      setError(t("barcode.manualEntryError"));
      return;
    }
    setError(null);
    onSubmit(trimmed);
  };

  return (
    <View style={styles.manualForm}>
      <Text style={styles.label}>{t("barcode.manualEntryLabel")}</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={(value) => {
          setText(value);
          if (error) setError(null);
        }}
        placeholder={t("barcode.manualEntryPlaceholder")}
        placeholderTextColor={colors.textFaint}
        keyboardType="number-pad"
        autoCorrect={false}
        accessibilityLabel={t("barcode.manualEntryLabel")}
        onSubmitEditing={submit}
        returnKeyType="search"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <PressableScale onPress={submit} accessibilityRole="button" accessibilityLabel={t("barcode.manualEntrySubmit")} style={styles.primaryButtonWrap}>
        <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.primaryButtonGradient}>
          <Text style={styles.primaryButtonText}>{t("barcode.manualEntrySubmit")}</Text>
        </LinearGradient>
      </PressableScale>
    </View>
  );
}

/**
 * Presents a successful Open Food Facts lookup as an explicit,
 * user-confirmable LOW-CONFIDENCE candidate — never as an authoritative
 * catalog entry. Confidence is conveyed by colour + icon + text together
 * (`ConfidenceBadge`, never colour alone — WCAG 2.2), and the OFF attribution
 * is always visible alongside it (ODbL requirement). The two actions are
 * deliberately distinct: adding to the meal never persists this candidate
 * anywhere, while "Guardar como o meu alimento" routes to CreateFoodScreen so
 * the user reviews/corrects it before it is ever saved as their own food.
 */
function OffCandidateCard({
  food,
  attribution,
  onAdd,
  onSave,
  onScanAnother,
  onCancel,
}: {
  food: CanonicalFood;
  attribution: string;
  onAdd: () => void;
  onSave: () => void;
  onScanAnother: () => void;
  onCancel: () => void;
}) {
  const { t, language } = useLanguage();
  const carb = nutrient(food, "CHOAVL");
  const carbValue = carbPer100g(food);
  const name = displayName(food, language);

  return (
    <View style={styles.screen}>
      <FadeIn>
        <View style={styles.center}>
          <Mascot size={72} />
          <Text style={styles.title}>{t("barcode.offCandidateTitle")}</Text>

          <View style={styles.offCandidateCard}>
            <Text style={styles.offCandidateName}>{name}</Text>
            <ConfidenceBadge food={food} />
            <Text style={styles.offUncertaintyNote}>{t("barcode.offUncertaintyNote")}</Text>

            <View style={styles.offCarbRow}>
              <Text style={styles.offCarbLabel}>{t("barcode.offCarbLabel")}</Text>
              <Text style={styles.offCarbValue}>
                {carbValue !== undefined ? carbValue : "—"} <Text style={styles.offCarbUnit}>{carb?.unit ?? "g"}</Text>
              </Text>
            </View>

            <View
              style={styles.offAttributionRow}
              accessible
              accessibilityLabel={`${t("barcode.offAttributionPrefix")} ${attribution}`}
            >
              <Text style={styles.offAttributionText}>
                {t("barcode.offAttributionPrefix")} {attribution}
              </Text>
            </View>
          </View>

          <PressableScale
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={`${t("detail.addButton")}: ${name}`}
            style={styles.primaryButtonWrap}
          >
            <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.primaryButtonGradient}>
              <Text style={styles.primaryButtonText}>{t("detail.addButton")}</Text>
            </LinearGradient>
          </PressableScale>

          <PressableScale
            onPress={onSave}
            accessibilityRole="button"
            accessibilityLabel={`${t("barcode.offSaveAsMyFoodCta")}: ${name}`}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>{t("barcode.offSaveAsMyFoodCta")}</Text>
          </PressableScale>

          <PressableScale
            onPress={onScanAnother}
            accessibilityRole="button"
            accessibilityLabel={t("barcode.scanAnotherCta")}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonText}>{t("barcode.scanAnotherCta")}</Text>
          </PressableScale>
          <PressableScale onPress={onCancel} accessibilityRole="button" accessibilityLabel={t("barcode.cancel")} style={styles.linkButton}>
            <Text style={styles.linkButtonText}>{t("barcode.cancel")}</Text>
          </PressableScale>
        </View>
      </FadeIn>
    </View>
  );
}

export function BarcodeScanScreen({ foods, onFound, onNotFound, onCancel, onAddOffCandidate, onSaveOffCandidate }: BarcodeScanScreenProps) {
  const { t } = useLanguage();
  const isWeb = Platform.OS === "web";

  // Always call the hook (rules of hooks) — only its RESULT is used
  // conditionally on `isWeb` below (the camera itself is never rendered on
  // web; see the module note above).
  const [permission, requestPermission] = useCameraPermissions();

  // Guards against `onBarcodeScanned` firing repeatedly for the same code
  // while the camera keeps streaming frames. Reset by "Ler outro código".
  const scanLockRef = useRef(false);
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);
  // OFF fallback lookup state for the current `notFoundCode` — reset
  // whenever a NEW code is scanned/typed (see `handleCode` below) or the user
  // taps "Ler outro código" (`handleScanAgain`), so a stale result/error from
  // a PREVIOUS code can never bleed into the next one.
  const [offState, setOffState] = useState<OffLookupState>({ status: "idle" });

  const handleCode = useCallback(
    (code: string) => {
      const match = findFoodByBarcode(foods, code);
      if (match) {
        onFound(match);
      } else {
        setOffState({ status: "idle" });
        setNotFoundCode(code);
      }
    },
    [foods, onFound],
  );

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      handleCode(result.data.trim());
    },
    [handleCode],
  );

  const handleScanAgain = useCallback(() => {
    scanLockRef.current = false;
    setNotFoundCode(null);
    setOffState({ status: "idle" });
  }, []);

  // Explicit, user-initiated OFF lookup (the "Procurar no Open Food Facts"
  // button below) — never automatic, so a catalog miss never silently
  // triggers a network request the user did not ask for (offline-first).
  const handleLookupOff = useCallback(() => {
    if (!notFoundCode) return;
    setOffState({ status: "loading" });
    fetchOffProduct(notFoundCode)
      .then((result) => setOffState({ status: "found", result }))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === "not_found") {
          setOffState({ status: "not_found" });
          return;
        }
        setOffState({ status: "error", messageKey: offLookupErrorKey(error) });
      });
  }, [notFoundCode]);

  // --- Not-found state — shared by the camera path and the manual-entry path. ---
  if (notFoundCode) {
    // A successful OFF lookup replaces this whole block with the dedicated
    // low-confidence candidate card (its own actions/attribution — see below)
    // rather than being folded into the "not found" layout.
    if (offState.status === "found") {
      return (
        <OffCandidateCard
          food={offState.result.food}
          attribution={offState.result.attribution}
          onAdd={() => onAddOffCandidate(offState.result.food)}
          onSave={() => onSaveOffCandidate(notFoundCode, offState.result.food)}
          onScanAnother={handleScanAgain}
          onCancel={onCancel}
        />
      );
    }

    return (
      <View style={styles.screen}>
        <FadeIn>
          <View style={styles.center}>
            <Mascot size={84} />
            <Text style={styles.title}>{t("barcode.notFoundTitle")}</Text>
            <Text style={styles.body}>{t("barcode.notFoundBody", { code: notFoundCode })}</Text>

            {offState.status === "not_found" && (
              <View style={styles.noticeBox} accessible accessibilityLabel={t("barcode.offNotFoundNotice")}>
                <Text style={styles.noticeIcon}>ⓘ</Text>
                <Text style={styles.noticeText}>{t("barcode.offNotFoundNotice")}</Text>
              </View>
            )}

            {offState.status === "error" && (
              <View style={styles.errorBox} accessible accessibilityLabel={t(offState.messageKey)}>
                <Text style={styles.errorIcon}>▲</Text>
                <Text style={styles.errorText}>{t(offState.messageKey)}</Text>
              </View>
            )}

            {offState.status === "loading" && (
              <View style={styles.offLoadingWrap} accessible accessibilityLabel={t("barcode.offLookupLoading")} accessibilityLiveRegion="polite">
                <Skeleton height={MIN_TAP_TARGET} radius={radius.pill} />
                <Text style={styles.offLoadingText}>{t("barcode.offLookupLoading")}</Text>
              </View>
            )}

            {(offState.status === "idle" || offState.status === "error") && (
              <PressableScale
                onPress={handleLookupOff}
                accessibilityRole="button"
                accessibilityLabel={offState.status === "error" ? t("barcode.offRetryCta") : t("barcode.offLookupCta")}
                style={styles.primaryButtonWrap}
              >
                <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.primaryButtonGradient}>
                  <Text style={styles.primaryButtonText}>{offState.status === "error" ? t("barcode.offRetryCta") : t("barcode.offLookupCta")}</Text>
                </LinearGradient>
              </PressableScale>
            )}

            <PressableScale
              onPress={() => onNotFound(notFoundCode)}
              accessibilityRole="button"
              accessibilityLabel={t("barcode.notFoundCta")}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>{t("barcode.notFoundCta")}</Text>
            </PressableScale>
            <PressableScale
              onPress={handleScanAgain}
              accessibilityRole="button"
              accessibilityLabel={t("barcode.scanAnotherCta")}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>{t("barcode.scanAnotherCta")}</Text>
            </PressableScale>
            <PressableScale onPress={onCancel} accessibilityRole="button" accessibilityLabel={t("barcode.cancel")} style={styles.linkButton}>
              <Text style={styles.linkButtonText}>{t("barcode.cancel")}</Text>
            </PressableScale>
          </View>
        </FadeIn>
      </View>
    );
  }

  // --- Web fallback: manual entry only, no camera (see the module note above). ---
  if (isWeb) {
    return (
      <View style={styles.screen}>
        <FadeIn>
          <Text style={styles.title}>{t("barcode.title")}</Text>
          <View style={styles.noticeBox} accessible accessibilityLabel={t("barcode.webNotice")}>
            <Text style={styles.noticeIcon}>ⓘ</Text>
            <Text style={styles.noticeText}>{t("barcode.webNotice")}</Text>
          </View>

          <ManualEntryForm onSubmit={handleCode} />

          <PressableScale onPress={onCancel} accessibilityRole="button" accessibilityLabel={t("barcode.cancel")} style={styles.linkButton}>
            <Text style={styles.linkButtonText}>{t("barcode.cancel")}</Text>
          </PressableScale>
        </FadeIn>
      </View>
    );
  }

  // --- Native: permission gate before the camera can render at all. ---
  if (!permission || permission.status === "undetermined") {
    return (
      <View style={styles.screen}>
        <FadeIn>
          <View style={styles.center}>
            <Mascot size={84} />
            <Text style={styles.title}>{t("barcode.permissionRequestTitle")}</Text>
            <Text style={styles.body}>{t("barcode.permissionRequestBody")}</Text>
            <PressableScale
              onPress={() => void requestPermission()}
              accessibilityRole="button"
              accessibilityLabel={t("barcode.permissionRequestCta")}
              style={styles.primaryButtonWrap}
            >
              <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.primaryButtonGradient}>
                <Text style={styles.primaryButtonText}>{t("barcode.permissionRequestCta")}</Text>
              </LinearGradient>
            </PressableScale>
            <PressableScale onPress={onCancel} accessibilityRole="button" accessibilityLabel={t("barcode.cancel")} style={styles.linkButton}>
              <Text style={styles.linkButtonText}>{t("barcode.cancel")}</Text>
            </PressableScale>
          </View>
        </FadeIn>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.screen}>
        <FadeIn>
          <View style={styles.center}>
            <Mascot size={84} />
            <Text style={styles.title}>{t("barcode.permissionDeniedTitle")}</Text>
            <Text style={styles.body}>{t("barcode.permissionDeniedBody")}</Text>
            {permission.canAskAgain ? (
              <PressableScale
                onPress={() => void requestPermission()}
                accessibilityRole="button"
                accessibilityLabel={t("barcode.permissionRequestCta")}
                style={styles.primaryButtonWrap}
              >
                <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.primaryButtonGradient}>
                  <Text style={styles.primaryButtonText}>{t("barcode.permissionRequestCta")}</Text>
                </LinearGradient>
              </PressableScale>
            ) : (
              <PressableScale
                onPress={() => void Linking.openSettings()}
                accessibilityRole="button"
                accessibilityLabel={t("barcode.openSettingsCta")}
                style={styles.primaryButtonWrap}
              >
                <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.primaryButtonGradient}>
                  <Text style={styles.primaryButtonText}>{t("barcode.openSettingsCta")}</Text>
                </LinearGradient>
              </PressableScale>
            )}

            <Text style={styles.manualEntryIntro}>{t("barcode.manualEntryIntro")}</Text>
            <ManualEntryForm onSubmit={handleCode} />

            <PressableScale onPress={onCancel} accessibilityRole="button" accessibilityLabel={t("barcode.cancel")} style={styles.linkButton}>
              <Text style={styles.linkButtonText}>{t("barcode.cancel")}</Text>
            </PressableScale>
          </View>
        </FadeIn>
      </View>
    );
  }

  // --- Granted: render the live camera scanner. ---
  return (
    <View style={styles.screen}>
      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        <View style={styles.scanFrame} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      </View>
      <Text style={styles.scanHint} accessible accessibilityLabel={t("barcode.scanningHint")}>
        {t("barcode.scanningHint")}
      </Text>
      <PressableScale onPress={onCancel} accessibilityRole="button" accessibilityLabel={t("barcode.cancel")} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>{t("barcode.cancel")}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl },
  title: { fontSize: typeScale.heading.size, fontWeight: fontWeights.extrabold, color: colors.textPrimary, marginTop: spacing.md, textAlign: "center" },
  body: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs, textAlign: "center", maxWidth: 320 },
  noticeBox: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.confidenceMediumBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    alignItems: "flex-start",
  },
  noticeIcon: { color: colors.confidenceMedium, fontSize: 16, fontWeight: "700" },
  noticeText: { flex: 1, fontSize: 13, color: colors.textSecondary },
  errorBox: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.confidenceLowBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    alignItems: "flex-start",
    width: "100%",
  },
  errorIcon: { color: colors.confidenceLow, fontSize: 16, fontWeight: "700" },
  errorText: { flex: 1, fontSize: 13, color: colors.textSecondary },
  offLoadingWrap: { width: "100%", marginTop: spacing.md, alignItems: "center" },
  offLoadingText: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm },
  offCandidateCard: {
    width: "100%",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginTop: spacing.md,
    alignItems: "flex-start",
    ...elevation.sm.native,
  },
  offCandidateName: { fontSize: typeScale.subheading.size, fontWeight: fontWeights.bold, color: colors.textPrimary, marginBottom: 2 },
  offUncertaintyNote: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, textAlign: "left" },
  offCarbRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  offCarbLabel: { fontSize: 14, color: colors.textMuted },
  offCarbValue: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, fontVariant: ["tabular-nums"] },
  offCarbUnit: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  offAttributionRow: { marginTop: spacing.sm, width: "100%" },
  offAttributionText: { fontSize: 11, color: colors.textFaint },
  manualEntryIntro: { fontSize: 13, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.xs, textAlign: "center" },
  manualForm: { width: "100%", marginTop: spacing.xs },
  label: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    minHeight: MIN_TAP_TARGET,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 4 },
  primaryButtonWrap: { borderRadius: radius.pill, marginTop: spacing.md, width: "100%", ...elevation.glow.native },
  primaryButtonGradient: {
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  primaryButtonText: { color: colors.onBrand, fontSize: 16, fontWeight: "700" },
  secondaryButton: {
    marginTop: spacing.md,
    minHeight: MIN_TAP_TARGET,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  secondaryButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  linkButton: { marginTop: spacing.md, minHeight: MIN_TAP_TARGET, alignItems: "center", justifyContent: "center" },
  linkButtonText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  cameraWrap: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.ink,
    marginTop: spacing.sm,
  },
  camera: { flex: 1 },
  scanFrame: {
    position: "absolute",
    top: "30%",
    left: "12%",
    right: "12%",
    bottom: "40%",
    borderWidth: 3,
    borderColor: colors.focusRing,
    borderRadius: radius.lg,
  },
  scanHint: { textAlign: "center", fontSize: 14, color: colors.textSecondary, marginTop: spacing.md },
});
