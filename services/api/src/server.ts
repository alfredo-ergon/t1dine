// Process entry point: builds the app and binds it to a real port. Kept
// separate from `app.ts` so tests never open a socket. Logging here is
// limited to the bind address and short, non-sensitive startup status —
// never health, clinical, or user data, and never a connection string or
// query value (see `resolveRepositories` below for the DATABASE_URL fallback
// contract).

import pg from "pg";
const { Pool } = pg;
import { buildApp } from "./app.js";
import { InMemoryMealRepository } from "./repositories/inMemoryMealRepository.js";
import { PostgresMealRepository } from "./repositories/postgresMealRepository.js";
import type { MealRepository } from "./repositories/mealRepository.js";
import { InMemoryUserRepository } from "./repositories/inMemoryUserRepository.js";
import { PostgresUserRepository } from "./repositories/postgresUserRepository.js";
import type { UserRepository } from "./repositories/userRepository.js";
import { InMemoryUserDataRepository } from "./repositories/inMemoryUserDataRepository.js";
import { PostgresUserDataRepository } from "./repositories/postgresUserDataRepository.js";
import type { UserDataRepository } from "./repositories/userDataRepository.js";

interface Repositories {
  mealRepository: MealRepository;
  userRepository: UserRepository;
  userDataRepository: UserDataRepository;
}

function inMemoryRepositories(): Repositories {
  return {
    mealRepository: new InMemoryMealRepository(),
    userRepository: new InMemoryUserRepository(),
    userDataRepository: new InMemoryUserDataRepository(),
  };
}

/**
 * Resolves the meal, user-account, and sync-state persistence adapters for
 * this process.
 *
 * - No `DATABASE_URL` -> in-memory for all three (same behaviour as before
 *   this change for meals; new default for accounts/sync).
 * - `DATABASE_URL` set -> a SINGLE shared `pg` `Pool` (one real connection
 *   pool, not three), then the idempotent `migrate()`s run in dependency
 *   order — `user_data` has a foreign key on `users(id)`, so
 *   `PostgresUserRepository.migrate()` must complete before
 *   `PostgresUserDataRepository.migrate()` runs.
 * - `DATABASE_URL` set but ANY connection or migration step fails
 *   (unreachable host, bad credentials, permissions) -> log a short,
 *   non-sensitive message and fall back to in-memory FOR ALL THREE — a
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

    await mealRepository.migrate();
    await userRepository.migrate();
    // Must run after `userRepository.migrate()` — `user_data` references
    // `users(id)`.
    await userDataRepository.migrate();

    console.log("[t1dine-api] persistence: postgres (DATABASE_URL configured)");
    return { mealRepository, userRepository, userDataRepository };
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

async function main(): Promise<void> {
  const { mealRepository, userRepository, userDataRepository } = await resolveRepositories();
  const app = buildApp({ mealRepository, userRepository, userDataRepository });
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
