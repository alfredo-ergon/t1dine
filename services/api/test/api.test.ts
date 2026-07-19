import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

const TEST_AUTH_SECRET = "test-only-fixed-auth-secret-for-vitest-api";

async function registerAndGetToken(app: FastifyInstance, email: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password: "correct-password-123" },
  });
  return response.json().token as string;
}

describe("GET /health", () => {
  it("reports liveness without any health/clinical data", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({ status: "ok", service: "t1dine-api" });
    expect(typeof body.time).toBe("string");
  });
});

describe("GET /catalog/foods", () => {
  it("returns the full catalog when no query is given", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/catalog/foods" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.count).toBeGreaterThanOrEqual(12);
    expect(body.foods.length).toBe(body.count);
    // Provenance must be preserved on every returned food.
    expect(body.foods[0].nutrients[0].source.sourceId).toBe("SYNTH-T1DINE-PT");
  });

  it("filters by q, accent-insensitively", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/catalog/foods?q=maca" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.foods.some((food: { id: string }) => food.id === "pt-maca")).toBe(true);
  });

  it("returns no results for a query that matches nothing", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/catalog/foods?q=zzz-not-a-food" });

    expect(response.statusCode).toBe(200);
    expect(response.json().count).toBe(0);
  });

  it("rejects an empty q with 400", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/catalog/foods?q=" });

    expect(response.statusCode).toBe(400);
  });
});

describe("GET /catalog/foods/:id", () => {
  it("returns a known food with provenance", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/catalog/foods/pt-arroz-branco-cozido" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.food.id).toBe("pt-arroz-branco-cozido");
    expect(body.food.nutrients.some((n: { nutrientCode: string }) => n.nutrientCode === "CHOAVL")).toBe(true);
  });

  it("404s for an unknown id", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/catalog/foods/does-not-exist" });

    expect(response.statusCode).toBe(404);
  });
});

describe("POST /meals", () => {
  it("computes correct totals for a known 2-item meal", async () => {
    const app = buildApp({ authSecret: TEST_AUTH_SECRET });
    const token = await registerAndGetToken(app, "meals-totals@example.com");
    const response = await app.inject({
      method: "POST",
      url: "/meals",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        lines: [
          { foodId: "pt-arroz-branco-cozido", amount: 100 }, // 28.2 g carb / 130 kcal per 100g
          { foodId: "pt-maca", amount: 150 }, // 11.8 g carb / 52 kcal per 100g -> x1.5
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.id).toBeTruthy();
    expect(body.summary.itemCount).toBe(2);
    expect(body.summary.totalCarbGrams).toBeCloseTo(28.2 + 11.8 * 1.5, 5);
    expect(body.summary.totalEnergyKcal).toBe(Math.round(130 + 52 * 1.5));
    expect(body.summary.aggregateConfidence).toBe("high");
    expect(body.summary.hasUncertainty).toBe(false);
  });

  it("rejects an unknown foodId with 400", async () => {
    const app = buildApp({ authSecret: TEST_AUTH_SECRET });
    const token = await registerAndGetToken(app, "meals-unknown-food@example.com");
    const response = await app.inject({
      method: "POST",
      url: "/meals",
      headers: { authorization: `Bearer ${token}` },
      payload: { lines: [{ foodId: "not-a-real-food", amount: 100 }] },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe("unknown_food");
  });

  it("rejects a negative amount with 400", async () => {
    const app = buildApp({ authSecret: TEST_AUTH_SECRET });
    const token = await registerAndGetToken(app, "meals-negative-amount@example.com");
    const response = await app.inject({
      method: "POST",
      url: "/meals",
      headers: { authorization: `Bearer ${token}` },
      payload: { lines: [{ foodId: "pt-maca", amount: -5 }] },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe("invalid_body");
  });

  it("rejects an unauthenticated request with 401 (M4)", async () => {
    const app = buildApp({ authSecret: TEST_AUTH_SECRET });
    const response = await app.inject({
      method: "POST",
      url: "/meals",
      payload: { lines: [{ foodId: "pt-maca", amount: 100 }] },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("GET /meals/:id", () => {
  it("retrieves a previously stored meal for its owner", async () => {
    const app = buildApp({ authSecret: TEST_AUTH_SECRET });
    const token = await registerAndGetToken(app, "meals-owner@example.com");
    const created = await app.inject({
      method: "POST",
      url: "/meals",
      headers: { authorization: `Bearer ${token}` },
      payload: { lines: [{ foodId: "pt-maca", amount: 100 }] },
    });
    const { id } = created.json();

    const fetched = await app.inject({
      method: "GET",
      url: `/meals/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().id).toBe(id);
  });

  it("404s for an unknown meal id", async () => {
    const app = buildApp({ authSecret: TEST_AUTH_SECRET });
    const token = await registerAndGetToken(app, "meals-unknown-id@example.com");
    const response = await app.inject({
      method: "GET",
      url: "/meals/does-not-exist",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it("rejects an unauthenticated request with 401 (M4)", async () => {
    const app = buildApp({ authSecret: TEST_AUTH_SECRET });
    const response = await app.inject({ method: "GET", url: "/meals/meal-1" });

    expect(response.statusCode).toBe(401);
  });

  it("404s (never 403) when a different authenticated user requests someone else's meal (M4 ownership)", async () => {
    const app = buildApp({ authSecret: TEST_AUTH_SECRET });
    const ownerToken = await registerAndGetToken(app, "meals-owner-2@example.com");
    const otherToken = await registerAndGetToken(app, "meals-other-user@example.com");

    const created = await app.inject({
      method: "POST",
      url: "/meals",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { lines: [{ foodId: "pt-maca", amount: 100 }] },
    });
    const { id } = created.json();

    const response = await app.inject({
      method: "GET",
      url: `/meals/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
