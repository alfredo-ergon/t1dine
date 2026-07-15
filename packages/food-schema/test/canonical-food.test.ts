import { describe, expect, it } from "vitest";
import {
  assertCanonicalFood,
  collectCanonicalFoodErrors,
  FOOD_TYPES,
  isCanonicalFood,
} from "@t1dine/food-schema";
import { canonicalFoodFixturesByType, ingredientFood } from "../src/fixtures/index";

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
