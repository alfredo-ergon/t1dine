// Persistence PORT for meals (ports-and-adapters — see
// .claude/rules/architecture.md). This is the only contract the rest of the
// API depends on; nothing outside this file and its adapters should know
// whether a meal is stored in memory or in Postgres.
//
// Two adapters implement `MealRepository`:
//   - `InMemoryMealRepository` — deterministic, in-process, zero I/O. This is
//     the default used by `buildApp()` whenever no repository is injected,
//     so every existing test keeps passing unchanged.
//   - `PostgresMealRepository` — backed by a `pg` `Pool`, used by
//     `src/server.ts` only when `DATABASE_URL` is set (with an automatic
//     fallback to in-memory on any connection/migration failure).
//
// Meal summaries can contain food names, which is health-adjacent data per
// CLAUDE.md's privacy rules; neither adapter may log a summary.

import type { MealSummary } from "@t1dine/nutrition";

export interface StoredMeal {
  id: string;
  /** ISO-8601 timestamp of when the meal was persisted. Real wall-clock time
   * is acceptable here — CLAUDE.md's "no Math.random/Date.now for ids" rule
   * governs id generation, not record metadata. */
  createdAt: string;
  summary: MealSummary;
}

export interface MealRepository {
  /** Persists a newly computed meal summary and returns its assigned id.
   * Implementations must assign ids deterministically (a monotonic counter,
   * a DB sequence, etc.) — never `Math.random()`/`Date.now()`. */
  save(summary: MealSummary): Promise<{ id: string }>;
  /** Looks up a previously stored meal by id, or `null` when it does not
   * exist (never throws for a merely-unknown id). */
  get(id: string): Promise<StoredMeal | null>;
  /** Releases any held resources (e.g. a `pg` connection pool). Optional —
   * the in-memory adapter has nothing to close. */
  close?(): Promise<void>;
}
