import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useLanguage } from "../i18n";
import { colors, elevation, gradients, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";
import { LanguageSwitch } from "./LanguageSwitch";
import { Mascot } from "./Mascot";
import { PressableScale } from "./PressableScale";

interface HeaderProps {
  /** True when a stacked screen (Detail / Create food / Profile) is showing instead of a tab. */
  showBack: boolean;
  onBack: () => void;
  onCreateFood: () => void;
  onOpenProfile: () => void;
  /** Opens the "Conta" screen (Slice: accounts + multi-device sync). */
  onOpenAccount: () => void;
}

// A translucent "light on dark" overlay palette, used only for the small
// pill/icon controls that sit on top of the ink gradient header — the rest
// of the app's controls sit on light surfaces and use the regular `colors`
// tokens. Kept local to this file since nothing else renders on a dark
// gradient like this.
const overlay = {
  fill: "rgba(255,255,255,0.14)",
  fillPressed: "rgba(255,255,255,0.24)",
  border: "rgba(255,255,255,0.30)",
};

// Persistent top bar: brand mark (Tino + wordmark) or Back (when a stacked
// screen is open), a quick "new custom food" entry point, a "Conta" entry
// point (Slice: accounts + multi-device sync), a "Perfil" entry point
// (Slice 5 — export/delete data), and the PT | EN language switch — always
// reachable regardless of which tab is active. Rendered on the signature ink
// gradient so it reads as one premium, branded surface across every screen.
export function Header({ showBack, onBack, onCreateFood, onOpenProfile, onOpenAccount }: HeaderProps) {
  const { t } = useLanguage();

  return (
    <LinearGradient colors={gradients.ink.colors} start={gradients.ink.start} end={gradients.ink.end} style={styles.gradient}>
      <View style={styles.header}>
        <View style={styles.left}>
          {showBack ? (
            <PressableScale
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t("nav.back")}
              style={({ pressed }) => [styles.backButton, pressed && styles.overlayPressed]}
            >
              <Text style={styles.backText}>‹ {t("nav.back")}</Text>
            </PressableScale>
          ) : (
            <View style={styles.brand}>
              <Mascot size={32} />
              <Text style={styles.title}>{t("app.name")}</Text>
            </View>
          )}
        </View>
        <View style={styles.right}>
          {!showBack && (
            <>
              <PressableScale
                onPress={onCreateFood}
                accessibilityRole="button"
                accessibilityLabel={t("create.openCta")}
                style={({ pressed }) => [styles.pillButton, pressed && styles.overlayPressed]}
              >
                <Text style={styles.pillButtonText}>+ {t("create.openCta")}</Text>
              </PressableScale>
              <PressableScale
                onPress={onOpenAccount}
                accessibilityRole="button"
                accessibilityLabel={t("account.openLabel")}
                style={({ pressed }) => [styles.pillButton, pressed && styles.overlayPressed]}
              >
                <Text style={styles.pillButtonText}>{t("account.openLabel")}</Text>
              </PressableScale>
              <PressableScale
                onPress={onOpenProfile}
                accessibilityRole="button"
                accessibilityLabel={t("profile.openLabel")}
                style={({ pressed }) => [styles.iconButton, pressed && styles.overlayPressed]}
              >
                <Text style={styles.iconButtonText}>⚙</Text>
              </PressableScale>
            </>
          )}
          <LanguageSwitch />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...elevation.md.native,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  left: { flex: 1 },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: {
    fontSize: typeScale.heading.size,
    fontWeight: typeScale.heading.weight,
    letterSpacing: typeScale.heading.letterSpacing,
    color: colors.onBrand,
  },
  backButton: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: overlay.fill,
    borderWidth: 1,
    borderColor: overlay.border,
    alignSelf: "flex-start",
  },
  backText: { fontSize: 15, color: colors.onBrand, fontWeight: "700" },
  overlayPressed: { backgroundColor: overlay.fillPressed },
  pillButton: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: overlay.fill,
    borderWidth: 1,
    borderColor: overlay.border,
  },
  pillButtonText: { color: colors.onBrand, fontSize: 13, fontWeight: "700" },
  iconButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: overlay.fill,
    borderWidth: 1,
    borderColor: overlay.border,
  },
  iconButtonText: { color: colors.onBrand, fontSize: 16, fontWeight: "700" },
});
