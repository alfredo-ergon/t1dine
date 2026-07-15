import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { useLanguage } from "../i18n";
import { colors, fontSizes, fontWeights, spacing } from "../theme";
import { Mascot } from "./Mascot";

// Branded splash shown once at startup while the persisted language choice
// and AsyncStorage-backed data (favourites/recents/custom foods) load. This
// replaces a bare spinner with something that looks intentional: the mascot,
// wordmark, and a short PT-default tagline on a dark, on-brand background.
// Purely presentational — it never blocks or delays the load it represents.
export function Splash() {
  const { t } = useLanguage();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.center}>
        <Mascot size={132} />
        <Text style={styles.wordmark}>{t("app.name")}</Text>
        <Text style={styles.tagline}>{t("splash.tagline")}</Text>
        <View style={styles.loadingRow} accessibilityRole="progressbar" accessibilityLabel={t("splash.loading")}>
          <ActivityIndicator color={colors.brandSoft} />
          <Text style={styles.loadingText}>{t("splash.loading")}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xxl },
  wordmark: {
    marginTop: spacing.lg,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.extrabold,
    color: colors.onBrand,
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: spacing.xs,
    fontSize: fontSizes.base,
    color: colors.brandSoft,
    textAlign: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xxxl,
  },
  loadingText: { fontSize: fontSizes.sm, color: colors.brandSoft, opacity: 0.85 },
});
