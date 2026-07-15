// Local persistence for the signed-in account's session (Slice: accounts +
// multi-device sync). This app is offline-first and local-first: signing in
// is always an enhancement (multi-device sync) — every screen and every
// other storage key in this app keeps working with no session at all.
//
// PRIVACY: a bearer token is a high-impact credential (CLAUDE.md /
// privacy-security rules: "Treat Nightscout tokens as high-impact
// credentials" — the same standard applies here). It is stored ONLY in
// AsyncStorage under its own key, is never included in `dataExport.ts`'s
// export bundle, and is never logged.

import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_TOKEN_KEY = "t1dine.authToken";
const AUTH_EMAIL_KEY = "t1dine.authEmail";

export interface StoredSession {
  token: string;
  email: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Loads the persisted session, or `null` if none is stored / storage is
 * unavailable / the stored value is malformed — never throws. */
export async function loadSession(): Promise<StoredSession | null> {
  try {
    const [token, email] = await Promise.all([AsyncStorage.getItem(AUTH_TOKEN_KEY), AsyncStorage.getItem(AUTH_EMAIL_KEY)]);
    if (!isNonEmptyString(token) || !isNonEmptyString(email)) return null;
    return { token, email };
  } catch {
    return null;
  }
}

/** Persists a session after a successful register/login. Best-effort: a
 * storage failure never blocks the in-memory sign-in from working for the
 * rest of this app run. */
export async function saveSession(session: StoredSession): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [AUTH_TOKEN_KEY, session.token],
      [AUTH_EMAIL_KEY, session.email],
    ]);
  } catch {
    // Best-effort persistence only.
  }
}

/** Clears the stored session on logout. Deliberately does NOT touch any
 * other storage key — favourites, recents, and custom foods are local-first
 * data that a user keeps on this device after logging out. */
export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_EMAIL_KEY]);
  } catch {
    // Best-effort persistence only.
  }
}
