// Process entry point: builds the app and binds it to a real port. Kept
// separate from `app.ts` so tests never open a socket. Logging here is
// limited to the bind address and short, non-sensitive startup status —
// never health, clinical, or user data, and never a connection string or
// query value (see `resolveRepositories` below for the DATABASE_URL fallback
// contract).

import pg from "pg";
const { Pool } = pg;
import { buildApp } from "./app.js";
import { CATALOG } from "./catalog.js";
import { resolveAdminEmails } from "./modules/admin.js";
import { hashPassword } from "./modules/auth.js";
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
import { MockFoodAiProvider } from "./foodAi.js";
import type { FoodAiProvider } from "./foodAi.js";
import { AnthropicFoodAiProvider } from "./anthropicFoodAi.js";

interface Repositories {
  mealRepository: MealRepository;
  userRepository: UserRepository;
  userDataRepository: UserDataRepository;
  foodRepository: FoodRepository;
}

function inMemoryRepositories(): Repositories {
  return {
    mealRepository: new InMemoryMealRepository(),
    userRepository: new InMemoryUserRepository(),
    userDataRepository: new InMemoryUserDataRepository(),
    // Pre-seeded synchronously at construction with the synthetic catalog —
    // see `InMemoryFoodRepository`'s doc comment.
    foodRepository: new InMemoryFoodRepository(CATALOG),
  };
}

/**
 * Resolves the meal, user-account, sync-state, and food-catalog persistence
 * adapters for this process.
 *
 * - No `DATABASE_URL` -> in-memory for all four (same behaviour as before
 *   this change for meals; new default for accounts/sync/foods). The food
 *   repository is pre-seeded synchronously with the synthetic catalog.
 * - `DATABASE_URL` set -> a SINGLE shared `pg` `Pool` (one real connection
 *   pool, not four), then the idempotent `migrate()`s run in dependency
 *   order — `user_data` has a foreign key on `users(id)`, so
 *   `PostgresUserRepository.migrate()` must complete before
 *   `PostgresUserDataRepository.migrate()` runs (`foods` has no such
 *   dependency). The catalog is then idempotently upserted via
 *   `foodRepository.seedApproved(CATALOG)` — safe on every restart, never
 *   duplicates a row.
 * - `DATABASE_URL` set but ANY connection, migration, or seed step fails
 *   (unreachable host, bad credentials, permissions) -> log a short,
 *   non-sensitive message and fall back to in-memory FOR ALL FOUR — a
 *   partial fallback (e.g. meals on Postgres, accounts in-memory) would
 *   silently break the `user_data` -> `users` foreign key contract, so this
 *   is deliberately all-or-nothing. The API must always come up, even with
 *   a misconfigured or temporarily unavailable database.
 */
async function resolveRepositories(): Promise<Repositories> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    return inMemoryRepositories();
  }

  let pool: InstanceType<typeof Pool> | undefined;
  try {
    pool = new Pool({ connectionString: databaseUrl });

    const mealRepository = new PostgresMealRepository(pool);
    const userRepository = new PostgresUserRepository(pool);
    const userDataRepository = new PostgresUserDataRepository(pool);
    const foodRepository = new PostgresFoodRepository(pool);

    await mealRepository.migrate();
    await userRepository.migrate();
    // Must run after `userRepository.migrate()` — `user_data` references
    // `users(id)`.
    await userDataRepository.migrate();
    await foodRepository.migrate();
    // Idempotent upsert — safe to run on every startup, never duplicates.
    await foodRepository.seedApproved(CATALOG);

    console.log("[t1dine-api] persistence: postgres (DATABASE_URL configured)");
    return { mealRepository, userRepository, userDataRepository, foodRepository };
  } catch {
    // Deliberately does not log `error` — some pg connection failures embed
    // the connection string (and therefore credentials) in their message.
    console.error(
      "[t1dine-api] database connection/migration failed at startup; falling back to in-memory storage",
    );
    if (pool) {
      await pool.end().catch(() => undefined);
    }
    return inMemoryRepositories();
  }
}

const DEFAULT_ADMIN_PASSWORD = "t1dine-admin-dev";

/**
 * Ensures a demo admin account exists so the admin portal always has
 * something to log in with locally. Registers `adminEmails[0]` (the primary
 * admin address, from `ADMIN_EMAILS`/its default) with `ADMIN_PASSWORD` (or
 * a fixed, clearly-insecure dev default) — but ONLY if no account with that
 * email exists yet; it never overwrites an existing admin's password.
 * PRIVACY: never logs the email or password, only a short, non-sensitive
 * status line (mirrors every other startup log in this file).
 */
async function ensureDemoAdmin(userRepository: UserRepository, adminEmails: string[]): Promise<void> {
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

  const password = process.env["ADMIN_PASSWORD"] ?? DEFAULT_ADMIN_PASSWORD;
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

/**
 * Resolves the `POST /admin/foods/ai-generate` provider for this process:
 * the real, network-calling `AnthropicFoodAiProvider` when `ANTHROPIC_API_KEY`
 * is configured, otherwise the fully offline, deterministic
 * `MockFoodAiProvider` (the same default `buildApp()` uses when no provider
 * is injected at all). Logs a single short, non-sensitive line noting which
 * one is active — never the key itself, and never anything derived from a
 * prompt or model response.
 */
function resolveAiProvider(): FoodAiProvider {
  if (process.env["ANTHROPIC_API_KEY"]) {
    console.log("[t1dine-api] food AI provider: anthropic (ANTHROPIC_API_KEY configured)");
    return new AnthropicFoodAiProvider();
  }
  console.log("[t1dine-api] food AI provider: mock (offline, deterministic)");
  return new MockFoodAiProvider();
}

async function main(): Promise<void> {
  const { mealRepository, userRepository, userDataRepository, foodRepository } = await resolveRepositories();
  const adminEmails = resolveAdminEmails();
  await ensureDemoAdmin(userRepository, adminEmails);
  const aiProvider = resolveAiProvider();

  const app = buildApp({ mealRepository, userRepository, userDataRepository, foodRepository, adminEmails, aiProvider });
  const port = Number(process.env["PORT"] ?? 3001);
  const host = "0.0.0.0";

  try {
    const address = await app.listen({ port, host });
    console.log(`[t1dine-api] listening at ${address}`);
  } catch (error) {
    console.error("[t1dine-api] failed to start", error);
    process.exit(1);
  }
}

void main();
