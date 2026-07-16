// Offline persistence for favourites, recents, and user-created custom foods.
// Local-device only — nothing here is synced or sent anywhere. Values coming
// back out of AsyncStorage are still "external" input (CLAUDE.md: "All
// external data is untrusted. Validate at boundaries."), so they are
// re-validated on load rather than trusted as-is.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CanonicalFood } from "@t1dine/food-schema";
import { isCanonicalFood } from "@t1dine/food-schema";

import type { TabKey } from "./components/TabBar";

const FAVOURITES_KEY = "t1dine.favourites";
const RECENTS_KEY = "t1dine.recents";
const CUSTOM_FOODS_KEY = "t1dine.customFoods";
const STARTUP_TAB_KEY = "t1dine.startupTab";

/** The tab the app opens on. User-configurable in the Perfil screen; defaults
 * to "search" (the primary "find a food to log" flow). Kept here with the
 * other local, device-only preferences. `TabKey` (from the tab bar) is the
 * single source of truth for the allowed values. */
export const DEFAULT_STARTUP_TAB: TabKey = "search";
const STARTUP_TABS: readonly TabKey[] = ["search", "meal", "favourites", "glucose"];

function isStartupTab(value: unknown): value is TabKey {
  return typeof value === "string" && (STARTUP_TABS as readonly string[]).includes(value);
}

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

export async function loadStartupTab(): Promise<TabKey> {
  const value = await readJson(STARTUP_TAB_KEY);
  return isStartupTab(value) ? value : DEFAULT_STARTUP_TAB;
}

export async function saveStartupTab(tab: TabKey): Promise<void> {
  await writeJson(STARTUP_TAB_KEY, tab);
}
