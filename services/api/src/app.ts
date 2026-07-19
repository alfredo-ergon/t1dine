// Fastify application factory for the T1Dine Core API — a modular monolith
// serving the food catalog, meal assembly, accounts, and user-scoped cloud
// sync. Persistence goes through repository PORTs (`./repositories/*.ts`);
// by default `buildApp()` uses the in-memory adapters, so behaviour is
// unchanged unless a caller injects different repositories (see
// `src/server.ts`, which injects the Postgres adapters when `DATABASE_URL`
// is set). Deliberately does not call `.listen`, so tests can drive the app
// with Fastify's built-in `inject` instead of opening a real socket.

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { registerCompression } from "./compression.js";
import { healthRoutes } from "./modules/health.js";
import { catalogRoutes } from "./modules/catalog.js";
import { adminRoutes, resolveAdminEmails } from "./modules/admin.js";
import { aiConfigRoutes } from "./modules/aiConfigAdmin.js";
import { mealsRoutes } from "./modules/meals.js";
import { nightscoutRoutes, type NightscoutTestOverrides } from "./modules/nightscout.js";
import { authRoutes, resolveAuthSecret } from "./modules/auth.js";
import { syncRoutes } from "./modules/sync.js";
import { resolveCorsOptions } from "./cors.js";
import { isRateLimitingEnabled, resolveGlobalRateLimit } from "./rateLimit.js";
import { genericErrorHandler } from "./errorHandler.js";
import { CATALOG } from "./catalog.js";
import { InMemoryMealRepository } from "./repositories/inMemoryMealRepository.js";
import type { MealRepository } from "./repositories/mealRepository.js";
import { InMemoryUserRepository } from "./repositories/inMemoryUserRepository.js";
import type { UserRepository } from "./repositories/userRepository.js";
import { InMemoryUserDataRepository } from "./repositories/inMemoryUserDataRepository.js";
import type { UserDataRepository } from "./repositories/userDataRepository.js";
import { InMemoryFoodRepository } from "./repositories/inMemoryFoodRepository.js";
import type { FoodRepository } from "./repositories/foodRepository.js";
import { InMemorySettingsRepository } from "./repositories/inMemorySettingsRepository.js";
import type { SettingsRepository } from "./repositories/settingsRepository.js";
import type { FoodAiProvider } from "./foodAi.js";
import type { ResolveAiProviderDeps } from "./aiProviderResolution.js";

export interface BuildAppOptions {
  /** Injectable fetch/clock/DNS-resolver overrides for the read-only
   * Nightscout module — lets tests exercise it deterministically and fully
   * offline. Defaults to real `fetch`/`Date.now`/DNS resolution when
   * omitted, so existing callers are unaffected. The route is
   * account-optional (no bearer token required — see `NightscoutDeps` in
   * `./modules/nightscout.ts`); its live path is protected by the SSRF guard
   * plus rate limiting, not by an account. */
  nightscout?: NightscoutTestOverrides;
  /** Injectable meal persistence PORT. Defaults to a fresh
   * `InMemoryMealRepository` per app instance — the same deterministic
   * `meal-1`, `meal-2`, ... id behaviour the old in-process `Map` provided —
   * so existing callers and tests are unaffected. Inject a
   * `PostgresMealRepository` (see `./repositories/postgresMealRepository.ts`)
   * to persist meals in a real database. */
  mealRepository?: MealRepository;
  /** Injectable user-account persistence PORT. Defaults to a fresh
   * `InMemoryUserRepository` per app instance. Inject a
   * `PostgresUserRepository` (see `./repositories/postgresUserRepository.ts`)
   * to persist accounts in a real database. */
  userRepository?: UserRepository;
  /** Injectable per-user sync-state persistence PORT. Defaults to a fresh
   * `InMemoryUserDataRepository` per app instance. Inject a
   * `PostgresUserDataRepository` (see
   * `./repositories/postgresUserDataRepository.ts`) to persist sync state in
   * a real database. */
  userDataRepository?: UserDataRepository;
  /** Injectable food-catalog persistence PORT. Defaults to a fresh
   * `InMemoryFoodRepository`, synchronously pre-seeded (at construction —
   * see that class' doc comment) with the synthetic seed catalog from
   * `./catalog.ts` (status `approved`, source `seed`). Inject a
   * `PostgresFoodRepository` (see `./repositories/postgresFoodRepository.ts`)
   * to persist the catalog in a real database. */
  foodRepository?: FoodRepository;
  /** Injectable admin-settings persistence PORT (currently just the AI
   * config — see `./modules/aiConfigAdmin.ts`). Defaults to a fresh
   * `InMemorySettingsRepository` per app instance. Inject a
   * `PostgresSettingsRepository` (see
   * `./repositories/postgresSettingsRepository.ts`) to persist settings in a
   * real database. Shared by both `aiConfigRoutes` (writes) and
   * `adminRoutes` (reads, per AI-generate request) so a config change is
   * visible immediately. */
  settingsRepository?: SettingsRepository;
  /** Injectable HMAC secret used to sign/verify bearer tokens. Defaults to
   * `resolveAuthSecret()` (the `AUTH_SECRET` env var, or a fixed, clearly
   * insecure dev fallback with a one-line startup warning). Tests may inject
   * a fixed value for determinism; this never affects any other module. */
  authSecret?: string;
  /** Injectable admin-email allowlist for `requireAdmin` (see
   * `./modules/admin.ts`). Defaults to `resolveAdminEmails()` (the
   * `ADMIN_EMAILS` env var, comma-separated, or a single fixed dev default).
   * Tests may inject a fixed list for determinism. */
  adminEmails?: string[];
  /** Fixed AI-provider override for `POST /admin/foods/ai-generate` (see
   * `./modules/admin.ts` / `./foodAi.ts`) — bypasses the normal per-request
   * `resolveEffectiveAiProvider` resolution entirely when supplied. Test
   * seam only; omitted by `src/server.ts`, which relies on the admin
   * config / `ANTHROPIC_API_KEY` / mock precedence instead. */
  aiProvider?: FoodAiProvider;
  /** Additional dependencies threaded into `resolveEffectiveAiProvider` on
   * every AI-generate request (see `./aiProviderResolution.ts`) — e.g. a
   * fake `createAnthropicProvider`/`envApiKey` for fully offline tests.
   * Ignored when `aiProvider` is supplied. */
  aiProviderResolutionDeps?: ResolveAiProviderDeps;
  /** Injectable fetch adapter for `GET /catalog/off-lookup` (see
   * `./openFoodFacts.ts` / `./modules/catalog.ts`) — lets tests exercise the
   * Open Food Facts barcode lookup fully offline. Defaults to real global
   * `fetch`. */
  offFetchImpl?: typeof fetch;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false });

  // Response compression (gzip/deflate). The full food catalog
  // (`GET /catalog/foods`) is a ~32 MB JSON payload (≈1500 foods × ~48
  // nutrients each) which the offline-first mobile/web client downloads once
  // at startup to search it fully client-side. Uncompressed, that download
  // exceeds the client's catalog-load timeout on typical connections and the
  // app silently falls back to its tiny bundled offline catalog. Gzip shrinks
  // the JSON by ~10×, so the real catalog actually loads. Implemented with
  // Node's built-in `zlib` (no new dependency — keeps the Docker build's
  // `--frozen-lockfile` valid) via an `onSend` hook — see `./compression.ts`.
  registerCompression(app);

  // CORS allowlist (security review M2): permissive in dev/test (unchanged
  // from before this hardening pass), an env-driven allowlist in prod — see
  // `./cors.ts`.
  void app.register(cors, resolveCorsOptions());

  // Global rate limiting (security review H2/M3): skipped entirely under
  // test (`NODE_ENV === "test"`, set by vitest by default) so the existing,
  // fast-repeating `app.inject()` suites never flake — see `./rateLimit.ts`.
  // Per-route tighter overrides (auth, Nightscout, off-lookup, submissions)
  // are configured directly on those routes and are inert no-ops whenever
  // this plugin is not registered.
  if (isRateLimitingEnabled()) {
    void app.register(rateLimit, resolveGlobalRateLimit());
  }

  // Generic fallback error handler (security review L1): never echoes an
  // uncaught error's message back to the caller — see `./errorHandler.ts`.
  // Every existing typed 4xx response in this codebase replies directly
  // rather than throwing, so this never affects those.
  app.setErrorHandler(genericErrorHandler);

  const mealRepository = options.mealRepository ?? new InMemoryMealRepository();
  const userRepository = options.userRepository ?? new InMemoryUserRepository();
  const userDataRepository = options.userDataRepository ?? new InMemoryUserDataRepository();
  const foodRepository = options.foodRepository ?? new InMemoryFoodRepository(CATALOG);
  const settingsRepository = options.settingsRepository ?? new InMemorySettingsRepository();
  const authSecret = options.authSecret ?? resolveAuthSecret();
  const adminEmails = options.adminEmails ?? resolveAdminEmails();

  void app.register(healthRoutes);
  void app.register(
    catalogRoutes({
      foodRepository,
      secret: authSecret,
      ...(options.offFetchImpl ? { offFetchImpl: options.offFetchImpl } : {}),
    }),
  );
  void app.register(
    aiConfigRoutes({
      settingsRepository,
      userRepository,
      secret: authSecret,
      adminEmails,
    }),
  );
  void app.register(
    adminRoutes({
      foodRepository,
      userRepository,
      secret: authSecret,
      adminEmails,
      settingsRepository,
      ...(options.aiProvider ? { aiProvider: options.aiProvider } : {}),
      ...(options.aiProviderResolutionDeps ? { aiProviderResolutionDeps: options.aiProviderResolutionDeps } : {}),
    }),
  );
  void app.register(mealsRoutes({ repository: mealRepository, secret: authSecret }));
  void app.register(nightscoutRoutes({ ...(options.nightscout ?? {}) }));
  void app.register(authRoutes({ repository: userRepository, secret: authSecret }));
  void app.register(syncRoutes({ repository: userDataRepository, secret: authSecret }));

  return app;
}
