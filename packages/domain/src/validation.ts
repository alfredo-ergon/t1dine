// Runtime boundary validators for the domain contracts.
//
// The interfaces in `index.ts` are compile-time only. Per CLAUDE.md ("All
// external data is untrusted. Validate at boundaries.") these pure, dependency
// -free validators turn each contract into something executable and testable.
// They return a list of human-readable errors (empty === valid) so callers can
// surface precise provenance/quality problems rather than a single boolean.

import type { NutrientObservation, SourceReference } from "./index.js";

export const NUTRIENT_UNITS = ["g", "mg", "kcal", "kJ"] as const;
export const BASIS_UNITS = ["g", "ml", "serving"] as const;
export const NUTRIENT_METHODS = ["analytical", "declared", "calculated", "estimated"] as const;
export const CONFIDENCE_LEVELS = ["high", "medium", "low", "unverified"] as const;

export type NutrientUnit = (typeof NUTRIENT_UNITS)[number];
export type BasisUnit = (typeof BASIS_UNITS)[number];
export type NutrientMethod = (typeof NUTRIENT_METHODS)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

const SHA256_HEX = /^[0-9a-f]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function oneOf<T extends readonly string[]>(allowed: T, value: unknown): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

export function collectSourceReferenceErrors(value: unknown, path = "source"): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return [`${path} must be an object`];
  }
  if (!isNonEmptyString(value.sourceId)) errors.push(`${path}.sourceId must be a non-empty string`);
  if (!isNonEmptyString(value.sourceRecordId)) errors.push(`${path}.sourceRecordId must be a non-empty string`);
  if (!isNonEmptyString(value.sourceVersion)) errors.push(`${path}.sourceVersion must be a non-empty string`);
  if (!isNonEmptyString(value.licence)) errors.push(`${path}.licence must be a non-empty string`);
  if (!isIsoTimestamp(value.retrievedAt)) errors.push(`${path}.retrievedAt must be an ISO-8601 timestamp`);
  if (!isNonEmptyString(value.rawSnapshotSha256) || !SHA256_HEX.test(value.rawSnapshotSha256 as string)) {
    errors.push(`${path}.rawSnapshotSha256 must be a 64-character hex SHA-256 digest`);
  }
  if (!isNonEmptyString(value.mappingVersion)) errors.push(`${path}.mappingVersion must be a non-empty string`);
  if (value.market !== undefined && !isNonEmptyString(value.market)) {
    errors.push(`${path}.market, when present, must be a non-empty ISO country code`);
  }
  if (value.effectiveAt !== undefined && !isIsoTimestamp(value.effectiveAt)) {
    errors.push(`${path}.effectiveAt, when present, must be an ISO-8601 timestamp`);
  }
  return errors;
}

export function isSourceReference(value: unknown): value is SourceReference {
  return collectSourceReferenceErrors(value).length === 0;
}

export function collectNutrientObservationErrors(value: unknown, path = "nutrient"): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return [`${path} must be an object`];
  }
  if (!isNonEmptyString(value.nutrientCode)) errors.push(`${path}.nutrientCode must be a non-empty string`);
  if (!isFiniteNumber(value.value)) errors.push(`${path}.value must be a finite number`);
  if (!oneOf(NUTRIENT_UNITS, value.unit)) errors.push(`${path}.unit must be one of ${NUTRIENT_UNITS.join(", ")}`);
  if (!isFiniteNumber(value.basisQuantity) || value.basisQuantity <= 0) {
    errors.push(`${path}.basisQuantity must be a finite number greater than 0`);
  }
  if (!oneOf(BASIS_UNITS, value.basisUnit)) errors.push(`${path}.basisUnit must be one of ${BASIS_UNITS.join(", ")}`);
  if (!oneOf(NUTRIENT_METHODS, value.method)) errors.push(`${path}.method must be one of ${NUTRIENT_METHODS.join(", ")}`);
  if (!oneOf(CONFIDENCE_LEVELS, value.confidence)) {
    errors.push(`${path}.confidence must be one of ${CONFIDENCE_LEVELS.join(", ")}`);
  }
  errors.push(...collectSourceReferenceErrors(value.source, `${path}.source`));
  return errors;
}

export function isNutrientObservation(value: unknown): value is NutrientObservation {
  return collectNutrientObservationErrors(value).length === 0;
}

export function assertNutrientObservation(value: unknown): asserts value is NutrientObservation {
  const errors = collectNutrientObservationErrors(value);
  if (errors.length > 0) {
    throw new Error(`Invalid NutrientObservation: ${errors.join("; ")}`);
  }
}
