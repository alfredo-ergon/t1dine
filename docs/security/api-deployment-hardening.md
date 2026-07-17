# T1Dine API — Deployment Hardening

Scope: `services/api` only. This documents what a public deployment of the
T1Dine Core API must set, and why, following the security review that
produced the fail-closed changes in `src/prodGate.ts`, `src/bootstrap.ts`,
`src/cors.ts`, `src/rateLimit.ts`, `src/ssrfGuard.ts`, and `src/errorHandler.ts`.

## The production gate

Every rule below is keyed off a single flag: `NODE_ENV=production`. In any
other value (including unset), the service keeps today's dev behaviour —
insecure fallbacks with a one-line warning, so local development and CI
never need extra setup. Set `NODE_ENV=production` ONLY on a real deployment.

## MUST-set environment variables in production

| Variable | Requirement | Why |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enables every fail-closed behaviour below. |
| `AUTH_SECRET` | A long, random, unique value (e.g. `openssl rand -hex 32`) | Signs/verifies every bearer token (`src/modules/auth.ts`). If unset or left as the built-in dev fallback, the process refuses to boot. |
| `SETTINGS_SECRET` | A long, random, unique value, different from `AUTH_SECRET` | Encrypts the admin-managed AI provider API key at rest (`src/aiConfigCrypto.ts`). Same fail-closed rule as `AUTH_SECRET`. |
| `ADMIN_PASSWORD` | A strong password, not the literal dev default | Password for the auto-seeded demo admin account (`src/bootstrap.ts`). If unset or left as the default, the process refuses to boot, and — as defence in depth — the demo admin is never seeded even if that check is somehow bypassed. Rotate it (or disable the demo-admin seed entirely, once a real admin-provisioning flow exists) after first login. |
| `ADMIN_EMAILS` | Comma-separated list of real admin email addresses | Controls who can pass `requireAdmin` for the food review queue and AI config (`src/modules/admin.ts`). The built-in default (`admin@t1dine.local`) is a dev convenience, not a real account. |
| `CORS_ORIGINS` | Comma-separated list of the exact web origins allowed to call this API from a browser (e.g. `https://app.t1dine.example`) | In production, only these origins are reflected in `Access-Control-Allow-Origin` (`src/cors.ts`). Leaving it unset means every browser origin is rejected — native mobile clients are unaffected, since they send no `Origin` header. |

Also required, but not env-controlled by this service:

- `DATABASE_URL` — a reachable Postgres connection string. If set but the
  connection/migration fails at startup, production EXITS rather than
  silently falling back to in-memory storage (`src/bootstrap.ts`,
  `resolveRepositories`) — an in-memory fallback in production would mean
  every account, meal, and submission vanishes on the next restart with no
  operator visibility.

## TLS — served over HTTPS only

This service (`services/api`) does not terminate TLS itself — it listens
on plain HTTP (`src/server.ts`). **The deployment's reverse proxy / load
balancer / hosting platform MUST terminate TLS and refuse plaintext HTTP**
before any request reaches this process. Concretely:

- Only expose an `https://` origin to the public internet; do not expose the
  process's own HTTP port directly.
- Redirect (or simply refuse) any plaintext `http://` request at the edge.
- Bearer tokens (`Authorization: Bearer ...`), the Nightscout token, and
  account credentials all travel in request bodies/headers with no
  additional transport-level protection from the app itself — TLS is the
  only thing standing between them and a network eavesdropper.

## Optional, env-tunable rate limits

A global default (120 requests/minute per IP) plus tighter per-route limits
are always active outside `NODE_ENV=test` (see `src/rateLimit.ts`); every
figure is overridable via env if the defaults do not suit a deployment:

| Env var | Default | Route |
| --- | --- | --- |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | 120 / 60000 | global |
| `RATE_LIMIT_AUTH_MAX` / `RATE_LIMIT_AUTH_WINDOW_MS` | 10 / 60000 | `POST /auth/login`, `POST /auth/register` |
| `RATE_LIMIT_NIGHTSCOUT_MAX` / `RATE_LIMIT_NIGHTSCOUT_WINDOW_MS` | 30 / 60000 | `POST /integrations/nightscout/glucose` |
| `RATE_LIMIT_OFF_LOOKUP_MAX` / `RATE_LIMIT_OFF_LOOKUP_WINDOW_MS` | 30 / 60000 | `GET /catalog/off-lookup` |
| `RATE_LIMIT_SUBMISSIONS_MAX` / `RATE_LIMIT_SUBMISSIONS_WINDOW_MS` | 20 / 60000 | `POST /catalog/submissions` |

## Other tunables

- `AUTH_TOKEN_MAX_AGE_MS` — max age of a bearer token before `verifyToken`
  rejects it (`src/modules/auth.ts`). Default 30 days. There is no
  server-side session store, so this is the only expiry a leaked token has.
- `PORT` — the port this process listens on (default `3001`). The reverse
  proxy referenced above should be the only thing that talks to it directly.

## Summary checklist before exposing this API on a public URL

- [ ] `NODE_ENV=production`
- [ ] `AUTH_SECRET` set to a strong, unique value
- [ ] `SETTINGS_SECRET` set to a strong, unique value (different from `AUTH_SECRET`)
- [ ] `ADMIN_PASSWORD` set to a strong, non-default value
- [ ] `ADMIN_EMAILS` set to real admin addresses
- [ ] `CORS_ORIGINS` set to the exact web origin(s) that call this API
- [ ] `DATABASE_URL` set and reachable (if persistent storage is required)
- [ ] TLS terminated at the edge; plaintext HTTP not publicly reachable
