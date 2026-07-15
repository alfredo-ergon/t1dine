"use client";

// Curator (admin) session token storage for the browser.
//
// The admin endpoints (`/admin/*`) require an `Authorization: Bearer <token>`
// header, so the curator's token — obtained from `POST /auth/login` — has to be
// available client-side. It is kept in `localStorage` under a single key and
// exposed through the `useAdminToken` hook.
//
// SCOPE NOTE (privacy/security): this is a *bearer token for a synthetic dev
// admin account*, not health data. It is never logged and never placed in
// telemetry. `localStorage` is the pragmatic store for an internal curation
// tool; a production deployment would move to an httpOnly cookie. The token is
// treated as sensitive: only ever read to build the Authorization header.

import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "t1dine-admin-token";

/** Module-level subscribers so every mounted `useAdminToken` in the same tab
 * re-reads the token when login/logout happens anywhere (the native `storage`
 * event only fires in *other* tabs, so we notify within this tab ourselves). */
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Reads the stored token, tolerating environments without `localStorage`
 * (SSR, private-mode quota errors) by returning `null` rather than throwing. */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore storage failures (quota/private mode): the in-memory state below
    // still updates via notify(), so the session works for this page load.
  }
  notify();
}

export function clearStoredToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore — see setStoredToken.
  }
  notify();
}

export interface AdminSession {
  /** The bearer token, or `null` when no curator is signed in. */
  token: string | null;
  /** `false` until the first client-side read has happened. Guards against a
   * hydration mismatch: server render and first client render both see
   * `token: null, ready: false`, so nothing token-dependent renders until the
   * effect has run. */
  ready: boolean;
  setToken: (token: string) => void;
  clearToken: () => void;
}

/**
 * React hook exposing the curator session token plus setters. `ready` flips to
 * `true` only after the first `localStorage` read in a `useEffect`, so callers
 * can show a neutral placeholder during the (very brief) pre-hydration window
 * instead of flashing the login form to an already-signed-in curator.
 */
export function useAdminToken(): AdminSession {
  const [token, setTokenState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = (): void => setTokenState(getStoredToken());
    sync();
    setReady(true);

    listeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      listeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setToken = useCallback((next: string) => setStoredToken(next), []);
  const clearToken = useCallback(() => clearStoredToken(), []);

  return { token, ready, setToken, clearToken };
}
