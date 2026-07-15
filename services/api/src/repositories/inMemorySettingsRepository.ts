// Default, zero-dependency `SettingsRepository` adapter. Keeps the single
// stored AI config in a private field. This is the adapter `buildApp()` uses
// by default when no `settingsRepository` is injected, so all existing
// tests/callers are unaffected.
//
// PRIVACY: this adapter has zero `console.*` calls by design — a
// `StoredAiConfig` (which embeds an encrypted, but still credential-derived,
// key) is never logged. Every value handed to/from a caller is shallow-
// copied so no caller can mutate this adapter's internal state by mutating a
// returned/passed-in object.

import type { SettingsRepository, StoredAiConfig } from "./settingsRepository.js";

export class InMemorySettingsRepository implements SettingsRepository {
  private aiConfig: StoredAiConfig | null = null;

  // eslint-disable-next-line @typescript-eslint/require-await -- async only
  // to satisfy the `SettingsRepository` contract; the body stays fully
  // synchronous.
  async getAiConfig(): Promise<StoredAiConfig | null> {
    return this.aiConfig ? { ...this.aiConfig } : null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async saveAiConfig(config: StoredAiConfig): Promise<void> {
    this.aiConfig = { ...config };
  }
}
