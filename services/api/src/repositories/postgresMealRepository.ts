// `MealRepository` adapter backed by Postgres. Only constructed by
// `src/server.ts` when `DATABASE_URL` is set — never during tests (no
// database is available in the Vitest run) and never imported by any other
// module.
//
// Health-data rule (CLAUDE.md): meal summaries may contain food names, so
// this module never logs a summary, a query parameter, or the connection
// string. It relies on the app-wide `Fastify({ logger: false })` and never
// calls `console.*` itself.
//
// Id generation uses a Postgres sequence (`meals_id_seq`), never app-side
// `Math.random()`/`Date.now()`, per CLAUDE.md's idempotent-ingestion rule.

import type { Pool } from "pg";
import type { MealSummary } from "@t1dine/nutrition";
import type { MealRepository, StoredMeal } from "./mealRepository.js";

interface MealRow {
  id: string;
  created_at: Date;
  summary: MealSummary;
  owner_id: string;
}

export class PostgresMealRepository implements MealRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Idempotently creates the `meals_id_seq` sequence, the `meals` table, and
   * a supporting index. Safe to call on every process startup — every
   * statement is `IF NOT EXISTS`.
   *
   * `owner_id` (security review M4 — see `../modules/meals.ts`) is added via
   * a separate idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` rather
   * than only the `CREATE TABLE`, so a table created before this hardening
   * pass gets the column added (backfilled blank) rather than the migration
   * silently doing nothing on an existing table.
   */
  async migrate(): Promise<void> {
    await this.pool.query("CREATE SEQUENCE IF NOT EXISTS meals_id_seq");
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS meals (
        id text PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now(),
        summary jsonb NOT NULL,
        owner_id text NOT NULL DEFAULT ''
      )
    `);
    await this.pool.query("ALTER TABLE meals ADD COLUMN IF NOT EXISTS owner_id text NOT NULL DEFAULT ''");
    await this.pool.query("CREATE INDEX IF NOT EXISTS meals_created_at_idx ON meals (created_at)");
    await this.pool.query("CREATE INDEX IF NOT EXISTS meals_owner_id_idx ON meals (owner_id)");
  }

  async save(summary: MealSummary, ownerId: string): Promise<{ id: string }> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO meals (id, summary, owner_id)
       VALUES ('meal-' || nextval('meals_id_seq'), $1::jsonb, $2)
       RETURNING id`,
      [JSON.stringify(summary), ownerId],
    );

    const row = result.rows[0];
    if (!row) {
      // The insert either produced a row or the query would have thrown;
      // this is an invariant guard, not an expected runtime path.
      throw new Error("PostgresMealRepository.save: insert returned no row.");
    }
    return { id: row.id };
  }

  async get(id: string): Promise<StoredMeal | null> {
    const result = await this.pool.query<MealRow>(
      "SELECT id, created_at, summary, owner_id FROM meals WHERE id = $1",
      [id],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      createdAt: row.created_at.toISOString(),
      summary: row.summary,
      ownerId: row.owner_id,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
