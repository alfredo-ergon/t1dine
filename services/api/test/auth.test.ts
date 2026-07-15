// Tests for accounts (Slice 5 accounts + sync foundation). Everything here
// is fully offline and in-memory (`buildApp()`'s default repositories) —
// no network, no database. A fixed `authSecret` is injected purely for
// determinism; production always resolves it from `AUTH_SECRET` (see
// `resolveAuthSecret` in `src/modules/auth.ts`).

import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const TEST_AUTH_SECRET = "test-only-fixed-auth-secret-for-vitest-auth";

function freshApp() {
  return buildApp({ authSecret: TEST_AUTH_SECRET });
}

describe("POST /auth/register", () => {
  it("registers a new user and returns a bearer token", async () => {
    const app = freshApp();

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "person@example.com", password: "correct horse battery staple" },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(0);
  });

  it("rejects a duplicate email with 409", async () => {
    const app = freshApp();
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "dup@example.com", password: "password-one-123" },
    });

    const second = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "dup@example.com", password: "different-password-456" },
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe("email_taken");
  });

  it("treats email as case-insensitive for the duplicate check", async () => {
    const app = freshApp();
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "MixedCase@Example.com", password: "password-one-123" },
    });

    const second = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "mixedcase@example.com", password: "different-password-456" },
    });

    expect(second.statusCode).toBe(409);
  });

  it("rejects an invalid email with 400", async () => {
    const app = freshApp();
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "not-an-email", password: "password-123" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_body");
  });

  it("rejects a too-short password with 400", async () => {
    const app = freshApp();
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "short@example.com", password: "short" },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("logs in with the correct password and returns a bearer token", async () => {
    const app = freshApp();
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "login@example.com", password: "correct-password-123" },
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "login@example.com", password: "correct-password-123" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(0);
  });

  it("rejects a wrong password with 401", async () => {
    const app = freshApp();
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "wrongpass@example.com", password: "correct-password-123" },
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "wrongpass@example.com", password: "totally-wrong-password" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe("invalid_credentials");
  });

  it("rejects an unknown email with 401, identically to a wrong password", async () => {
    const app = freshApp();
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "never-registered@example.com", password: "whatever-password" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe("invalid_credentials");
  });
});

describe("requireAuth (exercised via a protected sync route)", () => {
  it("rejects a request with no Authorization header with 401", async () => {
    const app = freshApp();
    const response = await app.inject({ method: "GET", url: "/sync/state" });

    expect(response.statusCode).toBe(401);
  });

  it("rejects a garbage bearer token with 401", async () => {
    const app = freshApp();
    const response = await app.inject({
      method: "GET",
      url: "/sync/state",
      headers: { authorization: "Bearer not-a-real-token" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects a well-formed but wrongly-signed token with 401", async () => {
    const appA = buildApp({ authSecret: "secret-a" });
    const appB = buildApp({ authSecret: "secret-b" });

    const registered = await appA.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "crosskey@example.com", password: "correct-password-123" },
    });
    const { token } = registered.json();

    const response = await appB.inject({
      method: "GET",
      url: "/sync/state",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(401);
  });

  it("accepts a valid token minted by /auth/register", async () => {
    const app = freshApp();
    const registered = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "authed@example.com", password: "correct-password-123" },
    });
    const { token } = registered.json();

    const response = await app.inject({
      method: "GET",
      url: "/sync/state",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
  });
});
