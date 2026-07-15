// Read-only food catalog module: search and lookup by id. All query input is
// untrusted external data, so it is validated with zod at the boundary
// before touching the in-memory catalog.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CATALOG, searchCatalog } from "../catalog.js";

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "q must be a non-empty string when provided").optional(),
  market: z.string().trim().min(1, "market must be a non-empty string when provided").optional(),
});

const foodParamsSchema = z.object({
  id: z.string().trim().min(1, "id must be a non-empty string"),
});

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  app.get("/catalog/foods", async (request, reply) => {
    const parsedQuery = searchQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: "invalid_query",
        message: "Query parameters failed validation.",
        issues: parsedQuery.error.issues.map((issue) => issue.message),
      });
    }

    const { q, market } = parsedQuery.data;
    const foods = searchCatalog(q, market);

    return reply.send({
      count: foods.length,
      foods,
    });
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

    const matched = CATALOG.find((item) => item.id === parsedParams.data.id);
    if (!matched) {
      return reply.status(404).send({
        error: "not_found",
        message: `No food found with id "${parsedParams.data.id}".`,
      });
    }

    return reply.send({ food: matched });
  });
}
