// Offline persistence for favourites, recents, and user-created custom foods.
// Local-device only — nothing here is synced or sent anywhere. Values coming
// back out of AsyncStorage are still "external" input (CLAUDE.md: "All
// external data is untrusted. Validate at boundaries."), so they are
// re-validated on load rather than trusted as-is.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CanonicalFood } from "@t1dine/food-schema";
import { isCanonicalFood } from "@t1dine/food-schema";

const FAVOURITES_KEY = "t1dine.favourites";
const RECENTS_KEY = "t1dine.recents";
const CUSTOM_FOODS_KEY = "t1dine.customFoods";

/** Cap on how many recently-viewed foods are remembered. */
export const RECENTS_LIMIT = 20;

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

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort persistence; offline-first UX must not block on storage errors.
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function loadFavouriteIds(): Promise<string[]> {
  const value = await readJson(FAVOURITES_KEY);
  return isStringArray(value) ? value : [];
}

export async function saveFavouriteIds(ids: string[]): Promise<void> {
  await writeJson(FAVOURITES_KEY, ids);
}

export async function loadRecentIds(): Promise<string[]> {
  const value = await readJson(RECENTS_KEY);
  return isStringArray(value) ? value.slice(0, RECENTS_LIMIT) : [];
}

export async function saveRecentIds(ids: string[]): Promise<void> {
  await writeJson(RECENTS_KEY, ids.slice(0, RECENTS_LIMIT));
}

export async function loadCustomFoods(): Promise<CanonicalFood[]> {
  const value = await readJson(CUSTOM_FOODS_KEY);
  if (!Array.isArray(value)) return [];
  // Re-validate every record: a future schema change or a hand-edited
  // storage blob must degrade to "skip the bad record", never crash.
  return value.filter(isCanonicalFood);
}

export async function saveCustomFoods(foods: CanonicalFood[]): Promise<void> {
  await writeJson(CUSTOM_FOODS_KEY, foods);
}
