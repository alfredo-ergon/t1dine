// Bug fix (A): the online catalog used to ship TWO records for the same PT
// dish — a synthetic development placeholder AND the real INSA/PortFIR
// analytical record — with different nutrient values, which reads as "the
// food values don't look real". `dedupePreferInsa` (see ../src/catalog.ts)
// drops the synthetic PT record whenever its pt-PT display name collides
// with a real INSA one, so INSA — real, analytically measured composition —
// is always the single record a caller resolves for that dish. Non-PT
// synthetic foods (ES/IT/GR/FR/DE/GB/PL) are never eligible, since INSA has
// no data for them and can never collide.
//
// `142` (synthetic seed foods) and `1376` (PT_INSA) are the current fixed
// sizes of the two catalog inputs (see catalogSearch.test.ts / the "142
// synthetic foods" and insaCatalog.test.ts's "has exactly 1376 foods" for the
// same invariants) — asserted again here so this file fails loud, rather
// than silently, if either input catalog's size drifts without updating this
// dedup test.

import { describe, expect, it } from "vitest";
import type { CanonicalFood } from "@t1dine/food-schema";
import { normaliseSearchText } from "@t1dine/food-schema";
import { CATALOG, dedupePreferInsa } from "../src/catalog.js";
import { PT_INSA } from "../src/catalogData/portugalInsa.js";

const SYNTH_PT_SOURCE_ID = "SYNTH-T1DINE-PT";
const TOTAL_SYNTHETIC_SEED_FOODS = 142; // CATALOG_INPUTS.length (see ../src/catalog.ts) — all markets
const TOTAL_PT_SYNTHETIC_SEED_FOODS = 74; // PT (16) + PT_DISHES (58) — the only markets eligible to collide with INSA
const TOTAL_INSA_FOODS = 1376; // PT_INSA.length (see catalogData/portugalInsa.ts)
const EXPECTED_DROPPED_COUNT = 21;

function ptName(food: CanonicalFood): string | undefined {
  return food.names.find((name) => name.language === "pt-PT")?.name;
}

function isSyntheticPt(food: CanonicalFood): boolean {
  return food.nutrients.some((nutrient) => nutrient.source.sourceId === SYNTH_PT_SOURCE_ID);
}

describe("CATALOG — real INSA foods win over synthetic PT placeholders on a name collision", () => {
  it("has exactly one 'Bacalhau à Brás' and it is the real INSA record, not the synthetic placeholder", () => {
    const matches = CATALOG.filter((food) => ptName(food) === "Bacalhau à Brás");
    expect(matches).toHaveLength(1);

    const [bacalhauABras] = matches;
    expect(bacalhauABras?.id).toBe("pt-insa-809");
    expect(bacalhauABras?.nutrients.every((n) => n.source.sourceId === "INSA-BDCA")).toBe(true);

    const choavl = bacalhauABras?.nutrients.find((n) => n.nutrientCode === "CHOAVL");
    expect(choavl?.value).toBeCloseTo(8.3, 5);
  });

  it("no longer contains the synthetic placeholder id 'pt-bacalhau-a-bras'", () => {
    expect(CATALOG.some((food) => food.id === "pt-bacalhau-a-bras")).toBe(false);
  });

  it("also drops the other confirmed synthetic/INSA name collisions (PT + PT_DISHES)", () => {
    const droppedSyntheticIds = [
      "pt-batata-cozida",
      "pt-esparguete-cozido",
      "pt-banana",
      "pt-bacalhau-a-bras",
      "pt-pastel-de-nata",
      "pt-ds-arroz-de-marisco",
      "pt-ds-arroz-de-pato",
      "pt-ds-arroz-de-tamboril",
      "pt-ds-arroz-de-cabidela",
      "pt-ds-bacalhau-com-natas",
      "pt-ds-bacalhau-a-gomes-de-sa",
      "pt-ds-cozido-a-portuguesa",
      "pt-ds-carne-de-porco-a-alentejana",
      "pt-ds-coelho-a-cacador",
      "pt-ds-acorda-de-marisco",
      "pt-ds-sopa-de-feijao",
      "pt-ds-sopa-de-peixe",
      "pt-ds-sopa-juliana",
      "pt-ds-sopa-de-agriao",
      "pt-ds-rissol-de-camarao",
      "pt-ds-peixinhos-da-horta",
    ];
    expect(droppedSyntheticIds).toHaveLength(EXPECTED_DROPPED_COUNT);

    const catalogIds = new Set(CATALOG.map((food) => food.id));
    for (const id of droppedSyntheticIds) {
      expect(catalogIds.has(id)).toBe(false);
    }
    // And the INSA records they were dropped in favour of are all present.
    const survivingInsaIds = [
      "pt-insa-586",
      "pt-insa-419",
      "pt-insa-636",
      "pt-insa-809",
      "pt-insa-489",
      "pt-insa-1040",
      "pt-insa-1099",
      "pt-insa-1065",
      "pt-insa-1096",
      "pt-insa-1038",
      "pt-insa-810",
      "pt-insa-1020",
      "pt-insa-1030",
      "pt-insa-1149",
      "pt-insa-1014",
      "pt-insa-1105",
      "pt-insa-1120",
      "pt-insa-794",
      "pt-insa-781",
      "pt-insa-952",
      "pt-insa-1082",
    ];
    for (const id of survivingInsaIds) {
      expect(catalogIds.has(id)).toBe(true);
    }
  });

  it("leaves a non-PT synthetic food (ES) untouched — INSA is PT-only and can never collide with it", () => {
    const tortilla = CATALOG.find((food) => food.id === "es-tortilla-de-patatas");
    expect(tortilla).toBeDefined();
    expect(tortilla?.nutrients.some((n) => n.source.sourceId === "SYNTH-T1DINE-ES")).toBe(true);
    expect(ptName(tortilla!)).toBe("Tortilha de batata espanhola");
  });

  it("has length equal to (synthetic seed + INSA) minus the number of dropped duplicates", () => {
    expect(TOTAL_INSA_FOODS).toBe(PT_INSA.length);
    expect(CATALOG.length).toBe(
      TOTAL_SYNTHETIC_SEED_FOODS + TOTAL_INSA_FOODS - EXPECTED_DROPPED_COUNT,
    );
  });

  it("invariant: no surviving PT-market synthetic food's pt-PT name collides with any INSA pt-PT name", () => {
    const insaNameKeys = new Set(
      PT_INSA.map((food) => ptName(food))
        .filter((name): name is string => Boolean(name))
        .map((name) => normaliseSearchText(name).replace(/\s+/g, " ")),
    );

    const survivingSyntheticPt = CATALOG.filter(isSyntheticPt);
    // Sanity check this invariant test isn't vacuous.
    expect(survivingSyntheticPt.length).toBe(TOTAL_PT_SYNTHETIC_SEED_FOODS - EXPECTED_DROPPED_COUNT);

    for (const food of survivingSyntheticPt) {
      const name = ptName(food);
      expect(name).toBeDefined();
      const key = normaliseSearchText(name!).replace(/\s+/g, " ");
      expect(insaNameKeys.has(key)).toBe(false);
    }
  });
});

describe("dedupePreferInsa — pure function, isolated fixtures", () => {
  function makeSyntheticPt(id: string, ptDisplayName: string): CanonicalFood {
    return {
      id,
      type: "recipe",
      names: [
        { language: "pt-PT", name: ptDisplayName, synonyms: [] },
        { language: "en", name: `${ptDisplayName} (en)`, synonyms: [] },
      ],
      countries: ["PT"],
      markets: ["PT"],
      barcodes: [],
      cuisineTags: [],
      dietaryPatternTags: [],
      mealContextTags: [],
      clinicalBehaviourTags: [],
      nutrients: [
        {
          nutrientCode: "CHOAVL",
          value: 10,
          unit: "g",
          basisQuantity: 100,
          basisUnit: "g",
          method: "calculated",
          confidence: "medium",
          source: {
            sourceId: SYNTH_PT_SOURCE_ID,
            sourceRecordId: `SYNTH-${id.toUpperCase()}`,
            sourceVersion: "2026.1",
            market: "PT",
            licence: "synthetic-non-redistributable",
            retrievedAt: "2026-07-01T00:00:00.000Z",
            rawSnapshotSha256: "0".repeat(64),
            mappingVersion: "map-0.1",
          },
        },
      ],
      status: "approved",
    };
  }

  function makeSyntheticNonPt(id: string, market: string, ptDisplayName: string): CanonicalFood {
    const food = makeSyntheticPt(id, ptDisplayName);
    food.countries = [market];
    food.markets = [market];
    food.nutrients = food.nutrients.map((n) => ({
      ...n,
      source: { ...n.source, sourceId: `SYNTH-T1DINE-${market}`, market },
    }));
    return food;
  }

  function makeInsa(id: string, ptDisplayName: string, carb: number): CanonicalFood {
    return {
      id,
      type: "ingredient",
      names: [{ language: "pt-PT", name: ptDisplayName, synonyms: [] }],
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
          value: carb,
          unit: "g",
          basisQuantity: 100,
          basisUnit: "g",
          method: "analytical",
          confidence: "high",
          source: {
            sourceId: "INSA-BDCA",
            sourceRecordId: `INSA-${id}`,
            sourceVersion: "BDCA v7.1 (2026)",
            market: "PT",
            licence: "insa-portfir-attribution",
            attribution: "Fonte: INSA BDCA v7.1 (2026)",
            retrievedAt: "2026-07-16T00:00:00.000Z",
            rawSnapshotSha256: "1".repeat(64),
            mappingVersion: "insa-map-2.0",
          },
        },
      ],
      status: "approved",
    };
  }

  it("drops a PT synthetic food whose name exactly matches an INSA food", () => {
    const synthetic = [makeSyntheticPt("pt-x", "Caldo verde")];
    const insa = [makeInsa("pt-insa-1", "Caldo verde", 5)];
    expect(dedupePreferInsa(synthetic, insa)).toEqual([]);
  });

  it("keeps a PT synthetic food whose name does not match any INSA food", () => {
    const synthetic = [makeSyntheticPt("pt-x", "Franesia inexistente")];
    const insa = [makeInsa("pt-insa-1", "Caldo verde", 5)];
    expect(dedupePreferInsa(synthetic, insa)).toEqual(synthetic);
  });

  it("matches case- and accent-insensitively, and collapses whitespace", () => {
    const synthetic = [makeSyntheticPt("pt-x", "  bacalhau   à Brás")];
    const insa = [makeInsa("pt-insa-1", "Bacalhau a bras", 8.3)];
    expect(dedupePreferInsa(synthetic, insa)).toEqual([]);
  });

  it("never drops a non-PT synthetic food, even if its name matches an INSA food", () => {
    const synthetic = [makeSyntheticNonPt("es-x", "ES", "Caldo verde")];
    const insa = [makeInsa("pt-insa-1", "Caldo verde", 5)];
    expect(dedupePreferInsa(synthetic, insa)).toEqual(synthetic);
  });

  it("is pure: does not mutate either input array or its elements", () => {
    const synthetic = [makeSyntheticPt("pt-x", "Caldo verde"), makeSyntheticPt("pt-y", "Sopa de peixe")];
    const insa = [makeInsa("pt-insa-1", "Caldo verde", 5)];
    const syntheticBefore = JSON.parse(JSON.stringify(synthetic));
    const insaBefore = JSON.parse(JSON.stringify(insa));

    const result = dedupePreferInsa(synthetic, insa);

    expect(synthetic).toEqual(syntheticBefore);
    expect(insa).toEqual(insaBefore);
    expect(result).toEqual([synthetic[1]]);
  });
});
