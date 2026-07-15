// Builder for INSA-sourced Portuguese food records (real analytical composition
// per 100 g). Unlike the synthetic `food()` builder in `../catalog.ts`, these
// carry INSA/PortFIR provenance — the data is the Base de Dados da Composição de
// Alimentos (BDCA) v7.1 (2026) published by the Instituto Nacional de Saúde
// Doutor Ricardo Jorge (INSA).
//
// ATTRIBUTION (required by INSA's terms — must stay visible wherever the data is
// shown; the app renders `source.sourceId`/`sourceVersion` on the food detail):
//   Fonte: Base de Dados da Composição de Alimentos. Instituto Nacional de Saúde
//   Doutor Ricardo Jorge, I. P. - INSA. v 7.1 - 2026.  https://portfir.insa.min-saude.pt/
// See docs/data/insa_attribution.md. The raw source workbook is NOT committed
// (see .gitignore); only these derived per-100 g values are, with attribution.
//
// `portugalInsa.ts` is GENERATED from the workbook (compact tuples) and maps
// each tuple through `buildInsaFood`; this module owns the provenance/shape so
// the generated file stays pure data.

import { createHash } from "node:crypto";
import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import type { CanonicalFood } from "@t1dine/food-schema";

/** Compact INSA row: [code, namePt, carbGramsPer100g, energyKcalPer100g]. */
export type InsaRow = [string, string, number, number];

const INSA_SOURCE_VERSION = "BDCA v7.1 (2026)";

/** Deterministic stand-in for a per-record raw-snapshot digest (no raw bytes committed). */
function insaSnapshotHash(code: string): string {
  return createHash("sha256").update(`insa-bdca-7.1-2026:${code}`).digest("hex");
}

function insaSource(code: string): SourceReference {
  return {
    sourceId: "INSA-BDCA",
    sourceRecordId: `INSA-${code}`,
    sourceVersion: INSA_SOURCE_VERSION,
    market: "PT",
    // INSA/PortFIR terms: free use with mandatory, visible source attribution.
    licence: "insa-portfir-attribution",
    retrievedAt: "2026-07-16T00:00:00.000Z",
    rawSnapshotSha256: insaSnapshotHash(code),
    mappingVersion: "insa-map-1.0",
  };
}

/**
 * Map one INSA composition row to a CanonicalFood. Values are analytically
 * determined by INSA, so `method: "analytical"` / `confidence: "high"`.
 * English name mirrors the Portuguese name for now (INSA is PT-only; a proper
 * EN localisation is a later, separate task — tracked, not silently invented).
 */
export function buildInsaFood(row: InsaRow): CanonicalFood {
  const [code, name, carbGrams, energyKcal] = row;
  const source = insaSource(code);
  const nutrients: NutrientObservation[] = [
    { nutrientCode: "CHOAVL", value: carbGrams, unit: "g", basisQuantity: 100, basisUnit: "g", method: "analytical", confidence: "high", source },
    { nutrientCode: "ENERC", value: energyKcal, unit: "kcal", basisQuantity: 100, basisUnit: "g", method: "analytical", confidence: "high", source },
  ];
  return {
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
  };
}
