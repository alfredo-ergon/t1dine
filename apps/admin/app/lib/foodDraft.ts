// Pure helpers for the "Adicionar alimento" (manual add) form: turn the small
// set of fields a curator fills in into a fully-formed, boundary-valid
// `CanonicalFood` that `POST /admin/foods` will accept.
//
// The API re-validates the body with `collectCanonicalFoodErrors` and only
// accepts a complete canonical food, so this builder produces every required
// field — including a *synthetic* provenance block. That provenance is clearly
// marked as manually entered and its digest is a deterministic, NON-cryptographic
// filler (never a real content hash), mirroring the synthetic catalog's approach.

import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import type { CanonicalFood, FoodType } from "@t1dine/food-schema";

const NUTRIENT_CODE = { carbohydrate: "CHOAVL", energyKcal: "ENERC" } as const;

/** Cuisine tag applied by the "mediterrânica" toggle. Cuisine is a SEPARATE
 * axis from the geographic area taxonomy — see `regions.ts`. */
export const MEDITERRANEAN_CUISINE_TAG = "mediterranica";

/** Accent-insensitive, lowercase, hyphenated slug for a food id. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Deterministic, NON-cryptographic 64-hex filler that satisfies the
 * source-digest boundary check (`/^[0-9a-f]{64}$/`). SYNTHETIC provenance only —
 * this is never a real content hash. Kept pure (FNV-1a-style) so a given seed
 * always yields the same digest.
 */
export function syntheticDigest(seed: string): string {
  const basis = seed.length > 0 ? seed : "t1dine";
  let hash = 2166136261 >>> 0;
  let out = "";
  for (let i = 0; i < 64; i += 1) {
    hash ^= basis.charCodeAt(i % basis.length) + i;
    hash = Math.imul(hash, 16777619) >>> 0;
    out += (hash & 0xf).toString(16);
  }
  return out;
}

export interface ManualFoodInput {
  namePt: string;
  nameEn: string;
  /** ISO 3166-1 alpha-2 country code (e.g. "PT"). */
  country: string;
  type: FoodType;
  /** Available carbohydrate, g per 100 g. */
  carbPer100g: number;
  /** Energy, kcal per 100 g. */
  energyKcalPer100g: number;
  /** Free-form cuisine tags (a SEPARATE axis from geography). */
  cuisineTags: string[];
  /** When true, adds the Mediterranean cuisine tag. */
  mediterranean: boolean;
  /** Optional id-uniqueness suffix; defaults to a time-based token. Injectable
   * for deterministic tests. */
  idSuffix?: string;
}

function buildSource(country: string, recordId: string): SourceReference {
  return {
    sourceId: "ADMIN",
    sourceRecordId: recordId,
    sourceVersion: "manual",
    market: country,
    licence: "sintético — inserido manualmente pela curadoria",
    retrievedAt: new Date().toISOString(),
    rawSnapshotSha256: syntheticDigest(recordId),
    mappingVersion: "manual-0.1",
  };
}

function buildNutrients(input: ManualFoodInput, source: SourceReference): NutrientObservation[] {
  const base = { basisQuantity: 100, basisUnit: "g", method: "declared", confidence: "medium", source } as const;
  return [
    { nutrientCode: NUTRIENT_CODE.carbohydrate, ...base, value: input.carbPer100g, unit: "g" },
    { nutrientCode: NUTRIENT_CODE.energyKcal, ...base, value: input.energyKcalPer100g, unit: "kcal" },
  ];
}

/** Merges free-form cuisine tags with the Mediterranean toggle, de-duplicating
 * and dropping blanks. */
export function resolveCuisineTags(cuisineTags: string[], mediterranean: boolean): string[] {
  const tags = cuisineTags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0);
  if (mediterranean) tags.push(MEDITERRANEAN_CUISINE_TAG);
  return [...new Set(tags)];
}

/**
 * Build a boundary-valid `CanonicalFood` from the manual-add fields. The caller
 * should still run `collectCanonicalFoodErrors` on the result before sending it
 * (the same check the API applies) so any bad field is surfaced in the UI.
 */
export function buildManualFood(input: ManualFoodInput): CanonicalFood {
  const country = input.country.trim().toUpperCase();
  const suffix = input.idSuffix ?? Date.now().toString(36);
  const baseSlug = slugify(input.namePt) || "alimento";
  const id = `${country.toLowerCase()}-${baseSlug}-${suffix}`;
  const source = buildSource(country, `ADMIN-${id}`);

  return {
    id,
    type: input.type,
    names: [
      { language: "pt-PT", name: input.namePt.trim(), synonyms: [] },
      { language: "en", name: input.nameEn.trim(), synonyms: [] },
    ],
    countries: [country],
    markets: [country],
    barcodes: [],
    cuisineTags: resolveCuisineTags(input.cuisineTags, input.mediterranean),
    dietaryPatternTags: [],
    mealContextTags: [],
    clinicalBehaviourTags: [],
    nutrients: buildNutrients(input, source),
    status: "approved",
  };
}
