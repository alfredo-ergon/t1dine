// Regression tests for the energy-loss bug: a meal line stores the full
// CanonicalFood at save time (with real energy + real confidence), but a
// SavedMealItem only ever snapshotted `carbPer100g` — never energy. When the
// original food could no longer be resolved by id on "Usar"/"Clonar e
// ajustar" (e.g. offline, or removed from the catalog), buildFallbackFood()
// built a carb-only placeholder food, so summariseMeal() reported 0 kcal and
// "unverified" confidence for a food that, in reality, has real energy and
// may be verified. SavedMealItem.energyPer100g (optional, backward
// compatible) closes this gap for anything saved from now on; older
// persisted items that lack the field are left exactly as-is (0 kcal), per
// CLAUDE.md's "never fabricate a value that is unknown".

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalFood } from "@t1dine/food-schema";
import { insaStyleFood } from "@t1dine/food-schema/fixtures";
import type { MealLine } from "@t1dine/nutrition";
import { summariseMeal } from "@t1dine/nutrition";

let store: Map<string, string>;

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => (store.has(key) ? (store.get(key) as string) : null)),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      keys.forEach((key) => store.delete(key));
    }),
  },
}));

beforeEach(() => {
  store = new Map();
});

const resolveName = (food: CanonicalFood) => food.names[0]?.name ?? food.id;

// insaStyleFood: CHOAVL 1.7 g/100g, ENERC 11 kcal/100g, confidence "high" —
// i.e. a real, verified food (not a fallback/estimated one).
function verifiedFoodLine(amount = 200): MealLine {
  return { food: insaStyleFood, amount };
}

describe("buildSavedMealFromLines — energyPer100g capture", () => {
  it("captures energyPer100g from a line's real energy, mirroring how carbPer100g is derived", async () => {
    const { buildSavedMealFromLines } = await import("../src/savedMeals");
    const meal = buildSavedMealFromLines("Lanche", [verifiedFoodLine(200)], resolveName);

    // 200g of a food with 11 kcal/100g and 1.7 g/100g carb:
    expect(meal.items[0]!.carbPer100g).toBe(1.7);
    expect(meal.items[0]!.energyPer100g).toBe(11);
  });

  it("omits energyPer100g (rather than persisting 0) when the line's amount is 0", async () => {
    const { buildSavedMealFromLines } = await import("../src/savedMeals");
    const meal = buildSavedMealFromLines("Lanche", [verifiedFoodLine(0)], resolveName);

    expect(meal.items[0]!.energyPer100g).toBeUndefined();
  });

  it("omits energyPer100g when the food has no energy observation at all (no fabrication)", async () => {
    const { buildSavedMealFromLines } = await import("../src/savedMeals");
    const carbOnlyFood = { ...insaStyleFood, nutrients: insaStyleFood.nutrients.filter((n) => n.nutrientCode !== "ENERC") };
    const meal = buildSavedMealFromLines("Lanche", [{ food: carbOnlyFood, amount: 200 }], resolveName);

    expect(meal.items[0]!.energyPer100g).toBeUndefined();
  });
});

describe("buildFallbackFood — reconstructs energy, not just carbs", () => {
  it("adds an ENERC observation when the persisted item carries energyPer100g, so summariseMeal reports the real kcal instead of 0", async () => {
    const { buildFallbackFood } = await import("../src/savedMeals");
    const item = { foodId: "missing-food", name: "Abóbora crua", quantityGrams: 200, carbPer100g: 1.7, energyPer100g: 11 };

    const fallback = buildFallbackFood(item);
    const summary = summariseMeal([{ food: fallback, amount: 200 }]);

    expect(summary.totalEnergyKcal).toBe(22); // 200g @ 11 kcal/100g
    expect(summary.totalCarbGrams).toBe(3.4); // 200g @ 1.7 g/100g
    // Still clearly marked as a reconstruction, not a re-verified record.
    expect(fallback.status).toBe("candidate");
    expect(summary.lines[0]!.confidence).toBe("unverified");
  });

  it("does NOT fabricate energy for older persisted items that lack energyPer100g (0 kcal is accepted for pre-existing data)", async () => {
    const { buildFallbackFood } = await import("../src/savedMeals");
    const legacyItem = { foodId: "missing-food", name: "Arroz", quantityGrams: 100, carbPer100g: 28 }; // no energyPer100g

    const fallback = buildFallbackFood(legacyItem);

    expect(fallback.nutrients.some((n) => n.nutrientCode === "ENERC")).toBe(false);
    const summary = summariseMeal([{ food: fallback, amount: 100 }]);
    expect(summary.totalEnergyKcal).toBe(0);
  });
});

describe("end-to-end: save a verified food, lose it from the catalog, reuse the saved meal offline", () => {
  it("reconstructs a fallback food whose summarised energyKcal equals the real value, not 0", async () => {
    const { buildSavedMealFromLines, saveSavedMeals, loadSavedMeals, resolveSavedMealToLines } = await import("../src/savedMeals");

    const meal = buildSavedMealFromLines("Lanche", [verifiedFoodLine(200)], resolveName);
    await saveSavedMeals([meal]);

    const [loaded] = await loadSavedMeals();
    // Simulate the food no longer being resolvable (e.g. offline catalog, or removed) — knownFoods is empty.
    const lines = resolveSavedMealToLines(loaded!, []);
    const summary = summariseMeal(lines);

    expect(summary.totalEnergyKcal).toBe(22); // NOT 0 — the bug this test guards against
    expect(summary.totalCarbGrams).toBe(3.4);
  });
});

describe("isSavedMeal — untrusted-storage validation of energyPer100g", () => {
  it("accepts a well-formed saved meal with energyPer100g present", async () => {
    const { isSavedMeal } = await import("../src/savedMeals");
    const meal = {
      id: "s1",
      name: "Lanche",
      createdAt: "2026-01-01T08:00:00.000Z",
      items: [{ foodId: "f1", name: "Abóbora", quantityGrams: 200, carbPer100g: 1.7, energyPer100g: 11 }],
      totalCarbGrams: 3.4,
    };
    expect(isSavedMeal(meal)).toBe(true);
  });

  it("accepts a well-formed saved meal with energyPer100g absent (backward compatible with pre-fix data)", async () => {
    const { isSavedMeal } = await import("../src/savedMeals");
    const meal = {
      id: "s1",
      name: "Almoço",
      createdAt: "2026-01-01T08:00:00.000Z",
      items: [{ foodId: "f1", name: "Arroz", quantityGrams: 100, carbPer100g: 28 }],
      totalCarbGrams: 28,
    };
    expect(isSavedMeal(meal)).toBe(true);
  });

  it("rejects a saved meal whose energyPer100g is present but not a finite number", async () => {
    const { isSavedMeal } = await import("../src/savedMeals");
    const badMeal = {
      id: "s1",
      name: "Lanche",
      createdAt: "2026-01-01T08:00:00.000Z",
      items: [{ foodId: "f1", name: "Abóbora", quantityGrams: 200, carbPer100g: 1.7, energyPer100g: "eleven" }],
      totalCarbGrams: 3.4,
    };
    expect(isSavedMeal(badMeal)).toBe(false);

    const nanMeal = {
      id: "s1",
      name: "Lanche",
      createdAt: "2026-01-01T08:00:00.000Z",
      items: [{ foodId: "f1", name: "Abóbora", quantityGrams: 200, carbPer100g: 1.7, energyPer100g: Number.NaN }],
      totalCarbGrams: 3.4,
    };
    expect(isSavedMeal(nanMeal)).toBe(false);
  });
});
