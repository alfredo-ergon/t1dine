// Tests for the generic fallback error handler (security review L1). Fully
// offline via `buildApp().inject()` — no network, no database.

import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("generic error handler (L1)", () => {
  it("returns a generic 500 and never echoes an uncaught error's message", async () => {
    const app = buildApp();
    app.get("/__test/throws", async () => {
      throw new Error("super-secret-internal-detail-should-never-leak");
    });

    const response = await app.inject({ method: "GET", url: "/__test/throws" });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body.error).toBe("internal_error");
    expect(response.body).not.toContain("super-secret-internal-detail-should-never-leak");
  });

  it("leaves an existing typed 4xx response (zod validation) completely unaffected", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/catalog/foods?q=" });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_query");
  });

  it("forwards Fastify's own request-parsing 4xx (malformed JSON body) rather than turning it into a 500", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "content-type": "application/json" },
      payload: "{not-valid-json",
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(response.statusCode).toBeLessThan(500);
  });
});
