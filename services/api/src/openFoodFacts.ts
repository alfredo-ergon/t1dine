// Open Food Facts (OFF) barcode-lookup adapter — fetches ONE packaged
// product by barcode from the public OFF API and maps it to a low-confidence,
// user-confirmable CanonicalFood CANDIDATE.
//
// GOVERNANCE CONTRACT — read this before touching anything in this file
// (CLAUDE.md / .claude/rules/food-data.md):
//   1. OFF data is UNTRUSTED external input (CLAUDE.md: "All external data is
//      untrusted. Validate at boundaries.") and ODbL-licensed. Every response
//      is validated with zod before any of it is used; anything that does not
//      even match the expected shape fails closed (an "error" result) rather
//      than being guessed at.
//   2. This module NEVER produces anything other than `status: "candidate"`.
//      There is no code path here that can emit `"approved"` — see
//      `mapOffProduct` below. The caller (the `/catalog/off-lookup` route)
//      must not "upgrade" this result either; a user must explicitly confirm
//      an OFF candidate before it can ever be approved (via the normal
//      candidate-review workflow), mirroring the AI-candidate contract in
//      `./anthropicFoodAi.ts`/`./foodAi.ts`.
//   3. FAIL CLOSED: a product that OFF reports as not found, an unreachable
//      OFF site, a non-2xx response, a non-JSON body, a malformed top-level
//      shape, or a product with a missing/non-numeric available-carbohydrate
//      value are all treated as "not usable" — this module never fabricates
//      or guesses a nutrient value to paper over missing/bad upstream data.
//   4. ATTRIBUTION: OFF's ODbL 1.0 licence requires visible attribution
//      wherever its data is shown. Every candidate this module produces
//      carries `source.licence = "odbl-attribution"` and
//      `source.attribution` set to the required attribution string, and the
//      route additionally returns it as a top-level `attribution` field (see
//      `docs/data/openfoodfacts_attribution.md`).
//   5. PRIVACY: this module never `console.log`s (or otherwise persists) the
//      full raw OFF payload — the immutable "snapshot" recorded on the
//      candidate's `SourceReference` is a stable digest of the barcode only
//      (mirrors `aiSnapshotHash` in `./anthropicFoodAi.ts` and
//      `syntheticSnapshotHash` in `./catalog.ts`), never a hash/copy of the
//      actual response body.

import { createHash } from "node:crypto";
import { z } from "zod";
import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import type { CanonicalFood } from "@t1dine/food-schema";
import { collectCanonicalFoodErrors } from "@t1dine/food-schema";

/** EAN-8 through GTIN-14 — the range of barcode lengths OFF products use. */
export const OFF_BARCODE_PATTERN = /^\d{8,14}$/;

const OFF_FIELDS = "code,product_name,product_name_pt,nutriments,brands,countries_tags";

const OFF_ATTRIBUTION = "Data © Open Food Facts contributors, ODbL 1.0";

// ---------------------------------------------------------------------------
// Untrusted upstream payload contract. `z.object(...).passthrough()` keeps
// every OFF field we did not explicitly request (or explicitly use) out of
// the parsed *type* without rejecting the whole response over it — mirrors
// the "declare only what we rely on" convention used for Nightscout entries
// in `./modules/nightscout.ts`.
// ---------------------------------------------------------------------------

const offProductSchema = z
  .object({
    product_name: z.string().optional(),
    product_name_pt: z.string().optional(),
    nutriments: z.record(z.unknown()).optional(),
  })
  .passthrough();

const offApiResponseSchema = z
  .object({
    // OFF's documented "product found" flag: 1 when found, 0 when not.
    status: z.number().optional(),
    product: offProductSchema.optional(),
  })
  .passthrough();

export type OffProduct = z.infer<typeof offProductSchema>;

// ---------------------------------------------------------------------------
// Result contract
// ---------------------------------------------------------------------------

export type OffLookupResult =
  | { status: "found"; food: CanonicalFood; attribution: string }
  | { status: "not_found" }
  | { status: "error" };

export interface OpenFoodFactsDeps {
  /** Injectable so tests never hit the network. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

// ---------------------------------------------------------------------------
// Pure helpers — no I/O, unit-testable without a fetch/network seam at all.
// ---------------------------------------------------------------------------

function extractFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** `primary` wins; falls back to `fallback`, then to a clearly-labelled
 * placeholder — never fabricates a plausible-looking name for a product OFF
 * did not actually supply a name for. */
function resolveName(primary: string | undefined, fallback: string | undefined, placeholder: string): string {
  const trimmedPrimary = primary?.trim();
  if (trimmedPrimary) return trimmedPrimary;
  const trimmedFallback = fallback?.trim();
  if (trimmedFallback) return trimmedFallback;
  return placeholder;
}

/** Deterministic, non-cryptographic-use stand-in for a raw-snapshot digest —
 * mirrors `aiSnapshotHash` in `./anthropicFoodAi.ts`. Deliberately a digest of
 * the barcode, NOT of the actual OFF response body (see privacy note #5
 * above) — this module never persists or hashes the raw payload. */
function offSnapshotHash(barcode: string): string {
  return createHash("sha256").update(`t1dine-off-candidate:${barcode}`).digest("hex");
}

function buildSource(barcode: string): SourceReference {
  return {
    sourceId: "OFF",
    sourceRecordId: `OFF-${barcode}`,
    sourceVersion: "off-v2",
    // Deliberately no `market`: OFF's product database is global/barcode-keyed,
    // not country-scoped, and `SourceReference.market` — when present — must
    // be a non-empty ISO country code (see
    // `collectSourceReferenceErrors` in `@t1dine/domain`); fabricating one
    // (or setting an empty string) would either be a guess or fail that
    // validator, so it is omitted entirely rather than set to `""`.
    licence: "odbl-attribution",
    attribution: OFF_ATTRIBUTION,
    retrievedAt: new Date().toISOString(),
    rawSnapshotSha256: offSnapshotHash(barcode),
    mappingVersion: "off-map-0.1",
  };
}

function buildNutrients(barcode: string, product: OffProduct): NutrientObservation[] | null {
  const nutriments = product.nutriments ?? {};
  const carbGrams = extractFiniteNumber(nutriments["carbohydrates_100g"]);
  // Available carbohydrate is the one value T1Dine cannot do without — a
  // product missing it (or reporting a non-numeric value) is NOT usable,
  // regardless of what else OFF returned. Never coerced to 0/guessed.
  if (carbGrams === undefined) return null;

  const source = buildSource(barcode);
  const nutrients: NutrientObservation[] = [
    {
      nutrientCode: "CHOAVL",
      value: carbGrams,
      unit: "g",
      basisQuantity: 100,
      basisUnit: "g",
      method: "declared",
      confidence: "unverified",
      source,
    },
  ];

  const energyKcal = extractFiniteNumber(nutriments["energy-kcal_100g"]);
  // Energy is included when OFF reports it, but its absence alone does not
  // make the product unusable (unlike carbohydrate) — never fabricated.
  if (energyKcal !== undefined) {
    nutrients.push({
      nutrientCode: "ENERC",
      value: energyKcal,
      unit: "kcal",
      basisQuantity: 100,
      basisUnit: "g",
      method: "declared",
      confidence: "unverified",
      source,
    });
  }

  return nutrients;
}

/**
 * Maps ONE already-schema-validated OFF product into a candidate
 * `CanonicalFood`. Returns `null` (never usable) when the product lacks a
 * usable available-carbohydrate value, or when the mapped result fails
 * `collectCanonicalFoodErrors` — this codebase never trusts external data,
 * OFF included (CLAUDE.md: "All external data is untrusted. Validate at
 * boundaries."). ALWAYS `status: "candidate"` — see the GOVERNANCE CONTRACT
 * at the top of this file.
 */
export function mapOffProduct(barcode: string, product: OffProduct): CanonicalFood | null {
  const nutrients = buildNutrients(barcode, product);
  if (!nutrients) return null;

  const namePt = resolveName(product.product_name_pt, product.product_name, `Produto Open Food Facts ${barcode}`);
  const nameEn = resolveName(product.product_name, product.product_name_pt, `Open Food Facts product ${barcode}`);

  const food: CanonicalFood = {
    id: `off-${barcode}`,
    type: "packaged",
    names: [
      { language: "pt-PT", name: namePt, synonyms: [] },
      { language: "en", name: nameEn, synonyms: [] },
    ],
    countries: [],
    markets: [],
    barcodes: [barcode],
    cuisineTags: [],
    dietaryPatternTags: [],
    mealContextTags: [],
    clinicalBehaviourTags: [],
    nutrients,
    // Always "candidate" — see the GOVERNANCE CONTRACT above. Never
    // auto-approved; a user/curator must confirm it through the normal
    // candidate-review workflow.
    status: "candidate",
  };

  return collectCanonicalFoodErrors(food).length === 0 ? food : null;
}

/**
 * Validates an already-parsed-JSON OFF response and, if it describes a
 * usable product, maps it to a candidate `CanonicalFood`. Pure (no I/O) and
 * exported so it can be unit-tested directly with hand-built payloads, not
 * just through the injected-`fetch` seam in `lookupOffProduct`.
 */
export function interpretOffPayload(barcode: string, rawJson: unknown): OffLookupResult {
  const parsed = offApiResponseSchema.safeParse(rawJson);
  if (!parsed.success) {
    // Top-level shape is not even recognisable as an OFF response — fail
    // closed rather than guessing at a malformed/adversarial payload.
    return { status: "error" };
  }

  if (parsed.data.status === 0) {
    // OFF's own "product not found" signal.
    return { status: "not_found" };
  }

  const product = parsed.data.product;
  if (!product) {
    // `status` was not explicitly 0, but there is no product body either —
    // fail closed as "not found" rather than fabricate a food from nothing.
    return { status: "not_found" };
  }

  const food = mapOffProduct(barcode, product);
  if (!food) {
    return { status: "not_found" };
  }

  return { status: "found", food, attribution: OFF_ATTRIBUTION };
}

// ---------------------------------------------------------------------------
// Live mode — fetch + validate the untrusted upstream OFF product endpoint
// ---------------------------------------------------------------------------

function buildOffProductUrl(barcode: string): string {
  return `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;
}

/**
 * Looks up ONE product by barcode from the public Open Food Facts API.
 * `deps.fetchImpl` is the injected-client seam (mirrors `NightscoutDeps` in
 * `./modules/nightscout.ts` and `AnthropicMessagesClient` in
 * `./anthropicFoodAi.ts`) — tests always supply a fake so this module never
 * makes a real network call under test. Never throws: network failure,
 * non-2xx, and non-JSON bodies are all normalised to `{ status: "error" }`.
 */
export async function lookupOffProduct(barcode: string, deps: OpenFoodFactsDeps = {}): Promise<OffLookupResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const url = buildOffProductUrl(barcode);

  let response: Response;
  try {
    response = await fetchImpl(url, { method: "GET" });
  } catch {
    // Never log the raw error: on some runtimes it may embed the request URL.
    return { status: "error" };
  }

  if (!response.ok) {
    return { status: "error" };
  }

  let rawJson: unknown;
  try {
    rawJson = await response.json();
  } catch {
    // The response body was not valid JSON at all — distinct from
    // `interpretOffPayload`'s schema-shape failure, but the same "error"
    // outcome (502 `off_unavailable` at the route).
    return { status: "error" };
  }

  return interpretOffPayload(barcode, rawJson);
}
