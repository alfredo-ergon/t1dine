// Persistence PORT for admin-managed application settings (ports-and-adapters
// — see .claude/rules/architecture.md). Currently the only setting is the AI
// (Anthropic) configuration used by `POST /admin/foods/ai-generate` (see
// `../aiProviderResolution.ts`), but the port is shaped like a generic
// key/value store (mirroring the `app_settings` table's `key`/`value`
// columns) so a future setting does not need a new table.
//
// Two adapters implement `SettingsRepository`:
//   - `InMemorySettingsRepository` — deterministic, in-process, zero I/O.
//     This is the default used by `buildApp()` whenever no repository is
//     injected.
//   - `PostgresSettingsRepository` — backed by a `pg` `Pool`, used by
//     `src/server.ts` only when `DATABASE_URL` is set (with an automatic
//     fallback to in-memory on any connection/migration failure, mirroring
//     `PostgresFoodRepository`/`PostgresUserRepository`).
//
// GOVERNANCE / PRIVACY: `StoredAiConfig.encryptedKey` is ALWAYS an
// AES-256-GCM ciphertext produced by `../aiConfigCrypto.ts` — NEVER a
// plaintext API key. Neither adapter, nor any caller, may log a
// `StoredAiConfig` value (even though `encryptedKey` is not plaintext, it is
// still credential-derived and treated as sensitive).

export interface StoredAiConfig {
  /** Whether the admin-configured key should be used for
   * `POST /admin/foods/ai-generate`. `true` here is only ever meaningful
   * when `encryptedKey` is also non-null — callers must never persist
   * `enabledFlag: true` with `encryptedKey: null` (see
   * `../modules/aiConfigAdmin.ts`). */
  enabledFlag: boolean;
  /** The Anthropic model id to use. Always a non-empty string — callers
   * fall back to a fixed default when nothing has ever been configured. */
  model: string;
  /** AES-256-GCM ciphertext (see `../aiConfigCrypto.ts`'s `encryptSecret`),
   * or `null` when no key has been configured. NEVER a plaintext key. */
  encryptedKey: string | null;
  /** Last 4 characters of the plaintext key, kept ONLY so a masked display
   * value (`GET /admin/ai-config`'s `keyMasked`) can be built WITHOUT ever
   * decrypting `encryptedKey` for that purpose. `null` iff `encryptedKey` is
   * `null`. */
  keyLast4: string | null;
  /** ISO-8601 timestamp of the last write. */
  updatedAt: string;
}

export interface SettingsRepository {
  /** Returns the stored AI config, or `null` if none has ever been saved
   * (callers apply their own defaults — e.g. `enabledFlag: false`). */
  getAiConfig(): Promise<StoredAiConfig | null>;
  /** Replaces the stored AI config wholesale (upsert semantics — there is
   * only ever one row for this setting). */
  saveAiConfig(config: StoredAiConfig): Promise<void>;
  /** Releases any held resources (e.g. a `pg` connection pool). Optional —
   * the in-memory adapter has nothing to close. */
  close?(): Promise<void>;
}
