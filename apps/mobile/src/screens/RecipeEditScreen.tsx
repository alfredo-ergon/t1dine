import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { CanonicalFood } from "@t1dine/food-schema";

import { FadeIn } from "../components/FadeIn";
import { InkSurface } from "../components/InkSurface";
import { PressableScale } from "../components/PressableScale";
import { foodEmoji } from "../foodEmoji";
import { useLanguage } from "../i18n";
import type { Recipe, RecipeIngredient, RecipeInput } from "../recipes";
import { recipeIngredientsWeightGrams, recipePerPortion, recipeTotals } from "../recipes";
import { carbPer100g, displayName, searchFoods } from "../search";
import { colors, elevation, fontWeights, gradients, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

export interface RecipeEditScreenProps {
  /** The recipe being edited, or `null` when creating a brand-new one. */
  recipe: Recipe | null;
  /** Every food this device currently knows about (catalog + custom foods),
   * unfiltered by area — the pool the ingredient picker searches, mirroring
   * how App.tsx's own `allFoods` is used everywhere else favourites/recents
   * resolve against a food id. */
  allFoods: CanonicalFood[];
  onCancel: () => void;
  onSave: (input: RecipeInput) => void;
}

interface FormErrors {
  name?: string;
  ingredients?: string;
  yieldGrams?: string;
  portions?: string;
}

const MAX_PICKER_RESULTS = 8;

interface IngredientRowProps {
  ingredient: RecipeIngredient;
  index: number;
  onChangeQuantity: (index: number, grams: number) => void;
  onRemove: (index: number) => void;
}

// Mirrors ../screens/MealScreen.tsx's MealLineRow: a local text buffer so the
// user can freely type/clear the grams field; it only re-syncs from the
// authoritative quantity and commits back on blur/submit.
function IngredientRow({ ingredient, index, onChangeQuantity, onRemove }: IngredientRowProps) {
  const { t } = useLanguage();
  const [text, setText] = useState(String(ingredient.quantityGrams));

  useEffect(() => {
    setText(String(ingredient.quantityGrams));
  }, [ingredient.quantityGrams]);

  const commit = () => {
    const parsed = Number(text.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0) {
      onChangeQuantity(index, parsed);
    } else {
      setText(String(ingredient.quantityGrams));
    }
  };

  const lineCarbGrams = (ingredient.quantityGrams * ingredient.carbPer100g) / 100;

  return (
    <View style={styles.ingredientRow}>
      <View style={styles.ingredientMain}>
        <Text style={styles.ingredientName} numberOfLines={1}>
          {ingredient.name}
        </Text>
        <Text style={styles.ingredientMeta}>
          {ingredient.carbPer100g} {t("common.carbsPer100gShort")} • {lineCarbGrams.toFixed(1)} {t("common.gramsUnit")} {t("meal.carbShort")}
        </Text>
      </View>
      <TextInput
        style={styles.ingredientAmountInput}
        keyboardType="numeric"
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        accessibilityLabel={t("recipes.ingredientQuantityInputLabel", { name: ingredient.name })}
      />
      <Text style={styles.gramsUnit}>{t("common.gramsUnit")}</Text>
      <PressableScale
        onPress={() => onRemove(index)}
        accessibilityRole="button"
        accessibilityLabel={t("recipes.removeIngredientLabel", { name: ingredient.name })}
        style={styles.removeIngredientButton}
        hitSlop={4}
      >
        <Text style={styles.removeIngredientText}>×</Text>
      </PressableScale>
    </View>
  );
}

// "Criar receita" / "Editar receita" (Slice: Receitas). A dumb, presentational
// form — like ../screens/CreateFoodScreen.tsx — that only assembles a
// validated `RecipeInput` and hands it to `onSave`; identity (`id`/
// `createdAt`) is always assigned by ../recipes.ts's `buildRecipe`, never
// here. The ingredient picker searches `allFoods` (passed down from
// App.tsx) rather than re-fetching or duplicating ../screens/SearchScreen.tsx,
// so this screen stays free of catalog/online-state plumbing.
export function RecipeEditScreen({ recipe, allFoods, onCancel, onSave }: RecipeEditScreenProps) {
  const { language, t } = useLanguage();
  const isEditing = recipe !== null;

  const [name, setName] = useState(recipe?.name ?? "");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([...(recipe?.ingredients ?? [])]);
  const [yieldText, setYieldText] = useState(recipe ? String(recipe.yieldGrams) : "");
  const [portionsText, setPortionsText] = useState(recipe ? String(recipe.portions) : "");
  const [errors, setErrors] = useState<FormErrors>({});

  // Ingredient picker sub-flow: closed → searching → quantity entry.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickingFood, setPickingFood] = useState<CanonicalFood | null>(null);
  const [pickerAmountText, setPickerAmountText] = useState("100");
  const [pickerAmountError, setPickerAmountError] = useState<string | null>(null);

  const pickerResults = useMemo(() => {
    if (pickerQuery.trim().length === 0) return [];
    return searchFoods(pickerQuery, allFoods).slice(0, MAX_PICKER_RESULTS);
  }, [pickerQuery, allFoods]);

  // Live preview — reuses the EXACT pure helpers ../recipes.ts's stored
  // maths uses, on a draft built from the current (possibly still-invalid)
  // form fields, so the preview can never drift from what actually gets
  // saved/used. `recipePerPortion` already guards a non-positive `portions`.
  const yieldValue = Number(yieldText.replace(",", "."));
  const portionsValue = Number(portionsText.replace(",", "."));
  const draftRecipe: Recipe = useMemo(
    () => ({
      id: "draft",
      name,
      ingredients,
      yieldGrams: Number.isFinite(yieldValue) && yieldValue > 0 ? yieldValue : 0,
      portions: Number.isFinite(portionsValue) && portionsValue > 0 ? portionsValue : 1,
      createdAt: "",
    }),
    [name, ingredients, yieldValue, portionsValue],
  );
  const totals = useMemo(() => recipeTotals(draftRecipe), [draftRecipe]);
  const perPortion = useMemo(() => recipePerPortion(draftRecipe), [draftRecipe]);
  const ingredientsWeightGrams = useMemo(() => recipeIngredientsWeightGrams(ingredients), [ingredients]);

  const openPicker = () => {
    setPickerOpen(true);
    setPickerQuery("");
    setPickingFood(null);
    setPickerAmountText("100");
    setPickerAmountError(null);
  };

  const closePicker = () => {
    setPickerOpen(false);
    setPickerQuery("");
    setPickingFood(null);
    setPickerAmountError(null);
  };

  const confirmAddIngredient = () => {
    if (!pickingFood) return;
    const grams = Number(pickerAmountText.replace(",", "."));
    if (!Number.isFinite(grams) || grams <= 0) {
      setPickerAmountError(t("recipes.errorIngredientQuantity"));
      return;
    }
    const ingredient: RecipeIngredient = {
      foodId: pickingFood.id,
      name: displayName(pickingFood, language),
      quantityGrams: grams,
      // Missing carb data is treated as 0 g/100g — the same silent-zero
      // convention @t1dine/nutrition's summariseMeal already applies
      // app-wide for a food with no CHOAVL observation.
      carbPer100g: carbPer100g(pickingFood) ?? 0,
    };
    setIngredients((current) => [...current, ingredient]);
    setErrors((current) => ({ ...current, ingredients: undefined }));
    closePicker();
  };

  const handleChangeIngredientQuantity = (index: number, grams: number) => {
    setIngredients((current) => current.map((ingredient, i) => (i === index ? { ...ingredient, quantityGrams: grams } : ingredient)));
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients((current) => current.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const nextErrors: FormErrors = {};
    const trimmedName = name.trim();
    if (trimmedName.length === 0) nextErrors.name = t("recipes.errorName");
    if (ingredients.length === 0) nextErrors.ingredients = t("recipes.errorIngredients");
    if (!Number.isFinite(yieldValue) || yieldValue <= 0) nextErrors.yieldGrams = t("recipes.errorYield");
    if (!Number.isFinite(portionsValue) || portionsValue <= 0) nextErrors.portions = t("recipes.errorPortions");

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSave({ name: trimmedName, ingredients, yieldGrams: yieldValue, portions: portionsValue });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <FadeIn>
        <Text style={styles.h1}>{isEditing ? t("recipes.editTitle") : t("recipes.newTitle")}</Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>{t("recipes.nameLabel")}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t("recipes.namePlaceholder")}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={t("recipes.nameLabel")}
          />
          {errors.name && <Text style={styles.error}>{errors.name}</Text>}
        </View>

        <Text style={styles.sectionTitle}>{t("recipes.ingredientsTitle")}</Text>

        {ingredients.length === 0 && <Text style={styles.body}>{t("recipes.noIngredientsYet")}</Text>}

        {ingredients.map((ingredient, index) => (
          <IngredientRow
            key={`${ingredient.foodId}-${index}`}
            ingredient={ingredient}
            index={index}
            onChangeQuantity={handleChangeIngredientQuantity}
            onRemove={handleRemoveIngredient}
          />
        ))}
        {errors.ingredients && <Text style={styles.error}>{errors.ingredients}</Text>}

        {!pickerOpen && (
          <PressableScale
            onPress={openPicker}
            accessibilityRole="button"
            accessibilityLabel={t("recipes.addIngredientCta")}
            style={styles.addIngredientButton}
          >
            <Text style={styles.addIngredientButtonText}>+ {t("recipes.addIngredientCta")}</Text>
          </PressableScale>
        )}

        {pickerOpen && (
          <FadeIn>
            <View style={styles.pickerCard}>
              {!pickingFood ? (
                <>
                  <Text style={styles.pickerLabel}>{t("recipes.ingredientSearchLabel")}</Text>
                  <View style={styles.pickerSearchWrap}>
                    <Text style={styles.pickerSearchIcon}>⌕</Text>
                    <TextInput
                      style={styles.pickerSearchInput}
                      placeholder={t("recipes.ingredientSearchPlaceholder")}
                      placeholderTextColor={colors.textFaint}
                      value={pickerQuery}
                      onChangeText={setPickerQuery}
                      autoCorrect={false}
                      autoCapitalize="none"
                      accessibilityLabel={t("recipes.ingredientSearchLabel")}
                      autoFocus
                    />
                  </View>

                  {pickerQuery.trim().length > 0 && pickerResults.length === 0 && (
                    <Text style={styles.pickerEmpty}>{t("recipes.noSearchResults")}</Text>
                  )}

                  {pickerResults.map((food) => {
                    const carb = carbPer100g(food);
                    const nameLabel = displayName(food, language);
                    return (
                      <PressableScale
                        key={food.id}
                        onPress={() => setPickingFood(food)}
                        accessibilityRole="button"
                        accessibilityLabel={`${nameLabel}, ${carb ?? "?"} ${t("common.gramsCarbsPer100")}`}
                        style={styles.pickerResultRow}
                      >
                        <View style={styles.pickerResultTile} accessible={false} importantForAccessibility="no-hide-descendants">
                          <Text style={styles.pickerResultEmoji}>{foodEmoji(food)}</Text>
                        </View>
                        <Text style={styles.pickerResultName} numberOfLines={1}>
                          {nameLabel}
                        </Text>
                        <Text style={styles.pickerResultCarb}>
                          {carb ?? "?"} {t("common.carbsPer100gShort")}
                        </Text>
                      </PressableScale>
                    );
                  })}

                  <PressableScale
                    onPress={closePicker}
                    accessibilityRole="button"
                    accessibilityLabel={t("recipes.cancelAddIngredientCta")}
                    style={styles.pickerCancelButton}
                  >
                    <Text style={styles.pickerCancelButtonText}>{t("recipes.cancelAddIngredientCta")}</Text>
                  </PressableScale>
                </>
              ) : (
                <>
                  <Text style={styles.pickerLabel}>{displayName(pickingFood, language)}</Text>
                  <Text style={styles.pickerSelectedCarb}>
                    {carbPer100g(pickingFood) ?? "?"} {t("common.carbsPer100gShort")}
                  </Text>
                  <Text style={styles.label}>{t("recipes.ingredientQuantityLabel")}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={pickerAmountText}
                    onChangeText={setPickerAmountText}
                    accessibilityLabel={t("recipes.ingredientQuantityLabel")}
                    autoFocus
                  />
                  {pickerAmountError && <Text style={styles.error}>{pickerAmountError}</Text>}
                  <View style={styles.pickerConfirmRow}>
                    <PressableScale
                      onPress={() => setPickingFood(null)}
                      accessibilityRole="button"
                      accessibilityLabel={t("recipes.cancelAddIngredientCta")}
                      style={styles.cancelButton}
                    >
                      <Text style={styles.cancelButtonText}>{t("recipes.cancelAddIngredientCta")}</Text>
                    </PressableScale>
                    <PressableScale
                      onPress={confirmAddIngredient}
                      accessibilityRole="button"
                      accessibilityLabel={t("recipes.confirmAddIngredientCta")}
                      style={styles.confirmButton}
                    >
                      <Text style={styles.confirmButtonText}>{t("recipes.confirmAddIngredientCta")}</Text>
                    </PressableScale>
                  </View>
                </>
              )}
            </View>
          </FadeIn>
        )}

        <View style={styles.formCard}>
          <Text style={styles.label}>{t("recipes.yieldLabel")}</Text>
          <Text style={styles.hint}>{t("recipes.yieldHint")}</Text>
          <TextInput
            style={styles.input}
            value={yieldText}
            onChangeText={setYieldText}
            keyboardType="numeric"
            accessibilityLabel={t("recipes.yieldLabel")}
          />
          {errors.yieldGrams && <Text style={styles.error}>{errors.yieldGrams}</Text>}
          {ingredientsWeightGrams > 0 && (
            <View style={styles.yieldHintRow}>
              <Text style={styles.yieldHintText}>{t("recipes.yieldSuggestion", { grams: ingredientsWeightGrams })}</Text>
              <PressableScale
                onPress={() => setYieldText(String(ingredientsWeightGrams))}
                accessibilityRole="button"
                accessibilityLabel={t("recipes.useYieldSuggestionCta")}
                hitSlop={4}
              >
                <Text style={styles.yieldHintLink}>{t("recipes.useYieldSuggestionCta")}</Text>
              </PressableScale>
            </View>
          )}

          <Text style={styles.label}>{t("recipes.portionsLabel")}</Text>
          <TextInput
            style={styles.input}
            value={portionsText}
            onChangeText={setPortionsText}
            keyboardType="numeric"
            accessibilityLabel={t("recipes.portionsLabel")}
          />
          {errors.portions && <Text style={styles.error}>{errors.portions}</Text>}
        </View>

        <InkSurface
          style={styles.totals}
          contentStyle={styles.totalsContent}
          accessible
          accessibilityLabel={`${t("recipes.livePreviewTotal")}: ${totals.carbGrams.toFixed(1)} ${t("common.gramsUnit")}. ${t(
            "recipes.livePreviewPerPortion",
          )}: ${perPortion.carbGrams.toFixed(1)} ${t("common.gramsUnit")}.`}
        >
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{t("recipes.livePreviewTotal")}</Text>
            <Text style={styles.totalsValue}>
              {totals.carbGrams.toFixed(1)} {t("common.gramsUnit")}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{t("recipes.livePreviewPerPortion")}</Text>
            <Text style={styles.totalsValueHero}>
              {perPortion.carbGrams.toFixed(1)} {t("common.gramsUnit")}
            </Text>
          </View>
          <Text style={styles.totalsCaption}>
            {perPortion.portionWeightGrams.toFixed(0)} {t("common.gramsUnit")} / {t("recipes.portionUnit")}
          </Text>
        </InkSurface>

        <View style={styles.buttonRow}>
          <PressableScale onPress={onCancel} accessibilityRole="button" accessibilityLabel={t("recipes.cancelCta")} style={styles.cancelButtonFlex}>
            <Text style={styles.cancelButtonText}>{t("recipes.cancelCta")}</Text>
          </PressableScale>
          <PressableScale onPress={handleSave} accessibilityRole="button" accessibilityLabel={t("recipes.saveCta")} style={styles.saveButtonWrap}>
            <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.saveButtonGradient}>
              <Text style={styles.saveButtonText}>{t("recipes.saveCta")}</Text>
            </LinearGradient>
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
  sectionTitle: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
  },
  body: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.sm },
  hint: { fontSize: 12.5, color: colors.textMuted, marginBottom: spacing.xs },
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

  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    ...elevation.xs.native,
  },
  ingredientMain: { flex: 1 },
  ingredientName: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  ingredientMeta: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  ingredientAmountInput: {
    minWidth: 56,
    minHeight: MIN_TAP_TARGET,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    textAlign: "center",
    fontSize: 15,
    color: colors.textPrimary,
    paddingHorizontal: spacing.xs,
  },
  gramsUnit: { fontSize: 13, color: colors.textMuted },
  removeIngredientButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  removeIngredientText: { fontSize: 20, fontWeight: "700", color: colors.danger },

  addIngredientButton: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
    marginBottom: spacing.sm,
  },
  addIngredientButtonText: { color: colors.brandDark, fontSize: 15, fontWeight: "700" },

  pickerCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.sm.native,
  },
  pickerLabel: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.sm },
  pickerSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    minHeight: MIN_TAP_TARGET,
  },
  pickerSearchIcon: { fontSize: 16, color: colors.textFaint, marginRight: spacing.xs },
  pickerSearchInput: { flex: 1, paddingVertical: 10, fontSize: 16, color: colors.textPrimary, minHeight: MIN_TAP_TARGET },
  pickerEmpty: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm },
  pickerResultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: MIN_TAP_TARGET,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pickerResultTile: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerResultEmoji: { fontSize: 16 },
  pickerResultName: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  pickerResultCarb: { fontSize: 12, color: colors.textMuted },
  pickerCancelButton: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  pickerCancelButtonText: { color: colors.textMuted, fontSize: 14, fontWeight: "700" },
  pickerSelectedCarb: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs },
  pickerConfirmRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },

  yieldHintRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  yieldHintText: { fontSize: 12, color: colors.textMuted, flex: 1 },
  yieldHintLink: { fontSize: 12, color: colors.brandDark, fontWeight: "700", paddingLeft: spacing.sm },

  totals: { marginTop: spacing.md, marginBottom: spacing.md },
  totalsContent: { padding: spacing.md },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  totalsLabel: { fontSize: 14, color: "rgba(255,255,255,0.72)" },
  totalsValue: { fontSize: 16, fontWeight: "800", color: colors.onBrand },
  totalsValueHero: { fontSize: 22, fontWeight: "800", color: colors.focusRing, fontVariant: ["tabular-nums"] },
  totalsCaption: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 },

  buttonRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  cancelButton: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cancelButtonFlex: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cancelButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  confirmButton: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    ...elevation.sm.native,
  },
  confirmButtonText: { color: colors.onBrand, fontSize: 15, fontWeight: "700" },
  saveButtonWrap: { flex: 1, borderRadius: radius.pill, ...elevation.glow.native },
  saveButtonGradient: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  saveButtonText: { color: colors.onBrand, fontSize: 16, fontWeight: "700" },
});
