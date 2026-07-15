// Synthetic Portugal food catalog used by the in-memory API.
//
// These records are illustrative approximations for development and testing
// only — NOT verified laboratory analyses, NOT redistributable, and NOT a
// clinically validated data source. Every record is runtime-validated
// against the shared `CanonicalFood` contract at module load, so a malformed
// entry fails fast instead of shipping bad data to a caller.

import { createHash } from "node:crypto";
import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import type { CanonicalFood, FoodType, LocalisedName } from "@t1dine/food-schema";
import { collectCanonicalFoodErrors } from "@t1dine/food-schema";

interface NameInput {
  name: string;
  synonyms?: string[];
}

interface NamesInput {
  pt: NameInput;
  en: NameInput;
}

function names(input: NamesInput): LocalisedName[] {
  return [
    { language: "pt-PT", name: input.pt.name, synonyms: input.pt.synonyms ?? [] },
    { language: "en", name: input.en.name, synonyms: input.en.synonyms ?? [] },
  ];
}

/** Deterministic, build-time-only stand-in for a real raw-snapshot digest. */
function syntheticSnapshotHash(seed: string): string {
  return createHash("sha256").update(`t1dine-synthetic-pt-catalog:${seed}`).digest("hex");
}

function source(id: string): SourceReference {
  return {
    sourceId: "SYNTH-T1DINE-PT",
    sourceRecordId: `SYNTH-${id.toUpperCase()}`,
    sourceVersion: "2026.1",
    market: "PT",
    licence: "synthetic-non-redistributable",
    retrievedAt: "2026-07-01T00:00:00.000Z",
    rawSnapshotSha256: syntheticSnapshotHash(id),
    mappingVersion: "map-0.1",
  };
}

function nutrients(
  id: string,
  carbGrams: number,
  energyKcal: number,
  confidence: NutrientObservation["confidence"],
  method: NutrientObservation["method"],
): NutrientObservation[] {
  const shared = source(id);
  return [
    {
      nutrientCode: "CHOAVL",
      value: carbGrams,
      unit: "g",
      basisQuantity: 100,
      basisUnit: "g",
      method,
      confidence,
      source: shared,
    },
    {
      nutrientCode: "ENERC",
      value: energyKcal,
      unit: "kcal",
      basisQuantity: 100,
      basisUnit: "g",
      method,
      confidence,
      source: shared,
    },
  ];
}

interface FoodInput {
  id: string;
  type: FoodType;
  names: NamesInput;
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

function food(input: FoodInput): CanonicalFood {
  return {
    id: input.id,
    type: input.type,
    names: names(input.names),
    countries: ["PT"],
    markets: ["PT"],
    barcodes: [],
    cuisineTags: input.cuisineTags ?? [],
    dietaryPatternTags: input.dietaryPatternTags ?? [],
    mealContextTags: input.mealContextTags ?? [],
    clinicalBehaviourTags: [],
    nutrients: nutrients(input.id, input.carbGrams, input.energyKcal, input.confidence, input.method),
    status: input.status ?? "approved",
  };
}

const CATALOG_INPUTS: FoodInput[] = [
  {
    id: "pt-pao-de-forma",
    type: "packaged",
    names: {
      pt: { name: "Pão de forma", synonyms: ["pão de forma branco", "pão de fatias"] },
      en: { name: "Sliced white bread", synonyms: ["sandwich bread"] },
    },
    carbGrams: 49.4,
    energyKcal: 264,
    confidence: "medium",
    method: "declared",
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["breakfast", "snack"],
  },
  {
    id: "pt-broa-de-milho",
    type: "ingredient",
    names: {
      pt: { name: "Broa de milho", synonyms: ["broa"] },
      en: { name: "Portuguese corn bread", synonyms: [] },
    },
    carbGrams: 43.8,
    energyKcal: 251,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["portuguese"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["breakfast", "snack"],
  },
  {
    id: "pt-arroz-branco-cozido",
    type: "ingredient",
    names: {
      pt: { name: "Arroz branco cozido", synonyms: ["arroz cozido", "arroz branco"] },
      en: { name: "Cooked white rice", synonyms: ["boiled rice"] },
    },
    carbGrams: 28.2,
    energyKcal: 130,
    confidence: "high",
    method: "analytical",
    cuisineTags: ["portuguese"],
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "pt-batata-cozida",
    type: "ingredient",
    names: {
      pt: { name: "Batata cozida", synonyms: ["batata comum cozida"] },
      en: { name: "Boiled potato", synonyms: [] },
    },
    carbGrams: 17.0,
    energyKcal: 77,
    confidence: "high",
    method: "analytical",
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "pt-esparguete-cozido",
    type: "ingredient",
    names: {
      pt: { name: "Esparguete cozido", synonyms: ["massa esparguete cozida"] },
      en: { name: "Cooked spaghetti", synonyms: ["cooked pasta"] },
    },
    carbGrams: 25.0,
    energyKcal: 131,
    confidence: "high",
    method: "analytical",
    cuisineTags: ["italian"],
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "pt-feijao-preto-cozido",
    type: "ingredient",
    names: {
      pt: { name: "Feijão preto cozido", synonyms: ["feijão preto"] },
      en: { name: "Cooked black beans", synonyms: [] },
    },
    carbGrams: 15.5,
    energyKcal: 91,
    confidence: "medium",
    method: "calculated",
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "pt-iogurte-natural",
    type: "packaged",
    names: {
      pt: { name: "Iogurte natural", synonyms: ["iogurte natural não açucarado"] },
      en: { name: "Natural yoghurt", synonyms: ["plain yogurt"] },
    },
    carbGrams: 4.7,
    energyKcal: 61,
    confidence: "high",
    method: "analytical",
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["breakfast", "snack"],
  },
  {
    id: "pt-leite-meio-gordo",
    type: "packaged",
    names: {
      pt: { name: "Leite meio-gordo", synonyms: ["leite meio gordo"] },
      en: { name: "Semi-skimmed milk", synonyms: ["2% milk"] },
    },
    carbGrams: 4.8,
    energyKcal: 46,
    confidence: "high",
    method: "analytical",
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["breakfast"],
  },
  {
    id: "pt-maca",
    type: "ingredient",
    names: {
      pt: { name: "Maçã", synonyms: ["maça", "maçã com casca"] },
      en: { name: "Apple", synonyms: [] },
    },
    carbGrams: 11.8,
    energyKcal: 52,
    confidence: "high",
    method: "analytical",
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["snack"],
  },
  {
    id: "pt-banana",
    type: "ingredient",
    names: {
      pt: { name: "Banana", synonyms: [] },
      en: { name: "Banana", synonyms: [] },
    },
    carbGrams: 20.3,
    energyKcal: 89,
    confidence: "high",
    method: "analytical",
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["snack"],
  },
  {
    id: "pt-bacalhau-a-bras",
    type: "recipe",
    names: {
      pt: { name: "Bacalhau à Brás", synonyms: ["bacalhau a bras"] },
      en: { name: "Bacalhau à Brás (shredded cod with potato and egg)", synonyms: [] },
    },
    carbGrams: 12.4,
    energyKcal: 196,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["portuguese"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "pt-caldo-verde",
    type: "recipe",
    names: {
      pt: { name: "Caldo verde", synonyms: [] },
      en: { name: "Portuguese kale and potato soup", synonyms: [] },
    },
    carbGrams: 8.1,
    energyKcal: 65,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["portuguese"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "pt-pastel-de-nata",
    type: "packaged",
    names: {
      pt: { name: "Pastel de nata", synonyms: ["pastel de Belém"] },
      en: { name: "Custard tart", synonyms: [] },
    },
    carbGrams: 26.8,
    energyKcal: 300,
    confidence: "medium",
    method: "declared",
    cuisineTags: ["portuguese"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["dessert", "snack"],
  },
  {
    id: "pt-sumo-de-laranja",
    type: "packaged",
    names: {
      pt: { name: "Sumo de laranja", synonyms: ["sumo de laranja natural"] },
      en: { name: "Orange juice", synonyms: [] },
    },
    carbGrams: 10.4,
    energyKcal: 45,
    confidence: "medium",
    method: "declared",
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["breakfast"],
  },
  {
    id: "pt-francesinha",
    type: "restaurant",
    names: {
      pt: { name: "Francesinha", synonyms: [] },
      en: { name: "Francesinha (Porto meat and cheese sandwich)", synonyms: [] },
    },
    carbGrams: 14.6,
    energyKcal: 320,
    confidence: "unverified",
    method: "estimated",
    cuisineTags: ["portuguese"],
    mealContextTags: ["lunch", "dinner"],
    status: "candidate",
  },
];

export const CATALOG: CanonicalFood[] = CATALOG_INPUTS.map(food);

CATALOG.forEach((item, index) => {
  const errors = collectCanonicalFoodErrors(item);
  if (errors.length > 0) {
    throw new Error(
      `Invalid synthetic catalog entry at index ${index} (id="${item.id}"): ${errors.join("; ")}`,
    );
  }
});

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .trim();
}

function matchesQuery(item: CanonicalFood, normalisedQuery: string): boolean {
  return item.names.some((localised) => {
    if (normalise(localised.name).includes(normalisedQuery)) return true;
    return localised.synonyms.some((synonym) => normalise(synonym).includes(normalisedQuery));
  });
}

/**
 * Accent-insensitive search over localised names and synonyms, optionally
 * narrowed to a market. `query` and `market` are both optional; an absent
 * query returns every (market-filtered) food.
 */
export function searchCatalog(query?: string, market?: string): CanonicalFood[] {
  const normalisedQuery = query && query.trim().length > 0 ? normalise(query) : undefined;
  const normalisedMarket = market && market.trim().length > 0 ? market.trim().toUpperCase() : undefined;

  return CATALOG.filter((item) => {
    if (normalisedMarket && !item.markets.includes(normalisedMarket)) return false;
    if (normalisedQuery && !matchesQuery(item, normalisedQuery)) return false;
    return true;
  });
}
