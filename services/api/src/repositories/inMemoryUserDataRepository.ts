// Default, zero-dependency `UserDataRepository` adapter. Keeps each user's
// sync state in a per-instance `Map`, keyed by `userId`. This is the adapter
// `buildApp()` uses by default when no `userDataRepository` is injected, so
// all existing tests/callers are unaffected.
//
// PRIVACY: this adapter has zero `console.*` calls by design — a `SyncState`
// (favourites, custom foods) is never logged.

import { EMPTY_SYNC_STATE } from "./userDataRepository.js";
import type { PutOutcome, SyncSnapshot, SyncState, UserDataRepository } from "./userDataRepository.js";

interface Row {
  state: SyncState;
  version: number;
  updatedAt: string;
}

export class InMemoryUserDataRepository implements UserDataRepository {
  private readonly rows = new Map<string, Row>();

  async get(userId: string): Promise<SyncSnapshot> {
    const row = this.rows.get(userId);
    if (!row) {
      return { state: EMPTY_SYNC_STATE, version: 0, updatedAt: null };
    }
    return { state: row.state, version: row.version, updatedAt: row.updatedAt };
  }

  async put(userId: string, state: SyncState, baseVersion: number | undefined): Promise<PutOutcome> {
    const existing = this.rows.get(userId);
    const currentVersion = existing?.version ?? 0;

    if (baseVersion !== undefined && baseVersion !== currentVersion) {
      return {
        status: "conflict",
        snapshot: existing
          ? { state: existing.state, version: existing.version, updatedAt: existing.updatedAt }
          : { state: EMPTY_SYNC_STATE, version: 0, updatedAt: null },
      };
    }

    const next: Row = {
      state,
      version: currentVersion + 1,
      // Real time is acceptable for record metadata (mirrors `StoredMeal`);
      // it never influences the version number, which is a monotonic
      // counter derived from `currentVersion`.
      updatedAt: new Date().toISOString(),
    };
    this.rows.set(userId, next);
    return { status: "ok", snapshot: { state: next.state, version: next.version, updatedAt: next.updatedAt } };
  }
}
