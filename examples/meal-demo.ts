// Live demo of the Core "What am I eating?" spine at the contract layer.
// Loads synthetic Portugal foods, validates their provenance, assembles a
// meal with quantities, and prints nutrient totals with confidence — the same
// data flow the mobile meal-builder will drive in Slice 2/3.
//
// Run: pnpm demo   (executed via Vitest so the TS workspace graph resolves)
// No dose calculation here — the dose engine stays isolated by design.

import { describe, expect, it } from "vitest";
import { collectCanonicalFoodErrors } from "@t1dine/food-schema";
import type { CanonicalFood } from "@t1dine/food-schema";
import { customFood, ingredientFood, packagedFood, recipeFood } from "../packages/food-schema/src/fixtures/index";

interface MealItem {
  food: CanonicalFood;
  grams: number;
}

const CONFIDENCE_RANK: Record<string, number> = { unverified: 0, low: 1, medium: 2, high: 3 };

function displayName(food: CanonicalFood): string {
  const en = food.names.find((n) => n.language === "en");
  return (en ?? food.names[0])?.name ?? food.id;
}

function availableCarbPer100g(food: CanonicalFood) {
  return food.nutrients.find((n) => n.nutrientCode === "CHOAVL" && n.basisUnit === "g");
}

function badge(confidence: string, method: string): string {
  const marks: Record<string, string> = { high: "verified", medium: "declared", low: "check", unverified: "estimate" };
  return `${(marks[confidence] ?? confidence).padEnd(8)} (${confidence}/${method})`;
}

function buildMeal(name: string, items: MealItem[]) {
  console.log(`\n  MEAL: ${name}`);
  console.log("  " + "-".repeat(74));
  console.log(`  ${"Food".padEnd(26)}${"Amount".padEnd(10)}${"Carbs".padEnd(10)}Provenance`);
  console.log("  " + "-".repeat(74));

  let totalCarbs = 0;
  let weakest = 3;
  for (const { food, grams } of items) {
    const obs = availableCarbPer100g(food);
    expect(obs, `fixture ${food.id} must expose available carbohydrate`).toBeDefined();
    const carbs = obs ? (grams / obs.basisQuantity) * obs.value : 0;
    totalCarbs += carbs;
    if (obs) weakest = Math.min(weakest, CONFIDENCE_RANK[obs.confidence] ?? 0);
    const prov = obs ? badge(obs.confidence, obs.method) : "unknown";
    console.log(
      `  ${displayName(food).padEnd(26)}${(grams + " g").padEnd(10)}${(carbs.toFixed(1) + " g").padEnd(10)}${prov}`,
    );
  }

  console.log("  " + "-".repeat(74));
  console.log(`  ${"TOTAL available carbohydrate".padEnd(36)}${totalCarbs.toFixed(1)} g`);
  if (weakest < CONFIDENCE_RANK.high) {
    console.log("  ! Contains estimated/unverified items — totals carry uncertainty (confirm before trust).");
  }
  return totalCarbs;
}

describe("Core meal spine (synthetic Portugal data)", () => {
  it("validates provenance for every food before it can enter a meal", () => {
    console.log("\n  PROVENANCE / QUALITY GATE");
    for (const food of [ingredientFood, packagedFood, recipeFood, customFood]) {
      const errors = collectCanonicalFoodErrors(food);
      console.log(`  ${errors.length === 0 ? "OK " : "BAD"}  ${displayName(food).padEnd(26)} [${food.type}]`);
      expect(errors).toEqual([]);
    }
  });

  it("assembles a breakfast and computes nutrient totals with confidence", () => {
    const total = buildMeal("Breakfast", [
      { food: packagedFood, grams: 40 },
      { food: recipeFood, grams: 120 },
      { food: customFood, grams: 60 },
    ]);
    expect(total).toBeGreaterThan(0);
    console.log("");
  });
});
