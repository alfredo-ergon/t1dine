// Local-first store for "Refeições guardadas" (saved/repeatable meals).
//
// Mirrors ../submissions.ts and ../storage.ts: a single AsyncStorage key,
// best-effort writes (a storage failure must never block the offline-first
// UI), and every value read back out is re-validated rather than trusted
// (CLAUDE.md: "All external data is untrusted. Validate at boundaries.").
//
// Each saved item snapshots its own `carbPer100g` (see buildSavedMealFromLines)
// so a saved meal keeps working — "Usar"/"Clonar e ajustar" can always
// recompute correct totals — even if the original food is later edited,
// removed from the catalog, or unavailable offline. If the food can no
// longer be found by id when reusing/cloning, resolveSavedMealToLines()
// builds a clearly-marked ("unverified") placeholder food from the saved
// name + carbPer100g rather than silently dropping the item or guessing
// (CLAUDE.md: "User-created and AI-estimated foods must display uncertainty
// and provenance").
//
// This module has no i18n/React dependency of its own (like submissions.ts) —
// callers supply a `resolveName` function for the current display language.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import type { CanonicalFood } from "@t1dine/food-schema";
import { assertCanonicalFood } from "@t1dine/food-schema";
import type { MealLine } from "@t1dine/nutrition";
import { CARBOHYDRATE_CODE, summariseMeal } from "@t1dine/nutrition";

const SAVED_MEALS_KEY = "t1dine.savedMeals";

export interface SavedMealItem {
  /** The CanonicalFood id this item was built from, used to re-resolve fresh nutrient data on reuse. */
  foodId: string;
  /** Display name captured at save time — also the fallback label if the food is ever unavailable later. */
  name: string;
  /** Editable quantity, in grams (or millilitres, matching the food's basis). */
  quantityGrams: number;
  /** Carbohydrate (g) per 100 g/ml of this food, captured at save time. */
  carbPer100g: number;
}

export interface SavedMeal {
  id: string;
  name: string;
  /** ISO timestamp of when this meal was first saved. */
  createdAt: string;
  items: SavedMealItem[];
  totalCarbGrams: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSavedMealItem(value: unknown): value is SavedMealItem {
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
export function isSavedMeal(value: unknown): value is SavedMeal {
  if (typeof value !== "object" || value === null) return false;
  const meal = value as Record<string, unknown>;
  return (
    typeof meal.id === "string" &&
    meal.id.length > 0 &&
    typeof meal.name === "string" &&
    typeof meal.createdAt === "string" &&
    Array.isArray(meal.items) &&
    meal.items.length > 0 &&
    meal.items.every(isSavedMealItem) &&
    isFiniteNumber(meal.totalCarbGrams)
  );
}

export function createSavedMealId(): string {
  return `savedmeal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Builds a SavedMeal snapshot from the current editable meal (MealLine[]) —
 * used by the Meal screen's "Guardar refeição" action. `resolveName` lets the
 * caller supply the current-language display name (this module stays free
 * of any i18n dependency, matching submissions.ts).
 *
 * `carbPer100g` is derived from the already-computed per-line carbGrams
 * (summariseMeal), not re-read directly from the nutrient observation, so it
 * stays correct for any basis (g/ml) the food happens to use — not only a
 * literal "basisQuantity: 100" declaration.
 */
export function buildSavedMealFromLines(name: string, lines: MealLine[], resolveName: (food: CanonicalFood) => string): SavedMeal {
  const summary = summariseMeal(lines);
  const items: SavedMealItem[] = summary.lines.map((line) => ({
    foodId: line.food.id,
    name: resolveName(line.food),
    quantityGrams: line.amount,
    carbPer100g: line.amount > 0 ? round1((line.carbGrams / line.amount) * 100) : 0,
  }));

  return {
    id: createSavedMealId(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    items,
    totalCarbGrams: summary.totalCarbGrams,
  };
}

function fallbackSourceReference(foodId: string): SourceReference {
  return {
    sourceId: "SAVED_MEAL",
    sourceRecordId: `SAVED-${foodId}`,
    sourceVersion: "1",
    licence: "user-created",
    retrievedAt: new Date().toISOString(),
    // No raw file was ingested for this snapshot — same documented
    // all-zero placeholder ../customFood.ts uses for "no snapshot".
    rawSnapshotSha256: "0".repeat(64),
    mappingVersion: "saved-meal-fallback-1",
  };
}

/**
 * Builds a stand-in CanonicalFood for a saved-meal item whose original food
 * can no longer be found (removed/edited since saving, or simply not present
 * in this device's current catalog+custom-foods list) — built from the name
 * and carbPer100g captured at save time. Always unverified/candidate: this is
 * a best-effort echo of what was saved, never a re-verified canonical record.
 */
export function buildFallbackFood(item: SavedMealItem): CanonicalFood {
  const safeName = item.name.trim().length > 0 ? item.name.trim() : item.foodId;

  const carbObservation: NutrientObservation = {
    nutrientCode: CARBOHYDRATE_CODE,
    value: item.carbPer100g,
    unit: "g",
    basisQuantity: 100,
    basisUnit: "g",
    method: "estimated",
    confidence: "unverified",
    source: fallbackSourceReference(item.foodId),
  };

  const food: CanonicalFood = {
    id: `saved-missing-${item.foodId}`,
    type: "custom",
    names: [
      { language: "pt-PT", name: safeName, synonyms: [] },
      { language: "en", name: safeName, synonyms: [] },
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

  // Boundary check, as ../customFood.ts does for user-entered foods — this
  // object is built from data that round-tripped through AsyncStorage.
  assertCanonicalFood(food);
  return food;
}

/**
 * Reconstructs the editable MealLine[] for a saved meal's "Usar"/"Clonar e
 * ajustar" actions — resolving each item against the app's currently known
 * foods (catalog + custom foods) where possible, so any nutrient corrections
 * made since the meal was saved are picked up, and falling back to a clearly
 * unverified placeholder (never silently dropping the item) otherwise.
 *
 * Always returns a fresh array of fresh line objects: loading a saved meal
 * this way never mutates the SavedMeal record itself, so subsequent quantity
 * edits in the current meal builder never touch the saved original — this is
 * what makes "Clonar e ajustar" safe by construction, not a special case.
 */
export function resolveSavedMealToLines(meal: SavedMeal, knownFoods: CanonicalFood[]): MealLine[] {
  return meal.items.map((item) => {
    const food = knownFoods.find((candidate) => candidate.id === item.foodId);
    return { food: food ?? buildFallbackFood(item), amount: item.quantityGrams };
  });
}

/** Case-insensitive substring match over saved meal names — pure and
 * synchronous so the "Refeições guardadas" screen can filter live as the
 * user types, with no storage round-trip per keystroke. */
export function searchSavedMeals(query: string, meals: SavedMeal[]): SavedMeal[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return meals;
  return meals.filter((meal) => meal.name.toLowerCase().includes(q));
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

/**
 * Loads every saved meal on this device, most-recently-created first. Never
 * throws — corrupt/unavailable storage degrades to an empty list, and any
 * record that no longer matches the shape is dropped rather than crashing
 * the app (CLAUDE.md: "All external data is untrusted. Validate at
 * boundaries.").
 */
export async function loadSavedMeals(): Promise<SavedMeal[]> {
  const value = await readJson(SAVED_MEALS_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter(isSavedMeal).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Whole-array overwrite, mirroring ../storage.ts's saveCustomFoods — the
 * caller (App.tsx) owns the in-memory list and its add/rename/delete
 * mutations; this just persists the result. Best-effort: a write failure
 * must never surface as a blocking error in the offline-first UI. */
export async function saveSavedMeals(meals: SavedMeal[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVED_MEALS_KEY, JSON.stringify(meals));
  } catch {
    // Best-effort persistence only.
  }
}
