import { describe, expect, it } from "vitest";
import type { CanonicalFood } from "@t1dine/food-schema";

import { foodEmoji } from "../src/foodEmoji";

// Minimal food factory — foodEmoji only reads `names` + `type`, so the rest is
// cast away to keep these cases focused and readable.
function food(name: string, type: CanonicalFood["type"] = "ingredient", synonyms: string[] = []): CanonicalFood {
  return {
    type,
    names: [{ language: "pt-PT", name, synonyms }],
  } as CanonicalFood;
}

describe("foodEmoji", () => {
  it("maps common Portuguese foods by keyword", () => {
    expect(foodEmoji(food("Pão de trigo"))).toBe("🍞");
    expect(foodEmoji(food("Azeite virgem extra"))).toBe("🫒");
    expect(foodEmoji(food("Banana"))).toBe("🍌");
    expect(foodEmoji(food("Bacalhau cozido"))).toBe("🐟");
    expect(foodEmoji(food("Frango grelhado"))).toBe("🍗");
  });

  it("prefers the more specific keyword (order matters)", () => {
    // "arroz doce" (rice pudding) must win over the generic "arroz" (rice).
    expect(foodEmoji(food("Arroz doce"))).toBe("🍮");
    expect(foodEmoji(food("Arroz cozido"))).toBe("🍚");
    // "batata frita" must win over "batata".
    expect(foodEmoji(food("Batata frita"))).toBe("🍟");
    expect(foodEmoji(food("Batata cozida"))).toBe("🥔");
    // "pastel de nata" must win over the bread/"pão" family.
    expect(foodEmoji(food("Pastel de nata"))).toBe("🥧");
  });

  it("matches accent-insensitively and via synonyms", () => {
    expect(foodEmoji(food("MAÇÃ"))).toBe("🍎");
    expect(foodEmoji(food("Café com leite", "ingredient", ["galão"]))).toBe("☕");
  });

  it("always returns a type fallback when no keyword matches", () => {
    expect(foodEmoji(food("Zxqwerty", "restaurant"))).toBe("🍽️");
    expect(foodEmoji(food("Zxqwerty", "packaged"))).toBe("🥫");
    expect(foodEmoji(food("Zxqwerty", "custom"))).toBe("🍴");
    expect(foodEmoji(food("Zxqwerty", "ingredient"))).toBe("🥗");
  });
});
