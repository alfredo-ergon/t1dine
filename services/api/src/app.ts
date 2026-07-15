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
import { healthRoutes } from "./modules/health.js";
import { catalogRoutes } from "./modules/catalog.js";
import { adminRoutes, resolveAdminEmails } from "./modules/admin.js";
import { mealsRoutes } from "./modules/meals.js";
import { nightscoutRoutes, type NightscoutDeps } from "./modules/nightscout.js";
import { authRoutes, resolveAuthSecret } from "./modules/auth.js";
import { syncRoutes } from "./modules/sync.js";
import { CATALOG } from "./catalog.js";
import { InMemoryMealRepository } from "./repositories/inMemoryMealRepository.js";
import type { MealRepository } from "./repositories/mealRepository.js";
import { InMemoryUserRepository } from "./repositories/inMemoryUserRepository.js";
import type { UserRepository } from "./repositories/userRepository.js";
import { InMemoryUserDataRepository } from "./repositories/inMemoryUserDataRepository.js";
import type { UserDataRepository } from "./repositories/userDataRepository.js";
import { InMemoryFoodRepository } from "./repositories/inMemoryFoodRepository.js";
import type { FoodRepository } from "./repositories/foodRepository.js";
import type { FoodAiProvider } from "./foodAi.js";

export interface BuildAppOptions {
  /** Injectable fetch/clock for the read-only Nightscout module — lets tests
   * exercise it deterministically and fully offline. Defaults to real
   * `fetch`/`Date.now` when omitted, so existing callers are unaffected. */
  nightscout?: NightscoutDeps;
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
  /** Injectable AI food-generation provider for `POST
   * /admin/foods/ai-generate` (see `./modules/admin.ts` / `./foodAi.ts`).
   * Defaults to whatever `adminRoutes` itself defaults to (the fully
   * offline, deterministic `MockFoodAiProvider`) when omitted, so existing
   * callers/tests are unaffected. `src/server.ts` injects the real
   * `AnthropicFoodAiProvider` (see `./anthropicFoodAi.ts`) here when
   * `ANTHROPIC_API_KEY` is configured. */
  aiProvider?: FoodAiProvider;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false });

  void app.register(cors);

  const mealRepository = options.mealRepository ?? new InMemoryMealRepository();
  const userRepository = options.userRepository ?? new InMemoryUserRepository();
  const userDataRepository = options.userDataRepository ?? new InMemoryUserDataRepository();
  const foodRepository = options.foodRepository ?? new InMemoryFoodRepository(CATALOG);
  const authSecret = options.authSecret ?? resolveAuthSecret();
  const adminEmails = options.adminEmails ?? resolveAdminEmails();

  void app.register(healthRoutes);
  void app.register(catalogRoutes({ foodRepository, secret: authSecret }));
  void app.register(
    adminRoutes({
      foodRepository,
      userRepository,
      secret: authSecret,
      adminEmails,
      ...(options.aiProvider ? { aiProvider: options.aiProvider } : {}),
    }),
  );
  void app.register(mealsRoutes(mealRepository));
  void app.register(nightscoutRoutes(options.nightscout ?? {}));
  void app.register(authRoutes({ repository: userRepository, secret: authSecret }));
  void app.register(syncRoutes({ repository: userDataRepository, secret: authSecret }));

  return app;
}
