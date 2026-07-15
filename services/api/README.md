# Core API

Initial modular monolith. Long-term scope: profile, food catalogue, meal and recipe, custom food, sync, integration, export/deletion, and audit. Use explicit versioned contracts and idempotency.

## Meal persistence (current)

Meal storage sits behind a `MealRepository` PORT
(`src/repositories/mealRepository.ts`), with two adapters:

- `InMemoryMealRepository` (`src/repositories/inMemoryMealRepository.ts`) — the
  **default**. Keeps meals in a per-instance `Map`, keyed by a deterministic,
  monotonically increasing id (`meal-1`, `meal-2`, ...; never
  `Math.random()`/`Date.now()` for the id). `buildApp()` creates a fresh one
  automatically whenever no `mealRepository` is injected, so all existing
  tests and callers are unaffected.
- `PostgresMealRepository` (`src/repositories/postgresMealRepository.ts`) —
  backed by a `pg` `Pool`. Stores each meal summary as `jsonb` in a `meals`
  table (`id text PRIMARY KEY, created_at timestamptz, summary jsonb`), with
  ids assigned by a Postgres sequence (`meals_id_seq`) — again, never
  app-side `Math.random()`/`Date.now()`. Its `migrate()` method idempotently
  creates the sequence, table, and a supporting index (`CREATE ... IF NOT
  EXISTS`), safe to call on every startup.

### `DATABASE_URL` behaviour

`src/server.ts` decides which adapter to use at process startup:

- **`DATABASE_URL` unset** — uses `InMemoryMealRepository`. This is the
  default for local development and for the whole Vitest suite (which never
  opens a network connection or requires a database).
- **`DATABASE_URL` set** — connects with a `pg` `Pool`, runs
  `PostgresMealRepository.migrate()`, and uses Postgres for all meal
  persistence. Example (matches `docker-compose.yml`):
  ```
  DATABASE_URL=postgresql://t1dine:local-only-change-me@localhost:5432/t1dine
  ```
- **`DATABASE_URL` set but the connection or migration fails** (unreachable
  host, bad credentials, permissions, ...) — the server logs a short,
  non-sensitive message (never the connection string, never the raw error,
  since some pg connection errors embed credentials in their message) and
  **falls back to `InMemoryMealRepository`** rather than crashing. The API
  process always comes up.

Route contracts are identical regardless of which adapter is active:
`POST /meals` returns `{ id, summary }` and `GET /meals/:id` returns
`{ id, summary }` or `404` — callers cannot observe which adapter is in use.

Meal summaries can contain food names. Per CLAUDE.md's health-data rule,
neither adapter nor `src/server.ts` ever logs a summary, a query parameter
value, or `DATABASE_URL`; the app-wide `Fastify({ logger: false })` setting
is unchanged.

## Accounts + user-scoped cloud sync (current)

A minimal but real accounts + sync foundation (the "accounts" half of Slice 5). See
[Endpoints](#endpoints) for the request/response shapes.

### Auth (`src/modules/auth.ts`)

- `users (id text pk, email text unique not null, password_hash text not null, salt text not null, created_at timestamptz default now())`.
  Email is case-normalised (trimmed + lower-cased) before storage/lookup, so `A@B.com` and
  `a@b.com` resolve to the same account.
- **Password hashing.** Passwords are hashed with Node's built-in `crypto.scrypt`, salted with a
  per-user random salt (`crypto.randomBytes(16)`, hex-encoded) — a plaintext password is never
  stored and never logged. Verification re-derives the hash from the supplied password and the
  stored salt, then compares with `crypto.timingSafeEqual` (constant-time — a mismatch never
  leaks *where* the hash differs).
- **Login never reveals whether an email is registered.** An unknown email and a wrong password
  both return the same generic `401 invalid_credentials`. To close the obvious timing
  side-channel (an unknown email would otherwise skip the expensive scrypt call entirely), a
  login attempt against an unregistered email still runs a dummy scrypt computation of the same
  cost before responding.
- **Token.** A stateless, signed bearer token: HMAC-SHA256 over `${userId}.${issuedAt}`, keyed by
  a server secret. There is no server-side session store — `requireAuth` verifies the signature
  and trusts the embedded `userId`; it never queries the database. The secret comes from
  `AUTH_SECRET`, or a fixed, clearly-insecure development fallback with a one-line startup
  warning when unset — **set `AUTH_SECRET` before deploying**.
- `requireAuth(secret)` is a Fastify preHandler factory that reads `Authorization: Bearer
  <token>`, verifies it, and sets `request.userId`; on anything missing, malformed, or
  wrongly-signed it fails closed with `401` without revealing why.
- `UserRepository` PORT (`src/repositories/userRepository.ts`) — `InMemoryUserRepository` (the
  default) and `PostgresUserRepository` (used when `DATABASE_URL` is set), following the exact
  same ports-and-adapters shape as `MealRepository`. Ids are assigned deterministically
  (`user-1`, `user-2`, ... in-memory; a Postgres sequence otherwise) — never
  `Math.random()`/`Date.now()`.

### Sync (`src/modules/sync.ts`)

- `user_data (user_id text pk references users(id), state jsonb not null, version bigint not null default 0, updated_at timestamptz default now())`.
- Every route requires `requireAuth` and is **strictly scoped to `request.userId`** — there is no
  path in this module that accepts a caller-supplied user id, so a user can only ever read or
  write their own row.
- Every `customFoods` entry is re-validated at this API boundary with
  `collectCanonicalFoodErrors` from `@t1dine/food-schema` (CLAUDE.md: "all external data is
  untrusted; validate at boundaries") — an invalid entry rejects the whole request with `400`
  and none of it is persisted.
- **Optimistic concurrency.** A client supplies the `version` it last observed as `baseVersion`.
  If it matches the currently stored version (or is omitted), the write succeeds and the version
  is bumped. If it does not match, nothing is written — the response is `409` with the CURRENT,
  unchanged snapshot, so the caller can reconcile explicitly. Conflicting states are never
  silently merged or averaged (CLAUDE.md's food-data rule extended to sync state).
- `UserDataRepository` PORT (`src/repositories/userDataRepository.ts`) — `InMemoryUserDataRepository`
  (the default) and `PostgresUserDataRepository` (used when `DATABASE_URL` is set). The Postgres
  adapter runs the read-check-write sequence inside a single `SELECT ... FOR UPDATE` transaction
  so a concurrent writer for the SAME user can never race past the `baseVersion` check.

### `DATABASE_URL` behaviour for accounts + sync

`src/server.ts` resolves meal, user, and sync-state persistence together, via a SINGLE shared `pg`
`Pool` when `DATABASE_URL` is set (not three separate pools):

- **`DATABASE_URL` unset** — all three use their in-memory adapter.
- **`DATABASE_URL` set** — one `Pool` is created and each adapter's idempotent `migrate()` runs in
  dependency order: meals, then users, then `user_data` (which has a foreign key on `users(id)`
  and therefore must migrate last).
- **Any connection or migration step fails** — the server logs a short, non-sensitive message
  (never the connection string, never the raw error) and falls back to in-memory **for all
  three** adapters. A partial fallback (e.g. meals on Postgres but accounts in-memory) would
  silently break the `user_data` → `users` foreign key contract, so this is deliberately
  all-or-nothing.

## Slice 6 — Nightscout read-only glucose display (current)

A read-only Nightscout integration for glucose *display* only. See
[Endpoints](#endpoints) for the request/response shape and
[Nightscout integration guarantees](#nightscout-integration-guarantees) for
the safety contract.

## Slice 5 foundation

A Fastify (TypeScript, ESM) API serving the food catalog and meal assembly. All external input
is validated with zod at the boundary; all data is synthetic and non-clinical. Meal persistence
goes through a repository PORT (see [Meal persistence](#meal-persistence-current) above) —
in-memory by default, Postgres when `DATABASE_URL` is set.

### Layout

- `src/catalog.ts` — synthetic Portugal food catalog (`CATALOG: CanonicalFood[]`) and
  `searchCatalog(query?, market?)`, an accent-insensitive search over localised names and
  synonyms. Every record is validated with `collectCanonicalFoodErrors` at module load; an
  invalid record throws immediately instead of shipping bad data.
- `src/modules/health.ts` — liveness probe only. Carries no health, clinical, or user data.
- `src/modules/catalog.ts` — read-only catalog routes.
- `src/modules/meals.ts` — meal assembly routes; resolves catalog foods, summarises nutrition
  via `@t1dine/nutrition`, and persists through the injected `MealRepository` (see
  [Meal persistence](#meal-persistence-current) above). The module itself never knows which
  adapter is backing it.
- `src/repositories/mealRepository.ts` — the `MealRepository` port and `StoredMeal` type.
- `src/repositories/inMemoryMealRepository.ts` — default adapter (in-process `Map`,
  deterministic sequential ids).
- `src/repositories/postgresMealRepository.ts` — Postgres adapter (`pg` `Pool`, `jsonb` summary
  column, sequence-assigned ids, idempotent `migrate()`).
- `src/modules/nightscout.ts` — **read-only** glucose display integration. See
  [Nightscout integration guarantees](#nightscout-integration-guarantees) below.
- `src/modules/auth.ts` — `/auth/register`, `/auth/login`, `signToken`/`verifyToken`,
  `resolveAuthSecret`, and the `requireAuth` preHandler. See
  [Accounts + user-scoped cloud sync](#accounts--user-scoped-cloud-sync-current) above.
- `src/modules/sync.ts` — `/sync/state` (`GET`/`PUT`), strictly scoped to `request.userId`. See
  [Accounts + user-scoped cloud sync](#accounts--user-scoped-cloud-sync-current) above.
- `src/repositories/userRepository.ts` / `inMemoryUserRepository.ts` / `postgresUserRepository.ts`
  — the `UserRepository` port and its two adapters (same ports-and-adapters shape as
  `MealRepository`).
- `src/repositories/userDataRepository.ts` / `inMemoryUserDataRepository.ts` /
  `postgresUserDataRepository.ts` — the `UserDataRepository` port and its two adapters.
- `src/app.ts` — `buildApp(options?)` builds and registers the Fastify instance (with
  `@fastify/cors`) but never calls `.listen`, so tests drive it with Fastify's built-in
  `inject`. `options.nightscout` optionally injects `{ fetchImpl, now }` for the Nightscout
  module (both default to the real `fetch`/`Date.now` when omitted, so existing callers of
  `buildApp()` are unaffected). `options.mealRepository`, `options.userRepository`, and
  `options.userDataRepository` optionally inject their respective repository PORTs (each
  defaults to a fresh in-memory adapter, so existing callers of `buildApp()` are unaffected).
  `options.authSecret` optionally injects a fixed HMAC secret for deterministic tests (defaults
  to `resolveAuthSecret()`).
- `src/server.ts` — process entry point; resolves the meal, user, and sync-state repositories
  together (in-memory, or Postgres when `DATABASE_URL` is set — with an automatic in-memory
  fallback on any connection/migration failure, see
  [`DATABASE_URL` behaviour for accounts + sync](#databaseurl-behaviour-for-accounts--sync)
  above), then binds `buildApp()` to `process.env.PORT ?? 3001` on `0.0.0.0`. Logs only the bind
  address and short, non-sensitive startup status — never health, clinical, or user data, and
  never a connection string.

### Endpoints

| Method | Path                                      | Notes                                                              |
| ------ | ----------------------------------------- | ------------------------------------------------------------------- |
| GET    | `/health`                                 | Liveness probe: `{ status, service, time }`.                        |
| GET    | `/catalog/foods`                          | Query `q?`, `market?` (zod-validated). Returns matches + provenance. |
| GET    | `/catalog/foods/:id`                      | Returns one food by id, or 404.                                      |
| POST   | `/meals`                                  | Body `{ lines: { foodId, amount }[] }` (zod-validated). Resolves foods from the catalog, computes a summary via `summariseMeal`, stores it, and returns `{ id, summary }`. 400 on an unknown `foodId` or an invalid `amount`. |
| GET    | `/meals/:id`                              | Returns a previously stored meal, or 404.                            |
| POST   | `/integrations/nightscout/glucose`        | **Read-only.** See below.                                            |
| POST   | `/auth/register`                          | Body `{ email, password }` (zod-validated). Creates an account, returns `{ token }` (201). 409 if the email is already registered, 400 on an invalid email/short password. |
| POST   | `/auth/login`                             | Body `{ email, password }`. Returns `{ token }` (200) on success, or a generic `401 invalid_credentials` — identical whether the email is unknown or the password is wrong. |
| GET    | `/sync/state`                             | **Requires `Authorization: Bearer <token>`.** Returns `{ state: { favourites, customFoods }, version, updatedAt }` for the authenticated user (the empty default when they have never synced). |
| PUT    | `/sync/state`                             | **Requires `Authorization: Bearer <token>`.** Body `{ state: { favourites, customFoods }, baseVersion? }` (zod- and canonical-food-validated). Returns `{ version, updatedAt }` (200) on success, or `409` with the current, unchanged snapshot on a stale `baseVersion`. 400 on an invalid body or an invalid `customFoods` entry. |

#### `POST /auth/register` / `POST /auth/login`

Body (both endpoints):

```ts
{
  email: string;    // must be a valid email address
  password: string; // minimum 8 characters
}
```

`POST /auth/register` response `201`: `{ token: string }`. `409 email_taken` if the (case-insensitive) email is already registered. `400 invalid_body` on a malformed email or a too-short password.

`POST /auth/login` response `200`: `{ token: string }`. `401 invalid_credentials` on any failure — an unregistered email and a wrong password are indistinguishable to the caller, both in the response body and (approximately) in response timing (see
[Accounts + user-scoped cloud sync](#accounts--user-scoped-cloud-sync-current) above for the password-hashing and timing-side-channel details).

The returned `token` is a stateless, signed bearer token. Send it as `Authorization: Bearer <token>` on any request to a `requireAuth`-protected route (currently `/sync/state`).

#### `GET /sync/state` / `PUT /sync/state`

Both require `Authorization: Bearer <token>` from a prior `/auth/register` or `/auth/login` call; a missing, malformed, or invalid token returns `401` without revealing why. Every read/write is scoped strictly to the authenticated user — there is no way to address another user's data.

`GET /sync/state` response `200`:

```ts
{
  state: {
    favourites: string[];         // food ids
    customFoods: CanonicalFood[]; // user-authored foods, canonical-food-schema shaped
  };
  version: number;        // 0 when the user has never synced
  updatedAt: string | null; // ISO-8601, or null when the user has never synced
}
```

`PUT /sync/state` body:

```ts
{
  state: {
    favourites: string[];
    customFoods: CanonicalFood[]; // each re-validated with collectCanonicalFoodErrors
  };
  baseVersion?: number; // the version this client last observed, for optimistic concurrency
}
```

`PUT /sync/state` response `200` on success: `{ version: number, updatedAt: string }` (the newly stored version). Response `409` on a stale `baseVersion` (does not match the currently stored version): the CURRENT, unchanged `{ state, version, updatedAt }` — the write is rejected outright, never silently merged. Response `400 invalid_body` on a malformed body, or `400 invalid_custom_food` (with an `issues` array) when any `customFoods` entry fails `collectCanonicalFoodErrors`.

#### `POST /integrations/nightscout/glucose`

Body (all fields optional, zod-validated):

```ts
{
  url?: string;              // Nightscout base URL, e.g. "https://mysite.example.com"
  token?: string;            // Nightscout read-only access token
  count?: number;            // 1–288 (default 12) — how many recent SGV entries to request
  mock?: boolean;            // force mock mode for this request
  staleAfterMinutes?: number; // 1–1440 (default 15) — freshness threshold
}
```

`url` is required unless `mock: true` is set or the server has `NIGHTSCOUT_MODE=mock` in its
environment. An out-of-range `count` (outside 1–288) or a malformed `url` is rejected with
`400` before any request is attempted.

Response `200`:

```ts
{
  source: "live" | "mock";
  readings: Array<{
    sgv: number;        // raw sensor-glucose value, mg/dL
    mgdl: number;        // same value, explicitly labelled
    mmol: number;         // derived, rounded to 1 decimal place
    direction?: string;   // Nightscout trend arrow name, when present upstream
    date: number;          // epoch ms
    iso: string;           // ISO-8601 rendering of `date`
    ageMinutes: number;    // age relative to the request-time clock
    stale: boolean;        // true if older than staleAfterMinutes, or has an impossible future date
  }>;
  newest: (typeof readings)[number] | null; // most recent NON-stale reading, or null
  allStale: boolean;       // true when there is no fresh reading (empty list counts as all-stale)
}
```

On an unreachable Nightscout site, a non-2xx upstream response, or a payload that fails zod
validation, the endpoint returns `502` with a short, redacted, non-sensitive `message` — it
never fabricates a reading and never echoes the request URL, token, or raw upstream body.

### Nightscout integration guarantees

This is a **safety-sensitive, deliberately read-only** integration (Slice 6). It exists purely
to *display* glucose; it has no connection to dosing.

- **Read-only.** The module only ever issues `GET {url}/api/v1/entries/sgv.json?count=N`
  requests. It never writes to a Nightscout site.
- **Token handling.** The Nightscout token is treated as a high-impact credential: it is used
  only to build the outgoing request URL (sent as Nightscout's own read-only `token` query
  parameter) and is never logged, never included in an error message, and never present in any
  API response — even on failure paths (unreachable site, non-2xx status, malformed payload).
  See `services/api/test/nightscout.test.ts` for tests asserting this on every code path.
- **Untrusted upstream data.** Every Nightscout response is parsed and validated with zod
  before use. Unknown/extra upstream fields (`_id`, `device`, `trend`, ...) are silently
  stripped by zod's default object behaviour, so they can never leak into the response.
- **Fail closed.** Malformed or unreachable upstream data returns `502` rather than a guessed
  or fabricated reading. A reading older than `staleAfterMinutes` (default 15) — or with an
  impossible future timestamp — is flagged `stale` and is never selected as `newest`; when
  every reading is stale (or the list is empty), `newest` is `null` and `allStale` is `true`
  so a caller cannot accidentally present old data as current.
- **No dose-engine connection.** This module does not import `@t1dine/dose-engine` or
  `@t1dine/nutrition`, and computes nothing dose-related — it only fetches and normalises
  glucose readings for display. `pnpm boundaries` enforces the import-graph side of this.
- **No health data in logs.** The app-wide Fastify logger is disabled (`Fastify({ logger:
  false })`); this module additionally never calls `console.*` with a token, glucose value, or
  request URL.
- **Mock mode (fully offline).** Set `mock: true` in the request body, or run the server with
  `NIGHTSCOUT_MODE=mock`, to get deterministic synthetic SGV readings with no network access
  and no real Nightscout site required. Values are derived from a fixed periodic function of
  the reading index (never `Math.random`, never a fresh `Date.now()` read), and "now" comes
  from the same injectable clock used by live mode, so mock output is fully reproducible.

### Development

```
pnpm --filter=@t1dine/api dev      # tsx watch
pnpm --filter=@t1dine/api start    # tsx (single run)
pnpm --filter=@t1dine/api exec tsc --noEmit
pnpm exec vitest run services/api

# Try the Nightscout endpoint fully offline:
# curl -X POST http://localhost:3001/integrations/nightscout/glucose -H "content-type: application/json" -d "{\"mock\": true}"
```

Set `AUTH_SECRET` (any non-empty string) before deploying — without it, the server falls back to
a fixed, clearly-insecure development secret and prints a one-line startup warning. The Vitest
suite never depends on `AUTH_SECRET`; every test either injects a fixed `authSecret` via
`buildApp({ authSecret })` or accepts the (harmless, in-memory-only) dev fallback.
