import { describe, expect, it } from "vitest";
import {
  assertNutrientObservation,
  collectNutrientObservationErrors,
  isNutrientObservation,
  isSourceReference,
} from "@t1dine/domain";
import { syntheticCarbObservation, syntheticEnergyObservation, syntheticSource } from "../src/fixtures/index";

describe("SourceReference validation", () => {
  it("accepts a well-formed synthetic source", () => {
    expect(isSourceReference(syntheticSource)).toBe(true);
  });

  it("rejects a non-hex snapshot digest", () => {
    const bad = { ...syntheticSource, rawSnapshotSha256: "not-a-real-digest" };
    expect(isSourceReference(bad)).toBe(false);
  });

  it("rejects a missing licence (provenance must be preserved)", () => {
    const withoutLicence: Record<string, unknown> = { ...syntheticSource };
    delete withoutLicence.licence;
    expect(isSourceReference(withoutLicence)).toBe(false);
  });
});

describe("NutrientObservation validation", () => {
  it("accepts the valid synthetic fixtures", () => {
    expect(isNutrientObservation(syntheticCarbObservation)).toBe(true);
    expect(isNutrientObservation(syntheticEnergyObservation)).toBe(true);
    expect(collectNutrientObservationErrors(syntheticCarbObservation)).toEqual([]);
  });

  it("rejects a non-positive basis quantity", () => {
    const bad = { ...syntheticCarbObservation, basisQuantity: 0 };
    expect(isNutrientObservation(bad)).toBe(false);
    expect(collectNutrientObservationErrors(bad)).toContain(
      "nutrient.basisQuantity must be a finite number greater than 0",
    );
  });

  it("rejects an out-of-enum unit", () => {
    const bad = { ...syntheticCarbObservation, unit: "oz" };
    expect(isNutrientObservation(bad)).toBe(false);
  });

  it("rejects a non-finite value", () => {
    const bad = { ...syntheticCarbObservation, value: Number.POSITIVE_INFINITY };
    expect(isNutrientObservation(bad)).toBe(false);
  });

  it("propagates source errors through the observation", () => {
    const bad = { ...syntheticCarbObservation, source: { ...syntheticSource, sourceId: "" } };
    expect(collectNutrientObservationErrors(bad)).toContain("nutrient.source.sourceId must be a non-empty string");
  });

  it("assertNutrientObservation throws on invalid input", () => {
    expect(() => assertNutrientObservation({})).toThrow(/Invalid NutrientObservation/);
  });
});
