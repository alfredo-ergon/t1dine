import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CanonicalFood } from "@t1dine/food-schema";

import { confidenceStyle, displayName, FOOD_TYPE_KEY, nutrient } from "../search";
import { useLanguage } from "../i18n";
import { colors, fontSizes, fontWeights, MIN_TAP_TARGET, radius, shadows, spacing } from "../theme";

export interface DetailScreenProps {
  food: CanonicalFood;
  isFavourite: boolean;
  onToggleFavourite: (food: CanonicalFood) => void;
  onAdd: (food: CanonicalFood) => void;
}

function ProvRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.provRow}>
      <Text style={styles.provLabel}>{label}</Text>
      <Text style={styles.provValue}>{value}</Text>
    </View>
  );
}

export function DetailScreen({ food, isFavourite, onToggleFavourite, onAdd }: DetailScreenProps) {
  const { language, t } = useLanguage();
  const secondaryLanguage = language === "pt" ? "en" : "pt";
  const carb = nutrient(food, "CHOAVL");
  const energy = nutrient(food, "ENERC");
  const confidence = carb?.confidence ?? "unverified";
  const style = confidenceStyle(confidence);
  const source = carb?.source;
  const primaryName = displayName(food, language);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={styles.h1}>{primaryName}</Text>
          <Text style={styles.tagline}>
            {displayName(food, secondaryLanguage)} • {t(FOOD_TYPE_KEY[food.type])}
          </Text>
        </View>
        <Pressable
          onPress={() => onToggleFavourite(food)}
          accessibilityRole="button"
          accessibilityLabel={`${isFavourite ? t("favourite.remove") : t("favourite.add")}: ${primaryName}`}
          accessibilityState={{ selected: isFavourite }}
          style={styles.star}
          hitSlop={8}
        >
          <Text style={[styles.starIcon, isFavourite && styles.starIconActive]}>{isFavourite ? "★" : "☆"}</Text>
        </Pressable>
      </View>

      <View style={[styles.confidenceCard, { backgroundColor: style.bg }]}>
        <Text style={[styles.confidenceText, { color: style.color }]}>
          {style.icon} {t(style.labelKey)}
        </Text>
        {confidence !== "high" && <Text style={styles.uncertaintyNote}>{t("detail.uncertaintyNote")}</Text>}
      </View>

      <Text style={styles.sectionTitle}>{t("detail.nutrientsTitle")}</Text>
      <View style={styles.nutrientRow}>
        <Text style={styles.nutrientLabel}>{t("detail.carbLabel")}</Text>
        <Text style={styles.nutrientValue}>{carb ? `${carb.value} ${carb.unit}` : "—"}</Text>
      </View>
      <View style={styles.nutrientRow}>
        <Text style={styles.nutrientLabel}>{t("detail.energyLabel")}</Text>
        <Text style={styles.nutrientValue}>{energy ? `${energy.value} ${energy.unit}` : "—"}</Text>
      </View>

      <Text style={styles.sectionTitle}>{t("detail.provenanceTitle")}</Text>
      {source ? (
        <View style={styles.provCard}>
          <ProvRow label={t("detail.sourceLabel")} value={source.sourceId} />
          <ProvRow label={t("detail.versionLabel")} value={source.sourceVersion} />
          <ProvRow label={t("detail.marketLabel")} value={source.market ?? "—"} />
          <ProvRow label={t("detail.methodLabel")} value={carb?.method ?? "—"} />
          <ProvRow label={t("detail.retrievedLabel")} value={source.retrievedAt.slice(0, 10)} />
          <ProvRow label={t("detail.licenceLabel")} value={source.licence} />
        </View>
      ) : (
        <Text style={styles.nutrientLabel}>{t("detail.noProvenance")}</Text>
      )}

      <Pressable
        style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        onPress={() => onAdd(food)}
        accessibilityRole="button"
        accessibilityLabel={`${t("detail.addButton")}: ${primaryName}`}
      >
        <Text style={styles.addButtonText}>{t("detail.addButton")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingBottom: 40 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  titleText: { flex: 1, paddingRight: spacing.sm },
  h1: { fontSize: fontSizes.xxl, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  tagline: { fontSize: fontSizes.base, color: colors.textSecondary, marginTop: 2, marginBottom: 14 },
  star: { minWidth: MIN_TAP_TARGET, minHeight: MIN_TAP_TARGET, alignItems: "center", justifyContent: "center" },
  starIcon: { fontSize: 28, color: colors.starInactive },
  starIconActive: { color: colors.star },
  confidenceCard: { borderRadius: radius.lg, padding: spacing.md, marginBottom: 8 },
  confidenceText: { fontSize: 15, fontWeight: "700" },
  uncertaintyNote: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textFaint, marginTop: 18, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  nutrientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card.native,
  },
  nutrientLabel: { fontSize: 15, color: colors.textSecondary },
  nutrientValue: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  provCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    ...shadows.card.native,
  },
  provRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  provLabel: { fontSize: 14, color: colors.textMuted },
  provValue: { fontSize: 14, color: colors.textPrimary, fontWeight: "600", maxWidth: "62%", textAlign: "right" },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 22,
    minHeight: MIN_TAP_TARGET,
    justifyContent: "center",
    ...shadows.card.native,
  },
  addButtonPressed: { backgroundColor: colors.accentPressed },
  addButtonText: { color: colors.onBrand, fontSize: 16, fontWeight: "700" },
});
