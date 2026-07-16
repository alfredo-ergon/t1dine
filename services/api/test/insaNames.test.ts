// Unit tests for the machine-assisted EN localisation of INSA Portuguese food
// names (`translateInsaName`). These pin the transparent, glossary-based
// behaviour: known food vocabulary is translated token-wise, multi-word phrases
// win over single tokens, comma structure and word order are preserved, and any
// unknown term (brands, regional preparations, rare species) stays Portuguese.

import { describe, expect, it } from "vitest";
import { translateInsaName } from "../src/catalogData/insaNames.js";

describe("translateInsaName — INSA glossary EN localisation", () => {
  it.each([
    // [structured PT INSA name, expected EN]
    ["Peru, peito com pele, cru", "Turkey, breast with skin, raw"],
    ["Frango, peito sem pele, cru", "Chicken, breast skinless, raw"],
    ["Bacalhau salgado demolhado", "Cod salted soaked"],
    ["Arroz branco cozido", "Rice white boiled"],
    ["Alho cru", "Garlic raw"],
    ["Leite meio gordo, UHT", "Milk semi-fat, UHT"],
    ["Óleo alimentar", "Cooking oil"],
    ["Grão-de-bico cozido", "Chickpeas boiled"],
    ["Sardinha assada com azeite", "Sardine roasted with olive oil"],
    ["Couve-flor cozida", "Cauliflower boiled"],
  ])("translates %j -> %j", (pt, en) => {
    expect(translateInsaName(pt)).toBe(en);
  });

  it("matches multi-word phrases before single tokens (idioms win)", () => {
    // "sem pele" -> "skinless", not word-by-word "without skin"
    expect(translateInsaName("Peito sem pele")).toBe("Breast skinless");
    // "meio gordo" -> "semi-fat", not "semi full-fat"
    expect(translateInsaName("Leite meio gordo")).toBe("Milk semi-fat");
    // "à base de" -> "based on"
    expect(translateInsaName("Bebida vegetal à base de soja")).toBe("Plant-based drink based on soy");
  });

  it("leaves unknown terms in Portuguese (transparent — never invented)", () => {
    // "Serra", "da", "Estrela" are not in the glossary and stay Portuguese.
    expect(translateInsaName("Queijo Serra da Estrela")).toBe("Cheese Serra da Estrela");
    // Brand names in quotes are preserved verbatim (punctuation kept).
    expect(translateInsaName('Água mineral natural, "Luso"')).toBe('Water mineral natural, "Luso"');
  });

  it("preserves comma structure, punctuation and word order", () => {
    expect(translateInsaName("Frango (1/4), peito e asa com pele, crus")).toBe(
      "Chicken (1/4), breast and wing with skin, raw",
    );
  });

  it("capitalises only the first word and lower-cases known vocabulary", () => {
    expect(translateInsaName("iogurte magro, natural")).toBe("Yogurt low-fat, natural");
  });

  it("is a no-op on empty input", () => {
    expect(translateInsaName("")).toBe("");
  });
});
