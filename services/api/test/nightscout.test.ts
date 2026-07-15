// Tests for the read-only Nightscout glucose module (Slice 6). Everything
// here is deterministic and offline: `fetch` and the clock are injected via
// `buildApp({ nightscout: { fetchImpl, now } })`, never real network calls.

import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";

const FIXED_NOW = Date.UTC(2026, 6, 13, 12, 0, 0); // 2026-07-13T12:00:00.000Z
const SECRET_TOKEN = "super-secret-nightscout-token-do-not-leak";

function fixedClock(nowMs: number = FIXED_NOW): () => number {
  return () => nowMs;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("POST /integrations/nightscout/glucose — mock mode", () => {
  it("returns deterministic synthetic readings without touching the network", async () => {
    const fetchImpl = vi.fn();
    const app = buildApp({ nightscout: { fetchImpl, now: fixedClock() } });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
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
    const app = buildApp({ nightscout: { fetchImpl: vi.fn(), now: fixedClock() } });

    const first = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      payload: { mock: true, count: 4 },
    });
    const second = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      payload: { mock: true, count: 4 },
    });

    expect(first.json()).toEqual(second.json());
  });

  it("honours NIGHTSCOUT_MODE=mock even without an explicit mock flag", async () => {
    const originalMode = process.env["NIGHTSCOUT_MODE"];
    process.env["NIGHTSCOUT_MODE"] = "mock";
    try {
      const app = buildApp({ nightscout: { fetchImpl: vi.fn(), now: fixedClock() } });
      const response = await app.inject({
        method: "POST",
        url: "/integrations/nightscout/glucose",
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
    const app = buildApp({ nightscout: { fetchImpl, now: fixedClock() } });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
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
    const app = buildApp({ nightscout: { fetchImpl, now: fixedClock() } });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
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
    const app = buildApp({ nightscout: { fetchImpl: vi.fn(), now: fixedClock() } });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      payload: { token: SECRET_TOKEN },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain(SECRET_TOKEN);
  });

  it("returns 502 and never leaks the token when the upstream site is unreachable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error(`fetch failed for token=${SECRET_TOKEN}`);
    });
    const app = buildApp({ nightscout: { fetchImpl, now: fixedClock() } });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      payload: { url: "https://example-nightscout.test", token: SECRET_TOKEN },
    });

    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain(SECRET_TOKEN);
    expect(response.json().error).toBe("upstream_unreachable");
  });

  it("returns 502 when the upstream site responds with a non-2xx status", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: "not found" }, 404));
    const app = buildApp({ nightscout: { fetchImpl, now: fixedClock() } });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      payload: { url: "https://example-nightscout.test", token: SECRET_TOKEN },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe("upstream_error");
    expect(response.body).not.toContain(SECRET_TOKEN);
  });

  it("fails closed with 502 on a malformed upstream payload (not an array)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ not: "an array of sgv entries" }));
    const app = buildApp({ nightscout: { fetchImpl, now: fixedClock() } });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      payload: { url: "https://example-nightscout.test", token: SECRET_TOKEN },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe("upstream_malformed");
    expect(response.body).not.toContain(SECRET_TOKEN);
  });

  it("fails closed with 502 on entries with the wrong field types", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([{ sgv: "one-hundred-and-ten", date: FIXED_NOW - 60_000 }]),
    );
    const app = buildApp({ nightscout: { fetchImpl, now: fixedClock() } });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      payload: { url: "https://example-nightscout.test" },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe("upstream_malformed");
  });

  it("sets allStale true and newest null when every reading is older than the threshold", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        { sgv: 105, date: FIXED_NOW - 60 * 60_000 },
        { sgv: 108, date: FIXED_NOW - 45 * 60_000 },
      ]),
    );
    const app = buildApp({ nightscout: { fetchImpl, now: fixedClock() } });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
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
    const app = buildApp({ nightscout: { fetchImpl, now: fixedClock() } });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
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
    const app = buildApp({ nightscout: { fetchImpl, now: fixedClock() } });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
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
    const app = buildApp({ nightscout: { fetchImpl: vi.fn(), now: fixedClock() } });

    const tooMany = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      payload: { mock: true, count: 289 },
    });
    expect(tooMany.statusCode).toBe(400);
    expect(tooMany.json().error).toBe("invalid_body");

    const tooFew = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      payload: { mock: true, count: 0 },
    });
    expect(tooFew.statusCode).toBe(400);
  });

  it("rejects a non-numeric count with 400", async () => {
    const app = buildApp({ nightscout: { fetchImpl: vi.fn(), now: fixedClock() } });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      payload: { mock: true, count: "twelve" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects a malformed url with 400 rather than attempting a request", async () => {
    const fetchImpl = vi.fn();
    const app = buildApp({ nightscout: { fetchImpl, now: fixedClock() } });

    const response = await app.inject({
      method: "POST",
      url: "/integrations/nightscout/glucose",
      payload: { url: "not-a-valid-url", token: SECRET_TOKEN },
    });

    expect(response.statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(response.body).not.toContain(SECRET_TOKEN);
  });
});
