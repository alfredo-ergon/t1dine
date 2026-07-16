// Invariants for the real INSA BDCA v7.1 Portuguese food catalogue
// (`PT_INSA`) — the analytical composition data underlying `CATALOG`. These
// are data-quality/provenance guards, not behavioural API tests: they fail
// loud if a future regeneration of `portugalInsa.ts` drops rows, provenance,
// or the required attribution/basis-unit invariants.

import { describe, expect, it } from "vitest";
import { collectCanonicalFoodErrors } from "@t1dine/food-schema";
import { PT_INSA } from "../src/catalogData/portugalInsa.js";

describe("PT_INSA — INSA/PortFIR BDCA v7.1 Portuguese food catalogue", () => {
  it("has exactly 1376 foods", () => {
    expect(PT_INSA.length).toBe(1376);
  });

  it("every food is approved and passes canonical-food validation", () => {
    for (const food of PT_INSA) {
      expect(food.status).toBe("approved");
      expect(collectCanonicalFoodErrors(food)).toEqual([]);
    }
  });

  it("every nutrient observation carries INSA-BDCA provenance with mandatory attribution and mapping version", () => {
    for (const food of PT_INSA) {
      for (const nutrient of food.nutrients) {
        expect(nutrient.source.sourceId).toBe("INSA-BDCA");
        expect(nutrient.source.attribution).toBeTruthy();
        expect(nutrient.source.mappingVersion).toBe("insa-map-2.0");
      }
    }
  });

  it("every 'Bebidas alcoólicas' food reports its nutrients per 100 ml", () => {
    const alcoholicBeverages = PT_INSA.filter((food) => food.foodGroup?.level1 === "Bebidas alcoólicas");
    expect(alcoholicBeverages.length).toBe(36);
    for (const food of alcoholicBeverages) {
      for (const nutrient of food.nutrients) {
        expect(nutrient.basisUnit).toBe("ml");
      }
    }
  });

  it("has at least one known raw food with preparationState 'raw'", () => {
    const alhoCru = PT_INSA.find((food) => food.id === "pt-insa-8");
    expect(alhoCru).toBeDefined();
    expect(alhoCru?.preparationState).toBe("raw");
    expect(alhoCru?.names[0]?.name).toBe("Alho cru");
  });

  it("a known food carries a CHOAVL (available carbohydrate) nutrient observation", () => {
    const alhoCru = PT_INSA.find((food) => food.id === "pt-insa-8");
    const choavl = alhoCru?.nutrients.find((nutrient) => nutrient.nutrientCode === "CHOAVL");
    expect(choavl).toBeDefined();
    expect(choavl?.value).toBeCloseTo(11.3, 5);
  });

  it("averages more than 30 nutrient observations per food", () => {
    const totalNutrients = PT_INSA.reduce((sum, food) => sum + food.nutrients.length, 0);
    expect(totalNutrients / PT_INSA.length).toBeGreaterThan(30);
  });
});
