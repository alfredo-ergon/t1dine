import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { FadeIn } from "../components/FadeIn";
import { PressableScale } from "../components/PressableScale";
import { describeDoseBlockReason, estimateDose, type DoseEstimateResult } from "../dose/boundary";
import type { DoseProfile } from "../dose/profile";
import { useLanguage, type Language, type TranslateFn } from "../i18n";
import { colors, elevation, fontWeights, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

// T1Dine Dose Assist — "Estimativa de dose" review screen.
//
// This screen NEVER imports @t1dine/dose-engine directly; the only path to a
// number is `estimateDose()` from ../dose/boundary (enforced by
// .dependency-cruiser.cjs's "only-boundary-imports-dose-engine" rule, run via
// `pnpm boundaries`). It always shows the full arithmetic — never a single
// collapsed number — and on a "blocked" result it shows NO number at all,
// just the safe, translated reasons from `describeDoseBlockReason`.
//
// This is an ESTIMATE for the user to review and confirm with their diabetes
// team — never an instruction. Nothing on this screen is AI, OCR, or
// probabilistic; the meal's carbohydrate total is passed in as already
// confirmed by the Meal screen.
//
// PRESENTATION-ONLY REDESIGN NOTE: only styling/layout changed below (cards,
// spacing, a distinct "Dose Assist" chip, a steel/info accent instead of the
// food-side emerald brand — CLAUDE.md: "Keep clinical calculation UI
// separate from food-estimation UI"). No dose math, rounding, formatting
// precision, copy, or the boundary import changed. The dose number is
// rendered as a single plain `Text` (no animated counter) so a mid-animation
// value can never be misread as an actionable dose, and the "blocked" state
// still renders no number at all, only the named reason(s).

export interface DoseReviewScreenProps {
  /** Confirmed total carbohydrate for the meal, in grams (from summariseMeal). */
  totalCarbGrams: number;
  profile: DoseProfile;
}

/** Trims a fixed-decimal string to at most `maxDp` places, dropping insignificant trailing zeros. */
function formatTrimmed(value: number, maxDp = 2): string {
  if (!Number.isFinite(value)) return "—";
  const fixed = value.toFixed(maxDp);
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function formatFixed(value: number, dp: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(dp);
}

interface QuickCarbRow {
  grams: number;
  units: number;
}

interface QuickCorrectionRow {
  glucose: number;
  units: number;
}

function buildQuickCarbTable(carbGramsPerUnit: number): QuickCarbRow[] {
  const rows: QuickCarbRow[] = [];
  for (let units = 1; units <= 6; units += 1) {
    rows.push({ grams: units * carbGramsPerUnit, units });
  }
  return rows;
}

function buildQuickCorrectionTable(targetGlucose: number, glucosePerCorrectionUnit: number): QuickCorrectionRow[] {
  const rows: QuickCorrectionRow[] = [];
  for (let units = 1; units <= 5; units += 1) {
    rows.push({ glucose: targetGlucose + units * glucosePerCorrectionUnit, units });
  }
  return rows;
}

export function DoseReviewScreen({ totalCarbGrams, profile }: DoseReviewScreenProps) {
  const { t, language } = useLanguage();

  const [glucoseText, setGlucoseText] = useState("");
  const [activeInsulinText, setActiveInsulinText] = useState("0");
  const [glucoseError, setGlucoseError] = useState<string | null>(null);
  const [result, setResult] = useState<DoseEstimateResult | null>(null);

  const handleCalculate = () => {
    const trimmedGlucose = glucoseText.trim();
    if (trimmedGlucose.length === 0) {
      setGlucoseError(t("dose.errorGlucoseRequired"));
      setResult(null);
      return;
    }
    setGlucoseError(null);

    const glucoseValue = Number(trimmedGlucose.replace(",", "."));
    const activeInsulinUnits = Number(activeInsulinText.trim().replace(",", "."));
    const nowIso = new Date().toISOString();

    // Any invalid/implausible value (including a non-numeric active insulin
    // entry, or a NaN glucose) is NOT special-cased here — it is handed to
    // the deterministic boundary, which fails closed with an explicit,
    // translated reason and no number, per the clinical-safety rules.
    const nextResult = estimateDose({
      totalCarbGrams,
      glucoseValue,
      activeInsulinUnits,
      profile,
      glucoseMeasuredAtIso: nowIso,
      calculatedAtIso: nowIso,
    });
    setResult(nextResult);
  };

  const quickCarbRows = buildQuickCarbTable(profile.carbGramsPerUnit);
  const quickCorrectionRows = buildQuickCorrectionTable(profile.targetGlucose, profile.glucosePerCorrectionUnit);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <FadeIn>
        <View style={styles.clinicalChip}>
          <Text style={styles.clinicalChipText}>T1Dine Dose Assist</Text>
        </View>
        <Text style={styles.h1}>{t("dose.title")}</Text>

        {/* MANDATORY, non-dismissable — always visible regardless of state. */}
        <View style={styles.disclaimerBanner} accessible accessibilityLabel={t("dose.disclaimerBanner")}>
          <Text style={styles.disclaimerIcon}>ⓘ</Text>
          <Text style={styles.disclaimerText}>{t("dose.disclaimerBanner")}</Text>
        </View>

        {/* MANDATORY full safety rule — always visible regardless of state. */}
        <View style={styles.safetyRuleCard} accessible accessibilityLabel={t("dose.safetyRule")}>
          <Text style={styles.safetyRuleText}>{t("dose.safetyRule")}</Text>
        </View>

        <View style={styles.mealCarbRow}>
          <Text style={styles.mealCarbLabel}>{t("dose.mealCarbLabel")}</Text>
          <Text style={styles.mealCarbValue}>
            {formatTrimmed(totalCarbGrams, 1)} {t("common.gramsUnit")}
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>{t("dose.glucoseLabel")}</Text>
          <TextInput
            style={styles.input}
            value={glucoseText}
            onChangeText={(value) => {
              setGlucoseText(value);
              if (glucoseError) setGlucoseError(null);
            }}
            keyboardType="numeric"
            placeholder={t("dose.glucosePlaceholder")}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={`${t("dose.glucoseLabel")} — ${t("dose.glucoseRequiredHint")}`}
          />
          {glucoseError && <Text style={styles.error}>{glucoseError}</Text>}

          <Text style={styles.label}>{t("dose.activeInsulinLabel")}</Text>
          <TextInput
            style={styles.input}
            value={activeInsulinText}
            onChangeText={setActiveInsulinText}
            keyboardType="numeric"
            accessibilityLabel={t("dose.activeInsulinLabel")}
          />
          <Text style={styles.caption}>{t("dose.activeInsulinCaption")}</Text>

          <PressableScale onPress={handleCalculate} accessibilityRole="button" accessibilityLabel={t("dose.calculateButton")} style={styles.calculateButton}>
            <Text style={styles.calculateButtonText}>{t("dose.calculateButton")}</Text>
          </PressableScale>
        </View>

        {result === null && <Text style={styles.pendingText}>{t("dose.resultPending")}</Text>}

        {result !== null && result.status === "blocked" && <BlockedResult result={result} language={language} t={t} />}

        {result !== null && result.status === "estimate" && <EstimateResult result={result} t={t} />}

        <Text style={styles.quickTablesTitle}>{t("dose.quickTablesTitle")}</Text>
        <View style={styles.quickTablesRow}>
          <View style={styles.quickTable}>
            <Text style={styles.quickTableTitle}>{t("dose.quickCarbTableTitle", { ratio: formatTrimmed(profile.carbGramsPerUnit, 1) })}</Text>
            {quickCarbRows.map((row) => (
              <View key={row.units} style={styles.quickTableRow}>
                <Text style={styles.quickTableCell}>
                  {formatTrimmed(row.grams, 1)} {t("dose.quickTableCarbUnit")}
                </Text>
                <Text style={styles.quickTableCellStrong}>{row.units}</Text>
              </View>
            ))}
          </View>
          <View style={styles.quickTable}>
            <Text style={styles.quickTableTitle}>
              {t("dose.quickCorrectionTableTitle", {
                target: formatTrimmed(profile.targetGlucose, 1),
                factor: formatTrimmed(profile.glucosePerCorrectionUnit, 1),
              })}
            </Text>
            {quickCorrectionRows.map((row) => (
              <View key={row.units} style={styles.quickTableRow}>
                <Text style={styles.quickTableCell}>
                  {formatTrimmed(row.glucose, 1)} {t("dose.quickTableCorrectionUnit")}
                </Text>
                <Text style={styles.quickTableCellStrong}>+{row.units}</Text>
              </View>
            ))}
          </View>
        </View>
      </FadeIn>
    </ScrollView>
  );
}

interface BlockedResultProps {
  result: Extract<DoseEstimateResult, { status: "blocked" }>;
  language: Language;
  t: TranslateFn;
}

function BlockedResult({ result, language, t }: BlockedResultProps) {
  const hasHypo = result.reasons.includes("glucose-below-safe-threshold");
  const otherReasons = result.reasons.filter((reason) => reason !== "glucose-below-safe-threshold");

  return (
    <View>
      {hasHypo && (
        <View style={styles.hypoCard} accessible accessibilityLabel={describeDoseBlockReason("glucose-below-safe-threshold", language)}>
          <Text style={styles.hypoIcon}>⚠</Text>
          <View style={styles.hypoTextWrap}>
            <Text style={styles.hypoTitle}>{t("dose.blockedHypoTitle")}</Text>
            <Text style={styles.hypoBody}>{describeDoseBlockReason("glucose-below-safe-threshold", language)}</Text>
          </View>
        </View>
      )}

      {otherReasons.length > 0 && (
        <View style={styles.blockedCard}>
          <Text style={styles.blockedTitle}>{t("dose.blockedTitle")}</Text>
          {otherReasons.map((reason) => (
            <View key={reason} style={styles.blockedReasonRow}>
              <Text style={styles.blockedReasonBullet}>•</Text>
              <Text style={styles.blockedReasonText}>{describeDoseBlockReason(reason, language)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

interface EstimateResultProps {
  result: Extract<DoseEstimateResult, { status: "estimate" }>;
  t: TranslateFn;
}

function EstimateResult({ result, t }: EstimateResultProps) {
  const { inputs } = result;

  return (
    <View style={styles.workingCard}>
      <Text style={styles.workingTitle}>{t("dose.workingTitle")}</Text>

      <Text style={styles.workingLine}>
        {t("dose.workingMealLine", {
          carbs: formatTrimmed(inputs.confirmedCarbohydrateGrams, 1),
          ratio: formatTrimmed(inputs.carbGramsPerUnit, 1),
          units: formatTrimmed(result.mealComponentUnits, 2),
        })}
      </Text>
      <Text style={styles.workingLine}>
        {t("dose.workingCorrectionLine", {
          glucose: formatTrimmed(inputs.glucoseValue, 1),
          target: formatTrimmed(inputs.targetGlucose, 1),
          factor: formatTrimmed(inputs.glucosePerCorrectionUnit, 1),
          units: formatTrimmed(result.correctionComponentUnits, 2),
        })}
      </Text>
      <Text style={styles.workingLine}>
        {t("dose.workingActiveInsulinLine", { units: formatTrimmed(result.activeInsulinUnits, 2) })}
      </Text>
      <View style={styles.workingDivider} />
      <Text style={styles.workingTotalLine}>
        {t("dose.workingTotalLine", { units: formatFixed(result.unroundedUnits, 2) })}
      </Text>

      <View style={styles.doseCard}>
        <Text style={styles.doseLabel}>{t("dose.approximateDoseLabel")}</Text>
        <Text style={styles.doseValue}>
          {formatTrimmed(result.roundedUnits, 2)} <Text style={styles.doseUnit}>{t("dose.approximateDoseUnit")}</Text>
        </Text>
        <Text style={styles.doseNote}>
          {t("dose.roundingNote", { increment: formatTrimmed(inputs.administrationIncrementUnits, 1) })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingBottom: 40 },
  clinicalChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.info,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.sm,
  },
  clinicalChipText: { fontSize: 11, fontWeight: "800", color: colors.onBrand, letterSpacing: 0.3 },
  h1: { fontSize: typeScale.heading.size, fontWeight: fontWeights.extrabold, color: colors.textPrimary, marginTop: spacing.xs, marginBottom: spacing.sm },

  disclaimerBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.confidenceMediumBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: "flex-start",
  },
  disclaimerIcon: { color: colors.confidenceMedium, fontSize: 16, fontWeight: "700" },
  disclaimerText: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: "700" },

  safetyRuleCard: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  safetyRuleText: { fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },

  mealCarbRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  mealCarbLabel: { fontSize: 14, color: colors.textMuted },
  mealCarbValue: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },

  formCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.sm.native,
  },
  label: {
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
  error: { color: colors.danger, fontSize: 13, marginTop: 4 },
  caption: { fontSize: 12.5, color: colors.textMuted, marginTop: 4 },

  calculateButton: {
    marginTop: spacing.lg,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.info,
    ...elevation.sm.native,
  },
  calculateButtonText: { color: colors.onBrand, fontSize: 16, fontWeight: "700" },

  pendingText: { fontSize: 14, color: colors.textMuted, marginTop: spacing.lg, textAlign: "center" },

  hypoCard: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.confidenceUnverifiedBg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.danger,
    padding: spacing.md,
    marginTop: spacing.lg,
    alignItems: "flex-start",
  },
  hypoIcon: { color: colors.danger, fontSize: 22, fontWeight: "700" },
  hypoTextWrap: { flex: 1 },
  hypoTitle: { color: colors.danger, fontSize: 15, fontWeight: "800", marginBottom: 4 },
  hypoBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },

  blockedCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  blockedTitle: { fontSize: 14, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.xs },
  blockedReasonRow: { flexDirection: "row", gap: spacing.xs, marginTop: 4 },
  blockedReasonBullet: { color: colors.textMuted, fontSize: 14 },
  blockedReasonText: { flex: 1, color: colors.textSecondary, fontSize: 14, lineHeight: 20 },

  workingCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginTop: spacing.lg,
    ...elevation.sm.native,
  },
  workingTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textFaint,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  workingLine: { fontSize: 14.5, color: colors.textSecondary, marginBottom: 6, fontVariant: ["tabular-nums"] },
  workingDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.xs },
  workingTotalLine: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.sm, fontVariant: ["tabular-nums"] },

  doseCard: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.info,
    padding: spacing.md,
    marginTop: spacing.sm,
    alignItems: "center",
  },
  doseLabel: { fontSize: 13, fontWeight: "700", color: colors.info, textTransform: "uppercase", letterSpacing: 0.5 },
  doseValue: { fontSize: typeScale.title.size, fontWeight: fontWeights.extrabold, color: colors.textPrimary, marginTop: 4, fontVariant: ["tabular-nums"] },
  doseUnit: { fontSize: typeScale.subheading.size, fontWeight: fontWeights.semibold, color: colors.textSecondary },
  doseNote: { fontSize: 12.5, color: colors.textMuted, marginTop: 4, textAlign: "center" },

  quickTablesTitle: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
  },
  quickTablesRow: { flexDirection: "row", gap: spacing.md },
  quickTable: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  quickTableTitle: { fontSize: 11.5, fontWeight: "700", color: colors.textMuted, marginBottom: spacing.xs },
  quickTableRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  quickTableCell: { fontSize: 12.5, color: colors.textSecondary },
  quickTableCellStrong: { fontSize: 12.5, fontWeight: "700", color: colors.textPrimary },
});
