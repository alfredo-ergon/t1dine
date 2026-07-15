// Meal-assembly module: resolves meal lines against the catalog, computes a
// nutrition summary via the shared `@t1dine/nutrition` package, and persists
// the result through the injected `MealRepository` PORT (see
// `../repositories/mealRepository.ts`). This module never knows whether the
// backing store is the in-memory adapter or Postgres — swapping the adapter
// must never change the response shape below.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CanonicalFood } from "@t1dine/food-schema";
import { summariseMeal } from "@t1dine/nutrition";
import { CATALOG } from "../catalog.js";
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

/**
 * Builds the meals route plugin bound to a specific `MealRepository`
 * instance, mirroring the closure pattern already used by
 * `nightscoutRoutes` — this keeps the injected dependency fully typed
 * without an `unknown`-typed Fastify options bag.
 */
export function mealsRoutes(repository: MealRepository) {
  return async function registerMealsRoutes(app: FastifyInstance): Promise<void> {
    app.post("/meals", async (request, reply) => {
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
      const { id } = await repository.save(summary);

      return reply.status(201).send({ id, summary });
    });

    app.get("/meals/:id", async (request, reply) => {
      const parsedParams = mealParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "invalid_params",
          message: "Path parameters failed validation.",
          issues: parsedParams.error.issues.map((issue) => issue.message),
        });
      }

      const stored = await repository.get(parsedParams.data.id);
      if (!stored) {
        return reply.status(404).send({
          error: "not_found",
          message: `No meal found with id "${parsedParams.data.id}".`,
        });
      }

      return reply.send({ id: stored.id, summary: stored.summary });
    });
  };
}
