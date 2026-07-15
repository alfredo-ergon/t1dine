// End-to-end coverage for `POST /admin/foods/ai-generate`'s PER-REQUEST
// provider resolution: an admin-configured key set via `PUT
// /admin/ai-config` is picked up on the very next call, with NO real network
// call — a fake `createAnthropicProvider` factory (injected via
// `aiProviderResolutionDeps`) stands in for the real Anthropic-backed
// adapter and records the `{ apiKey, model }` it was invoked with.

process.env["SETTINGS_SECRET"] = "vitest-fixed-settings-secret-for-ai-provider-route-tests";

import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const TEST_AUTH_SECRET = "test-only-fixed-auth-secret-for-vitest-ai-provider-route";
const ADMIN_EMAIL = "admin@t1dine.local";
const FAKE_KEY = "sk-ant-test-1234";

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

async function adminToken(app: ReturnType<typeof buildApp>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email: ADMIN_EMAIL, password: "admin-password-123" },
  });
  return response.json().token as string;
}

describe("POST /admin/foods/ai-generate provider selection", () => {
  it("uses the admin-configured stored key once enabled (no network; fake client asserts the key passed)", async () => {
    const { calls, factory } = fakeAnthropicFactory();
    const app = buildApp({
      authSecret: TEST_AUTH_SECRET,
      adminEmails: [ADMIN_EMAIL],
      aiProviderResolutionDeps: { createAnthropicProvider: factory, envApiKey: "" },
    });
    const token = await adminToken(app);

    const putResponse = await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { apiKey: FAKE_KEY, enabled: true, model: "claude-sonnet-5" },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(putResponse.statusCode).toBe(200);

    const response = await app.inject({
      method: "POST",
      url: "/admin/foods/ai-generate",
      payload: { count: 1 },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(201);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ apiKey: FAKE_KEY, model: "claude-sonnet-5" });
  });

  it("falls back to the ANTHROPIC_API_KEY env var when admin config is never enabled", async () => {
    const { calls, factory } = fakeAnthropicFactory();
    const app = buildApp({
      authSecret: TEST_AUTH_SECRET,
      adminEmails: [ADMIN_EMAIL],
      aiProviderResolutionDeps: { createAnthropicProvider: factory, envApiKey: "sk-ant-env-key" },
    });
    const token = await adminToken(app);

    const response = await app.inject({
      method: "POST",
      url: "/admin/foods/ai-generate",
      payload: { count: 1 },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(201);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.apiKey).toBe("sk-ant-env-key");
  });

  it("falls back to the offline mock provider when neither admin config nor env is configured", async () => {
    const app = buildApp({
      authSecret: TEST_AUTH_SECRET,
      adminEmails: [ADMIN_EMAIL],
      aiProviderResolutionDeps: { envApiKey: "" },
    });
    const token = await adminToken(app);

    const response = await app.inject({
      method: "POST",
      url: "/admin/foods/ai-generate",
      payload: { count: 1, cuisine: "italian" },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.count).toBe(1);
    expect(body.foods).toHaveLength(1);
    expect(body.foods[0].source).toBe("ai");
    expect(body.foods[0].status).toBe("candidate");
  });

  it("stops using the admin key once it is disabled again, falling back to env/mock", async () => {
    const { calls, factory } = fakeAnthropicFactory();
    const app = buildApp({
      authSecret: TEST_AUTH_SECRET,
      adminEmails: [ADMIN_EMAIL],
      aiProviderResolutionDeps: { createAnthropicProvider: factory, envApiKey: "" },
    });
    const token = await adminToken(app);

    await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { apiKey: FAKE_KEY, enabled: true },
      headers: { authorization: `Bearer ${token}` },
    });
    await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { enabled: false },
      headers: { authorization: `Bearer ${token}` },
    });

    const response = await app.inject({
      method: "POST",
      url: "/admin/foods/ai-generate",
      payload: { count: 1 },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(201);
    // No env key configured either (envApiKey: "") -> falls all the way
    // through to the offline mock, never touching the fake Anthropic client.
    expect(calls).toHaveLength(0);
    expect(response.json().foods[0].source).toBe("ai");
  });
});
