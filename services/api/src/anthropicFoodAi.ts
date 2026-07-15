// Real, network-calling `FoodAiProvider` adapter backed by the Anthropic
// Messages API. See `./foodAi.ts` for the full GOVERNANCE CONTRACT this
// module must uphold — in short: this class only ever produces
// `status: "candidate"` `CanonicalFood`s, and even that is enforced a
// second, independent time by the admin route + `FoodRepository
// .insertAiCandidate` (this class's output is never auto-approved).
//
// PRIVACY: this module never `console.log`s the prompt, the raw model
// response, or the API key. `new Anthropic()` (the default client) reads
// `ANTHROPIC_API_KEY` from the environment itself — it is never read,
// echoed, or hardcoded here.
//
// TRUST BOUNDARY (CLAUDE.md: "All external data is untrusted. Validate at
// boundaries."): every item the model emits is re-validated with
// `collectCanonicalFoodErrors` after mapping; anything that fails is
// dropped rather than stored. A model refusal, network failure, or missing
// API key throws — this adapter never fabricates a food to paper over a
// failure.

import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import type { NutrientObservation, SourceReference } from "@t1dine/domain";
import type { CanonicalFood } from "@t1dine/food-schema";
import { collectCanonicalFoodErrors, REGIONS } from "@t1dine/food-schema";
import type { FoodAiGenerateParams, FoodAiProvider } from "./foodAi.js";

/** Default model id when `FOODAI_MODEL` is unset. */
const DEFAULT_MODEL = "claude-opus-4-8";

// ---------------------------------------------------------------------------
// The simplified shape the model is asked to emit (NOT the full
// `CanonicalFood` — the model should never need to know our internal
// schema). Every item is validated with `isSimplifiedAiFood` before mapping,
// and the mapped `CanonicalFood` is re-validated with
// `collectCanonicalFoodErrors` — never trust model output.
// ---------------------------------------------------------------------------

export interface SimplifiedAiFood {
  namePt: string;
  nameEn: string;
  /** Grams of available carbohydrate per 100 g. */
  carbGramsPer100g: number;
  /** Kilocalories per 100 g. */
  energyKcalPer100g: number;
  cuisine: string;
}

function isSimplifiedAiFood(value: unknown): value is SimplifiedAiFood {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["namePt"] === "string" &&
    v["namePt"].trim().length > 0 &&
    typeof v["nameEn"] === "string" &&
    v["nameEn"].trim().length > 0 &&
    typeof v["carbGramsPer100g"] === "number" &&
    Number.isFinite(v["carbGramsPer100g"]) &&
    typeof v["energyKcalPer100g"] === "number" &&
    Number.isFinite(v["energyKcalPer100g"]) &&
    typeof v["cuisine"] === "string" &&
    v["cuisine"].trim().length > 0
  );
}

// ---------------------------------------------------------------------------
// Structured-output tool definition. `tool_choice: { type: "tool", name:
// "emit_foods" }` (set in `generate` below) forces the model to answer
// exclusively via this tool, so the response is always structured JSON
// rather than free text we would have to parse.
// ---------------------------------------------------------------------------

const EMIT_FOODS_INPUT_SCHEMA: Anthropic.Tool["input_schema"] = {
  type: "object",
  additionalProperties: false,
  required: ["foods"],
  properties: {
    foods: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["namePt", "nameEn", "carbGramsPer100g", "energyKcalPer100g", "cuisine"],
        properties: {
          namePt: { type: "string" },
          nameEn: { type: "string" },
          carbGramsPer100g: { type: "number" },
          energyKcalPer100g: { type: "number" },
          cuisine: { type: "string" },
        },
      },
    },
  },
};

/** Strict structured-output tool the model must use to answer. `strict` is
 * not part of the installed SDK's `Tool` type (it predates strict-tool
 * support in this SDK version), hence the local intersection type — the
 * extra field is still sent to the API as plain JSON. */
export const EMIT_FOODS_TOOL: Anthropic.Tool & { strict: true } = {
  name: "emit_foods",
  description:
    "Emit a list of realistic, plausible foods for the requested country/region/cuisine. Each food must have " +
    "a pt-PT (European Portuguese) name, an English name, an estimated available carbohydrate content in grams " +
    "per 100 g, an estimated energy content in kilocalories per 100 g, and a short cuisine tag.",
  strict: true,
  input_schema: EMIT_FOODS_INPUT_SCHEMA,
};

// ---------------------------------------------------------------------------
// Injectable client seam — lets tests exercise `AnthropicFoodAiProvider`
// with a fake `messages.create` instead of ever calling the real network
// API. A real `Anthropic` client instance structurally satisfies this
// (narrower) interface.
// ---------------------------------------------------------------------------

export interface AnthropicMessageResult {
  stop_reason: Anthropic.StopReason | null;
  content: Array<Anthropic.ContentBlock>;
}

export interface AnthropicMessagesClient {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<AnthropicMessageResult>;
  };
}

// ---------------------------------------------------------------------------
// Mapping: simplified model output -> full CanonicalFood candidate. Pure,
// no I/O — unit-tested directly in `test/foodAi.test.ts` without any
// Anthropic client at all.
// ---------------------------------------------------------------------------

function resolveMappingCountries(params: FoodAiGenerateParams): string[] {
  const country = params.country?.trim().toUpperCase();
  if (country) return [country];

  const regionId = params.region?.trim().toLowerCase();
  if (regionId) {
    const region = REGIONS.find((candidate) => candidate.id === regionId);
    const representative = region?.countries[0];
    if (representative) return [representative];
  }

  // No country/region hint at all — fall back to a fixed representative
  // market rather than guessing from `cuisine` (unlike `MockFoodAiProvider`,
  // this adapter does not maintain a cuisine->country table; the prompt
  // itself asks the model to respect the requested country/region/cuisine).
  return ["PT"];
}

/** Deterministic, non-cryptographic-use stand-in for a raw-snapshot digest —
 * mirrors `aiSnapshotHash` in `./foodAi.ts` and `syntheticSnapshotHash` in
 * `./catalog.ts`. Not a hash of the actual raw API response (which may embed
 * unrelated model output/formatting we do not want to persist) — a stable
 * per-candidate placeholder digest, same shape/intent as the mock's. */
function aiSnapshotHash(seed: string): string {
  return createHash("sha256").update(`t1dine-ai-candidate-claude:${seed}`).digest("hex");
}

function buildSource(id: string, market: string): SourceReference {
  return {
    sourceId: "AI-CLAUDE",
    sourceRecordId: `AI-CLAUDE-${id}`,
    sourceVersion: "claude-messages-api",
    market,
    licence: "ai-generated-candidate",
    retrievedAt: new Date().toISOString(),
    rawSnapshotSha256: aiSnapshotHash(id),
    mappingVersion: "ai-claude-0.1",
  };
}

function buildNutrients(id: string, item: SimplifiedAiFood, market: string): NutrientObservation[] {
  const source = buildSource(id, market);
  return [
    {
      nutrientCode: "CHOAVL",
      value: item.carbGramsPer100g,
      unit: "g",
      basisQuantity: 100,
      basisUnit: "g",
      method: "estimated",
      confidence: "unverified",
      source,
    },
    {
      nutrientCode: "ENERC",
      value: item.energyKcalPer100g,
      unit: "kcal",
      basisQuantity: 100,
      basisUnit: "g",
      method: "estimated",
      confidence: "unverified",
      source,
    },
  ];
}

/**
 * Maps ONE model-supplied item into a full `CanonicalFood` candidate.
 * Returns `null` (dropping the item) when `raw` does not even look like a
 * `SimplifiedAiFood`, or when the mapped result fails
 * `collectCanonicalFoodErrors` — this codebase never trusts model output,
 * generated or otherwise (CLAUDE.md: "All external data is untrusted.
 * Validate at boundaries.").
 */
export function mapSimplifiedFood(raw: unknown, params: FoodAiGenerateParams, index: number): CanonicalFood | null {
  if (!isSimplifiedAiFood(raw)) return null;

  const countries = resolveMappingCountries(params);
  const market = countries[0] ?? "PT";
  const id = `ai-claude-candidate-${params.startIndex + index}`;

  const candidate: CanonicalFood = {
    id,
    type: "custom",
    names: [
      { language: "pt-PT", name: raw.namePt, synonyms: [] },
      { language: "en", name: raw.nameEn, synonyms: [] },
    ],
    countries,
    markets: countries,
    barcodes: [],
    cuisineTags: [raw.cuisine],
    dietaryPatternTags: [],
    mealContextTags: [],
    clinicalBehaviourTags: [],
    nutrients: buildNutrients(id, raw, market),
    // Always "candidate" — see the GOVERNANCE CONTRACT above. The caller
    // (admin route) enforces this a second time via
    // `FoodRepository.insertAiCandidate`.
    status: "candidate",
  };

  return collectCanonicalFoodErrors(candidate).length === 0 ? candidate : null;
}

/** Maps every raw item returned by the model, dropping invalid ones. */
export function mapFoods(rawFoods: unknown[], params: FoodAiGenerateParams): CanonicalFood[] {
  const foods: CanonicalFood[] = [];
  rawFoods.forEach((raw, index) => {
    const mapped = mapSimplifiedFood(raw, params, index);
    if (mapped) foods.push(mapped);
  });
  return foods;
}

function buildPrompt(params: FoodAiGenerateParams): string {
  const locationBits: string[] = [];
  if (params.country) locationBits.push(`country ${params.country}`);
  if (params.region) locationBits.push(`region ${params.region}`);
  if (params.cuisine) locationBits.push(`cuisine ${params.cuisine}`);
  const location = locationBits.length > 0 ? locationBits.join(", ") : "a generic European market";

  return [
    `Generate ${params.count} realistic, plausible foods for the following: ${location}.`,
    "For each food, provide a pt-PT (European Portuguese) name, an English name, an estimate of the available",
    "carbohydrate content in grams per 100 g, an estimate of the energy content in kilocalories per 100 g, and",
    'a short lowercase cuisine tag (e.g. "italian", "greek", "mediterranean").',
    "These are illustrative estimates for a curator review queue, not verified laboratory analyses and not",
    "medical or clinical advice.",
    "Answer only by calling the emit_foods tool.",
  ].join(" ");
}

function extractRawFoods(input: unknown): unknown[] {
  if (typeof input !== "object" || input === null) return [];
  const foods = (input as Record<string, unknown>)["foods"];
  return Array.isArray(foods) ? foods : [];
}

/**
 * Real Claude-backed implementation of `FoodAiProvider`. Every generated
 * food is ALWAYS `status: "candidate"` — see the governance contract at the
 * top of this file; the admin route and `FoodRepository.insertAiCandidate`
 * enforce this again, independently.
 *
 * Reads `ANTHROPIC_API_KEY` via the Anthropic SDK's own default client
 * behaviour (never hardcoded, never logged here). The model id comes from
 * `FOODAI_MODEL`, defaulting to `"claude-opus-4-8"`.
 */
export class AnthropicFoodAiProvider implements FoodAiProvider {
  private readonly client: AnthropicMessagesClient;
  private readonly model: string;

  constructor(
    client: AnthropicMessagesClient = new Anthropic(),
    model: string = process.env["FOODAI_MODEL"] ?? DEFAULT_MODEL,
  ) {
    this.client = client;
    this.model = model;
  }

  /**
   * Constructs a provider from an explicit API key — e.g. one decrypted from
   * admin-managed settings (see `../aiProviderResolution.ts`) — rather than
   * relying on the Anthropic SDK's own `ANTHROPIC_API_KEY` env-var lookup.
   * This is IN ADDITION to the constructor-injection seam above (used by
   * `../../test/foodAi.test.ts` with a fake client); it never logs `apiKey`.
   */
  static fromApiKey(apiKey: string, model: string = process.env["FOODAI_MODEL"] ?? DEFAULT_MODEL): AnthropicFoodAiProvider {
    return new AnthropicFoodAiProvider(new Anthropic({ apiKey }), model);
  }

  async generate(params: FoodAiGenerateParams): Promise<CanonicalFood[]> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      tools: [EMIT_FOODS_TOOL],
      tool_choice: { type: "tool", name: "emit_foods" },
      messages: [{ role: "user", content: buildPrompt(params) }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("AnthropicFoodAiProvider: the model refused to generate foods.");
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "emit_foods",
    );
    if (!toolUse) {
      throw new Error("AnthropicFoodAiProvider: no emit_foods tool_use block in the model response.");
    }

    return mapFoods(extractRawFoods(toolUse.input), params);
  }
}
