// Process entry point: builds the app and binds it to a real port. Kept
// separate from `app.ts` so tests never open a socket. Logging here is
// limited to the bind address and short, non-sensitive startup status —
// never health, clinical, or user data, and never a connection string or
// query value. All the actual resolution logic (repositories, demo-admin
// seed, and their prod fail-closed behaviour) lives in `./bootstrap.ts` /
// `./prodGate.ts`, which are unit-tested directly — this file has no
// exports and is deliberately never imported by a test.

import { buildApp } from "./app.js";
import { resolveAdminEmails } from "./modules/admin.js";
import { enforceProdSecretsOrExit } from "./prodGate.js";
import { ensureDemoAdmin, resolveRepositories } from "./bootstrap.js";

async function main(): Promise<void> {
  // Fail-closed gate FIRST (security review C1/C2/C3) — must run before any
  // database connection attempt or admin seeding. A no-op in dev/test; in
  // prod, refuses to boot on an unset/default `AUTH_SECRET`, `SETTINGS_SECRET`,
  // or `ADMIN_PASSWORD`. See `./prodGate.ts`.
  enforceProdSecretsOrExit();

  const { mealRepository, userRepository, userDataRepository, foodRepository, settingsRepository } =
    await resolveRepositories();
  const adminEmails = resolveAdminEmails();
  await ensureDemoAdmin(userRepository, adminEmails);
  // `POST /admin/foods/ai-generate`'s provider (admin-managed config >
  // `ANTHROPIC_API_KEY` > offline `MockFoodAiProvider`) is resolved fresh on
  // every request rather than once here — see
  // `./aiProviderResolution.ts`/`./modules/admin.ts` — so an admin's
  // `/admin/ai-config` change takes effect without a restart. Never logs the
  // key itself, or anything derived from a prompt or model response.
  console.log("[t1dine-api] food AI provider: resolved per-request (admin config > ANTHROPIC_API_KEY > mock)");

  const app = buildApp({
    mealRepository,
    userRepository,
    userDataRepository,
    foodRepository,
    settingsRepository,
    adminEmails,
  });
  const port = Number(process.env["PORT"] ?? 3001);
  const host = "0.0.0.0";

  try {
    const address = await app.listen({ port, host });
    console.log(`[t1dine-api] listening at ${address}`);
  } catch (error) {
    console.error("[t1dine-api] failed to start", error);
    process.exit(1);
  }
}

void main();
