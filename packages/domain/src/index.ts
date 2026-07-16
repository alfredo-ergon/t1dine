export type IsoCountryCode = string;
export type Bcp47LanguageTag = string;
export type FoodId = string;

export interface SourceReference {
  sourceId: string;
  sourceRecordId: string;
  sourceVersion: string;
  market?: IsoCountryCode;
  licence: string;
  /**
   * Human-readable attribution string a source requires to be displayed
   * wherever its data appears (e.g. INSA/PortFIR mandates a visible citation).
   * Optional — most synthetic/legacy records have none — but when a licence
   * imposes an attribution obligation it MUST be carried here and surfaced in
   * the UI (see docs/data/canonical-food-schema.md "licence and attribution").
   */
  attribution?: string;
  retrievedAt: string;
  effectiveAt?: string;
  rawSnapshotSha256: string;
  mappingVersion: string;
}

export interface NutrientObservation {
  nutrientCode: string;
  value: number;
  // "µg" (micro sign, U+00B5) is required for national composition tables
  // (INSA/PortFIR) that report micronutrients in micrograms.
  unit: "g" | "mg" | "µg" | "kcal" | "kJ";
  basisQuantity: number;
  basisUnit: "g" | "ml" | "serving";
  method: "analytical" | "declared" | "calculated" | "estimated";
  confidence: "high" | "medium" | "low" | "unverified";
  source: SourceReference;
}

export * from "./validation.js";
