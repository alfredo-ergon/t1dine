// Default, zero-dependency `FoodRepository` adapter. Keeps every stored food
// (any status/source) in a per-instance `Map`, keyed by the food's own `id`
// (its primary key — never `Math.random()`/`Date.now()`-derived, mirroring
// `InMemoryUserRepository`'s id contract, except here the id comes from the
// caller/food itself rather than a sequence).
//
// SYNCHRONOUS CONSTRUCTION: the constructor optionally accepts a seed list
// and calls `this.seedApproved(seedFoods)` directly. `seedApproved` (like
// every method below) is declared `async` only to satisfy the shared
// `FoodRepository` port — its body never contains an `await`, so per the
// ECMAScript spec it runs synchronously to completion before the Promise it
// returns is handed back. That means `records` is fully populated before the
// constructor call finishes, so `buildApp()` (itself fully synchronous) can
// rely on `new InMemoryFoodRepository(CATALOG)` being immediately queryable
// — no caller ever needs to await construction.
//
// Every food handed to a caller (or accepted from one) is deep-cloned via
// `structuredClone`, so no caller can mutate this adapter's internal state by
// mutating a returned/passed-in object.

import type { CanonicalFood, FoodStatus } from "@t1dine/food-schema";
import {
  FoodIdTakenError,
  type AdminListFilter,
  type FoodRepository,
  type FoodSource,
  type StoredFood,
} from "./foodRepository.js";

function withStatus(food: CanonicalFood, status: FoodStatus): CanonicalFood {
  return { ...structuredClone(food), status };
}

export class InMemoryFoodRepository implements FoodRepository {
  private readonly records = new Map<string, StoredFood>();

  constructor(seedFoods: CanonicalFood[] = []) {
    // See the "SYNCHRONOUS CONSTRUCTION" note above — this populates
    // `records` before the constructor returns.
    void this.seedApproved(seedFoods);
  }

  private cloneStored(stored: StoredFood): StoredFood {
    return { ...stored, food: structuredClone(stored.food) };
  }

  async listAll(filter: AdminListFilter = {}): Promise<StoredFood[]> {
    return Array.from(this.records.values())
      .filter((record) => (filter.status ? record.status === filter.status : true))
      .filter((record) => (filter.source ? record.source === filter.source : true))
      .map((record) => this.cloneStored(record));
  }

  async getById(id: string): Promise<StoredFood | null> {
    const found = this.records.get(id);
    return found ? this.cloneStored(found) : null;
  }

  private insertNew(
    food: CanonicalFood,
    status: FoodStatus,
    source: FoodSource,
    submittedBy: string | null,
  ): StoredFood {
    if (this.records.has(food.id)) {
      throw new FoodIdTakenError(food.id);
    }
    const stored: StoredFood = {
      id: food.id,
      food: withStatus(food, status),
      status,
      source,
      submittedBy,
      reviewedBy: null,
      // Real wall-clock time is acceptable for record metadata (mirrors
      // `StoredMeal.createdAt`) — CLAUDE.md's idempotent-id rule governs the
      // food's own `id`, not this timestamp.
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    };
    this.records.set(food.id, stored);
    return this.cloneStored(stored);
  }

  async insertSubmission(food: CanonicalFood, submittedBy: string | null): Promise<StoredFood> {
    return this.insertNew(food, "candidate", "user", submittedBy);
  }

  async insertAdminFood(food: CanonicalFood): Promise<StoredFood> {
    return this.insertNew(food, "approved", "admin", null);
  }

  async insertAiCandidate(food: CanonicalFood): Promise<StoredFood> {
    // Hardcoded, not caller-provided — see the `FoodRepository.insertAiCandidate`
    // contract: AI output is NEVER auto-approved.
    return this.insertNew(food, "candidate", "ai", null);
  }

  private setReviewed(id: string, status: FoodStatus, reviewedBy: string): StoredFood | null {
    const existing = this.records.get(id);
    if (!existing) return null;

    const updated: StoredFood = {
      ...existing,
      status,
      food: withStatus(existing.food, status),
      reviewedBy,
      reviewedAt: new Date().toISOString(),
    };
    this.records.set(id, updated);
    return this.cloneStored(updated);
  }

  async approve(id: string, reviewedBy: string): Promise<StoredFood | null> {
    return this.setReviewed(id, "approved", reviewedBy);
  }

  async reject(id: string, reviewedBy: string): Promise<StoredFood | null> {
    return this.setReviewed(id, "retired", reviewedBy);
  }

  async seedApproved(foods: CanonicalFood[]): Promise<void> {
    const seededIds = new Set(foods.map((food) => food.id));
    for (const food of foods) {
      const existing = this.records.get(food.id);
      const stored: StoredFood = {
        id: food.id,
        food: withStatus(food, "approved"),
        status: "approved",
        source: "seed",
        submittedBy: null,
        reviewedBy: existing?.reviewedBy ?? null,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        reviewedAt: existing?.reviewedAt ?? null,
      };
      this.records.set(food.id, stored);
    }

    // Reconcile REMOVALS (parity with PostgresFoodRepository.seedApproved):
    // retire any previously-seeded food no longer present in the catalog, so a
    // food removed from the code catalog stops being served. Scoped to
    // `source === "seed"` — never touches user/admin/ai foods.
    for (const [id, stored] of this.records) {
      if (stored.source === "seed" && stored.status === "approved" && !seededIds.has(id)) {
        this.records.set(id, { ...stored, status: "retired", food: withStatus(stored.food, "retired") });
      }
    }
  }
}
