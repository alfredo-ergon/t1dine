// Pure meal mathematics shared by the mobile app and API.
// Scales per-basis nutrient observations by an amount and aggregates a meal.
// Deterministic, dependency-free (types only), no rounding surprises.
//
// This package must never be imported by, or import, the dose engine — it
// computes food nutrition, not insulin. It has no clinical authority.

import type { NutrientObservation } from "@t1dine/domain";
import type { CanonicalFood } from "@t1dine/food-schema";

export type Confidence = NutrientObservation["confidence"];

// Weakest-first, so aggregating a meal takes the minimum.
export const CONFIDENCE_ORDER: readonly Confidence[] = ["unverified", "low", "medium", "high"];

export const CARBOHYDRATE_CODE = "CHOAVL";
export const ENERGY_CODE = "ENERC";

export interface MealLine {
  food: CanonicalFood;
  /** Amount consumed, in grams or millilitres to match the food's basis. */
  amount: number;
}

export interface MealLineSummary {
  food: CanonicalFood;
  amount: number;
  carbGrams: number;
  energyKcal: number;
  confidence: Confidence;
}

export interface MealSummary {
  lines: MealLineSummary[];
  itemCount: number;
  totalCarbGrams: number;
  totalEnergyKcal: number;
  aggregateConfidence: Confidence;
  hasUncertainty: boolean;
}

export function findNutrient(food: CanonicalFood, code: string): NutrientObservation | undefined {
  return food.nutrients.find((n) => n.nutrientCode === code);
}

/**
 * Scale an observation to a consumed amount. Only mass/volume bases (g/ml) can
 * be scaled by a raw amount; a per-serving basis needs a gram weight we do not
 * yet model, so it returns null rather than guessing.
 */
export function scaleNutrient(observation: NutrientObservation, amount: number): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (observation.basisUnit !== "g" && observation.basisUnit !== "ml") return null;
  if (!(observation.basisQuantity > 0)) return null;
  return (amount / observation.basisQuantity) * observation.value;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function weakestConfidence(confidences: Confidence[]): Confidence {
  if (confidences.length === 0) return "high";
  return confidences.reduce((weakest, current) =>
    CONFIDENCE_ORDER.indexOf(current) < CONFIDENCE_ORDER.indexOf(weakest) ? current : weakest,
  );
}

export function summariseMeal(lines: MealLine[]): MealSummary {
  const lineSummaries: MealLineSummary[] = lines.map((line) => {
    const carbObs = findNutrient(line.food, CARBOHYDRATE_CODE);
    const energyObs = findNutrient(line.food, ENERGY_CODE);
    const carbGrams = carbObs ? scaleNutrient(carbObs, line.amount) ?? 0 : 0;
    const energyKcal = energyObs ? scaleNutrient(energyObs, line.amount) ?? 0 : 0;
    return {
      food: line.food,
      amount: line.amount,
      carbGrams,
      energyKcal,
      confidence: carbObs?.confidence ?? "unverified",
    };
  });

  const totalCarbGrams = round1(lineSummaries.reduce((sum, l) => sum + l.carbGrams, 0));
  const totalEnergyKcal = Math.round(lineSummaries.reduce((sum, l) => sum + l.energyKcal, 0));
  const aggregateConfidence = weakestConfidence(lineSummaries.map((l) => l.confidence));

  return {
    lines: lineSummaries,
    itemCount: lineSummaries.length,
    totalCarbGrams,
    totalEnergyKcal,
    aggregateConfidence,
    hasUncertainty: lineSummaries.length > 0 && aggregateConfidence !== "high",
  };
}
