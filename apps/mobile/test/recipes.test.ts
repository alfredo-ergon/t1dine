import { describe, expect, it } from "vitest";

import {
  buildRecipe,
  isRecipe,
  recipeCarbPer100g,
  recipeIngredientsWeightGrams,
  recipePerPortion,
  recipeToMealLine,
  recipeTotals,
  type Recipe,
  type RecipeIngredient,
} from "../src/recipes";

// Minimal fixture builder — a 1000 g pot of soup: 400 g rice (28 g/100g carb)
// and 600 g stock (2 g/100g carb), split into 4 portions.
function ingredient(overrides: Partial<RecipeIngredient> = {}): RecipeIngredient {
  return { foodId: "rice", name: "Arroz", quantityGrams: 400, carbPer100g: 28, ...overrides };
}

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "r1",
    name: "Sopa de legumes",
    createdAt: "2026-01-01T00:00:00.000Z",
    ingredients: [ingredient(), ingredient({ foodId: "stock", name: "Caldo", quantityGrams: 600, carbPer100g: 2 })],
    yieldGrams: 1000,
    portions: 4,
    ...overrides,
  };
}

describe("recipeTotals", () => {
  it("sums quantityGrams * carbPer100g / 100 across every ingredient", () => {
    // 400g * 28/100 = 112g ; 600g * 2/100 = 12g ; total = 124g
    expect(recipeTotals(recipe()).carbGrams).toBe(124);
  });

  it("is 0 for a recipe with only zero-carb ingredients", () => {
    const zeroCarb = recipe({ ingredients: [ingredient({ carbPer100g: 0 }), ingredient({ carbPer100g: 0 })] });
    expect(recipeTotals(zeroCarb).carbGrams).toBe(0);
  });
});

describe("recipePerPortion", () => {
  it("divides the recipe total and yield evenly across portions", () => {
    // total carb 124g / 4 portions = 31g ; yield 1000g / 4 portions = 250g
    const perPortion = recipePerPortion(recipe());
    expect(perPortion.carbGrams).toBe(31);
    expect(perPortion.portionWeightGrams).toBe(250);
  });

  it("falls back to treating portions as 1 rather than dividing by zero/negative", () => {
    const draft = recipe({ portions: 0 });
    const perPortion = recipePerPortion(draft);
    expect(perPortion.carbGrams).toBe(124);
    expect(perPortion.portionWeightGrams).toBe(1000);
  });

  it("reports a 0 g portion weight when the yield isn't (yet) valid", () => {
    const draft = recipe({ yieldGrams: 0 });
    expect(recipePerPortion(draft).portionWeightGrams).toBe(0);
  });
});

describe("recipeCarbPer100g", () => {
  it("derives the recipe's overall carb density from its total and yield", () => {
    // 124g carb across a 1000g yield = 12.4 g/100g
    expect(recipeCarbPer100g(recipe())).toBe(12.4);
  });

  it("is 0 when the yield isn't (yet) valid, never a divide-by-zero crash", () => {
    expect(recipeCarbPer100g(recipe({ yieldGrams: 0 }))).toBe(0);
  });
});

describe("recipeToMealLine", () => {
  it("builds a MealLine whose carb contribution matches N portions exactly", () => {
    const line = recipeToMealLine(recipe(), 1);
    // amount = portionWeightGrams (250g) * 1 portion
    expect(line.amount).toBe(250);
    // The synthetic food's carb-per-100g should reconstruct exactly 1 portion's carbs:
    // amount/100 * carbPer100g = 250/100 * 12.4 = 31g, matching recipePerPortion's 31g.
    const carbObservation = line.food.nutrients[0];
    expect(carbObservation?.value).toBe(12.4);
    const reconstructedCarb = (line.amount / 100) * (carbObservation?.value ?? 0);
    expect(reconstructedCarb).toBeCloseTo(recipePerPortion(recipe()).carbGrams, 5);
  });

  it("scales linearly for multiple portions", () => {
    const oneLine = recipeToMealLine(recipe(), 1);
    const twoLine = recipeToMealLine(recipe(), 2);
    expect(twoLine.amount).toBe(oneLine.amount * 2);
    // Same recipe density regardless of how many portions are being added.
    expect(twoLine.food.nutrients[0]?.value).toBe(oneLine.food.nutrients[0]?.value);
  });

  it("uses a stable food id across calls for the same recipe (so repeat adds merge)", () => {
    const first = recipeToMealLine(recipe(), 1);
    const second = recipeToMealLine(recipe(), 3);
    expect(first.food.id).toBe(second.food.id);
  });

  it("marks the synthetic recipe food as unverified/estimated, never a verified record", () => {
    const line = recipeToMealLine(recipe(), 1);
    expect(line.food.nutrients[0]?.confidence).toBe("unverified");
    expect(line.food.nutrients[0]?.method).toBe("estimated");
    expect(line.food.status).toBe("candidate");
  });

  it("defaults to 1 portion when called with no explicit count", () => {
    const line = recipeToMealLine(recipe());
    expect(line.amount).toBe(250);
  });
});

describe("recipeIngredientsWeightGrams", () => {
  it("sums every ingredient's quantity (a sensible yield suggestion)", () => {
    expect(recipeIngredientsWeightGrams(recipe().ingredients)).toBe(1000);
  });

  it("is 0 for no ingredients", () => {
    expect(recipeIngredientsWeightGrams([])).toBe(0);
  });
});

describe("buildRecipe", () => {
  it("assigns a fresh id/createdAt for a brand-new recipe", () => {
    const built = buildRecipe({ name: "  Sopa  ", ingredients: [ingredient()], yieldGrams: 500, portions: 2 });
    expect(built.id.length).toBeGreaterThan(0);
    expect(built.name).toBe("Sopa"); // trimmed
    expect(new Date(built.createdAt).toString()).not.toBe("Invalid Date");
  });

  it("preserves an existing id/createdAt when editing in place", () => {
    const existing = { id: "r1", createdAt: "2026-01-01T00:00:00.000Z" };
    const built = buildRecipe({ name: "Sopa (v2)", ingredients: [ingredient()], yieldGrams: 500, portions: 2 }, existing);
    expect(built.id).toBe("r1");
    expect(built.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("isRecipe", () => {
  it("accepts a well-formed recipe", () => {
    expect(isRecipe(recipe())).toBe(true);
  });

  it("rejects a recipe with no ingredients, a non-positive yield, or non-positive portions", () => {
    expect(isRecipe(recipe({ ingredients: [] }))).toBe(false);
    expect(isRecipe(recipe({ yieldGrams: 0 }))).toBe(false);
    expect(isRecipe(recipe({ portions: 0 }))).toBe(false);
  });

  it("rejects malformed/foreign values without throwing", () => {
    expect(isRecipe(null)).toBe(false);
    expect(isRecipe(undefined)).toBe(false);
    expect(isRecipe("not a recipe")).toBe(false);
    expect(isRecipe({})).toBe(false);
  });
});
