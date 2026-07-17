// SSRF guard for outbound requests to a caller-supplied url (security review
// H1 — currently only `POST /integrations/nightscout/glucose`, see
// `./modules/nightscout.ts`). A Nightscout base url is user input; without
// this guard a caller could point the server at an internal service, a
// cloud metadata endpoint, or a loopback address and use this API as a
// blind proxy into the deployment's own network.
//
// CONTRACT:
//   1. Only `https:` is ever allowed — a caller-supplied `http:` url is
//      rejected outright, independent of the target host.
//   2. A literal IP address (v4 or v6) is checked directly against the
//      blocked ranges below — no DNS lookup needed or attempted.
//   3. A hostname (not a literal IP) is resolved via DNS and EVERY returned
//      address is checked — this defends against a hostname that itself
//      resolves straight to a private/metadata address (DNS rebinding /
//      attacker-controlled DNS).
//   4. SAFE FALLBACK: if DNS resolution itself fails (unknown host, no
//      network, ...), this is NOT treated as blocked. The literal-hostname
//      and literal-IP checks above already cover every case that does not
//      require DNS, and the actual outbound `fetchImpl` call will
//      independently fail closed (502 `upstream_unreachable`) if the host is
//      genuinely unreachable — see `./modules/nightscout.ts`. Never blocking
//      solely because DNS resolution failed avoids this guard itself
//      becoming a source of false positives/outages.
//   5. Callers must return a GENERIC error on any block (this module has no
//      opinion on the HTTP response — see `./modules/nightscout.ts`) that
//      never reveals *which* rule matched, so a caller cannot use this
//      endpoint to fingerprint the deployment's internal network.

import { lookup as nodeDnsLookup } from "node:dns/promises";

export interface DnsAddressRecord {
  address: string;
  family: number;
}

export type DnsLookupImpl = (hostname: string) => Promise<DnsAddressRecord[]>;

/** Real DNS resolution, wrapping `node:dns/promises`. The default
 * `dnsLookupImpl` for `isBlockedTarget`; tests inject a fake in its place
 * (see `./modules/nightscout.ts`'s `NightscoutDeps.dnsLookupImpl`) so the
 * test suite never depends on real network access. */
export async function defaultDnsLookup(hostname: string): Promise<DnsAddressRecord[]> {
  return nodeDnsLookup(hostname, { all: true });
}

const BLOCKED_HOSTNAMES = new Set(["localhost"]);

function isIPv4Literal(hostname: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

function parseIPv4Octets(address: string): [number, number, number, number] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (!match) return null;
  const octets = [match[1], match[2], match[3], match[4]].map((part) => Number(part));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return octets as [number, number, number, number];
}

/** 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, and 169.254.0.0/16
 * (which covers the 169.254.169.254 cloud metadata address). */
function isBlockedIPv4(address: string): boolean {
  const octets = parseIPv4Octets(address);
  if (!octets) return false;
  const [a, b] = octets;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/** `::1` loopback, `fc00::/7` unique-local addresses, an IPv4-mapped literal
 * (`::ffff:a.b.c.d`, re-checked as IPv4), and (defence-in-depth, symmetric
 * with the IPv4 169.254.0.0/16 check above) `fe80::/10` link-local. */
function isBlockedIPv6(address: string): boolean {
  const normalised = address.toLowerCase();
  if (normalised === "::1") return true;

  const mappedMatch = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(normalised);
  if (mappedMatch?.[1]) return isBlockedIPv4(mappedMatch[1]);

  const firstGroup = normalised.split(":")[0];
  if (firstGroup && /^[0-9a-f]{1,4}$/.test(firstGroup)) {
    const value = parseInt(firstGroup, 16);
    if (value >= 0xfc00 && value <= 0xfdff) return true; // fc00::/7
    if (value >= 0xfe80 && value <= 0xfebf) return true; // fe80::/10
  }
  return false;
}

function stripBrackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

/** `true` when `candidate` is itself a literal IP address (v4 or v6, brackets
 * already stripped) in a blocked range. */
export function isBlockedLiteralIp(candidate: string): boolean {
  if (isIPv4Literal(candidate)) return isBlockedIPv4(candidate);
  if (candidate.includes(":")) return isBlockedIPv6(candidate);
  return false;
}

export interface IsBlockedTargetOptions {
  /** Injectable DNS resolver — test seam only. Defaults to
   * `defaultDnsLookup`. */
  dnsLookupImpl?: DnsLookupImpl;
}

/**
 * `true` when `rawUrl` must NOT be fetched server-side: non-`https`,
 * `localhost` by name, a literal IP in a blocked range, or a hostname that
 * DNS resolves to one. See the module header for the full contract
 * (including the "safe fallback" behaviour on a DNS resolution failure).
 */
export async function isBlockedTarget(rawUrl: string, options: IsBlockedTargetOptions = {}): Promise<boolean> {
  const dnsLookupImpl = options.dnsLookupImpl ?? defaultDnsLookup;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true; // fail closed: cannot even parse the caller-supplied url
  }

  if (parsed.protocol !== "https:") return true;

  const hostname = stripBrackets(parsed.hostname.toLowerCase());
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  if (isBlockedLiteralIp(hostname)) return true;

  try {
    const records = await dnsLookupImpl(hostname);
    return records.some((record) => isBlockedLiteralIp(record.address));
  } catch {
    // Safe fallback — see contract point 4 in the module header.
    return false;
  }
}
