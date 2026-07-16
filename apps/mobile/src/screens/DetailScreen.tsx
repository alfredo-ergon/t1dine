import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { CanonicalFood } from "@t1dine/food-schema";
import { regionForCountry } from "@t1dine/food-schema";

import { isConnectivityError, submitFoodToCatalog } from "../api";
import { regionLabel } from "../areaLabels";
import { FadeIn } from "../components/FadeIn";
import { PressableScale } from "../components/PressableScale";
import { foodEmoji } from "../foodEmoji";
import { confidenceStyle, displayName, FOOD_TYPE_KEY, nutrient } from "../search";
import { useLanguage } from "../i18n";
import { recordSubmission } from "../submissions";
import { colors, elevation, fontWeights, gradients, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

export interface DetailScreenProps {
  food: CanonicalFood;
  isFavourite: boolean;
  onToggleFavourite: (food: CanonicalFood) => void;
  /** Adds `food` to the current meal at the chosen quantity (grams). The
   * amount stays fully editable afterwards on the Meal screen. */
  onAdd: (food: CanonicalFood, amountGrams: number) => void;
  /** The signed-in account's bearer token, or `null` when not signed in — a
   * "Submit to the shared database" action still works anonymously (see
   * `POST /catalog/submissions`'s optional-auth contract). */
  authToken: string | null;
}

type SubmissionState = "idle" | "submitting" | "success" | "error";

// Quantity stepper bounds — mirror the Meal screen so a food picks up the
// same amount grammar on the detail page as it has once it's in the meal.
const STEP_GRAMS = 5;
const MIN_GRAMS = 0;
const MAX_GRAMS = 5000;
const DEFAULT_GRAMS = 100;

function clampGrams(value: number): number {
  return Math.min(MAX_GRAMS, Math.max(MIN_GRAMS, value));
}

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

  // Quantity to add (grams). A local text buffer lets the user type/clear
  // freely; it re-syncs from the authoritative amount after a stepper tap and
  // commits back on blur/submit — the same pattern as MealScreen's row.
  const [amount, setAmount] = useState(DEFAULT_GRAMS);
  const [amountText, setAmountText] = useState(String(DEFAULT_GRAMS));
  useEffect(() => {
    setAmountText(String(amount));
  }, [amount]);
  const commitAmount = () => {
    const parsed = Number(amountText.replace(",", "."));
    if (Number.isFinite(parsed)) setAmount(clampGrams(parsed));
    else setAmountText(String(amount));
  };
  // Carbohydrate for the chosen portion (nutrient basis is per 100 g).
  const portionCarb = carb ? (carb.value * amount) / 100 : undefined;

  // Submit-a-food (Slice: submit-a-food). Only offered for the user's OWN
  // custom foods — never for seeded/catalog foods, which are not this user's
  // to submit. A submission is ALWAYS a reviewed candidate, never presented
  // as immediately available to everyone (see `../api`'s `submitFoodToCatalog`).
  const [submission, setSubmission] = useState<SubmissionState>("idle");
  const [submissionOffline, setSubmissionOffline] = useState(false);

  const handleSubmit = () => {
    setSubmission("submitting");
    submitFoodToCatalog(food, authToken ?? undefined)
      .then((result) => {
        setSubmission("success");
        // "As minhas contribuições" (Slice: my submissions) — recorded
        // locally at the moment of a successful submission; there is no
        // per-user submissions endpoint to read this back from later.
        void recordSubmission({ id: result.id, name: primaryName, submittedAt: new Date().toISOString(), status: "pending" });
      })
      .catch((error: unknown) => {
        setSubmissionOffline(isConnectivityError(error));
        setSubmission("error");
      });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <FadeIn>
        <View style={styles.titleRow}>
          {/* Decorative food glyph — hidden from screen readers. */}
          <View style={styles.titleEmoji} accessible={false} importantForAccessibility="no-hide-descendants">
            <Text style={styles.titleEmojiGlyph}>{foodEmoji(food)}</Text>
          </View>
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
          <PressableScale
            onPress={() => onToggleFavourite(food)}
            accessibilityRole="button"
            accessibilityLabel={`${isFavourite ? t("favourite.remove") : t("favourite.add")}: ${primaryName}`}
            accessibilityState={{ selected: isFavourite }}
            style={styles.star}
            hitSlop={8}
          >
            <Text style={[styles.starIcon, isFavourite && styles.starIconActive]}>{isFavourite ? "★" : "☆"}</Text>
          </PressableScale>
        </View>

        <View style={[styles.confidenceCard, { backgroundColor: style.bg }]}>
          <Text style={[styles.confidenceText, { color: style.color }]}>
            {style.icon} {t(style.labelKey)}
          </Text>
          {confidence !== "high" && <Text style={styles.uncertaintyNote}>{t("detail.uncertaintyNote")}</Text>}
        </View>
      </FadeIn>

      <FadeIn delay={60}>
        <Text style={styles.sectionTitle}>{t("detail.nutrientsTitle")}</Text>
        <View style={styles.heroNutrientCard}>
          <LinearGradient
            colors={gradients.brand.colors}
            start={gradients.brand.start}
            end={gradients.brand.end}
            style={styles.heroNutrientGradient}
          >
            <Text style={styles.heroNutrientLabel}>{t("detail.carbLabel")}</Text>
            <Text style={styles.heroNutrientValue}>
              {carb ? carb.value : "—"} <Text style={styles.heroNutrientUnit}>{carb?.unit ?? ""}</Text>
            </Text>
          </LinearGradient>
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

        <Text style={styles.sectionTitle}>{t("detail.quantityLabel")}</Text>
        <View style={styles.quantityCard}>
          <View style={styles.stepper}>
            <PressableScale
              onPress={() => setAmount(clampGrams(amount - STEP_GRAMS))}
              accessibilityRole="button"
              accessibilityLabel={t("meal.decreaseLabel", { name: primaryName })}
              style={styles.stepperButton}
              hitSlop={4}
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </PressableScale>
            <TextInput
              style={styles.amountInput}
              keyboardType="numeric"
              value={amountText}
              onChangeText={setAmountText}
              onBlur={commitAmount}
              onSubmitEditing={commitAmount}
              accessibilityLabel={t("meal.amountInputLabel", { name: primaryName })}
            />
            <Text style={styles.gramsUnit}>{t("common.gramsUnit")}</Text>
            <PressableScale
              onPress={() => setAmount(clampGrams(amount + STEP_GRAMS))}
              accessibilityRole="button"
              accessibilityLabel={t("meal.increaseLabel", { name: primaryName })}
              style={styles.stepperButton}
              hitSlop={4}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </PressableScale>
          </View>
          {portionCarb !== undefined && (
            <View style={styles.portionRow}>
              <Text style={styles.portionLabel}>{t("detail.portionCarbLabel")}</Text>
              <Text style={styles.portionValue}>
                {portionCarb.toFixed(1)} {t("common.gramsUnit")} <Text style={styles.portionUnit}>{t("meal.carbShort")}</Text>
              </Text>
            </View>
          )}
        </View>

        <PressableScale
          style={styles.addButton}
          onPress={() => onAdd(food, amount)}
          accessibilityRole="button"
          accessibilityLabel={`${t("detail.addButton")}: ${primaryName}`}
        >
          <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.addButtonGradient}>
            <Text style={styles.addButtonText}>{t("detail.addButton")}</Text>
          </LinearGradient>
        </PressableScale>

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
              <PressableScale
                style={[styles.submitButton, submission === "submitting" && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submission === "submitting"}
                accessibilityRole="button"
                accessibilityState={{ disabled: submission === "submitting" }}
                accessibilityLabel={`${t("detail.submitCta")}: ${primaryName}`}
              >
                <Text style={styles.submitButtonText}>{submission === "submitting" ? t("detail.submitting") : t("detail.submitCta")}</Text>
              </PressableScale>
            )}
            {submission === "error" && (
              <Text style={styles.submitError}>{submissionOffline ? t("detail.submitErrorOffline") : t("detail.submitErrorGeneric")}</Text>
            )}
          </View>
        )}
      </FadeIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingBottom: 40 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  titleEmoji: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  titleEmojiGlyph: { fontSize: 26 },
  titleText: { flex: 1, paddingRight: spacing.sm },
  h1: { fontSize: typeScale.title.size, lineHeight: typeScale.title.lineHeight, fontWeight: fontWeights.extrabold, color: colors.textPrimary, letterSpacing: typeScale.title.letterSpacing },
  tagline: { fontSize: 15, color: colors.textSecondary, marginTop: 2, marginBottom: 6 },
  areaText: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  star: { minWidth: MIN_TAP_TARGET, minHeight: MIN_TAP_TARGET, alignItems: "center", justifyContent: "center" },
  starIcon: { fontSize: 30, color: colors.starInactive },
  starIconActive: { color: colors.star },
  confidenceCard: { borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.xs, marginBottom: 4 },
  confidenceText: { fontSize: 15, fontWeight: "700" },
  uncertaintyNote: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  sectionTitle: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    marginTop: 20,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
  },
  heroNutrientCard: {
    borderRadius: radius.xl,
    ...elevation.glow.native,
  },
  heroNutrientGradient: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: "center",
    overflow: "hidden",
  },
  heroNutrientLabel: { fontSize: 13, fontWeight: "700", color: colors.onBrand, textTransform: "uppercase", letterSpacing: 0.5 },
  heroNutrientValue: { fontSize: typeScale.display.size, fontWeight: fontWeights.extrabold, color: colors.onBrand, marginTop: 4, fontVariant: ["tabular-nums"] },
  heroNutrientUnit: { fontSize: typeScale.subheading.size, fontWeight: fontWeights.semibold, color: "rgba(255,255,255,0.9)" },
  nutrientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: 12,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...elevation.xs.native,
  },
  nutrientLabel: { fontSize: 15, color: colors.textSecondary },
  nutrientValue: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  provCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 12,
    ...elevation.xs.native,
  },
  provRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  provLabel: { fontSize: 14, color: colors.textMuted },
  provValue: { fontSize: 14, color: colors.textPrimary, fontWeight: "600", maxWidth: "62%", textAlign: "right" },
  quantityCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    ...elevation.xs.native,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepperButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTint,
    borderRadius: radius.md,
  },
  stepperButtonText: { fontSize: 22, fontWeight: "800", color: colors.brandDark },
  amountInput: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
  },
  gramsUnit: { fontSize: 14, color: colors.textMuted },
  portionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  portionLabel: { fontSize: 13, color: colors.textMuted },
  portionValue: { fontSize: 18, fontWeight: "800", color: colors.brandDark, fontVariant: ["tabular-nums"] },
  portionUnit: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  addButton: { borderRadius: radius.pill, marginTop: 22, ...elevation.glow.native },
  addButtonGradient: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: MIN_TAP_TARGET,
  },
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
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: colors.accent, fontSize: 15, fontWeight: "700" },
  submitSuccessBox: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: 12 },
  submitSuccessText: { color: colors.success, fontSize: 14, fontWeight: "600" },
  submitError: { color: "#B91C1C", fontSize: 13, marginTop: 8 },
});
