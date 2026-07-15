import type { Bcp47LanguageTag, FoodId, IsoCountryCode, NutrientObservation } from "@t1dine/domain";

export type FoodType = "ingredient" | "packaged" | "restaurant" | "recipe" | "custom";

export interface LocalisedName {
  language: Bcp47LanguageTag;
  name: string;
  synonyms: string[];
}

export interface CanonicalFood {
  id: FoodId;
  type: FoodType;
  names: LocalisedName[];
  countries: IsoCountryCode[];
  markets: IsoCountryCode[];
  barcodes: string[];
  cuisineTags: string[];
  dietaryPatternTags: string[];
  mealContextTags: string[];
  clinicalBehaviourTags: string[];
  nutrients: NutrientObservation[];
  status: "candidate" | "approved" | "retired";
}

export * from "./validation.js";
export * from "./regions.js";
