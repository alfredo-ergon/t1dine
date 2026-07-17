// Builds the local "export my data" JSON bundle (Slice 5 — local data
// rights). Pure and offline: every field comes from in-memory app state that
// mirrors what src/storage.ts persists to AsyncStorage on this device — there
// is no account and no server-side copy, so exporting and deleting are both
// purely local operations.

import type { CanonicalFood } from "@t1dine/food-schema";
import type { MealLine } from "@t1dine/nutrition";

import type { Language } from "./i18n";
import type { HistoryEntry } from "./mealHistory";
import type { Profile } from "./profiles";
import type { Recipe } from "./recipes";
import type { SavedMeal } from "./savedMeals";

/** The minimal profile identity noted on an export — never the whole
 * ../profiles.ts list, just which ONE profile's data this bundle is. */
export type ExportedProfile = Pick<Profile, "id" | "name" | "kind">;

export interface DataExportBundle {
  exportedAt: string;
  /** Slice: caregiver profiles ("Perfis") — every field below belongs to
   * THIS profile only; a caregiver switching profiles and exporting again
   * gets a separate bundle for each one. */
  profile: ExportedProfile;
  language: Language;
  favourites: string[];
  recents: string[];
  customFoods: CanonicalFood[];
  meal: MealLine[];
  savedMeals: SavedMeal[];
  /** The "Diário" — a dated log of meals actually eaten (../mealHistory.ts),
   * distinct from `savedMeals` above (undated, reusable templates). */
  history: HistoryEntry[];
  /** "Receitas" — user-built recipes (ingredients + yield/portions), used to
   * add whole portions to a meal (../recipes.ts). */
  recipes: Recipe[];
  /** Whether a Nightscout connection is currently saved on this device
   * (../nightscoutStore.ts) — NEVER the url or the token itself. The
   * Nightscout token is a HIGH-IMPACT credential (CLAUDE.md) and must never
   * appear in an export; this boolean only lets the user confirm, from the
   * export, whether a connection exists. */
  nightscoutConnected: boolean;
}

export interface DataExportInput {
  profile: ExportedProfile;
  language: Language;
  favouriteIds: string[];
  recentIds: string[];
  customFoods: CanonicalFood[];
  meal: MealLine[];
  savedMeals: SavedMeal[];
  history: HistoryEntry[];
  recipes: Recipe[];
  nightscoutConnected: boolean;
}

/** `now` is injectable so the timestamp is deterministic in tests; defaults to the real clock. */
export function buildDataExportBundle(input: DataExportInput, now: () => string = () => new Date().toISOString()): DataExportBundle {
  return {
    exportedAt: now(),
    profile: input.profile,
    language: input.language,
    favourites: input.favouriteIds,
    recents: input.recentIds,
    customFoods: input.customFoods,
    meal: input.meal,
    savedMeals: input.savedMeals,
    history: input.history,
    recipes: input.recipes,
    nightscoutConnected: input.nightscoutConnected,
  };
}

/** Pretty-printed JSON, stable and human-readable for a copy/scroll view. */
export function formatDataExportJson(bundle: DataExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}
