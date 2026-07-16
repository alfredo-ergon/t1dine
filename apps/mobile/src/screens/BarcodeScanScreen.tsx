// Barcode lookup (Slice: barcode scanning). Two entry paths into the SAME
// lookup logic:
//   - Native (iOS/Android): a live `expo-camera` `CameraView` scan.
//   - Web (`Platform.OS === "web"`): live camera scanning is unreliable in a
//     browser preview, so this never renders a camera there — only a manual
//     numeric-entry fallback, which shares the exact same lookup as a native
//     scan. The whole feature is therefore fully usable on web.
//
// A scanned/typed code is looked up ONLY in the catalog already loaded on
// this device (`foods` — App.tsx's `allFoods`, i.e. every food this app
// currently knows about, unfiltered by area, so a scan never "misses" a food
// just because an area/cuisine filter happens to be active elsewhere in the
// app). There is NO Open Food Facts / external lookup in this version (v1 —
// a licence decision is still open; see the barcode ADR/product note before
// adding one). A miss offers a clear, explicit "not found" state that hands
// the code off to CreateFoodScreen's pre-fill, never silently discarding it.
//
// This screen is pure food/catalog UI — it has no connection whatsoever to
// `@t1dine/dose-engine` or `src/dose/*` (CLAUDE.md: keep clinical calculation
// UI separate from food-estimation UI).

import { useCallback, useRef, useState } from "react";
import { Linking, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import type { CanonicalFood } from "@t1dine/food-schema";

import { FadeIn } from "../components/FadeIn";
import { Mascot } from "../components/Mascot";
import { PressableScale } from "../components/PressableScale";
import { useLanguage } from "../i18n";
import { colors, elevation, fontWeights, gradients, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

export interface BarcodeScanScreenProps {
  /** Every food this app currently knows about (catalog + the user's own
   * custom foods), unfiltered by any area/cuisine selection — mirrors
   * App.tsx's `allFoods`. */
  foods: CanonicalFood[];
  onFound: (food: CanonicalFood) => void;
  onNotFound: (barcode: string) => void;
  onCancel: () => void;
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

export function BarcodeScanScreen({ foods, onFound, onNotFound, onCancel }: BarcodeScanScreenProps) {
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

  const handleCode = useCallback(
    (code: string) => {
      const match = findFoodByBarcode(foods, code);
      if (match) {
        onFound(match);
      } else {
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
  }, []);

  // --- Not-found state — shared by the camera path and the manual-entry path. ---
  if (notFoundCode) {
    return (
      <View style={styles.screen}>
        <FadeIn>
          <View style={styles.center}>
            <Mascot size={84} />
            <Text style={styles.title}>{t("barcode.notFoundTitle")}</Text>
            <Text style={styles.body}>{t("barcode.notFoundBody", { code: notFoundCode })}</Text>
            <PressableScale
              onPress={() => onNotFound(notFoundCode)}
              accessibilityRole="button"
              accessibilityLabel={t("barcode.notFoundCta")}
              style={styles.primaryButtonWrap}
            >
              <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.primaryButtonGradient}>
                <Text style={styles.primaryButtonText}>{t("barcode.notFoundCta")}</Text>
              </LinearGradient>
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
