// Accounts module (the "auth" half of Slice 5's accounts + sync
// foundation): registration, login, and the `requireAuth` preHandler used
// by every user-scoped route (see `../modules/sync.ts`).
//
// PASSWORD HANDLING CONTRACT — read this before touching anything here:
//   1. A plaintext password NEVER reaches a repository and is NEVER logged.
//      `Fastify({ logger: false })` is set app-wide (`app.ts`); this module
//      additionally never calls `console.*` with a password, an email, a
//      token, a hash, or a salt.
//   2. Passwords are hashed with Node's built-in `crypto.scrypt`, salted
//      with a per-user random salt (`crypto.randomBytes`) — never a fixed
//      or user-supplied salt. Verification uses a constant-time compare
//      (`crypto.timingSafeEqual`) so a mismatch never leaks timing
//      information about *where* the hash differs.
//   3. Login never reveals whether an email is registered: an unknown email
//      and a wrong password both return the same generic 401. To avoid a
//      timing side-channel that would let a caller distinguish the two
//      cases (an unknown email would otherwise skip the expensive scrypt
//      call entirely), an unknown email still runs a dummy scrypt
//      computation of the same cost before responding.
//
// TOKEN CONTRACT: a stateless, signed bearer token — HMAC-SHA256 over
// `userId` + `issuedAt`, keyed by a server secret (`AUTH_SECRET`, or a fixed,
// clearly-insecure dev fallback with a one-line startup warning). There is
// no server-side session store: `requireAuth` verifies the signature and
// trusts the embedded `userId` — it never queries the `UserRepository`, so a
// user row can be looked up by whichever route needs one, but authentication
// itself has no database dependency.

import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { UserEmailTakenError } from "../repositories/userRepository.js";
import type { UserRepository } from "../repositories/userRepository.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by `requireAuth` once the bearer token has been verified. Absent
     * on any request that has not passed through `requireAuth`. */
    userId?: string;
  }
}

const scryptAsync = promisify(scryptCallback);

// ---------------------------------------------------------------------------
// Password hashing (scrypt, per-user random salt, constant-time compare)
// ---------------------------------------------------------------------------

const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  const derivedKey = await scryptAsync(password, salt, SCRYPT_KEYLEN);
  return derivedKey as Buffer;
}

async function hashPassword(password: string): Promise<{ passwordHash: string; salt: string }> {
  const salt = randomBytes(SALT_BYTES);
  const derivedKey = await derive(password, salt);
  return { passwordHash: derivedKey.toString("hex"), salt: salt.toString("hex") };
}

async function verifyPassword(password: string, saltHex: string, expectedHashHex: string): Promise<boolean> {
  const derivedKey = await derive(password, Buffer.from(saltHex, "hex"));
  const expected = Buffer.from(expectedHashHex, "hex");
  if (derivedKey.length !== expected.length) return false;
  return timingSafeEqual(derivedKey, expected);
}

// Fixed once per process, used only to burn comparable scrypt cost on a
// login attempt against an email that is not registered — never used to
// authenticate anyone (see "TOKEN CONTRACT" note above).
const DUMMY_SALT_HEX = randomBytes(SALT_BYTES).toString("hex");
const DUMMY_HASH_HEX = randomBytes(SCRYPT_KEYLEN).toString("hex");

// ---------------------------------------------------------------------------
// Stateless signed bearer token (HMAC-SHA256 over userId + issuedAt)
// ---------------------------------------------------------------------------

const DEV_FALLBACK_AUTH_SECRET = "t1dine-dev-only-insecure-auth-secret-change-me";
let warnedAboutFallbackSecret = false;

/** Resolves the server-side HMAC secret from `AUTH_SECRET`, falling back to
 * a fixed, clearly-insecure dev secret (with a one-line, non-sensitive
 * startup warning — logged at most once per process) when unset. */
export function resolveAuthSecret(): string {
  const secret = process.env["AUTH_SECRET"];
  if (secret && secret.trim().length > 0) {
    return secret;
  }
  if (!warnedAboutFallbackSecret) {
    warnedAboutFallbackSecret = true;
    console.warn(
      "[t1dine-api] AUTH_SECRET is not set; using an insecure fixed development secret. Set AUTH_SECRET before deploying.",
    );
  }
  return DEV_FALLBACK_AUTH_SECRET;
}

/** Signs a stateless bearer token: HMAC-SHA256 over `${userId}.${issuedAt}`,
 * base64url-encoded payload + hex signature, separated by a single `.`. */
export function signToken(userId: string, secret: string, issuedAt: number = Date.now()): string {
  const payload = `${userId}.${issuedAt}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${signature}`;
}

export interface VerifiedToken {
  userId: string;
  issuedAt: number;
}

/** Verifies a bearer token against `secret` using a constant-time signature
 * compare. Returns `null` for ANY malformed, mismatched, or garbage input —
 * it never throws, so callers can fail closed with a plain `401`. */
export function verifyToken(token: string, secret: string): VerifiedToken | null {
  if (typeof token !== "string" || token.length === 0) return null;

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) return null;

  const encodedPayload = token.slice(0, separatorIndex);
  const signatureHex = token.slice(separatorIndex + 1);
  if (!/^[0-9a-f]+$/i.test(signatureHex)) return null;

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const match = /^(.+)\.(\d+)$/.exec(payload);
  if (!match) return null;
  const [, userId, issuedAtRaw] = match;
  if (!userId || !issuedAtRaw) return null;

  const expectedSignature = createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const actualBuffer = Buffer.from(signatureHex, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  return { userId, issuedAt: Number(issuedAtRaw) };
}

/** Fastify preHandler factory: verifies `Authorization: Bearer <token>`
 * against `secret` and sets `request.userId` on success, or fails closed
 * with `401` on any missing/malformed/invalid token — it never reveals
 * *why* verification failed. */
export function requireAuth(secret: string) {
  return async function requireAuthPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization;
    const BEARER_PREFIX = "Bearer ";
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      await reply.status(401).send({ error: "unauthorized", message: "Missing bearer token." });
      return;
    }

    const token = header.slice(BEARER_PREFIX.length).trim();
    const verified = verifyToken(token, secret);
    if (!verified) {
      await reply.status(401).send({ error: "unauthorized", message: "Invalid or expired token." });
      return;
    }

    request.userId = verified.userId;
  };
}

// ---------------------------------------------------------------------------
// Request contracts
// ---------------------------------------------------------------------------

const MIN_PASSWORD_LENGTH = 8;

const credentialsSchema = z.object({
  email: z
    .string({ invalid_type_error: "email must be a string" })
    .trim()
    .min(1, "email is required")
    .email("email must be a valid email address"),
  password: z
    .string({ invalid_type_error: "password must be a string" })
    .min(MIN_PASSWORD_LENGTH, `password must be at least ${MIN_PASSWORD_LENGTH} characters`),
});

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export interface AuthDeps {
  repository: UserRepository;
  secret: string;
}

/**
 * Builds the auth route plugin bound to a specific `UserRepository` instance
 * and HMAC secret, mirroring the closure pattern already used by
 * `mealsRoutes`/`nightscoutRoutes` — this keeps the injected dependencies
 * fully typed without an `unknown`-typed Fastify options bag.
 */
export function authRoutes(deps: AuthDeps) {
  const { repository, secret } = deps;

  return async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
    app.post("/auth/register", async (request, reply) => {
      const parsedBody = credentialsSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "invalid_body",
          message: "Registration request body failed validation.",
          issues: parsedBody.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`),
        });
      }

      const { email, password } = parsedBody.data;

      const existing = await repository.findByEmail(email);
      if (existing) {
        return reply.status(409).send({
          error: "email_taken",
          message: "An account with this email already exists.",
        });
      }

      const { passwordHash, salt } = await hashPassword(password);

      try {
        const user = await repository.create({ email, passwordHash, salt });
        const token = signToken(user.id, secret);
        return reply.status(201).send({ token });
      } catch (error) {
        if (error instanceof UserEmailTakenError) {
          // Defence-in-depth: a concurrent register raced past the
          // `findByEmail` check above and the repository's own uniqueness
          // guard caught it.
          return reply.status(409).send({
            error: "email_taken",
            message: "An account with this email already exists.",
          });
        }
        throw error;
      }
    });

    app.post("/auth/login", async (request, reply) => {
      const parsedBody = credentialsSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "invalid_body",
          message: "Login request body failed validation.",
          issues: parsedBody.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`),
        });
      }

      const { email, password } = parsedBody.data;
      const user = await repository.findByEmail(email);

      let passwordMatches = false;
      if (user) {
        passwordMatches = await verifyPassword(password, user.salt, user.passwordHash);
      } else {
        // Burn a comparable scrypt cost so responding to an unregistered
        // email takes about as long as a registered one with a wrong
        // password — see the "TOKEN CONTRACT" note above.
        await verifyPassword(password, DUMMY_SALT_HEX, DUMMY_HASH_HEX);
      }

      if (!user || !passwordMatches) {
        return reply.status(401).send({
          error: "invalid_credentials",
          message: "Invalid email or password.",
        });
      }

      const token = signToken(user.id, secret);
      return reply.send({ token });
    });
  };
}
