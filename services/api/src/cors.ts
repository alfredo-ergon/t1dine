// CORS allowlist (security review M2). Dev/test keep today's permissive
// `@fastify/cors` default (`origin: '*'`) COMPLETELY unchanged — see
// `resolveCorsOptions` below, which returns `{}` (no options at all) in that
// case, exactly like the original `app.register(cors)` call this replaces.
//
// In prod, only origins listed in `CORS_ORIGINS` (comma-separated) are
// reflected back via `Access-Control-Allow-Origin`; every other browser
// origin gets NO such header, which is how a browser is made to refuse to
// let client-side JS read the response. CORS is a browser-enforced
// boundary, not a server-side authorization mechanism — it never replaces
// `requireAuth`/`requireAdmin` for anything that actually needs protecting,
// it only narrows which web origins may use this API from a browser at all.
//
// Native clients (the T1Dine mobile app, curl, server-to-server calls) send
// no `Origin` header and are always allowed through unaffected, in both dev
// and prod — there is nothing for a browser to enforce without one.

import type { FastifyCorsOptions, OriginFunction } from "@fastify/cors";
import { isProd } from "./prodGate.js";

function parseCorsOrigins(env: NodeJS.ProcessEnv): Set<string> {
  const raw = env["CORS_ORIGINS"] ?? "";
  return new Set(
    raw
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  );
}

function buildAllowlistOrigin(allowlist: Set<string>): OriginFunction {
  return (requestOrigin, callback) => {
    if (!requestOrigin || allowlist.has(requestOrigin)) {
      callback(null, true);
      return;
    }
    // Not on the allowlist: deliberately `callback(null, false)`, never an
    // error — see the module header for why this is a browser-side (not
    // server-side) rejection.
    callback(null, false);
  };
}

/**
 * Resolves the `@fastify/cors` plugin options for this process.
 * - Dev/test (`isProd` false): `{}` — today's unchanged permissive default.
 * - Prod: only origins in `CORS_ORIGINS` are reflected; an empty/unset
 *   allowlist means EVERY browser origin is rejected — fail closed rather
 *   than silently falling back to permissive.
 */
export function resolveCorsOptions(env: NodeJS.ProcessEnv = process.env): FastifyCorsOptions {
  if (!isProd(env)) {
    return {};
  }

  return { origin: buildAllowlistOrigin(parseCorsOrigins(env)) };
}
