// Unit coverage for `resolveEffectiveAiProvider`'s precedence: admin-managed
// config (enabled + stored key) > `ANTHROPIC_API_KEY` env var > the fully
// offline `MockFoodAiProvider` fallback. NEVER calls the real Anthropic API
// — every "admin"/"env" branch is exercised via an injected fake
// `createAnthropicProvider` factory that records the `{ apiKey, model }` it
// was invoked with instead of ever constructing a real client, and every
// test explicitly overrides `envApiKey` so the host process's real
// environment can never influence the outcome.

import { describe, expect, it } from "vitest";
import { encryptSecret } from "../src/aiConfigCrypto.js";
import { resolveEffectiveAiProvider } from "../src/aiProviderResolution.js";
import { MockFoodAiProvider } from "../src/foodAi.js";
import { InMemorySettingsRepository } from "../src/repositories/inMemorySettingsRepository.js";
import type { StoredAiConfig } from "../src/repositories/settingsRepository.js";

const SECRET = "fixed-test-secret-for-ai-provider-resolution";

function fakeAnthropicFactory() {
  const calls: Array<{ apiKey: string; model: string }> = [];
  return {
    calls,
    factory: (apiKey: string, model: string) => {
      calls.push({ apiKey, model });
      return { generate: async () => [] };
    },
  };
}

describe("resolveEffectiveAiProvider", () => {
  it("uses the admin-configured stored key + model when enabled (highest precedence)", async () => {
    const repository = new InMemorySettingsRepository();
    const config: StoredAiConfig = {
      enabledFlag: true,
      model: "claude-sonnet-5",
      encryptedKey: encryptSecret("sk-ant-test-1234", SECRET),
      keyLast4: "1234",
      updatedAt: new Date().toISOString(),
    };
    await repository.saveAiConfig(config);

    const { calls, factory } = fakeAnthropicFactory();
    await resolveEffectiveAiProvider(repository, {
      envApiKey: "sk-ant-should-be-ignored",
      settingsSecret: SECRET,
      createAnthropicProvider: factory,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ apiKey: "sk-ant-test-1234", model: "claude-sonnet-5" });
  });

  it("does not use a stored key when enabledFlag is false, even if a key is present", async () => {
    const repository = new InMemorySettingsRepository();
    await repository.saveAiConfig({
      enabledFlag: false,
      model: "claude-sonnet-5",
      encryptedKey: encryptSecret("sk-ant-test-1234", SECRET),
      keyLast4: "1234",
      updatedAt: new Date().toISOString(),
    });

    const provider = await resolveEffectiveAiProvider(repository, { envApiKey: "", settingsSecret: SECRET });
    expect(provider).toBeInstanceOf(MockFoodAiProvider);
  });

  it("falls back to ANTHROPIC_API_KEY env var when admin config is disabled/absent", async () => {
    const repository = new InMemorySettingsRepository();
    const { calls, factory } = fakeAnthropicFactory();

    await resolveEffectiveAiProvider(repository, {
      envApiKey: "sk-ant-env-key",
      envModel: "claude-haiku-4-5",
      createAnthropicProvider: factory,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ apiKey: "sk-ant-env-key", model: "claude-haiku-4-5" });
  });

  it("prefers the admin config's model over FOODAI_MODEL when only the env var supplies a key", async () => {
    const repository = new InMemorySettingsRepository();
    await repository.saveAiConfig({
      enabledFlag: false,
      model: "claude-opus-4-8",
      encryptedKey: null,
      keyLast4: null,
      updatedAt: new Date().toISOString(),
    });

    const { calls, factory } = fakeAnthropicFactory();
    await resolveEffectiveAiProvider(repository, {
      envApiKey: "sk-ant-env-key",
      envModel: "claude-haiku-4-5",
      createAnthropicProvider: factory,
    });

    expect(calls[0]?.model).toBe("claude-opus-4-8");
  });

  it("falls back to FOODAI_MODEL when no admin config exists at all and env supplies a key", async () => {
    const repository = new InMemorySettingsRepository();
    const { calls, factory } = fakeAnthropicFactory();

    await resolveEffectiveAiProvider(repository, {
      envApiKey: "sk-ant-env-key",
      envModel: "claude-haiku-4-5",
      createAnthropicProvider: factory,
    });

    expect(calls[0]?.model).toBe("claude-haiku-4-5");
  });

  it("falls back to the offline MockFoodAiProvider when neither admin config nor env is configured", async () => {
    const repository = new InMemorySettingsRepository();
    const provider = await resolveEffectiveAiProvider(repository, { envApiKey: "" });
    expect(provider).toBeInstanceOf(MockFoodAiProvider);
  });

  it("never calls the Anthropic factory when falling back to mock", async () => {
    const repository = new InMemorySettingsRepository();
    const { calls, factory } = fakeAnthropicFactory();
    await resolveEffectiveAiProvider(repository, { envApiKey: "", createAnthropicProvider: factory });
    expect(calls).toHaveLength(0);
  });
});
