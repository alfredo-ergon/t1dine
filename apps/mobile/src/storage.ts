// Offline persistence for favourites, recents, and user-created custom foods.
// Local-device only — nothing here is synced or sent anywhere. Values coming
// back out of AsyncStorage are still "external" input (CLAUDE.md: "All
// external data is untrusted. Validate at boundaries."), so they are
// re-validated on load rather than trusted as-is.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CanonicalFood } from "@t1dine/food-schema";
import { isCanonicalFood } from "@t1dine/food-schema";

import type { TabKey } from "./components/TabBar";
import { getActiveProfileId, migrateLegacyKey, profileKey } from "./profiles";

// Slice: caregiver profiles ("Perfis"). Favourites/recents/custom foods are
// per-profile — a caregiver's own recently-viewed/favourited foods must never
// leak into a dependent's profile, and vice versa. `STARTUP_TAB_KEY` below is
// deliberately NOT namespaced: which tab the app opens on is a device-level
// UI convenience, not personal food/health data.
//
// Each of these three legacy key names is now used as the "base" passed to
// `profileKey`/`migrateLegacyKey` — the pre-profiles data that used to live
// directly under it is inherited, non-destructively, by the default profile
// (see `migrateLegacyKey` in ./profiles.ts).
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
  const profileId = getActiveProfileId();
  const key = profileKey(FAVOURITES_KEY, profileId);
  await migrateLegacyKey(FAVOURITES_KEY, profileId, key);
  const value = await readJson(key);
  return isStringArray(value) ? value : [];
}

export async function saveFavouriteIds(ids: string[]): Promise<void> {
  await writeJson(profileKey(FAVOURITES_KEY, getActiveProfileId()), ids);
}

export async function loadRecentIds(): Promise<string[]> {
  const profileId = getActiveProfileId();
  const key = profileKey(RECENTS_KEY, profileId);
  await migrateLegacyKey(RECENTS_KEY, profileId, key);
  const value = await readJson(key);
  return isStringArray(value) ? value.slice(0, RECENTS_LIMIT) : [];
}

export async function saveRecentIds(ids: string[]): Promise<void> {
  await writeJson(profileKey(RECENTS_KEY, getActiveProfileId()), ids.slice(0, RECENTS_LIMIT));
}

export async function loadCustomFoods(): Promise<CanonicalFood[]> {
  const profileId = getActiveProfileId();
  const key = profileKey(CUSTOM_FOODS_KEY, profileId);
  await migrateLegacyKey(CUSTOM_FOODS_KEY, profileId, key);
  const value = await readJson(key);
  if (!Array.isArray(value)) return [];
  // Re-validate every record: a future schema change or a hand-edited
  // storage blob must degrade to "skip the bad record", never crash.
  return value.filter(isCanonicalFood);
}

export async function saveCustomFoods(foods: CanonicalFood[]): Promise<void> {
  await writeJson(profileKey(CUSTOM_FOODS_KEY, getActiveProfileId()), foods);
}

/**
 * Removes THIS SPECIFIC profile's favourites/recents/custom foods — used
 * when a profile is deleted (App.tsx's handleDeleteProfile) or when every
 * profile's data is wiped ("Apagar todos os meus dados"). Takes an explicit
 * `profileId` (not necessarily the active one) since a profile being deleted
 * is never the active one (../profiles.ts's deleteProfile refuses that).
 * Never touches the legacy un-namespaced key or any OTHER profile's
 * namespaced key.
 */
export async function clearProfileData(profileId: string): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      profileKey(FAVOURITES_KEY, profileId),
      profileKey(RECENTS_KEY, profileId),
      profileKey(CUSTOM_FOODS_KEY, profileId),
    ]);
  } catch {
    // Best-effort persistence only.
  }
}

export async function loadStartupTab(): Promise<TabKey> {
  const value = await readJson(STARTUP_TAB_KEY);
  return isStartupTab(value) ? value : DEFAULT_STARTUP_TAB;
}

export async function saveStartupTab(tab: TabKey): Promise<void> {
  await writeJson(STARTUP_TAB_KEY, tab);
}
