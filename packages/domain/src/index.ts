export type IsoCountryCode = string;
export type Bcp47LanguageTag = string;
export type FoodId = string;

export interface SourceReference {
  sourceId: string;
  sourceRecordId: string;
  sourceVersion: string;
  market?: IsoCountryCode;
  licence: string;
  retrievedAt: string;
  effectiveAt?: string;
  rawSnapshotSha256: string;
  mappingVersion: string;
}

export interface NutrientObservation {
  nutrientCode: string;
  value: number;
  unit: "g" | "mg" | "kcal" | "kJ";
  basisQuantity: number;
  basisUnit: "g" | "ml" | "serving";
  method: "analytical" | "declared" | "calculated" | "estimated";
  confidence: "high" | "medium" | "low" | "unverified";
  source: SourceReference;
}

export * from "./validation.js";
