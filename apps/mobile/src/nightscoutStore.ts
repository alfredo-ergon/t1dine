// Platform-aware secure store for the user's Nightscout connection (Slice 6 —
// read-only glucose display). A Nightscout read token is a HIGH-IMPACT
// credential (CLAUDE.md: "Treat Nightscout tokens as high-impact
// credentials."), so this module deliberately does NOT reuse
// `@react-native-async-storage/async-storage` (plain, unencrypted disk
// storage — see ../src/storage.ts) the way every other local preference in
// this app is persisted.
//
//   - Native (iOS/Android): backed by `expo-secure-store`, which stores each
//     value in the OS keychain/keystore.
//   - Web: `expo-secure-store` has no implementation there, and this app must
//     NEVER fall back to `localStorage`/AsyncStorage for a credential this
//     sensitive. Instead, the web build keeps the connection in an in-memory,
//     module-level variable only — it survives for the current tab/session
//     and is gone on reload. `isPersistent` tells the UI which case it's in
//     so it can set the right expectation ("nesta plataforma a ligação não é
//     guardada").
//
// Nothing in this module ever calls `console.*`/logs a url or token, and no
// caller should either (see ../screens/GlucoseScreen.tsx and
// ../components/NightscoutConnectPanel.tsx).

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const URL_KEY = "t1dine.nightscout.url";
const TOKEN_KEY = "t1dine.nightscout.token";

export interface NightscoutConnection {
  url: string;
  token: string;
}

/** Web-only, session-scoped fallback — intentionally never written to any
 * persistent web storage. Cleared on page reload, matching `isPersistent`. */
let webSessionConnection: NightscoutConnection | null = null;

/** True when this platform can actually persist the connection across app
 * restarts (native, via the OS keychain/keystore). False on web, where a
 * saved connection only lives in memory for the current session — the
 * connect UI must surface this so the user isn't surprised it didn't
 * "stick". */
export const isPersistent = Platform.OS !== "web";

/**
 * Saves the Nightscout url + token. On native this writes to the OS secure
 * store and REJECTS if that fails (e.g. an unavailable keystore) — the
 * caller must treat that as "not connected" rather than silently reporting
 * success for a credential this sensitive. On web this only ever updates the
 * in-memory session value and cannot fail.
 */
export async function saveConnection(connection: NightscoutConnection): Promise<void> {
  if (Platform.OS === "web") {
    webSessionConnection = connection;
    return;
  }
  try {
    await SecureStore.setItemAsync(URL_KEY, connection.url);
    await SecureStore.setItemAsync(TOKEN_KEY, connection.token);
  } catch {
    throw new Error("nightscout_secure_store_unavailable");
  }
}

/**
 * Loads the stored connection, or `null` if none is saved (or the platform
 * store is unavailable/corrupt — never throws). Callers that only need to
 * know "is something connected" should prefer `hasConnection()` below so the
 * token stays scoped to the one place that actually needs it (building an
 * outgoing sync request).
 */
export async function loadConnection(): Promise<NightscoutConnection | null> {
  if (Platform.OS === "web") {
    return webSessionConnection;
  }
  try {
    const [url, token] = await Promise.all([SecureStore.getItemAsync(URL_KEY), SecureStore.getItemAsync(TOKEN_KEY)]);
    if (!url || !token) return null;
    return { url, token };
  } catch {
    return null;
  }
}

/** True when a Nightscout connection is currently stored (native: OS
 * keystore; web: this session's in-memory value only). */
export async function hasConnection(): Promise<boolean> {
  return (await loadConnection()) !== null;
}

/**
 * Clears the stored url + token. Best-effort and idempotent — safe to call
 * even when nothing is currently stored (e.g. from the "Apagar todos os meus
 * dados" flow, which always clears this alongside every other local store).
 */
export async function clearConnection(): Promise<void> {
  if (Platform.OS === "web") {
    webSessionConnection = null;
    return;
  }
  try {
    await SecureStore.deleteItemAsync(URL_KEY);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Best-effort: if the OS keystore itself can't be reached to delete,
    // there's nothing else this module can safely do.
  }
}
