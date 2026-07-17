// Meal-assembly module: resolves meal lines against the catalog, computes a
// nutrition summary via the shared `@t1dine/nutrition` package, and persists
// the result through the injected `MealRepository` PORT (see
// `../repositories/mealRepository.ts`). This module never knows whether the
// backing store is the in-memory adapter or Postgres — swapping the adapter
// must never change the response shape below.
//
// AUTH + OWNERSHIP (security review M4): the T1Dine mobile app is
// local-first and does not call these routes today (meal assembly happens
// on-device) — but a public, unauthenticated write/read pair backed by a
// real persistence layer is still a live risk (an anonymous caller could
// otherwise fill the store, or enumerate/read any `meal-N` id). Both routes
// now require `requireAuth`; `POST /meals` records `request.userId` as the
// meal's owner, and `GET /meals/:id` 404s (never 403) for anyone else's meal
// — the same "don't reveal that the id exists" convention already used by
// `../catalogFilters.ts`'s public catalog routes for unapproved foods.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CanonicalFood } from "@t1dine/food-schema";
import { summariseMeal } from "@t1dine/nutrition";
import { CATALOG } from "../catalog.js";
import { requireAuth } from "./auth.js";
import type { MealRepository } from "../repositories/mealRepository.js";

const mealLineSchema = z.object({
  foodId: z.string().trim().min(1, "foodId must be a non-empty string"),
  amount: z
    .number({ invalid_type_error: "amount must be a number" })
    .finite("amount must be a finite number")
    .positive("amount must be greater than 0"),
});

const createMealBodySchema = z.object({
  lines: z.array(mealLineSchema).min(1, "lines must contain at least one entry"),
});

const mealParamsSchema = z.object({
  id: z.string().trim().min(1, "id must be a non-empty string"),
});

function findFoodById(foodId: string): CanonicalFood | undefined {
  return CATALOG.find((item) => item.id === foodId);
}

export interface MealsDeps {
  repository: MealRepository;
  secret: string;
}

/**
 * Builds the meals route plugin bound to a specific `MealRepository`
 * instance and HMAC secret, mirroring the closure pattern already used by
 * `nightscoutRoutes`/`syncRoutes` — this keeps the injected dependencies
 * fully typed without an `unknown`-typed Fastify options bag.
 */
export function mealsRoutes(deps: MealsDeps) {
  const { repository, secret } = deps;
  const authPreHandler = requireAuth(secret);

  return async function registerMealsRoutes(app: FastifyInstance): Promise<void> {
    app.post("/meals", { preHandler: authPreHandler }, async (request, reply) => {
      const ownerId = request.userId;
      if (!ownerId) {
        // Invariant guard: `requireAuth` always sets this before the handler
        // runs, or short-circuits with 401 first.
        return reply.status(401).send({ error: "unauthorized", message: "Missing authenticated user." });
      }

      const parsedBody = createMealBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "invalid_body",
          message: "Meal request body failed validation.",
          issues: parsedBody.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`),
        });
      }

      const unknownFoodIssues: string[] = [];
      const resolvedLines: { food: CanonicalFood; amount: number }[] = [];

      parsedBody.data.lines.forEach((line, index) => {
        const food = findFoodById(line.foodId);
        if (!food) {
          unknownFoodIssues.push(`lines[${index}].foodId "${line.foodId}" does not match any catalog food`);
          return;
        }
        resolvedLines.push({ food, amount: line.amount });
      });

      if (unknownFoodIssues.length > 0) {
        return reply.status(400).send({
          error: "unknown_food",
          message: "One or more meal lines reference an unknown food.",
          issues: unknownFoodIssues,
        });
      }

      const summary = summariseMeal(resolvedLines);
      const { id } = await repository.save(summary, ownerId);

      return reply.status(201).send({ id, summary });
    });

    app.get("/meals/:id", { preHandler: authPreHandler }, async (request, reply) => {
      const parsedParams = mealParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "invalid_params",
          message: "Path parameters failed validation.",
          issues: parsedParams.error.issues.map((issue) => issue.message),
        });
      }

      const stored = await repository.get(parsedParams.data.id);
      // Deliberately the SAME 404 whether the id is unknown or belongs to a
      // different user — never reveal that another user's meal id exists.
      if (!stored || stored.ownerId !== request.userId) {
        return reply.status(404).send({
          error: "not_found",
          message: `No meal found with id "${parsedParams.data.id}".`,
        });
      }

      return reply.send({ id: stored.id, summary: stored.summary });
    });
  };
}
