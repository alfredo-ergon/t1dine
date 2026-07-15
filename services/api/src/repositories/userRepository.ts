// Persistence PORT for user accounts (ports-and-adapters — see
// .claude/rules/architecture.md). This is the only contract the rest of the
// API depends on; nothing outside this file and its adapters should know
// whether a user is stored in memory or in Postgres.
//
// Two adapters implement `UserRepository`:
//   - `InMemoryUserRepository` — deterministic, in-process, zero I/O. This is
//     the default used by `buildApp()` whenever no repository is injected,
//     so every existing test keeps passing unchanged.
//   - `PostgresUserRepository` — backed by a `pg` `Pool`, used by
//     `src/server.ts` only when `DATABASE_URL` is set (with an automatic
//     fallback to in-memory on any connection/migration failure).
//
// PRIVACY CONTRACT: only `passwordHash` and `salt` are ever persisted or
// returned here — a plaintext password never reaches a repository, and
// neither adapter may log an email, a password, a hash, or a salt.
// Emails are case-normalised (trimmed + lower-cased) by every adapter before
// storage or lookup, so "a@b.com" and "A@B.com" resolve to the same account.

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  /** ISO-8601 timestamp of when the account was created. */
  createdAt: string;
}

export interface NewUser {
  email: string;
  passwordHash: string;
  salt: string;
}

/** Thrown by `create()` when the email is already registered. Its message is
 * deliberately generic (never echoes the email back) so it stays safe even
 * if a caller accidentally logs the error object. */
export class UserEmailTakenError extends Error {
  constructor() {
    super("A user with this email already exists.");
    this.name = "UserEmailTakenError";
  }
}

export interface UserRepository {
  /** Creates a new user and assigns its id deterministically (a monotonic
   * counter, a DB sequence, etc. — never `Math.random()`/`Date.now()`,
   * mirroring `MealRepository.save`'s id contract). Throws
   * `UserEmailTakenError` when the (case-normalised) email is already
   * registered — callers should typically pre-check with `findByEmail`, but
   * every adapter also enforces this at the storage layer as a
   * defence-in-depth against a race between the check and the write. */
  create(user: NewUser): Promise<StoredUser>;
  /** Case-insensitive lookup by email, or `null` when no such user exists
   * (never throws for a merely-unknown email — the caller decides how to
   * respond, e.g. a generic 401 on login that does not reveal whether the
   * email is registered). */
  findByEmail(email: string): Promise<StoredUser | null>;
  /** Looks up a user by id, or `null` when it does not exist. */
  findById(id: string): Promise<StoredUser | null>;
  /** Releases any held resources (e.g. a `pg` connection pool). Optional —
   * the in-memory adapter has nothing to close. */
  close?(): Promise<void>;
}
