// Pure merge logic for cloud sync (Slice: accounts + multi-device sync).
// Deliberately free of any I/O — no AsyncStorage, no network — so it stays
// simple, framework-independent, and trivially testable (architecture rule:
// "Keep application shells thin and domain packages framework-independent").
// All orchestration (calling the API, persisting the session, debouncing a
// push) lives in App.tsx, which owns the favourites/customFoods state this
// module merges.
//
// MERGE RULE — CLAUDE.md: "Never merge conflicting food values by silently
// averaging them." Applied here to whole sync states: a merge is always a
// UNION, never a pick-one-and-discard. Logging in on a second device (or
// resolving a stale-`baseVersion` conflict) must never silently drop data
// that exists only locally or only in the cloud.

import type { CanonicalFood } from "@t1dine/food-schema";

import type { SyncState } from "./api";

export interface LocalSyncData {
  favouriteIds: string[];
  customFoods: CanonicalFood[];
}

/** Union of two favourite-id lists: every local id first (in its existing
 * order), then any cloud-only ids appended — never drops an id from either
 * side. */
export function mergeFavouriteIds(local: string[], cloud: string[]): string[] {
  const seen = new Set(local);
  const merged = [...local];
  for (const id of cloud) {
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(id);
    }
  }
  return merged;
}

/**
 * Union of two custom-food lists by id. On an id collision, the LOCAL
 * record wins (this device's own most recent edit) — the cloud copy of that
 * same id is not appended a second time, but it is never silently averaged
 * with the local one either; every cloud-only id is appended untouched.
 */
export function mergeCustomFoods(local: CanonicalFood[], cloud: CanonicalFood[]): CanonicalFood[] {
  const localIds = new Set(local.map((food) => food.id));
  const merged = [...local];
  for (const food of cloud) {
    if (!localIds.has(food.id)) {
      merged.push(food);
    }
  }
  return merged;
}

/** Merges a device's local favourites/custom foods with a cloud snapshot's
 * state, as a union on both axes. Safe to call with an empty cloud state
 * (e.g. a brand-new account) — the result is simply the local data. */
export function mergeSyncState(local: LocalSyncData, cloud: SyncState): SyncState {
  return {
    favourites: mergeFavouriteIds(local.favouriteIds, cloud.favourites),
    customFoods: mergeCustomFoods(local.customFoods, cloud.customFoods),
  };
}

/** Small, closed set of sync presentation states shown in the UI (Conta
 * screen + a compact header indicator). `"idle"` means "not signed in" —
 * distinct from `"offline"`, which means "signed in, but the last sync
 * attempt could not reach the API". */
export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

/** i18n dictionary key for a given sync status — resolve with `useLanguage().t()`. */
export function syncStatusLabelKey(status: SyncStatus): string {
  switch (status) {
    case "syncing":
      return "sync.status.syncing";
    case "synced":
      return "sync.status.synced";
    case "offline":
      return "sync.status.offline";
    case "error":
      return "sync.status.error";
    case "idle":
    default:
      return "sync.status.idle";
  }
}
