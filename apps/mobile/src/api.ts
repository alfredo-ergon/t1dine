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

import type { CanonicalFood, ContinentGroup, Region } from "@t1dine/food-schema";
import { isCanonicalFood } from "@t1dine/food-schema";

/** Single place to point the app at a different API host. */
export const API_BASE_URL = "http://localhost:3001";

const DEFAULT_TIMEOUT_MS = 4000;

export type ApiErrorKind = "network" | "timeout" | "http" | "invalid_response";

/**
 * Small, typed, never-log-sensitive-data error for every API call in this
 * module. `status` (an HTTP status code) and `code` (a fixed, non-sensitive
 * server error identifier such as `"invalid_credentials"` or `"email_taken"`)
 * are safe to carry — neither ever contains user-entered text (an email, a
 * password, a food name, a token) — so screens can branch on them to show a
 * precise, localised message without this module ever logging anything
 * sensitive itself.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;

  constructor(kind: ApiErrorKind, message: string, status?: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

/** True for a network/timeout failure — i.e. "we don't know", as opposed to
 * an authoritative error response from the API. Callers use this to decide
 * between an "offline" and an "error" presentation. */
export function isConnectivityError(error: unknown): boolean {
  return error instanceof ApiError && (error.kind === "network" || error.kind === "timeout");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

interface RawResponse {
  status: number;
  json: unknown;
}

/**
 * Fetches from the API with a short timeout, returning the raw status code
 * alongside a best-effort parsed JSON body (never throws on a non-JSON or
 * empty body — `json` is simply `null` in that case). Callers that need to
 * branch on the status (e.g. 401 vs 409 vs 200) use this directly; callers
 * that only ever want "succeeded or threw" use `fetchJson` below. Never
 * throws the raw underlying error (which, for a fetch failure, can on some
 * runtimes embed the request URL) — always normalises to an `ApiError` with
 * a generic message instead.
 */
async function rawFetch(path: string, init: RequestInit = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<RawResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal });
    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    return { status: response.status, json };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("timeout", "T1Dine API request timed out.");
    }
    throw new ApiError("network", "T1Dine API is unreachable.");
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches JSON from the API with a short timeout, throwing a typed
 * `ApiError` for any non-2xx response. This is the "just give me the data or
 * throw" shape used by every read-only GET in this module.
 */
async function fetchJson(path: string, init: RequestInit = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<unknown> {
  const { status, json } = await rawFetch(path, init, timeoutMs);
  if (status < 200 || status >= 300) {
    throw new ApiError("http", `T1Dine API request failed (HTTP ${status}).`, status);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export interface CatalogFetchFilter {
  /** Free-text query — matched server-side against localised names/synonyms. */
  query?: string;
  /** Area taxonomy region id (see `@t1dine/food-schema`'s `AREA_TAXONOMY`/`REGIONS`), e.g. `"southern-europe"`. */
  region?: string;
  /** Cuisine tag, e.g. `"portuguese"`. */
  cuisine?: string;
}

/**
 * Fetches the online food catalog, optionally scoped by a text query and/or
 * the area filters (region/cuisine — Slice: browse by area). Every returned
 * record is re-validated against the canonical contract; anything malformed
 * is silently dropped (never crashes, never trusted as-is) rather than
 * surfaced as a partial failure — callers treat the whole call as either
 * "have an online catalog" or "fall back to the offline bundled one".
 */
export async function fetchCatalog(filter: CatalogFetchFilter = {}): Promise<CanonicalFood[]> {
  const params = new URLSearchParams();
  if (filter.query && filter.query.trim().length > 0) {
    params.set("q", filter.query.trim());
  }
  if (filter.region && filter.region.trim().length > 0) {
    params.set("region", filter.region.trim());
  }
  if (filter.cuisine && filter.cuisine.trim().length > 0) {
    params.set("cuisine", filter.cuisine.trim());
  }
  const suffix = params.toString();
  const json = await fetchJson(`/catalog/foods${suffix ? `?${suffix}` : ""}`);

  if (!isRecord(json) || !Array.isArray(json["foods"])) {
    throw new ApiError("invalid_response", "T1Dine API returned an unexpected catalog response shape.");
  }

  return json["foods"].filter(isCanonicalFood);
}

// ---------------------------------------------------------------------------
// Browse-by-area taxonomy (Slice: browse by area)
// ---------------------------------------------------------------------------

function isRegion(value: unknown): value is Region {
  if (!isRecord(value)) return false;
  return (
    typeof value["id"] === "string" &&
    typeof value["name"] === "string" &&
    typeof value["continent"] === "string" &&
    typeof value["mediterranean"] === "boolean" &&
    isStringArray(value["countries"])
  );
}

function isContinentGroup(value: unknown): value is ContinentGroup {
  if (!isRecord(value)) return false;
  return typeof value["continent"] === "string" && Array.isArray(value["regions"]) && value["regions"].every(isRegion);
}

/**
 * Fetches the area taxonomy (continent → region → country) used to browse
 * foods by area. This is an *enhancement* over the bundled
 * `AREA_TAXONOMY` (from `@t1dine/food-schema`, safe to import at runtime) —
 * callers should default to the bundled constant and only swap this in once
 * it resolves, exactly like `fetchCatalog`'s online/offline pattern.
 */
export async function fetchRegions(): Promise<ContinentGroup[]> {
  const json = await fetchJson("/catalog/regions");
  if (!Array.isArray(json) || !json.every(isContinentGroup)) {
    throw new ApiError("invalid_response", "T1Dine API returned an unexpected regions response shape.");
  }
  return json;
}

// ---------------------------------------------------------------------------
// Accounts (Slice: accounts + multi-device sync)
// ---------------------------------------------------------------------------
//
// A bearer token is a high-impact credential (CLAUDE.md / privacy-security
// rules: "Treat Nightscout tokens as high-impact credentials" — the same
// standard applies here). This module never logs an email, a password, or a
// token; callers are responsible for storing the returned token only in
// AsyncStorage (see `../auth.ts`), never in telemetry.

export interface AuthTokenResult {
  token: string;
}

async function authRequest(path: string, email: string, password: string): Promise<AuthTokenResult> {
  const { status, json } = await rawFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if ((status === 200 || status === 201) && isRecord(json) && typeof json["token"] === "string" && json["token"].length > 0) {
    return { token: json["token"] };
  }

  const code = isRecord(json) && typeof json["error"] === "string" ? json["error"] : undefined;
  throw new ApiError("http", "T1Dine account request failed.", status, code);
}

/** `POST /auth/register` → `{ token }` (201). Throws `ApiError` with
 * `status: 409, code: "email_taken"` if the email is already registered, or
 * `status: 400` if the email/password fail validation (password must be at
 * least 8 characters). */
export async function register(email: string, password: string): Promise<AuthTokenResult> {
  return authRequest("/auth/register", email, password);
}

/** `POST /auth/login` → `{ token }` (200). Throws `ApiError` with
 * `status: 401, code: "invalid_credentials"` for any wrong email/password
 * combination — deliberately identical for "unknown email" and "wrong
 * password", matching the API's own contract. */
export async function login(email: string, password: string): Promise<AuthTokenResult> {
  return authRequest("/auth/login", email, password);
}

// ---------------------------------------------------------------------------
// Cloud sync (Slice: accounts + multi-device sync)
// ---------------------------------------------------------------------------
//
// PRIVACY: a sync state carries user-authored food data (favourites,
// custom foods) — health-adjacent per CLAUDE.md's privacy rules. This module
// never logs a `SyncState` value.

export interface SyncState {
  favourites: string[];
  customFoods: CanonicalFood[];
}

export interface SyncSnapshot {
  state: SyncState;
  version: number;
  updatedAt: string | null;
}

function parseSyncState(value: unknown): SyncState {
  if (!isRecord(value) || !isStringArray(value["favourites"]) || !Array.isArray(value["customFoods"])) {
    throw new ApiError("invalid_response", "T1Dine API returned an unexpected sync state shape.");
  }
  // Untrusted external data (CLAUDE.md): re-validate every custom food
  // against the canonical contract rather than trusting the server's shape.
  return { favourites: value["favourites"], customFoods: value["customFoods"].filter(isCanonicalFood) };
}

function parseSyncSnapshot(json: unknown): SyncSnapshot {
  if (!isRecord(json) || typeof json["version"] !== "number") {
    throw new ApiError("invalid_response", "T1Dine API returned an unexpected sync response shape.");
  }
  const updatedAt = typeof json["updatedAt"] === "string" ? json["updatedAt"] : null;
  return { state: parseSyncState(json["state"]), version: json["version"], updatedAt };
}

/** `GET /sync/state` (Bearer token) → the caller's current sync snapshot, or
 * the empty default (`version: 0`, `updatedAt: null`) if they have never
 * synced before. */
export async function getSyncState(token: string): Promise<SyncSnapshot> {
  const json = await fetchJson("/sync/state", { headers: { Authorization: `Bearer ${token}` } });
  return parseSyncSnapshot(json);
}

export type PutSyncStateResult =
  | { outcome: "ok"; version: number; updatedAt: string }
  /** The server rejected `baseVersion` as stale and did NOT write — `snapshot`
   * is the CURRENT, unchanged server state so the caller can re-merge and
   * retry (CLAUDE.md: "never merge conflicting food values by silently
   * averaging them" — a sync conflict must be surfaced and reconciled
   * explicitly, never overwritten blindly). */
  | { outcome: "conflict"; snapshot: SyncSnapshot };

/** `PUT /sync/state` (Bearer token) `{ state, baseVersion? }`. Returns the
 * new version on success, or `{ outcome: "conflict", snapshot }` on a 409
 * (stale `baseVersion`) — never throws for a conflict, since that is an
 * expected, recoverable outcome rather than a failure. */
export async function putSyncState(token: string, state: SyncState, baseVersion?: number): Promise<PutSyncStateResult> {
  const body: { state: SyncState; baseVersion?: number } = { state };
  if (baseVersion !== undefined) {
    body.baseVersion = baseVersion;
  }

  const { status, json } = await rawFetch("/sync/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (status === 200) {
    if (!isRecord(json) || typeof json["version"] !== "number" || typeof json["updatedAt"] !== "string") {
      throw new ApiError("invalid_response", "T1Dine API returned an unexpected sync response shape.");
    }
    return { outcome: "ok", version: json["version"], updatedAt: json["updatedAt"] };
  }

  if (status === 409) {
    return { outcome: "conflict", snapshot: parseSyncSnapshot(json) };
  }

  const code = isRecord(json) && typeof json["error"] === "string" ? json["error"] : undefined;
  throw new ApiError("http", `T1Dine sync request failed (HTTP ${status}).`, status, code);
}

// ---------------------------------------------------------------------------
// Submit a food to the shared database (Slice: submit-a-food)
// ---------------------------------------------------------------------------
//
// A submission is ALWAYS a candidate — this is the client-side mirror of the
// API's own guarantee (`insertSubmission` always sets `status: "candidate"`
// server-side regardless of the submitted body). Never present a submission
// as immediately available to everyone (CLAUDE.md: "Never present
// unreleased functionality as ... a clinically validated recommendation" —
// the food-data equivalent is "never present a candidate as approved").

export interface SubmissionResult {
  id: string;
  status: "candidate";
}

/** `POST /catalog/submissions` (optional Bearer token) with a `CanonicalFood`
 * body → `{ id, status: "candidate" }` (201). Submitting while logged in
 * attributes the submission to the account; submitting without a token
 * submits anonymously — both are accepted by the API. */
export async function submitFoodToCatalog(food: CanonicalFood, token?: string): Promise<SubmissionResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const { status, json } = await rawFetch("/catalog/submissions", { method: "POST", headers, body: JSON.stringify(food) });

  if (status === 201 && isRecord(json) && typeof json["id"] === "string") {
    return { id: json["id"], status: "candidate" };
  }

  const code = isRecord(json) && typeof json["error"] === "string" ? json["error"] : undefined;
  throw new ApiError("http", "T1Dine submission request failed.", status, code);
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
