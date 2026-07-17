// Slice: caregiver profiles ("Perfis"). ../src/profiles.ts keeps a small
// amount of module-level state (the synchronous `getActiveProfileId()`
// cache), so most tests here go through a `freshProfiles()` helper that
// resets Vitest's module registry and re-imports the module — this mirrors
// what actually happens on a real app restart (a fresh JS context, but the
// SAME underlying AsyncStorage data), and keeps every test's cache state
// independent of test order.

import { beforeEach, describe, expect, it, vi } from "vitest";

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

async function freshProfiles() {
  vi.resetModules();
  return import("../src/profiles");
}

describe("loadProfiles — default seeding", () => {
  it("seeds a single default profile (kind self, caller-supplied localized name) and marks it active on first run", async () => {
    const { loadProfiles, DEFAULT_PROFILE_ID, getActiveProfileId } = await freshProfiles();

    const loaded = await loadProfiles("Eu");

    expect(loaded.profiles).toHaveLength(1);
    expect(loaded.profiles[0]).toMatchObject({ id: DEFAULT_PROFILE_ID, name: "Eu", kind: "self" });
    expect(typeof loaded.profiles[0].createdAt).toBe("string");
    expect(loaded.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    // The synchronous cache every other store reads is updated too.
    expect(getActiveProfileId()).toBe(DEFAULT_PROFILE_ID);
  });

  it("does not reseed on a second load — reuses the persisted profile", async () => {
    const { loadProfiles } = await freshProfiles();

    const first = await loadProfiles("Eu");
    const second = await loadProfiles("Eu");

    expect(second.profiles).toEqual(first.profiles);
    expect(second.profiles).toHaveLength(1);
  });

  it("restores whichever profile was last active, not always the default, across a fresh module load", async () => {
    const mod = await freshProfiles();
    await mod.loadProfiles("Eu");
    const withDependent = await mod.addProfile("Ana", "dependent");
    const dependentId = withDependent[1]!.id;
    await mod.setActiveProfile(dependentId);

    // Simulate a real app restart: fresh module state, same underlying store.
    const restarted = await freshProfiles();
    const reloaded = await restarted.loadProfiles("Eu");

    expect(reloaded.activeProfileId).toBe(dependentId);
    expect(restarted.getActiveProfileId()).toBe(dependentId);
  });

  it("falls back to the first profile if the persisted active id no longer matches any profile", async () => {
    const mod = await freshProfiles();
    const seeded = await mod.loadProfiles("Eu");
    await mod.setActiveProfile("some-deleted-profile-id");

    const restarted = await freshProfiles();
    const reloaded = await restarted.loadProfiles("Eu");

    expect(reloaded.activeProfileId).toBe(seeded.profiles[0]!.id);
  });
});

describe("addProfile / renameProfile", () => {
  it("adds a dependent profile with a fresh id and a trimmed name", async () => {
    const mod = await freshProfiles();
    await mod.loadProfiles("Eu");

    const next = await mod.addProfile("  Ana  ", "dependent");

    expect(next).toHaveLength(2);
    const added = next[1]!;
    expect(added.name).toBe("Ana");
    expect(added.kind).toBe("dependent");
    expect(added.id).not.toBe(mod.DEFAULT_PROFILE_ID);
    expect(added.id.length).toBeGreaterThan(0);
  });

  it("generates distinct ids for two profiles added in a row", async () => {
    const mod = await freshProfiles();
    await mod.loadProfiles("Eu");

    const afterFirst = await mod.addProfile("Ana", "dependent");
    const afterSecond = await mod.addProfile("Bruno", "dependent");

    expect(afterSecond).toHaveLength(3);
    const ids = afterSecond.map((profile) => profile.id);
    expect(new Set(ids).size).toBe(3);
    // The first add is preserved (never clobbered by the second).
    expect(afterSecond.find((p) => p.name === "Ana")?.id).toBe(afterFirst[1]!.id);
  });

  it("renames an existing profile in place, trimming whitespace", async () => {
    const mod = await freshProfiles();
    await mod.loadProfiles("Eu");

    const renamed = await mod.renameProfile(mod.DEFAULT_PROFILE_ID, "  Maria  ");

    expect(renamed.find((p) => p.id === mod.DEFAULT_PROFILE_ID)?.name).toBe("Maria");
  });

  it("ignores a blank/whitespace-only rename (no-op)", async () => {
    const mod = await freshProfiles();
    const seeded = await mod.loadProfiles("Eu");

    const renamed = await mod.renameProfile(mod.DEFAULT_PROFILE_ID, "   ");

    expect(renamed).toEqual(seeded.profiles);
  });

  it("is a no-op when renaming an id that does not exist", async () => {
    const mod = await freshProfiles();
    const seeded = await mod.loadProfiles("Eu");

    const renamed = await mod.renameProfile("no-such-id", "Maria");

    expect(renamed).toEqual(seeded.profiles);
  });
});

describe("deleteProfile — safety backstops", () => {
  it("refuses to delete the last remaining profile", async () => {
    const mod = await freshProfiles();
    const seeded = await mod.loadProfiles("Eu");

    const afterDelete = await mod.deleteProfile(mod.DEFAULT_PROFILE_ID);

    expect(afterDelete).toEqual(seeded.profiles);
    expect(afterDelete).toHaveLength(1);
  });

  it("refuses to delete the currently ACTIVE profile, even when other profiles exist", async () => {
    const mod = await freshProfiles();
    await mod.loadProfiles("Eu"); // default profile is seeded AND active
    const withDependent = await mod.addProfile("Ana", "dependent");

    const afterDelete = await mod.deleteProfile(mod.DEFAULT_PROFILE_ID);

    expect(afterDelete).toEqual(withDependent);
    expect(afterDelete.some((p) => p.id === mod.DEFAULT_PROFILE_ID)).toBe(true);
  });

  it("deletes a non-active, non-last profile", async () => {
    const mod = await freshProfiles();
    await mod.loadProfiles("Eu");
    const withDependent = await mod.addProfile("Ana", "dependent");
    const dependentId = withDependent[1]!.id;

    const afterDelete = await mod.deleteProfile(dependentId);

    expect(afterDelete).toHaveLength(1);
    expect(afterDelete.some((p) => p.id === dependentId)).toBe(false);
    // Persisted — a fresh read agrees.
    expect(await mod.loadProfileList()).toEqual(afterDelete);
  });

  it("is a no-op when deleting an id that does not exist", async () => {
    const mod = await freshProfiles();
    await mod.loadProfiles("Eu");
    const withDependent = await mod.addProfile("Ana", "dependent");

    const afterDelete = await mod.deleteProfile("no-such-id");

    expect(afterDelete).toEqual(withDependent);
  });
});

describe("setActiveProfile / getActiveProfileId — the switch", () => {
  it("updates the synchronous cache immediately, even before the returned promise settles", async () => {
    const mod = await freshProfiles();
    await mod.loadProfiles("Eu");
    const withDependent = await mod.addProfile("Ana", "dependent");
    const dependentId = withDependent[1]!.id;

    const switchPromise = mod.setActiveProfile(dependentId);
    // The cache is updated synchronously as `setActiveProfile`'s very first
    // statement — safe to rely on even before awaiting the promise, which is
    // what makes every OTHER per-profile store's "no signature change"
    // namespacing race-free (see ../App.tsx's startup-loading comment).
    expect(mod.getActiveProfileId()).toBe(dependentId);
    await switchPromise;
    expect(mod.getActiveProfileId()).toBe(dependentId);
  });

  it("persists the switch across a fresh module load (a real app restart)", async () => {
    const mod = await freshProfiles();
    await mod.loadProfiles("Eu");
    const withDependent = await mod.addProfile("Ana", "dependent");
    const dependentId = withDependent[1]!.id;
    await mod.setActiveProfile(dependentId);

    const restarted = await freshProfiles();
    await restarted.loadProfiles("Eu");

    expect(restarted.getActiveProfileId()).toBe(dependentId);
  });
});

describe("resetToDefaultProfile — 'Apagar todos os meus dados'", () => {
  it("collapses the list back to a single fresh default profile and activates it", async () => {
    const mod = await freshProfiles();
    await mod.loadProfiles("Eu");
    await mod.addProfile("Ana", "dependent");

    const reset = await mod.resetToDefaultProfile("Eu");

    expect(reset.profiles).toHaveLength(1);
    expect(reset.profiles[0]!.id).toBe(mod.DEFAULT_PROFILE_ID);
    expect(reset.profiles[0]!.name).toBe("Eu");
    expect(reset.activeProfileId).toBe(mod.DEFAULT_PROFILE_ID);
    expect(mod.getActiveProfileId()).toBe(mod.DEFAULT_PROFILE_ID);

    // Persisted, not just returned in-memory — a fresh read agrees.
    expect(await mod.loadProfileList()).toEqual(reset.profiles);
  });
});

describe("profileKey", () => {
  it("builds a '<base>::<profileId>' namespaced key", async () => {
    const { profileKey } = await freshProfiles();
    expect(profileKey("t1dine.favourites", "default")).toBe("t1dine.favourites::default");
    expect(profileKey("t1dine.favourites", "profile-123-abc")).toBe("t1dine.favourites::profile-123-abc");
  });
});
