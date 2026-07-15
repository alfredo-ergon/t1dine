// Coverage for admin-managed AI configuration: `GET`/`PUT /admin/ai-config`.
// Fully in-memory/offline via `buildApp().inject` — no database, no
// network. The raw/decrypted API key is asserted to NEVER appear in any
// response body (only a masked `keyMasked` built from the last 4 chars).

process.env["SETTINGS_SECRET"] = "vitest-fixed-settings-secret-for-ai-config-admin-tests";

import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const TEST_AUTH_SECRET = "test-only-fixed-auth-secret-for-vitest-ai-config-admin";
const ADMIN_EMAIL = "admin@t1dine.local";
const FAKE_KEY = "sk-ant-test-1234";

function freshApp() {
  return buildApp({ authSecret: TEST_AUTH_SECRET, adminEmails: [ADMIN_EMAIL] });
}

async function adminToken(app: ReturnType<typeof freshApp>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email: ADMIN_EMAIL, password: "admin-password-123" },
  });
  return response.json().token as string;
}

describe("requireAdmin auth on /admin/ai-config", () => {
  it("401s GET/PUT with no token", async () => {
    const app = freshApp();
    const responses = await Promise.all([
      app.inject({ method: "GET", url: "/admin/ai-config" }),
      app.inject({ method: "PUT", url: "/admin/ai-config", payload: {} }),
    ]);
    for (const response of responses) {
      expect(response.statusCode).toBe(401);
    }
  });

  it("403s an authenticated user who is not an admin", async () => {
    const app = freshApp();
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "not-admin@example.com", password: "a-perfectly-fine-password-123" },
    });
    const token = register.json().token as string;

    const response = await app.inject({
      method: "GET",
      url: "/admin/ai-config",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe("GET /admin/ai-config (nothing saved yet)", () => {
  it("returns safe defaults with effectiveSource 'none'", async () => {
    const app = freshApp();
    const token = await adminToken(app);

    const response = await app.inject({
      method: "GET",
      url: "/admin/ai-config",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.provider).toBe("anthropic");
    expect(body.enabled).toBe(false);
    expect(body.keySet).toBe(false);
    expect(body.keyMasked).toBeNull();
    expect(body.availableModels).toEqual(["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"]);
    expect(body.effectiveSource).toBe("none");
    expect(body.updatedAt).toBeNull();
    expect(JSON.stringify(body)).not.toContain(FAKE_KEY);
  });
});

describe("PUT /admin/ai-config", () => {
  it("sets a key: keySet true, keyMasked shows last4, raw key never in the response", async () => {
    const app = freshApp();
    const token = await adminToken(app);

    const response = await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { apiKey: FAKE_KEY },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.keySet).toBe(true);
    expect(body.keyMasked).toBe("sk-ant-••••1234");
    expect(JSON.stringify(body)).not.toContain(FAKE_KEY);
  });

  it("enabling with a key already set succeeds and flips effectiveSource to 'admin'", async () => {
    const app = freshApp();
    const token = await adminToken(app);

    await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { apiKey: FAKE_KEY },
      headers: { authorization: `Bearer ${token}` },
    });

    const response = await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { enabled: true },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.enabled).toBe(true);
    expect(body.effectiveSource).toBe("admin");
  });

  it("400s enabling without any key ever configured", async () => {
    const app = freshApp();
    const token = await adminToken(app);

    const response = await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { enabled: true },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("ai_key_required");
  });

  it("400s setting an invalid model", async () => {
    const app = freshApp();
    const token = await adminToken(app);

    const response = await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { model: "not-a-real-model" },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_model");
  });

  it("accepts a valid model change", async () => {
    const app = freshApp();
    const token = await adminToken(app);

    const response = await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { model: "claude-sonnet-5" },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().model).toBe("claude-sonnet-5");
  });

  it("clears a stored key with explicit null: keySet false, auto-disables, effectiveSource falls back", async () => {
    const app = freshApp();
    const token = await adminToken(app);

    await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { apiKey: FAKE_KEY, enabled: true },
      headers: { authorization: `Bearer ${token}` },
    });

    const response = await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { apiKey: null },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.keySet).toBe(false);
    expect(body.keyMasked).toBeNull();
    // Never leaves the config in an invalid "enabled with no key" state.
    expect(body.enabled).toBe(false);
    expect(body.effectiveSource).not.toBe("admin");
  });

  it("treats an all-whitespace apiKey the same as clearing it", async () => {
    const app = freshApp();
    const token = await adminToken(app);

    await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { apiKey: FAKE_KEY },
      headers: { authorization: `Bearer ${token}` },
    });

    const response = await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { apiKey: "   " },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().keySet).toBe(false);
  });

  it("omitting apiKey leaves an existing key unchanged", async () => {
    const app = freshApp();
    const token = await adminToken(app);

    await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { apiKey: FAKE_KEY },
      headers: { authorization: `Bearer ${token}` },
    });

    const response = await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { model: "claude-haiku-4-5" },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.keySet).toBe(true);
    expect(body.keyMasked).toBe("sk-ant-••••1234");
    expect(body.model).toBe("claude-haiku-4-5");
  });

  it("400s a structurally invalid body", async () => {
    const app = freshApp();
    const token = await adminToken(app);

    const response = await app.inject({
      method: "PUT",
      url: "/admin/ai-config",
      payload: { apiKey: 12345 },
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_body");
  });
});
