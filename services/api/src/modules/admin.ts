// Admin review-queue module: the curation surface behind the public food
// catalog. Every route in this file requires `requireAdmin` — an
// authenticated user (`requireAuth`) whose (case-normalised) email is in the
// `ADMIN_EMAILS` allowlist. An authenticated-but-non-admin caller gets `403`
// (never `401` — they DID authenticate); an unauthenticated caller gets
// `401`, exactly like every other `requireAuth`-protected route.
//
// GOVERNANCE (CLAUDE.md / .claude/rules/food-data.md): `POST
// /admin/foods/ai-generate` NEVER auto-approves its output — every generated
// food is stored via `FoodRepository.insertAiCandidate`, which hardcodes
// `status: "candidate"`/`source: "ai"` regardless of what the injected
// `FoodAiProvider` returns (the default/test provider is the mock, fully
// offline `MockFoodAiProvider` — see `../foodAi.ts`; `src/server.ts` injects
// the real, network-calling `AnthropicFoodAiProvider` — see
// `../anthropicFoodAi.ts` — when `ANTHROPIC_API_KEY` is configured). A human
// must call `POST /admin/foods/:id/approve` before an AI candidate is ever
// visible through `/catalog/foods`. A provider failure (missing key, network
// error, model refusal) is caught below and surfaced as `502
// ai_unavailable` — the backoffice degrades gracefully rather than 500ing.
//
// PRIVACY: `submittedBy`/`reviewedBy` are user ids (`request.userId`), never
// emails — this module never logs or returns an email address.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { collectCanonicalFoodErrors, FOOD_STATUSES } from "@t1dine/food-schema";
import type { CanonicalFood } from "@t1dine/food-schema";
import { matchesRegion } from "../catalogFilters.js";
import { MockFoodAiProvider } from "../foodAi.js";
import type { FoodAiGenerateParams, FoodAiProvider } from "../foodAi.js";
import { FOOD_SOURCES, FoodIdTakenError } from "../repositories/foodRepository.js";
import type { AdminListFilter, FoodRepository, StoredFood } from "../repositories/foodRepository.js";
import type { UserRepository } from "../repositories/userRepository.js";
import { requireAuth } from "./auth.js";

const DEFAULT_ADMIN_EMAILS = "admin@t1dine.local";

/** Resolves the admin email allowlist from `ADMIN_EMAILS` (comma-separated),
 * falling back to a single fixed dev default when unset. Every entry is
 * trimmed and lower-cased so comparison is case-insensitive, mirroring
 * `UserRepository`'s email normalisation. */
export function resolveAdminEmails(): string[] {
  const raw = process.env["ADMIN_EMAILS"] ?? DEFAULT_ADMIN_EMAILS;
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

export interface RequireAdminDeps {
  secret: string;
  userRepository: UserRepository;
  adminEmails: string[];
}

/**
 * Fastify preHandler PAIR: `requireAuth` first, then an admin-membership
 * check. Returned as a two-element array so Fastify runs them in sequence
 * and short-circuits the moment either one sends a reply (`requireAuth`'s
 * `401`, or the membership check's `403`) — mirrors the array-of-preHandlers
 * form already supported by every route in this codebase.
 */
export function requireAdmin(deps: RequireAdminDeps) {
  const authPreHandler = requireAuth(deps.secret);
  const allow = new Set(deps.adminEmails.map((email) => email.trim().toLowerCase()).filter((email) => email.length > 0));

  async function adminCheckPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId;
    if (!userId) {
      // Invariant guard: `requireAuth` always sets this before this
      // preHandler runs, or short-circuits with 401 first.
      await reply.status(401).send({ error: "unauthorized", message: "Missing authenticated user." });
      return;
    }

    const user = await deps.userRepository.findById(userId);
    const email = user ? user.email.trim().toLowerCase() : undefined;
    if (!email || !allow.has(email)) {
      await reply.status(403).send({ error: "forbidden", message: "Admin access required." });
      return;
    }
  }

  return [authPreHandler, adminCheckPreHandler];
}

// ---------------------------------------------------------------------------
// Request contracts
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  status: z.enum(FOOD_STATUSES).optional(),
  source: z.enum(FOOD_SOURCES).optional(),
  region: z.string().trim().min(1, "region must be a non-empty string when provided").optional(),
});

const idParamsSchema = z.object({
  id: z.string().trim().min(1, "id must be a non-empty string"),
});

const MIN_AI_COUNT = 1;
const MAX_AI_COUNT = 20;

const aiGenerateBodySchema = z.object({
  country: z.string().trim().min(1, "country must be a non-empty string when provided").optional(),
  region: z.string().trim().min(1, "region must be a non-empty string when provided").optional(),
  cuisine: z.string().trim().min(1, "cuisine must be a non-empty string when provided").optional(),
  count: z
    .number({ invalid_type_error: "count must be a number" })
    .int("count must be an integer")
    .min(MIN_AI_COUNT, `count must be at least ${MIN_AI_COUNT}`)
    .max(MAX_AI_COUNT, `count must be at most ${MAX_AI_COUNT}`),
});

const foodBodySchema = z.record(z.unknown());

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export interface AdminDeps {
  foodRepository: FoodRepository;
  userRepository: UserRepository;
  secret: string;
  adminEmails: string[];
  /** Injectable AI provider seam — defaults to the fully offline
   * `MockFoodAiProvider`. A real adapter would be injected here without
   * changing this module's route contract; see `../foodAi.ts`. */
  aiProvider?: FoodAiProvider;
}

export function adminRoutes(deps: AdminDeps) {
  const aiProvider = deps.aiProvider ?? new MockFoodAiProvider();
  const adminPreHandler = requireAdmin({
    secret: deps.secret,
    userRepository: deps.userRepository,
    adminEmails: deps.adminEmails,
  });

  return async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
    app.get("/admin/foods", { preHandler: adminPreHandler }, async (request, reply) => {
      const parsedQuery = listQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: "invalid_query",
          message: "Query parameters failed validation.",
          issues: parsedQuery.error.issues.map((issue) => issue.message),
        });
      }

      const { status, source, region } = parsedQuery.data;
      const filter: AdminListFilter = {
        ...(status ? { status } : {}),
        ...(source ? { source } : {}),
      };

      let records = await deps.foodRepository.listAll(filter);
      if (region) {
        records = records.filter((record) => matchesRegion(record.food, region));
      }

      return reply.send({ count: records.length, foods: records });
    });

    app.post("/admin/foods/:id/approve", { preHandler: adminPreHandler }, async (request, reply) => {
      const parsedParams = idParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "invalid_params",
          message: "Path parameters failed validation.",
          issues: parsedParams.error.issues.map((issue) => issue.message),
        });
      }

      const reviewerId = request.userId;
      if (!reviewerId) {
        return reply.status(401).send({ error: "unauthorized", message: "Missing authenticated user." });
      }

      const updated = await deps.foodRepository.approve(parsedParams.data.id, reviewerId);
      if (!updated) {
        return reply.status(404).send({
          error: "not_found",
          message: `No food found with id "${parsedParams.data.id}".`,
        });
      }

      return reply.send(updated);
    });

    app.post("/admin/foods/:id/reject", { preHandler: adminPreHandler }, async (request, reply) => {
      const parsedParams = idParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "invalid_params",
          message: "Path parameters failed validation.",
          issues: parsedParams.error.issues.map((issue) => issue.message),
        });
      }

      const reviewerId = request.userId;
      if (!reviewerId) {
        return reply.status(401).send({ error: "unauthorized", message: "Missing authenticated user." });
      }

      const updated = await deps.foodRepository.reject(parsedParams.data.id, reviewerId);
      if (!updated) {
        return reply.status(404).send({
          error: "not_found",
          message: `No food found with id "${parsedParams.data.id}".`,
        });
      }

      return reply.send(updated);
    });

    app.post("/admin/foods", { preHandler: adminPreHandler }, async (request, reply) => {
      const parsedBody = foodBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "invalid_body",
          message: "Body must be a JSON object.",
          issues: parsedBody.error.issues.map((issue) => issue.message),
        });
      }

      const foodErrors = collectCanonicalFoodErrors(parsedBody.data, "food");
      if (foodErrors.length > 0) {
        return reply.status(400).send({
          error: "invalid_food",
          message: "Food failed canonical-food validation.",
          issues: foodErrors,
        });
      }

      // Safe to narrow now: `parsedBody.data` has just passed
      // `collectCanonicalFoodErrors`, the same runtime validator underlying
      // `isCanonicalFood`.
      const food = parsedBody.data as unknown as CanonicalFood;

      try {
        const stored = await deps.foodRepository.insertAdminFood(food);
        return reply.status(201).send(stored);
      } catch (error) {
        if (error instanceof FoodIdTakenError) {
          return reply.status(409).send({ error: "id_taken", message: error.message });
        }
        throw error;
      }
    });

    app.post("/admin/foods/ai-generate", { preHandler: adminPreHandler }, async (request, reply) => {
      const parsedBody = aiGenerateBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "invalid_body",
          message: "AI-generate request body failed validation.",
          issues: parsedBody.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`),
        });
      }

      const { country, region, cuisine, count } = parsedBody.data;

      // Deterministic starting offset derived from existing store state —
      // never `Math.random()`/`Date.now()` — so repeat calls do not collide.
      const existingAiCandidates = await deps.foodRepository.listAll({ source: "ai" });
      const startIndex = existingAiCandidates.length + 1;

      const generateParams: FoodAiGenerateParams = {
        count,
        startIndex,
        ...(country ? { country } : {}),
        ...(region ? { region } : {}),
        ...(cuisine ? { cuisine } : {}),
      };

      let generated: CanonicalFood[];
      try {
        generated = await aiProvider.generate(generateParams);
      } catch {
        // Deliberately does not log the caught error: a real adapter's
        // failure (see `../anthropicFoodAi.ts`) could embed the prompt,
        // model response, or API key in its message — never console.log
        // any of those (PRIVACY). Degrade gracefully instead of crashing
        // the request.
        return reply.status(502).send({
          error: "ai_unavailable",
          message: "The AI food-generation provider is currently unavailable.",
        });
      }

      const validationIssues: string[] = [];
      generated.forEach((food, index) => {
        validationIssues.push(...collectCanonicalFoodErrors(food, `foods[${index}]`));
      });
      if (validationIssues.length > 0) {
        // Should be unreachable for a conforming `FoodAiProvider` — fail
        // loudly rather than silently store a malformed AI candidate (all
        // external/generated data is untrusted until validated).
        return reply.status(500).send({
          error: "internal_error",
          message: "The AI provider produced a food that fails canonical-food validation.",
          issues: validationIssues,
        });
      }

      const stored: StoredFood[] = [];
      for (const food of generated) {
        // ALWAYS a candidate — `insertAiCandidate` hardcodes
        // `status: "candidate"`/`source: "ai"` regardless of the provider's
        // output; this is never auto-approved.
        stored.push(await deps.foodRepository.insertAiCandidate(food));
      }

      return reply.status(201).send({ count: stored.length, foods: stored });
    });
  };
}
