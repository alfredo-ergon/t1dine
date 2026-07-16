import { describe, expect, it } from "vitest";
import type { CanonicalFood } from "@t1dine/food-schema";

import { searchFoods } from "../src/search";

// Minimal fixtures — searchFoods only reads `names`, so cast the rest away.
function food(id: string, pt: string, synonyms: string[] = []): CanonicalFood {
  return { id, names: [{ language: "pt-PT", name: pt, synonyms }] } as unknown as CanonicalFood;
}

const catalog = [
  food("fiambre", "Fiambre, peito de peru"),
  food("peru-inteiro", "Peru inteiro com pele, cru"),
  food("peru-burger", "Peru, hambúrguer frito"),
  food("maca", "Maçã"),
  food("bacalhau", "Bacalhau à Brás", ["peru"]), // matches "peru" only via a synonym
];

describe("searchFoods ranking", () => {
  it("ranks name-prefix matches above word-start, above synonym-only matches", () => {
    const ids = searchFoods("peru", catalog).map((f) => f.id);
    // "Peru …" names start with the query → rank above "Fiambre, peito de peru"
    expect(ids.indexOf("peru-inteiro")).toBeLessThan(ids.indexOf("fiambre"));
    expect(ids.indexOf("peru-burger")).toBeLessThan(ids.indexOf("fiambre"));
    // a real name match beats a synonym-only match
    expect(ids.indexOf("fiambre")).toBeLessThan(ids.indexOf("bacalhau"));
    // "maçã" doesn't match "peru" at all
    expect(ids).not.toContain("maca");
  });

  it("is accent-insensitive", () => {
    expect(searchFoods("hamburguer", catalog).map((f) => f.id)).toContain("peru-burger");
    expect(searchFoods("maca", catalog).map((f) => f.id)).toEqual(["maca"]);
  });

  it("ANDs multiple terms together", () => {
    const ids = searchFoods("peru pele", catalog).map((f) => f.id);
    expect(ids).toContain("peru-inteiro"); // has both "peru" and "pele"
    expect(ids).not.toContain("peru-burger"); // no "pele"
  });

  it("returns the whole catalog alphabetically for an empty query", () => {
    const ids = searchFoods("", catalog).map((f) => f.id);
    expect(ids[0]).toBe("bacalhau"); // "Bacalhau à Brás" sorts first
    expect(ids).toHaveLength(catalog.length);
  });
});
