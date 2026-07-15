// Runtime provider-selection policy for `POST /admin/foods/ai-generate`,
// resolved FRESHLY ON EVERY REQUEST (see `./modules/admin.ts`) rather than
// once at app-build/startup time — so an admin toggling `/admin/ai-config`
// (see `./modules/aiConfigAdmin.ts`) takes effect on the very next call,
// with no restart required.
//
// PRECEDENCE (highest to lowest):
//   1. Admin-managed config: `enabledFlag === true` AND a stored encrypted
//      key is present -> decrypt it and construct `AnthropicFoodAiProvider`
//      with the ADMIN-CONFIGURED model.
//   2. `ANTHROPIC_API_KEY` environment variable is set -> construct
//      `AnthropicFoodAiProvider` with that key; model = the admin config's
//      `model` field if ANY stored config exists (even if disabled or
//      keyless), else `FOODAI_MODEL`, else the adapter's own default.
//   3. Neither -> the fully offline, deterministic `MockFoodAiProvider`.
//
// PRIVACY: never logs the resolved/decrypted API key or any part of it —
// this module has zero `console.*` calls.

import { decryptSecret, resolveSettingsSecret } from "./aiConfigCrypto.js";
import { AnthropicFoodAiProvider } from "./anthropicFoodAi.js";
import { MockFoodAiProvider } from "./foodAi.js";
import type { FoodAiProvider } from "./foodAi.js";
import type { SettingsRepository } from "./repositories/settingsRepository.js";

/** Must match `AnthropicFoodAiProvider`'s own default (`./anthropicFoodAi.ts`). */
const DEFAULT_MODEL = "claude-opus-4-8";

export interface ResolveAiProviderDeps {
  /** Overrides `process.env["ANTHROPIC_API_KEY"]` — test seam only. Pass an
   * empty string to deterministically force "no env key" regardless of the
   * host process's real environment. */
  envApiKey?: string;
  /** Overrides `process.env["FOODAI_MODEL"]` — test seam only. */
  envModel?: string;
  /** Overrides `resolveSettingsSecret()` — test seam only. */
  settingsSecret?: string;
  /** Factory used to build the real Anthropic-backed provider from a
   * resolved `{ apiKey, model }` pair. Defaults to
   * `AnthropicFoodAiProvider.fromApiKey`, which constructs a REAL Anthropic
   * client. Tests MUST override this with a fake-client factory to stay
   * fully offline (see `../test/aiProviderResolution.test.ts`). Never logs
   * `apiKey`. */
  createAnthropicProvider?: (apiKey: string, model: string) => FoodAiProvider;
  /** Overrides the offline fallback provider — test seam only. */
  mockProvider?: FoodAiProvider;
}

function defaultCreateAnthropicProvider(apiKey: string, model: string): FoodAiProvider {
  return AnthropicFoodAiProvider.fromApiKey(apiKey, model);
}

/**
 * Resolves the `FoodAiProvider` to use for THIS request, per the precedence
 * documented above. Never throws for a merely-unconfigured provider (that is
 * branch 3); MAY throw if a stored `encryptedKey` fails to decrypt (e.g. a
 * wrong/rotated `SETTINGS_SECRET`) — callers (see `./modules/admin.ts`) treat
 * that the same as any other provider failure (`502 ai_unavailable`), never
 * logging the error.
 */
export async function resolveEffectiveAiProvider(
  settingsRepository: SettingsRepository,
  deps: ResolveAiProviderDeps = {},
): Promise<FoodAiProvider> {
  const createAnthropicProvider = deps.createAnthropicProvider ?? defaultCreateAnthropicProvider;
  const config = await settingsRepository.getAiConfig();

  if (config?.enabledFlag && config.encryptedKey) {
    const secret = deps.settingsSecret ?? resolveSettingsSecret();
    const apiKey = decryptSecret(config.encryptedKey, secret);
    return createAnthropicProvider(apiKey, config.model || DEFAULT_MODEL);
  }

  const envApiKey = deps.envApiKey ?? process.env["ANTHROPIC_API_KEY"];
  if (envApiKey) {
    const model = config?.model || deps.envModel || process.env["FOODAI_MODEL"] || DEFAULT_MODEL;
    return createAnthropicProvider(envApiKey, model);
  }

  return deps.mockProvider ?? new MockFoodAiProvider();
}
