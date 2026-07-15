// `SettingsRepository` adapter backed by Postgres. Only constructed by
// `src/server.ts` when `DATABASE_URL` is set — never during tests (no
// database is available in the Vitest run) and never imported by any other
// module.
//
// Stored as a single row keyed by a fixed, non-secret settings key
// (`AI_CONFIG_KEY`) in a generic `key`/`value` table — see the port doc
// comment in `./settingsRepository.ts` for why this is shaped as a
// key/value store rather than a dedicated `ai_config` table.

import type { Pool } from "pg";
import type { SettingsRepository, StoredAiConfig } from "./settingsRepository.js";

/** Fixed row key for the AI config setting — never derived from user input. */
const AI_CONFIG_KEY = "ai_config";

interface SettingsRow {
  value: StoredAiConfig;
}

export class PostgresSettingsRepository implements SettingsRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Idempotently creates the `app_settings` table. Safe to call on every
   * process startup — `CREATE TABLE IF NOT EXISTS`.
   */
  async migrate(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async getAiConfig(): Promise<StoredAiConfig | null> {
    const result = await this.pool.query<SettingsRow>("SELECT value FROM app_settings WHERE key = $1", [
      AI_CONFIG_KEY,
    ]);
    const row = result.rows[0];
    return row ? row.value : null;
  }

  async saveAiConfig(config: StoredAiConfig): Promise<void> {
    await this.pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = now()`,
      [AI_CONFIG_KEY, JSON.stringify(config)],
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
