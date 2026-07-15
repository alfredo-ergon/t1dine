// Coverage for `POST /catalog/submissions`: optional auth, canonical-food
// validation, the "never auto-approved" guarantee, and the approve/reject
// lifecycle via the admin queue. Fully in-memory/offline via
// `buildApp().inject` — no database.

import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const TEST_AUTH_SECRET = "test-only-fixed-auth-secret-for-vitest-submissions";
const ADMIN_EMAIL = "admin@t1dine.local";
const HEX64 = "a".repeat(64);

function freshApp() {
  return buildApp({ authSecret: TEST_AUTH_SECRET, adminEmails: [ADMIN_EMAIL] });
}

function candidateFood(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const source = {
    sourceId: "USER-SUBMITTED",
    sourceRecordId: `USER-${id}`,
    sourceVersion: "1.0",
    licence: "user-submitted",
    retrievedAt: "2026-07-10T00:00:00.000Z",
    rawSnapshotSha256: HEX64,
    mappingVersion: "user-0.1",
  };

  return {
    id,
    type: "recipe",
    names: [
      { language: "pt-PT", name: "Bolo de chocolate caseiro", synonyms: [] },
      { language: "en", name: "Homemade chocolate cake", synonyms: [] },
    ],
    countries: ["PT"],
    markets: ["PT"],
    barcodes: [],
    cuisineTags: ["portuguese"],
    dietaryPatternTags: ["vegetarian"],
    mealContextTags: ["dessert"],
    clinicalBehaviourTags: [],
    nutrients: [
      {
        nutrientCode: "CHOAVL",
        value: 45,
        unit: "g",
        basisQuantity: 100,
        basisUnit: "g",
        method: "estimated",
        confidence: "unverified",
        source,
      },
      {
        nutrientCode: "ENERC",
        value: 350,
        unit: "kcal",
        basisQuantity: 100,
        basisUnit: "g",
        method: "estimated",
        confidence: "unverified",
        source,
      },
    ],
    // Deliberately claims "approved" — the server must override this to
    // "candidate" regardless (see the test below).
    status: "approved",
    ...overrides,
  };
}

async function adminToken(app: ReturnType<typeof freshApp>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email: ADMIN_EMAIL, password: "admin-password-123" },
  });
  return response.json().token;
}

describe("POST /catalog/submissions", () => {
  it("stores an anonymous submission as a candidate, never auto-approved", async () => {
    const app = freshApp();
    const response = await app.inject({
      method: "POST",
      url: "/catalog/submissions",
      payload: candidateFood("user-bolo-de-chocolate-1"),
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.id).toBe("user-bolo-de-chocolate-1");
    // Overridden to "candidate" despite the submitted body claiming "approved".
    expect(body.status).toBe("candidate");
  });

  it("does not expose a fresh submission through the public catalog", async () => {
    const app = freshApp();
    await app.inject({
      method: "POST",
      url: "/catalog/submissions",
      payload: candidateFood("user-bolo-de-chocolate-2"),
    });

    const byId = await app.inject({ method: "GET", url: "/catalog/foods/user-bolo-de-chocolate-2" });
    expect(byId.statusCode).toBe(404);

    const search = await app.inject({ method: "GET", url: "/catalog/foods?q=chocolate" });
    expect(search.json().count).toBe(0);
  });

  it("rejects a structurally invalid body with 400", async () => {
    const app = freshApp();
    const response = await app.inject({
      method: "POST",
      url: "/catalog/submissions",
      payload: { not: "a canonical food" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_food");
  });

  it("rejects a non-object body with 400", async () => {
    const app = freshApp();
    const response = await app.inject({
      method: "POST",
      url: "/catalog/submissions",
      payload: [1, 2, 3],
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects a duplicate id (already in the seed catalog) with 409", async () => {
    const app = freshApp();
    const response = await app.inject({
      method: "POST",
      url: "/catalog/submissions",
      payload: candidateFood("pt-maca"),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe("id_taken");
  });

  it("records the authenticated submitter when a valid bearer token is present", async () => {
    const app = freshApp();
    const registered = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "submitter@example.com", password: "submitter-password-123" },
    });
    const { token } = registered.json();

    await app.inject({
      method: "POST",
      url: "/catalog/submissions",
      payload: candidateFood("user-bolo-de-chocolate-3"),
      headers: { authorization: `Bearer ${token}` },
    });

    const token2 = await adminToken(app);
    const queue = await app.inject({
      method: "GET",
      url: "/admin/foods?status=candidate&source=user",
      headers: { authorization: `Bearer ${token2}` },
    });
    const record = queue.json().foods.find((f: { id: string }) => f.id === "user-bolo-de-chocolate-3");
    expect(record).toBeTruthy();
    expect(record.submittedBy).toBeTruthy();
    expect(typeof record.submittedBy).toBe("string");
  });

  it("proceeds anonymously (submittedBy null) with no token", async () => {
    const app = freshApp();
    await app.inject({
      method: "POST",
      url: "/catalog/submissions",
      payload: candidateFood("user-bolo-de-chocolate-4"),
    });

    const token = await adminToken(app);
    const queue = await app.inject({
      method: "GET",
      url: "/admin/foods?status=candidate",
      headers: { authorization: `Bearer ${token}` },
    });
    const record = queue.json().foods.find((f: { id: string }) => f.id === "user-bolo-de-chocolate-4");
    expect(record.submittedBy).toBeNull();
  });

  it("proceeds anonymously with a garbage bearer token rather than failing closed", async () => {
    const app = freshApp();
    const response = await app.inject({
      method: "POST",
      url: "/catalog/submissions",
      payload: candidateFood("user-bolo-de-chocolate-5"),
      headers: { authorization: "Bearer not-a-real-token" },
    });

    expect(response.statusCode).toBe(201);
  });
});

describe("Approve/reject lifecycle for a user submission", () => {
  it("becomes visible in /catalog/foods only after an admin approves it", async () => {
    const app = freshApp();
    await app.inject({
      method: "POST",
      url: "/catalog/submissions",
      payload: candidateFood("user-bolo-de-chocolate-6"),
    });

    const before = await app.inject({ method: "GET", url: "/catalog/foods/user-bolo-de-chocolate-6" });
    expect(before.statusCode).toBe(404);

    const token = await adminToken(app);
    const approve = await app.inject({
      method: "POST",
      url: "/admin/foods/user-bolo-de-chocolate-6/approve",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(approve.statusCode).toBe(200);
    expect(approve.json().status).toBe("approved");

    const after = await app.inject({ method: "GET", url: "/catalog/foods/user-bolo-de-chocolate-6" });
    expect(after.statusCode).toBe(200);
    expect(after.json().food.status).toBe("approved");
  });

  it("stays hidden (retired) after an admin rejects it", async () => {
    const app = freshApp();
    await app.inject({
      method: "POST",
      url: "/catalog/submissions",
      payload: candidateFood("user-bolo-de-chocolate-7"),
    });

    const token = await adminToken(app);
    const reject = await app.inject({
      method: "POST",
      url: "/admin/foods/user-bolo-de-chocolate-7/reject",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(reject.statusCode).toBe(200);
    expect(reject.json().status).toBe("retired");

    const after = await app.inject({ method: "GET", url: "/catalog/foods/user-bolo-de-chocolate-7" });
    expect(after.statusCode).toBe(404);
  });

  it("404s approving/rejecting an unknown id", async () => {
    const app = freshApp();
    const token = await adminToken(app);

    const approve = await app.inject({
      method: "POST",
      url: "/admin/foods/does-not-exist/approve",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(approve.statusCode).toBe(404);

    const reject = await app.inject({
      method: "POST",
      url: "/admin/foods/does-not-exist/reject",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(reject.statusCode).toBe(404);
  });
});
