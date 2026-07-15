// Synthetic Portugal curation catalog for the T1Dine admin portal.
//
// SYNTHETIC DATA ONLY. None of these records are real source data and none are
// redistributable. Nutrient values are plausible-but-invented. The purpose is to
// exercise the curation UI (status review, provenance, data-quality flags),
// not to provide nutrition truth.
//
// Every record is validated at the boundary with `collectCanonicalFoodErrors`
// (per CLAUDE.md: "All external data is untrusted. Validate at boundaries.") and
// enriched with a computed, human-readable data-quality flag. A couple of
// records carry deliberate runtime defects (a broken source digest, a
// non-positive basis quantity) so the dashboard's "failing validation" counter
// and the "Inválido" chip have something real to show.

import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import { CONFIDENCE_LEVELS, type ConfidenceLevel, type NutrientMethod } from "@t1dine/domain";
import type { CanonicalFood, FoodType } from "@t1dine/food-schema";
import { collectCanonicalFoodErrors, FOOD_STATUSES, type FoodStatus } from "@t1dine/food-schema";

/** Nutrient codes used across the synthetic catalog (per-100 g basis). */
export const NUTRIENT_CODE = {
  carbohydrate: "CHOAVL",
  energyKcal: "ENERC",
} as const;

/** Record-level data-quality signal computed by the portal (never colour-only in the UI). */
export type DataQualityFlag = "ok" | "warning" | "invalid";

/** A synthetic food source, as shown in the "Fontes" register. */
export interface CatalogSource {
  id: string;
  name: string;
  /** Market the source covers (ISO country code). */
  market: string;
  licence: string;
  /** Refresh cadence ("cadência"). */
  cadence: string;
}

/** A canonical food enriched with everything the curation UI needs to render one row. */
export interface CatalogFood {
  food: CanonicalFood;
  /** Boundary-validation errors (empty === valid). */
  validationErrors: string[];
  isValid: boolean;
  /** Worst-case confidence across the record's nutrient observations. */
  confidence: ConfidenceLevel;
  dataQuality: DataQualityFlag;
  /** pt-PT display name (falls back to first available name). */
  primaryName: string;
  /** Carbohydrate g per 100 g, or null if absent. */
  carbPer100g: number | null;
  /** Energy kcal per 100 g, or null if absent. */
  energyKcalPer100g: number | null;
  /** Primary provenance for the record (shared by its nutrient observations). */
  source: SourceReference;
  /** Resolved source register entry, or null if the source id is unknown. */
  sourceMeta: CatalogSource | null;
}

/** Synthetic source register. `id` is referenced by every food's provenance. */
export const SOURCES: CatalogSource[] = [
  {
    id: "INSA-PT",
    name: "INSA — Tabela da Composição de Alimentos (sintético)",
    market: "PT",
    licence: "sintético — não redistribuível",
    cadence: "anual",
  },
  {
    id: "OFF-PT",
    name: "Open Food Facts — Portugal (sintético)",
    market: "PT",
    licence: "sintético — tipo ODbL",
    cadence: "diária",
  },
  {
    id: "REST-PT",
    name: "Menus de restauração (sintético)",
    market: "PT",
    licence: "sintético — uso restrito",
    cadence: "trimestral",
  },
  {
    id: "COMM-PT",
    name: "Receitas da comunidade (sintético)",
    market: "PT",
    licence: "sintético — comunidade",
    cadence: "contínua",
  },
  {
    id: "USER",
    name: "Criado pelo utilizador",
    market: "PT",
    licence: "sintético — gerado pelo utilizador",
    cadence: "ad-hoc",
  },
];

function findSource(id: string): CatalogSource | null {
  return SOURCES.find((source) => source.id === id) ?? null;
}

/**
 * Deterministic, NON-cryptographic filler that satisfies the source-digest
 * boundary check (/^[0-9a-f]{64}$/). Synthetic provenance only — this is never a
 * real content hash. Kept pure so server rendering is stable across renders.
 */
function syntheticDigest(seed: string): string {
  let hash = 2166136261 >>> 0;
  let out = "";
  for (let i = 0; i < 64; i += 1) {
    hash ^= seed.charCodeAt(i % seed.length) + i;
    hash = Math.imul(hash, 16777619) >>> 0;
    out += (hash & 0xf).toString(16);
  }
  return out;
}

interface FoodSpec {
  id: string;
  type: FoodType;
  namePt: string;
  nameEn: string;
  synonyms?: string[];
  status: FoodStatus;
  /** CHOAVL, g per 100 g. */
  carb: number;
  /** ENERC, kcal per 100 g. */
  energyKcal: number;
  confidence: ConfidenceLevel;
  method: NutrientMethod;
  sourceId: string;
  sourceRecordId: string;
  barcodes?: string[];
  cuisineTags?: string[];
  dietaryPatternTags?: string[];
  mealContextTags?: string[];
  clinicalBehaviourTags?: string[];
  /**
   * Optional injected runtime defect, used to demonstrate boundary validation:
   * - "bad-digest": source snapshot digest fails integrity format check.
   * - "zero-basis": energy observation declares a non-positive basis quantity.
   */
  defect?: "bad-digest" | "zero-basis";
}

const CATALOG_SPECS: FoodSpec[] = [
  {
    id: "pt-arroz-cozido",
    type: "ingredient",
    namePt: "Arroz branco cozido",
    nameEn: "Cooked white rice",
    synonyms: ["arroz cozido"],
    status: "approved",
    carb: 28,
    energyKcal: 130,
    confidence: "high",
    method: "analytical",
    sourceId: "INSA-PT",
    sourceRecordId: "INSA-0001",
    cuisineTags: ["portuguesa"],
    mealContextTags: ["almoco", "jantar"],
  },
  {
    id: "pt-pao-trigo",
    type: "ingredient",
    namePt: "Pão de trigo",
    nameEn: "Wheat bread",
    status: "approved",
    carb: 49,
    energyKcal: 261,
    confidence: "high",
    method: "analytical",
    sourceId: "INSA-PT",
    sourceRecordId: "INSA-0002",
    cuisineTags: ["portuguesa"],
    mealContextTags: ["pequeno-almoco", "lanche"],
  },
  {
    id: "pt-batata-cozida",
    type: "ingredient",
    namePt: "Batata cozida",
    nameEn: "Boiled potato",
    status: "approved",
    carb: 20,
    energyKcal: 86,
    confidence: "high",
    method: "analytical",
    sourceId: "INSA-PT",
    sourceRecordId: "INSA-0003",
    cuisineTags: ["portuguesa"],
    mealContextTags: ["almoco", "jantar"],
  },
  {
    id: "pt-banana",
    type: "ingredient",
    namePt: "Banana",
    nameEn: "Banana",
    status: "approved",
    carb: 23,
    energyKcal: 95,
    confidence: "medium",
    method: "analytical",
    sourceId: "INSA-PT",
    sourceRecordId: "INSA-0011",
    mealContextTags: ["lanche"],
  },
  {
    id: "pt-maca",
    type: "ingredient",
    namePt: "Maçã",
    nameEn: "Apple",
    status: "approved",
    carb: 14,
    energyKcal: 54,
    confidence: "high",
    method: "analytical",
    sourceId: "INSA-PT",
    sourceRecordId: "INSA-0012",
    mealContextTags: ["lanche"],
  },
  {
    id: "pt-flocos-milho",
    type: "packaged",
    namePt: "Flocos de milho",
    nameEn: "Corn flakes",
    status: "approved",
    carb: 84,
    energyKcal: 378,
    confidence: "medium",
    method: "declared",
    sourceId: "OFF-PT",
    sourceRecordId: "OFF-5601111100001",
    barcodes: ["5601111100001"],
    dietaryPatternTags: ["vegetariano"],
    mealContextTags: ["pequeno-almoco"],
  },
  {
    id: "pt-bolachas-maria",
    type: "packaged",
    namePt: "Bolachas Maria",
    nameEn: "Maria biscuits",
    status: "candidate",
    carb: 74,
    energyKcal: 430,
    confidence: "medium",
    method: "declared",
    sourceId: "OFF-PT",
    sourceRecordId: "OFF-5602222200002",
    barcodes: ["5602222200002"],
    dietaryPatternTags: ["vegetariano"],
    mealContextTags: ["lanche"],
  },
  {
    id: "pt-iogurte-morango",
    type: "packaged",
    namePt: "Iogurte de morango",
    nameEn: "Strawberry yoghurt",
    status: "candidate",
    carb: 15,
    energyKcal: 95,
    confidence: "low",
    method: "declared",
    sourceId: "OFF-PT",
    sourceRecordId: "OFF-5603333300003",
    barcodes: ["5603333300003"],
    dietaryPatternTags: ["vegetariano"],
    mealContextTags: ["lanche", "pequeno-almoco"],
  },
  {
    id: "pt-sopa-legumes",
    type: "restaurant",
    namePt: "Sopa de legumes",
    nameEn: "Vegetable soup",
    status: "candidate",
    carb: 6,
    energyKcal: 45,
    confidence: "low",
    method: "estimated",
    sourceId: "REST-PT",
    sourceRecordId: "REST-0007",
    cuisineTags: ["portuguesa"],
    dietaryPatternTags: ["vegano"],
    mealContextTags: ["almoco", "jantar"],
  },
  {
    id: "pt-pastel-nata",
    type: "restaurant",
    namePt: "Pastel de nata",
    nameEn: "Custard tart",
    status: "candidate",
    carb: 37,
    energyKcal: 298,
    confidence: "unverified",
    method: "estimated",
    sourceId: "REST-PT",
    sourceRecordId: "REST-0009",
    cuisineTags: ["portuguesa", "sobremesa"],
    mealContextTags: ["sobremesa", "lanche"],
    defect: "bad-digest",
  },
  {
    id: "pt-arroz-doce",
    type: "recipe",
    namePt: "Arroz doce",
    nameEn: "Rice pudding",
    status: "approved",
    carb: 24,
    energyKcal: 148,
    confidence: "medium",
    method: "calculated",
    sourceId: "COMM-PT",
    sourceRecordId: "COMM-0101",
    cuisineTags: ["portuguesa", "sobremesa"],
    dietaryPatternTags: ["vegetariano"],
    mealContextTags: ["sobremesa"],
  },
  {
    id: "pt-caldo-verde",
    type: "recipe",
    namePt: "Caldo verde",
    nameEn: "Kale and potato soup",
    status: "retired",
    carb: 8,
    energyKcal: 62,
    confidence: "medium",
    method: "calculated",
    sourceId: "COMM-PT",
    sourceRecordId: "COMM-0102",
    cuisineTags: ["portuguesa"],
    mealContextTags: ["jantar"],
  },
  {
    id: "pt-pao-caseiro",
    type: "custom",
    namePt: "Pão caseiro",
    nameEn: "Homemade bread",
    synonyms: ["pão da avó"],
    status: "candidate",
    carb: 49,
    energyKcal: 250,
    confidence: "unverified",
    method: "estimated",
    sourceId: "USER",
    sourceRecordId: "USER-2048",
    mealContextTags: ["pequeno-almoco", "lanche"],
    defect: "zero-basis",
  },
];

function buildSource(spec: FoodSpec): SourceReference {
  const meta = findSource(spec.sourceId);
  return {
    sourceId: spec.sourceId,
    sourceRecordId: spec.sourceRecordId,
    sourceVersion: "2026.1",
    market: meta?.market ?? "PT",
    licence: meta?.licence ?? "sintético — desconhecida",
    retrievedAt: "2026-06-30T00:00:00.000Z",
    effectiveAt: "2026-07-01T00:00:00.000Z",
    // Deliberately-broken digest for the "bad-digest" defect exercises the
    // integrity boundary check without breaking the TypeScript contract.
    rawSnapshotSha256: spec.defect === "bad-digest" ? "PENDENTE-VERIFICACAO" : syntheticDigest(spec.id),
    mappingVersion: "map-0.3",
  };
}

function buildNutrients(spec: FoodSpec, source: SourceReference): NutrientObservation[] {
  const base = {
    basisUnit: "g",
    method: spec.method,
    confidence: spec.confidence,
    source,
  } as const;
  return [
    {
      nutrientCode: NUTRIENT_CODE.carbohydrate,
      value: spec.carb,
      unit: "g",
      basisQuantity: 100,
      ...base,
    },
    {
      nutrientCode: NUTRIENT_CODE.energyKcal,
      value: spec.energyKcal,
      unit: "kcal",
      // "zero-basis" defect: a non-positive basis quantity is a type-valid
      // number that fails the runtime rule (basisQuantity must be > 0).
      basisQuantity: spec.defect === "zero-basis" ? 0 : 100,
      ...base,
    },
  ];
}

function pickPrimaryName(food: CanonicalFood): string {
  // `food` may originate from the untrusted API, so guard against a missing or
  // malformed `names` array rather than assuming the compile-time shape holds.
  const names = Array.isArray(food.names) ? food.names : [];
  const pt = names.find((entry) => entry?.language?.toLowerCase().startsWith("pt"));
  return pt?.name ?? names[0]?.name ?? "—";
}

function worstConfidence(nutrients: NutrientObservation[]): ConfidenceLevel {
  if (nutrients.length === 0) return "unverified";
  let worstIndex = 0;
  for (const nutrient of nutrients) {
    const index = CONFIDENCE_LEVELS.indexOf(nutrient.confidence);
    if (index > worstIndex) worstIndex = index;
  }
  return CONFIDENCE_LEVELS[worstIndex] ?? "unverified";
}

/**
 * Display-only placeholder used when a (malformed) record carries no usable
 * provenance, so the review table can still render a row instead of crashing.
 */
const UNKNOWN_SOURCE: SourceReference = {
  sourceId: "—",
  sourceRecordId: "—",
  sourceVersion: "—",
  licence: "—",
  retrievedAt: "—",
  rawSnapshotSha256: "—",
  mappingVersion: "—",
};

/** Primary provenance for a record: the source shared by its nutrient observations. */
function primarySource(nutrients: NutrientObservation[]): SourceReference {
  for (const nutrient of nutrients) {
    if (nutrient && typeof nutrient === "object" && nutrient.source) {
      return nutrient.source;
    }
  }
  return UNKNOWN_SOURCE;
}

function nutrientValue(nutrients: NutrientObservation[], code: string): number | null {
  const match = nutrients.find((nutrient) => nutrient.nutrientCode === code);
  return match ? match.value : null;
}

function computeDataQuality(
  isValid: boolean,
  confidence: ConfidenceLevel,
  nutrients: NutrientObservation[],
): DataQualityFlag {
  if (!isValid) return "invalid";
  const estimated = nutrients.some((nutrient) => nutrient.method === "estimated");
  if (confidence === "low" || confidence === "unverified" || estimated) return "warning";
  return "ok";
}

/**
 * Enrich a single canonical food (from the live API *or* the synthetic fallback)
 * into everything a curation row needs: boundary-validation result, worst-case
 * confidence, data-quality flag, display names and per-100 g values, plus the
 * resolved provenance. Every input is treated as untrusted — the record is
 * validated with `collectCanonicalFoodErrors` and the derived fields degrade
 * gracefully rather than throwing, so a page never crashes on a bad record.
 */
export function enrichCanonicalFood(food: CanonicalFood): CatalogFood {
  const nutrients = Array.isArray(food.nutrients) ? food.nutrients : [];
  const validationErrors = collectCanonicalFoodErrors(food);
  const isValid = validationErrors.length === 0;
  const confidence = worstConfidence(nutrients);
  const source = primarySource(nutrients);

  return {
    food,
    validationErrors,
    isValid,
    confidence,
    dataQuality: computeDataQuality(isValid, confidence, nutrients),
    primaryName: pickPrimaryName(food),
    carbPer100g: nutrientValue(nutrients, NUTRIENT_CODE.carbohydrate),
    energyKcalPer100g: nutrientValue(nutrients, NUTRIENT_CODE.energyKcal),
    source,
    sourceMeta: findSource(source.sourceId),
  };
}

function buildCatalogFood(spec: FoodSpec): CatalogFood {
  const source = buildSource(spec);
  const nutrients = buildNutrients(spec, source);
  const names = [
    { language: "pt-PT", name: spec.namePt, synonyms: spec.synonyms ?? [] },
    { language: "en", name: spec.nameEn, synonyms: [] },
  ];
  const food: CanonicalFood = {
    id: spec.id,
    type: spec.type,
    names,
    countries: ["PT"],
    markets: ["PT"],
    barcodes: spec.barcodes ?? [],
    cuisineTags: spec.cuisineTags ?? [],
    dietaryPatternTags: spec.dietaryPatternTags ?? [],
    mealContextTags: spec.mealContextTags ?? [],
    clinicalBehaviourTags: spec.clinicalBehaviourTags ?? [],
    nutrients,
    status: spec.status,
  };

  return enrichCanonicalFood(food);
}

/** The full synthetic curation catalog. */
export const CATALOG: CatalogFood[] = CATALOG_SPECS.map(buildCatalogFood);

/** Count of records per status, keyed by every known status (zero-filled). */
export function countByStatus(items: CatalogFood[] = CATALOG): Record<FoodStatus, number> {
  const counts = Object.fromEntries(FOOD_STATUSES.map((status) => [status, 0])) as Record<FoodStatus, number>;
  for (const item of items) counts[item.food.status] += 1;
  return counts;
}

/** Count of records per (worst-case) confidence, keyed by every known level. */
export function countByConfidence(items: CatalogFood[] = CATALOG): Record<ConfidenceLevel, number> {
  const counts = Object.fromEntries(CONFIDENCE_LEVELS.map((level) => [level, 0])) as Record<ConfidenceLevel, number>;
  for (const item of items) counts[item.confidence] += 1;
  return counts;
}

/** Number of records that fail boundary validation. */
export function countFailingValidation(items: CatalogFood[] = CATALOG): number {
  return items.filter((item) => !item.isValid).length;
}
