// AI-assist code seam for the food catalog (admin-only, never public).
//
// GOVERNANCE CONTRACT — read this before touching anything here (CLAUDE.md /
// .claude/rules/food-data.md): "AI extraction creates a candidate record,
// never an automatically trusted canonical record." This module NEVER
// decides approval. It only produces candidate `CanonicalFood` shapes; the
// admin route (`../modules/admin.ts`) always stores them through
// `FoodRepository.insertAiCandidate`, which hardcodes `status: "candidate"`,
// `source: "ai"` regardless of what a provider returns — a second,
// independent enforcement point, not just a convention here.
//
// PLUGGABLE SEAM: `FoodAiProvider` is the interface a real LLM/HTTP-backed
// adapter would implement (e.g. `class OpenAiFoodProvider implements
// FoodAiProvider { generate(params) { /* call an external API */ } }`) and
// be injected in place of `MockFoodAiProvider` wherever the admin module
// constructs one — without changing the route contract. THIS CODEBASE NEVER
// CALLS ANY EXTERNAL AI/HTTP API: `MockFoodAiProvider` is fully offline and
// deterministic (derives names from a fixed per-cuisine seed list indexed by
// `startIndex`, and nutrient values from a seeded periodic function) — no
// `Math.random()`, no fresh `Date.now()` read feeds into any generated
// value.

import { createHash } from "node:crypto";
import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import type { CanonicalFood, FoodType } from "@t1dine/food-schema";
import { REGIONS } from "@t1dine/food-schema";

export interface FoodAiGenerateParams {
  country?: string;
  region?: string;
  cuisine?: string;
  count: number;
  /** Deterministic starting offset for both the candidate id and the seed
   * index, supplied by the caller (the admin route derives it from how many
   * AI candidates already exist) so repeat calls do not collide — never
   * `Math.random()`/`Date.now()`. */
  startIndex: number;
}

/**
 * Pluggable seam for AI-assisted food generation. A conforming
 * implementation MUST return `status: "candidate"` foods — see the
 * GOVERNANCE CONTRACT above; the caller enforces this again regardless.
 */
export interface FoodAiProvider {
  generate(params: FoodAiGenerateParams): CanonicalFood[];
}

// ---------------------------------------------------------------------------
// Deterministic pseudo-random helpers (NOT cryptographic, NOT Math.random) —
// pure functions of an integer seed, so the same seed always yields the same
// value. Mirrors the periodic-function approach already used by the
// Nightscout mock mode (see `modules/nightscout.ts`).
// ---------------------------------------------------------------------------

function deterministicUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
}

function scaledValue(seed: number, min: number, max: number, decimals = 1): number {
  const unit = deterministicUnit(seed);
  const raw = min + unit * (max - min);
  const factor = 10 ** decimals;
  return Math.round(raw * factor) / factor;
}

/** Deterministic, non-cryptographic-use stand-in for a raw-snapshot digest —
 * mirrors `syntheticSnapshotHash` in `../catalog.ts`. */
function aiSnapshotHash(seed: string): string {
  return createHash("sha256").update(`t1dine-ai-candidate:${seed}`).digest("hex");
}

// ---------------------------------------------------------------------------
// Per-cuisine name/range seed lists
// ---------------------------------------------------------------------------

interface AiNameSeed {
  pt: string;
  ptSynonyms?: string[];
  en: string;
  type: FoodType;
  /** Grams of available carbohydrate per 100 g, plausible range. */
  carbRange: [number, number];
  /** Kilocalories per 100 g, plausible range. */
  energyRange: [number, number];
}

const CUISINE_SEEDS: Record<string, AiNameSeed[]> = {
  portuguese: [
    { pt: "Sopa de legumes", en: "Vegetable soup", type: "recipe", carbRange: [4, 9], energyRange: [30, 55] },
    { pt: "Arroz de pato", en: "Duck rice", type: "recipe", carbRange: [18, 26], energyRange: [140, 190] },
    { pt: "Rissol de camarão", en: "Shrimp rissole", type: "recipe", carbRange: [18, 28], energyRange: [220, 280] },
    { pt: "Queijo da serra", en: "Serra cheese", type: "ingredient", carbRange: [0, 1], energyRange: [350, 400] },
    { pt: "Filetes de pescada", en: "Hake fillets", type: "recipe", carbRange: [4, 10], energyRange: [130, 180] },
  ],
  spanish: [
    { pt: "Croquetes de presunto", en: "Ham croquettes", type: "recipe", carbRange: [18, 26], energyRange: [220, 280] },
    { pt: "Salmorejo", en: "Salmorejo (cold tomato-bread soup)", type: "recipe", carbRange: [6, 12], energyRange: [60, 100] },
    { pt: "Tortilha de espinafres", en: "Spinach tortilla", type: "recipe", carbRange: [6, 12], energyRange: [110, 160] },
    { pt: "Empanada galega", en: "Galician empanada", type: "recipe", carbRange: [24, 34], energyRange: [220, 280] },
    { pt: "Turrão", en: "Turrón (almond nougat)", type: "packaged", carbRange: [40, 50], energyRange: [450, 520] },
  ],
  italian: [
    { pt: "Panzanella", en: "Panzanella (bread and tomato salad)", type: "recipe", carbRange: [14, 22], energyRange: [90, 140] },
    { pt: "Focaccia", en: "Focaccia bread", type: "packaged", carbRange: [45, 55], energyRange: [270, 320] },
    { pt: "Minestrone", en: "Minestrone soup", type: "recipe", carbRange: [7, 13], energyRange: [45, 70] },
    { pt: "Ossobuco", en: "Ossobuco", type: "recipe", carbRange: [3, 8], energyRange: [150, 210] },
    { pt: "Gelado de baunilha", en: "Vanilla gelato", type: "packaged", carbRange: [22, 30], energyRange: [190, 230] },
  ],
  greek: [
    { pt: "Spanakopita", en: "Spanakopita (spinach pie)", type: "recipe", carbRange: [18, 26], energyRange: [220, 270] },
    { pt: "Dolmades", en: "Dolmades (stuffed vine leaves)", type: "recipe", carbRange: [14, 22], energyRange: [140, 190] },
    { pt: "Fava grega", en: "Greek split-pea purée (fava)", type: "recipe", carbRange: [14, 20], energyRange: [110, 150] },
    { pt: "Iogurte grego com mel", en: "Greek yoghurt with honey", type: "packaged", carbRange: [10, 16], energyRange: [110, 150] },
    { pt: "Loukoumades", en: "Loukoumades (honey doughnuts)", type: "recipe", carbRange: [40, 50], energyRange: [350, 410] },
  ],
  french: [
    { pt: "Sopa de cebola francesa", en: "French onion soup", type: "recipe", carbRange: [8, 14], energyRange: [70, 110] },
    { pt: "Crepe simples", en: "Plain crêpe", type: "recipe", carbRange: [24, 32], energyRange: [190, 230] },
    { pt: "Coq au vin", en: "Coq au vin", type: "recipe", carbRange: [4, 9], energyRange: [150, 200] },
    { pt: "Madalena francesa", en: "Madeleine cake", type: "packaged", carbRange: [46, 54], energyRange: [380, 430] },
    { pt: "Salada niçoise", en: "Niçoise salad", type: "recipe", carbRange: [6, 12], energyRange: [110, 150] },
  ],
  german: [
    { pt: "Currywurst", en: "Currywurst", type: "recipe", carbRange: [8, 14], energyRange: [230, 280] },
    { pt: "Spätzle", en: "Spätzle (egg noodles)", type: "recipe", carbRange: [24, 32], energyRange: [150, 190] },
    { pt: "Pão de centeio", en: "Rye bread", type: "packaged", carbRange: [42, 50], energyRange: [220, 260] },
    { pt: "Salada de repolho alemã", en: "German cabbage salad (Krautsalat)", type: "recipe", carbRange: [6, 12], energyRange: [45, 75] },
    { pt: "Lebkuchen", en: "Lebkuchen (spiced biscuit)", type: "packaged", carbRange: [55, 65], energyRange: [380, 430] },
  ],
  british: [
    { pt: "Torrada com feijão", en: "Beans on toast", type: "recipe", carbRange: [18, 26], energyRange: [130, 170] },
    { pt: "Bolo de frutas inglês", en: "English fruit cake", type: "packaged", carbRange: [48, 58], energyRange: [350, 400] },
    { pt: "Empada de carne inglesa", en: "British meat pie", type: "recipe", carbRange: [18, 26], energyRange: [230, 280] },
    { pt: "Torta de melaço", en: "Treacle tart", type: "recipe", carbRange: [48, 58], energyRange: [350, 400] },
    { pt: "Chá com leite", en: "Tea with milk", type: "packaged", carbRange: [1, 3], energyRange: [10, 25] },
  ],
  polish: [
    { pt: "Żurek (sopa de centeio fermentado)", en: "Żurek (sour rye soup)", type: "recipe", carbRange: [6, 12], energyRange: [70, 110] },
    { pt: "Placki ziemniaczane", en: "Potato pancakes (placki ziemniaczane)", type: "recipe", carbRange: [18, 26], energyRange: [160, 210] },
    { pt: "Kielbasa", en: "Kielbasa sausage", type: "ingredient", carbRange: [1, 4], energyRange: [260, 310] },
    { pt: "Sernik", en: "Sernik (Polish cheesecake)", type: "recipe", carbRange: [24, 32], energyRange: [280, 330] },
  ],
  mediterranean: [
    { pt: "Homus", en: "Hummus", type: "recipe", carbRange: [12, 18], energyRange: [160, 200] },
    { pt: "Salada de grão-de-bico", en: "Chickpea salad", type: "recipe", carbRange: [16, 22], energyRange: [120, 160] },
    { pt: "Peixe grelhado com azeite", en: "Grilled fish with olive oil", type: "recipe", carbRange: [0, 3], energyRange: [140, 190] },
    { pt: "Tabule", en: "Tabbouleh", type: "recipe", carbRange: [10, 16], energyRange: [80, 120] },
  ],
  european: [
    { pt: "Prato do dia europeu", en: "European daily-special plate", type: "recipe", carbRange: [15, 25], energyRange: [150, 220] },
    { pt: "Sanduíche mista", en: "Mixed sandwich", type: "recipe", carbRange: [28, 38], energyRange: [220, 280] },
    { pt: "Salada mista europeia", en: "Mixed European salad", type: "recipe", carbRange: [5, 12], energyRange: [60, 100] },
    { pt: "Sopa de vegetais europeia", en: "European vegetable soup", type: "recipe", carbRange: [6, 12], energyRange: [45, 75] },
  ],
};

const DEFAULT_CUISINE_KEY = "european";

const COUNTRY_CUISINE: Record<string, string> = {
  PT: "portuguese",
  ES: "spanish",
  IT: "italian",
  GR: "greek",
  FR: "french",
  DE: "german",
  GB: "british",
  PL: "polish",
};

const CUISINE_DEFAULT_COUNTRY: Record<string, string> = {
  portuguese: "PT",
  spanish: "ES",
  italian: "IT",
  greek: "GR",
  french: "FR",
  german: "DE",
  british: "GB",
  polish: "PL",
  mediterranean: "IT",
};

/** A single representative country per region id, used only to give a
 * generated candidate a plausible `countries[]` when the caller supplied a
 * `region` but no specific `country`. */
const REGION_REPRESENTATIVE_COUNTRY: Record<string, string> = {
  "southern-europe": "IT",
  "western-europe": "FR",
  "northern-europe": "GB",
  "eastern-europe": "PL",
  "north-africa": "MA",
  levant: "TR",
};

function resolveCuisineKey(params: FoodAiGenerateParams): string {
  const cuisine = params.cuisine?.trim().toLowerCase();
  if (cuisine && CUISINE_SEEDS[cuisine]) {
    return cuisine;
  }

  const country = params.country?.trim().toUpperCase();
  if (country) {
    const fromCountry = COUNTRY_CUISINE[country];
    if (fromCountry) return fromCountry;
  }

  const regionId = params.region?.trim().toLowerCase();
  if (regionId) {
    const region = REGIONS.find((candidate) => candidate.id === regionId);
    if (region?.mediterranean) return "mediterranean";
  }

  return DEFAULT_CUISINE_KEY;
}

function resolveCountries(params: FoodAiGenerateParams, cuisineKey: string): string[] {
  const country = params.country?.trim().toUpperCase();
  if (country) {
    return [country];
  }

  const regionId = params.region?.trim().toLowerCase();
  if (regionId) {
    const representative = REGION_REPRESENTATIVE_COUNTRY[regionId];
    if (representative) return [representative];

    const region = REGIONS.find((candidate) => candidate.id === regionId);
    const firstCountry = region?.countries[0];
    if (firstCountry) return [firstCountry];
  }

  return [CUISINE_DEFAULT_COUNTRY[cuisineKey] ?? "PT"];
}

function buildSource(id: string, market: string, seedIndex: number): SourceReference {
  return {
    sourceId: "AI-CANDIDATE",
    sourceRecordId: `AI-CANDIDATE-${seedIndex}`,
    sourceVersion: "ai-mock-0.1",
    market,
    licence: "ai-generated-unverified",
    // Fixed, non-wall-clock timestamp — kept deterministic like every other
    // value this provider produces (never a fresh `Date.now()` read).
    retrievedAt: "2026-01-01T00:00:00.000Z",
    rawSnapshotSha256: aiSnapshotHash(id),
    mappingVersion: "ai-mock-0.1",
  };
}

function buildNutrients(id: string, seed: AiNameSeed, market: string, seedIndex: number): NutrientObservation[] {
  const source = buildSource(id, market, seedIndex);
  const carbGrams = scaledValue(seedIndex * 7 + 1, seed.carbRange[0], seed.carbRange[1]);
  const energyKcal = Math.round(scaledValue(seedIndex * 13 + 3, seed.energyRange[0], seed.energyRange[1]));

  return [
    {
      nutrientCode: "CHOAVL",
      value: carbGrams,
      unit: "g",
      basisQuantity: 100,
      basisUnit: "g",
      method: "estimated",
      confidence: "unverified",
      source,
    },
    {
      nutrientCode: "ENERC",
      value: energyKcal,
      unit: "kcal",
      basisQuantity: 100,
      basisUnit: "g",
      method: "estimated",
      confidence: "unverified",
      source,
    },
  ];
}

/**
 * Fully offline, deterministic stand-in for a real AI/LLM food-generation
 * adapter. See the module header for the pluggable-seam and governance
 * contract this class must uphold.
 */
export class MockFoodAiProvider implements FoodAiProvider {
  generate(params: FoodAiGenerateParams): CanonicalFood[] {
    const cuisineKey = resolveCuisineKey(params);
    const seeds = CUISINE_SEEDS[cuisineKey] ?? CUISINE_SEEDS[DEFAULT_CUISINE_KEY] ?? [];
    const countries = resolveCountries(params, cuisineKey);

    const foods: CanonicalFood[] = [];
    for (let i = 0; i < params.count; i += 1) {
      const seedIndex = params.startIndex + i;
      const seed = seeds.length > 0 ? seeds[seedIndex % seeds.length] : undefined;
      if (!seed) {
        // Invariant guard: every cuisine key resolves to a non-empty seed
        // list (the "european" fallback is never empty), so this should be
        // unreachable — but fail loudly rather than emit a malformed food.
        throw new Error(`MockFoodAiProvider: no name seed available for cuisine "${cuisineKey}".`);
      }

      const id = `ai-candidate-${seedIndex}`;
      const market = countries[0] ?? "PT";

      foods.push({
        id,
        type: seed.type,
        names: [
          { language: "pt-PT", name: seed.pt, synonyms: seed.ptSynonyms ?? [] },
          { language: "en", name: seed.en, synonyms: [] },
        ],
        countries,
        markets: countries,
        barcodes: [],
        cuisineTags: [cuisineKey],
        dietaryPatternTags: [],
        mealContextTags: [],
        clinicalBehaviourTags: [],
        nutrients: buildNutrients(id, seed, market, seedIndex),
        // Always "candidate" — see the GOVERNANCE CONTRACT above. The caller
        // (admin route) enforces this a second time via
        // `FoodRepository.insertAiCandidate`.
        status: "candidate",
      });
    }
    return foods;
  }
}
