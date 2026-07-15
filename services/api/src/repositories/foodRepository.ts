// Persistence PORT for the food catalog store (ports-and-adapters — see
// .claude/rules/architecture.md). This is the only contract the rest of the
// API depends on; nothing outside this file and its adapters should know
// whether a food is stored in memory or in Postgres.
//
// Two adapters implement `FoodRepository`:
//   - `InMemoryFoodRepository` — deterministic, in-process, zero I/O. This is
//     the default used by `buildApp()` whenever no repository is injected,
//     pre-seeded (synchronously, at construction) with the synthetic catalog
//     from `../catalog.js`.
//   - `PostgresFoodRepository` — backed by a `pg` `Pool`, used by
//     `src/server.ts` only when `DATABASE_URL` is set (with an automatic
//     fallback to in-memory on any connection/migration failure, mirroring
//     `PostgresMealRepository`/`PostgresUserRepository`).
//
// GOVERNANCE CONTRACT (CLAUDE.md / .claude/rules/food-data.md): a stored food
// carries its own review lifecycle, independent of which adapter backs it:
//   - `status`: "candidate" | "approved" | "retired". Only "approved" foods
//     are ever visible through the public `/catalog/foods` routes.
//   - `source`: "seed" | "user" | "ai" | "admin" — where the record came
//     from, preserved forever (provenance is never discarded).
//   - Every insert method below hardcodes the (status, source) pair it is
//     allowed to produce — callers cannot choose a different combination,
//     which is the code-level guarantee that AI- and user-submitted foods
//     are NEVER auto-approved (see `insertAiCandidate`/`insertSubmission`).
//   - Both adapters keep the *embedded* `CanonicalFood.status` field
//     (part of the canonical food contract itself) in sync with the
//     `StoredFood.status` field on every insert/approve/reject/seed, so a
//     `CanonicalFood` returned from `/catalog/foods` never disagrees with
//     the review state that made it visible.

import type { CanonicalFood, FoodStatus } from "@t1dine/food-schema";

export const FOOD_SOURCES = ["seed", "user", "ai", "admin"] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

export interface StoredFood {
  id: string;
  food: CanonicalFood;
  status: FoodStatus;
  source: FoodSource;
  /** The submitting user's id (`request.userId`), or `null` for an anonymous
   * submission / any non-user-sourced record. Never an email — see the
   * privacy note in `../modules/auth.ts`. */
  submittedBy: string | null;
  /** The reviewing admin's user id, or `null` before any review decision. */
  reviewedBy: string | null;
  /** ISO-8601 timestamp of when the record was first stored. */
  createdAt: string;
  /** ISO-8601 timestamp of the approve/reject decision, or `null` before
   * one has been made. */
  reviewedAt: string | null;
}

export interface AdminListFilter {
  status?: FoodStatus;
  source?: FoodSource;
}

/** Thrown by any `insert*` method when `food.id` already exists in the
 * store — ids are the store's primary key, so this is a conflict, never a
 * silent overwrite (CLAUDE.md: "never merge conflicting food values by
 * silently averaging/overwriting them"). */
export class FoodIdTakenError extends Error {
  constructor(id: string) {
    super(`A food with id "${id}" already exists.`);
    this.name = "FoodIdTakenError";
  }
}

export interface FoodRepository {
  /** Lists every stored food (any status/source), optionally narrowed by an
   * exact `status`/`source` match — the review-queue read path. Region/q/
   * cuisine filtering is deliberately NOT part of this port; it is applied
   * as a pure, adapter-independent function over the result (see
   * `../catalogFilters.ts`) so the filtering rules live in exactly one
   * place regardless of which adapter is active. */
  listAll(filter?: AdminListFilter): Promise<StoredFood[]>;
  /** Looks up one stored food by id regardless of status, or `null` when it
   * does not exist. */
  getById(id: string): Promise<StoredFood | null>;
  /** Stores a user submission. Hardcodes `status: "candidate"` and
   * `source: "user"` — a submission is NEVER auto-approved. Throws
   * `FoodIdTakenError` if `food.id` is already in the store. */
  insertSubmission(food: CanonicalFood, submittedBy: string | null): Promise<StoredFood>;
  /** Stores a food added directly by an admin. Hardcodes
   * `status: "approved"` and `source: "admin"` — an authenticated admin's
   * manual addition is trusted immediately, unlike a user submission or an
   * AI candidate. Throws `FoodIdTakenError` on a duplicate id. */
  insertAdminFood(food: CanonicalFood): Promise<StoredFood>;
  /** Stores an AI-generated candidate. Hardcodes `status: "candidate"` and
   * `source: "ai"` — this is the code-level guarantee (independent of
   * caller behaviour) that AI output is NEVER auto-approved (food-data
   * rule: "AI extraction creates a candidate record, never an
   * automatically trusted canonical record"). A human must call
   * `approve()` explicitly before it can ever appear in `/catalog/foods`.
   * Throws `FoodIdTakenError` on a duplicate id. */
  insertAiCandidate(food: CanonicalFood): Promise<StoredFood>;
  /** Marks a stored food `approved`, recording `reviewedBy`/`reviewedAt` and
   * syncing the embedded `food.status`. Returns `null` if `id` is unknown. */
  approve(id: string, reviewedBy: string): Promise<StoredFood | null>;
  /** Marks a stored food `retired` (a soft rejection — the record is kept
   * for audit, never deleted), recording `reviewedBy`/`reviewedAt` and
   * syncing the embedded `food.status`. Returns `null` if `id` is unknown. */
  reject(id: string, reviewedBy: string): Promise<StoredFood | null>;
  /** Idempotently upserts `foods` as `status: "approved"`, `source: "seed"`.
   * Safe to call on every process startup: an existing row's `createdAt`/
   * `reviewedBy`/`reviewedAt` are preserved; only the record content is
   * refreshed. Never duplicates a row across restarts (upsert by id). */
  seedApproved(foods: CanonicalFood[]): Promise<void>;
  /** Releases any held resources (e.g. a `pg` connection pool). Optional —
   * the in-memory adapter has nothing to close. */
  close?(): Promise<void>;
}
