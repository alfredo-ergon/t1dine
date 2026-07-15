import { describe, expect, it } from "vitest";
import { scaleNutrient, summariseMeal, weakestConfidence } from "@t1dine/nutrition";
import { ingredientFood, packagedFood, customFood } from "@t1dine/food-schema/fixtures";

// Fixtures are re-exported for tests via a subpath; fall back to constructing
// inline if unavailable is unnecessary because the subpath export is declared.

describe("scaleNutrient", () => {
  it("scales a per-100g observation by amount", () => {
    const obs = ingredientFood.nutrients.find((n) => n.nutrientCode === "CHOAVL")!;
    // ingredientFood = cooked rice, 28 g carbs / 100 g
    expect(scaleNutrient(obs, 150)).toBeCloseTo(42, 5);
    expect(scaleNutrient(obs, 0)).toBe(0);
  });

  it("rejects negative or non-finite amounts", () => {
    const obs = ingredientFood.nutrients.find((n) => n.nutrientCode === "CHOAVL")!;
    expect(scaleNutrient(obs, -1)).toBeNull();
    expect(scaleNutrient(obs, Number.NaN)).toBeNull();
  });
});

describe("weakestConfidence", () => {
  it("returns the weakest across a list", () => {
    expect(weakestConfidence(["high", "medium", "unverified"])).toBe("unverified");
    expect(weakestConfidence(["high", "high"])).toBe("high");
    expect(weakestConfidence([])).toBe("high");
  });
});

describe("summariseMeal", () => {
  it("totals carbs and flags uncertainty from the weakest item", () => {
    const summary = summariseMeal([
      { food: ingredientFood, amount: 100 }, // rice, high, 28 g
      { food: packagedFood, amount: 50 }, // corn flakes, medium, 84 g/100 -> 42 g
      { food: customFood, amount: 40 }, // homemade bread, unverified, 49 g/100 -> 19.6 g
    ]);
    expect(summary.itemCount).toBe(3);
    expect(summary.totalCarbGrams).toBeCloseTo(89.6, 5);
    expect(summary.aggregateConfidence).toBe("unverified");
    expect(summary.hasUncertainty).toBe(true);
  });

  it("an empty meal has no uncertainty", () => {
    const summary = summariseMeal([]);
    expect(summary.totalCarbGrams).toBe(0);
    expect(summary.hasUncertainty).toBe(false);
  });
});
