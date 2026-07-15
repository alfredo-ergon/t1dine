// Shared input types for the seed food catalog (see `./catalog.ts`). Extracted
// into their own module so per-country / per-category data files (e.g.
// `./catalogData/*.ts`) can be authored independently and imported back into
// `catalog.ts` without a circular dependency on the builder itself.
//
// These describe SYNTHETIC, development-only food records — illustrative
// per-100 g approximations with honest provenance and confidence, NOT verified
// laboratory analyses, NOT redistributable, and NOT a clinically validated data
// source. Every entry is runtime-validated against the shared `CanonicalFood`
// contract at module load (see `catalog.ts`).

import type { NutrientObservation } from "@t1dine/domain";
import type { CanonicalFood, FoodType } from "@t1dine/food-schema";

export interface NameInput {
  name: string;
  synonyms?: string[];
}

export interface NamesInput {
  pt: NameInput;
  en: NameInput;
}

export interface FoodInput {
  id: string;
  type: FoodType;
  names: NamesInput;
  /** ISO 3166-1 alpha-2 country codes this food is associated with. The first
   * entry is used as the record's provenance `market` (and doubles as
   * `markets`). */
  countries: string[];
  /** Grams of available carbohydrate per 100 g. */
  carbGrams: number;
  /** Kilocalories per 100 g. */
  energyKcal: number;
  confidence: NutrientObservation["confidence"];
  method: NutrientObservation["method"];
  cuisineTags?: string[];
  dietaryPatternTags?: string[];
  mealContextTags?: string[];
  status?: CanonicalFood["status"];
}
