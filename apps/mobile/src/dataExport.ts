// Builds the local "export my data" JSON bundle (Slice 5 — local data
// rights). Pure and offline: every field comes from in-memory app state that
// mirrors what src/storage.ts persists to AsyncStorage on this device — there
// is no account and no server-side copy, so exporting and deleting are both
// purely local operations.

import type { CanonicalFood } from "@t1dine/food-schema";
import type { MealLine } from "@t1dine/nutrition";

import type { Language } from "./i18n";
import type { SavedMeal } from "./savedMeals";

export interface DataExportBundle {
  exportedAt: string;
  language: Language;
  favourites: string[];
  recents: string[];
  customFoods: CanonicalFood[];
  meal: MealLine[];
  savedMeals: SavedMeal[];
}

export interface DataExportInput {
  language: Language;
  favouriteIds: string[];
  recentIds: string[];
  customFoods: CanonicalFood[];
  meal: MealLine[];
  savedMeals: SavedMeal[];
}

/** `now` is injectable so the timestamp is deterministic in tests; defaults to the real clock. */
export function buildDataExportBundle(input: DataExportInput, now: () => string = () => new Date().toISOString()): DataExportBundle {
  return {
    exportedAt: now(),
    language: input.language,
    favourites: input.favouriteIds,
    recents: input.recentIds,
    customFoods: input.customFoods,
    meal: input.meal,
    savedMeals: input.savedMeals,
  };
}

/** Pretty-printed JSON, stable and human-readable for a copy/scroll view. */
export function formatDataExportJson(bundle: DataExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}
