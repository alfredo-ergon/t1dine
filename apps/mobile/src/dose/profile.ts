// Configurable dose profile — the clinical parameters a user sets up on their
// New Profile. Defaults match the annex the user provided (1 u / 50 g HC,
// 1 u / 50 mg/dL, target 100). These are settings, not a calculation.

export type GlucoseUnit = "mg/dL" | "mmol/L";

export interface DoseProfile {
  /** Insulin-to-carb ratio: grams of carbohydrate per 1 unit (default 50). */
  carbGramsPerUnit: number;
  /** Correction factor: glucose lowered per 1 unit, in `glucoseUnit` (default 50). */
  glucosePerCorrectionUnit: number;
  /** Correction target, in `glucoseUnit` (default 100). */
  targetGlucose: number;
  glucoseUnit: GlucoseUnit;
  /** Pen increment: 0.5 (half-unit) or 1 (whole-unit). */
  administrationIncrementUnits: number;
  /** Hard ceiling on the suggested dose. */
  maximumEstimateUnits: number;
  /** Hypoglycaemia guard: at or below this glucose no dose is suggested. */
  minimumGlucoseToDose: number;
  /** Bumped whenever the profile changes, for the calculation audit record. */
  version: string;
}

export const DEFAULT_DOSE_PROFILE: DoseProfile = {
  carbGramsPerUnit: 50,
  glucosePerCorrectionUnit: 50,
  targetGlucose: 100,
  glucoseUnit: "mg/dL",
  administrationIncrementUnits: 0.5,
  maximumEstimateUnits: 25,
  minimumGlucoseToDose: 70,
  version: "profile-1",
};
