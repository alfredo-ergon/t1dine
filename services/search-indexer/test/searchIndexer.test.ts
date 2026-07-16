// Coverage for the rebuildable search-document projection: approved-only
// indexing, accent-insensitive matching, exact facet filters, INSA
// provenance flow-through, determinism, and carbPer100g extraction.

import { describe, expect, it } from "vitest";
import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import type { CanonicalFood } from "@t1dine/food-schema";
import { buildSearchDocument, buildSearchDocuments, queryDocuments } from "../src/index.js";

function source(sourceId: string): SourceReference {
  return {
    sourceId,
    sourceRecordId: "REC-1",
    sourceVersion: "1.0",
    licence: "test-only",
    retrievedAt: "2026-01-01T00:00:00.000Z",
    rawSnapshotSha256: "0".repeat(64),
    mappingVersion: "test-map-1.0",
  };
}

function carbObservation(value: number, overrides: Partial<NutrientObservation> = {}): NutrientObservation {
  return {
    nutrientCode: "CHOAVL",
    value,
    unit: "g",
    basisQuantity: 100,
    basisUnit: "g",
    method: "analytical",
    confidence: "high",
    source: source("SYNTH-TEST"),
    ...overrides,
  };
}

const paoDeForma: CanonicalFood = {
  id: "test-pao-de-forma",
  type: "packaged",
  names: [
    { language: "pt-PT", name: "Pão de forma", synonyms: ["pão de fatias"] },
    { language: "en", name: "Sliced white bread", synonyms: ["sandwich bread"] },
  ],
  countries: ["PT"],
  markets: ["PT"],
  barcodes: ["5600000000001"],
  cuisineTags: ["portuguese"],
  dietaryPatternTags: ["vegetarian"],
  mealContextTags: ["breakfast"],
  clinicalBehaviourTags: [],
  nutrients: [carbObservation(49.4)],
  status: "approved",
  preparationState: "raw",
  foodGroup: { level1: "Cereais e produtos à base de cereais", level2: "Pão", code: "cereais" },
};

const candidateFood: CanonicalFood = { ...paoDeForma, id: "test-candidate-food", status: "candidate" };
const retiredFood: CanonicalFood = { ...paoDeForma, id: "test-retired-food", status: "retired" };

const insaVinho: CanonicalFood = {
  id: "test-insa-vinho-tinto",
  type: "ingredient",
  names: [{ language: "pt-PT", name: "Vinho tinto", synonyms: [] }],
  countries: ["PT"],
  markets: ["PT"],
  barcodes: [],
  cuisineTags: ["portuguese"],
  dietaryPatternTags: [],
  mealContextTags: [],
  clinicalBehaviourTags: [],
  nutrients: [
    {
      nutrientCode: "CHOAVL",
      value: 0.3,
      unit: "g",
      basisQuantity: 100,
      basisUnit: "ml",
      method: "analytical",
      confidence: "high",
      source: source("INSA-BDCA"),
    },
  ],
  status: "approved",
  foodGroup: { level1: "Bebidas alcoólicas", code: "bebidas-alcoolicas" },
};

const nonStandardBasis: CanonicalFood = {
  id: "test-non-standard-basis",
  type: "ingredient",
  names: [{ language: "pt-PT", name: "Feijão cozido", synonyms: [] }],
  countries: ["PT"],
  markets: ["PT"],
  barcodes: [],
  cuisineTags: [],
  dietaryPatternTags: [],
  mealContextTags: [],
  clinicalBehaviourTags: [],
  nutrients: [carbObservation(7.75, { basisQuantity: 50 })],
  status: "approved",
};

describe("buildSearchDocuments", () => {
  it("indexes only approved foods (candidates and retired are excluded)", () => {
    const docs = buildSearchDocuments([paoDeForma, candidateFood, retiredFood]);
    expect(docs.map((d) => d.id)).toEqual(["test-pao-de-forma"]);
  });

  it("is deterministic for the same input", () => {
    const docsA = buildSearchDocuments([paoDeForma, insaVinho]);
    const docsB = buildSearchDocuments([paoDeForma, insaVinho]);
    expect(docsA).toEqual(docsB);
  });
});

describe("buildSearchDocument", () => {
  it("uses the pt-first name as primaryName and folds every other name/synonym into normalisedSynonyms", () => {
    const doc = buildSearchDocument(paoDeForma);
    expect(doc.primaryName).toBe("Pão de forma");
    expect(doc.normalisedName).toBe("pao de forma");
    expect(doc.normalisedSynonyms).toEqual(
      expect.arrayContaining(["pao de fatias", "sliced white bread", "sandwich bread"]),
    );
  });

  it("carries foodGroup, preparationState, and sourceId through", () => {
    const doc = buildSearchDocument(paoDeForma);
    expect(doc.foodGroupLevel1).toBe("Cereais e produtos à base de cereais");
    expect(doc.foodGroupLevel2).toBe("Pão");
    expect(doc.foodGroupCode).toBe("cereais");
    expect(doc.preparationState).toBe("raw");
    expect(doc.sourceId).toBe("SYNTH-TEST");
  });

  it("flows the real INSA sourceId through", () => {
    expect(buildSearchDocument(insaVinho).sourceId).toBe("INSA-BDCA");
  });

  it("extracts carbPer100g directly when the source basis is already 100", () => {
    expect(buildSearchDocument(paoDeForma).carbPer100g).toBeCloseTo(49.4, 5);
  });

  it("scales carbPer100g when the source basis quantity isn't 100", () => {
    expect(buildSearchDocument(nonStandardBasis).carbPer100g).toBeCloseTo(15.5, 5);
  });

  it("takes the weakest confidence across all nutrient observations", () => {
    const mixedConfidence: CanonicalFood = {
      ...paoDeForma,
      id: "test-mixed-confidence",
      nutrients: [
        carbObservation(49.4, { confidence: "high" }),
        carbObservation(1, { nutrientCode: "FIBTG", confidence: "unverified" }),
      ],
    };
    expect(buildSearchDocument(mixedConfidence).confidence).toBe("unverified");
  });
});

describe("queryDocuments", () => {
  const docs = buildSearchDocuments([paoDeForma, insaVinho]);

  it("matches accent-insensitively on the primary name ('pao' finds 'Pão')", () => {
    expect(queryDocuments(docs, { q: "pao" }).map((d) => d.id)).toContain("test-pao-de-forma");
  });

  it("matches accent-insensitively via a synonym", () => {
    expect(queryDocuments(docs, { q: "sandwich" }).map((d) => d.id)).toEqual(["test-pao-de-forma"]);
  });

  it("filters by foodGroupCode, exactly", () => {
    expect(queryDocuments(docs, { foodGroupCode: "bebidas-alcoolicas" }).map((d) => d.id)).toEqual([
      "test-insa-vinho-tinto",
    ]);
  });

  it("filters by preparationState, exactly", () => {
    expect(queryDocuments(docs, { preparationState: "raw" }).map((d) => d.id)).toEqual(["test-pao-de-forma"]);
  });

  it("filters by sourceId, exactly", () => {
    expect(queryDocuments(docs, { sourceId: "INSA-BDCA" }).map((d) => d.id)).toEqual(["test-insa-vinho-tinto"]);
  });

  it("combines q and a facet filter with AND", () => {
    expect(queryDocuments(docs, { q: "vinho", sourceId: "INSA-BDCA" }).map((d) => d.id)).toEqual([
      "test-insa-vinho-tinto",
    ]);
    expect(queryDocuments(docs, { q: "vinho", sourceId: "SYNTH-TEST" })).toEqual([]);
  });
});
