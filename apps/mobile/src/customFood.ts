// Builds a CanonicalFood from a user's own estimate. This is the only place
// custom foods are constructed, so provenance/uncertainty rules stay in one
// spot: sourceId "USER", method "estimated", confidence "unverified",
// licence "user-created", and status "candidate" — never presented as
// authoritative (CLAUDE.md: "User-created and AI-estimated foods must
// display uncertainty and provenance").

import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import type { CanonicalFood } from "@t1dine/food-schema";
import { assertCanonicalFood } from "@t1dine/food-schema";

export interface CustomFoodInput {
  namePt: string;
  nameEn: string;
  carbPer100g: number;
  energyPer100gKcal: number;
  /** Optional barcode to associate with this food (Slice: barcode scanning —
   * the "not found" fallback pre-fills this from the scanned/typed code so
   * the food becomes findable by barcode next time). Absent for the normal
   * "+ Novo alimento" entry point. */
  barcode?: string;
}

export function createCustomFoodId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function userSourceReference(recordId: string): SourceReference {
  return {
    sourceId: "USER",
    sourceRecordId: recordId,
    sourceVersion: "1",
    licence: "user-created",
    retrievedAt: new Date().toISOString(),
    // No raw file was ingested for a user estimate; an all-zero digest is the
    // documented placeholder this codebase already uses for "no snapshot".
    rawSnapshotSha256: "0".repeat(64),
    mappingVersion: "user-input-1",
  };
}

function userObservation(nutrientCode: string, value: number, unit: NutrientObservation["unit"], id: string): NutrientObservation {
  return {
    nutrientCode,
    value,
    unit,
    basisQuantity: 100,
    basisUnit: "g",
    method: "estimated",
    confidence: "unverified",
    source: userSourceReference(`USER-${id}-${nutrientCode}`),
  };
}

export function buildCustomFood(input: CustomFoodInput, id: string = createCustomFoodId()): CanonicalFood {
  const namePt = input.namePt.trim();
  const nameEn = input.nameEn.trim().length > 0 ? input.nameEn.trim() : namePt;

  const food: CanonicalFood = {
    id,
    type: "custom",
    names: [
      { language: "pt-PT", name: namePt, synonyms: [] },
      { language: "en", name: nameEn, synonyms: [] },
    ],
    countries: [],
    markets: [],
    barcodes: input.barcode ? [input.barcode] : [],
    cuisineTags: [],
    dietaryPatternTags: [],
    mealContextTags: [],
    clinicalBehaviourTags: [],
    nutrients: [
      userObservation("CHOAVL", input.carbPer100g, "g", id),
      userObservation("ENERC", input.energyPer100gKcal, "kcal", id),
    ],
    status: "candidate",
  };

  // Boundary check: user typing produced this object, so validate it against
  // the canonical contract before it ever reaches app state or storage.
  assertCanonicalFood(food);
  return food;
}
