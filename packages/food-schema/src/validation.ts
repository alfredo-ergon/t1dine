// Runtime boundary validators for the canonical food contract.
//
// Reuses the domain nutrient validator at runtime so that provenance/quality
// rules are enforced consistently across packages (this cross-package runtime
// import is intentional and is exercised by the tests).

import { collectNutrientObservationErrors } from "@t1dine/domain";
import type { CanonicalFood } from "./index.js";

export const FOOD_TYPES = ["ingredient", "packaged", "restaurant", "recipe", "custom"] as const;
export const FOOD_STATUSES = ["candidate", "approved", "retired"] as const;
export const PREPARATION_STATES = [
  "raw",
  "cooked",
  "roasted",
  "fried",
  "grilled",
  "stewed",
  "dried",
  "candied",
  "preserved",
  "reconstituted",
  "unknown",
] as const;

export type FoodTypeName = (typeof FOOD_TYPES)[number];
export type FoodStatus = (typeof FOOD_STATUSES)[number];
export type PreparationStateName = (typeof PREPARATION_STATES)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function oneOf<T extends readonly string[]>(allowed: T, value: unknown): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

export function collectFoodGroupErrors(value: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return [`${path} must be an object`];
  }
  if (!isNonEmptyString(value.level1)) errors.push(`${path}.level1 must be a non-empty string`);
  if (value.level2 !== undefined && !isNonEmptyString(value.level2)) {
    errors.push(`${path}.level2, when present, must be a non-empty string`);
  }
  if (value.level3 !== undefined && !isNonEmptyString(value.level3)) {
    errors.push(`${path}.level3, when present, must be a non-empty string`);
  }
  if (value.code !== undefined && !isNonEmptyString(value.code)) {
    errors.push(`${path}.code, when present, must be a non-empty string`);
  }
  return errors;
}

export function collectLocalisedNameErrors(value: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return [`${path} must be an object`];
  }
  if (!isNonEmptyString(value.language)) errors.push(`${path}.language must be a non-empty BCP-47 tag`);
  if (!isNonEmptyString(value.name)) errors.push(`${path}.name must be a non-empty string`);
  if (!isStringArray(value.synonyms)) errors.push(`${path}.synonyms must be an array of strings`);
  return errors;
}

export function collectCanonicalFoodErrors(value: unknown, path = "food"): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return [`${path} must be an object`];
  }
  if (!isNonEmptyString(value.id)) errors.push(`${path}.id must be a non-empty string`);
  if (!oneOf(FOOD_TYPES, value.type)) errors.push(`${path}.type must be one of ${FOOD_TYPES.join(", ")}`);
  if (!oneOf(FOOD_STATUSES, value.status)) errors.push(`${path}.status must be one of ${FOOD_STATUSES.join(", ")}`);

  if (!Array.isArray(value.names) || value.names.length === 0) {
    errors.push(`${path}.names must be a non-empty array of localised names`);
  } else {
    value.names.forEach((name, i) => errors.push(...collectLocalisedNameErrors(name, `${path}.names[${i}]`)));
  }

  if (!isStringArray(value.countries)) errors.push(`${path}.countries must be an array of ISO country codes`);
  if (!isStringArray(value.markets)) errors.push(`${path}.markets must be an array of ISO country codes`);
  if (!isStringArray(value.barcodes)) errors.push(`${path}.barcodes must be an array of strings`);
  if (!isStringArray(value.cuisineTags)) errors.push(`${path}.cuisineTags must be an array of strings`);
  if (!isStringArray(value.dietaryPatternTags)) errors.push(`${path}.dietaryPatternTags must be an array of strings`);
  if (!isStringArray(value.mealContextTags)) errors.push(`${path}.mealContextTags must be an array of strings`);
  if (!isStringArray(value.clinicalBehaviourTags)) errors.push(`${path}.clinicalBehaviourTags must be an array of strings`);

  if (!Array.isArray(value.nutrients) || value.nutrients.length === 0) {
    errors.push(`${path}.nutrients must be a non-empty array of nutrient observations`);
  } else {
    value.nutrients.forEach((nutrient, i) =>
      errors.push(...collectNutrientObservationErrors(nutrient, `${path}.nutrients[${i}]`)),
    );
  }

  // Optional, additive fields — only validated when present (never required so
  // the existing synthetic catalog stays valid).
  if (value.preparationState !== undefined && !oneOf(PREPARATION_STATES, value.preparationState)) {
    errors.push(`${path}.preparationState, when present, must be one of ${PREPARATION_STATES.join(", ")}`);
  }
  if (value.foodGroup !== undefined) {
    errors.push(...collectFoodGroupErrors(value.foodGroup, `${path}.foodGroup`));
  }
  if (value.ediblePortion !== undefined && !(isFiniteNumber(value.ediblePortion) && value.ediblePortion > 0 && value.ediblePortion <= 1)) {
    errors.push(`${path}.ediblePortion, when present, must be a number in (0, 1]`);
  }
  if (value.density !== undefined && !(isFiniteNumber(value.density) && value.density > 0)) {
    errors.push(`${path}.density, when present, must be a number greater than 0`);
  }

  return errors;
}

export function isCanonicalFood(value: unknown): value is CanonicalFood {
  return collectCanonicalFoodErrors(value).length === 0;
}

export function assertCanonicalFood(value: unknown): asserts value is CanonicalFood {
  const errors = collectCanonicalFoodErrors(value);
  if (errors.length > 0) {
    throw new Error(`Invalid CanonicalFood: ${errors.join("; ")}`);
  }
}
