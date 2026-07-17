import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { CanonicalFood } from "@t1dine/food-schema";

import { FadeIn } from "../components/FadeIn";
import { Mascot } from "../components/Mascot";
import { PressableScale } from "../components/PressableScale";
import { tPlural, useLanguage } from "../i18n";
import type { Recipe, RecipeInput } from "../recipes";
import { recipePerPortion, recipeTotals } from "../recipes";
import { colors, elevation, fontWeights, gradients, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";
import { RecipeEditScreen } from "./RecipeEditScreen";

export interface RecipesScreenProps {
  recipes: Recipe[];
  /** Every food this device currently knows about — handed straight through
   * to the create/edit form's ingredient picker. */
  allFoods: CanonicalFood[];
  /** `editing` is the recipe being replaced in place, or `null` for a
   * brand-new one — mirrors ../recipes.ts's `buildRecipe(input, existing?)`. */
  onSave: (input: RecipeInput, editing: Recipe | null) => void;
  onDelete: (id: string) => void;
  /** "Adicionar à refeição": adds `portions` portions of `recipe` to the
   * current meal via the app's existing meal-adding pipeline. */
  onUse: (recipe: Recipe, portions: number) => void;
}

const MAX_PORTIONS_TO_ADD = 50;

function clampPortionsToAdd(value: number): number {
  return Math.min(MAX_PORTIONS_TO_ADD, Math.max(1, Math.round(value)));
}

interface RecipeCardProps {
  recipe: Recipe;
  onEdit: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  onUse: (recipe: Recipe, portions: number) => void;
}

function RecipeCard({ recipe, onEdit, onDelete, onUse }: RecipeCardProps) {
  const { t } = useLanguage();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [portionsToAdd, setPortionsToAdd] = useState(1);

  const totals = recipeTotals(recipe);
  const perPortion = recipePerPortion(recipe);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {/* Decorative recipe glyph — hidden from screen readers, mirroring
            ../screens/SavedMealsScreen.tsx's/../screens/HistoryScreen.tsx's
            fixed meal glyph (a recipe bundles several foods, so there is no
            single food to derive foodEmoji() from). */}
        <View style={styles.tile} accessible={false} importantForAccessibility="no-hide-descendants">
          <Text style={styles.tileGlyph}>🍲</Text>
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardName} numberOfLines={1}>
            {recipe.name}
          </Text>
          <Text style={styles.cardMeta}>
            {tPlural(t, "recipes.ingredientCount", recipe.ingredients.length)} • {tPlural(t, "recipes.portionCount", recipe.portions)}
          </Text>
          <View style={styles.perPortionRow}>
            <Text style={styles.perPortionValue}>
              {perPortion.carbGrams.toFixed(1)} {t("common.gramsUnit")}
            </Text>
            <Text style={styles.perPortionLabel}>
              {t("recipes.perPortionCarbLabel")} · {perPortion.portionWeightGrams.toFixed(0)} {t("common.gramsUnit")}/{t("recipes.portionUnit")}
            </Text>
          </View>
          <Text style={styles.cardTotal}>
            {t("recipes.totalLabel")}: {totals.carbGrams.toFixed(1)} {t("common.gramsUnit")} ({recipe.yieldGrams} {t("common.gramsUnit")})
          </Text>
        </View>
        <PressableScale
          onPress={() => onEdit(recipe)}
          accessibilityRole="button"
          accessibilityLabel={`${t("recipes.editCta")}: ${recipe.name}`}
          style={styles.editIconButton}
          hitSlop={4}
        >
          <Text style={styles.editIconText}>✎</Text>
        </PressableScale>
      </View>

      {confirmingDelete ? (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>{t("recipes.deleteConfirmTitle")}</Text>
          <Text style={styles.confirmBody}>{t("recipes.deleteConfirmBody")}</Text>
          <View style={styles.actionRow}>
            <PressableScale
              onPress={() => setConfirmingDelete(false)}
              accessibilityRole="button"
              accessibilityLabel={t("recipes.deleteConfirmCancel")}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>{t("recipes.deleteConfirmCancel")}</Text>
            </PressableScale>
            <PressableScale
              onPress={() => onDelete(recipe.id)}
              accessibilityRole="button"
              accessibilityLabel={t("recipes.deleteConfirmConfirm")}
              style={styles.dangerButton}
            >
              <Text style={styles.dangerButtonText}>{t("recipes.deleteConfirmConfirm")}</Text>
            </PressableScale>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.portionStepperRow}>
            <Text style={styles.portionStepperLabel}>{t("recipes.portionsToAddLabel")}</Text>
            <View style={styles.stepper}>
              <PressableScale
                onPress={() => setPortionsToAdd((current) => clampPortionsToAdd(current - 1))}
                accessibilityRole="button"
                accessibilityLabel={t("recipes.decreasePortionsLabel", { name: recipe.name })}
                style={styles.stepperButton}
                hitSlop={4}
              >
                <Text style={styles.stepperButtonText}>−</Text>
              </PressableScale>
              <Text style={styles.stepperValue}>{portionsToAdd}</Text>
              <PressableScale
                onPress={() => setPortionsToAdd((current) => clampPortionsToAdd(current + 1))}
                accessibilityRole="button"
                accessibilityLabel={t("recipes.increasePortionsLabel", { name: recipe.name })}
                style={styles.stepperButton}
                hitSlop={4}
              >
                <Text style={styles.stepperButtonText}>+</Text>
              </PressableScale>
            </View>
          </View>

          <View style={styles.actionRow}>
            <PressableScale
              onPress={() => onUse(recipe, portionsToAdd)}
              accessibilityRole="button"
              accessibilityLabel={`${t("recipes.useCta")}: ${recipe.name} (${portionsToAdd})`}
              accessibilityHint={t("recipes.useHint")}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>{t("recipes.useCta")}</Text>
            </PressableScale>
            <PressableScale
              onPress={() => setConfirmingDelete(true)}
              accessibilityRole="button"
              accessibilityLabel={`${t("recipes.deleteCta")}: ${recipe.name}`}
              style={styles.dangerOutlineButton}
              hitSlop={4}
            >
              <Text style={styles.dangerOutlineButtonText}>{t("recipes.deleteCta")}</Text>
            </PressableScale>
          </View>
        </>
      )}
    </View>
  );
}

type ScreenMode = { kind: "list" } | { kind: "create" } | { kind: "edit"; recipe: Recipe };

// "Receitas" (recipe carb calculator — Slice: Receitas). A single overlay
// (App.tsx only ever mounts one `{ kind: "recipes" }` overlay) that switches
// INTERNALLY between the list and the create/edit form, exactly like
// ../screens/SavedMealsScreen.tsx switches a single card between its normal
// and "renaming" views — this avoids adding a second, nested App-level
// overlay just for the form.
export function RecipesScreen({ recipes, allFoods, onSave, onDelete, onUse }: RecipesScreenProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<ScreenMode>({ kind: "list" });

  if (mode.kind === "create" || mode.kind === "edit") {
    const editingRecipe = mode.kind === "edit" ? mode.recipe : null;
    return (
      <RecipeEditScreen
        recipe={editingRecipe}
        allFoods={allFoods}
        onCancel={() => setMode({ kind: "list" })}
        onSave={(input) => {
          onSave(input, editingRecipe);
          setMode({ kind: "list" });
        }}
      />
    );
  }

  const hasAnyRecipes = recipes.length > 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <FadeIn>
        <Text style={styles.h1}>{t("recipes.title")}</Text>
        <Text style={styles.meta}>{tPlural(t, "recipes.count", recipes.length)}</Text>

        <PressableScale
          onPress={() => setMode({ kind: "create" })}
          accessibilityRole="button"
          accessibilityLabel={t("recipes.createCta")}
          style={styles.createCta}
        >
          <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.createCtaGradient}>
            <Text style={styles.createCtaText}>+ {t("recipes.createCta")}</Text>
          </LinearGradient>
        </PressableScale>
      </FadeIn>

      {!hasAnyRecipes && (
        <FadeIn delay={80}>
          <View style={styles.empty}>
            <Mascot size={84} />
            <Text style={styles.emptyTitle}>{t("recipes.emptyTitle")}</Text>
            <Text style={styles.emptyBody}>{t("recipes.emptyBody")}</Text>
          </View>
        </FadeIn>
      )}

      {recipes.map((recipe, index) => (
        <FadeIn key={recipe.id} delay={Math.min(index, 6) * 40}>
          <RecipeCard
            recipe={recipe}
            onEdit={(target) => setMode({ kind: "edit", recipe: target })}
            onDelete={onDelete}
            onUse={onUse}
          />
        </FadeIn>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingBottom: 40 },
  h1: { fontSize: typeScale.heading.size, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  createCta: { borderRadius: radius.pill, marginBottom: spacing.md, ...elevation.glow.native },
  createCtaGradient: { minHeight: MIN_TAP_TARGET, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  createCtaText: { color: colors.onBrand, fontSize: 15, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyTitle: { fontSize: typeScale.heading.size, fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing.md, textAlign: "center" },
  emptyBody: { fontSize: 14, color: colors.textMuted, marginTop: 4, textAlign: "center", maxWidth: 300 },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.xs.native,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start" },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  tileGlyph: { fontSize: 20 },
  cardMain: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  perPortionRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.xs, marginTop: spacing.xs },
  perPortionValue: { fontSize: 20, fontWeight: "800", color: colors.brandDark, fontVariant: ["tabular-nums"] },
  perPortionLabel: { fontSize: 12, color: colors.textMuted },
  cardTotal: { fontSize: 12, color: colors.textFaint, marginTop: 2, marginBottom: spacing.sm },
  editIconButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  editIconText: { fontSize: 16, color: colors.textMuted },
  portionStepperRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  portionStepperLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepperButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTint,
    borderRadius: radius.sm,
  },
  stepperButtonText: { fontSize: 18, fontWeight: "700", color: colors.brandDark },
  stepperValue: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, minWidth: 24, textAlign: "center", fontVariant: ["tabular-nums"] },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  primaryButton: {
    flex: 1,
    minWidth: 88,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    ...elevation.sm.native,
  },
  primaryButtonText: { color: colors.onBrand, fontSize: 14, fontWeight: "700" },
  secondaryButton: {
    flex: 1,
    minWidth: 88,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.sm,
  },
  secondaryButtonText: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  dangerOutlineButton: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: spacing.md,
  },
  dangerOutlineButtonText: { color: colors.danger, fontSize: 14, fontWeight: "700" },
  confirmCard: {
    backgroundColor: colors.confidenceUnverifiedBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  confirmTitle: { fontSize: 15, fontWeight: "800", color: colors.danger, marginBottom: spacing.xs },
  confirmBody: { fontSize: 13, color: colors.textSecondary },
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
