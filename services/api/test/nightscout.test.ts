// Tests for the read-only Nightscout glucose module (Slice 6) and its
// security-hardening additions (H1 — requireAuth + SSRF guard). Everything
// here is deterministic and offline: `fetch`, the clock, and the DNS
// resolver are all injected via `buildApp({ nightscout: { fetchImpl, now,
// dnsLookupImpl } })`, never real network/DNS calls.

import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { NightscoutTestOverrides } from "../src/modules/nightscout.js";

const FIXED_NOW = Date.UTC(2026, 6, 13, 12, 0, 0); // 2026-07-13T12:00:00.000Z
const SECRET_TOKEN = "super-secret-nightscout-token-do-not-leak";
const TEST_AUTH_SECRET = "test-only-fixed-auth-secret-for-vitest-nightscout";

function fixedClock(nowMs: number = FIXED_NOW): () => number {
  return () => nowMs;
}

// The existing suite (predating the H1 hardening) exercises fake hostnames
// like "example-nightscout.test" that must never trigger a REAL DNS lookup
// in CI. Injecting a resolver that always throws exercises the SSRF guard's
// documented "safe fallback" path (treat an unresolvable host as not
// blocked) deterministically and fully offline — see `../src/ssrfGuard.ts`.
const NO_DNS = async (): Promise<never> => {
  throw new Error("dns lookup unavailable in tests");
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function authedApp(
  overrides: NightscoutTestOverrides = {},
): Promise<{ app: FastifyInstance; token: string }> {
  const app = buildApp({
    authSecret: TEST_AUTH_SECRET,
    nightscout: { dnsLookupImpl: NO_DNS, ...overrides },
  });
  const registered = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email: "nightscout-tester@example.com", password: "correct-password-123" },
  });
  const token = registered.json().token as string;
  return { app, token };
}

function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

describe("POST /integrations/nightscout/glucose — auth (H1)", () => {
  it("rejects an unauthenticated request with 401 before any fetch/DNS work happens", async () => {
    const fetchImpl = vi.fn();
    const app = buildApp({
      authSecret: TEST_AUTH_SECRET,
      nightscout: { fetchImpl, now: fixedClock(), dnsLookupImpl: NO_DNS },
    });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      payload: { mock: true, count: 6 },
    });

    expect(response.statusCode).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a garbage bearer token with 401", async () => {
    const app = buildApp({ authSecret: TEST_AUTH_SECRET, nightscout: { dnsLookupImpl: NO_DNS } });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: { authorization: "Bearer not-a-real-token" },
      payload: { mock: true },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("POST /integrations/nightscout/glucose — mock mode", () => {
  it("returns deterministic synthetic readings without touching the network", async () => {
    const fetchImpl = vi.fn();
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { mock: true, count: 6 },
    });

    expect(response.statusCode).toBe(200);
    expect(fetchImpl).not.toHaveBeenCalled();

    const body = response.json();
    expect(body.source).toBe("mock");
    expect(body.readings).toHaveLength(6);
    for (const reading of body.readings) {
      expect(typeof reading.sgv).toBe("number");
      expect(reading.mgdl).toBe(reading.sgv);
      expect(typeof reading.mmol).toBe("number");
      expect(typeof reading.date).toBe("number");
      expect(typeof reading.iso).toBe("string");
      expect(typeof reading.ageMinutes).toBe("number");
      expect(typeof reading.stale).toBe("boolean");
    }
    // Freshest mock reading (index 0) is only a few minutes old, well under
    // the default 15-minute threshold, so the "no fresh glucose" state must
    // not be triggered.
    expect(body.allStale).toBe(false);
    expect(body.newest).not.toBeNull();
    expect(body.newest.stale).toBe(false);
  });

  it("is deterministic across repeated calls given the same injected clock", async () => {
    const { app, token } = await authedApp({ fetchImpl: vi.fn(), now: fixedClock() });

    const first = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { mock: true, count: 4 },
    });
    const second = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { mock: true, count: 4 },
    });

    expect(first.json()).toEqual(second.json());
  });

  it("honours NIGHTSCOUT_MODE=mock even without an explicit mock flag", async () => {
    const originalMode = process.env["NIGHTSCOUT_MODE"];
    process.env["NIGHTSCOUT_MODE"] = "mock";
    try {
      const { app, token } = await authedApp({ fetchImpl: vi.fn(), now: fixedClock() });
      const response = await app.inject({
        method: "POST",
        url: "/integrations/nightscout/glucose",
        headers: authHeader(token),
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().source).toBe("mock");
    } finally {
      if (originalMode === undefined) {
        delete process.env["NIGHTSCOUT_MODE"];
      } else {
        process.env["NIGHTSCOUT_MODE"] = originalMode;
      }
    }
  });
});

describe("POST /integrations/nightscout/glucose — live mode", () => {
  it("fetches, validates, and normalises a well-formed upstream payload", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        { sgv: 110, date: FIXED_NOW - 4 * 60_000, direction: "Flat" },
        { sgv: 118, date: FIXED_NOW - 9 * 60_000, direction: "FortyFiveUp" },
      ]),
    );
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://example-nightscout.test", token: SECRET_TOKEN, count: 2 },
    });

    expect(response.statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const body = response.json();
    expect(body.source).toBe("live");
    expect(body.readings).toHaveLength(2);

    const first = body.readings[0];
    expect(first.sgv).toBe(110);
    expect(first.mgdl).toBe(110);
    expect(first.mmol).toBeCloseTo(110 / 18.0182, 1);
    expect(first.direction).toBe("Flat");
    expect(first.ageMinutes).toBe(4);
    expect(first.stale).toBe(false);

    expect(body.allStale).toBe(false);
    expect(body.newest.sgv).toBe(110);
  });

  it("sends the token upstream as a query parameter but never logs or returns it", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([{ sgv: 100, date: FIXED_NOW - 2 * 60_000 }]));
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://example-nightscout.test", token: SECRET_TOKEN, count: 1 },
    });

    expect(response.statusCode).toBe(200);

    // The handler did send the token upstream...
    const calledUrl = String(fetchImpl.mock.calls[0]?.[0]);
    expect(calledUrl).toContain(`token=${SECRET_TOKEN}`);
    expect(calledUrl).toContain("/api/v1/entries/sgv.json");

    // ...but it must never appear anywhere in the response sent back to the caller.
    expect(response.body).not.toContain(SECRET_TOKEN);
  });

  it("requires a url outside mock mode (fails closed rather than guessing a target)", async () => {
    const { app, token } = await authedApp({ fetchImpl: vi.fn(), now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { token: SECRET_TOKEN },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain(SECRET_TOKEN);
  });

  it("returns 502 and never leaks the token when the upstream site is unreachable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error(`fetch failed for token=${SECRET_TOKEN}`);
    });
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://example-nightscout.test", token: SECRET_TOKEN },
    });

    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain(SECRET_TOKEN);
    expect(response.json().error).toBe("upstream_unreachable");
  });

  it("returns 502 when the upstream site responds with a non-2xx status", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: "not found" }, 404));
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://example-nightscout.test", token: SECRET_TOKEN },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe("upstream_error");
    expect(response.body).not.toContain(SECRET_TOKEN);
  });

  it("fails closed with 502 on a malformed upstream payload (not an array)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ not: "an array of sgv entries" }));
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://example-nightscout.test", token: SECRET_TOKEN },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe("upstream_malformed");
    expect(response.body).not.toContain(SECRET_TOKEN);
  });

  it("drops an individually malformed entry but keeps the well-formed ones in the same response", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        { sgv: 110, date: FIXED_NOW - 4 * 60_000, direction: "Flat" },
        { sgv: "one-hundred-and-ten", date: FIXED_NOW - 6 * 60_000 }, // malformed: sgv is a string
        { sgv: 118, date: FIXED_NOW - 9 * 60_000, direction: "FortyFiveUp" },
      ]),
    );
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://example-nightscout.test" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.source).toBe("live");
    // Only the two well-formed entries survive; the malformed one is dropped
    // silently rather than failing the whole request.
    expect(body.readings).toHaveLength(2);
    expect(body.readings.map((reading: { sgv: number }) => reading.sgv)).toEqual([110, 118]);
  });

  it("fails closed with 502 when every upstream entry is malformed and the top-level shape is not an array", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ sgv: 110, date: FIXED_NOW }));
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://example-nightscout.test" },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe("upstream_malformed");
  });

  it("treats an array of entirely malformed entries as an empty (not fabricated) reading list", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        { sgv: "not-a-number", date: FIXED_NOW },
        { sgv: -5, date: FIXED_NOW }, // sgv must be positive
      ]),
    );
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://example-nightscout.test" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.readings).toHaveLength(0);
    expect(body.allStale).toBe(true);
    expect(body.newest).toBeNull();
  });

  it("fails closed with 502 when the upstream response body is not valid JSON", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("this is not json", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://example-nightscout.test", token: SECRET_TOKEN },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe("upstream_malformed");
    expect(response.body).not.toContain(SECRET_TOKEN);
  });

  it("caps the number of readings to the requested count even if upstream returns more", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        { sgv: 110, date: FIXED_NOW - 4 * 60_000 },
        { sgv: 112, date: FIXED_NOW - 9 * 60_000 },
        { sgv: 118, date: FIXED_NOW - 14 * 60_000 },
      ]),
    );
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://example-nightscout.test", count: 2 },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.readings).toHaveLength(2);
    expect(body.readings.map((reading: { sgv: number }) => reading.sgv)).toEqual([110, 112]);
  });

  it("sets allStale true and newest null when every reading is older than the threshold", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        { sgv: 105, date: FIXED_NOW - 60 * 60_000 },
        { sgv: 108, date: FIXED_NOW - 45 * 60_000 },
      ]),
    );
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://example-nightscout.test", token: SECRET_TOKEN },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.readings).toHaveLength(2);
    expect(body.readings.every((reading: { stale: boolean }) => reading.stale)).toBe(true);
    expect(body.allStale).toBe(true);
    expect(body.newest).toBeNull();
    expect(response.body).not.toContain(SECRET_TOKEN);
  });

  it("treats an empty upstream list as a 'no fresh glucose' state, not an error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([]));
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://example-nightscout.test" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.readings).toHaveLength(0);
    expect(body.allStale).toBe(true);
    expect(body.newest).toBeNull();
  });

  it("respects a custom staleAfterMinutes threshold", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([{ sgv: 100, date: FIXED_NOW - 20 * 60_000 }]));
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://example-nightscout.test", staleAfterMinutes: 30 },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.readings[0].stale).toBe(false);
    expect(body.allStale).toBe(false);
  });
});

describe("POST /integrations/nightscout/glucose — request validation", () => {
  it("rejects an out-of-range count with 400", async () => {
    const { app, token } = await authedApp({ fetchImpl: vi.fn(), now: fixedClock() });

    const tooMany = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { mock: true, count: 289 },
    });
    expect(tooMany.statusCode).toBe(400);
    expect(tooMany.json().error).toBe("invalid_body");

    const tooFew = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { mock: true, count: 0 },
    });
    expect(tooFew.statusCode).toBe(400);
  });

  it("rejects a non-numeric count with 400", async () => {
    const { app, token } = await authedApp({ fetchImpl: vi.fn(), now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { mock: true, count: "twelve" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects a malformed url with 400 rather than attempting a request", async () => {
    const fetchImpl = vi.fn();
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "not-a-valid-url", token: SECRET_TOKEN },
    });

    expect(response.statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(response.body).not.toContain(SECRET_TOKEN);
  });
});

describe("POST /integrations/nightscout/glucose — SSRF guard (H1)", () => {
  it("blocks a non-https url", async () => {
    const fetchImpl = vi.fn();
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "http://example-nightscout.test" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_url");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks the cloud metadata IP (169.254.169.254)", async () => {
    const fetchImpl = vi.fn();
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://169.254.169.254/latest/meta-data/" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_url");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["loopback", "https://127.0.0.1/"],
    ["10.0.0.0/8", "https://10.1.2.3/"],
    ["172.16.0.0/12", "https://172.20.5.5/"],
    ["192.168.0.0/16", "https://192.168.1.10/"],
    ["localhost by name", "https://localhost/"],
    ["IPv6 loopback", "https://[::1]/"],
  ])("blocks a private/loopback target (%s)", async (_label, url) => {
    const fetchImpl = vi.fn();
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock() });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_url");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns an identical, generic error body regardless of which rule blocked the request", async () => {
    const { app, token } = await authedApp({ fetchImpl: vi.fn(), now: fixedClock() });

    const httpResponse = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "http://example-nightscout.test" },
    });
    const privateIpResponse = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://10.0.0.5/" },
    });

    expect(httpResponse.json()).toEqual(privateIpResponse.json());
  });

  it("blocks a hostname that DNS resolves to a private/metadata address (resolve-then-check)", async () => {
    const fetchImpl = vi.fn();
    const dnsLookupImpl = async () => [{ address: "169.254.169.254", family: 4 }];
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock(), dnsLookupImpl });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://sneaky-hostname.test/" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_url");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("allows a normal https host via injected fetch when DNS resolution fails (safe fallback)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([{ sgv: 100, date: FIXED_NOW - 2 * 60_000 }]));
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock(), dnsLookupImpl: NO_DNS });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://example-nightscout.test" },
    });

    expect(response.statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("allows a normal https host that DNS resolves to a public address", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([{ sgv: 100, date: FIXED_NOW - 2 * 60_000 }]));
    const dnsLookupImpl = async () => [{ address: "203.0.113.10", family: 4 }];
    const { app, token } = await authedApp({ fetchImpl, now: fixedClock(), dnsLookupImpl });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      headers: authHeader(token),
      payload: { url: "https://public-nightscout.test/" },
    });

    expect(response.statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
