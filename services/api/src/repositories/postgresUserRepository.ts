// `UserRepository` adapter backed by Postgres. Only constructed by
// `src/server.ts` when `DATABASE_URL` is set — never during tests (no
// database is available in the Vitest run) and never imported by any other
// module.
//
// PRIVACY: only `password_hash`/`salt` are ever written — never a plaintext
// password — and this module never calls `console.*` with an email, a
// password, a hash, a salt, or the connection string.
//
// Id generation uses a Postgres sequence (`users_id_seq`), never app-side
// `Math.random()`/`Date.now()`, mirroring `PostgresMealRepository`.

import type { Pool } from "pg";
import { UserEmailTakenError } from "./userRepository.js";
import type { NewUser, StoredUser, UserRepository } from "./userRepository.js";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  created_at: Date;
}

/** Postgres error code for a unique-constraint violation. */
const UNIQUE_VIOLATION_CODE = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION_CODE
  );
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toStoredUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    salt: row.salt,
    createdAt: row.created_at.toISOString(),
  };
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Idempotently creates the `users_id_seq` sequence and the `users` table.
   * Safe to call on every process startup — every statement is
   * `IF NOT EXISTS`.
   */
  async migrate(): Promise<void> {
    await this.pool.query("CREATE SEQUENCE IF NOT EXISTS users_id_seq");
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        email text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        salt text NOT NULL,
        created_at timestamptz DEFAULT now()
      )
    `);
  }

  async create(user: NewUser): Promise<StoredUser> {
    const normalisedEmail = normaliseEmail(user.email);
    try {
      const result = await this.pool.query<UserRow>(
        `INSERT INTO users (id, email, password_hash, salt)
         VALUES ('user-' || nextval('users_id_seq'), $1, $2, $3)
         RETURNING id, email, password_hash, salt, created_at`,
        [normalisedEmail, user.passwordHash, user.salt],
      );

      const row = result.rows[0];
      if (!row) {
        // The insert either produced a row or the query would have thrown;
        // this is an invariant guard, not an expected runtime path.
        throw new Error("PostgresUserRepository.create: insert returned no row.");
      }
      return toStoredUser(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new UserEmailTakenError();
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      "SELECT id, email, password_hash, salt, created_at FROM users WHERE email = $1",
      [normaliseEmail(email)],
    );
    const row = result.rows[0];
    return row ? toStoredUser(row) : null;
  }

  async findById(id: string): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      "SELECT id, email, password_hash, salt, created_at FROM users WHERE id = $1",
      [id],
    );
    const row = result.rows[0];
    return row ? toStoredUser(row) : null;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
