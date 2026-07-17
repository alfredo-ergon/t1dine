// Exercises the default `MealRepository` adapter in full isolation — no
// network, no database. `PostgresMealRepository` is deliberately not
// exercised here: the Vitest run must pass with no database available.

import { describe, expect, it } from "vitest";
import type { MealSummary } from "@t1dine/nutrition";
import { InMemoryMealRepository } from "../src/repositories/inMemoryMealRepository.js";

const OWNER = "user-owner-1";

function fakeSummary(overrides: Partial<MealSummary> = {}): MealSummary {
  return {
    lines: [],
    itemCount: 0,
    totalCarbGrams: 0,
    totalEnergyKcal: 0,
    aggregateConfidence: "high",
    hasUncertainty: false,
    ...overrides,
  };
}

describe("InMemoryMealRepository", () => {
  it("round-trips a saved summary through get(), including its owner (M4)", async () => {
    const repository = new InMemoryMealRepository();
    const summary = fakeSummary({ itemCount: 2, totalCarbGrams: 40, totalEnergyKcal: 182 });

    const { id } = await repository.save(summary, OWNER);
    const stored = await repository.get(id);

    expect(stored).not.toBeNull();
    expect(stored?.id).toBe(id);
    expect(stored?.summary).toEqual(summary);
    expect(stored?.ownerId).toBe(OWNER);
    expect(typeof stored?.createdAt).toBe("string");
  });

  it("returns null for an unknown id", async () => {
    const repository = new InMemoryMealRepository();

    const stored = await repository.get("does-not-exist");

    expect(stored).toBeNull();
  });

  it("assigns deterministic, sequential ids (never Math.random/Date.now)", async () => {
    const repository = new InMemoryMealRepository();

    const first = await repository.save(fakeSummary(), OWNER);
    const second = await repository.save(fakeSummary(), OWNER);
    const third = await repository.save(fakeSummary(), OWNER);

    expect(first.id).toBe("meal-1");
    expect(second.id).toBe("meal-2");
    expect(third.id).toBe("meal-3");
  });

  it("keeps separate instances fully isolated from one another", async () => {
    const repositoryA = new InMemoryMealRepository();
    const repositoryB = new InMemoryMealRepository();

    // Advance A's sequence well past 1 before B ever saves anything.
    await repositoryA.save(fakeSummary({ itemCount: 5 }), OWNER);
    await repositoryA.save(fakeSummary({ itemCount: 5 }), OWNER);
    const { id: idInB } = await repositoryB.save(fakeSummary({ itemCount: 1 }), OWNER);

    // B's own sequence still starts at 1 — no shared/global counter or store.
    expect(idInB).toBe("meal-1");
    expect((await repositoryB.get(idInB))?.summary.itemCount).toBe(1);
  });

  it("records different owners for different saves (M4 ownership)", async () => {
    const repository = new InMemoryMealRepository();

    const { id: idA } = await repository.save(fakeSummary(), "user-a");
    const { id: idB } = await repository.save(fakeSummary(), "user-b");

    expect((await repository.get(idA))?.ownerId).toBe("user-a");
    expect((await repository.get(idB))?.ownerId).toBe("user-b");
  });
});
