// Unit + integration tests for rate limiting (security review H2/M3).
// Resolver functions are tested directly (pure, injectable env); the
// integration tests temporarily set `NODE_ENV` to something other than
// `"test"` (mirroring the existing NIGHTSCOUT_MODE mutate/restore convention
// in `./nightscout.test.ts`) so the `@fastify/rate-limit` plugin actually
// gets registered, then use tiny env-overridden limits to trip a 429
// quickly and deterministically.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import {
  isRateLimitingEnabled,
  resolveAuthRateLimit,
  resolveGlobalRateLimit,
  resolveNightscoutRateLimit,
  resolveOffLookupRateLimit,
  resolveSubmissionsRateLimit,
} from "../src/rateLimit.js";

describe("isRateLimitingEnabled", () => {
  it("is false under test (vitest's default NODE_ENV)", () => {
    expect(isRateLimitingEnabled({ NODE_ENV: "test" })).toBe(false);
  });

  it("is true in both dev and prod", () => {
    expect(isRateLimitingEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isRateLimitingEnabled({ NODE_ENV: "production" })).toBe(true);
    expect(isRateLimitingEnabled({})).toBe(true);
  });
});

describe("rate limit resolvers — defaults and env overrides", () => {
  it("resolveGlobalRateLimit defaults to 120/minute", () => {
    expect(resolveGlobalRateLimit({})).toEqual({ max: 120, timeWindow: 60_000 });
  });

  it("resolveAuthRateLimit defaults to 10/minute", () => {
    expect(resolveAuthRateLimit({})).toEqual({ max: 10, timeWindow: 60_000 });
  });

  it("resolveNightscoutRateLimit defaults to 30/minute", () => {
    expect(resolveNightscoutRateLimit({})).toEqual({ max: 30, timeWindow: 60_000 });
  });

  it("resolveOffLookupRateLimit defaults to 30/minute", () => {
    expect(resolveOffLookupRateLimit({})).toEqual({ max: 30, timeWindow: 60_000 });
  });

  it("resolveSubmissionsRateLimit defaults to 20/minute", () => {
    expect(resolveSubmissionsRateLimit({})).toEqual({ max: 20, timeWindow: 60_000 });
  });

  it("honours an env override for max and timeWindow", () => {
    expect(resolveAuthRateLimit({ RATE_LIMIT_AUTH_MAX: "3", RATE_LIMIT_AUTH_WINDOW_MS: "5000" })).toEqual({
      max: 3,
      timeWindow: 5000,
    });
  });

  it("falls back to the default when an env override is not a positive number", () => {
    expect(resolveAuthRateLimit({ RATE_LIMIT_AUTH_MAX: "not-a-number" })).toEqual({ max: 10, timeWindow: 60_000 });
    expect(resolveAuthRateLimit({ RATE_LIMIT_AUTH_MAX: "-5" })).toEqual({ max: 10, timeWindow: 60_000 });
  });
});

function withNodeEnv<T>(value: string, fn: () => T): T {
  const original = process.env["NODE_ENV"];
  process.env["NODE_ENV"] = value;
  try {
    return fn();
  } finally {
    if (original === undefined) {
      delete process.env["NODE_ENV"];
    } else {
      process.env["NODE_ENV"] = original;
    }
  }
}

describe("rate limiting integration", () => {
  const envKeys = ["RATE_LIMIT_AUTH_MAX", "RATE_LIMIT_AUTH_WINDOW_MS", "RATE_LIMIT_MAX", "RATE_LIMIT_WINDOW_MS"];
  const originalValues = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of envKeys) {
      originalValues.set(key, process.env[key]);
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      const original = originalValues.get(key);
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  });

  it("does not rate-limit under test, even with a tiny configured max (existing suites must never flake)", async () => {
    process.env["RATE_LIMIT_MAX"] = "1";
    process.env["RATE_LIMIT_WINDOW_MS"] = "60000";
    const app = buildApp();

    const first = await app.inject({ method: "GET", url: "/health" });
    const second = await app.inject({ method: "GET", url: "/health" });
    const third = await app.inject({ method: "GET", url: "/health" });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(third.statusCode).toBe(200);
  });

  it("returns 429 once the global limit is exceeded outside test", async () => {
    process.env["RATE_LIMIT_MAX"] = "2";
    process.env["RATE_LIMIT_WINDOW_MS"] = "60000";
    const app = withNodeEnv("development", () => buildApp());

    const first = await app.inject({ method: "GET", url: "/health" });
    const second = await app.inject({ method: "GET", url: "/health" });
    const third = await app.inject({ method: "GET", url: "/health" });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(third.statusCode).toBe(429);
  });

  it("applies the tighter /auth/login limit independently of the (looser) global one", async () => {
    process.env["RATE_LIMIT_MAX"] = "1000"; // effectively unlimited globally
    process.env["RATE_LIMIT_WINDOW_MS"] = "60000";
    process.env["RATE_LIMIT_AUTH_MAX"] = "2";
    process.env["RATE_LIMIT_AUTH_WINDOW_MS"] = "60000";
    const app = withNodeEnv("development", () => buildApp());

    const payload = { email: "rate-limited@example.com", password: "wrong-password-123" };
    const first = await app.inject({ method: "POST", url: "/auth/login", payload });
    const second = await app.inject({ method: "POST", url: "/auth/login", payload });
    const third = await app.inject({ method: "POST", url: "/auth/login", payload });

    expect(first.statusCode).toBe(401); // wrong password, but under the limit
    expect(second.statusCode).toBe(401);
    expect(third.statusCode).toBe(429); // third request in the window is rate-limited
  });
});
