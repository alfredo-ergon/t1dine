// Unit tests for the fail-closed production gate (security review C1/C2/C3).
// Every check here is pure/offline — no process forking. `enforceProdSecretsOrExit`
// is exercised with `process.exit`/`console.error` stubbed so the test
// process itself never actually exits.

import { afterEach, describe, expect, it, vi } from "vitest";
import { DEV_FALLBACK_AUTH_SECRET } from "../src/modules/auth.js";
import { DEV_FALLBACK_SETTINGS_SECRET } from "../src/aiConfigCrypto.js";
import {
  collectProdSecretProblems,
  DEFAULT_ADMIN_PASSWORD,
  enforceProdSecretsOrExit,
  isProd,
} from "../src/prodGate.js";

const STRONG_ENV = {
  NODE_ENV: "production",
  AUTH_SECRET: "a-very-strong-random-auth-secret-value",
  SETTINGS_SECRET: "a-very-strong-random-settings-secret-value",
  ADMIN_PASSWORD: "a-very-strong-random-admin-password",
};

describe("isProd", () => {
  it("is true only when NODE_ENV is exactly \"production\"", () => {
    expect(isProd({ NODE_ENV: "production" })).toBe(true);
    expect(isProd({ NODE_ENV: "development" })).toBe(false);
    expect(isProd({ NODE_ENV: "test" })).toBe(false);
    expect(isProd({})).toBe(false);
  });
});

describe("collectProdSecretProblems", () => {
  it("returns no problems when every secret/credential is set to a strong, non-default value", () => {
    expect(collectProdSecretProblems(STRONG_ENV)).toEqual([]);
  });

  it("flags an unset AUTH_SECRET", () => {
    const problems = collectProdSecretProblems({ ...STRONG_ENV, AUTH_SECRET: undefined });
    expect(problems.some((p) => p.includes("AUTH_SECRET"))).toBe(true);
  });

  it("flags AUTH_SECRET still equal to the dev fallback", () => {
    const problems = collectProdSecretProblems({ ...STRONG_ENV, AUTH_SECRET: DEV_FALLBACK_AUTH_SECRET });
    expect(problems.some((p) => p.includes("AUTH_SECRET"))).toBe(true);
  });

  it("flags a blank (whitespace-only) SETTINGS_SECRET", () => {
    const problems = collectProdSecretProblems({ ...STRONG_ENV, SETTINGS_SECRET: "   " });
    expect(problems.some((p) => p.includes("SETTINGS_SECRET"))).toBe(true);
  });

  it("flags SETTINGS_SECRET still equal to the dev fallback", () => {
    const problems = collectProdSecretProblems({ ...STRONG_ENV, SETTINGS_SECRET: DEV_FALLBACK_SETTINGS_SECRET });
    expect(problems.some((p) => p.includes("SETTINGS_SECRET"))).toBe(true);
  });

  it("flags an unset ADMIN_PASSWORD", () => {
    const problems = collectProdSecretProblems({ ...STRONG_ENV, ADMIN_PASSWORD: undefined });
    expect(problems.some((p) => p.includes("ADMIN_PASSWORD"))).toBe(true);
  });

  it("flags ADMIN_PASSWORD still equal to the dev default", () => {
    const problems = collectProdSecretProblems({ ...STRONG_ENV, ADMIN_PASSWORD: DEFAULT_ADMIN_PASSWORD });
    expect(problems.some((p) => p.includes("ADMIN_PASSWORD"))).toBe(true);
  });

  it("flags all three simultaneously when nothing is set", () => {
    const problems = collectProdSecretProblems({ NODE_ENV: "production" });
    expect(problems).toHaveLength(3);
  });

  it("never includes the actual secret/password value in a problem message", () => {
    const problems = collectProdSecretProblems({
      ...STRONG_ENV,
      AUTH_SECRET: DEV_FALLBACK_AUTH_SECRET,
      SETTINGS_SECRET: DEV_FALLBACK_SETTINGS_SECRET,
      ADMIN_PASSWORD: DEFAULT_ADMIN_PASSWORD,
    });
    const joined = problems.join(" ");
    expect(joined).not.toContain(DEV_FALLBACK_AUTH_SECRET);
    expect(joined).not.toContain(DEV_FALLBACK_SETTINGS_SECRET);
    expect(joined).not.toContain(DEFAULT_ADMIN_PASSWORD);
  });
});

describe("enforceProdSecretsOrExit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is a no-op outside production, even with every secret unset", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    enforceProdSecretsOrExit({ NODE_ENV: "development" });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("is a no-op in production when every secret/credential is strong and non-default", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    enforceProdSecretsOrExit(STRONG_ENV);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("logs and exits(1) in production when a secret is unset/default, without leaking its value", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    enforceProdSecretsOrExit({ ...STRONG_ENV, AUTH_SECRET: DEV_FALLBACK_AUTH_SECRET });

    expect(exitSpy).toHaveBeenCalledWith(1);
    const loggedText = errorSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(loggedText).not.toContain(DEV_FALLBACK_AUTH_SECRET);
  });
});
