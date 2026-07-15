// `UserDataRepository` adapter backed by Postgres. Only constructed by
// `src/server.ts` when `DATABASE_URL` is set — never during tests (no
// database is available in the Vitest run) and never imported by any other
// module.
//
// PRIVACY: a `SyncState` (favourites, custom foods) is health-adjacent user
// data. This module never calls `console.*` with a state value, a user id
// beyond what is already an opaque handle, or the connection string.
//
// CONCURRENCY: `put()` runs the read-check-write sequence inside a single
// `SELECT ... FOR UPDATE` transaction so a concurrent writer for the SAME
// user can never race past the `baseVersion` check — see the port contract
// in `./userDataRepository.ts`.

import type { Pool, PoolClient } from "pg";
import { EMPTY_SYNC_STATE } from "./userDataRepository.js";
import type { PutOutcome, SyncSnapshot, SyncState, UserDataRepository } from "./userDataRepository.js";

interface UserDataRow {
  state: SyncState;
  // `bigint` columns are returned as strings by `pg` by default (they can
  // exceed `Number.MAX_SAFE_INTEGER`), so every read explicitly converts.
  version: string;
  updated_at: Date;
}

function toSnapshot(row: UserDataRow | undefined): SyncSnapshot {
  if (!row) {
    return { state: EMPTY_SYNC_STATE, version: 0, updatedAt: null };
  }
  return { state: row.state, version: Number(row.version), updatedAt: row.updated_at.toISOString() };
}

export class PostgresUserDataRepository implements UserDataRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Idempotently creates the `user_data` table (`REFERENCES users(id)` — the
   * `users` table must already exist, so `PostgresUserRepository.migrate()`
   * must run first; `src/server.ts` sequences this). Safe to call on every
   * process startup — `CREATE TABLE IF NOT EXISTS`.
   */
  async migrate(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS user_data (
        user_id text PRIMARY KEY REFERENCES users(id),
        state jsonb NOT NULL,
        version bigint NOT NULL DEFAULT 0,
        updated_at timestamptz DEFAULT now()
      )
    `);
  }

  async get(userId: string): Promise<SyncSnapshot> {
    const result = await this.pool.query<UserDataRow>(
      "SELECT state, version, updated_at FROM user_data WHERE user_id = $1",
      [userId],
    );
    return toSnapshot(result.rows[0]);
  }

  async put(userId: string, state: SyncState, baseVersion: number | undefined): Promise<PutOutcome> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const existingResult = await client.query<UserDataRow>(
        "SELECT state, version, updated_at FROM user_data WHERE user_id = $1 FOR UPDATE",
        [userId],
      );
      const existingRow = existingResult.rows[0];
      const currentVersion = existingRow ? Number(existingRow.version) : 0;

      if (baseVersion !== undefined && baseVersion !== currentVersion) {
        await client.query("ROLLBACK");
        return { status: "conflict", snapshot: toSnapshot(existingRow) };
      }

      const nextVersion = currentVersion + 1;
      const upserted = await client.query<UserDataRow>(
        `INSERT INTO user_data (user_id, state, version, updated_at)
         VALUES ($1, $2::jsonb, $3, now())
         ON CONFLICT (user_id) DO UPDATE
           SET state = EXCLUDED.state, version = EXCLUDED.version, updated_at = now()
         RETURNING state, version, updated_at`,
        [userId, JSON.stringify(state), nextVersion],
      );
      await client.query("COMMIT");

      const row = upserted.rows[0];
      if (!row) {
        // The upsert either produced a row or the query would have thrown;
        // this is an invariant guard, not an expected runtime path.
        throw new Error("PostgresUserDataRepository.put: upsert returned no row.");
      }
      return { status: "ok", snapshot: toSnapshot(row) };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
