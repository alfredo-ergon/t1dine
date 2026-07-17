// Boot-time wiring: resolves the meal/user/sync/food/settings persistence
// adapters and seeds a demo admin account. Split out of `src/server.ts`
// (which also opens a real network socket — see that file's header) purely
// so this logic, INCLUDING the prod fail-closed paths added by the security
// review (M5 database fallback, C3 demo-admin seeding), is importable and
// unit-testable without triggering `server.ts`'s top-level `void main()`.

import pg from "pg";
const { Pool } = pg;
import { CATALOG } from "./catalog.js";
import { hashPassword } from "./modules/auth.js";
import { DEFAULT_ADMIN_PASSWORD, isProd } from "./prodGate.js";
import { InMemoryMealRepository } from "./repositories/inMemoryMealRepository.js";
import { PostgresMealRepository } from "./repositories/postgresMealRepository.js";
import type { MealRepository } from "./repositories/mealRepository.js";
import { InMemoryUserRepository } from "./repositories/inMemoryUserRepository.js";
import { PostgresUserRepository } from "./repositories/postgresUserRepository.js";
import { UserEmailTakenError } from "./repositories/userRepository.js";
import type { UserRepository } from "./repositories/userRepository.js";
import { InMemoryUserDataRepository } from "./repositories/inMemoryUserDataRepository.js";
import { PostgresUserDataRepository } from "./repositories/postgresUserDataRepository.js";
import type { UserDataRepository } from "./repositories/userDataRepository.js";
import { InMemoryFoodRepository } from "./repositories/inMemoryFoodRepository.js";
import { PostgresFoodRepository } from "./repositories/postgresFoodRepository.js";
import type { FoodRepository } from "./repositories/foodRepository.js";
import { InMemorySettingsRepository } from "./repositories/inMemorySettingsRepository.js";
import { PostgresSettingsRepository } from "./repositories/postgresSettingsRepository.js";
import type { SettingsRepository } from "./repositories/settingsRepository.js";

export interface Repositories {
  mealRepository: MealRepository;
  userRepository: UserRepository;
  userDataRepository: UserDataRepository;
  foodRepository: FoodRepository;
  settingsRepository: SettingsRepository;
}

export function inMemoryRepositories(): Repositories {
  return {
    mealRepository: new InMemoryMealRepository(),
    userRepository: new InMemoryUserRepository(),
    userDataRepository: new InMemoryUserDataRepository(),
    // Pre-seeded synchronously at construction with the synthetic catalog —
    // see `InMemoryFoodRepository`'s doc comment.
    foodRepository: new InMemoryFoodRepository(CATALOG),
    settingsRepository: new InMemorySettingsRepository(),
  };
}

/**
 * The real Postgres attempt: one shared pool, migrations in dependency
 * order (`user_data` has a foreign key on `users(id)`, so
 * `PostgresUserRepository.migrate()` must complete before
 * `PostgresUserDataRepository.migrate()` runs), then an idempotent catalog
 * seed. Throws on ANY failure (connect, migrate, or seed) and always closes
 * the pool it opened before rethrowing — callers of `resolveRepositories`
 * decide what "failure" means (dev fallback vs prod fail-closed); this
 * function itself never falls back to in-memory.
 *
 * Extracted as its own function (rather than inlined in
 * `resolveRepositories`) purely so tests can inject a fake in its place via
 * `ResolveRepositoriesDeps.attemptPostgres`, without needing a real database.
 */
async function attemptPostgresRepositories(databaseUrl: string): Promise<Repositories> {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const mealRepository = new PostgresMealRepository(pool);
    const userRepository = new PostgresUserRepository(pool);
    const userDataRepository = new PostgresUserDataRepository(pool);
    const foodRepository = new PostgresFoodRepository(pool);
    const settingsRepository = new PostgresSettingsRepository(pool);

    await mealRepository.migrate();
    await userRepository.migrate();
    // Must run after `userRepository.migrate()` — `user_data` references
    // `users(id)`.
    await userDataRepository.migrate();
    await foodRepository.migrate();
    await settingsRepository.migrate();
    // Idempotent upsert — safe to run on every startup, never duplicates.
    await foodRepository.seedApproved(CATALOG);

    console.log("[t1dine-api] persistence: postgres (DATABASE_URL configured)");
    return { mealRepository, userRepository, userDataRepository, foodRepository, settingsRepository };
  } catch (error) {
    await pool.end().catch(() => undefined);
    throw error;
  }
}

export interface ResolveRepositoriesDeps {
  /** Injectable stand-in for the real Postgres attempt — lets tests simulate
   * a connect/migrate/seed failure deterministically, without a real
   * database. Defaults to the real Postgres attempt. */
  attemptPostgres?: (databaseUrl: string) => Promise<Repositories>;
}

/**
 * Resolves the meal, user-account, sync-state, food-catalog, and
 * admin-settings persistence adapters for this process.
 *
 * - No `DATABASE_URL` -> in-memory for all five.
 * - `DATABASE_URL` set and the Postgres attempt succeeds -> a single shared
 *   Postgres-backed set of adapters.
 * - `DATABASE_URL` set but the attempt fails (unreachable host, bad
 *   credentials, a broken migration, ...):
 *     - dev/test (`isProd(env)` false): log a short, non-sensitive message
 *       and fall back to in-memory for ALL FIVE — a partial fallback (e.g.
 *       meals on Postgres, accounts in-memory) would silently break the
 *       `user_data` -> `users` foreign key contract, so this is deliberately
 *       all-or-nothing. Unchanged from this function's original behaviour:
 *       the API always comes up locally even with a misconfigured or
 *       temporarily unavailable database.
 *     - prod (`isProd(env)` true) (security review M5): a silent in-memory
 *       fallback in production would mean every account, meal, and
 *       submission vanishes on the next restart with no operator
 *       visibility — log the same short message and EXIT the process
 *       non-zero instead of ever answering traffic against the wrong store.
 */
export async function resolveRepositories(
  env: NodeJS.ProcessEnv = process.env,
  deps: ResolveRepositoriesDeps = {},
): Promise<Repositories> {
  const databaseUrl = env["DATABASE_URL"];
  if (!databaseUrl) {
    return inMemoryRepositories();
  }

  const attemptPostgres = deps.attemptPostgres ?? attemptPostgresRepositories;

  try {
    return await attemptPostgres(databaseUrl);
  } catch {
    // Deliberately does not log the caught error — some pg connection
    // failures embed the connection string (and therefore credentials) in
    // their message.
    console.error("[t1dine-api] database connection/migration failed at startup");

    if (isProd(env)) {
      console.error("[t1dine-api] refusing to fall back to in-memory storage in production; exiting");
      process.exit(1);
      // Defensive: `process.exit` never returns in a real process — this
      // line only executes if something (e.g. a test) stubs it out. Throw
      // rather than silently falling through to the dev in-memory fallback
      // below, which would defeat the fail-closed contract this branch
      // exists for.
      throw new Error("[t1dine-api] process.exit(1) was stubbed; refusing to continue after a fatal boot error");
    }

    console.error("[t1dine-api] falling back to in-memory storage (development only)");
    return inMemoryRepositories();
  }
}

/**
 * Ensures a demo admin account exists so the admin portal always has
 * something to log in with locally. Registers `adminEmails[0]` (the primary
 * admin address, from `ADMIN_EMAILS`/its default) with `ADMIN_PASSWORD` (or
 * a fixed, clearly-insecure dev default) — but ONLY if no account with that
 * email exists yet; it never overwrites an existing admin's password.
 *
 * PROD GUARD (security review C3): in production this must never seed an
 * admin whose password is unset or still the dev default —
 * `src/server.ts`'s `enforceProdSecretsOrExit()` (see `./prodGate.ts`)
 * already refuses to boot in that situation, so this branch should be
 * unreachable in the real `main()`; it is kept here as defence-in-depth (and
 * so this function is independently correct/testable) rather than relying
 * solely on call-order in `main()`.
 *
 * PRIVACY: never logs the email or password, only a short, non-sensitive
 * status line.
 */
export async function ensureDemoAdmin(
  userRepository: UserRepository,
  adminEmails: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const primaryAdminEmail = adminEmails[0];
  if (!primaryAdminEmail) {
    // Invariant guard: `resolveAdminEmails()` never returns an empty list
    // (it falls back to a fixed default), so this should be unreachable.
    return;
  }

  const existing = await userRepository.findByEmail(primaryAdminEmail);
  if (existing) {
    console.log("[t1dine-api] demo admin account already present");
    return;
  }

  const adminPasswordEnv = env["ADMIN_PASSWORD"];
  const isDefaultOrUnset = !adminPasswordEnv || adminPasswordEnv.trim().length === 0 || adminPasswordEnv === DEFAULT_ADMIN_PASSWORD;
  if (isProd(env) && isDefaultOrUnset) {
    console.error(
      "[t1dine-api] refusing to seed a demo admin account in production without a non-default ADMIN_PASSWORD",
    );
    return;
  }

  const password = adminPasswordEnv ?? DEFAULT_ADMIN_PASSWORD;
  const { passwordHash, salt } = await hashPassword(password);

  try {
    await userRepository.create({ email: primaryAdminEmail, passwordHash, salt });
    console.log("[t1dine-api] demo admin account ready (see ADMIN_EMAILS/ADMIN_PASSWORD)");
  } catch (error) {
    if (error instanceof UserEmailTakenError) {
      // Raced with a concurrent create — an account now exists either way.
      return;
    }
    throw error;
  }
}
