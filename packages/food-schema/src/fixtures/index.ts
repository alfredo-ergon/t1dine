// Synthetic canonical-food fixtures — one per FoodType. NOT real source data
// and NOT redistributable. Each constant is typed as `CanonicalFood`, so a
// structural mistake fails `tsc`; each is also runtime-validated by the tests.

import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import type { CanonicalFood } from "../index.js";
import type { FoodTypeName } from "../validation.js";

const syntheticSource: SourceReference = {
  sourceId: "SYNTH-INSA",
  sourceRecordId: "SYNTH-REC-FOOD",
  sourceVersion: "2026.1",
  market: "PT",
  licence: "synthetic-non-redistributable",
  retrievedAt: "2026-07-14T00:00:00.000Z",
  rawSnapshotSha256: "0".repeat(64),
  mappingVersion: "map-0.1",
};

function carb(value: number, confidence: NutrientObservation["confidence"], method: NutrientObservation["method"]): NutrientObservation {
  return {
    nutrientCode: "CHOAVL",
    value,
    unit: "g",
    basisQuantity: 100,
    basisUnit: "g",
    method,
    confidence,
    source: syntheticSource,
  };
}

export const ingredientFood: CanonicalFood = {
  id: "synthetic-ingredient-rice",
  type: "ingredient",
  names: [
    { language: "pt-PT", name: "Arroz cozido", synonyms: ["arroz branco"] },
    { language: "en", name: "Cooked white rice", synonyms: ["boiled rice"] },
  ],
  countries: ["PT"],
  markets: ["PT"],
  barcodes: [],
  cuisineTags: ["portuguese"],
  dietaryPatternTags: [],
  mealContextTags: ["lunch", "dinner"],
  clinicalBehaviourTags: [],
  nutrients: [carb(28, "high", "analytical")],
  status: "approved",
};

export const packagedFood: CanonicalFood = {
  id: "synthetic-packaged-cornflakes",
  type: "packaged",
  names: [
    { language: "pt-PT", name: "Flocos de milho", synonyms: [] },
    { language: "en", name: "Corn flakes", synonyms: [] },
  ],
  countries: ["PT"],
  markets: ["PT"],
  barcodes: ["5600000000001"],
  cuisineTags: [],
  dietaryPatternTags: ["vegetarian"],
  mealContextTags: ["breakfast"],
  clinicalBehaviourTags: [],
  nutrients: [carb(84, "medium", "declared")],
  status: "approved",
};

export const restaurantFood: CanonicalFood = {
  id: "synthetic-restaurant-soup",
  type: "restaurant",
  names: [
    { language: "pt-PT", name: "Sopa de legumes", synonyms: [] },
    { language: "en", name: "Vegetable soup", synonyms: [] },
  ],
  countries: ["PT"],
  markets: ["PT"],
  barcodes: [],
  cuisineTags: ["portuguese"],
  dietaryPatternTags: ["vegan"],
  mealContextTags: ["lunch"],
  clinicalBehaviourTags: [],
  nutrients: [carb(6, "low", "declared")],
  status: "candidate",
};

export const recipeFood: CanonicalFood = {
  id: "synthetic-recipe-rice-pudding",
  type: "recipe",
  names: [
    { language: "pt-PT", name: "Arroz doce", synonyms: [] },
    { language: "en", name: "Rice pudding", synonyms: [] },
  ],
  countries: ["PT"],
  markets: ["PT"],
  barcodes: [],
  cuisineTags: ["portuguese", "dessert"],
  dietaryPatternTags: ["vegetarian"],
  mealContextTags: ["dessert"],
  clinicalBehaviourTags: [],
  nutrients: [carb(24, "medium", "calculated")],
  status: "approved",
};

export const customFood: CanonicalFood = {
  id: "synthetic-custom-homemade-bread",
  type: "custom",
  names: [{ language: "pt-PT", name: "Pão caseiro", synonyms: ["pão da avó"] }],
  countries: ["PT"],
  markets: ["PT"],
  barcodes: [],
  cuisineTags: [],
  dietaryPatternTags: [],
  mealContextTags: ["breakfast", "snack"],
  clinicalBehaviourTags: [],
  nutrients: [carb(49, "unverified", "estimated")],
  status: "candidate",
};

/** One valid synthetic fixture per FoodType, keyed by type for coverage tests. */
export const canonicalFoodFixturesByType: Record<FoodTypeName, CanonicalFood> = {
  ingredient: ingredientFood,
  packaged: packagedFood,
  restaurant: restaurantFood,
  recipe: recipeFood,
  custom: customFood,
};

/**
 * A synthetic INSA/PortFIR-shaped candidate exercising the additive fields
 * (`preparationState`, `foodGroup`), the `µg` micronutrient unit, and a
 * mandatory attribution string. Still synthetic — NOT real INSA data.
 */
const insaSource: SourceReference = {
  sourceId: "INSA-PT",
  sourceRecordId: "SYNTH-579",
  sourceVersion: "7.1-2026",
  market: "PT",
  licence: "LICENCE_REVIEW_REQUIRED",
  attribution:
    "Fonte: Base de Dados da Composição de Alimentos. Instituto Nacional de Saúde Doutor Ricardo Jorge, I. P.- INSA. v 7.1 - 2026",
  retrievedAt: "2026-07-16T00:00:00.000Z",
  rawSnapshotSha256: "0".repeat(64),
  mappingVersion: "portfir-1.0",
};

export const insaStyleFood: CanonicalFood = {
  id: "pt-insa-synth-579",
  type: "ingredient",
  names: [{ language: "pt-PT", name: "Abóbora crua", synonyms: [] }],
  countries: ["PT"],
  markets: ["PT"],
  barcodes: [],
  cuisineTags: [],
  dietaryPatternTags: [],
  mealContextTags: [],
  clinicalBehaviourTags: [],
  preparationState: "raw",
  foodGroup: {
    level1: "Produtos hortícolas e derivados",
    level2: "Frutos de hortícolas",
    level3: "Frutos vegetais de cucurbitáceas",
    code: "produtos-horticolas-e-derivados",
  },
  nutrients: [
    { nutrientCode: "CHOAVL", value: 1.7, unit: "g", basisQuantity: 100, basisUnit: "g", method: "analytical", confidence: "high", source: insaSource },
    { nutrientCode: "ENERC", value: 11, unit: "kcal", basisQuantity: 100, basisUnit: "g", method: "analytical", confidence: "high", source: insaSource },
    { nutrientCode: "FIBTG", value: 0.7, unit: "g", basisQuantity: 100, basisUnit: "g", method: "analytical", confidence: "high", source: insaSource },
    { nutrientCode: "VITA", value: 160, unit: "µg", basisQuantity: 100, basisUnit: "g", method: "analytical", confidence: "medium", source: insaSource },
  ],
  status: "candidate",
};
