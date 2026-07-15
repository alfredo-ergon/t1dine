// Unit coverage for the Anthropic-backed `FoodAiProvider` adapter's MAPPING
// and error handling. NEVER calls the real Anthropic API: every test injects
// a fake `AnthropicMessagesClient` (see `../src/anthropicFoodAi.ts`) or
// exercises the pure `mapSimplifiedFood`/`mapFoods` functions directly with
// no client at all. `MockFoodAiProvider` (the offline default used by
// `buildApp()`/every other test file) is unaffected by anything here.

import { describe, expect, it } from "vitest";
import { collectCanonicalFoodErrors } from "@t1dine/food-schema";
import type { FoodAiGenerateParams } from "../src/foodAi.js";
import {
  AnthropicFoodAiProvider,
  mapFoods,
  mapSimplifiedFood,
  type AnthropicMessageResult,
  type AnthropicMessagesClient,
} from "../src/anthropicFoodAi.js";

const BASE_PARAMS: FoodAiGenerateParams = { count: 2, startIndex: 1, country: "IT" };

const VALID_RAW_ITEM = {
  namePt: "Prato de teste",
  nameEn: "Test dish",
  carbGramsPer100g: 12.5,
  energyKcalPer100g: 150,
  cuisine: "italian",
};

describe("mapSimplifiedFood", () => {
  it("maps a valid simplified item into a valid candidate CanonicalFood", () => {
    const food = mapSimplifiedFood(VALID_RAW_ITEM, BASE_PARAMS, 0);

    expect(food).not.toBeNull();
    if (!food) return; // narrows for TypeScript below

    expect(collectCanonicalFoodErrors(food)).toEqual([]);
    expect(food.status).toBe("candidate"); // NEVER auto-approved
    expect(food.type).toBe("custom");
    expect(food.countries).toEqual(["IT"]);
    expect(food.markets).toEqual(["IT"]);
    expect(food.cuisineTags).toEqual(["italian"]);
    expect(food.names).toEqual([
      { language: "pt-PT", name: "Prato de teste", synonyms: [] },
      { language: "en", name: "Test dish", synonyms: [] },
    ]);
    expect(food.nutrients).toHaveLength(2);
    for (const nutrient of food.nutrients) {
      expect(nutrient.method).toBe("estimated");
      expect(nutrient.confidence).toBe("unverified");
      expect(nutrient.source.sourceId).toBe("AI-CLAUDE");
    }
    const carb = food.nutrients.find((n) => n.nutrientCode === "CHOAVL");
    const energy = food.nutrients.find((n) => n.nutrientCode === "ENERC");
    expect(carb?.value).toBe(12.5);
    expect(energy?.value).toBe(150);
  });

  it("uses startIndex + index to build a unique id", () => {
    const first = mapSimplifiedFood(VALID_RAW_ITEM, { count: 2, startIndex: 5, country: "IT" }, 0);
    const second = mapSimplifiedFood(VALID_RAW_ITEM, { count: 2, startIndex: 5, country: "IT" }, 1);
    expect(first?.id).toBe("ai-claude-candidate-5");
    expect(second?.id).toBe("ai-claude-candidate-6");
  });

  it("drops an item missing a required field (never trusts model output)", () => {
    const missingCuisine = {
      namePt: "Prato incompleto",
      nameEn: "Incomplete dish",
      carbGramsPer100g: 10,
      energyKcalPer100g: 100,
      // cuisine deliberately omitted
    };
    expect(mapSimplifiedFood(missingCuisine, BASE_PARAMS, 0)).toBeNull();
  });

  it("drops an item with a wrong-typed numeric field", () => {
    const wrongType = { ...VALID_RAW_ITEM, carbGramsPer100g: "twelve" };
    expect(mapSimplifiedFood(wrongType, BASE_PARAMS, 0)).toBeNull();
  });

  it("drops a non-object item", () => {
    expect(mapSimplifiedFood("not an object", BASE_PARAMS, 0)).toBeNull();
    expect(mapSimplifiedFood(null, BASE_PARAMS, 0)).toBeNull();
    expect(mapSimplifiedFood(42, BASE_PARAMS, 0)).toBeNull();
  });

  it("falls back to a region's representative country when no country is given", () => {
    const food = mapSimplifiedFood(VALID_RAW_ITEM, { count: 1, startIndex: 1, region: "eastern-europe" }, 0);
    expect(food?.countries).toEqual(["PL"]);
  });
});

describe("mapFoods", () => {
  it("maps every valid item and silently drops invalid ones", () => {
    const invalidItem = { namePt: "Sem carbs", nameEn: "No carbs field" };
    const foods = mapFoods([VALID_RAW_ITEM, invalidItem], BASE_PARAMS);
    expect(foods).toHaveLength(1);
    expect(foods[0]?.names[0]?.name).toBe("Prato de teste");
  });
});

function fakeClient(result: AnthropicMessageResult): { client: AnthropicMessagesClient; calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    client: {
      messages: {
        // eslint-disable-next-line @typescript-eslint/require-await
        async create(params) {
          calls.push(params);
          return result;
        },
      },
    },
  };
}

describe("AnthropicFoodAiProvider (fake client, no network)", () => {
  it("generates candidate foods from a well-formed tool_use response", async () => {
    const { client, calls } = fakeClient({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "emit_foods",
          input: { foods: [VALID_RAW_ITEM] },
        },
      ],
    });

    const provider = new AnthropicFoodAiProvider(client, "test-model");
    const foods = await provider.generate(BASE_PARAMS);

    expect(foods).toHaveLength(1);
    expect(foods[0]?.status).toBe("candidate");
    expect(collectCanonicalFoodErrors(foods[0])).toEqual([]);

    // Confirms the call shape: structured-output tool forced via tool_choice.
    expect(calls).toHaveLength(1);
    const call = calls[0] as { model: string; tool_choice?: { type: string; name: string } };
    expect(call.model).toBe("test-model");
    expect(call.tool_choice).toEqual({ type: "tool", name: "emit_foods" });
  });

  it("drops invalid items returned alongside valid ones", async () => {
    const { client } = fakeClient({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "emit_foods",
          input: { foods: [VALID_RAW_ITEM, { namePt: "Incompleto" }] },
        },
      ],
    });

    const provider = new AnthropicFoodAiProvider(client, "test-model");
    const foods = await provider.generate(BASE_PARAMS);

    expect(foods).toHaveLength(1);
  });

  it("throws when the model refuses instead of fabricating foods", async () => {
    const { client } = fakeClient({ stop_reason: "refusal", content: [] });
    const provider = new AnthropicFoodAiProvider(client, "test-model");

    await expect(provider.generate(BASE_PARAMS)).rejects.toThrow();
  });

  it("throws when no emit_foods tool_use block is present", async () => {
    const { client } = fakeClient({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "I could not comply.", citations: [] }],
    });
    const provider = new AnthropicFoodAiProvider(client, "test-model");

    await expect(provider.generate(BASE_PARAMS)).rejects.toThrow();
  });
});
