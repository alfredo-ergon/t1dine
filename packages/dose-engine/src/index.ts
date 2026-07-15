// T1Dine Dose Assist — deterministic insulin-dose ESTIMATE engine.
//
// UNRELEASED. This computes an estimate, never an imperative instruction, and
// is not a clinically validated medical device. It is pure and deterministic:
// no AI, no network, no persistence, no analytics (enforced by ADR-0003 and the
// dependency-cruiser isolation guard). Every change here requires tests, a
// hazard review, traceability, and a version bump (clinical-safety rules).
//
// Formula (configured per user profile):
//   meal units       = carbohydrateGrams / carbGramsPerUnit          (e.g. HC ÷ 50)
//   correction units = (glucose - target) / glucosePerCorrectionUnit (e.g. (glicemia - 100) ÷ 50)
//   total            = meal + correction - activeInsulin
//   dose             = total rounded to the pen increment (0.5 or 1)
// It fails CLOSED: any missing, out-of-range, contradictory, or unsafe input
// (including low glucose / hypoglycaemia) yields a "blocked" result with
// explicit reasons and NO number.

export const ALGORITHM_VERSION = "unreleased-0.2" as const;

export type GlucoseUnit = "mg/dL" | "mmol/L";

/** Physiologically plausible bounds per unit; correction target must sit in the target band. */
const GLUCOSE_BOUNDS: Record<GlucoseUnit, { min: number; max: number; targetMin: number; targetMax: number }> = {
  "mg/dL": { min: 20, max: 600, targetMin: 70, targetMax: 200 },
  "mmol/L": { min: 1.1, max: 33.3, targetMin: 3.9, targetMax: 11 },
};

/** Upper plausibility bound for a single meal's carbohydrate (grams). */
const MAX_PLAUSIBLE_CARB_GRAMS = 500;

export interface DoseEstimateInput {
  /** Confirmed available carbohydrate for the meal, in grams. */
  confirmedCarbohydrateGrams: number;
  /** Current blood glucose, in `glucoseUnit`. */
  glucoseValue: number;
  glucoseUnit: GlucoseUnit;
  /** ISO-8601. When the glucose was measured, and when this calculation runs. */
  glucoseMeasuredAt: string;
  calculatedAt: string;
  /** Correction target, SAME unit as glucoseValue. */
  targetGlucose: number;
  /** Insulin-to-carb ratio: grams of carbohydrate covered by one unit (e.g. 50). */
  carbGramsPerUnit: number;
  /** Correction factor: glucose (in glucoseUnit) lowered by one unit (e.g. 50 mg/dL). */
  glucosePerCorrectionUnit: number;
  /** Active insulin on board, in units. MUST be provided (null fails closed). */
  activeInsulinUnits: number | null;
  /** Pen increment: 0.5 (half-unit pen) or 1 (whole-unit pen). */
  administrationIncrementUnits: number;
  /** Hard ceiling; a computed dose above this fails closed. */
  maximumEstimateUnits: number;
  /** Hypoglycaemia guard: at or below this glucose the engine refuses to dose. */
  minimumGlucoseToDose: number;
  /** Non-empty profile version string, for the audit record. */
  profileVersion: string;
}

export interface DoseEstimateInputsEcho {
  confirmedCarbohydrateGrams: number;
  glucoseValue: number;
  glucoseUnit: GlucoseUnit;
  targetGlucose: number;
  carbGramsPerUnit: number;
  glucosePerCorrectionUnit: number;
  activeInsulinUnits: number;
  administrationIncrementUnits: number;
  maximumEstimateUnits: number;
}

export type DoseEstimateResult =
  | { status: "blocked"; algorithmVersion: string; reasons: string[] }
  | {
      status: "estimate";
      algorithmVersion: string;
      /** Echo of the inputs actually used, for a complete audit record. */
      inputs: DoseEstimateInputsEcho;
      mealComponentUnits: number;
      correctionComponentUnits: number;
      activeInsulinUnits: number;
      unroundedUnits: number;
      roundedUnits: number;
      /** Human-readable rounding rule applied, for the record. */
      roundingRule: string;
      calculatedAt: string;
      profileVersion: string;
    };

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function roundToIncrement(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

export function calculateDoseEstimate(input: DoseEstimateInput): DoseEstimateResult {
  const reasons: string[] = [];

  // --- Profile / configuration validity ---
  if (!isFinitePositive(input.carbGramsPerUnit)) reasons.push("invalid-carb-ratio");
  if (!isFinitePositive(input.glucosePerCorrectionUnit)) reasons.push("invalid-correction-factor");
  if (!isFinitePositive(input.administrationIncrementUnits)) reasons.push("invalid-administration-increment");
  if (!isFinitePositive(input.maximumEstimateUnits)) reasons.push("invalid-maximum-estimate");
  if (!input.profileVersion.trim()) reasons.push("missing-profile-version");

  // --- Unit + range validity ---
  const bounds = GLUCOSE_BOUNDS[input.glucoseUnit];
  if (!bounds) reasons.push("invalid-glucose-unit");

  // --- Carbohydrate plausibility ---
  if (!isFiniteNumber(input.confirmedCarbohydrateGrams) || input.confirmedCarbohydrateGrams < 0) {
    reasons.push("invalid-carbohydrate");
  } else if (input.confirmedCarbohydrateGrams > MAX_PLAUSIBLE_CARB_GRAMS) {
    reasons.push("carbohydrate-implausible");
  }

  // --- Active insulin: required, never silently zeroed ---
  if (input.activeInsulinUnits === null || !isFiniteNumber(input.activeInsulinUnits) || input.activeInsulinUnits < 0) {
    reasons.push("active-insulin-unknown-or-invalid");
  }

  // --- Timestamps + freshness (no future-dated glucose) ---
  const measuredAt = Date.parse(input.glucoseMeasuredAt);
  const calculatedAt = Date.parse(input.calculatedAt);
  if (Number.isNaN(measuredAt) || Number.isNaN(calculatedAt)) {
    reasons.push("invalid-timestamp");
  } else if (measuredAt > calculatedAt) {
    reasons.push("glucose-timestamp-in-future");
  }

  // --- Glucose value + target, validated against the unit's plausible band ---
  if (bounds) {
    if (!isFiniteNumber(input.glucoseValue) || input.glucoseValue < bounds.min || input.glucoseValue > bounds.max) {
      reasons.push("glucose-out-of-plausible-range");
    }
    if (!isFiniteNumber(input.targetGlucose) || input.targetGlucose < bounds.targetMin || input.targetGlucose > bounds.targetMax) {
      reasons.push("invalid-target-glucose");
    }
    if (!isFiniteNumber(input.minimumGlucoseToDose) || input.minimumGlucoseToDose < bounds.min || input.minimumGlucoseToDose > bounds.max) {
      reasons.push("invalid-hypo-threshold");
    }
  }

  // --- HYPOGLYCAEMIA GUARD (fail closed; treat the low first) ---
  // Evaluated only when glucose + threshold are themselves valid, so a real low
  // is reported as a hypo — not masked by a range error.
  if (
    isFiniteNumber(input.glucoseValue) &&
    isFiniteNumber(input.minimumGlucoseToDose) &&
    input.glucoseValue <= input.minimumGlucoseToDose
  ) {
    reasons.push("glucose-below-safe-threshold");
  }

  if (reasons.length > 0) {
    return { status: "blocked", algorithmVersion: ALGORITHM_VERSION, reasons };
  }

  // All inputs validated: activeInsulinUnits is non-null past this point.
  const activeInsulinUnits = input.activeInsulinUnits as number;

  const mealComponentUnits = input.confirmedCarbohydrateGrams / input.carbGramsPerUnit;
  const correctionComponentUnits = (input.glucoseValue - input.targetGlucose) / input.glucosePerCorrectionUnit;
  const unroundedUnits = mealComponentUnits + correctionComponentUnits - activeInsulinUnits;

  if (!Number.isFinite(unroundedUnits)) {
    return { status: "blocked", algorithmVersion: ALGORITHM_VERSION, reasons: ["calculated-value-not-finite"] };
  }
  if (unroundedUnits < 0) {
    return { status: "blocked", algorithmVersion: ALGORITHM_VERSION, reasons: ["calculated-value-below-zero"] };
  }

  const roundedUnits = roundToIncrement(unroundedUnits, input.administrationIncrementUnits);

  // Re-assert the ceiling AFTER rounding (rounding up must never exceed the max).
  if (roundedUnits > input.maximumEstimateUnits) {
    return { status: "blocked", algorithmVersion: ALGORITHM_VERSION, reasons: ["calculated-value-exceeds-maximum"] };
  }

  return {
    status: "estimate",
    algorithmVersion: ALGORITHM_VERSION,
    inputs: {
      confirmedCarbohydrateGrams: input.confirmedCarbohydrateGrams,
      glucoseValue: input.glucoseValue,
      glucoseUnit: input.glucoseUnit,
      targetGlucose: input.targetGlucose,
      carbGramsPerUnit: input.carbGramsPerUnit,
      glucosePerCorrectionUnit: input.glucosePerCorrectionUnit,
      activeInsulinUnits,
      administrationIncrementUnits: input.administrationIncrementUnits,
      maximumEstimateUnits: input.maximumEstimateUnits,
    },
    mealComponentUnits,
    correctionComponentUnits,
    activeInsulinUnits,
    unroundedUnits,
    roundedUnits,
    roundingRule: `round-to-nearest ${input.administrationIncrementUnits} unit`,
    calculatedAt: input.calculatedAt,
    profileVersion: input.profileVersion,
  };
}
