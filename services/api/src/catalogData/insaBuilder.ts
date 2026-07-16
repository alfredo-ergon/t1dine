// Builder for INSA-sourced Portuguese food records (real analytical composition
// per 100 g, or per 100 ml for alcoholic beverages). Unlike the synthetic
// `food()` builder in `../catalog.ts`, these carry INSA/PortFIR provenance — the
// data is the Base de Dados da Composição de Alimentos (BDCA) v7.1 (2026)
// published by the Instituto Nacional de Saúde Doutor Ricardo Jorge (INSA).
//
// ATTRIBUTION (required by INSA's terms — must stay visible wherever the data is
// shown; the app renders `source.sourceId`/`sourceVersion`/`source.attribution`
// on the food detail):
//   Fonte: Base de Dados da Composição de Alimentos. Instituto Nacional de Saúde
//   Doutor Ricardo Jorge, I. P.- INSA. v 7.1 - 2026.  https://portfir.insa.min-saude.pt/
// See docs/data/insa_attribution.md and docs/data/portfir-source-governance.md.
// The raw source workbook is NOT committed (see .gitignore); only these derived
// per-basis values are, with attribution.
//
// `portugalInsa.ts` is GENERATED from the workbook by the ingestion adapter
// (`services/food-ingestion/food_ingestion/portfir`). This module owns the
// provenance/shape so the generated file stays pure data. The generated file
// pins the nutrient column order it used; `buildInsaCatalog` asserts that order
// still matches the canonical dictionary, so a dictionary reordering fails loud
// rather than silently misaligning values.

import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import type { CanonicalFood, FoodGroup, PreparationState } from "@t1dine/food-schema";
import { defaultConfidence, NUTRIENT_DEFINITIONS, NUTRIENTS } from "@t1dine/food-schema";

/**
 * One INSA food as compact generated data:
 * `[code, namePt, level1, level2, level3|null, preparationState|null, basisUnit, values]`
 * where `values[i]` corresponds to the nutrient code at index `i` of the
 * generated nutrient order (see `buildInsaCatalog`); `null` means the source did
 * not report that nutrient (missing / not analysed) — never coerced to zero.
 */
export type InsaRow = [
  string,
  string,
  string,
  string,
  string | null,
  PreparationState | null,
  "g" | "ml",
  (number | null)[],
];

const INSA_SOURCE_VERSION = "BDCA v7.1 (2026)";
const INSA_MAPPING_VERSION = "insa-map-2.0";
// SHA-256 of the immutable source workbook (docs/data/insa_tca.xlsx, git-ignored).
const INSA_SNAPSHOT_SHA256 = "bc51a2c136801b83c2f2566d303accb679b1ad679ee09f80cc7fb751074465eb";
const INSA_ATTRIBUTION =
  "Fonte: Base de Dados da Composição de Alimentos. Instituto Nacional de Saúde Doutor Ricardo Jorge, I. P.- INSA. v 7.1 - 2026";

/** Canonical nutrient column order this module expects (from the dictionary). */
const CANONICAL_ORDER = NUTRIENT_DEFINITIONS.map((d) => d.code);

function insaSource(code: string): SourceReference {
  return {
    sourceId: "INSA-BDCA",
    sourceRecordId: `INSA-${code}`,
    sourceVersion: INSA_SOURCE_VERSION,
    market: "PT",
    // INSA/PortFIR terms: use permitted with mandatory, visible source attribution.
    licence: "insa-portfir-attribution",
    attribution: INSA_ATTRIBUTION,
    retrievedAt: "2026-07-16T00:00:00.000Z",
    rawSnapshotSha256: INSA_SNAPSHOT_SHA256,
    mappingVersion: INSA_MAPPING_VERSION,
  };
}

/** Accent-insensitive slug for a food-group label (search facet code). */
function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Map one INSA record to a CanonicalFood, given the nutrient `order` the values
 * were generated against. Values are analytically determined by INSA, so
 * `method: "analytical"`; confidence is unit-derived (macros high, micronutrients
 * medium — see `defaultConfidence`). English name mirrors the Portuguese name
 * for now (INSA is PT-only; a proper EN localisation is a later, separate task —
 * tracked, not silently invented).
 */
export function buildInsaFood(row: InsaRow, order: readonly string[]): CanonicalFood {
  const [code, name, level1, level2, level3, prep, basisUnit, values] = row;
  if (values.length !== order.length) {
    throw new Error(`INSA row ${code}: ${values.length} values for ${order.length} nutrient columns`);
  }
  const source = insaSource(code);
  const nutrients: NutrientObservation[] = [];
  for (let i = 0; i < order.length; i += 1) {
    const value = values[i];
    if (value === null || value === undefined) continue; // missing — never emit 0
    const nutrientCode = order[i]!;
    const def = NUTRIENTS[nutrientCode];
    if (!def) throw new Error(`INSA row ${code}: unknown nutrient code "${nutrientCode}"`);
    nutrients.push({
      nutrientCode,
      value,
      unit: def.unit,
      basisQuantity: 100,
      basisUnit,
      method: "analytical",
      confidence: defaultConfidence(def.unit),
      source,
    });
  }

  const foodGroup: FoodGroup = { level1, level2, code: slug(level1) };
  if (level3) foodGroup.level3 = level3;

  const food: CanonicalFood = {
    id: `pt-insa-${code}`,
    type: "ingredient",
    names: [
      { language: "pt-PT", name, synonyms: [] },
      { language: "en", name, synonyms: [] },
    ],
    countries: ["PT"],
    markets: ["PT"],
    barcodes: [],
    cuisineTags: ["portuguese"],
    dietaryPatternTags: [],
    mealContextTags: [],
    clinicalBehaviourTags: [],
    nutrients,
    status: "approved",
    foodGroup,
  };
  if (prep) food.preparationState = prep;
  return food;
}

/**
 * Build the full INSA catalogue from generated rows. `generatedOrder` is the
 * nutrient column order the generator emitted values in; it MUST still equal the
 * canonical dictionary order, otherwise values would misalign with codes — we
 * fail closed if it has drifted.
 */
export function buildInsaCatalog(rows: InsaRow[], generatedOrder: readonly string[]): CanonicalFood[] {
  if (
    generatedOrder.length !== CANONICAL_ORDER.length ||
    generatedOrder.some((code, i) => code !== CANONICAL_ORDER[i])
  ) {
    throw new Error(
      "INSA generated nutrient order no longer matches @t1dine/food-schema NUTRIENT_DEFINITIONS — regenerate portugalInsa.ts",
    );
  }
  return rows.map((row) => buildInsaFood(row, generatedOrder));
}
