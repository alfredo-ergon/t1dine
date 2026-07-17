// Local-first store for "Receitas" (recipe carb calculator) — build a dish
// from ingredients, see its total and PER-PORTION carbohydrate, and add whole
// portions to the current meal. Mirrors ../savedMeals.ts and ../mealHistory.ts:
// a single AsyncStorage key, best-effort writes (a storage failure must never
// block the offline-first UI), and every value read back out is re-validated
// rather than trusted (CLAUDE.md: "All external data is untrusted. Validate at
// boundaries.").
//
// Each ingredient snapshots its own `carbPer100g` (like ../savedMeals.ts's
// SavedMealItem / ../mealHistory.ts's HistoryItem), so a recipe keeps working
// even if the underlying food is later edited, removed from the catalog, or
// unavailable offline — the recipe's own maths never depends on re-resolving
// `foodId` back to a live CanonicalFood.
//
// `saveRecipe`/`deleteRecipe`/`clearRecipes` read the on-device list fresh
// before writing (like ../mealHistory.ts's logMeal/deleteHistoryEntry/
// clearHistory) rather than trusting an in-memory mirror passed in by the
// caller — safe to call even before the caller's own mirror has finished
// hydrating from storage at app startup.
//
// This module has no i18n/React dependency of its own (like savedMeals.ts) —
// screens resolve their own copy with useLanguage().t().
//
// IMPORTANT: this is food-estimation maths only (CLAUDE.md: "Keep clinical
// calculation UI separate from food-estimation UI"). It has no dependency on,
// and must never be imported by, packages/dose-engine or ../dose/*.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import type { CanonicalFood } from "@t1dine/food-schema";
import { assertCanonicalFood } from "@t1dine/food-schema";
import type { MealLine } from "@t1dine/nutrition";
import { CARBOHYDRATE_CODE } from "@t1dine/nutrition";

import { getActiveProfileId, migrateLegacyKey, profileKey } from "./profiles";

// Slice: caregiver profiles ("Perfis"). Recipes are per-profile — see
// ../mealHistory.ts's identical note. `RECIPES_KEY` below is used as the
// "base" passed to `profileKey`/`migrateLegacyKey`.
const RECIPES_KEY = "t1dine.recipes";

export interface RecipeIngredient {
  /** The CanonicalFood id this ingredient was picked from — kept for
   * traceability only; the maths below never re-resolves it. */
  foodId: string;
  /** Display name captured when the ingredient was added. */
  name: string;
  /** Quantity of this ingredient used in the recipe, in grams (or
   * millilitres, matching the food's basis). */
  quantityGrams: number;
  /** Carbohydrate (g) per 100 g/ml of this ingredient, captured at add time. */
  carbPer100g: number;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  /** Total weight the whole recipe makes, in grams (e.g. the whole pot). */
  yieldGrams: number;
  /** Number of equal portions the yield is divided into. */
  portions: number;
  /** ISO timestamp of when this recipe was first saved. */
  createdAt: string;
}

/** The editable fields a create/edit form submits — `id`/`createdAt` are
 * always assigned by `buildRecipe`, mirroring ../customFood.ts's
 * CustomFoodInput → buildCustomFood split (dumb form, smart pure builder). */
export interface RecipeInput {
  name: string;
  ingredients: RecipeIngredient[];
  yieldGrams: number;
  portions: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecipeIngredient(value: unknown): value is RecipeIngredient {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.foodId === "string" &&
    item.foodId.length > 0 &&
    typeof item.name === "string" &&
    isFiniteNumber(item.quantityGrams) &&
    item.quantityGrams >= 0 &&
    isFiniteNumber(item.carbPer100g)
  );
}

/** Exported for tests and for defensive checks elsewhere — not required by day-to-day callers. */
export function isRecipe(value: unknown): value is Recipe {
  if (typeof value !== "object" || value === null) return false;
  const recipe = value as Record<string, unknown>;
  return (
    typeof recipe.id === "string" &&
    recipe.id.length > 0 &&
    typeof recipe.name === "string" &&
    recipe.name.trim().length > 0 &&
    typeof recipe.createdAt === "string" &&
    Array.isArray(recipe.ingredients) &&
    recipe.ingredients.length > 0 &&
    recipe.ingredients.every(isRecipeIngredient) &&
    isFiniteNumber(recipe.yieldGrams) &&
    recipe.yieldGrams > 0 &&
    isFiniteNumber(recipe.portions) &&
    recipe.portions > 0
  );
}

export function createRecipeId(): string {
  return `recipe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Builds a full `Recipe` record from a create/edit form's validated input.
 * Assigns a fresh `id`/`createdAt` for a brand-new recipe; preserves both
 * when `existing` is passed (editing in place), exactly like
 * ../customFood.ts's buildCustomFood assigns identity so the form itself
 * never has to.
 */
export function buildRecipe(input: RecipeInput, existing?: Pick<Recipe, "id" | "createdAt">): Recipe {
  return {
    id: existing?.id ?? createRecipeId(),
    name: input.name.trim(),
    ingredients: input.ingredients,
    yieldGrams: input.yieldGrams,
    portions: input.portions,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
}

/** Unrounded total carbohydrate (g) across every ingredient — the single
 * source of truth every other total/per-portion figure below derives from,
 * so rounding only ever happens once, at display time. */
function rawTotalCarbGrams(recipe: Recipe): number {
  return recipe.ingredients.reduce((sum, ingredient) => sum + (ingredient.quantityGrams * ingredient.carbPer100g) / 100, 0);
}

/** Sum of every ingredient's quantity — offered as a sensible starting
 * suggestion for `yieldGrams` in the edit form (a dish often weighs close to
 * the sum of its raw ingredients, though cooking can add/remove water — the
 * form always leaves this fully editable, never assigns it automatically). */
export function recipeIngredientsWeightGrams(ingredients: RecipeIngredient[]): number {
  return round1(ingredients.reduce((sum, ingredient) => sum + ingredient.quantityGrams, 0));
}

export interface RecipeTotals {
  /** Total carbohydrate (g) across the whole recipe (every ingredient, full yield). */
  carbGrams: number;
}

/** Total carbohydrate (g) for the WHOLE recipe — sum(ingredient.quantityGrams * ingredient.carbPer100g / 100). */
export function recipeTotals(recipe: Recipe): RecipeTotals {
  return { carbGrams: round1(rawTotalCarbGrams(recipe)) };
}

export interface RecipePerPortion {
  /** Carbohydrate (g) in exactly ONE portion. */
  carbGrams: number;
  /** Weight (g) of exactly ONE portion — `yieldGrams / portions`. */
  portionWeightGrams: number;
}

/**
 * Per-portion carbohydrate and weight. Guards against a not-yet-valid
 * `portions` (e.g. a live form draft mid-edit) by treating it as 1 rather
 * than dividing by zero/negative — `recipe`s persisted via `saveRecipe` are
 * always already validated (`isRecipe` requires `portions > 0`), so this
 * guard only matters for a screen previewing an in-progress draft.
 */
export function recipePerPortion(recipe: Recipe): RecipePerPortion {
  const portions = recipe.portions > 0 ? recipe.portions : 1;
  const portionWeightGrams = recipe.yieldGrams > 0 ? recipe.yieldGrams / portions : 0;
  const carbGrams = rawTotalCarbGrams(recipe) / portions;
  return { carbGrams: round1(carbGrams), portionWeightGrams: round1(portionWeightGrams) };
}

/** Carbohydrate (g) per 100 g of the recipe's overall yield — the derived
 * "as if it were a single food" density used to build the synthetic
 * CanonicalFood in `recipeToMealLine`. 0 when the yield isn't (yet) valid,
 * mirroring ../savedMeals.ts's "amount > 0 ? … : 0" zero-guard convention. */
export function recipeCarbPer100g(recipe: Recipe): number {
  if (!(recipe.yieldGrams > 0)) return 0;
  return round1((rawTotalCarbGrams(recipe) / recipe.yieldGrams) * 100);
}

function recipeSourceReference(recipeId: string): SourceReference {
  return {
    sourceId: "RECIPE",
    sourceRecordId: `RECIPE-${recipeId}`,
    sourceVersion: "1",
    licence: "user-created",
    retrievedAt: new Date().toISOString(),
    // No raw file was ingested for this snapshot — same documented all-zero
    // placeholder ../customFood.ts / ../savedMeals.ts use for "no snapshot".
    rawSnapshotSha256: "0".repeat(64),
    mappingVersion: "recipe-fallback-1",
  };
}

/**
 * Builds the synthetic, single-food stand-in for `portionsToAdd` portions of
 * `recipe` — always `type: "recipe"`, `status: "candidate"`, and an
 * `unverified`/`estimated` carbohydrate observation, exactly like
 * ../savedMeals.ts's buildFallbackFood: this is a derived, user-composed
 * aggregate, never a re-verified canonical record (CLAUDE.md: "User-created
 * and AI-estimated foods must display uncertainty and provenance").
 *
 * The id is stable across calls for the SAME recipe (independent of
 * `portionsToAdd`), so adding this recipe to the current meal twice merges
 * into a single meal line via the app's existing "same food id" merge logic,
 * exactly like adding the same catalog food twice.
 */
function buildRecipeFood(recipe: Recipe, portionsToAdd: number, carbPer100gValue: number): CanonicalFood {
  const suffixPt = portionsToAdd === 1 ? "" : ` (${portionsToAdd} porções)`;
  const suffixEn = portionsToAdd === 1 ? "" : ` (${portionsToAdd} portions)`;

  const carbObservation: NutrientObservation = {
    nutrientCode: CARBOHYDRATE_CODE,
    value: round1(carbPer100gValue),
    unit: "g",
    basisQuantity: 100,
    basisUnit: "g",
    method: "estimated",
    confidence: "unverified",
    source: recipeSourceReference(recipe.id),
  };

  const food: CanonicalFood = {
    id: `recipe-${recipe.id}`,
    type: "recipe",
    names: [
      { language: "pt-PT", name: `${recipe.name}${suffixPt}`, synonyms: [] },
      { language: "en", name: `${recipe.name}${suffixEn}`, synonyms: [] },
    ],
    countries: [],
    markets: [],
    barcodes: [],
    cuisineTags: [],
    dietaryPatternTags: [],
    mealContextTags: [],
    clinicalBehaviourTags: [],
    nutrients: [carbObservation],
    status: "candidate",
  };

  // Boundary check, as ../customFood.ts/../savedMeals.ts do — this object is
  // built from data that round-tripped through AsyncStorage.
  assertCanonicalFood(food);
  return food;
}

/**
 * Turns `portionsToAdd` portions of `recipe` into a `MealLine` that fits the
 * EXISTING meal model exactly — so it flows into the meal builder, the dose
 * review, and the Diário through the app's current pipeline, with no changes
 * to any of them. `amount` is `portionWeightGrams * portionsToAdd` (the same
 * per-portion weight shown on screen), and the synthetic food's carb-per-100g
 * is the recipe's overall density — so `summariseMeal` (amount ÷ 100 ×
 * carbPer100g) reconstructs exactly `portionsToAdd × recipePerPortion(recipe)
 * .carbGrams`, never an approximation.
 */
export function recipeToMealLine(recipe: Recipe, portionsToAdd: number = 1): MealLine {
  const safePortionsToAdd = Number.isFinite(portionsToAdd) && portionsToAdd > 0 ? portionsToAdd : 1;
  const perPortion = recipePerPortion(recipe);
  const carbPer100gValue = recipeCarbPer100g(recipe);
  const amount = round1(perPortion.portionWeightGrams * safePortionsToAdd);
  const food = buildRecipeFood(recipe, safePortionsToAdd, carbPer100gValue);
  return { food, amount };
}

async function readJson(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    // Corrupt or unavailable storage must never crash the app — fall back
    // to an empty/default state and keep working offline.
    return undefined;
  }
}

async function persistRecipes(recipes: Recipe[]): Promise<void> {
  try {
    await AsyncStorage.setItem(profileKey(RECIPES_KEY, getActiveProfileId()), JSON.stringify(recipes));
  } catch {
    // Best-effort persistence only.
  }
}

/**
 * Loads every recipe on this device, most-recently-created first. Never
 * throws — corrupt/unavailable storage degrades to an empty list, and any
 * record that no longer matches the shape is dropped rather than crashing
 * the app (CLAUDE.md: "All external data is untrusted. Validate at
 * boundaries.").
 */
export async function loadRecipes(): Promise<Recipe[]> {
  const profileId = getActiveProfileId();
  const key = profileKey(RECIPES_KEY, profileId);
  await migrateLegacyKey(RECIPES_KEY, profileId, key);
  const value = await readJson(key);
  if (!Array.isArray(value)) return [];
  return value.filter(isRecipe).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Saves (creates or, when `recipe.id` already exists on-device, replaces in
 * place) a recipe — reads the current on-device list fresh before writing
 * (mirrors ../mealHistory.ts's logMeal), so it's safe to call even before the
 * caller's own in-memory mirror has finished hydrating. Returns the
 * resulting list so the caller can sync its in-memory state from a single
 * source of truth.
 */
export async function saveRecipe(recipe: Recipe): Promise<Recipe[]> {
  const existing = await loadRecipes();
  const next = [recipe, ...existing.filter((item) => item.id !== recipe.id)];
  await persistRecipes(next);
  return next;
}

/** Deletes a single recipe ("Apagar"). Returns the resulting list. */
export async function deleteRecipe(id: string): Promise<Recipe[]> {
  const existing = await loadRecipes();
  const next = existing.filter((item) => item.id !== id);
  await persistRecipes(next);
  return next;
}

/** Local data rights: wipes the ACTIVE profile's every recipe. Best-effort: a
 * write failure here must never surface as an error in the offline-first UI. */
export async function clearRecipes(): Promise<void> {
  await persistRecipes([]);
}

/**
 * Removes THIS SPECIFIC profile's entire recipe list — used when a profile
 * is deleted (App.tsx's handleDeleteProfile) or when every profile's data is
 * wiped ("Apagar todos os meus dados"). Takes an explicit `profileId` (not
 * necessarily the active one), unlike `clearRecipes` above.
 */
export async function clearProfileData(profileId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(profileKey(RECIPES_KEY, profileId));
  } catch {
    // Best-effort persistence only.
  }
}
