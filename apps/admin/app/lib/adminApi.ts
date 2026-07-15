"use client";

// Browser-side client for the T1Dine API from the curation portal.
//
// Read-only public pages fetch server-side via `../../lib/api.ts`. The *admin*
// surfaces here (review queue, manual add, AI generate) run in the browser
// because they need the curator's bearer token, so this module owns every
// authenticated call. Everything crossing this boundary is untrusted (CLAUDE.md:
// "All external data is untrusted. Validate at boundaries."): responses are
// shape-checked defensively and each `CanonicalFood` is re-validated with
// `collectCanonicalFoodErrors` in the views before anything is trusted.

import type { CanonicalFood } from "@t1dine/food-schema";
import type { ContinentGroup } from "@t1dine/food-schema";
import { AREA_TAXONOMY } from "@t1dine/food-schema";
import type { FoodStatus } from "@t1dine/food-schema";

/** Mirrors the server default in `../../lib/api.ts`. Client code can only read
 * `NEXT_PUBLIC_*` env vars (Next inlines them at build time); a non-public
 * `API_BASE_URL` would be `undefined` in the browser, so the public variant is
 * used with the same localhost fallback. */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

/** Where a stored food came from (see `FOOD_SOURCES` in the API). */
export type FoodSource = "seed" | "user" | "ai" | "admin";

/** A row from `GET /admin/foods` — one `CanonicalFood` plus its review
 * lifecycle. Mirrors the API's `StoredFood`. `submittedBy`/`reviewedBy` are
 * opaque user ids, never emails. */
export interface AdminSubmission {
  id: string;
  food: CanonicalFood;
  status: FoodStatus;
  source: FoodSource;
  submittedBy: string | null;
  reviewedBy: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
}

/** A failed API call, carrying the HTTP status so callers can distinguish
 * "not signed in / expired" (401), "not an admin" (403) and everything else. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Turns any non-2xx response into a friendly, Portuguese `ApiError`. */
async function toApiError(response: Response): Promise<ApiError> {
  let serverMessage = "";
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
      serverMessage = body.message;
    }
  } catch {
    // Body was not JSON — fall through to a status-based message.
  }

  switch (response.status) {
    case 401:
      return new ApiError(401, "Sessão inválida ou expirada. Inicie sessão novamente.");
    case 403:
      return new ApiError(403, "A sua conta não tem permissões de curadoria.");
    case 409:
      return new ApiError(409, serverMessage || "Já existe um alimento com este identificador.");
    default:
      return new ApiError(response.status, serverMessage || `Erro do servidor (${response.status}).`);
  }
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/** Narrows an unknown value to a plain object without asserting field types. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extracts the `foods` array from a `{ count, foods }` envelope (the shape the
 * API actually returns) while also tolerating a bare array, so a small contract
 * drift never crashes a page. Returns `[]` for anything unexpected.
 */
function extractFoodsEnvelope(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.foods)) return payload.foods;
  return [];
}

/** Coerces one untrusted `GET /admin/foods` row into an `AdminSubmission`,
 * defaulting anything missing so a malformed row still renders (its embedded
 * `food` is validated for display by the view, not here). */
function coerceSubmission(raw: unknown): AdminSubmission {
  const row = isRecord(raw) ? raw : {};
  const food = (isRecord(row.food) ? row.food : {}) as unknown as CanonicalFood;
  const status = row.status === "approved" || row.status === "retired" ? row.status : "candidate";
  const source =
    row.source === "seed" || row.source === "user" || row.source === "ai" || row.source === "admin"
      ? row.source
      : "user";
  return {
    id: typeof row.id === "string" ? row.id : (typeof food.id === "string" ? food.id : ""),
    food,
    status,
    source,
    submittedBy: typeof row.submittedBy === "string" ? row.submittedBy : null,
    reviewedBy: typeof row.reviewedBy === "string" ? row.reviewedBy : null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    reviewedAt: typeof row.reviewedAt === "string" ? row.reviewedAt : null,
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** `POST /auth/login` — returns the bearer token on success. */
export async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new ApiError(401, "Credenciais inválidas.");
    }
    throw await toApiError(response);
  }
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.token !== "string" || body.token.length === 0) {
    throw new ApiError(response.status, "Resposta de autenticação inesperada.");
  }
  return body.token;
}

// ---------------------------------------------------------------------------
// Admin review queue
// ---------------------------------------------------------------------------

export interface AdminFoodsFilter {
  status?: FoodStatus;
  source?: FoodSource;
  region?: string;
}

/** `GET /admin/foods?status=&source=&region=` — the review-queue read path. */
export async function listAdminFoods(token: string, filter: AdminFoodsFilter = {}): Promise<AdminSubmission[]> {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.source) params.set("source", filter.source);
  if (filter.region) params.set("region", filter.region);
  const query = params.toString();

  const response = await fetch(`${API_BASE_URL}/admin/foods${query ? `?${query}` : ""}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw await toApiError(response);

  const payload: unknown = await response.json();
  return extractFoodsEnvelope(payload).map(coerceSubmission);
}

/** `POST /admin/foods/:id/approve`. */
export async function approveFood(token: string, id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/foods/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!response.ok) throw await toApiError(response);
}

/** `POST /admin/foods/:id/reject` (soft-rejects to `retired`). */
export async function rejectFood(token: string, id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/foods/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!response.ok) throw await toApiError(response);
}

// ---------------------------------------------------------------------------
// Manual add + AI generate
// ---------------------------------------------------------------------------

/** `POST /admin/foods` — a fully-formed `CanonicalFood`; the API stores it as
 * `approved`/`admin`. Returns the created submission. */
export async function addFood(token: string, food: CanonicalFood): Promise<AdminSubmission> {
  const response = await fetch(`${API_BASE_URL}/admin/foods`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(food),
  });
  if (!response.ok) throw await toApiError(response);
  return coerceSubmission(await response.json());
}

export interface AiGenerateParams {
  region?: string;
  cuisine?: string;
  country?: string;
  count: number;
}

/** `POST /admin/foods/ai-generate` — creates `count` AI **candidates**. They
 * are stored as `status: "candidate"`/`source: "ai"` server-side and are NEVER
 * auto-published; a curator must approve each one in the review queue. */
export async function aiGenerate(token: string, params: AiGenerateParams): Promise<AdminSubmission[]> {
  const body: AiGenerateParams = { count: params.count };
  if (params.region) body.region = params.region;
  if (params.cuisine) body.cuisine = params.cuisine;
  if (params.country) body.country = params.country;

  const response = await fetch(`${API_BASE_URL}/admin/foods/ai-generate`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await toApiError(response);

  const payload: unknown = await response.json();
  return extractFoodsEnvelope(payload).map(coerceSubmission);
}

// ---------------------------------------------------------------------------
// Public catalog reads (no auth) used by the browse-by-area page
// ---------------------------------------------------------------------------

/** `GET /catalog/regions` → the area taxonomy. Falls back to the bundled
 * `AREA_TAXONOMY` constant if the endpoint is unavailable, so the browse-by-area
 * page always has a taxonomy to render. */
export async function fetchRegions(): Promise<ContinentGroup[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/catalog/regions`, { cache: "no-store" });
    if (!response.ok) return AREA_TAXONOMY;
    const payload: unknown = await response.json();
    if (Array.isArray(payload) && payload.length > 0) return payload as ContinentGroup[];
    return AREA_TAXONOMY;
  } catch {
    return AREA_TAXONOMY;
  }
}

/** `GET /catalog/foods?region=&cuisine=&country=&q=` → approved foods only. */
export async function fetchCatalogFoods(
  filter: { region?: string; cuisine?: string; country?: string; q?: string } = {},
): Promise<CanonicalFood[]> {
  const params = new URLSearchParams();
  if (filter.region) params.set("region", filter.region);
  if (filter.cuisine) params.set("cuisine", filter.cuisine);
  if (filter.country) params.set("country", filter.country);
  if (filter.q) params.set("q", filter.q);
  const query = params.toString();

  const response = await fetch(`${API_BASE_URL}/catalog/foods${query ? `?${query}` : ""}`, { cache: "no-store" });
  if (!response.ok) throw await toApiError(response);

  const payload: unknown = await response.json();
  return extractFoodsEnvelope(payload) as CanonicalFood[];
}
