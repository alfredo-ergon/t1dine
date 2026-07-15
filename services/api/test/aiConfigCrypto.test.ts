// Coverage for `../src/aiConfigCrypto.ts`'s pure encrypt/decrypt pair: a
// round trip recovers the plaintext, the ciphertext never equals (or
// embeds) the plaintext, encrypting the same plaintext twice yields
// different ciphertexts (random IV), and decrypting with the wrong secret
// fails rather than silently returning corrupted data.

import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../src/aiConfigCrypto.js";

const SECRET = "fixed-test-settings-secret-abc123";
const OTHER_SECRET = "a-completely-different-secret-xyz789";
const FAKE_API_KEY = "sk-ant-test-1234";

describe("aiConfigCrypto", () => {
  it("round-trips plaintext through encrypt -> decrypt", () => {
    const ciphertext = encryptSecret(FAKE_API_KEY, SECRET);
    expect(decryptSecret(ciphertext, SECRET)).toBe(FAKE_API_KEY);
  });

  it("produces a ciphertext that never equals or embeds the plaintext", () => {
    const ciphertext = encryptSecret(FAKE_API_KEY, SECRET);
    expect(ciphertext).not.toBe(FAKE_API_KEY);
    expect(ciphertext).not.toContain(FAKE_API_KEY);
  });

  it("produces a different ciphertext on every call (random IV), both still decrypting correctly", () => {
    const first = encryptSecret(FAKE_API_KEY, SECRET);
    const second = encryptSecret(FAKE_API_KEY, SECRET);

    expect(first).not.toBe(second);
    expect(decryptSecret(first, SECRET)).toBe(FAKE_API_KEY);
    expect(decryptSecret(second, SECRET)).toBe(FAKE_API_KEY);
  });

  it("fails to decrypt with the wrong secret", () => {
    const ciphertext = encryptSecret(FAKE_API_KEY, SECRET);
    expect(() => decryptSecret(ciphertext, OTHER_SECRET)).toThrow();
  });

  it("throws on a malformed (non iv.authTag.ciphertext) input", () => {
    expect(() => decryptSecret("not-a-valid-packed-ciphertext", SECRET)).toThrow();
  });
});
