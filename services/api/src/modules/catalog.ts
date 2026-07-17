// Public food catalog module: search, lookup by id, the browse-by-area
// taxonomy, and user submissions. Every query/body is untrusted external
// data (CLAUDE.md: "all external data is untrusted; validate at
// boundaries"), so it is validated with zod (structural) and, for
// submissions, `collectCanonicalFoodErrors` (deep canonical-food shape)
// before it ever reaches the `FoodRepository`.
//
// VISIBILITY CONTRACT: `/catalog/foods` and `/catalog/foods/:id` only ever
// return `status: "approved"` foods — a `candidate` or `retired` record
// (whatever its source: seed/user/ai/admin) never appears here. This is the
// review-gate half of the food-data governance rule; the admin review queue
// (`./admin.ts`) is the other half.
//
// A food's region is DERIVED from its `countries[]` (see
// `../catalogFilters.ts`), never stored as a separate field.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AREA_TAXONOMY, collectCanonicalFoodErrors } from "@t1dine/food-schema";
import type { CanonicalFood } from "@t1dine/food-schema";
import { filterFoods } from "../catalogFilters.js";
import type { CatalogFilter } from "../catalogFilters.js";
import { resolveOffLookupRateLimit, resolveSubmissionsRateLimit } from "../rateLimit.js";
import { FoodIdTakenError } from "../repositories/foodRepository.js";
import type { FoodRepository } from "../repositories/foodRepository.js";
import { optionalAuth } from "./auth.js";
import { lookupOffProduct, OFF_BARCODE_PATTERN } from "../openFoodFacts.js";

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "q must be a non-empty string when provided").optional(),
  country: z.string().trim().min(1, "country must be a non-empty string when provided").optional(),
  region: z.string().trim().min(1, "region must be a non-empty string when provided").optional(),
  cuisine: z.string().trim().min(1, "cuisine must be a non-empty string when provided").optional(),
});

const foodParamsSchema = z.object({
  id: z.string().trim().min(1, "id must be a non-empty string"),
});

// A submission body is an untyped, untrusted candidate `CanonicalFood`.
// `z.record` only confirms it is a plain JSON object (never an array,
// primitive, or null) before the deep, field-by-field
// `collectCanonicalFoodErrors` check below.
const submissionBodySchema = z.record(z.unknown());

const offLookupQuerySchema = z.object({
  barcode: z
    .string({ required_error: "barcode is required" })
    .trim()
    .regex(OFF_BARCODE_PATTERN, "barcode must be 8 to 14 digits"),
});

export interface CatalogDeps {
  foodRepository: FoodRepository;
  /** HMAC secret used only to OPTIONALLY authenticate `POST
   * /catalog/submissions` (see `optionalAuth` in `./auth.js`) — a missing or
   * invalid token never rejects the request, it just submits anonymously. */
  secret: string;
  /** Injectable Open Food Facts fetch adapter (see `../openFoodFacts.js`) for
   * `GET /catalog/off-lookup` — lets tests exercise the route fully offline.
   * Defaults to real global `fetch`. */
  offFetchImpl?: typeof fetch;
}

/**
 * Builds the catalog route plugin bound to a specific `FoodRepository`
 * instance and auth secret, mirroring the closure pattern already used by
 * `mealsRoutes`/`authRoutes`/`syncRoutes`.
 */
export function catalogRoutes(deps: CatalogDeps) {
  const optionalAuthPreHandler = optionalAuth(deps.secret);
  const offFetchImpl = deps.offFetchImpl ?? fetch;

  return async function registerCatalogRoutes(app: FastifyInstance): Promise<void> {
    app.get("/catalog/foods", async (request, reply) => {
      const parsedQuery = searchQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: "invalid_query",
          message: "Query parameters failed validation.",
          issues: parsedQuery.error.issues.map((issue) => issue.message),
        });
      }

      const { q, country, region, cuisine } = parsedQuery.data;
      const filter: CatalogFilter = {
        ...(q ? { q } : {}),
        ...(country ? { country } : {}),
        ...(region ? { region } : {}),
        ...(cuisine ? { cuisine } : {}),
      };

      // APPROVED ONLY — see the module's VISIBILITY CONTRACT above.
      const approved = await deps.foodRepository.listAll({ status: "approved" });
      const foods = filterFoods(
        approved.map((record) => record.food),
        filter,
      );

      return reply.send({ count: foods.length, foods });
    });

    app.get("/catalog/foods/:id", async (request, reply) => {
      const parsedParams = foodParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "invalid_params",
          message: "Path parameters failed validation.",
          issues: parsedParams.error.issues.map((issue) => issue.message),
        });
      }

      const stored = await deps.foodRepository.getById(parsedParams.data.id);
      // Deliberately the SAME 404 whether the id is unknown, still a
      // candidate, or retired — the public endpoint never reveals the
      // existence/status of an unapproved record.
      if (!stored || stored.status !== "approved") {
        return reply.status(404).send({
          error: "not_found",
          message: `No food found with id "${parsedParams.data.id}".`,
        });
      }

      return reply.send({ food: stored.food });
    });

    app.get("/catalog/regions", async (_request, reply) => {
      return reply.send(AREA_TAXONOMY);
    });

    // Open Food Facts barcode lookup — PUBLIC, like the rest of `/catalog`.
    // GOVERNANCE (see `../openFoodFacts.ts` for the full contract): this
    // route NEVER returns anything other than a `status: "candidate"` food.
    // It does not store the result anywhere itself — a caller wanting to
    // keep it must submit it through `POST /catalog/submissions` (or the
    // future OFF-specific confirm flow) like any other user-supplied
    // candidate, so it goes through the normal review queue rather than
    // being trusted just because it came back from this endpoint.
    app.get(
      "/catalog/off-lookup",
      { config: { rateLimit: resolveOffLookupRateLimit() } },
      async (request, reply) => {
        const parsedQuery = offLookupQuerySchema.safeParse(request.query);
        if (!parsedQuery.success) {
          return reply.status(400).send({
            error: "invalid_barcode",
            message: "barcode query parameter failed validation.",
            issues: parsedQuery.error.issues.map((issue) => issue.message),
          });
        }

        const result = await lookupOffProduct(parsedQuery.data.barcode, { fetchImpl: offFetchImpl });

        if (result.status === "error") {
          return reply.status(502).send({ error: "off_unavailable" });
        }
        if (result.status === "not_found") {
          return reply.status(404).send({ error: "not_found" });
        }

        return reply.send({ source: "openfoodfacts", food: result.food, attribution: result.attribution });
      },
    );

    app.post(
      "/catalog/submissions",
      { preHandler: optionalAuthPreHandler, config: { rateLimit: resolveSubmissionsRateLimit() } },
      async (request, reply) => {
        const parsedBody = submissionBodySchema.safeParse(request.body);
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
            message: "Submission failed canonical-food validation.",
            issues: foodErrors,
          });
        }

        // Safe to narrow now: `parsedBody.data` has just passed
        // `collectCanonicalFoodErrors`, the same runtime validator underlying
        // `isCanonicalFood`.
        const food = parsedBody.data as unknown as CanonicalFood;
        // `optionalAuth` sets `request.userId` only for a valid bearer token;
        // absent that, the submission is recorded as anonymous.
        const submittedBy = request.userId ?? null;

        try {
          // ALWAYS a candidate — `insertSubmission` hardcodes
          // `status: "candidate"`/`source: "user"` regardless of what the
          // submitted body's own `status` field said; a user submission is
          // never auto-approved.
          const stored = await deps.foodRepository.insertSubmission(food, submittedBy);
          return reply.status(201).send({ id: stored.id, status: stored.status });
        } catch (error) {
          if (error instanceof FoodIdTakenError) {
            return reply.status(409).send({ error: "id_taken", message: error.message });
          }
          throw error;
        }
      },
    );
  };
}
