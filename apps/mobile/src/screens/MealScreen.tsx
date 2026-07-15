import { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { MealLine, MealLineSummary } from "@t1dine/nutrition";
import { summariseMeal } from "@t1dine/nutrition";

import { AnimatedCounter } from "../components/AnimatedCounter";
import { FadeIn } from "../components/FadeIn";
import { Mascot } from "../components/Mascot";
import { PressableScale } from "../components/PressableScale";
import { tPlural, useLanguage } from "../i18n";
import { confidenceStyle, displayName } from "../search";
import { colors, elevation, fontWeights, gradients, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

export interface MealScreenProps {
  lines: MealLine[];
  onChangeAmount: (foodId: string, amountGrams: number) => void;
  onRemove: (foodId: string) => void;
  /** Opens the "Estimativa de dose" screen with this meal's confirmed carbohydrate total. */
  onEstimateDose: () => void;
}

const STEP_GRAMS = 5;
const MIN_GRAMS = 0;
const MAX_GRAMS = 5000;

function clamp(value: number): number {
  return Math.min(MAX_GRAMS, Math.max(MIN_GRAMS, value));
}

interface MealLineRowProps {
  line: MealLineSummary;
  onChangeAmount: (foodId: string, amountGrams: number) => void;
  onRemove: (foodId: string) => void;
}

function MealLineRow({ line, onChangeAmount, onRemove }: MealLineRowProps) {
  const { language, t } = useLanguage();
  const name = displayName(line.food, language);
  const lineStyle = confidenceStyle(line.confidence);
  // Local text buffer so the user can freely type/clear the field; it only
  // re-syncs from the authoritative amount (e.g. after a stepper tap) and
  // commits back on blur/submit rather than on every keystroke.
  const [text, setText] = useState(String(line.amount));

  useEffect(() => {
    setText(String(line.amount));
  }, [line.amount]);

  const commit = () => {
    const parsed = Number(text.replace(",", "."));
    if (Number.isFinite(parsed)) {
      onChangeAmount(line.food.id, clamp(parsed));
    } else {
      setText(String(line.amount));
    }
  };

  return (
    <View style={styles.line}>
      <View style={styles.lineMain}>
        <Text style={styles.lineName}>{name}</Text>
        <Text style={styles.lineSub}>
          {line.carbGrams.toFixed(1)} {t("common.gramsUnit")} {t("meal.carbShort")} • {Math.round(line.energyKcal)} kcal
        </Text>
        <View
          style={[styles.miniBadge, { backgroundColor: lineStyle.bg }]}
          accessible
          accessibilityLabel={`${t("confidence.ariaPrefix")} ${t(lineStyle.labelKey)}`}
        >
          <Text style={[styles.miniBadgeText, { color: lineStyle.color }]}>
            {lineStyle.icon} {t(lineStyle.labelKey)}
          </Text>
        </View>
      </View>

      <View style={styles.lineControls}>
        <View style={styles.stepper}>
          <PressableScale
            onPress={() => onChangeAmount(line.food.id, clamp(line.amount - STEP_GRAMS))}
            accessibilityRole="button"
            accessibilityLabel={t("meal.decreaseLabel", { name })}
            style={styles.stepperButton}
            hitSlop={4}
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </PressableScale>

          <TextInput
            style={styles.amountInput}
            keyboardType="numeric"
            value={text}
            onChangeText={setText}
            onBlur={commit}
            onSubmitEditing={commit}
            accessibilityLabel={t("meal.amountInputLabel", { name })}
          />
          <Text style={styles.gramsUnit}>{t("common.gramsUnit")}</Text>

          <PressableScale
            onPress={() => onChangeAmount(line.food.id, clamp(line.amount + STEP_GRAMS))}
            accessibilityRole="button"
            accessibilityLabel={t("meal.increaseLabel", { name })}
            style={styles.stepperButton}
            hitSlop={4}
          >
            <Text style={styles.stepperButtonText}>+</Text>
          </PressableScale>
        </View>

        <PressableScale
          onPress={() => onRemove(line.food.id)}
          accessibilityRole="button"
          accessibilityLabel={t("meal.removeItemLabel", { name })}
          style={styles.removeButton}
        >
          <Text style={styles.removeButtonText}>{t("meal.remove")}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

export function MealScreen({ lines, onChangeAmount, onRemove, onEstimateDose }: MealScreenProps) {
  const { t } = useLanguage();
  // Deterministic, framework-independent meal maths shared with the API —
  // no clinical authority, just food carbohydrate/energy totals.
  const summary = useMemo(() => summariseMeal(lines), [lines]);
  const aggregateStyle = confidenceStyle(summary.aggregateConfidence);

  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>{t("meal.title")}</Text>
      <Text style={styles.meta}>{tPlural(t, "meal.items", summary.itemCount)}</Text>

      <FlatList
        data={summary.lines}
        keyExtractor={(line) => line.food.id}
        ListEmptyComponent={
          <FadeIn>
            <View style={styles.empty}>
              <Mascot size={84} />
              <Text style={styles.emptyTitle}>{t("meal.emptyTitle")}</Text>
              <Text style={styles.emptyBody}>{t("meal.emptyBody")}</Text>
            </View>
          </FadeIn>
        }
        renderItem={({ item }) => <MealLineRow line={item} onChangeAmount={onChangeAmount} onRemove={onRemove} />}
      />

      {summary.itemCount > 0 && (
        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{t("meal.totalsCarb")}</Text>
            <AnimatedCounter value={summary.totalCarbGrams} decimals={1} style={styles.totalsValueHero} suffix={` ${t("common.gramsUnit")}`} />
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{t("meal.totalsEnergy")}</Text>
            <Text style={styles.totalsValue}>{summary.totalEnergyKcal} kcal</Text>
          </View>

          {summary.hasUncertainty && (
            <View
              style={[styles.uncertaintyBanner, { backgroundColor: aggregateStyle.bg }]}
              accessible
              accessibilityLabel={t("meal.uncertaintyBanner")}
            >
              <Text style={[styles.uncertaintyIcon, { color: aggregateStyle.color }]}>{aggregateStyle.icon}</Text>
              <Text style={styles.uncertaintyText}>{t("meal.uncertaintyBanner")}</Text>
            </View>
          )}
        </View>
      )}

      <PressableScale
        onPress={onEstimateDose}
        disabled={summary.itemCount === 0}
        accessibilityRole="button"
        accessibilityLabel={t("meal.estimateDoseCta")}
        accessibilityState={{ disabled: summary.itemCount === 0 }}
        style={summary.itemCount === 0 ? styles.estimateDoseButtonDisabled : styles.estimateDoseButtonWrap}
      >
        {summary.itemCount === 0 ? (
          <Text style={[styles.estimateDoseButtonText, styles.estimateDoseButtonTextDisabled]}>{t("meal.estimateDoseCta")}</Text>
        ) : (
          <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.estimateDoseButtonGradient}>
            <Text style={styles.estimateDoseButtonText}>{t("meal.estimateDoseCta")}</Text>
          </LinearGradient>
        )}
      </PressableScale>
      {summary.itemCount === 0 && <Text style={styles.estimateDoseDisabledHint}>{t("meal.estimateDoseDisabledHint")}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  h1: { fontSize: typeScale.heading.size, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: 10 },
  empty: { padding: spacing.xxl, alignItems: "center" },
  emptyTitle: { fontSize: typeScale.heading.size, fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing.md },
  emptyBody: { fontSize: 14, color: colors.textMuted, marginTop: 4, textAlign: "center" },
  line: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginVertical: 6,
    ...elevation.sm.native,
  },
  lineMain: { marginBottom: spacing.sm },
  lineName: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  lineSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  miniBadge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, marginTop: spacing.xs },
  miniBadgeText: { fontSize: 11, fontWeight: "700" },
  lineControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  stepperButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTint,
    borderRadius: radius.sm,
  },
  stepperButtonText: { fontSize: 20, fontWeight: "700", color: colors.brandDark },
  amountInput: {
    minWidth: 56,
    minHeight: MIN_TAP_TARGET,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    textAlign: "center",
    fontSize: 16,
    color: colors.textPrimary,
    paddingHorizontal: spacing.xs,
  },
  gramsUnit: { fontSize: 13, color: colors.textMuted },
  removeButton: {
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  removeButtonText: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  totals: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    ...elevation.sm.native,
  },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  totalsLabel: { fontSize: 14, color: colors.textMuted },
  totalsValue: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  totalsValueHero: { fontSize: 22, fontWeight: "800", color: colors.brandDark, fontVariant: ["tabular-nums"] },
  uncertaintyBanner: { flexDirection: "row", gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm, alignItems: "flex-start" },
  uncertaintyIcon: { fontSize: 16, fontWeight: "700" },
  uncertaintyText: { flex: 1, fontSize: 13, color: colors.textSecondary },
  estimateDoseButtonWrap: { borderRadius: radius.pill, marginBottom: spacing.xs, ...elevation.glow.native },
  estimateDoseButtonGradient: { minHeight: MIN_TAP_TARGET, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  estimateDoseButtonDisabled: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  estimateDoseButtonText: { color: colors.onBrand, fontSize: 16, fontWeight: "700" },
  estimateDoseButtonTextDisabled: { color: colors.textFaint },
  estimateDoseDisabledHint: { fontSize: 12.5, color: colors.textMuted, textAlign: "center", marginBottom: spacing.md },
});
