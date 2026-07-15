import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CanonicalFood } from "@t1dine/food-schema";
import { regionForCountry } from "@t1dine/food-schema";

import { isConnectivityError, submitFoodToCatalog } from "../api";
import { regionLabel } from "../areaLabels";
import { confidenceStyle, displayName, FOOD_TYPE_KEY, nutrient } from "../search";
import { useLanguage } from "../i18n";
import { colors, fontSizes, fontWeights, MIN_TAP_TARGET, radius, shadows, spacing } from "../theme";

export interface DetailScreenProps {
  food: CanonicalFood;
  isFavourite: boolean;
  onToggleFavourite: (food: CanonicalFood) => void;
  onAdd: (food: CanonicalFood) => void;
  /** The signed-in account's bearer token, or `null` when not signed in — a
   * "Submit to the shared database" action still works anonymously (see
   * `POST /catalog/submissions`'s optional-auth contract). */
  authToken: string | null;
}

type SubmissionState = "idle" | "submitting" | "success" | "error";

function ProvRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.provRow}>
      <Text style={styles.provLabel}>{label}</Text>
      <Text style={styles.provValue}>{value}</Text>
    </View>
  );
}

export function DetailScreen({ food, isFavourite, onToggleFavourite, onAdd, authToken }: DetailScreenProps) {
  const { language, t } = useLanguage();
  const secondaryLanguage = language === "pt" ? "en" : "pt";
  const carb = nutrient(food, "CHOAVL");
  const energy = nutrient(food, "ENERC");
  const confidence = carb?.confidence ?? "unverified";
  const style = confidenceStyle(confidence);
  const source = carb?.source;
  const primaryName = displayName(food, language);
  // A food's area is DERIVED from its `countries[]` (never a separate stored
  // field) — the first country that resolves to a known region, if any.
  const foodRegion = food.countries.map((code) => regionForCountry(code)).find((region) => region !== undefined);

  // Submit-a-food (Slice: submit-a-food). Only offered for the user's OWN
  // custom foods — never for seeded/catalog foods, which are not this user's
  // to submit. A submission is ALWAYS a reviewed candidate, never presented
  // as immediately available to everyone (see `../api`'s `submitFoodToCatalog`).
  const [submission, setSubmission] = useState<SubmissionState>("idle");
  const [submissionOffline, setSubmissionOffline] = useState(false);

  const handleSubmit = () => {
    setSubmission("submitting");
    submitFoodToCatalog(food, authToken ?? undefined)
      .then(() => setSubmission("success"))
      .catch((error: unknown) => {
        setSubmissionOffline(isConnectivityError(error));
        setSubmission("error");
      });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={styles.h1}>{primaryName}</Text>
          <Text style={styles.tagline}>
            {displayName(food, secondaryLanguage)} • {t(FOOD_TYPE_KEY[food.type])}
          </Text>
          {foodRegion && (
            <Text style={styles.areaText}>
              {t("detail.areaLabel")}: {regionLabel(foodRegion, language)}
            </Text>
          )}
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

      {/* Submit-a-food: only the user's OWN custom foods can be contributed to
          the shared catalog, and always as a reviewed candidate (never public
          until a curator approves it). */}
      {food.type === "custom" && (
        <View style={styles.submitSection}>
          <Text style={styles.sectionTitle}>{t("detail.submitTitle")}</Text>
          <Text style={styles.submitHint}>{t("detail.submitHint")}</Text>
          {submission === "success" ? (
            <View style={styles.submitSuccessBox}>
              <Text style={styles.submitSuccessText}>{t("detail.submitSuccess")}</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.submitButtonPressed,
                submission === "submitting" && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submission === "submitting"}
              accessibilityRole="button"
              accessibilityState={{ disabled: submission === "submitting" }}
              accessibilityLabel={`${t("detail.submitCta")}: ${primaryName}`}
            >
              <Text style={styles.submitButtonText}>
                {submission === "submitting" ? t("detail.submitting") : t("detail.submitCta")}
              </Text>
            </Pressable>
          )}
          {submission === "error" && (
            <Text style={styles.submitError}>
              {submissionOffline ? t("detail.submitErrorOffline") : t("detail.submitErrorGeneric")}
            </Text>
          )}
        </View>
      )}
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
  areaText: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: 2, marginBottom: 8 },
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
  submitSection: { marginTop: 24 },
  submitHint: { fontSize: 13, color: colors.textMuted, marginBottom: 10 },
  submitButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: MIN_TAP_TARGET,
  },
  submitButtonPressed: { backgroundColor: colors.accentSoft },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: colors.accent, fontSize: 15, fontWeight: "700" },
  submitSuccessBox: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: 12 },
  submitSuccessText: { color: colors.success, fontSize: 14, fontWeight: "600" },
  submitError: { color: "#B91C1C", fontSize: 13, marginTop: 8 },
});
