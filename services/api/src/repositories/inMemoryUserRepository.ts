// Default, zero-dependency `UserRepository` adapter. Keeps users in a
// per-instance `Map`, keyed by a deterministic, monotonically increasing id
// (`user-1`, `user-2`, ...) — never `Math.random()`/`Date.now()` for the id,
// mirroring `InMemoryMealRepository`. This is the adapter `buildApp()` uses
// by default when no `userRepository` is injected.
//
// PRIVACY: only ever stores `passwordHash`/`salt` — never a plaintext
// password — and never logs anything (this adapter has zero `console.*`
// calls by design).

import { UserEmailTakenError } from "./userRepository.js";
import type { NewUser, StoredUser, UserRepository } from "./userRepository.js";

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class InMemoryUserRepository implements UserRepository {
  private readonly usersById = new Map<string, StoredUser>();
  private readonly idByEmail = new Map<string, string>();
  private sequence = 0;

  private nextId(): string {
    this.sequence += 1;
    return `user-${this.sequence}`;
  }

  async create(user: NewUser): Promise<StoredUser> {
    const normalisedEmail = normaliseEmail(user.email);
    if (this.idByEmail.has(normalisedEmail)) {
      throw new UserEmailTakenError();
    }

    const stored: StoredUser = {
      id: this.nextId(),
      email: normalisedEmail,
      passwordHash: user.passwordHash,
      salt: user.salt,
      createdAt: new Date().toISOString(),
    };
    this.usersById.set(stored.id, stored);
    this.idByEmail.set(normalisedEmail, stored.id);
    return stored;
  }

  async findByEmail(email: string): Promise<StoredUser | null> {
    const id = this.idByEmail.get(normaliseEmail(email));
    if (!id) return null;
    return this.usersById.get(id) ?? null;
  }

  async findById(id: string): Promise<StoredUser | null> {
    return this.usersById.get(id) ?? null;
  }
}
