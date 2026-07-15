// Synthetic Portugal food catalog bundled on-device for offline search.
// NOT real source data and NOT redistributable — placeholder until a
// legally-cleared INSA subset is ingested (see plan §5.2). Typed against the
// shared canonical contract so it stays schema-accurate.

import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import type { CanonicalFood, FoodType } from "@t1dine/food-schema";

type Confidence = NutrientObservation["confidence"];
type Method = NutrientObservation["method"];

const SYNTHETIC_SOURCE: SourceReference = {
  sourceId: "SYNTH-INSA-PT",
  sourceRecordId: "SYNTH",
  sourceVersion: "2026.1",
  market: "PT",
  licence: "synthetic-non-redistributable",
  retrievedAt: "2026-07-14T00:00:00.000Z",
  rawSnapshotSha256: "0".repeat(64),
  mappingVersion: "map-0.1",
};

interface Draft {
  id: string;
  type: FoodType;
  pt: string;
  en: string;
  synonyms: string[];
  carb: number;
  energy: number;
  confidence: Confidence;
  method: Method;
  barcodes?: string[];
}

function obs(nutrientCode: string, value: number, unit: NutrientObservation["unit"], confidence: Confidence, method: Method): NutrientObservation {
  return {
    nutrientCode,
    value,
    unit,
    basisQuantity: 100,
    basisUnit: "g",
    method,
    confidence,
    source: { ...SYNTHETIC_SOURCE, sourceRecordId: `SYNTH-${nutrientCode}` },
  };
}

function build(d: Draft): CanonicalFood {
  return {
    id: d.id,
    type: d.type,
    names: [
      { language: "pt-PT", name: d.pt, synonyms: d.synonyms },
      { language: "en", name: d.en, synonyms: [] },
    ],
    countries: ["PT"],
    markets: ["PT"],
    barcodes: d.barcodes ?? [],
    cuisineTags: ["portuguese"],
    dietaryPatternTags: [],
    mealContextTags: [],
    clinicalBehaviourTags: [],
    nutrients: [obs("CHOAVL", d.carb, "g", d.confidence, d.method), obs("ENERC", d.energy, "kcal", d.confidence, d.method)],
    status: d.confidence === "unverified" ? "candidate" : "approved",
  };
}

const DRAFTS: Draft[] = [
  { id: "pt-arroz-cozido", type: "ingredient", pt: "Arroz cozido", en: "Cooked white rice", synonyms: ["arroz branco"], carb: 28, energy: 130, confidence: "high", method: "analytical" },
  { id: "pt-pao-de-trigo", type: "ingredient", pt: "Pão de trigo", en: "Wheat bread", synonyms: ["pão", "carcaça"], carb: 49, energy: 265, confidence: "high", method: "analytical" },
  { id: "pt-batata-cozida", type: "ingredient", pt: "Batata cozida", en: "Boiled potato", synonyms: ["batatas"], carb: 20, energy: 86, confidence: "high", method: "analytical" },
  { id: "pt-massa-cozida", type: "ingredient", pt: "Massa cozida", en: "Cooked pasta", synonyms: ["esparguete", "macarrão"], carb: 31, energy: 158, confidence: "high", method: "analytical" },
  { id: "pt-feijao-cozido", type: "ingredient", pt: "Feijão cozido", en: "Boiled beans", synonyms: ["feijão encarnado"], carb: 16, energy: 91, confidence: "medium", method: "declared" },
  { id: "pt-maca", type: "ingredient", pt: "Maçã", en: "Apple", synonyms: ["maçãs"], carb: 12, energy: 52, confidence: "high", method: "analytical" },
  { id: "pt-banana", type: "ingredient", pt: "Banana", en: "Banana", synonyms: ["bananas"], carb: 23, energy: 89, confidence: "high", method: "analytical" },
  { id: "pt-laranja", type: "ingredient", pt: "Laranja", en: "Orange", synonyms: ["laranjas"], carb: 9, energy: 47, confidence: "high", method: "analytical" },
  { id: "pt-leite-meio-gordo", type: "ingredient", pt: "Leite meio-gordo", en: "Semi-skimmed milk", synonyms: ["leite"], carb: 5, energy: 46, confidence: "medium", method: "declared" },
  { id: "pt-iogurte-natural", type: "packaged", pt: "Iogurte natural", en: "Plain yoghurt", synonyms: ["iogurte"], carb: 5, energy: 61, confidence: "medium", method: "declared", barcodes: ["5601010000010"] },
  { id: "pt-flocos-milho", type: "packaged", pt: "Flocos de milho", en: "Corn flakes", synonyms: ["cereais"], carb: 84, energy: 378, confidence: "medium", method: "declared", barcodes: ["5601010000027"] },
  { id: "pt-bacalhau-cozido", type: "ingredient", pt: "Bacalhau cozido", en: "Boiled salt cod", synonyms: ["bacalhau"], carb: 0, energy: 108, confidence: "medium", method: "declared" },
  { id: "pt-frango-grelhado", type: "restaurant", pt: "Frango grelhado", en: "Grilled chicken", synonyms: ["frango"], carb: 0, energy: 165, confidence: "low", method: "declared" },
  { id: "pt-arroz-doce", type: "recipe", pt: "Arroz doce", en: "Rice pudding", synonyms: ["doce"], carb: 24, energy: 130, confidence: "medium", method: "calculated" },
  { id: "pt-pao-caseiro", type: "custom", pt: "Pão caseiro", en: "Homemade bread", synonyms: ["pão da avó"], carb: 49, energy: 270, confidence: "unverified", method: "estimated" },
];

export const CATALOG: CanonicalFood[] = DRAFTS.map(build);
