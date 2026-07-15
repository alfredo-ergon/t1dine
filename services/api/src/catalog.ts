// Synthetic seed food catalog: Portugal plus wider Europe (Southern/
// Mediterranean, Western, Northern, and Eastern Europe), used to pre-seed
// the food store (see `./repositories/foodRepository.ts`) on every startup
// (idempotent upsert, status "approved", source "seed" — see
// `FoodRepository.seedApproved`).
//
// These records are illustrative approximations for development and testing
// only — NOT verified laboratory analyses, NOT redistributable, and NOT a
// clinically validated data source. Every record is runtime-validated
// against the shared `CanonicalFood` contract at module load (see the
// `CATALOG.forEach` check below), so a malformed entry fails fast instead of
// shipping bad data to a caller.
//
// `CATALOG` is also used directly by `./modules/meals.ts` to resolve a meal
// line's `foodId` — meal assembly deliberately still resolves against this
// fixed seed list rather than the full food store, so its behaviour (and
// existing tests) are unaffected by admin/AI/user additions to the catalog.

import { createHash } from "node:crypto";
import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import type { CanonicalFood, LocalisedName } from "@t1dine/food-schema";
import { collectCanonicalFoodErrors } from "@t1dine/food-schema";
import type { FoodInput, NamesInput } from "./catalogTypes.js";
import { PT_STAPLES } from "./catalogData/portugalStaples.js";
import { PT_PRODUCE } from "./catalogData/portugalProduce.js";
import { PT_PROTEIN } from "./catalogData/portugalProtein.js";
import { PT_DISHES } from "./catalogData/portugalDishes.js";
import { PT_SWEETS } from "./catalogData/portugalSweets.js";
import { PT_PANTRY } from "./catalogData/portugalPantry.js";

function names(input: NamesInput): LocalisedName[] {
  return [
    { language: "pt-PT", name: input.pt.name, synonyms: input.pt.synonyms ?? [] },
    { language: "en", name: input.en.name, synonyms: input.en.synonyms ?? [] },
  ];
}

/** Deterministic, build-time-only stand-in for a real raw-snapshot digest. */
function syntheticSnapshotHash(seed: string): string {
  return createHash("sha256").update(`t1dine-synthetic-eu-catalog:${seed}`).digest("hex");
}

function source(id: string, market: string): SourceReference {
  return {
    sourceId: `SYNTH-T1DINE-${market}`,
    sourceRecordId: `SYNTH-${id.toUpperCase()}`,
    sourceVersion: "2026.1",
    market,
    licence: "synthetic-non-redistributable",
    retrievedAt: "2026-07-01T00:00:00.000Z",
    rawSnapshotSha256: syntheticSnapshotHash(id),
    mappingVersion: "map-0.1",
  };
}

function nutrients(
  id: string,
  market: string,
  carbGrams: number,
  energyKcal: number,
  confidence: NutrientObservation["confidence"],
  method: NutrientObservation["method"],
): NutrientObservation[] {
  const shared = source(id, market);
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

function food(input: FoodInput): CanonicalFood {
  const market = input.countries[0] ?? "PT";
  return {
    id: input.id,
    type: input.type,
    names: names(input.names),
    countries: input.countries,
    markets: input.countries,
    barcodes: [],
    cuisineTags: input.cuisineTags ?? [],
    dietaryPatternTags: input.dietaryPatternTags ?? [],
    mealContextTags: input.mealContextTags ?? [],
    clinicalBehaviourTags: [],
    nutrients: nutrients(input.id, market, input.carbGrams, input.energyKcal, input.confidence, input.method),
    status: input.status ?? "approved",
  };
}

// ---------------------------------------------------------------------------
// Portugal (PT) — Southern Europe / Mediterranean
// ---------------------------------------------------------------------------

const PT: FoodInput[] = [
  {
    id: "pt-pao-de-forma",
    type: "packaged",
    names: {
      pt: { name: "Pão de forma", synonyms: ["pão de forma branco", "pão de fatias"] },
      en: { name: "Sliced white bread", synonyms: ["sandwich bread"] },
    },
    countries: ["PT"],
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
    countries: ["PT"],
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
    countries: ["PT"],
    carbGrams: 28.2,
    energyKcal: 130,
    confidence: "high",
    method: "analytical",
    cuisineTags: ["portuguese", "mediterranean"],
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
    countries: ["PT"],
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
    countries: ["PT"],
    carbGrams: 25.0,
    energyKcal: 131,
    confidence: "high",
    method: "analytical",
    cuisineTags: ["italian", "mediterranean"],
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
    countries: ["PT"],
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
    countries: ["PT"],
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
    countries: ["PT"],
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
    countries: ["PT"],
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
    countries: ["PT"],
    carbGrams: 20.3,
    energyKcal: 89,
    confidence: "high",
    method: "analytical",
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["snack"],
  },
  {
    id: "pt-azeite",
    type: "ingredient",
    names: {
      pt: { name: "Azeite", synonyms: ["azeite virgem extra", "óleo de azeitona"] },
      en: { name: "Olive oil", synonyms: ["extra virgin olive oil"] },
    },
    countries: ["PT"],
    carbGrams: 0,
    energyKcal: 884,
    confidence: "high",
    method: "analytical",
    cuisineTags: ["portuguese", "mediterranean"],
    dietaryPatternTags: ["vegan", "vegetarian"],
  },
  {
    id: "pt-bacalhau-a-bras",
    type: "recipe",
    names: {
      pt: { name: "Bacalhau à Brás", synonyms: ["bacalhau a bras"] },
      en: { name: "Bacalhau à Brás (shredded cod with potato and egg)", synonyms: [] },
    },
    countries: ["PT"],
    carbGrams: 12.4,
    energyKcal: 196,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["portuguese", "mediterranean"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "pt-caldo-verde",
    type: "recipe",
    names: {
      pt: { name: "Caldo verde", synonyms: [] },
      en: { name: "Portuguese kale and potato soup", synonyms: [] },
    },
    countries: ["PT"],
    carbGrams: 8.1,
    energyKcal: 65,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["portuguese", "mediterranean"],
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
    countries: ["PT"],
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
    countries: ["PT"],
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
    countries: ["PT"],
    carbGrams: 14.6,
    energyKcal: 320,
    confidence: "unverified",
    method: "estimated",
    cuisineTags: ["portuguese"],
    mealContextTags: ["lunch", "dinner"],
  },
];

// ---------------------------------------------------------------------------
// Spain (ES) — Southern Europe / Mediterranean
// ---------------------------------------------------------------------------

const ES: FoodInput[] = [
  {
    id: "es-tortilla-de-patatas",
    type: "recipe",
    names: {
      pt: { name: "Tortilha de batata espanhola", synonyms: ["tortilha espanhola"] },
      en: { name: "Spanish potato omelette (tortilla de patatas)", synonyms: [] },
    },
    countries: ["ES"],
    carbGrams: 12.5,
    energyKcal: 166,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["spanish", "mediterranean"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "es-gaspacho",
    type: "recipe",
    names: {
      pt: { name: "Gaspacho", synonyms: ["gazpacho"] },
      en: { name: "Gazpacho (cold tomato soup)", synonyms: [] },
    },
    countries: ["ES"],
    carbGrams: 3.5,
    energyKcal: 26,
    confidence: "medium",
    method: "estimated",
    cuisineTags: ["spanish", "mediterranean"],
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "es-paelha-de-marisco",
    type: "recipe",
    names: {
      pt: { name: "Paelha de marisco", synonyms: ["paella de marisco"] },
      en: { name: "Seafood paella", synonyms: [] },
    },
    countries: ["ES"],
    carbGrams: 20.0,
    energyKcal: 150,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["spanish", "mediterranean"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "es-presunto-serrano",
    type: "ingredient",
    names: {
      pt: { name: "Presunto serrano", synonyms: ["jamón serrano"] },
      en: { name: "Serrano ham (cured)", synonyms: [] },
    },
    countries: ["ES"],
    carbGrams: 0.5,
    energyKcal: 241,
    confidence: "medium",
    method: "declared",
    cuisineTags: ["spanish"],
    mealContextTags: ["lunch", "dinner", "snack"],
  },
  {
    id: "es-pao-com-tomate",
    type: "recipe",
    names: {
      pt: { name: "Pão com tomate à espanhola", synonyms: ["pan con tomate"] },
      en: { name: "Bread with tomato (pan con tomate)", synonyms: [] },
    },
    countries: ["ES"],
    carbGrams: 24.0,
    energyKcal: 210,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["spanish", "mediterranean"],
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["breakfast", "snack"],
  },
  {
    id: "es-churros",
    type: "packaged",
    names: {
      pt: { name: "Churros", synonyms: [] },
      en: { name: "Churros", synonyms: [] },
    },
    countries: ["ES"],
    carbGrams: 44.0,
    energyKcal: 380,
    confidence: "medium",
    method: "declared",
    cuisineTags: ["spanish"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["breakfast", "dessert", "snack"],
  },
];

// ---------------------------------------------------------------------------
// Italy (IT) — Southern Europe / Mediterranean
// ---------------------------------------------------------------------------

const IT: FoodInput[] = [
  {
    id: "it-pizza-margherita",
    type: "recipe",
    names: {
      pt: { name: "Pizza Margherita", synonyms: [] },
      en: { name: "Margherita pizza", synonyms: [] },
    },
    countries: ["IT"],
    carbGrams: 33.0,
    energyKcal: 266,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["italian", "mediterranean"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "it-risoto-de-cogumelos",
    type: "recipe",
    names: {
      pt: { name: "Risoto de cogumelos", synonyms: ["risotto ai funghi"] },
      en: { name: "Mushroom risotto", synonyms: [] },
    },
    countries: ["IT"],
    carbGrams: 22.0,
    energyKcal: 130,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["italian", "mediterranean"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "it-lasanha-a-bolonhesa",
    type: "recipe",
    names: {
      pt: { name: "Lasanha à bolonhesa", synonyms: ["lasagne alla bolognese"] },
      en: { name: "Lasagne Bolognese", synonyms: [] },
    },
    countries: ["IT"],
    carbGrams: 13.0,
    energyKcal: 145,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["italian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "it-queijo-parmesao",
    type: "packaged",
    names: {
      pt: { name: "Queijo parmesão", synonyms: ["parmigiano reggiano"] },
      en: { name: "Parmesan cheese", synonyms: [] },
    },
    countries: ["IT"],
    carbGrams: 3.2,
    energyKcal: 392,
    confidence: "high",
    method: "declared",
    cuisineTags: ["italian"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["snack", "lunch", "dinner"],
  },
  {
    id: "it-tiramisu",
    type: "recipe",
    names: {
      pt: { name: "Tiramisu", synonyms: [] },
      en: { name: "Tiramisu", synonyms: [] },
    },
    countries: ["IT"],
    carbGrams: 29.0,
    energyKcal: 283,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["italian"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["dessert"],
  },
  {
    id: "it-bruschetta-de-tomate",
    type: "recipe",
    names: {
      pt: { name: "Bruschetta de tomate", synonyms: [] },
      en: { name: "Tomato bruschetta", synonyms: [] },
    },
    countries: ["IT"],
    carbGrams: 19.0,
    energyKcal: 150,
    confidence: "medium",
    method: "estimated",
    cuisineTags: ["italian", "mediterranean"],
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["snack"],
  },
];

// ---------------------------------------------------------------------------
// Greece (GR) — Southern Europe / Mediterranean
// ---------------------------------------------------------------------------

const GR: FoodInput[] = [
  {
    id: "gr-salada-grega",
    type: "recipe",
    names: {
      pt: { name: "Salada grega", synonyms: [] },
      en: { name: "Greek salad", synonyms: [] },
    },
    countries: ["GR"],
    carbGrams: 4.0,
    energyKcal: 85,
    confidence: "medium",
    method: "estimated",
    cuisineTags: ["greek", "mediterranean"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "gr-tzatziki",
    type: "recipe",
    names: {
      pt: { name: "Tzatziki", synonyms: [] },
      en: { name: "Tzatziki (yoghurt-cucumber dip)", synonyms: [] },
    },
    countries: ["GR"],
    carbGrams: 3.5,
    energyKcal: 65,
    confidence: "medium",
    method: "estimated",
    cuisineTags: ["greek", "mediterranean"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["snack", "lunch", "dinner"],
  },
  {
    id: "gr-mousaka",
    type: "recipe",
    names: {
      pt: { name: "Mousaka", synonyms: ["moussaka"] },
      en: { name: "Moussaka", synonyms: [] },
    },
    countries: ["GR"],
    carbGrams: 8.0,
    energyKcal: 140,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["greek", "mediterranean"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "gr-souvlaki-de-frango",
    type: "recipe",
    names: {
      pt: { name: "Souvlaki de frango", synonyms: [] },
      en: { name: "Chicken souvlaki", synonyms: [] },
    },
    countries: ["GR"],
    carbGrams: 2.0,
    energyKcal: 180,
    confidence: "medium",
    method: "estimated",
    cuisineTags: ["greek"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "gr-pao-pita",
    type: "packaged",
    names: {
      pt: { name: "Pão pita", synonyms: ["pita"] },
      en: { name: "Pita bread", synonyms: [] },
    },
    countries: ["GR"],
    carbGrams: 55.0,
    energyKcal: 275,
    confidence: "medium",
    method: "declared",
    cuisineTags: ["greek", "mediterranean"],
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["breakfast", "lunch", "snack"],
  },
  {
    id: "gr-baclava",
    type: "recipe",
    names: {
      pt: { name: "Baclava", synonyms: ["baklava"] },
      en: { name: "Baklava", synonyms: [] },
    },
    countries: ["GR"],
    carbGrams: 41.0,
    energyKcal: 430,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["greek"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["dessert"],
  },
];

// ---------------------------------------------------------------------------
// France (FR) — Western Europe
// ---------------------------------------------------------------------------

const FR: FoodInput[] = [
  {
    id: "fr-croissant",
    type: "packaged",
    names: {
      pt: { name: "Croissant", synonyms: [] },
      en: { name: "Croissant", synonyms: [] },
    },
    countries: ["FR"],
    carbGrams: 45.0,
    energyKcal: 406,
    confidence: "medium",
    method: "declared",
    cuisineTags: ["french"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["breakfast"],
  },
  {
    id: "fr-baguete-francesa",
    type: "packaged",
    names: {
      pt: { name: "Baguete francesa", synonyms: [] },
      en: { name: "French baguette", synonyms: [] },
    },
    countries: ["FR"],
    carbGrams: 55.0,
    energyKcal: 270,
    confidence: "high",
    method: "declared",
    cuisineTags: ["french"],
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["breakfast", "lunch", "dinner"],
  },
  {
    id: "fr-queijo-brie",
    type: "packaged",
    names: {
      pt: { name: "Queijo brie", synonyms: [] },
      en: { name: "Brie cheese", synonyms: [] },
    },
    countries: ["FR"],
    carbGrams: 0.5,
    energyKcal: 334,
    confidence: "high",
    method: "declared",
    cuisineTags: ["french"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["snack", "dinner"],
  },
  {
    id: "fr-ratatouille",
    type: "recipe",
    names: {
      pt: { name: "Ratatouille", synonyms: ["ratatui"] },
      en: { name: "Ratatouille (stewed vegetables)", synonyms: [] },
    },
    countries: ["FR"],
    carbGrams: 6.0,
    energyKcal: 50,
    confidence: "medium",
    method: "estimated",
    cuisineTags: ["french", "mediterranean"],
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "fr-quiche-lorraine",
    type: "recipe",
    names: {
      pt: { name: "Quiche Lorraine", synonyms: [] },
      en: { name: "Quiche Lorraine", synonyms: [] },
    },
    countries: ["FR"],
    carbGrams: 16.0,
    energyKcal: 280,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["french"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "fr-creme-brulee",
    type: "recipe",
    names: {
      pt: { name: "Crème brûlée", synonyms: [] },
      en: { name: "Crème brûlée", synonyms: [] },
    },
    countries: ["FR"],
    carbGrams: 20.0,
    energyKcal: 300,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["french"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["dessert"],
  },
];

// ---------------------------------------------------------------------------
// Germany (DE) — Western Europe
// ---------------------------------------------------------------------------

const DE: FoodInput[] = [
  {
    id: "de-salsicha-bratwurst",
    type: "ingredient",
    names: {
      pt: { name: "Salsicha bratwurst", synonyms: ["bratwurst"] },
      en: { name: "Bratwurst sausage", synonyms: [] },
    },
    countries: ["DE"],
    carbGrams: 1.5,
    energyKcal: 300,
    confidence: "medium",
    method: "declared",
    cuisineTags: ["german"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "de-salada-de-batata-alema",
    type: "recipe",
    names: {
      pt: { name: "Salada de batata alemã", synonyms: [] },
      en: { name: "German potato salad", synonyms: [] },
    },
    countries: ["DE"],
    carbGrams: 15.0,
    energyKcal: 120,
    confidence: "medium",
    method: "estimated",
    cuisineTags: ["german"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "de-chucrute",
    type: "ingredient",
    names: {
      pt: { name: "Chucrute", synonyms: ["sauerkraut"] },
      en: { name: "Sauerkraut", synonyms: [] },
    },
    countries: ["DE"],
    carbGrams: 4.0,
    energyKcal: 19,
    confidence: "high",
    method: "analytical",
    cuisineTags: ["german"],
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "de-pretzel-alemao",
    type: "packaged",
    names: {
      pt: { name: "Pretzel alemão", synonyms: ["brezel"] },
      en: { name: "German pretzel (Brezel)", synonyms: [] },
    },
    countries: ["DE"],
    carbGrams: 50.0,
    energyKcal: 340,
    confidence: "medium",
    method: "declared",
    cuisineTags: ["german"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["snack"],
  },
  {
    id: "de-strudel-de-maca",
    type: "recipe",
    names: {
      pt: { name: "Strudel de maçã", synonyms: [] },
      en: { name: "Apple strudel", synonyms: [] },
    },
    countries: ["DE"],
    carbGrams: 29.0,
    energyKcal: 230,
    confidence: "medium",
    method: "estimated",
    cuisineTags: ["german"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["dessert", "snack"],
  },
  {
    id: "de-escalope-vienense",
    type: "recipe",
    names: {
      pt: { name: "Escalope à vienense", synonyms: ["schnitzel"] },
      en: { name: "Wiener schnitzel", synonyms: [] },
    },
    countries: ["DE"],
    carbGrams: 12.0,
    energyKcal: 250,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["german"],
    mealContextTags: ["lunch", "dinner"],
  },
];

// ---------------------------------------------------------------------------
// United Kingdom (GB) — Northern Europe
// ---------------------------------------------------------------------------

const GB: FoodInput[] = [
  {
    id: "gb-feijao-cozido-molho-tomate",
    type: "packaged",
    names: {
      pt: { name: "Feijão cozido em molho de tomate", synonyms: ["baked beans"] },
      en: { name: "Baked beans in tomato sauce", synonyms: [] },
    },
    countries: ["GB"],
    carbGrams: 13.0,
    energyKcal: 80,
    confidence: "high",
    method: "declared",
    cuisineTags: ["british"],
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["breakfast", "lunch"],
  },
  {
    id: "gb-peixe-com-batata-frita",
    type: "restaurant",
    names: {
      pt: { name: "Peixe com batata frita à inglesa", synonyms: ["fish and chips"] },
      en: { name: "Fish and chips", synonyms: [] },
    },
    countries: ["GB"],
    carbGrams: 22.0,
    energyKcal: 230,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["british"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "gb-scones",
    type: "packaged",
    names: {
      pt: { name: "Scones", synonyms: [] },
      en: { name: "Scones", synonyms: [] },
    },
    countries: ["GB"],
    carbGrams: 50.0,
    energyKcal: 370,
    confidence: "medium",
    method: "declared",
    cuisineTags: ["british"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["breakfast", "snack"],
  },
  {
    id: "gb-empadao-de-carne-ingles",
    type: "recipe",
    names: {
      pt: { name: "Empadão de carne à inglesa", synonyms: ["shepherd's pie"] },
      en: { name: "Shepherd's pie", synonyms: [] },
    },
    countries: ["GB"],
    carbGrams: 10.0,
    energyKcal: 110,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["british"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "gb-papas-de-aveia",
    type: "recipe",
    names: {
      pt: { name: "Papas de aveia", synonyms: ["porridge"] },
      en: { name: "Oat porridge", synonyms: [] },
    },
    countries: ["GB"],
    carbGrams: 9.0,
    energyKcal: 55,
    confidence: "high",
    method: "calculated",
    cuisineTags: ["british"],
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["breakfast"],
  },
  {
    id: "gb-crumble-de-maca",
    type: "recipe",
    names: {
      pt: { name: "Crumble de maçã", synonyms: [] },
      en: { name: "Apple crumble", synonyms: [] },
    },
    countries: ["GB"],
    carbGrams: 27.0,
    energyKcal: 200,
    confidence: "medium",
    method: "estimated",
    cuisineTags: ["british"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["dessert"],
  },
];

// ---------------------------------------------------------------------------
// Poland (PL) — Eastern Europe
// ---------------------------------------------------------------------------

const PL: FoodInput[] = [
  {
    id: "pl-pierogi-batata-e-queijo",
    type: "recipe",
    names: {
      pt: { name: "Pierogi de batata e queijo", synonyms: ["pierogi ruskie"] },
      en: { name: "Potato and cheese pierogi (pierogi ruskie)", synonyms: [] },
    },
    countries: ["PL"],
    carbGrams: 24.0,
    energyKcal: 180,
    confidence: "medium",
    method: "estimated",
    cuisineTags: ["polish"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "pl-bigos",
    type: "recipe",
    names: {
      pt: { name: "Bigos (guisado de couve e carne)", synonyms: [] },
      en: { name: "Bigos (hunter's stew)", synonyms: [] },
    },
    countries: ["PL"],
    carbGrams: 6.0,
    energyKcal: 110,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["polish"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "pl-paczki",
    type: "packaged",
    names: {
      pt: { name: "Paczki (bola de Berlim polaca)", synonyms: [] },
      en: { name: "Pączki (Polish doughnut)", synonyms: [] },
    },
    countries: ["PL"],
    carbGrams: 40.0,
    energyKcal: 350,
    confidence: "medium",
    method: "declared",
    cuisineTags: ["polish"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["dessert", "snack"],
  },
  {
    id: "pl-barszcz",
    type: "recipe",
    names: {
      pt: { name: "Barszcz (sopa de beterraba)", synonyms: ["barszcz czerwony"] },
      en: { name: "Beetroot soup (barszcz)", synonyms: [] },
    },
    countries: ["PL"],
    carbGrams: 7.0,
    energyKcal: 35,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["polish"],
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
];

// ---------------------------------------------------------------------------
// Additional Southern/Western/Northern/Eastern European foods — widens area
// coverage beyond the original single-digit-per-country seed set above.
// Appended to each country's array (not a new top-level group) so the
// per-region groupings above stay the single source of truth for "which
// country does this food belong to".
// ---------------------------------------------------------------------------

const ES_MORE: FoodInput[] = [
  {
    id: "es-fabada-asturiana",
    type: "recipe",
    names: {
      pt: { name: "Fabada asturiana", synonyms: [] },
      en: { name: "Fabada asturiana (Asturian bean and pork stew)", synonyms: [] },
    },
    countries: ["ES"],
    carbGrams: 9.0,
    energyKcal: 150,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["spanish"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "es-crema-catalana",
    type: "recipe",
    names: {
      pt: { name: "Crema catalana", synonyms: [] },
      en: { name: "Crema catalana (Catalan burnt cream)", synonyms: [] },
    },
    countries: ["ES"],
    carbGrams: 22.0,
    energyKcal: 200,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["spanish"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["dessert"],
  },
  {
    id: "es-queijo-manchego",
    type: "packaged",
    names: {
      pt: { name: "Queijo manchego", synonyms: [] },
      en: { name: "Manchego cheese", synonyms: [] },
    },
    countries: ["ES"],
    carbGrams: 0.1,
    energyKcal: 400,
    confidence: "high",
    method: "analytical",
    cuisineTags: ["spanish"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["snack", "lunch", "dinner"],
  },
  {
    id: "es-melao-com-presunto",
    type: "recipe",
    names: {
      pt: { name: "Melão com presunto", synonyms: [] },
      en: { name: "Melon with cured ham", synonyms: [] },
    },
    countries: ["ES"],
    carbGrams: 7.0,
    energyKcal: 90,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["spanish", "mediterranean"],
    mealContextTags: ["snack", "lunch"],
  },
];

const IT_MORE: FoodInput[] = [
  {
    id: "it-esparguete-a-carbonara",
    type: "recipe",
    names: {
      pt: { name: "Esparguete à carbonara", synonyms: ["spaghetti alla carbonara"] },
      en: { name: "Spaghetti carbonara", synonyms: [] },
    },
    countries: ["IT"],
    carbGrams: 24.0,
    energyKcal: 380,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["italian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "it-salada-caprese",
    type: "recipe",
    names: {
      pt: { name: "Salada caprese", synonyms: [] },
      en: { name: "Caprese salad", synonyms: [] },
    },
    countries: ["IT"],
    carbGrams: 3.0,
    energyKcal: 180,
    confidence: "medium",
    method: "estimated",
    cuisineTags: ["italian", "mediterranean"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["lunch", "dinner", "snack"],
  },
  {
    id: "it-nhoque-de-batata",
    type: "recipe",
    names: {
      pt: { name: "Nhoque de batata", synonyms: ["gnocchi di patate"] },
      en: { name: "Potato gnocchi", synonyms: [] },
    },
    countries: ["IT"],
    carbGrams: 20.0,
    energyKcal: 130,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["italian"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "it-panetone",
    type: "packaged",
    names: {
      pt: { name: "Panetone", synonyms: ["panettone"] },
      en: { name: "Panettone", synonyms: [] },
    },
    countries: ["IT"],
    carbGrams: 55.0,
    energyKcal: 370,
    confidence: "medium",
    method: "declared",
    cuisineTags: ["italian"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["breakfast", "dessert", "snack"],
  },
];

const GR_MORE: FoodInput[] = [
  {
    id: "gr-sopa-avgolemono",
    type: "recipe",
    names: {
      pt: { name: "Sopa avgolemono", synonyms: ["avgolemono"] },
      en: { name: "Avgolemono (egg-lemon chicken soup)", synonyms: [] },
    },
    countries: ["GR"],
    carbGrams: 6.0,
    energyKcal: 65,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["greek", "mediterranean"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "gr-queijo-feta",
    type: "packaged",
    names: {
      pt: { name: "Queijo feta", synonyms: [] },
      en: { name: "Feta cheese", synonyms: [] },
    },
    countries: ["GR"],
    carbGrams: 4.0,
    energyKcal: 264,
    confidence: "high",
    method: "analytical",
    cuisineTags: ["greek", "mediterranean"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["lunch", "dinner", "snack"],
  },
  {
    id: "gr-galaktoboureko",
    type: "recipe",
    names: {
      pt: { name: "Galaktoboureko", synonyms: [] },
      en: { name: "Galaktoboureko (custard filo pastry)", synonyms: [] },
    },
    countries: ["GR"],
    carbGrams: 35.0,
    energyKcal: 320,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["greek"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["dessert"],
  },
  {
    id: "gr-taramossalata",
    type: "recipe",
    names: {
      pt: { name: "Taramossalata", synonyms: [] },
      en: { name: "Taramosalata (fish roe dip)", synonyms: [] },
    },
    countries: ["GR"],
    carbGrams: 8.0,
    energyKcal: 300,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["greek", "mediterranean"],
    mealContextTags: ["snack", "lunch"],
  },
];

const FR_MORE: FoodInput[] = [
  {
    id: "fr-cassoulet",
    type: "recipe",
    names: {
      pt: { name: "Cassoulet", synonyms: [] },
      en: { name: "Cassoulet (bean and meat stew)", synonyms: [] },
    },
    countries: ["FR"],
    carbGrams: 14.0,
    energyKcal: 180,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["french"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "fr-tarte-tatin",
    type: "recipe",
    names: {
      pt: { name: "Tarte Tatin", synonyms: [] },
      en: { name: "Tarte Tatin (upside-down apple tart)", synonyms: [] },
    },
    countries: ["FR"],
    carbGrams: 30.0,
    energyKcal: 250,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["french"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["dessert"],
  },
  {
    id: "fr-queijo-camembert",
    type: "packaged",
    names: {
      pt: { name: "Queijo camembert", synonyms: [] },
      en: { name: "Camembert cheese", synonyms: [] },
    },
    countries: ["FR"],
    carbGrams: 0.5,
    energyKcal: 300,
    confidence: "high",
    method: "analytical",
    cuisineTags: ["french"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["snack", "dinner"],
  },
  {
    id: "fr-vichyssoise",
    type: "recipe",
    names: {
      pt: { name: "Vichyssoise", synonyms: ["sopa fria de alho-francês e batata"] },
      en: { name: "Vichyssoise (cold leek and potato soup)", synonyms: [] },
    },
    countries: ["FR"],
    carbGrams: 9.0,
    energyKcal: 90,
    confidence: "medium",
    method: "estimated",
    cuisineTags: ["french"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
];

const DE_MORE: FoodInput[] = [
  {
    id: "de-bolinho-de-batata-alemao",
    type: "recipe",
    names: {
      pt: { name: "Bolinho de batata alemão", synonyms: ["kartoffelknödel"] },
      en: { name: "German potato dumplings (Kartoffelknödel)", synonyms: [] },
    },
    countries: ["DE"],
    carbGrams: 22.0,
    energyKcal: 150,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["german"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "de-torta-de-linzer",
    type: "recipe",
    names: {
      pt: { name: "Torta de Linzer", synonyms: ["linzer torte"] },
      en: { name: "Linzer torte", synonyms: [] },
    },
    countries: ["DE"],
    carbGrams: 48.0,
    energyKcal: 400,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["german"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["dessert"],
  },
  {
    id: "de-muesli-suico-alemao",
    type: "recipe",
    names: {
      pt: { name: "Muesli à bircher", synonyms: [] },
      en: { name: "Bircher muesli", synonyms: [] },
    },
    countries: ["DE"],
    carbGrams: 34.0,
    energyKcal: 180,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["german"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["breakfast"],
  },
  {
    id: "de-salsicha-weisswurst",
    type: "ingredient",
    names: {
      pt: { name: "Salsicha branca", synonyms: ["weisswurst"] },
      en: { name: "Weisswurst (Bavarian white sausage)", synonyms: [] },
    },
    countries: ["DE"],
    carbGrams: 1.0,
    energyKcal: 280,
    confidence: "medium",
    method: "declared",
    cuisineTags: ["german"],
    mealContextTags: ["breakfast", "lunch"],
  },
];

const GB_MORE: FoodInput[] = [
  {
    id: "gb-toad-in-the-hole",
    type: "recipe",
    names: {
      pt: { name: "Salsichas em massa inglesa", synonyms: ["toad in the hole"] },
      en: { name: "Toad in the hole", synonyms: [] },
    },
    countries: ["GB"],
    carbGrams: 14.0,
    energyKcal: 230,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["british"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "gb-bolo-vitoria",
    type: "packaged",
    names: {
      pt: { name: "Bolo Vitória", synonyms: ["victoria sponge"] },
      en: { name: "Victoria sponge cake", synonyms: [] },
    },
    countries: ["GB"],
    carbGrams: 50.0,
    energyKcal: 380,
    confidence: "medium",
    method: "declared",
    cuisineTags: ["british"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["dessert", "snack"],
  },
  {
    id: "gb-empadao-de-vaca",
    type: "recipe",
    names: {
      pt: { name: "Empadão de vaca", synonyms: ["cottage pie"] },
      en: { name: "Cottage pie", synonyms: [] },
    },
    countries: ["GB"],
    carbGrams: 9.0,
    energyKcal: 105,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["british"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "gb-compota-de-laranja",
    type: "packaged",
    names: {
      pt: { name: "Compota de laranja", synonyms: ["marmelada de laranja"] },
      en: { name: "Orange marmalade", synonyms: [] },
    },
    countries: ["GB"],
    carbGrams: 60.0,
    energyKcal: 250,
    confidence: "medium",
    method: "declared",
    cuisineTags: ["british"],
    dietaryPatternTags: ["vegan", "vegetarian"],
    mealContextTags: ["breakfast"],
  },
];

const PL_MORE: FoodInput[] = [
  {
    id: "pl-golabki",
    type: "recipe",
    names: {
      pt: { name: "Golabki (couve recheada)", synonyms: ["gołąbki"] },
      en: { name: "Gołąbki (stuffed cabbage rolls)", synonyms: [] },
    },
    countries: ["PL"],
    carbGrams: 9.0,
    energyKcal: 120,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["polish"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "pl-costeleta-panada-polaca",
    type: "recipe",
    names: {
      pt: { name: "Costeleta panada à polaca", synonyms: ["kotlet schabowy"] },
      en: { name: "Breaded pork cutlet (kotlet schabowy)", synonyms: [] },
    },
    countries: ["PL"],
    carbGrams: 10.0,
    energyKcal: 260,
    confidence: "medium",
    method: "calculated",
    cuisineTags: ["polish"],
    mealContextTags: ["lunch", "dinner"],
  },
  {
    id: "pl-queijo-fumado-oscypek",
    type: "packaged",
    names: {
      pt: { name: "Queijo fumado oscypek", synonyms: ["oscypek"] },
      en: { name: "Oscypek (smoked cheese)", synonyms: [] },
    },
    countries: ["PL"],
    carbGrams: 2.0,
    energyKcal: 320,
    confidence: "medium",
    method: "declared",
    cuisineTags: ["polish"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["snack"],
  },
  {
    id: "pl-bolo-de-papoila",
    type: "packaged",
    names: {
      pt: { name: "Bolo de sementes de papoila", synonyms: ["makowiec"] },
      en: { name: "Makowiec (poppy seed cake)", synonyms: [] },
    },
    countries: ["PL"],
    carbGrams: 45.0,
    energyKcal: 380,
    confidence: "low",
    method: "estimated",
    cuisineTags: ["polish"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["dessert", "snack"],
  },
];

const CATALOG_INPUTS: FoodInput[] = [
  ...PT,
  // Portugal — deep coverage by category (see ./catalogData/*).
  ...PT_STAPLES,
  ...PT_PRODUCE,
  ...PT_PROTEIN,
  ...PT_DISHES,
  ...PT_SWEETS,
  ...PT_PANTRY,
  ...ES,
  ...ES_MORE,
  ...IT,
  ...IT_MORE,
  ...GR,
  ...GR_MORE,
  ...FR,
  ...FR_MORE,
  ...DE,
  ...DE_MORE,
  ...GB,
  ...GB_MORE,
  ...PL,
  ...PL_MORE,
];

export const CATALOG: CanonicalFood[] = CATALOG_INPUTS.map(food);

// Guard: ids must be globally unique. The food store upserts by id, so a
// duplicate id would silently overwrite an earlier record (and shrink the
// catalog) rather than fail — fatal here instead, since it usually means two
// data files collided on an id prefix.
const seenIds = new Map<string, number>();
CATALOG.forEach((item, index) => {
  const priorIndex = seenIds.get(item.id);
  if (priorIndex !== undefined) {
    throw new Error(
      `Duplicate catalog id "${item.id}" (indexes ${priorIndex} and ${index}); ids must be unique.`,
    );
  }
  seenIds.set(item.id, index);

  const errors = collectCanonicalFoodErrors(item);
  if (errors.length > 0) {
    throw new Error(
      `Invalid synthetic catalog entry at index ${index} (id="${item.id}"): ${errors.join("; ")}`,
    );
  }
});
