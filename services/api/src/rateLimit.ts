// Centralised rate-limit configuration (security review H2/M3). One global
// limiter is registered by `app.ts` via `@fastify/rate-limit`; the resolver
// functions below additionally produce tighter, env-tunable per-route
// overrides wired into the specific endpoints called out by the review:
// `/auth/login` + `/auth/register` (`./modules/auth.ts`), `POST
// /integrations/nightscout/glucose` (`./modules/nightscout.ts`), and `GET
// /catalog/off-lookup` + `POST /catalog/submissions` (`./modules/catalog.ts`).
//
// TEST BEHAVIOUR: `isRateLimitingEnabled` returns `false` whenever
// `NODE_ENV === "test"` (vitest sets this by default), and `app.ts` skips
// registering the `@fastify/rate-limit` plugin entirely in that case — so
// the existing, fast-repeating `app.inject()` suites (e.g.
// `foodSubmissions.test.ts`, `auth.test.ts`) never flake against a shared
// app instance, with no changes required in those files. The per-route
// `config: { rateLimit: {...} }` blocks below are harmless, inert extra
// route config whenever the global plugin has not been registered.
//
// Every resolver takes an optional `env` (defaulting to `process.env`) so
// each one is independently unit-testable without mutating global process
// state.

const ONE_MINUTE_MS = 60_000;

export interface RouteRateLimitOptions {
  max: number;
  timeWindow: number;
}

function resolvePositiveIntEnv(name: string, fallback: number, env: NodeJS.ProcessEnv): number {
  const raw = env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** `false` only under test — rate limiting itself is not a prod-only
 * hardening measure (unlike the CORS allowlist or the fail-closed secret
 * gate), dev gets the exact same limits as prod, just tunable via env. */
export function isRateLimitingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env["NODE_ENV"] !== "test";
}

/** Global default applied to every route: `RATE_LIMIT_MAX` per
 * `RATE_LIMIT_WINDOW_MS`, 120/minute out of the box. */
export function resolveGlobalRateLimit(env: NodeJS.ProcessEnv = process.env): RouteRateLimitOptions {
  return {
    max: resolvePositiveIntEnv("RATE_LIMIT_MAX", 120, env),
    timeWindow: resolvePositiveIntEnv("RATE_LIMIT_WINDOW_MS", ONE_MINUTE_MS, env),
  };
}

/** `/auth/login` + `/auth/register` — brute-force/credential-stuffing
 * surface. `RATE_LIMIT_AUTH_MAX` per `RATE_LIMIT_AUTH_WINDOW_MS`, 10/minute
 * out of the box. */
export function resolveAuthRateLimit(env: NodeJS.ProcessEnv = process.env): RouteRateLimitOptions {
  return {
    max: resolvePositiveIntEnv("RATE_LIMIT_AUTH_MAX", 10, env),
    timeWindow: resolvePositiveIntEnv("RATE_LIMIT_AUTH_WINDOW_MS", ONE_MINUTE_MS, env),
  };
}

/** `POST /integrations/nightscout/glucose` — an outbound proxy to a
 * caller-supplied host (see the SSRF hardening in `./modules/nightscout.ts`
 * / `./ssrfGuard.ts`). `RATE_LIMIT_NIGHTSCOUT_MAX` per
 * `RATE_LIMIT_NIGHTSCOUT_WINDOW_MS`, 30/minute out of the box. */
export function resolveNightscoutRateLimit(env: NodeJS.ProcessEnv = process.env): RouteRateLimitOptions {
  return {
    max: resolvePositiveIntEnv("RATE_LIMIT_NIGHTSCOUT_MAX", 30, env),
    timeWindow: resolvePositiveIntEnv("RATE_LIMIT_NIGHTSCOUT_WINDOW_MS", ONE_MINUTE_MS, env),
  };
}

/** `GET /catalog/off-lookup` — an outbound proxy to Open Food Facts.
 * `RATE_LIMIT_OFF_LOOKUP_MAX` per `RATE_LIMIT_OFF_LOOKUP_WINDOW_MS`,
 * 30/minute out of the box. */
export function resolveOffLookupRateLimit(env: NodeJS.ProcessEnv = process.env): RouteRateLimitOptions {
  return {
    max: resolvePositiveIntEnv("RATE_LIMIT_OFF_LOOKUP_MAX", 30, env),
    timeWindow: resolvePositiveIntEnv("RATE_LIMIT_OFF_LOOKUP_WINDOW_MS", ONE_MINUTE_MS, env),
  };
}

/** `POST /catalog/submissions` — a public write endpoint.
 * `RATE_LIMIT_SUBMISSIONS_MAX` per `RATE_LIMIT_SUBMISSIONS_WINDOW_MS`,
 * 20/minute out of the box. */
export function resolveSubmissionsRateLimit(env: NodeJS.ProcessEnv = process.env): RouteRateLimitOptions {
  return {
    max: resolvePositiveIntEnv("RATE_LIMIT_SUBMISSIONS_MAX", 20, env),
    timeWindow: resolvePositiveIntEnv("RATE_LIMIT_SUBMISSIONS_WINDOW_MS", ONE_MINUTE_MS, env),
  };
}
