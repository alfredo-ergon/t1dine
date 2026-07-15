// Coverage for the admin review-queue endpoints: `requireAdmin` auth
// (401/403/200), manual food addition, and `POST /admin/foods/ai-generate`'s
// "always a candidate, never auto-approved" guarantee. Fully
// in-memory/offline via `buildApp().inject` — no database, no network, no
// external AI call (`MockFoodAiProvider` is deterministic and offline).

import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const TEST_AUTH_SECRET = "test-only-fixed-auth-secret-for-vitest-admin";
const ADMIN_EMAIL = "admin@t1dine.local";
const HEX64 = "b".repeat(64);

function freshApp() {
  return buildApp({ authSecret: TEST_AUTH_SECRET, adminEmails: [ADMIN_EMAIL] });
}

async function registerAndLogin(
  app: ReturnType<typeof freshApp>,
  email: string,
  password = "a-perfectly-fine-password-123",
): Promise<string> {
  const response = await app.inject({ method: "POST", url: "/auth/register", payload: { email, password } });
  return response.json().token as string;
}

function manualFood(id: string): Record<string, unknown> {
  const source = {
    sourceId: "ADMIN-MANUAL",
    sourceRecordId: `ADMIN-${id}`,
    sourceVersion: "1.0",
    licence: "admin-curated",
    retrievedAt: "2026-07-10T00:00:00.000Z",
    rawSnapshotSha256: HEX64,
    mappingVersion: "admin-0.1",
  };

  return {
    id,
    type: "ingredient",
    names: [
      { language: "pt-PT", name: "Alimento curado pelo administrador", synonyms: [] },
      { language: "en", name: "Admin-curated food", synonyms: [] },
    ],
    countries: ["PT"],
    markets: ["PT"],
    barcodes: [],
    cuisineTags: [],
    dietaryPatternTags: [],
    mealContextTags: [],
    clinicalBehaviourTags: [],
    nutrients: [
      {
        nutrientCode: "CHOAVL",
        value: 10,
        unit: "g",
        basisQuantity: 100,
        basisUnit: "g",
        method: "declared",
        confidence: "high",
        source,
      },
      {
        nutrientCode: "ENERC",
        value: 100,
        unit: "kcal",
        basisQuantity: 100,
        basisUnit: "g",
        method: "declared",
        confidence: "high",
        source,
      },
    ],
    status: "candidate", // deliberately "candidate" — admin add must still force "approved".
  };
}

describe("requireAdmin auth", () => {
  it("401s every admin route with no token", async () => {
    const app = freshApp();
    const responses = await Promise.all([
      app.inject({ method: "GET", url: "/admin/foods" }),
      app.inject({ method: "POST", url: "/admin/foods/some-id/approve" }),
      app.inject({ method: "POST", url: "/admin/foods/some-id/reject" }),
      app.inject({ method: "POST", url: "/admin/foods", payload: manualFood("x") }),
      app.inject({ method: "POST", url: "/admin/foods/ai-generate", payload: { count: 1 } }),
    ]);
    for (const response of responses) {
      expect(response.statusCode).toBe(401);
    }
  });

  it("403s an authenticated user who is not an admin", async () => {
    const app = freshApp();
    const token = await registerAndLogin(app, "not-admin@example.com");

    const response = await app.inject({
      method: "GET",
      url: "/admin/foods",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe("forbidden");
  });

  it("200s for an authenticated admin (email in ADMIN_EMAILS)", async () => {
    const app = freshApp();
    const token = await registerAndLogin(app, ADMIN_EMAIL, "admin-password-123");

    const response = await app.inject({
      method: "GET",
      url: "/admin/foods",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.count).toBeGreaterThan(0);
    // The seed catalog is visible in the review queue too, with full provenance.
    expect(body.foods.some((food: { source: string }) => food.source === "seed")).toBe(true);
  });

  it("admin membership is case-insensitive", async () => {
    const app = freshApp();
    const token = await registerAndLogin(app, "ADMIN@T1Dine.LOCAL", "admin-password-123");

    const response = await app.inject({
      method: "GET",
      url: "/admin/foods",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
  });
});

describe("GET /admin/foods filters", () => {
  it("filters by status and source", async () => {
    const app = freshApp();
    const token = await registerAndLogin(app, ADMIN_EMAIL, "admin-password-123");

    const response = await app.inject({
      method: "GET",
      url: "/admin/foods?status=approved&source=seed",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.count).toBeGreaterThan(0);
    expect(
      body.foods.every((food: { status: string; source: string }) => food.status === "approved" && food.source === "seed"),
    ).toBe(true);
  });

  it("rejects an invalid status value with 400", async () => {
    const app = freshApp();
    const token = await registerAndLogin(app, ADMIN_EMAIL, "admin-password-123");

    const response = await app.inject({
      method: "GET",
      url: "/admin/foods?status=not-a-status",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("POST /admin/foods (manual add)", () => {
  it("stores the food as approved/admin regardless of its own status field", async () => {
    const app = freshApp();
    const token = await registerAndLogin(app, ADMIN_EMAIL, "admin-password-123");

    const response = await app.inject({
      method: "POST",
      url: "/admin/foods",
      payload: manualFood("admin-added-food-1"),
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).toBe("approved");
    expect(body.source).toBe("admin");

    const visible = await app.inject({ method: "GET", url: "/catalog/foods/admin-added-food-1" });
    expect(visible.statusCode).toBe(200);
  });

  it("rejects an invalid food with 400", async () => {
    const app = freshApp();
    const token = await registerAndLogin(app, ADMIN_EMAIL, "admin-password-123");

    const response = await app.inject({
      method: "POST",
      url: "/admin/foods",
      payload: { id: "broken" },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(400);
  });

  it("409s a duplicate id", async () => {
    const app = freshApp();
    const token = await registerAndLogin(app, ADMIN_EMAIL, "admin-password-123");

    await app.inject({
      method: "POST",
      url: "/admin/foods",
      payload: manualFood("admin-added-food-2"),
      headers: { authorization: `Bearer ${token}` },
    });
    const second = await app.inject({
      method: "POST",
      url: "/admin/foods",
      payload: manualFood("admin-added-food-2"),
      headers: { authorization: `Bearer ${token}` },
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe("id_taken");
  });
});

describe("POST /admin/foods/ai-generate", () => {
  it("generates N candidate foods that are NEVER auto-approved", async () => {
    const app = freshApp();
    const token = await registerAndLogin(app, ADMIN_EMAIL, "admin-password-123");

    const response = await app.inject({
      method: "POST",
      url: "/admin/foods/ai-generate",
      payload: { cuisine: "italian", count: 3 },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.count).toBe(3);
    expect(body.foods).toHaveLength(3);

    for (const stored of body.foods) {
      expect(stored.status).toBe("candidate");
      expect(stored.source).toBe("ai");
      expect(stored.food.status).toBe("candidate");
      for (const nutrient of stored.food.nutrients) {
        expect(nutrient.confidence).toBe("unverified");
        expect(nutrient.method).toBe("estimated");
        expect(nutrient.source.sourceId).toBe("AI-CANDIDATE");
      }
    }
  });

  it("is deterministic given the same store state and parameters", async () => {
    const appA = freshApp();
    const appB = freshApp();
    const tokenA = await registerAndLogin(appA, ADMIN_EMAIL, "admin-password-123");
    const tokenB = await registerAndLogin(appB, ADMIN_EMAIL, "admin-password-123");

    const payload = { cuisine: "greek", count: 2 };
    const responseA = await appA.inject({
      method: "POST",
      url: "/admin/foods/ai-generate",
      payload,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const responseB = await appB.inject({
      method: "POST",
      url: "/admin/foods/ai-generate",
      payload,
      headers: { authorization: `Bearer ${tokenB}` },
    });

    const foodsA = responseA.json().foods.map((s: { food: unknown }) => s.food);
    const foodsB = responseB.json().foods.map((s: { food: unknown }) => s.food);
    expect(foodsA).toEqual(foodsB);
  });

  it("generated candidates never appear in /catalog/foods until approved", async () => {
    const app = freshApp();
    const token = await registerAndLogin(app, ADMIN_EMAIL, "admin-password-123");

    const generate = await app.inject({
      method: "POST",
      url: "/admin/foods/ai-generate",
      payload: { cuisine: "polish", count: 1 },
      headers: { authorization: `Bearer ${token}` },
    });
    const [candidate] = generate.json().foods;

    const hiddenBefore = await app.inject({ method: "GET", url: `/catalog/foods/${candidate.id}` });
    expect(hiddenBefore.statusCode).toBe(404);

    const approve = await app.inject({
      method: "POST",
      url: `/admin/foods/${candidate.id}/approve`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(approve.statusCode).toBe(200);

    const visibleAfter = await app.inject({ method: "GET", url: `/catalog/foods/${candidate.id}` });
    expect(visibleAfter.statusCode).toBe(200);
  });

  it("rejects a count outside 1..20 with 400", async () => {
    const app = freshApp();
    const token = await registerAndLogin(app, ADMIN_EMAIL, "admin-password-123");

    const tooFew = await app.inject({
      method: "POST",
      url: "/admin/foods/ai-generate",
      payload: { count: 0 },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(tooFew.statusCode).toBe(400);

    const tooMany = await app.inject({
      method: "POST",
      url: "/admin/foods/ai-generate",
      payload: { count: 21 },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(tooMany.statusCode).toBe(400);
  });
});
