// Slice: caregiver profiles ("Perfis") — non-destructive migration. When
// this feature ships, a user already has real local data (favourites, meal
// history, etc.) sitting under the OLD, un-namespaced keys. Every per-profile
// store must inherit that data onto the newly-introduced DEFAULT profile the
// first time it's read — WITHOUT ever deleting the legacy key, WITHOUT ever
// overwriting a namespaced key that already has data, and idempotently (safe
// to run on every load, forever).
//
// `../src/profiles.ts`'s `migrateLegacyKey` is the single implementation
// every AsyncStorage-backed store (../src/storage.ts, ../src/mealHistory.ts,
// ../src/savedMeals.ts, ../src/recipes.ts, ../src/submissions.ts,
// ../src/dose/profileStorage.ts) delegates to — this file tests it directly,
// then proves it end-to-end through two representative real stores of
// different shapes (../src/storage.ts's favourites list and
// ../src/mealHistory.ts's Diário) to show the mechanism generalises.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PROFILE_ID, migrateLegacyKey, profileKey } from "../src/profiles";
import { loadFavouriteIds, saveFavouriteIds } from "../src/storage";
import { loadHistory, type HistoryEntry } from "../src/mealHistory";

let store: Map<string, string>;

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => (store.has(key) ? (store.get(key) as string) : null)),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      keys.forEach((key) => store.delete(key));
    }),
  },
}));

beforeEach(() => {
  store = new Map();
});

describe("migrateLegacyKey (the shared mechanism)", () => {
  it("copies legacy data onto the default profile's namespaced key when the namespaced key is empty", async () => {
    store.set("t1dine.favourites", JSON.stringify(["apple", "rice"]));
    const namespacedKey = profileKey("t1dine.favourites", DEFAULT_PROFILE_ID);

    await migrateLegacyKey("t1dine.favourites", DEFAULT_PROFILE_ID, namespacedKey);

    expect(store.get(namespacedKey)).toBe(JSON.stringify(["apple", "rice"]));
    // Non-destructive — the legacy key is left exactly as it was.
    expect(store.get("t1dine.favourites")).toBe(JSON.stringify(["apple", "rice"]));
  });

  it("never overwrites a namespaced key that already holds ANY value, even an intentionally-empty one", async () => {
    store.set("t1dine.favourites", JSON.stringify(["apple"]));
    const namespacedKey = profileKey("t1dine.favourites", DEFAULT_PROFILE_ID);
    store.set(namespacedKey, JSON.stringify([])); // the user already cleared their favourites under the new namespace

    await migrateLegacyKey("t1dine.favourites", DEFAULT_PROFILE_ID, namespacedKey);

    expect(store.get(namespacedKey)).toBe(JSON.stringify([])); // untouched, not resurrected
  });

  it("is a no-op when there is no legacy data to migrate", async () => {
    const namespacedKey = profileKey("t1dine.favourites", DEFAULT_PROFILE_ID);

    await migrateLegacyKey("t1dine.favourites", DEFAULT_PROFILE_ID, namespacedKey);

    expect(store.has(namespacedKey)).toBe(false);
  });

  it("is a no-op for any profile other than the default one", async () => {
    store.set("t1dine.favourites", JSON.stringify(["apple"]));
    const otherProfileId = "profile-123-abc";
    const namespacedKey = profileKey("t1dine.favourites", otherProfileId);

    await migrateLegacyKey("t1dine.favourites", otherProfileId, namespacedKey);

    expect(store.has(namespacedKey)).toBe(false);
  });

  it("is idempotent — running it twice never changes the result or duplicates data", async () => {
    store.set("t1dine.favourites", JSON.stringify(["apple"]));
    const namespacedKey = profileKey("t1dine.favourites", DEFAULT_PROFILE_ID);

    await migrateLegacyKey("t1dine.favourites", DEFAULT_PROFILE_ID, namespacedKey);
    await migrateLegacyKey("t1dine.favourites", DEFAULT_PROFILE_ID, namespacedKey);

    expect(store.get(namespacedKey)).toBe(JSON.stringify(["apple"]));
  });
});

describe("../src/storage.ts favourites — end-to-end migration", () => {
  it("inherits pre-existing (pre-profiles) favourites into the default profile the first time they're loaded", async () => {
    store.set("t1dine.favourites", JSON.stringify(["apple", "rice"]));

    const loaded = await loadFavouriteIds();

    expect(loaded).toEqual(["apple", "rice"]);
    expect(store.get("t1dine.favourites")).toBe(JSON.stringify(["apple", "rice"])); // legacy key preserved
  });

  it("never resurrects favourites the user has since cleared (real save-then-reload)", async () => {
    store.set("t1dine.favourites", JSON.stringify(["apple"]));

    await loadFavouriteIds(); // migrates legacy -> namespaced
    await saveFavouriteIds([]); // the user clears their favourites afterwards

    const reloaded = await loadFavouriteIds();

    expect(reloaded).toEqual([]);
  });

  it("does not touch the legacy key at all when the namespaced key already has data (idempotent across app restarts)", async () => {
    store.set("t1dine.favourites", JSON.stringify(["apple"]));
    await loadFavouriteIds(); // first "run" — migrates

    store.set("t1dine.favourites", JSON.stringify(["apple", "changed-after-migration"]));
    const reloaded = await loadFavouriteIds(); // second "run" — must not re-migrate

    expect(reloaded).toEqual(["apple"]);
  });
});

describe("../src/mealHistory.ts Diário — end-to-end migration (a different store/shape)", () => {
  function legacyEntry(): HistoryEntry {
    return {
      id: "history-1",
      loggedAt: "2026-01-01T08:00:00.000Z",
      items: [{ foodId: "rice", name: "Arroz", quantityGrams: 100, carbPer100g: 28 }],
      totalCarbGrams: 28,
    };
  }

  it("inherits pre-existing Diário entries into the default profile the first time it's loaded", async () => {
    store.set("t1dine.mealHistory", JSON.stringify([legacyEntry()]));

    const loaded = await loadHistory();

    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.id).toBe("history-1");
    expect(store.get("t1dine.mealHistory")).toBe(JSON.stringify([legacyEntry()])); // legacy key preserved
  });

  it("never overwrites an already-populated namespaced Diário with older legacy data", async () => {
    const namespacedKey = profileKey("t1dine.mealHistory", DEFAULT_PROFILE_ID);
    const newerEntry: HistoryEntry = { ...legacyEntry(), id: "history-2" };
    store.set(namespacedKey, JSON.stringify([newerEntry]));
    store.set("t1dine.mealHistory", JSON.stringify([legacyEntry()]));

    const loaded = await loadHistory();

    expect(loaded).toEqual([newerEntry]);
  });
});
