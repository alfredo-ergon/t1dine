// Tests for user-scoped cloud sync (Slice 5 accounts + sync foundation).
// Everything here is fully offline and in-memory (`buildApp()`'s default
// repositories) — no network, no database.

import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { customFood } from "@t1dine/food-schema/fixtures";
import { buildApp } from "../src/app.js";

const TEST_AUTH_SECRET = "test-only-fixed-auth-secret-for-vitest-sync";

async function registerAndGetToken(app: FastifyInstance, email: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password: "correct-password-123" },
  });
  return response.json().token as string;
}

describe("GET /sync/state", () => {
  it("returns the empty default when the user has never synced", async () => {
    const app = buildApp({ authSecret: TEST_AUTH_SECRET });
    const token = await registerAndGetToken(app, "empty@example.com");

    const response = await app.inject({
      method: "GET",
      url: "/sync/state",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state).toEqual({ favourites: [], customFoods: [] });
    expect(body.version).toBe(0);
    expect(body.updatedAt).toBeNull();
  });
});

describe("PUT /sync/state", () => {
  it("round-trips a state through PUT then GET", async () => {
    const app = buildApp({ authSecret: TEST_AUTH_SECRET });
    const token = await registerAndGetToken(app, "roundtrip@example.com");

    const putResponse = await app.inject({
      method: "PUT",
      url: "/sync/state",
      headers: { authorization: `Bearer ${token}` },
      payload: { state: { favourites: ["pt-maca"], customFoods: [customFood] } },
    });

    expect(putResponse.statusCode).toBe(200);
    const putBody = putResponse.json();
    expect(putBody.version).toBe(1);
    expect(typeof putBody.updatedAt).toBe("string");

    const getResponse = await app.inject({
      method: "GET",
      url: "/sync/state",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(getResponse.statusCode).toBe(200);
    const body = getResponse.json();
    expect(body.version).toBe(1);
    expect(body.state.favourites).toEqual(["pt-maca"]);
    expect(body.state.customFoods).toHaveLength(1);
    expect(body.state.customFoods[0].id).toBe(customFood.id);
  });

  it("scopes data strictly per user — a second user cannot see the first user's data", async () => {
    const app = buildApp({ authSecret: TEST_AUTH_SECRET });
    const tokenA = await registerAndGetToken(app, "usera@example.com");
    const tokenB = await registerAndGetToken(app, "userb@example.com");

    const putA = await app.inject({
      method: "PUT",
      url: "/sync/state",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { state: { favourites: ["secret-food-a"], customFoods: [] } },
    });
    expect(putA.statusCode).toBe(200);

    const responseB = await app.inject({
      method: "GET",
      url: "/sync/state",
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(responseB.statusCode).toBe(200);
    const bodyB = responseB.json();
    expect(bodyB.state.favourites).toEqual([]);
    expect(bodyB.version).toBe(0);

    // User A's own data is unaffected and still visible to user A only.
    const responseA = await app.inject({
      method: "GET",
      url: "/sync/state",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(responseA.json().state.favourites).toEqual(["secret-food-a"]);
  });

  it("rejects an invalid customFood with 400 and does not persist it", async () => {
    const app = buildApp({ authSecret: TEST_AUTH_SECRET });
    const token = await registerAndGetToken(app, "invalidfood@example.com");

    const response = await app.inject({
      method: "PUT",
      url: "/sync/state",
      headers: { authorization: `Bearer ${token}` },
      payload: { state: { favourites: [], customFoods: [{ id: "broken-food" }] } },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_custom_food");

    const getResponse = await app.inject({
      method: "GET",
      url: "/sync/state",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getResponse.json().version).toBe(0);
  });

  it("returns 409 with the current (unchanged) state on a stale baseVersion", async () => {
    const app = buildApp({ authSecret: TEST_AUTH_SECRET });
    const token = await registerAndGetToken(app, "conflict@example.com");

    const firstPut = await app.inject({
      method: "PUT",
      url: "/sync/state",
      headers: { authorization: `Bearer ${token}` },
      payload: { state: { favourites: ["first"], customFoods: [] } },
    });
    expect(firstPut.statusCode).toBe(200);
    expect(firstPut.json().version).toBe(1);

    // Client still thinks the server is at version 0 (stale).
    const staleResponse = await app.inject({
      method: "PUT",
      url: "/sync/state",
      headers: { authorization: `Bearer ${token}` },
      payload: { state: { favourites: ["second"], customFoods: [] }, baseVersion: 0 },
    });

    expect(staleResponse.statusCode).toBe(409);
    const body = staleResponse.json();
    expect(body.version).toBe(1);
    expect(body.state.favourites).toEqual(["first"]);

    // The conflicting write must not have been applied.
    const getResponse = await app.inject({
      method: "GET",
      url: "/sync/state",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getResponse.json().state.favourites).toEqual(["first"]);
    expect(getResponse.json().version).toBe(1);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const app = buildApp({ authSecret: TEST_AUTH_SECRET });

    const response = await app.inject({
      method: "PUT",
      url: "/sync/state",
      payload: { state: { favourites: [], customFoods: [] } },
    });

    expect(response.statusCode).toBe(401);
  });
});
