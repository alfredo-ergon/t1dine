// Fail-closed startup gate for production deployments (security review
// findings C1 unset/default secrets, C2/C3 the default admin password/demo
// seed). In dev (`NODE_ENV !== "production"`) an unset or dev-fallback
// secret is tolerated with today's existing one-line warning (see
// `resolveAuthSecret`/`resolveSettingsSecret`) — this module changes NOTHING
// about dev/test behaviour. In prod, the same conditions must refuse to
// boot instead: a public-facing API signing tokens, encrypting an admin
// secret, or seeding a demo admin account with a well-known,
// checked-into-source-control default is not a "warning", it is a
// compromise waiting to happen.
//
// Kept deliberately pure/side-effect-free at the "what's wrong" layer
// (`collectProdSecretProblems`) so it is trivially unit-testable without
// forking a process or stubbing `process.exit`; only
// `enforceProdSecretsOrExit` (used solely by `src/server.ts`, at the very
// top of `main()` — before any repository/database work or admin seeding)
// actually logs and exits.

import { DEV_FALLBACK_AUTH_SECRET } from "./modules/auth.js";
import { DEV_FALLBACK_SETTINGS_SECRET } from "./aiConfigCrypto.js";

/** Mirrors the same fixed, clearly-insecure default `./bootstrap.ts`'s
 * `ensureDemoAdmin` falls back to when `ADMIN_PASSWORD` is unset —
 * centralised here so the prod gate and the seeding logic can never drift
 * apart. */
export const DEFAULT_ADMIN_PASSWORD = "t1dine-admin-dev";

/** The single production gate for this service: everywhere else in this
 * codebase that needs to distinguish "safe to warn-and-continue" (dev) from
 * "must fail closed" (prod) reads this, and only this. */
export function isProd(env: NodeJS.ProcessEnv = process.env): boolean {
  return env["NODE_ENV"] === "production";
}

function isUnsetOrBlank(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0;
}

/**
 * Pure check for whether this process is safe to boot in production:
 * returns a human-readable problem description for each secret/credential
 * that is unset OR still equal to its clearly-insecure dev fallback. An
 * empty array means "safe to boot". Never logs anything itself, and never
 * includes a secret/password VALUE in its output — see
 * `enforceProdSecretsOrExit` for the side-effecting half.
 */
export function collectProdSecretProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  const problems: string[] = [];

  const authSecret = env["AUTH_SECRET"];
  if (isUnsetOrBlank(authSecret) || authSecret === DEV_FALLBACK_AUTH_SECRET) {
    problems.push("AUTH_SECRET is unset or still the insecure development default.");
  }

  const settingsSecret = env["SETTINGS_SECRET"];
  if (isUnsetOrBlank(settingsSecret) || settingsSecret === DEV_FALLBACK_SETTINGS_SECRET) {
    problems.push("SETTINGS_SECRET is unset or still the insecure development default.");
  }

  const adminPassword = env["ADMIN_PASSWORD"];
  if (isUnsetOrBlank(adminPassword) || adminPassword === DEFAULT_ADMIN_PASSWORD) {
    problems.push("ADMIN_PASSWORD is unset or still the insecure development default.");
  }

  return problems;
}

/**
 * Fail-closed startup gate, called ONCE at the very top of `src/server.ts`'s
 * `main()` — before any repository/database work or admin seeding. A no-op
 * in dev/test (`isProd` false, unchanged behaviour). In prod, logs each
 * problem found by `collectProdSecretProblems` (never the secret/password
 * VALUES themselves — only the fixed messages above) and exits the process
 * non-zero, so a misconfigured deployment never silently serves traffic
 * signed with a public, well-known secret.
 */
export function enforceProdSecretsOrExit(env: NodeJS.ProcessEnv = process.env): void {
  if (!isProd(env)) return;

  const problems = collectProdSecretProblems(env);
  if (problems.length === 0) return;

  console.error("[t1dine-api] refusing to start in production: missing or default secrets/credentials.");
  for (const problem of problems) {
    console.error(`[t1dine-api]   - ${problem}`);
  }
  console.error(
    "[t1dine-api] set AUTH_SECRET, SETTINGS_SECRET, and a non-default ADMIN_PASSWORD (see docs/security/api-deployment-hardening.md), then restart.",
  );
  process.exit(1);
}
