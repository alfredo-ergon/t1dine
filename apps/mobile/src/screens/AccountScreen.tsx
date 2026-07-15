// "Conta" screen (Slice: accounts + multi-device sync). This screen ONLY
// owns the sign-in/sign-up FORM and the signed-in sync controls — all actual
// orchestration (calling the API, persisting the session, merging sync
// state, debounced background pushes) lives in App.tsx, which owns the
// favourites/customFoods state a sync touches. This keeps the screen a thin
// presentation layer, easy to reason about and to keep accessible.
//
// Offline-first: signing in is always an ENHANCEMENT. Every field below
// still works with no account and no network — `onLogin`/`onRegister`
// simply reject (a typed `ApiError`) when the network/API is unavailable,
// which this screen surfaces as a clear, non-technical message rather than
// a crash or a silent no-op.

import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ApiError, isConnectivityError } from "../api";
import type { StoredSession } from "../auth";
import { FadeIn } from "../components/FadeIn";
import { PressableScale } from "../components/PressableScale";
import { useLanguage } from "../i18n";
import { syncStatusLabelKey, type SyncStatus } from "../sync";
import { colors, elevation, fontWeights, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

export interface AccountScreenProps {
  session: StoredSession | null;
  syncStatus: SyncStatus;
  /** Throws a typed `ApiError` on failure (e.g. `invalid_credentials`) — this
   * screen is responsible for catching it and showing a message; App.tsx is
   * responsible for the session + sync bootstrap on success. */
  onLogin: (email: string, password: string) => Promise<void>;
  /** Throws a typed `ApiError` on failure (e.g. `email_taken`). */
  onRegister: (email: string, password: string) => Promise<void>;
  onLogout: () => void;
  onSyncNow: () => void;
}

type Busy = "idle" | "login" | "register";

function errorMessageKey(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "email_taken") return "account.errorEmailTaken";
    if (error.code === "invalid_credentials") return "account.errorInvalidCredentials";
    if (error.status === 400) return "account.errorValidation";
    if (isConnectivityError(error)) return "account.errorOffline";
  }
  return "account.errorGeneric";
}

export function AccountScreen({ session, syncStatus, onLogin, onRegister, onLogout, onSyncNow }: AccountScreenProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<Busy>("idle");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const validate = (): string | null => {
    if (email.trim().length === 0) return "account.errorEmailRequired";
    if (password.length === 0) return "account.errorPasswordRequired";
    return null;
  };

  const handleLogin = async () => {
    const validationError = validate();
    if (validationError) {
      setErrorKey(validationError);
      return;
    }
    setErrorKey(null);
    setBusy("login");
    try {
      await onLogin(email.trim(), password);
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    } finally {
      setBusy("idle");
    }
  };

  const handleRegister = async () => {
    const validationError = validate();
    if (validationError) {
      setErrorKey(validationError);
      return;
    }
    setErrorKey(null);
    setBusy("register");
    try {
      await onRegister(email.trim(), password);
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    } finally {
      setBusy("idle");
    }
  };

  if (session) {
    const syncDotStyle =
      syncStatus === "synced"
        ? styles.syncDotOk
        : syncStatus === "error"
          ? styles.syncDotError
          : syncStatus === "offline"
            ? styles.syncDotOffline
            : styles.syncDotNeutral;

    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <FadeIn>
          <Text style={styles.h1}>{t("account.title")}</Text>

          <View style={styles.card}>
            <Text style={styles.signedInEmail}>{t("account.signedInAs", { email: session.email })}</Text>

            <View
              style={styles.syncRow}
              accessible
              accessibilityLabel={`${t("account.syncStatusLabel")}: ${t(syncStatusLabelKey(syncStatus))}`}
            >
              <View style={[styles.syncDot, syncDotStyle]} />
              <Text style={styles.syncText}>{t(syncStatusLabelKey(syncStatus))}</Text>
            </View>

            <PressableScale
              onPress={onSyncNow}
              disabled={syncStatus === "syncing"}
              accessibilityRole="button"
              accessibilityLabel={t("account.syncNowButton")}
              style={[styles.primaryButton, syncStatus === "syncing" && styles.buttonDisabled]}
            >
              {syncStatus === "syncing" ? (
                <ActivityIndicator color={colors.onBrand} />
              ) : (
                <Text style={styles.primaryButtonText}>{t("account.syncNowButton")}</Text>
              )}
            </PressableScale>

            <PressableScale onPress={onLogout} accessibilityRole="button" accessibilityLabel={t("account.logoutButton")} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>{t("account.logoutButton")}</Text>
            </PressableScale>
          </View>
        </FadeIn>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <FadeIn>
        <Text style={styles.h1}>{t("account.title")}</Text>
        <Text style={styles.intro}>{t("account.intro")}</Text>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>{t("account.emailLabel")}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={t("account.emailPlaceholder")}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            accessibilityLabel={t("account.emailLabel")}
          />

          <Text style={styles.fieldLabel}>{t("account.passwordLabel")}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={t("account.passwordPlaceholder")}
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            textContentType="password"
            accessibilityLabel={t("account.passwordLabel")}
          />

          {errorKey && (
            <View style={styles.errorBanner} accessible accessibilityLabel={t(errorKey)}>
              <Text style={styles.errorText}>{t(errorKey)}</Text>
            </View>
          )}

          <PressableScale
            onPress={handleLogin}
            disabled={busy !== "idle"}
            accessibilityRole="button"
            accessibilityLabel={busy === "login" ? t("account.loggingIn") : t("account.loginButton")}
            style={[styles.primaryButton, busy !== "idle" && styles.buttonDisabled]}
          >
            {busy === "login" ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryButtonText}>{t("account.loginButton")}</Text>}
          </PressableScale>

          <PressableScale
            onPress={handleRegister}
            disabled={busy !== "idle"}
            accessibilityRole="button"
            accessibilityLabel={busy === "register" ? t("account.registering") : t("account.registerButton")}
            style={[styles.secondaryButton, busy !== "idle" && styles.buttonDisabled]}
          >
            {busy === "register" ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.secondaryButtonText}>{t("account.registerButton")}</Text>
            )}
          </PressableScale>
        </View>
      </FadeIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingBottom: 40 },
  h1: { fontSize: typeScale.heading.size, fontWeight: fontWeights.extrabold, color: colors.textPrimary, marginBottom: spacing.sm },
  intro: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 20 },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    ...elevation.sm.native,
  },
  signedInEmail: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.md },
  fieldLabel: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    marginTop: spacing.md,
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
  errorBanner: {
    backgroundColor: colors.confidenceUnverifiedBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: "600" },
  primaryButton: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    marginTop: spacing.lg,
    ...elevation.sm.native,
  },
  primaryButtonText: { color: colors.onBrand, fontSize: 15, fontWeight: "700" },
  secondaryButton: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
    marginTop: spacing.md,
  },
  secondaryButtonText: { color: colors.accent, fontSize: 15, fontWeight: "700" },
  buttonDisabled: { opacity: 0.6 },
  syncRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  syncDot: { width: 8, height: 8, borderRadius: radius.pill },
  syncDotNeutral: { backgroundColor: colors.textFaint },
  syncDotOk: { backgroundColor: colors.success },
  syncDotOffline: { backgroundColor: colors.textFaint },
  syncDotError: { backgroundColor: colors.danger },
  syncText: { fontSize: 13, color: colors.textMuted },
});
