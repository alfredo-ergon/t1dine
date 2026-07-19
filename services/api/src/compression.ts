// Response compression for the T1Dine API using Node's built-in `zlib` — no
// third-party dependency, so the container image still installs with
// `pnpm install --frozen-lockfile` and no lockfile churn.
//
// Why this exists: the full food catalog (`GET /catalog/foods`) serialises to
// a ~32 MB JSON body (≈1500 foods × ~48 nutrients each). The offline-first
// mobile/web client downloads it once at startup so it can search the whole
// catalog client-side and offline afterwards. Uncompressed, that download
// overruns the client's catalog-load timeout on ordinary connections, so the
// app silently keeps showing only its tiny bundled offline catalog even
// though the API is perfectly healthy. Gzipping the JSON shrinks it by ~10×,
// which brings the download comfortably inside the client's budget.
//
// Implemented as a single `onSend` hook that compresses in-memory
// string/Buffer bodies above a threshold when the client advertises support,
// never double-encodes, and always sets `Vary: Accept-Encoding`. Compression
// runs asynchronously (`zlib.gzip`, not `gzipSync`) so a large body never
// blocks the event loop.

import zlib from "node:zlib";
import { promisify } from "node:util";
import type { FastifyInstance } from "fastify";

const gzipAsync = promisify(zlib.gzip);
const deflateAsync = promisify(zlib.deflate);

/** Bodies smaller than this are sent as-is — below it, compression's header
 * and CPU overhead outweighs any transfer saving. */
const MIN_COMPRESS_BYTES = 1024;

/**
 * Picks the response encoding from a request's `Accept-Encoding`, preferring
 * gzip (broadest client support, good ratio for JSON). Returns `null` when
 * the client advertised neither gzip nor deflate, so the caller sends the
 * body uncompressed.
 */
function chooseEncoding(acceptEncoding: string | string[] | undefined): "gzip" | "deflate" | null {
  if (acceptEncoding === undefined) return null;
  const header = (Array.isArray(acceptEncoding) ? acceptEncoding.join(",") : acceptEncoding).toLowerCase();
  if (header.includes("gzip")) return "gzip";
  if (header.includes("deflate")) return "deflate";
  return null;
}

/** Registers the compression `onSend` hook on the app. Safe for every route:
 * only sizeable in-memory bodies are ever touched. */
export function registerCompression(app: FastifyInstance): void {
  app.addHook("onSend", async (request, reply, payload): Promise<unknown> => {
    // Only compress in-memory bodies we can size and re-emit; leave streams,
    // `null`, and anything else exactly as Fastify would have sent it.
    if (typeof payload !== "string" && !Buffer.isBuffer(payload)) {
      return payload;
    }

    // Never double-encode a body another layer already compressed.
    if (reply.getHeader("content-encoding")) {
      return payload;
    }

    // Correct caching: the body depends on the request's Accept-Encoding, so
    // advertise that regardless of whether we end up compressing this one.
    const existingVary = reply.getHeader("vary");
    if (existingVary === undefined) {
      reply.header("vary", "Accept-Encoding");
    } else if (typeof existingVary === "string" && !existingVary.toLowerCase().includes("accept-encoding")) {
      reply.header("vary", `${existingVary}, Accept-Encoding`);
    }

    const buffer = typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
    if (buffer.length < MIN_COMPRESS_BYTES) {
      return payload;
    }

    const encoding = chooseEncoding(request.headers["accept-encoding"]);
    if (encoding === null) {
      return payload;
    }

    const compressed = encoding === "gzip" ? await gzipAsync(buffer) : await deflateAsync(buffer);
    reply.header("content-encoding", encoding);
    reply.header("content-length", compressed.length);
    return compressed;
  });
}
