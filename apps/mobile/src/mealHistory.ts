// Local-first store for the meal "Diário" (history) — a DATED LOG of meals
// actually eaten, distinct from ../savedMeals.ts's reusable "Refeições
// guardadas" templates (a saved meal has no date; a history entry always
// does, and is never silently rewritten to a different date — see
// updateHistoryEntry below). Mirrors ../savedMeals.ts and ../submissions.ts:
// a single AsyncStorage key, best-effort writes (a storage failure must
// never block the offline-first UI), and every value read back out is
// re-validated rather than trusted (CLAUDE.md: "All external data is
// untrusted. Validate at boundaries.").
//
// Each history entry snapshots its own `carbPer100g` per item (see
// buildHistoryEntryFromLines), exactly like a saved meal, so "Reutilizar"/
// "Editar" can always recompute correct totals even if the original food is
// later edited, removed from the catalog, or unavailable offline. If the
// food can no longer be found by id when reusing/editing,
// resolveHistoryEntryToLines() builds a clearly-marked ("unverified")
// placeholder food from the logged name + carbPer100g rather than silently
// dropping the item or guessing (CLAUDE.md: "User-created and AI-estimated
// foods must display uncertainty and provenance").
//
// This module has no i18n/React dependency of its own (like savedMeals.ts) —
// callers supply a `resolveName` function for the current display language.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import type { CanonicalFood } from "@t1dine/food-schema";
import { assertCanonicalFood } from "@t1dine/food-schema";
import type { MealLine } from "@t1dine/nutrition";
import { CARBOHYDRATE_CODE, ENERGY_CODE, summariseMeal } from "@t1dine/nutrition";

import { getActiveProfileId, migrateLegacyKey, profileKey } from "./profiles";

// Slice: caregiver profiles ("Perfis"). The Diário is per-profile — a
// caregiver's own meal history must never leak into a dependent's, and vice
// versa. `HISTORY_KEY` below is used as the "base" passed to
// `profileKey`/`migrateLegacyKey`; the pre-profiles Diário that used to live
// directly under it is inherited, non-destructively, by the default profile.
const HISTORY_KEY = "t1dine.mealHistory";

export interface HistoryItem {
  /** The CanonicalFood id this item was built from, used to re-resolve fresh nutrient data on reuse/edit. */
  foodId: string;
  /** Display name captured at log time — also the fallback label if the food is ever unavailable later. */
  name: string;
  /** Editable quantity, in grams (or millilitres, matching the food's basis), as it was actually eaten. */
  quantityGrams: number;
  /** Carbohydrate (g) per 100 g/ml of this food, captured at log time. */
  carbPer100g: number;
  /**
   * Energy (kcal) per 100 g/ml of this food, captured at log time — optional
   * because it was added after carbPer100g and older persisted entries won't
   * have it (never backfilled; see buildFallbackFood). When present, lets a
   * reused/edited entry whose original food can no longer be found
   * (buildFallbackFood) still report real energy instead of the 0 kcal a
   * carb-only placeholder would otherwise show.
   */
  energyPer100g?: number;
}

export interface HistoryEntry {
  id: string;
  /** ISO timestamp of when this meal was actually eaten (logged). */
  loggedAt: string;
  /** Optional user-given label (e.g. "Almoço de sábado"). Never required —
   * see historyEntryLabel() for the always-present display fallback. */
  name?: string;
  items: HistoryItem[];
  totalCarbGrams: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isHistoryItem(value: unknown): value is HistoryItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.foodId === "string" &&
    item.foodId.length > 0 &&
    typeof item.name === "string" &&
    isFiniteNumber(item.quantityGrams) &&
    item.quantityGrams >= 0 &&
    isFiniteNumber(item.carbPer100g) &&
    (item.energyPer100g === undefined || isFiniteNumber(item.energyPer100g))
  );
}

/** Exported for tests and for defensive checks elsewhere — not required by day-to-day callers. */
export function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    entry.id.length > 0 &&
    typeof entry.loggedAt === "string" &&
    (entry.name === undefined || typeof entry.name === "string") &&
    Array.isArray(entry.items) &&
    entry.items.length > 0 &&
    entry.items.every(isHistoryItem) &&
    isFiniteNumber(entry.totalCarbGrams)
  );
}

export function createHistoryEntryId(): string {
  return `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Builds a HistoryEntry snapshot from the current editable meal (MealLine[])
 * — used by the Meal screen's "Registar no diário" action, and again when
 * "Atualizar registo" rebuilds an existing entry's items/total from the
 * (edited) current meal. `resolveName` lets the caller supply the
 * current-language display name (this module stays free of any i18n
 * dependency, matching savedMeals.ts/submissions.ts). `loggedAt` defaults to
 * "now" but is overridable so an in-place edit can preserve the entry's
 * original logged time (see updateHistoryEntry).
 */
export function buildHistoryEntryFromLines(
  lines: MealLine[],
  resolveName: (food: CanonicalFood) => string,
  name?: string,
  loggedAt: string = new Date().toISOString(),
): HistoryEntry {
  const summary = summariseMeal(lines);
  const items: HistoryItem[] = summary.lines.map((line) => {
    const energyPer100g =
      line.amount > 0 && Number.isFinite(line.energyKcal) && line.energyKcal > 0
        ? round1((line.energyKcal / line.amount) * 100)
        : undefined;
    return {
      foodId: line.food.id,
      name: resolveName(line.food),
      quantityGrams: line.amount,
      carbPer100g: line.amount > 0 ? round1((line.carbGrams / line.amount) * 100) : 0,
      ...(energyPer100g !== undefined ? { energyPer100g } : {}),
    };
  });

  const trimmedName = name?.trim();

  return {
    id: createHistoryEntryId(),
    loggedAt,
    name: trimmedName && trimmedName.length > 0 ? trimmedName : undefined,
    items,
    totalCarbGrams: summary.totalCarbGrams,
  };
}

function fallbackSourceReference(foodId: string): SourceReference {
  return {
    sourceId: "MEAL_HISTORY",
    sourceRecordId: `HISTORY-${foodId}`,
    sourceVersion: "1",
    licence: "user-created",
    retrievedAt: new Date().toISOString(),
    // No raw file was ingested for this snapshot — same documented
    // all-zero placeholder ../customFood.ts / ../savedMeals.ts use for "no snapshot".
    rawSnapshotSha256: "0".repeat(64),
    mappingVersion: "meal-history-fallback-1",
  };
}

/**
 * Builds a stand-in CanonicalFood for a history-entry item whose original
 * food can no longer be found (removed/edited since logging, or simply not
 * present in this device's current catalog+custom-foods list) — built from
 * the name and carbPer100g captured at log time. Always unverified/candidate:
 * this is a best-effort echo of what was logged, never a re-verified
 * canonical record.
 */
export function buildFallbackFood(item: HistoryItem): CanonicalFood {
  const safeName = item.name.trim().length > 0 ? item.name.trim() : item.foodId;

  const carbObservation: NutrientObservation = {
    nutrientCode: CARBOHYDRATE_CODE,
    value: item.carbPer100g,
    unit: "g",
    basisQuantity: 100,
    basisUnit: "g",
    method: "estimated",
    confidence: "unverified",
    source: fallbackSourceReference(item.foodId),
  };

  // Energy is only present on entries logged after this field was
  // introduced (see HistoryItem.energyPer100g) — never fabricated for
  // older persisted entries that genuinely lack it (CLAUDE.md: never
  // fabricate a value that is unknown).
  const energyObservation: NutrientObservation | undefined =
    item.energyPer100g !== undefined && Number.isFinite(item.energyPer100g)
      ? {
          nutrientCode: ENERGY_CODE,
          value: item.energyPer100g,
          unit: "kcal",
          basisQuantity: 100,
          basisUnit: "g",
          method: "estimated",
          confidence: "unverified",
          source: fallbackSourceReference(item.foodId),
        }
      : undefined;

  const food: CanonicalFood = {
    id: `history-missing-${item.foodId}`,
    type: "custom",
    names: [
      { language: "pt-PT", name: safeName, synonyms: [] },
      { language: "en", name: safeName, synonyms: [] },
    ],
    countries: [],
    markets: [],
    barcodes: [],
    cuisineTags: [],
    dietaryPatternTags: [],
    mealContextTags: [],
    clinicalBehaviourTags: [],
    nutrients: energyObservation ? [carbObservation, energyObservation] : [carbObservation],
    status: "candidate",
  };

  // Boundary check, as ../customFood.ts/../savedMeals.ts do — this object is
  // built from data that round-tripped through AsyncStorage.
  assertCanonicalFood(food);
  return food;
}

/**
 * Reconstructs the editable MealLine[] for a history entry's "Reutilizar"/
 * "Editar" actions — resolving each item against the app's currently known
 * foods (catalog + custom foods) where possible, so any nutrient corrections
 * made since the meal was logged are picked up, and falling back to a
 * clearly unverified placeholder (never silently dropping the item)
 * otherwise.
 *
 * Always returns a fresh array of fresh line objects: loading a history
 * entry this way never mutates the HistoryEntry record itself, so subsequent
 * quantity edits in the current meal builder never touch the logged
 * original unless the user explicitly taps "Atualizar registo" afterwards.
 */
export function resolveHistoryEntryToLines(entry: HistoryEntry, knownFoods: CanonicalFood[]): MealLine[] {
  return entry.items.map((item) => {
    const food = knownFoods.find((candidate) => candidate.id === item.foodId);
    return { food: food ?? buildFallbackFood(item), amount: item.quantityGrams };
  });
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Local (device-timezone) "HH:MM" for a logged ISO timestamp — used both as
 * the fallback display label (see historyEntryLabel) and as the always-shown
 * "time" on each Diário entry row. Deliberately uses the LOCAL wall clock
 * (not the raw UTC ISO string) so what's shown always matches when the user
 * actually logged the meal, on their own device/timezone. */
export function historyTimeLabel(loggedAt: string): string {
  const parsed = new Date(loggedAt);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
}

/** Local (device-timezone) "YYYY-MM-DD" day key for a logged ISO timestamp —
 * used to group Diário entries by the calendar day they were actually eaten
 * on (local time), not by their raw UTC date, which could shift near
 * midnight for users away from UTC. Also accepts a plain `Date` so callers
 * can compute "today"/"yesterday" keys to compare group headers against. */
export function historyDateKey(value: string | Date): string {
  const parsed = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return typeof value === "string" ? value.slice(0, 10) : "";
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

/** Display label for a history entry: its user-given name if present, else a
 * fallback of the local time it was logged — every entry always has SOME
 * readable label, without requiring a name at log time. */
export function historyEntryLabel(entry: HistoryEntry): string {
  const trimmed = entry.name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : historyTimeLabel(entry.loggedAt);
}

async function readJson(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    // Corrupt or unavailable storage must never crash the app — fall back
    // to an empty/default state and keep working offline.
    return undefined;
  }
}

/**
 * Loads every history entry on this device, most-recently-logged first.
 * Never throws — corrupt/unavailable storage degrades to an empty list, and
 * any record that no longer matches the shape is dropped rather than
 * crashing the app (CLAUDE.md: "All external data is untrusted. Validate at
 * boundaries.").
 */
export async function loadHistory(): Promise<HistoryEntry[]> {
  const profileId = getActiveProfileId();
  const key = profileKey(HISTORY_KEY, profileId);
  await migrateLegacyKey(HISTORY_KEY, profileId, key);
  const value = await readJson(key);
  if (!Array.isArray(value)) return [];
  return value.filter(isHistoryEntry).sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}

async function persistHistory(entries: HistoryEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(profileKey(HISTORY_KEY, getActiveProfileId()), JSON.stringify(entries));
  } catch {
    // Best-effort persistence only.
  }
}

/**
 * Records a just-logged meal at the front of the on-device Diário
 * (de-duplicated by id). Reads the current on-device list fresh rather than
 * trusting an in-memory copy passed in by the caller (mirrors
 * ../submissions.ts's recordSubmission) — safe to call even before the
 * caller's own in-memory mirror of history has finished hydrating from
 * storage at app startup. Returns the resulting list so the caller can sync
 * its in-memory state from a single source of truth.
 */
export async function logMeal(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const existing = await loadHistory();
  const next = [entry, ...existing.filter((item) => item.id !== entry.id)];
  await persistHistory(next);
  return next;
}

/**
 * Replaces an existing history entry by id — used by the "Atualizar
 * registo" action to correct a logging mistake (e.g. a wrong quantity) IN
 * PLACE, preserving the entry's id/loggedAt (and typically its name),
 * rather than creating a brand-new dated entry via logMeal(). A no-op
 * (returns the current list unchanged) if no entry with this id currently
 * exists on this device — e.g. it was deleted from another flow first.
 */
export async function updateHistoryEntry(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const existing = await loadHistory();
  if (!existing.some((item) => item.id === entry.id)) return existing;
  const next = existing.map((item) => (item.id === entry.id ? entry : item));
  await persistHistory(next);
  return next;
}

/** Deletes a single history entry ("Apagar"). Returns the resulting list. */
export async function deleteHistoryEntry(id: string): Promise<HistoryEntry[]> {
  const existing = await loadHistory();
  const next = existing.filter((item) => item.id !== id);
  await persistHistory(next);
  return next;
}

/** Slice 5 — local data rights: wipes the ACTIVE profile's entire Diário.
 * Best-effort: a write failure here must never surface as an error in the
 * offline-first UI. */
export async function clearHistory(): Promise<void> {
  await persistHistory([]);
}

/**
 * Removes THIS SPECIFIC profile's entire Diário — used when a profile is
 * deleted (App.tsx's handleDeleteProfile) or when every profile's data is
 * wiped ("Apagar todos os meus dados"). Takes an explicit `profileId` (not
 * necessarily the active one), unlike `clearHistory` above.
 */
export async function clearProfileData(profileId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(profileKey(HISTORY_KEY, profileId));
  } catch {
    // Best-effort persistence only.
  }
}
