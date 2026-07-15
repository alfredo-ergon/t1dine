import { Pressable, StyleSheet, Text, View } from "react-native";

import { useLanguage } from "../i18n";
import { colors, MIN_TAP_TARGET, radius, spacing } from "../theme";
import { LanguageSwitch } from "./LanguageSwitch";
import { Mascot } from "./Mascot";

interface HeaderProps {
  /** True when a stacked screen (Detail / Create food / Profile) is showing instead of a tab. */
  showBack: boolean;
  onBack: () => void;
  onCreateFood: () => void;
  onOpenProfile: () => void;
}

// Persistent top bar: brand mark (Tino + wordmark) or Back (when a stacked
// screen is open), a quick "new custom food" entry point, a "Perfil" entry
// point (Slice 5 — export/delete data), and the PT | EN language switch —
// always reachable regardless of which tab is active.
export function Header({ showBack, onBack, onCreateFood, onOpenProfile }: HeaderProps) {
  const { t } = useLanguage();

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {showBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t("nav.back")} style={styles.backButton} hitSlop={8}>
            <Text style={styles.backText}>‹ {t("nav.back")}</Text>
          </Pressable>
        ) : (
          <View style={styles.brand}>
            <Mascot size={30} />
            <Text style={styles.title}>{t("app.name")}</Text>
          </View>
        )}
      </View>
      <View style={styles.right}>
        {!showBack && (
          <>
            <Pressable
              onPress={onCreateFood}
              accessibilityRole="button"
              accessibilityLabel={t("create.openCta")}
              style={({ pressed }) => [styles.createButton, pressed && styles.createButtonPressed]}
            >
              <Text style={styles.createButtonText}>+ {t("create.openCta")}</Text>
            </Pressable>
            <Pressable
              onPress={onOpenProfile}
              accessibilityRole="button"
              accessibilityLabel={t("profile.openLabel")}
              style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}
              hitSlop={8}
            >
              <Text style={styles.profileButtonText}>⚙</Text>
            </Pressable>
          </>
        )}
        <LanguageSwitch />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  left: { flex: 1 },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { fontSize: 21, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.3 },
  backButton: { minHeight: MIN_TAP_TARGET, justifyContent: "center" },
  backText: { fontSize: 16, color: colors.accent, fontWeight: "600" },
  createButton: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  createButtonPressed: { backgroundColor: colors.accentSoft },
  createButtonText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  profileButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  profileButtonPressed: { backgroundColor: colors.surfaceAlt },
  profileButtonText: { color: colors.textSecondary, fontSize: 16, fontWeight: "700" },
});
