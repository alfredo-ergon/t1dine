// Global fallback error handler (security review L1). Every route in this
// service already replies directly with a typed, deliberately-worded 4xx
// for a validation failure (zod) or a known domain conflict
// (`FoodIdTakenError`, `UserEmailTakenError`, a sync version conflict, ...)
// — those call `reply.status(...).send(...)` directly and NEVER reach this
// handler at all. This handler only ever runs for:
//   - Fastify's own request-lifecycle failures (e.g. a malformed JSON body)
//     — these already carry a legitimate 4xx `statusCode` and are forwarded
//     with that same status code, unchanged in spirit from Fastify's default
//     behaviour (its own body-parser message never contains anything
//     server-internal).
//   - Anything else: an uncaught exception from a route handler or a
//     repository (a real bug, a database outage, a decryption failure, an
//     unexpected repository error, ...). This is the ONLY case this handler
//     exists to guard — `error.message` can embed a connection string, a
//     stack detail, or another server-internal fact (several handlers in
//     this codebase, e.g. `./modules/admin.ts`'s `ai-generate` route and
//     `./modules/nightscout.ts`'s fetch failures, already deliberately avoid
//     logging or echoing a caught error for exactly this reason) — so
//     `error.message` is NEVER echoed back to the caller here. The caller
//     only ever sees a fixed, generic 500 body.

import { STATUS_CODES } from "node:http";
import type { FastifyReply, FastifyRequest } from "fastify";

const CLIENT_ERROR_MIN = 400;
const CLIENT_ERROR_MAX = 499;

function extractStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return undefined;
  const value = (error as { statusCode?: unknown }).statusCode;
  return typeof value === "number" ? value : undefined;
}

function isClientError(statusCode: number | undefined): statusCode is number {
  return typeof statusCode === "number" && statusCode >= CLIENT_ERROR_MIN && statusCode <= CLIENT_ERROR_MAX;
}

function extractMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") return error.message;
  return "Bad Request";
}

/**
 * Registered once, app-wide, via `app.setErrorHandler(genericErrorHandler)`
 * in `./app.ts`. See the module header for the full contract.
 */
export function genericErrorHandler(error: unknown, _request: FastifyRequest, reply: FastifyReply): void {
  const statusCode = extractStatusCode(error);

  if (isClientError(statusCode)) {
    void reply.status(statusCode).send({
      statusCode,
      error: STATUS_CODES[statusCode] ?? "Bad Request",
      message: extractMessage(error),
    });
    return;
  }

  void reply.status(500).send({
    error: "internal_error",
    message: "An unexpected error occurred.",
  });
}
