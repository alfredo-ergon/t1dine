// Thin HTTP client for the T1Dine API (services/api). Every response coming
// back over the network is untrusted external input (CLAUDE.md: "All
// external data is untrusted. Validate at boundaries."): catalog foods are
// individually re-validated with `isCanonicalFood` and invalid records are
// dropped rather than trusted, and the glucose payload is structurally
// checked field-by-field before it is handed to the UI.
//
// This module is an *enhancement*, never a requirement — every export
// resolves within a short timeout (AbortController) so a caller can always
// fall back to an offline-first default (e.g. the bundled local catalog)
// instead of hanging the UI on a slow/unreachable network.
//
// Glucose readings are health data. Nothing in this file ever calls
// `console.*`/logs a token, a URL, or a reading value — failures are surfaced
// only as a small typed `ApiError` with a generic, non-sensitive message.

import type { CanonicalFood } from "@t1dine/food-schema";
import { isCanonicalFood } from "@t1dine/food-schema";

/** Single place to point the app at a different API host. */
export const API_BASE_URL = "http://localhost:3001";

const DEFAULT_TIMEOUT_MS = 4000;

export type ApiErrorKind = "network" | "timeout" | "http" | "invalid_response";

/** Small, typed, never-log-sensitive-data error for every API call in this module. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;

  constructor(kind: ApiErrorKind, message: string) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Fetches JSON from the API with a short timeout. Never throws the raw
 * underlying error (which, for a fetch failure, can on some runtimes embed
 * the request URL) — always normalises to an `ApiError` with a generic
 * message instead.
 */
async function fetchJson(path: string, init: RequestInit = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new ApiError("http", `T1Dine API request failed (HTTP ${response.status}).`);
    }
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("timeout", "T1Dine API request timed out.");
    }
    throw new ApiError("network", "T1Dine API is unreachable.");
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/**
 * Fetches the online food catalog. Every returned record is re-validated
 * against the canonical contract; anything malformed is silently dropped
 * (never crashes, never trusted as-is) rather than surfaced as a partial
 * failure — callers treat the whole call as either "have an online catalog"
 * or "fall back to the offline bundled one".
 */
export async function fetchCatalog(query?: string): Promise<CanonicalFood[]> {
  const params = new URLSearchParams();
  if (query && query.trim().length > 0) {
    params.set("q", query.trim());
  }
  const suffix = params.toString();
  const json = await fetchJson(`/catalog/foods${suffix ? `?${suffix}` : ""}`);

  if (!isRecord(json) || !Array.isArray(json["foods"])) {
    throw new ApiError("invalid_response", "T1Dine API returned an unexpected catalog response shape.");
  }

  return json["foods"].filter(isCanonicalFood);
}

// ---------------------------------------------------------------------------
// Glucose (Slice 6 — read-only, non-clinical display only)
// ---------------------------------------------------------------------------

export interface GlucoseReading {
  sgv: number;
  mgdl: number;
  mmol: number;
  direction?: string;
  date: number;
  iso: string;
  ageMinutes: number;
  stale: boolean;
}

export interface GlucoseResult {
  source: "live" | "mock";
  readings: GlucoseReading[];
  newest: GlucoseReading | null;
  allStale: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isGlucoseReading(value: unknown): value is GlucoseReading {
  if (!isRecord(value)) return false;
  if (!isFiniteNumber(value["sgv"]) || !isFiniteNumber(value["mgdl"]) || !isFiniteNumber(value["mmol"])) return false;
  if (!isFiniteNumber(value["date"]) || !isFiniteNumber(value["ageMinutes"])) return false;
  if (typeof value["iso"] !== "string") return false;
  if (typeof value["stale"] !== "boolean") return false;
  if (value["direction"] !== undefined && typeof value["direction"] !== "string") return false;
  return true;
}

/**
 * Fetches recent glucose readings in mock mode only (`{ mock: true }`) —
 * this app never asks a user for a Nightscout URL/token; it only displays
 * the deterministic offline-safe demo feed the API exposes for Slice 6.
 * Read-only, display-only: never call this from anywhere that computes a
 * dose or insulin-related value.
 */
export async function fetchGlucose(opts?: { count?: number }): Promise<GlucoseResult> {
  const body: { mock: true; count?: number } = { mock: true };
  if (opts?.count !== undefined) {
    body.count = opts.count;
  }

  const json = await fetchJson("/integrations/nightscout/glucose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!isRecord(json)) {
    throw new ApiError("invalid_response", "T1Dine API returned an unexpected glucose response shape.");
  }

  const source = json["source"];
  if (source !== "live" && source !== "mock") {
    throw new ApiError("invalid_response", "T1Dine API glucose response was missing a valid source.");
  }

  const readingsRaw = Array.isArray(json["readings"]) ? json["readings"] : [];
  const readings = readingsRaw.filter(isGlucoseReading);
  const newest = isGlucoseReading(json["newest"]) ? json["newest"] : null;
  const allStale = typeof json["allStale"] === "boolean" ? json["allStale"] : newest === null;

  return { source, readings, newest, allStale };
}
