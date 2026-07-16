import { describe, expect, it } from "vitest";
import {
  assertCanonicalFood,
  collectCanonicalFoodErrors,
  defaultConfidence,
  FOOD_TYPES,
  isCanonicalFood,
  NUTRIENT_DEFINITIONS,
  NUTRIENTS,
  nutrientUnit,
} from "@t1dine/food-schema";
import { canonicalFoodFixturesByType, ingredientFood, insaStyleFood } from "../src/fixtures/index";

describe("CanonicalFood validation", () => {
  it("accepts every synthetic fixture", () => {
    for (const food of Object.values(canonicalFoodFixturesByType)) {
      expect(collectCanonicalFoodErrors(food)).toEqual([]);
      expect(isCanonicalFood(food)).toBe(true);
    }
  });

  it("provides at least one valid fixture for every FoodType", () => {
    for (const type of FOOD_TYPES) {
      const fixture = canonicalFoodFixturesByType[type];
      expect(fixture, `missing fixture for FoodType "${type}"`).toBeDefined();
      expect(fixture.type).toBe(type);
      expect(isCanonicalFood(fixture)).toBe(true);
    }
  });

  it("rejects a food with an out-of-enum type", () => {
    const bad = { ...ingredientFood, type: "beverage" };
    expect(isCanonicalFood(bad)).toBe(false);
  });

  it("rejects a food with no names", () => {
    const bad = { ...ingredientFood, names: [] };
    expect(collectCanonicalFoodErrors(bad)).toContain(
      "food.names must be a non-empty array of localised names",
    );
  });

  it("rejects a food whose nutrient violates the domain contract (cross-package rule)", () => {
    const bad = {
      ...ingredientFood,
      nutrients: [{ ...ingredientFood.nutrients[0], basisQuantity: -1 }],
    };
    const errors = collectCanonicalFoodErrors(bad);
    expect(errors.some((e) => e.includes("basisQuantity"))).toBe(true);
    expect(isCanonicalFood(bad)).toBe(false);
  });

  it("assertCanonicalFood throws on invalid input", () => {
    expect(() => assertCanonicalFood({ id: "x" })).toThrow(/Invalid CanonicalFood/);
  });
});

describe("CanonicalFood additive fields (INSA/PortFIR)", () => {
  it("accepts a food carrying preparationState, foodGroup and a µg nutrient", () => {
    expect(collectCanonicalFoodErrors(insaStyleFood)).toEqual([]);
    expect(isCanonicalFood(insaStyleFood)).toBe(true);
  });

  it("rejects an out-of-vocab preparationState", () => {
    const bad = { ...insaStyleFood, preparationState: "microwaved" };
    expect(collectCanonicalFoodErrors(bad).some((e) => e.includes("preparationState"))).toBe(true);
  });

  it("rejects a foodGroup without level1", () => {
    const bad = { ...insaStyleFood, foodGroup: { level2: "x" } };
    expect(collectCanonicalFoodErrors(bad).some((e) => e.includes("foodGroup.level1"))).toBe(true);
  });

  it("rejects an ediblePortion outside (0, 1]", () => {
    expect(collectCanonicalFoodErrors({ ...insaStyleFood, ediblePortion: 1.5 }).some((e) => e.includes("ediblePortion"))).toBe(true);
    expect(collectCanonicalFoodErrors({ ...insaStyleFood, ediblePortion: 0 }).some((e) => e.includes("ediblePortion"))).toBe(true);
  });

  it("leaves the existing per-type fixtures valid (additive change)", () => {
    for (const food of Object.values(canonicalFoodFixturesByType)) {
      expect(isCanonicalFood(food)).toBe(true);
    }
  });
});

describe("nutrient dictionary", () => {
  it("covers all 48 INSA columns with unique codes", () => {
    expect(NUTRIENT_DEFINITIONS).toHaveLength(48);
    const codes = NUTRIENT_DEFINITIONS.map((d) => d.code);
    expect(new Set(codes).size).toBe(48);
  });

  it("maps the dose-relevant carbohydrate code to grams", () => {
    expect(nutrientUnit("CHOAVL")).toBe("g");
    expect(NUTRIENTS.CHOAVL?.infoods).toBe("CHOAVL");
  });

  it("derives confidence from unit (macros high, micronutrients medium)", () => {
    expect(defaultConfidence("g")).toBe("high");
    expect(defaultConfidence("kcal")).toBe("high");
    expect(defaultConfidence("kJ")).toBe("high");
    expect(defaultConfidence("mg")).toBe("medium");
    expect(defaultConfidence("µg")).toBe("medium");
  });

  it("has a µg unit available for micronutrients", () => {
    expect(nutrientUnit("ID")).toBe("µg");
    expect(nutrientUnit("VITA")).toBe("µg");
  });
});
