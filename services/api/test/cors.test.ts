// Unit + integration tests for the CORS allowlist (security review M2).
// `resolveCorsOptions` is tested directly (pure, injectable env) and via a
// real `buildApp()` + `app.inject()` round trip for the header behaviour.
// Integration tests mutate/restore `process.env.NODE_ENV` (the existing
// convention already used by `./nightscout.test.ts`'s NIGHTSCOUT_MODE
// tests), since `buildApp()` resolves CORS options from `process.env` at
// call time.

import { describe, expect, it } from "vitest";
import { resolveCorsOptions } from "../src/cors.js";
import { buildApp } from "../src/app.js";

describe("resolveCorsOptions", () => {
  it("returns no options (today's permissive default) outside production", () => {
    expect(resolveCorsOptions({ NODE_ENV: "development" })).toEqual({});
    expect(resolveCorsOptions({ NODE_ENV: "test" })).toEqual({});
    expect(resolveCorsOptions({})).toEqual({});
  });

  it("returns an origin function in production", () => {
    const options = resolveCorsOptions({ NODE_ENV: "production", CORS_ORIGINS: "https://app.example.com" });
    expect(typeof options.origin).toBe("function");
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

describe("CORS integration — dev/test (unchanged permissive default)", () => {
  it("allows any Origin via the unchanged '*' default (today's existing behaviour)", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://totally-arbitrary-origin.example" },
    });

    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });
});

describe("CORS integration — production allowlist", () => {
  it("reflects an allowlisted origin", async () => {
    const original = process.env["CORS_ORIGINS"];
    process.env["CORS_ORIGINS"] = "https://allowed.example.com";
    try {
      const app = withNodeEnv("production", () => buildApp());
      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "https://allowed.example.com" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe("https://allowed.example.com");
    } finally {
      if (original === undefined) {
        delete process.env["CORS_ORIGINS"];
      } else {
        process.env["CORS_ORIGINS"] = original;
      }
    }
  });

  it("omits Access-Control-Allow-Origin for a non-allowlisted origin, but still serves the request", async () => {
    const original = process.env["CORS_ORIGINS"];
    process.env["CORS_ORIGINS"] = "https://allowed.example.com";
    try {
      const app = withNodeEnv("production", () => buildApp());
      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "https://not-allowed.example.com" },
      });

      // CORS is a browser-enforced boundary, not server-side authorization —
      // the request itself still succeeds; only the header a browser relies
      // on to permit reading the response is withheld.
      expect(response.statusCode).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      if (original === undefined) {
        delete process.env["CORS_ORIGINS"];
      } else {
        process.env["CORS_ORIGINS"] = original;
      }
    }
  });

  it("rejects every browser origin when CORS_ORIGINS is unset (fail closed)", async () => {
    const original = process.env["CORS_ORIGINS"];
    delete process.env["CORS_ORIGINS"];
    try {
      const app = withNodeEnv("production", () => buildApp());
      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "https://anything.example.com" },
      });

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      if (original !== undefined) {
        process.env["CORS_ORIGINS"] = original;
      }
    }
  });

  it("always allows a request with no Origin header at all (native mobile clients)", async () => {
    const app = withNodeEnv("production", () => buildApp());
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
  });
});
