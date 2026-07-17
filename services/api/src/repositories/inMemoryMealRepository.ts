// Default, zero-dependency `MealRepository` adapter. Keeps meals in a
// per-instance `Map`, keyed by a deterministic, monotonically increasing id
// (`meal-1`, `meal-2`, ...) — never `Math.random()`/`Date.now()` for the id,
// per CLAUDE.md's idempotency rule. This is the adapter `buildApp()` uses by
// default when no `mealRepository` is injected, so it must reproduce the
// exact behaviour the in-memory `Map` inside `modules/meals.ts` used to
// provide directly.

import type { MealSummary } from "@t1dine/nutrition";
import type { MealRepository, StoredMeal } from "./mealRepository.js";

export class InMemoryMealRepository implements MealRepository {
  private readonly meals = new Map<string, StoredMeal>();
  private sequence = 0;

  private nextId(): string {
    this.sequence += 1;
    return `meal-${this.sequence}`;
  }

  async save(summary: MealSummary, ownerId: string): Promise<{ id: string }> {
    const id = this.nextId();
    const stored: StoredMeal = {
      id,
      // Real time is acceptable for record metadata (see StoredMeal docs);
      // it never influences the id.
      createdAt: new Date().toISOString(),
      summary,
      ownerId,
    };
    this.meals.set(id, stored);
    return { id };
  }

  async get(id: string): Promise<StoredMeal | null> {
    return this.meals.get(id) ?? null;
  }
}
