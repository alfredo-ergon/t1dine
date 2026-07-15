// Persistence PORT for per-user cloud sync state (favourites + custom
// foods). Ports-and-adapters — see .claude/rules/architecture.md. Sync
// payloads can contain user-authored food data, which is health-adjacent per
// CLAUDE.md's privacy rules; NEITHER adapter may log a `SyncState` value.
//
// Every write goes through optimistic concurrency: the caller supplies the
// `baseVersion` it last observed. An adapter must NEVER write when a
// `baseVersion` is supplied and does not match the currently stored version
// — it must instead report the conflict together with the CURRENT stored
// snapshot (unchanged), so the caller can reconcile without a second round
// trip. This mirrors CLAUDE.md's "never merge conflicting values by silently
// averaging them" rule: a sync conflict is surfaced explicitly, never
// resolved by picking a value silently.

import type { CanonicalFood } from "@t1dine/food-schema";

export interface SyncState {
  favourites: string[];
  customFoods: CanonicalFood[];
}

export const EMPTY_SYNC_STATE: SyncState = { favourites: [], customFoods: [] };

/** A user's sync record as returned to callers: the state, its version, and
 * when it was last written. `updatedAt` is `null` when the user has never
 * synced before — an explicit "no data yet" rather than a fabricated
 * timestamp. */
export interface SyncSnapshot {
  state: SyncState;
  version: number;
  updatedAt: string | null;
}

export type PutOutcome =
  | { status: "ok"; snapshot: SyncSnapshot }
  | { status: "conflict"; snapshot: SyncSnapshot };

export interface UserDataRepository {
  /** Returns the user's current sync snapshot, or the empty default
   * (`version: 0`, `updatedAt: null`) when the user has never synced. Never
   * throws for a merely-unknown user. */
  get(userId: string): Promise<SyncSnapshot>;
  /**
   * Persists `state` for `userId`, subject to optimistic concurrency:
   * - `baseVersion === undefined` -> always writes, bumping the version.
   * - `baseVersion` matches the currently stored version (`0` when the user
   *   has never synced) -> writes, bumps the version, returns
   *   `{ status: "ok", snapshot: <newly stored> }`.
   * - `baseVersion` does not match -> does NOT write; returns
   *   `{ status: "conflict", snapshot: <current, unchanged> }`.
   */
  put(userId: string, state: SyncState, baseVersion: number | undefined): Promise<PutOutcome>;
  /** Releases any held resources (e.g. a `pg` connection pool). Optional —
   * the in-memory adapter has nothing to close. */
  close?(): Promise<void>;
}
