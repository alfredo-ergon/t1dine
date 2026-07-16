// Synthetic domain fixtures. NOT real source data and NOT redistributable.
// Used only for contract tests and downstream package tests. No health data.

import type { NutrientObservation, SourceReference } from "../index.js";

/** A synthetic source reference with a valid (all-zero) snapshot digest. */
export const syntheticSource: SourceReference = {
  sourceId: "SYNTH-INSA",
  sourceRecordId: "SYNTH-REC-0001",
  sourceVersion: "2026.1",
  market: "PT",
  licence: "synthetic-non-redistributable",
  retrievedAt: "2026-07-14T00:00:00.000Z",
  effectiveAt: "2026-01-01T00:00:00.000Z",
  rawSnapshotSha256: "0".repeat(64),
  mappingVersion: "map-0.1",
};

/** Available carbohydrate per 100 g, analytically determined, high confidence. */
export const syntheticCarbObservation: NutrientObservation = {
  nutrientCode: "CHOAVL",
  value: 28,
  unit: "g",
  basisQuantity: 100,
  basisUnit: "g",
  method: "analytical",
  confidence: "high",
  source: syntheticSource,
};

/** Energy per 100 g, declared on a label, medium confidence. */
export const syntheticEnergyObservation: NutrientObservation = {
  nutrientCode: "ENERC",
  value: 130,
  unit: "kcal",
  basisQuantity: 100,
  basisUnit: "g",
  method: "declared",
  confidence: "medium",
  source: syntheticSource,
};

/**
 * A micronutrient (iodine) per 100 g in micrograms — exercises the `µg` unit
 * added for national composition tables (INSA/PortFIR).
 */
export const syntheticMicronutrientObservation: NutrientObservation = {
  nutrientCode: "ID",
  value: 22,
  unit: "µg",
  basisQuantity: 100,
  basisUnit: "g",
  method: "analytical",
  confidence: "medium",
  source: syntheticSource,
};

/** A source reference carrying a mandatory attribution string (INSA-style). */
export const syntheticAttributedSource: SourceReference = {
  ...syntheticSource,
  sourceId: "INSA-PT",
  licence: "LICENCE_REVIEW_REQUIRED",
  attribution:
    "Fonte: Base de Dados da Composição de Alimentos. Instituto Nacional de Saúde Doutor Ricardo Jorge, I. P.- INSA. v 7.1 - 2026",
};
