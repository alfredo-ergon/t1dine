// `FoodRepository` adapter backed by Postgres. Only constructed by
// `src/server.ts` when `DATABASE_URL` is set — never during tests (no
// database is available in the Vitest run) and never imported by any other
// module.
//
// Id generation: the food's own `id` (part of the `CanonicalFood` contract)
// IS the table's primary key — never app-side `Math.random()`/`Date.now()`.
// A duplicate id raises Postgres' unique-violation, translated to
// `FoodIdTakenError` (mirrors `PostgresUserRepository`'s email-uniqueness
// handling).
//
// Region/q/cuisine filtering is intentionally NOT done in SQL here — see
// `../catalogFilters.ts` and the port doc comment in `./foodRepository.ts`
// for why the filtering logic lives in exactly one, adapter-independent
// place. `status`/`source` filtering IS pushed down to SQL (both are plain,
// indexed columns), which keeps the review-queue query cheap.

import type { Pool } from "pg";
import type { CanonicalFood, FoodStatus } from "@t1dine/food-schema";
import {
  FoodIdTakenError,
  type AdminListFilter,
  type FoodRepository,
  type FoodSource,
  type StoredFood,
} from "./foodRepository.js";

interface FoodRow {
  id: string;
  record: CanonicalFood;
  status: FoodStatus;
  source: FoodSource;
  submitted_by: string | null;
  reviewed_by: string | null;
  created_at: Date;
  reviewed_at: Date | null;
}

/** Postgres error code for a unique-constraint violation. */
const UNIQUE_VIOLATION_CODE = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION_CODE
  );
}

function withStatus(food: CanonicalFood, status: FoodStatus): CanonicalFood {
  return { ...food, status };
}

function toStoredFood(row: FoodRow): StoredFood {
  return {
    id: row.id,
    food: row.record,
    status: row.status,
    source: row.source,
    submittedBy: row.submitted_by,
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at.toISOString(),
    reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
  };
}

const SELECT_COLUMNS = "id, record, status, source, submitted_by, reviewed_by, created_at, reviewed_at";

export class PostgresFoodRepository implements FoodRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Idempotently creates the `foods` table and its `status` index. Safe to
   * call on every process startup — every statement is `IF NOT EXISTS`.
   */
  async migrate(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS foods (
        id text PRIMARY KEY,
        record jsonb NOT NULL,
        status text NOT NULL,
        source text NOT NULL,
        submitted_by text NULL,
        reviewed_by text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        reviewed_at timestamptz NULL
      )
    `);
    await this.pool.query("CREATE INDEX IF NOT EXISTS foods_status_idx ON foods (status)");
  }

  async listAll(filter: AdminListFilter = {}): Promise<StoredFood[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.status) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filter.source) {
      params.push(filter.source);
      conditions.push(`source = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await this.pool.query<FoodRow>(
      `SELECT ${SELECT_COLUMNS} FROM foods ${where} ORDER BY created_at, id`,
      params,
    );
    return result.rows.map(toStoredFood);
  }

  async getById(id: string): Promise<StoredFood | null> {
    const result = await this.pool.query<FoodRow>(`SELECT ${SELECT_COLUMNS} FROM foods WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row ? toStoredFood(row) : null;
  }

  private async insertRow(
    food: CanonicalFood,
    status: FoodStatus,
    source: FoodSource,
    submittedBy: string | null,
  ): Promise<StoredFood> {
    try {
      const result = await this.pool.query<FoodRow>(
        `INSERT INTO foods (id, record, status, source, submitted_by)
         VALUES ($1, $2::jsonb, $3, $4, $5)
         RETURNING ${SELECT_COLUMNS}`,
        [food.id, JSON.stringify(withStatus(food, status)), status, source, submittedBy],
      );
      const row = result.rows[0];
      if (!row) {
        // The insert either produced a row or the query would have thrown;
        // this is an invariant guard, not an expected runtime path.
        throw new Error("PostgresFoodRepository: insert returned no row.");
      }
      return toStoredFood(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new FoodIdTakenError(food.id);
      }
      throw error;
    }
  }

  async insertSubmission(food: CanonicalFood, submittedBy: string | null): Promise<StoredFood> {
    return this.insertRow(food, "candidate", "user", submittedBy);
  }

  async insertAdminFood(food: CanonicalFood): Promise<StoredFood> {
    return this.insertRow(food, "approved", "admin", null);
  }

  async insertAiCandidate(food: CanonicalFood): Promise<StoredFood> {
    // Hardcoded, not caller-provided — see the `FoodRepository.insertAiCandidate`
    // contract: AI output is NEVER auto-approved.
    return this.insertRow(food, "candidate", "ai", null);
  }

  private async setReviewed(id: string, status: FoodStatus, reviewedBy: string): Promise<StoredFood | null> {
    const result = await this.pool.query<FoodRow>(
      `UPDATE foods
         SET status = $2,
             record = jsonb_set(record, '{status}', to_jsonb($2::text)),
             reviewed_by = $3,
             reviewed_at = now()
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [id, status, reviewedBy],
    );
    const row = result.rows[0];
    return row ? toStoredFood(row) : null;
  }

  async approve(id: string, reviewedBy: string): Promise<StoredFood | null> {
    return this.setReviewed(id, "approved", reviewedBy);
  }

  async reject(id: string, reviewedBy: string): Promise<StoredFood | null> {
    return this.setReviewed(id, "retired", reviewedBy);
  }

  async seedApproved(foods: CanonicalFood[]): Promise<void> {
    for (const food of foods) {
      await this.pool.query(
        `INSERT INTO foods (id, record, status, source, submitted_by)
         VALUES ($1, $2::jsonb, 'approved', 'seed', NULL)
         ON CONFLICT (id) DO UPDATE
           SET record = EXCLUDED.record, status = 'approved', source = 'seed'`,
        [food.id, JSON.stringify(withStatus(food, "approved"))],
      );
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
