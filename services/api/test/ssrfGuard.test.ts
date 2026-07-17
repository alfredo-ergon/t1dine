// Unit tests for the SSRF guard (security review H1) in full isolation —
// no network, no real DNS. See `../src/ssrfGuard.ts` for the full contract.

import { describe, expect, it } from "vitest";
import { isBlockedLiteralIp, isBlockedTarget } from "../src/ssrfGuard.js";

const NO_DNS = async (): Promise<never> => {
  throw new Error("dns lookup unavailable in tests");
};

describe("isBlockedLiteralIp", () => {
  it("blocks every documented IPv4 range", () => {
    expect(isBlockedLiteralIp("127.0.0.1")).toBe(true); // loopback /8
    expect(isBlockedLiteralIp("10.1.2.3")).toBe(true); // 10.0.0.0/8
    expect(isBlockedLiteralIp("172.16.0.1")).toBe(true); // 172.16.0.0/12 (low end)
    expect(isBlockedLiteralIp("172.31.255.255")).toBe(true); // 172.16.0.0/12 (high end)
    expect(isBlockedLiteralIp("192.168.1.1")).toBe(true); // 192.168.0.0/16
    expect(isBlockedLiteralIp("169.254.169.254")).toBe(true); // metadata address
    expect(isBlockedLiteralIp("169.254.1.1")).toBe(true); // 169.254.0.0/16
  });

  it("does not block a public IPv4 address, or a 172.x address just outside 172.16.0.0/12", () => {
    expect(isBlockedLiteralIp("203.0.113.10")).toBe(false);
    expect(isBlockedLiteralIp("172.32.0.1")).toBe(false);
    expect(isBlockedLiteralIp("172.15.255.255")).toBe(false);
  });

  it("blocks IPv6 loopback and unique-local addresses", () => {
    expect(isBlockedLiteralIp("::1")).toBe(true);
    expect(isBlockedLiteralIp("fc00::1")).toBe(true);
    expect(isBlockedLiteralIp("fd12:3456::1")).toBe(true);
    expect(isBlockedLiteralIp("fe80::1")).toBe(true); // link-local
  });

  it("blocks an IPv4-mapped IPv6 literal representing a blocked IPv4 address", () => {
    expect(isBlockedLiteralIp("::ffff:169.254.169.254")).toBe(true);
    expect(isBlockedLiteralIp("::ffff:203.0.113.10")).toBe(false);
  });

  it("does not block a public IPv6 address", () => {
    expect(isBlockedLiteralIp("2001:db8::1")).toBe(false);
  });

  it("returns false for a non-IP hostname (not its job — that's the DNS-resolve path)", () => {
    expect(isBlockedLiteralIp("example.com")).toBe(false);
  });
});

describe("isBlockedTarget", () => {
  it("blocks a non-https url regardless of host", async () => {
    expect(await isBlockedTarget("http://example.test/", { dnsLookupImpl: NO_DNS })).toBe(true);
  });

  it("blocks an unparsable url", async () => {
    expect(await isBlockedTarget("not-a-url", { dnsLookupImpl: NO_DNS })).toBe(true);
  });

  it("blocks localhost by name, case-insensitively", async () => {
    expect(await isBlockedTarget("https://localhost/", { dnsLookupImpl: NO_DNS })).toBe(true);
    expect(await isBlockedTarget("https://LOCALHOST/", { dnsLookupImpl: NO_DNS })).toBe(true);
  });

  it("blocks a literal blocked IP without needing DNS", async () => {
    const dnsLookupImpl = async (): Promise<never> => {
      throw new Error("must not be called for a literal IP");
    };
    expect(await isBlockedTarget("https://169.254.169.254/", { dnsLookupImpl })).toBe(true);
    expect(await isBlockedTarget("https://[::1]/", { dnsLookupImpl })).toBe(true);
  });

  it("blocks a hostname that DNS resolves to a blocked address", async () => {
    const dnsLookupImpl = async () => [{ address: "10.0.0.5", family: 4 }];
    expect(await isBlockedTarget("https://sneaky.test/", { dnsLookupImpl })).toBe(true);
  });

  it("blocks a hostname when ANY resolved address is blocked, even alongside a public one", async () => {
    const dnsLookupImpl = async () => [
      { address: "203.0.113.10", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ];
    expect(await isBlockedTarget("https://mixed.test/", { dnsLookupImpl })).toBe(true);
  });

  it("allows a normal https hostname that DNS resolves to a public address", async () => {
    const dnsLookupImpl = async () => [{ address: "203.0.113.10", family: 4 }];
    expect(await isBlockedTarget("https://public.test/", { dnsLookupImpl })).toBe(false);
  });

  it("does not block (safe fallback) when DNS resolution itself fails", async () => {
    expect(await isBlockedTarget("https://unresolvable.test/", { dnsLookupImpl: NO_DNS })).toBe(false);
  });
});
