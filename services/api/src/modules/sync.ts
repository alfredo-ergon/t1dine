// User-scoped cloud sync module (the "sync" half of Slice 5's accounts +
// sync foundation). Every route requires a valid bearer token (`requireAuth`
// from `./auth.js`) and is STRICTLY scoped to `request.userId` — there is no
// path in this module that accepts a caller-supplied user id, so a user can
// only ever read or write their own row.
//
// PRIVACY: sync payloads can contain user-authored data (favourite foods,
// custom foods) — health-adjacent per CLAUDE.md's privacy rules. This module
// never logs a `state` value (or anything else request-derived); the
// app-wide `Fastify({ logger: false })` setting is unchanged.
//
// UNTRUSTED INPUT: every custom food is re-validated with
// `collectCanonicalFoodErrors` at this API boundary (CLAUDE.md: "all
// external data is untrusted; validate at boundaries") — a client cannot
// smuggle a malformed food into sync, and therefore cannot smuggle one into
// another of their own devices via a later `GET`.
//
// CONCURRENCY: a conflicting write is never silently merged or overwritten
// (CLAUDE.md: "never merge conflicting food values by silently averaging
// them" — the same principle applies here to whole sync states). A stale
// `baseVersion` fails the write with `409` and the current, unchanged
// snapshot, so the caller can reconcile explicitly.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { collectCanonicalFoodErrors } from "@t1dine/food-schema";
import type { CanonicalFood } from "@t1dine/food-schema";
import { requireAuth } from "./auth.js";
import type { SyncState, UserDataRepository } from "../repositories/userDataRepository.js";

const syncStateBodySchema = z.object({
  favourites: z.array(z.string().trim().min(1, "favourites entries must be non-empty strings")),
  // Structurally validated as `unknown[]` here; each entry is deep-validated
  // against the canonical food contract below via `collectCanonicalFoodErrors`
  // (untrusted external data, per CLAUDE.md — never trusted on shape alone).
  customFoods: z.array(z.unknown()),
});

const putSyncStateBodySchema = z.object({
  state: syncStateBodySchema,
  baseVersion: z
    .number({ invalid_type_error: "baseVersion must be a number" })
    .int("baseVersion must be an integer")
    .nonnegative("baseVersion must be zero or greater")
    .optional(),
});

export interface SyncDeps {
  repository: UserDataRepository;
  secret: string;
}

/**
 * Builds the sync route plugin bound to a specific `UserDataRepository`
 * instance and HMAC secret, mirroring the closure pattern already used by
 * `mealsRoutes`/`nightscoutRoutes`/`authRoutes`.
 */
export function syncRoutes(deps: SyncDeps) {
  const { repository, secret } = deps;
  const authPreHandler = requireAuth(secret);

  return async function registerSyncRoutes(app: FastifyInstance): Promise<void> {
    app.get("/sync/state", { preHandler: authPreHandler }, async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        // Invariant guard: `requireAuth` always sets this before the handler
        // runs, or short-circuits with 401 first — this branch should be
        // unreachable, but fails closed rather than reading `undefined` as a
        // key into per-user storage.
        return reply.status(401).send({ error: "unauthorized", message: "Missing authenticated user." });
      }

      const snapshot = await repository.get(userId);
      return reply.send(snapshot);
    });

    app.put("/sync/state", { preHandler: authPreHandler }, async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return reply.status(401).send({ error: "unauthorized", message: "Missing authenticated user." });
      }

      const parsedBody = putSyncStateBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "invalid_body",
          message: "Sync state request body failed validation.",
          issues: parsedBody.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`),
        });
      }

      const { state, baseVersion } = parsedBody.data;

      const foodIssues: string[] = [];
      state.customFoods.forEach((food, index) => {
        foodIssues.push(...collectCanonicalFoodErrors(food, `customFoods[${index}]`));
      });

      if (foodIssues.length > 0) {
        return reply.status(400).send({
          error: "invalid_custom_food",
          message: "One or more custom foods failed canonical-food validation.",
          issues: foodIssues,
        });
      }

      // Safe to narrow now: every entry has just passed
      // `collectCanonicalFoodErrors`, the same runtime validator that
      // underlies `isCanonicalFood`.
      const validatedState: SyncState = {
        favourites: state.favourites,
        customFoods: state.customFoods as CanonicalFood[],
      };

      const outcome = await repository.put(userId, validatedState, baseVersion);

      if (outcome.status === "conflict") {
        return reply.status(409).send(outcome.snapshot);
      }

      return reply.send({ version: outcome.snapshot.version, updatedAt: outcome.snapshot.updatedAt });
    });
  };
}
