// Search-index document builder.
//
// This is the REBUILDABLE PROJECTION that a real Azure AI Search index would
// be populated from: `buildSearchDocuments` turns approved `CanonicalFood`
// records into flat, denormalised `SearchDocument`s (one per food, carrying
// every language's names/synonyms folded into a single accent-insensitive
// search surface) that a search index upserts by `id`. Nothing here talks to
// Azure, PostgreSQL, or any other adapter — nothing in this package performs
// I/O — so the projection can be rebuilt from PostgreSQL at any time, and
// `queryDocuments` gives a dependency-free way to exercise the same matching
// rules a real index would apply, for tests and offline tooling.
//
// Only `status === "approved"` foods are ever indexed — candidates and
// retired records must never be searchable by end users.

import type { NutrientObservation } from "@t1dine/domain";
import type { CanonicalFood, FoodType, LocalisedName, PreparationState } from "@t1dine/food-schema";
import { normaliseSearchText } from "@t1dine/food-schema";
import { CARBOHYDRATE_CODE, scaleNutrient, weakestConfidence, type Confidence } from "@t1dine/nutrition";

/**
 * A denormalised, market-specific search document for one approved food.
 * Multilingual by construction: `primaryName` is the pt-first display name,
 * and every other localised name/synonym (in any language) is folded into
 * `normalisedSynonyms` so a single document remains searchable regardless of
 * which language the query is typed in.
 */
export interface SearchDocument {
  id: string;
  foodType: FoodType;
  /** First of `markets`, falling back to the first of `countries`. */
  market: string;
  /** pt-first display name (falls back to the food's first localised name). */
  primaryName: string;
  /** `normaliseSearchText(primaryName)` — accent-/case-insensitive. */
  normalisedName: string;
  /** Every other localised name and every synonym (all languages), normalised. */
  normalisedSynonyms: string[];
  foodGroupLevel1?: string;
  foodGroupLevel2?: string;
  foodGroupLevel3?: string;
  foodGroupCode?: string;
  preparationState?: PreparationState;
  /** Source id of the food's first nutrient observation, when it has one. */
  sourceId?: string;
  /** Weakest confidence across all of the food's nutrient observations. */
  confidence: Confidence;
  cuisineTags: string[];
  dietaryPatternTags: string[];
  mealContextTags: string[];
  barcodes: string[];
  /** Carbohydrate (CHOAVL) scaled to a 100 g/ml basis, when derivable. */
  carbPer100g?: number;
}

/** The pt-first localised name, falling back to the food's first name. */
function primaryLocalisedName(food: CanonicalFood): LocalisedName {
  const first = food.names[0];
  if (!first) {
    throw new Error(`buildSearchDocument: food "${food.id}" has no localised names`);
  }
  return food.names.find((localised) => localised.language.toLowerCase().startsWith("pt")) ?? first;
}

/** Every OTHER localised name plus every synonym (all languages), normalised
 * and de-duplicated, in a deterministic (source) order. */
function buildNormalisedSynonyms(food: CanonicalFood, primary: LocalisedName): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (value: string): void => {
    const normalised = normaliseSearchText(value);
    if (normalised.length === 0 || seen.has(normalised)) return;
    seen.add(normalised);
    out.push(normalised);
  };

  for (const localised of food.names) {
    if (localised !== primary) add(localised.name);
    for (const synonym of localised.synonyms) add(synonym);
  }
  return out;
}

function findCarbohydrateObservation(food: CanonicalFood): NutrientObservation | undefined {
  return food.nutrients.find((observation) => observation.nutrientCode === CARBOHYDRATE_CODE);
}

/** Carbohydrate scaled to a 100 g/ml basis, or `undefined` when the food has
 * no carbohydrate observation or its basis cannot be scaled (e.g. per-serving). */
function carbPer100g(food: CanonicalFood): number | undefined {
  const observation = findCarbohydrateObservation(food);
  if (!observation) return undefined;
  const scaled = scaleNutrient(observation, 100);
  return scaled ?? undefined;
}

/** Builds the search document for a single food. Callers are expected to have
 * already filtered to `status === "approved"` (see `buildSearchDocuments`). */
export function buildSearchDocument(food: CanonicalFood): SearchDocument {
  const primary = primaryLocalisedName(food);
  const confidence = weakestConfidence(food.nutrients.map((observation) => observation.confidence));

  const doc: SearchDocument = {
    id: food.id,
    foodType: food.type,
    market: food.markets[0] ?? food.countries[0] ?? "",
    primaryName: primary.name,
    normalisedName: normaliseSearchText(primary.name),
    normalisedSynonyms: buildNormalisedSynonyms(food, primary),
    confidence,
    cuisineTags: [...food.cuisineTags],
    dietaryPatternTags: [...food.dietaryPatternTags],
    mealContextTags: [...food.mealContextTags],
    barcodes: [...food.barcodes],
  };

  if (food.foodGroup !== undefined) {
    doc.foodGroupLevel1 = food.foodGroup.level1;
    if (food.foodGroup.level2 !== undefined) doc.foodGroupLevel2 = food.foodGroup.level2;
    if (food.foodGroup.level3 !== undefined) doc.foodGroupLevel3 = food.foodGroup.level3;
    if (food.foodGroup.code !== undefined) doc.foodGroupCode = food.foodGroup.code;
  }
  if (food.preparationState !== undefined) doc.preparationState = food.preparationState;

  const sourceId = food.nutrients[0]?.source.sourceId;
  if (sourceId !== undefined) doc.sourceId = sourceId;

  const carb = carbPer100g(food);
  if (carb !== undefined) doc.carbPer100g = carb;

  return doc;
}

/** Builds search documents for every APPROVED food in `foods` (candidates and
 * retired records are excluded), in the same order they were given. */
export function buildSearchDocuments(foods: CanonicalFood[]): SearchDocument[] {
  return foods.filter((food) => food.status === "approved").map(buildSearchDocument);
}

/** Facet/query parameters for `queryDocuments`. All present fields are
 * combined with AND; an absent/blank `q` matches every document. */
export interface SearchDocumentQuery {
  q?: string;
  foodGroupCode?: string;
  preparationState?: PreparationState;
  sourceId?: string;
}

/**
 * In-memory equivalent of what a real Azure AI Search query would apply:
 * `q` is an accent-insensitive substring match against `normalisedName` or
 * any `normalisedSynonyms` entry; the facet fields are exact-equality
 * filters. Exists so the projection's matching rules are testable without a
 * search-service dependency — it is NOT a replacement for a real index's
 * ranking/ relevance behaviour.
 */
export function queryDocuments(docs: SearchDocument[], query: SearchDocumentQuery): SearchDocument[] {
  const normalisedQuery = query.q && query.q.trim().length > 0 ? normaliseSearchText(query.q) : undefined;

  return docs.filter((doc) => {
    if (normalisedQuery !== undefined) {
      const matches =
        doc.normalisedName.includes(normalisedQuery) ||
        doc.normalisedSynonyms.some((synonym) => synonym.includes(normalisedQuery));
      if (!matches) return false;
    }
    if (query.foodGroupCode !== undefined && doc.foodGroupCode !== query.foodGroupCode) return false;
    if (query.preparationState !== undefined && doc.preparationState !== query.preparationState) return false;
    if (query.sourceId !== undefined && doc.sourceId !== query.sourceId) return false;
    return true;
  });
}
