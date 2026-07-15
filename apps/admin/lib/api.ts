// Live-data access for the curation portal.
//
// Server components call `getCatalog()` to read the food catalog from the live
// T1Dine API. Everything crossing this boundary is untrusted (per CLAUDE.md:
// "All external data is untrusted. Validate at boundaries."): the HTTP response
// shape is checked defensively and every food is re-validated + enriched with
// `enrichCanonicalFood` — the exact same per-record data-quality/confidence
// enrichment used for the synthetic catalog. If the API is unreachable or
// answers with anything unexpected, we fall back to the bundled synthetic
// catalog so a page never crashes because the API is down.

import type { CanonicalFood } from "@t1dine/food-schema";
import { CATALOG, enrichCanonicalFood, SOURCES, type CatalogFood } from "./catalog";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";

/** Which data path served the catalog for this render. */
export type DataSource = "api" | "local";

export interface CatalogResult {
  /** Enriched, curation-ready foods. */
  foods: CatalogFood[];
  /** "api" when the live API answered; "local" when the synthetic fallback was used. */
  source: DataSource;
}

/** A source-register row derived from the fetched foods' provenance. */
export interface DerivedSource {
  sourceId: string;
  /** Friendly name when the id is a known register entry, otherwise the id itself. */
  name: string;
  market: string;
  licence: string;
  /** Refresh cadence when known, otherwise "—" (provenance carries no cadence). */
  cadence: string;
  /** Number of fetched foods attributed to this source. */
  foodCount: number;
}

/**
 * Read the catalog from the live API, validating and enriching each record.
 * Never throws: any failure (unreachable, non-2xx, malformed body) degrades to
 * the synthetic fallback with `source: "local"`.
 */
export async function getCatalog(): Promise<CatalogResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/catalog/foods`, { cache: "no-store" });
    if (!response.ok) return localCatalog();

    const payload: unknown = await response.json();
    const rawFoods = extractFoods(payload);
    if (rawFoods === null) return localCatalog();

    return {
      foods: rawFoods.map((food) => enrichCanonicalFood(food)),
      source: "api",
    };
  } catch {
    // Network error, DNS failure, invalid JSON, etc. — fall back, never crash.
    return localCatalog();
  }
}

function localCatalog(): CatalogResult {
  return { foods: CATALOG, source: "local" };
}

/**
 * Pull the `foods` array out of an untrusted `GET /catalog/foods` body. Returns
 * `null` (→ fallback) when the envelope is not the expected `{ foods: [...] }`
 * shape. Individual records are *not* trusted here — they are validated later by
 * `enrichCanonicalFood`, which keeps invalid records visible with their errors.
 */
function extractFoods(payload: unknown): CanonicalFood[] | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { foods } = payload as { foods?: unknown };
  if (!Array.isArray(foods)) return null;
  return foods as CanonicalFood[];
}

/**
 * Build the "Fontes" register from the fetched foods' provenance, since there is
 * no dedicated sources endpoint. Sources are keyed by `sourceId` and carry the
 * market + licence taken from provenance plus a food count. When an id matches a
 * known register entry, its friendly name and cadence are surfaced; otherwise
 * those fall back to the id and "—".
 */
export function deriveSources(foods: CatalogFood[]): DerivedSource[] {
  const byId = new Map<string, DerivedSource>();

  for (const item of foods) {
    const { source } = item;
    const existing = byId.get(source.sourceId);
    if (existing) {
      existing.foodCount += 1;
      continue;
    }
    const meta = SOURCES.find((entry) => entry.id === source.sourceId) ?? null;
    byId.set(source.sourceId, {
      sourceId: source.sourceId,
      name: meta?.name ?? source.sourceId,
      market: source.market ?? meta?.market ?? "—",
      licence: source.licence,
      cadence: meta?.cadence ?? "—",
      foodCount: 1,
    });
  }

  return [...byId.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}
