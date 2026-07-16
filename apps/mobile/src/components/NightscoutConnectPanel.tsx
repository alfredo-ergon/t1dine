// Connect/disconnect UI for the user's own Nightscout site (Slice 6 —
// read-only glucose display). This panel ONLY owns the connect FORM and the
// connected/disconnected status card — GlucoseScreen owns loading the
// current connection from ../nightscoutStore.ts and actually fetching
// readings, mirroring how ../screens/AccountScreen.tsx is a thin
// presentation layer over App.tsx's session/sync orchestration.
//
// SAFETY: the Nightscout token is a HIGH-IMPACT credential (CLAUDE.md). This
// component never pre-fills the token field with a real stored value (only
// `currentUrl`, which is not sensitive, may be pre-filled when editing), and
// it never renders the token back once saved — only a "Token guardado" state.
// It never logs anything.

import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { FadeIn } from "./FadeIn";
import { PressableScale } from "./PressableScale";
import { useLanguage } from "../i18n";
import { colors, elevation, fontWeights, gradients, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

export interface NightscoutConnectPanelProps {
  /** Whether a connection is currently stored (native: OS keystore; web: this session only). */
  connected: boolean;
  /** The saved url, for pre-filling an "edit connection" form. Never the token — that is never pre-filled. */
  currentUrl: string | null;
  /** False on web, where the store is session-only (see ../nightscoutStore.ts). Drives the "not saved" notice. */
  isPersistent: boolean;
  /** Saves { url, token } to the secure store. Must throw on failure — mirrors AccountScreen's onLogin/onRegister contract. */
  onSave: (url: string, token: string) => Promise<void>;
  /** Clears the stored connection. Synchronous from this component's point of view (the parent awaits its own async clear). */
  onDisconnect: () => void;
}

function isValidNightscoutUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function NightscoutConnectPanel({ connected, currentUrl, isPersistent, onSave, onDisconnect }: NightscoutConnectPanelProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"status" | "form">(connected ? "status" : "form");
  const [urlText, setUrlText] = useState(currentUrl ?? "");
  const [tokenText, setTokenText] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const handleSave = async () => {
    const trimmedUrl = urlText.trim();
    if (trimmedUrl.length === 0) {
      setErrorKey("glucose.connect.errorUrlRequired");
      return;
    }
    if (!isValidNightscoutUrl(trimmedUrl)) {
      setErrorKey("glucose.connect.errorInvalidUrl");
      return;
    }
    if (tokenText.length === 0) {
      setErrorKey("glucose.connect.errorTokenRequired");
      return;
    }

    setErrorKey(null);
    setBusy(true);
    try {
      await onSave(trimmedUrl, tokenText);
      setTokenText("");
      setSaved(true);
      setMode("status");
    } catch {
      setErrorKey("glucose.connect.errorSaveFailed");
    } finally {
      setBusy(false);
    }
  };

  const handleStartEdit = () => {
    setUrlText(currentUrl ?? "");
    setTokenText("");
    setErrorKey(null);
    setSaved(false);
    setMode("form");
  };

  const handleCancelEdit = () => {
    setUrlText(currentUrl ?? "");
    setTokenText("");
    setErrorKey(null);
    setMode("status");
  };

  const handleConfirmDisconnect = () => {
    onDisconnect();
    setConfirmingDisconnect(false);
    setSaved(false);
    setUrlText("");
    setTokenText("");
    setMode("form");
  };

  return (
    <FadeIn>
      <View style={styles.card} accessible={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t("glucose.connect.title")}</Text>
          <View style={styles.readOnlyTag}>
            <Text style={styles.readOnlyTagText}>{t("glucose.connect.readOnlyTag")}</Text>
          </View>
        </View>

        {mode === "status" ? (
          <>
            <View
              style={styles.statusRow}
              accessible
              accessibilityLabel={`${isPersistent ? t("glucose.connect.statusConnected") : t("glucose.connect.statusConnectedSession")}. ${t("glucose.connect.tokenSavedBadge")}`}
            >
              <View style={[styles.statusDot, styles.statusDotOn]} />
              <Text style={styles.statusText}>{isPersistent ? t("glucose.connect.statusConnected") : t("glucose.connect.statusConnectedSession")}</Text>
              <View style={styles.savedBadge}>
                <Text style={styles.savedBadgeText}>{t("glucose.connect.tokenSavedBadge")}</Text>
              </View>
            </View>

            {!isPersistent && <Text style={styles.webNotice}>{t("glucose.connect.webNotice")}</Text>}

            {saved && (
              <View style={styles.successBanner} accessible accessibilityLabel={t("glucose.connect.saved")}>
                <Text style={styles.successIcon}>✓</Text>
                <Text style={styles.successText}>{t("glucose.connect.saved")}</Text>
              </View>
            )}

            <View style={styles.actionsRow}>
              <PressableScale
                onPress={handleStartEdit}
                accessibilityRole="button"
                accessibilityLabel={t("glucose.connect.editButton")}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>{t("glucose.connect.editButton")}</Text>
              </PressableScale>

              {confirmingDisconnect ? (
                <View style={styles.confirmInline}>
                  <PressableScale
                    onPress={() => setConfirmingDisconnect(false)}
                    accessibilityRole="button"
                    accessibilityLabel={t("glucose.connect.disconnectConfirmCancel")}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelButtonText}>{t("glucose.connect.disconnectConfirmCancel")}</Text>
                  </PressableScale>
                  <PressableScale
                    onPress={handleConfirmDisconnect}
                    accessibilityRole="button"
                    accessibilityLabel={t("glucose.connect.disconnectConfirmConfirm")}
                    style={styles.dangerButton}
                  >
                    <Text style={styles.dangerButtonText}>{t("glucose.connect.disconnectConfirmConfirm")}</Text>
                  </PressableScale>
                </View>
              ) : (
                <PressableScale
                  onPress={() => setConfirmingDisconnect(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t("glucose.connect.disconnectButton")}
                  style={styles.dangerOutlineButton}
                >
                  <Text style={styles.dangerOutlineButtonText}>{t("glucose.connect.disconnectButton")}</Text>
                </PressableScale>
              )}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.intro}>{t("glucose.connect.intro")}</Text>
            {!isPersistent && <Text style={styles.webNotice}>{t("glucose.connect.webNotice")}</Text>}

            <Text style={styles.fieldLabel}>{t("glucose.connect.urlLabel")}</Text>
            <TextInput
              style={styles.input}
              value={urlText}
              onChangeText={setUrlText}
              placeholder={t("glucose.connect.urlPlaceholder")}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              textContentType="URL"
              accessibilityLabel={t("glucose.connect.urlLabel")}
            />

            <Text style={styles.fieldLabel}>{t("glucose.connect.tokenLabel")}</Text>
            <TextInput
              style={styles.input}
              value={tokenText}
              onChangeText={setTokenText}
              placeholder={t("glucose.connect.tokenPlaceholder")}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType="password"
              accessibilityLabel={t("glucose.connect.tokenLabel")}
            />

            {errorKey && (
              <View style={styles.errorBanner} accessible accessibilityLabel={t(errorKey)}>
                <Text style={styles.errorIcon}>⚠</Text>
                <Text style={styles.errorText}>{t(errorKey)}</Text>
              </View>
            )}

            <View style={styles.actionsRow}>
              {connected && (
                <PressableScale
                  onPress={handleCancelEdit}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={t("glucose.connect.disconnectConfirmCancel")}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>{t("glucose.connect.disconnectConfirmCancel")}</Text>
                </PressableScale>
              )}
              <PressableScale
                onPress={handleSave}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={busy ? t("glucose.connect.saving") : t("glucose.connect.saveButton")}
                style={[styles.primaryButtonWrap, busy && styles.buttonDisabled]}
              >
                <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.primaryButtonGradient}>
                  {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryButtonText}>{t("glucose.connect.saveButton")}</Text>}
                </LinearGradient>
              </PressableScale>
            </View>
          </>
        )}
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.sm.native,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { fontSize: typeScale.subheading.size, fontWeight: fontWeights.bold, color: colors.textPrimary },
  readOnlyTag: { backgroundColor: colors.surfaceSunken, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  readOnlyTagText: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.3 },
  intro: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 19 },
  webNotice: { fontSize: 12, color: colors.confidenceMedium, marginBottom: spacing.sm, lineHeight: 17, fontWeight: "600" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.xs, flexWrap: "wrap" },
  statusDot: { width: 8, height: 8, borderRadius: radius.pill },
  statusDotOn: { backgroundColor: colors.success },
  statusText: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  savedBadge: { backgroundColor: colors.confidenceHighBg, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  savedBadgeText: { fontSize: 11, fontWeight: "700", color: colors.confidenceHigh },
  successBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.confidenceHighBg,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    alignItems: "flex-start",
  },
  successIcon: { color: colors.confidenceHigh, fontSize: 14, fontWeight: "700" },
  successText: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  fieldLabel: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    marginTop: spacing.sm,
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
    fontSize: 15,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    minHeight: MIN_TAP_TARGET,
  },
  errorBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.confidenceUnverifiedBg,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    alignItems: "flex-start",
  },
  errorIcon: { color: colors.danger, fontSize: 14, fontWeight: "700" },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: "600" },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  confirmInline: { flexDirection: "row", gap: spacing.sm, flex: 1 },
  primaryButtonWrap: { borderRadius: radius.pill, ...elevation.glow.native },
  primaryButtonGradient: {
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  primaryButtonText: { color: colors.onBrand, fontSize: 15, fontWeight: "700" },
  buttonDisabled: { opacity: 0.6 },
  secondaryButton: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  secondaryButtonText: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  dangerOutlineButton: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  dangerOutlineButtonText: { color: colors.danger, fontSize: 14, fontWeight: "700" },
  cancelButton: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  cancelButtonText: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  dangerButton: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  dangerButtonText: { color: colors.onBrand, fontSize: 14, fontWeight: "700" },
});
