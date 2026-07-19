// Reconciliation contract for `FoodRepository.seedApproved`: re-seeding with a
// SMALLER catalog (a food removed in code, e.g. a synthetic placeholder now
// superseded by a real INSA record — see `dedupePreferInsa` in
// `../src/catalog.ts`) must RETIRE the removed seed food so it stops being
// served, while never touching user/admin/ai-sourced foods. Exercised against
// the in-memory adapter (the Postgres adapter mirrors the same logic in SQL;
// no database is available in the Vitest run).

import { describe, expect, it } from "vitest";
import type { CanonicalFood } from "@t1dine/food-schema";
import { ingredientFood, packagedFood } from "@t1dine/food-schema/fixtures";
import { InMemoryFoodRepository } from "../src/repositories/inMemoryFoodRepository.js";

function withId(food: CanonicalFood, id: string): CanonicalFood {
  return { ...food, id };
}

describe("seedApproved — reconciles catalog removals", () => {
  it("retires a seed food dropped from the catalog on re-seed, but keeps user submissions", async () => {
    // Initial catalog has two seed foods.
    const repo = new InMemoryFoodRepository([withId(ingredientFood, "seed-a"), withId(ingredientFood, "seed-b")]);
    // A user-submitted candidate exists alongside the seed data.
    await repo.insertSubmission(withId(packagedFood, "user-x"), "user-1");

    // Re-seed with a SMALLER catalog — "seed-b" has been removed from code.
    await repo.seedApproved([withId(ingredientFood, "seed-a")]);

    expect((await repo.getById("seed-a"))?.status).toBe("approved");
    expect((await repo.getById("seed-b"))?.status).toBe("retired");

    // The user submission is never touched by seed reconciliation.
    const userFood = await repo.getById("user-x");
    expect(userFood?.status).toBe("candidate");
    expect(userFood?.source).toBe("user");

    // The retired food is excluded from the approved catalog served to clients.
    const approvedIds = (await repo.listAll({ status: "approved" })).map((f) => f.id);
    expect(approvedIds).toContain("seed-a");
    expect(approvedIds).not.toContain("seed-b");
  });

  it("leaves a seed food untouched when it is still in the catalog", async () => {
    const repo = new InMemoryFoodRepository([withId(ingredientFood, "seed-a")]);
    await repo.seedApproved([withId(ingredientFood, "seed-a")]);
    expect((await repo.getById("seed-a"))?.status).toBe("approved");
  });
});
