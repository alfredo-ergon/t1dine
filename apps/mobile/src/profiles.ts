// Local-first store for CAREGIVER PROFILES ("Perfis") — one device holding
// several profiles (the caregiver's own "self" profile, plus any dependents
// they manage), each with its OWN local data. This module owns exactly two
// things:
//
//   1. The profile LIST (id/name/kind/createdAt) — a single AsyncStorage key,
//      read-current-then-write functions (addProfile/renameProfile/
//      deleteProfile), mirroring ../recipes.ts's saveRecipe/deleteRecipe.
//
//   2. The ACTIVE profile id — a single AsyncStorage key, plus a
//      synchronously-readable in-memory cache (`getActiveProfileId`) so every
//      OTHER per-profile store (../storage.ts, ../mealHistory.ts,
//      ../savedMeals.ts, ../recipes.ts, ../submissions.ts,
//      ../nightscoutStore.ts, ../dose/profileStorage.ts) can namespace its own
//      AsyncStorage/SecureStore keys by "whichever profile is active right
//      now" WITHOUT every call site across the app (screens included) having
//      to thread a profileId prop through. That is what keeps namespacing
//      those seven stores a surgical, consistent change rather than a rewrite
//      of every screen that already calls them.
//
// SAFETY (cross-profile isolation): switching the active profile must never
// mix data between profiles. App.tsx's switch flow always does, in order:
// (1) persist + update the cached active id via `setActiveProfile`, THEN
// (2) reload every per-profile store fresh for the newly active profile —
// never trusting in-memory state carried over from the previous profile.
// `getActiveProfileId()` is only ever read synchronously at the START of a
// store's own load/save call (before any `await`), so there is no window
// where a store call can straddle two different active profiles mid-flight.
//
// This module has no i18n/React dependency of its own (like ../recipes.ts) —
// the caller supplies the localized default profile name ("Eu"/"Me") to
// `loadProfiles`/`resetToDefaultProfile`.

import AsyncStorage from "@react-native-async-storage/async-storage";

export type ProfileKind = "self" | "dependent";

export interface Profile {
  id: string;
  name: string;
  kind: ProfileKind;
  createdAt: string;
}

const PROFILES_KEY = "t1dine.profiles";
const ACTIVE_PROFILE_KEY = "t1dine.activeProfileId";

/**
 * Stable id for the single profile every device starts with — NEVER randomly
 * generated, so every per-profile store's non-destructive legacy migration
 * (see `migrateLegacyKey` below, used by e.g. ../storage.ts) can target it
 * deterministically, independent of load order or how many profiles have
 * since been added.
 */
export const DEFAULT_PROFILE_ID = "default";

/**
 * In-memory mirror of the persisted active profile id, updated by
 * `loadProfiles`/`setActiveProfile`. Defaults to `DEFAULT_PROFILE_ID` — the
 * correct value before the very first load resolves, since a fresh
 * install/first run has no other profile to be "active" instead.
 */
let cachedActiveProfileId: string = DEFAULT_PROFILE_ID;

/**
 * Synchronous "whichever profile is active right now" — the single thing
 * every other per-profile store reads to namespace its own storage key.
 * Always reflects the most recent successful `loadProfiles`/`setActiveProfile`
 * call. Callers must ensure `loadProfiles()` has resolved once (e.g. behind
 * App.tsx's startup Splash gate) before relying on this for anything other
 * than the safe `DEFAULT_PROFILE_ID` fallback.
 */
export function getActiveProfileId(): string {
  return cachedActiveProfileId;
}

/**
 * Builds a profile-scoped AsyncStorage key: `"<base>::<profileId>"`. Pure —
 * used by every AsyncStorage-backed per-profile store. `../nightscoutStore.ts`
 * deliberately does NOT use this (its expo-secure-store keys only allow
 * alphanumeric characters, ".", "-", and "_" — "::" is not permitted there),
 * so it has its own, differently-separated key helper.
 */
export function profileKey(base: string, profileId: string): string {
  return `${base}::${profileId}`;
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

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort persistence; offline-first UX must not block on storage errors.
  }
}

function isProfileKind(value: unknown): value is ProfileKind {
  return value === "self" || value === "dependent";
}

function isProfile(value: unknown): value is Profile {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    p.id.length > 0 &&
    typeof p.name === "string" &&
    p.name.trim().length > 0 &&
    isProfileKind(p.kind) &&
    typeof p.createdAt === "string"
  );
}

export function createProfileId(): string {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDefaultProfile(defaultName: string): Profile {
  return { id: DEFAULT_PROFILE_ID, name: defaultName, kind: "self", createdAt: new Date().toISOString() };
}

/**
 * Loads every profile on this device, in the order they were created. Never
 * throws — corrupt/unavailable storage degrades to an empty list, and any
 * record that no longer matches the shape is dropped rather than crashing the
 * app (CLAUDE.md: "All external data is untrusted. Validate at boundaries.").
 * Does NOT seed a default profile — see `loadProfiles` for the seeding
 * (first-run) case; this is the plain read used by add/rename/delete below.
 */
export async function loadProfileList(): Promise<Profile[]> {
  const stored = await readJson(PROFILES_KEY);
  return Array.isArray(stored) ? stored.filter(isProfile) : [];
}

async function persistProfiles(profiles: Profile[]): Promise<void> {
  await writeJson(PROFILES_KEY, profiles);
}

export interface LoadedProfiles {
  profiles: Profile[];
  activeProfileId: string;
}

/**
 * Loads the profile list + active profile id, seeding a single default
 * profile (kind "self", the caller-supplied localized `defaultName` — e.g.
 * "Eu"/"Me") and marking it active when this device has never had any
 * profile persisted before — a fresh install, or (just as importantly) a
 * pre-profiles install being opened for the first time after this feature
 * ships. Either way, this is exactly the case every per-profile store's own
 * migration (`migrateLegacyKey`) depends on: the newly-seeded profile's id is
 * always `DEFAULT_PROFILE_ID`, so a legacy, un-namespaced key from before
 * profiles existed is inherited by THIS profile, non-destructively, the first
 * time each store is read. Updates (and returns) the synchronous
 * `getActiveProfileId()` cache before resolving, so every other store reads
 * the correct namespace immediately afterwards.
 */
export async function loadProfiles(defaultName: string): Promise<LoadedProfiles> {
  const existingProfiles = await loadProfileList();

  let profiles = existingProfiles;
  if (profiles.length === 0) {
    profiles = [buildDefaultProfile(defaultName)];
    await persistProfiles(profiles);
  }

  const storedActiveId = await readJson(ACTIVE_PROFILE_KEY);
  const activeProfileId =
    typeof storedActiveId === "string" && profiles.some((profile) => profile.id === storedActiveId)
      ? storedActiveId
      : profiles[0].id;

  if (activeProfileId !== storedActiveId) {
    await writeJson(ACTIVE_PROFILE_KEY, activeProfileId);
  }

  cachedActiveProfileId = activeProfileId;
  return { profiles, activeProfileId };
}

/**
 * Persists + activates `profileId` as the device's active profile — updates
 * the synchronous `getActiveProfileId()` cache FIRST (before the `await`),
 * so it is safe to rely on immediately, even before this promise settles.
 * The caller (App.tsx's profile-switch flow) is responsible for reloading
 * every per-profile store's in-memory state afterwards; this function only
 * ever changes WHICH profile is active, never any profile's own data.
 */
export async function setActiveProfile(profileId: string): Promise<void> {
  cachedActiveProfileId = profileId;
  await writeJson(ACTIVE_PROFILE_KEY, profileId);
}

/**
 * Adds a brand-new profile (kind "self" or "dependent") to the list. Reads
 * the current on-device list fresh before writing (mirrors
 * ../mealHistory.ts's logMeal), so it's safe even before a caller's own
 * in-memory mirror has finished hydrating. Returns the resulting list.
 */
export async function addProfile(name: string, kind: ProfileKind): Promise<Profile[]> {
  const trimmed = name.trim();
  const profile: Profile = {
    id: createProfileId(),
    name: trimmed.length > 0 ? trimmed : name,
    kind,
    createdAt: new Date().toISOString(),
  };
  const existing = await loadProfileList();
  const next = [...existing, profile];
  await persistProfiles(next);
  return next;
}

/**
 * Renames a profile in place. A no-op (returns the list unchanged) for a
 * blank/whitespace-only name, or for an id that no longer exists on-device.
 */
export async function renameProfile(id: string, name: string): Promise<Profile[]> {
  const trimmed = name.trim();
  const existing = await loadProfileList();
  if (trimmed.length === 0) return existing;
  if (!existing.some((profile) => profile.id === id)) return existing;
  const next = existing.map((profile) => (profile.id === id ? { ...profile, name: trimmed } : profile));
  await persistProfiles(next);
  return next;
}

/**
 * Removes a profile from the list — a hard safety backstop, defence in
 * depth alongside the UI (../screens/ProfilesScreen.tsx), which must never
 * offer deleting the active profile or the last remaining one:
 *   - refuses to delete the CURRENTLY ACTIVE profile (a caregiver must
 *     switch away first — deleting "out from under" the profile currently
 *     being viewed/logged against is exactly the "wrong profile" mistake
 *     this feature exists to prevent);
 *   - refuses to delete the LAST remaining profile (a device must always
 *     have at least one).
 * On an actual deletion, the CALLER (App.tsx's handleDeleteProfile) is
 * responsible for also clearing that profile's data in every other store
 * (each exposes its own `clearProfileData(profileId)`) — this function only
 * ever touches the profile LIST, never any store's own data.
 */
export async function deleteProfile(id: string): Promise<Profile[]> {
  const existing = await loadProfileList();
  if (existing.length <= 1) return existing;
  if (id === getActiveProfileId()) return existing;
  if (!existing.some((profile) => profile.id === id)) return existing;
  const next = existing.filter((profile) => profile.id !== id);
  await persistProfiles(next);
  return next;
}

/**
 * Slice: caregiver profiles — local data rights. Resets the persisted
 * profile list back to a single, freshly-created default profile (id
 * `DEFAULT_PROFILE_ID`, kind "self", the caller-supplied localized name) and
 * marks it active. Used by "Apagar todos os meus dados" (App.tsx
 * handleDeleteAllData) AFTER every per-profile store's own data has already
 * been cleared for every profile that existed — this only resets the profile
 * LIST + active pointer; it never touches any store's own AsyncStorage/
 * SecureStore keys itself.
 */
export async function resetToDefaultProfile(defaultName: string): Promise<LoadedProfiles> {
  const profile = buildDefaultProfile(defaultName);
  await persistProfiles([profile]);
  await setActiveProfile(profile.id);
  return { profiles: [profile], activeProfileId: profile.id };
}

/**
 * Non-destructive, idempotent, one-way migration used by every OTHER
 * AsyncStorage-backed per-profile store (../storage.ts, ../mealHistory.ts,
 * ../savedMeals.ts, ../recipes.ts, ../submissions.ts, ../dose/profileStorage.ts)
 * to carry a user's PRE-EXISTING (pre-profiles) local data onto the
 * newly-introduced default profile, the very first time it's read under that
 * profile:
 *   - a no-op for every profile OTHER than `DEFAULT_PROFILE_ID` — every other
 *     profile is, by construction, created AFTER this feature ships, so it
 *     never has legacy data of its own to inherit;
 *   - never overwrites a namespaced key that already holds ANY value (even an
 *     intentionally-empty one, e.g. `"[]"`) — so this can never run more than
 *     once in a way that matters, and can never resurrect data the user has
 *     since cleared;
 *   - NEVER deletes the legacy key — this is a copy, not a move.
 */
export async function migrateLegacyKey(legacyKey: string, profileId: string, namespacedKey: string): Promise<void> {
  if (profileId !== DEFAULT_PROFILE_ID) return;
  try {
    const namespacedRaw = await AsyncStorage.getItem(namespacedKey);
    if (namespacedRaw !== null) return;
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (legacyRaw === null) return;
    await AsyncStorage.setItem(namespacedKey, legacyRaw);
  } catch {
    // Best-effort — a failed migration must never block the (already
    // fail-safe) load path in the calling store; it simply tries again next load.
  }
}
