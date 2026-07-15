// Read-only Nightscout glucose display integration (Slice 6).
//
// SAFETY CONTRACT — read this before touching anything in this file:
//   1. READ-ONLY. This module only ever issues `GET` requests to Nightscout's
//      `entries/sgv.json` endpoint. It must never write, POST, PUT, DELETE, or
//      otherwise mutate anything on a Nightscout site.
//   2. The Nightscout token is a HIGH-IMPACT credential (CLAUDE.md). It is
//      used only to build the outgoing request URL and is NEVER logged,
//      NEVER echoed back in a response body, and NEVER included in an error
//      message. `Fastify({ logger: false })` is set app-wide in `app.ts`; this
//      module additionally never calls `console.*` with the token or any URL
//      that embeds it.
//   3. Every Nightscout response is UNTRUSTED external input. It is validated
//      with zod before any of it is used. On anything malformed, missing, or
//      unreachable, the handler fails closed (an explicit error or an
//      `allStale: true` state) — it never fabricates or guesses readings.
//   4. This module has ZERO connection to dose calculation. It must not
//      import `@t1dine/dose-engine`, `@t1dine/nutrition`, or compute anything
//      dose-related. It only fetches and displays glucose. `pnpm boundaries`
//      enforces the import-graph side of this rule.
//   5. Glucose readings are health data. They must never be written to
//      server logs — this handler never calls `console.*`/`app.log.*` with
//      reading values, and relies on the app-wide logger being disabled.

import type { FastifyInstance } from "fastify";
import { z } from "zod";

const MS_PER_MINUTE = 60_000;
const DEFAULT_COUNT = 12;
const MIN_COUNT = 1;
const MAX_COUNT = 288;
const DEFAULT_STALE_AFTER_MINUTES = 15;
const MIN_STALE_AFTER_MINUTES = 1;
const MAX_STALE_AFTER_MINUTES = 1440;

/** mg/dL -> mmol/L using the standard glucose molar-mass conversion factor. */
const MGDL_PER_MMOL = 18.0182;

// ---------------------------------------------------------------------------
// Request contract
// ---------------------------------------------------------------------------

const glucoseRequestSchema = z.object({
  url: z.string().trim().min(1, "url must be a non-empty string when provided").url("url must be a valid URL").optional(),
  token: z.string().trim().min(1, "token must be a non-empty string when provided").optional(),
  count: z
    .number({ invalid_type_error: "count must be a number" })
    .int("count must be an integer")
    .min(MIN_COUNT, `count must be at least ${MIN_COUNT}`)
    .max(MAX_COUNT, `count must be at most ${MAX_COUNT}`)
    .optional(),
  mock: z.boolean().optional(),
  // Not part of the original endpoint sketch, but the freshness threshold
  // must be configurable (see safety rule 2 in the module header), and a
  // request-scoped override keeps that configurability testable without
  // reaching for process env or global mutable state.
  staleAfterMinutes: z
    .number({ invalid_type_error: "staleAfterMinutes must be a number" })
    .finite("staleAfterMinutes must be a finite number")
    .min(MIN_STALE_AFTER_MINUTES, `staleAfterMinutes must be at least ${MIN_STALE_AFTER_MINUTES}`)
    .max(MAX_STALE_AFTER_MINUTES, `staleAfterMinutes must be at most ${MAX_STALE_AFTER_MINUTES}`)
    .optional(),
});

export type GlucoseRequestBody = z.infer<typeof glucoseRequestSchema>;

// ---------------------------------------------------------------------------
// Untrusted upstream payload contract
// ---------------------------------------------------------------------------

/**
 * Shape of one Nightscout `entries/sgv.json` record that we actually rely on.
 * Nightscout sends many more fields (`_id`, `device`, `utcOffset`, `trend`,
 * `filtered`, `unfiltered`, `noise`, `rssi`, ...); zod's default "strip"
 * behaviour on `z.object` silently drops anything we do not declare, so none
 * of that extra upstream data can leak into our normalised output.
 */
const nightscoutRawEntrySchema = z.object({
  sgv: z.number().finite().positive(),
  date: z.number().finite().positive(),
  direction: z.string().trim().min(1).optional(),
});

const nightscoutRawEntryArraySchema = z.array(nightscoutRawEntrySchema);

export type NightscoutRawEntry = z.infer<typeof nightscoutRawEntrySchema>;

// ---------------------------------------------------------------------------
// Normalised, display-only reading
// ---------------------------------------------------------------------------

export interface NormalisedGlucoseReading {
  /** Raw sensor-glucose value as reported by Nightscout, in mg/dL. */
  sgv: number;
  direction?: string;
  /** mmol/L, derived from `sgv`, rounded to 1 decimal place. */
  mmol: number;
  /** mg/dL, identical to `sgv`; kept as an explicit, unit-labelled field. */
  mgdl: number;
  /** Epoch milliseconds of the reading. */
  date: number;
  /** ISO-8601 rendering of `date`. */
  iso: string;
  /** Minutes between the reading and the clock used to serve the request. */
  ageMinutes: number;
  /** True when the reading is older than the freshness threshold (or has an
   * impossible future timestamp — never trusted as "fresh"). */
  stale: boolean;
}

export interface GlucoseResponsePayload {
  source: "live" | "mock";
  /** Every normalised reading returned upstream (or by the mock generator),
   * each individually flagged `stale`. Kept for context/history display —
   * never treat an entry here as "current" without checking its own `stale`
   * flag; prefer `newest` for that. */
  readings: NormalisedGlucoseReading[];
  /** The most recent NOT-stale reading, or `null` when none exists (empty
   * list, or every reading is stale). Fail-closed by construction: this
   * field is never a stale reading, so it can be shown as "current glucose"
   * without an extra staleness check by the caller. */
  newest: NormalisedGlucoseReading | null;
  /** True when there is no fresh reading to show (`newest` is `null`) —
   * covers both an empty upstream list and an all-stale upstream list. */
  allStale: boolean;
}

function toMmol(mgdl: number): number {
  return Math.round((mgdl / MGDL_PER_MMOL) * 10) / 10;
}

function toNormalisedReading(
  entry: NightscoutRawEntry,
  nowMs: number,
  staleAfterMinutes: number,
): NormalisedGlucoseReading {
  const ageMinutes = Math.round((nowMs - entry.date) / MS_PER_MINUTE);
  // Fail closed on clock-skew/malformed future timestamps too: a reading
  // that claims to be from the future is never trustworthy as "current".
  const stale = ageMinutes > staleAfterMinutes || ageMinutes < 0;

  return {
    sgv: entry.sgv,
    mgdl: entry.sgv,
    mmol: toMmol(entry.sgv),
    ...(entry.direction !== undefined ? { direction: entry.direction } : {}),
    date: entry.date,
    iso: new Date(entry.date).toISOString(),
    ageMinutes,
    stale,
  };
}

function normaliseEntries(
  entries: NightscoutRawEntry[],
  nowMs: number,
  staleAfterMinutes: number,
): NormalisedGlucoseReading[] {
  return entries.map((entry) => toNormalisedReading(entry, nowMs, staleAfterMinutes));
}

/**
 * Picks the most recent NOT-stale reading only. Deliberately ignores stale
 * entries even if they are chronologically newer than every fresh entry
 * (this can happen with a corrupted/future upstream timestamp) — fail
 * closed means we never let a reading we don't trust as current become
 * "newest".
 */
function pickNewestFresh(readings: NormalisedGlucoseReading[]): NormalisedGlucoseReading | null {
  let newest: NormalisedGlucoseReading | null = null;
  for (const reading of readings) {
    if (reading.stale) continue;
    if (!newest || reading.date > newest.date) {
      newest = reading;
    }
  }
  return newest;
}

function buildResponsePayload(source: "live" | "mock", readings: NormalisedGlucoseReading[]): GlucoseResponsePayload {
  const newest = pickNewestFresh(readings);
  return {
    source,
    readings,
    newest,
    allStale: newest === null,
  };
}

// ---------------------------------------------------------------------------
// Mock mode — fully offline, deterministic synthetic readings
// ---------------------------------------------------------------------------

const MOCK_INTERVAL_MINUTES = 5;
/** The freshest mock reading lags "now" slightly, like a real CGM upload delay. */
const MOCK_LATEST_LAG_MINUTES = 3;
const MOCK_DIRECTIONS = ["Flat", "FortyFiveUp", "SingleUp", "Flat", "FortyFiveDown", "SingleDown"] as const;

/**
 * Deterministic, offline stand-in for a Nightscout `entries/sgv.json`
 * response. Values are derived from the reading index via a fixed periodic
 * function (never `Math.random`, never a fresh `Date.now()` read) so tests
 * and local development are fully reproducible given the same `count` and
 * injected clock.
 */
function buildMockEntries(count: number, nowMs: number): NightscoutRawEntry[] {
  const entries: NightscoutRawEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    const minutesAgo = MOCK_LATEST_LAG_MINUTES + index * MOCK_INTERVAL_MINUTES;
    const date = nowMs - minutesAgo * MS_PER_MINUTE;
    const sgv = Math.round(120 + 35 * Math.sin(index / 2.5));
    const direction = MOCK_DIRECTIONS[index % MOCK_DIRECTIONS.length] ?? "Flat";
    entries.push({ sgv, date, direction });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Live mode — fetch + validate an untrusted upstream Nightscout site
// ---------------------------------------------------------------------------

/**
 * Builds the outgoing Nightscout request URL. The token is sent as Nightscout's
 * documented `token` query parameter (its role-scoped, read-only access-token
 * mechanism) — never as a header value that might be captured in unrelated
 * diagnostics. Callers of this function must never log its return value.
 */
function buildEntriesUrl(baseUrl: string, count: number, token: string | undefined): string {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const requestUrl = new URL(`${trimmedBase}/api/v1/entries/sgv.json`);
  requestUrl.searchParams.set("count", String(count));
  if (token) {
    requestUrl.searchParams.set("token", token);
  }
  return requestUrl.toString();
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export interface NightscoutDeps {
  /** Injectable so tests never hit the network. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injectable clock so freshness/staleness is deterministic in tests. */
  now?: () => number;
}

/**
 * Builds the Nightscout route plugin. Returns a plain Fastify plugin function
 * (rather than taking dependencies as Fastify-registered options) so the
 * injected `fetchImpl`/`now` are captured in a closure with full type safety,
 * with no need for an `unknown`-typed Fastify options bag.
 */
export function nightscoutRoutes(deps: NightscoutDeps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => Date.now());

  return async function registerNightscoutRoutes(app: FastifyInstance): Promise<void> {
    app.post("/integrations/nightscout/glucose", async (request, reply) => {
      const parsedBody = glucoseRequestSchema.safeParse(request.body ?? {});
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "invalid_body",
          message: "Nightscout request body failed validation.",
          issues: parsedBody.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`),
        });
      }

      const { url, count, mock, staleAfterMinutes } = parsedBody.data;
      const effectiveCount = count ?? DEFAULT_COUNT;
      const effectiveStaleAfterMinutes = staleAfterMinutes ?? DEFAULT_STALE_AFTER_MINUTES;
      const useMock = mock === true || process.env["NIGHTSCOUT_MODE"] === "mock";
      // Read the injected clock exactly once per request so entry generation
      // and freshness computation agree on "now".
      const nowMs = now();

      if (useMock) {
        const rawEntries = buildMockEntries(effectiveCount, nowMs);
        const readings = normaliseEntries(rawEntries, nowMs, effectiveStaleAfterMinutes);
        return reply.send(buildResponsePayload("mock", readings));
      }

      if (!url) {
        return reply.status(400).send({
          error: "invalid_body",
          message: "A Nightscout base url is required outside mock mode.",
          issues: ["url: required when mock is not enabled and NIGHTSCOUT_MODE is not \"mock\""],
        });
      }

      let rawJson: unknown;
      try {
        // `requestUrl` embeds the token when one was supplied. It is used
        // only as the `fetchImpl` target and is never logged or returned.
        const requestUrl = buildEntriesUrl(url, effectiveCount, parsedBody.data.token);
        const response = await fetchImpl(requestUrl, { method: "GET" });

        if (!response.ok) {
          // Deliberately generic: never echoes the request URL (which may
          // carry the token) or any response body back to the caller.
          return reply.status(502).send({
            error: "upstream_error",
            message: `Nightscout responded with HTTP status ${response.status}.`,
          });
        }

        rawJson = await response.json();
      } catch {
        // Never log or surface `error` here: on some runtimes a fetch failure
        // includes the request URL (and therefore the token) in its message.
        return reply.status(502).send({
          error: "upstream_unreachable",
          message: "Failed to reach the Nightscout site.",
        });
      }

      const parsedEntries = nightscoutRawEntryArraySchema.safeParse(rawJson);
      if (!parsedEntries.success) {
        // Fail closed: never fabricate readings from a payload we cannot
        // trust the shape of.
        return reply.status(502).send({
          error: "upstream_malformed",
          message: "Nightscout returned glucose data in an unexpected format.",
        });
      }

      const readings = normaliseEntries(parsedEntries.data, nowMs, effectiveStaleAfterMinutes);
      return reply.send(buildResponsePayload("live", readings));
    });
  };
}
