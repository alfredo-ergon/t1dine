// Encryption-at-rest for the admin-managed Anthropic API key (see
// `./repositories/settingsRepository.ts` / `./modules/aiConfigAdmin.ts`).
// AES-256-GCM with a random IV per encryption; the 32-byte key is derived
// from `SETTINGS_SECRET` (or a fixed, clearly-insecure dev fallback — same
// pattern as `resolveAuthSecret()` in `./modules/auth.ts`) via `scrypt` with
// a fixed, non-secret application salt (the salt only needs to be unique to
// this codebase, not secret — the actual secrecy comes entirely from
// `SETTINGS_SECRET`).
//
// PRIVACY: this module NEVER logs a plaintext key, a decrypted value, or
// `SETTINGS_SECRET` itself — the only `console.*` call is a single,
// non-sensitive one-line warning when `SETTINGS_SECRET` is unset (mirrors
// `resolveAuthSecret()`, logged at most once per process).

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12; // recommended GCM nonce size
// Fixed, non-secret application salt — NOT a substitute for `SETTINGS_SECRET`.
// It only scopes this codebase's key derivation so it can never collide with
// an unrelated use of the same secret string elsewhere; all real secrecy
// comes from `SETTINGS_SECRET` itself.
const APP_SALT = "t1dine-ai-config-settings-v1";

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, APP_SALT, KEY_LENGTH_BYTES);
}

/**
 * Encrypts `plaintext` with AES-256-GCM under a key derived from `secret`. A
 * fresh random IV is generated on every call (never reused), so encrypting
 * the same plaintext twice with the same secret yields two different
 * ciphertexts. Returns `iv.authTag.ciphertext`, each base64-encoded and
 * dot-joined — pure, no I/O, and never logs `plaintext` or `secret`.
 */
export function encryptSecret(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

/**
 * Reverses `encryptSecret`. Throws if `secret` is wrong (GCM auth-tag
 * verification fails) or `packed` is malformed — never returns a
 * silently-corrupted plaintext. Pure, no I/O, never logs `packed`, `secret`,
 * or the recovered plaintext.
 */
export function decryptSecret(packed: string, secret: string): string {
  const parts = packed.split(".");
  const [ivB64, authTagB64, ciphertextB64] = parts;
  if (parts.length !== 3 || ivB64 === undefined || authTagB64 === undefined || ciphertextB64 === undefined) {
    throw new Error("decryptSecret: malformed ciphertext (expected iv.authTag.ciphertext).");
  }

  const key = deriveKey(secret);
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/** Exported so `./prodGate.ts` can recognise "still the dev default" as a
 * fail-closed-in-production condition (C1) without duplicating the literal
 * string. */
export const DEV_FALLBACK_SETTINGS_SECRET = "t1dine-dev-only-insecure-settings-secret-change-me";
let warnedAboutFallbackSecret = false;

/**
 * Resolves the server-side encryption secret from `SETTINGS_SECRET`, falling
 * back to a fixed, clearly-insecure dev secret (with a one-line,
 * non-sensitive startup warning — logged at most once per process) when
 * unset. Mirrors `resolveAuthSecret()` in `./modules/auth.ts`. Callers pass
 * the resolved secret into `encryptSecret`/`decryptSecret` explicitly, which
 * stay pure and never read the environment themselves.
 */
export function resolveSettingsSecret(): string {
  const secret = process.env["SETTINGS_SECRET"];
  if (secret && secret.trim().length > 0) {
    return secret;
  }
  if (!warnedAboutFallbackSecret) {
    warnedAboutFallbackSecret = true;
    console.warn(
      "[t1dine-api] SETTINGS_SECRET is not set; using an insecure fixed development secret. Set SETTINGS_SECRET before deploying.",
    );
  }
  return DEV_FALLBACK_SETTINGS_SECRET;
}
