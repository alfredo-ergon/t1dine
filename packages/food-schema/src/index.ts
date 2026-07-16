import type { Bcp47LanguageTag, FoodId, IsoCountryCode, NutrientObservation } from "@t1dine/domain";

export type FoodType = "ingredient" | "packaged" | "restaurant" | "recipe" | "custom";

export interface LocalisedName {
  language: Bcp47LanguageTag;
  name: string;
  synonyms: string[];
}

/**
 * Preparation / physical state of a food. Controlled vocabulary so raw and
 * cooked forms of the same ingredient stay distinct (national composition
 * tables usually encode this only inside the food name). `unknown` is the
 * absence of a claim — never guess a state that the source does not state.
 */
export type PreparationState =
  | "raw"
  | "cooked"
  | "roasted"
  | "fried"
  | "grilled"
  | "stewed"
  | "dried"
  | "candied"
  | "preserved"
  | "reconstituted"
  | "unknown";

/**
 * Hierarchical food-group classification (e.g. INSA/PortFIR FoodEx2 levels
 * carried as Portuguese labels, plus a normalised slug for search facets).
 * Labels are stored verbatim from the source; `code` is a derived slug.
 */
export interface FoodGroup {
  level1: string;
  level2?: string;
  level3?: string;
  code?: string;
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
  /** Preparation/physical state, when known. Optional & additive. */
  preparationState?: PreparationState;
  /** Source food-group hierarchy, when available. Optional & additive. */
  foodGroup?: FoodGroup;
  /**
   * Edible portion as a fraction (0–1] of purchased weight, when the source
   * provides it. INSA reports per-100 g *edible* already and gives no factor,
   * so it is left undefined for those records — do not fabricate one.
   */
  ediblePortion?: number;
  /** Density in g/ml, when available (e.g. to relate volume to mass). */
  density?: number;
}

export * from "./validation.js";
export * from "./regions.js";
export * from "./nutrients.js";
export * from "./search.js";
