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

import { DEFAULT_PROFILE_ID, getActiveProfileId } from "./profiles";

// Slice: caregiver profiles ("Perfis"). The Nightscout connection is
// per-profile — a caregiver's own real-time-glucose credential must never be
// shown against, or usable from, a dependent's profile, or vice versa (this
// is exactly the kind of "high-impact credential" CLAUDE.md calls out, so
// getting this isolation right matters more here than anywhere else in the
// app). `URL_KEY`/`TOKEN_KEY` below are used as the legacy/base keys for
// migration; unlike every other per-profile store, this module does NOT use
// ../profiles.ts's `profileKey` helper, because expo-secure-store keys only
// allow alphanumeric characters, ".", "-", and "_" — the "::" separator
// `profileKey` uses is rejected by the native secure store. `secureKeyFor`
// below is this module's own, differently-separated key helper.
const URL_KEY = "t1dine.nightscout.url";
const TOKEN_KEY = "t1dine.nightscout.token";

function secureKeyFor(base: string, profileId: string): string {
  return `${base}.${profileId}`;
}

export interface NightscoutConnection {
  url: string;
  token: string;
}

/** Web-only, session-scoped fallback, keyed by profile id — intentionally
 * never written to any persistent web storage. Cleared on page reload,
 * matching `isPersistent`. */
const webSessionConnections = new Map<string, NightscoutConnection>();

/** True when this platform can actually persist the connection across app
 * restarts (native, via the OS keychain/keystore). False on web, where a
 * saved connection only lives in memory for the current session — the
 * connect UI must surface this so the user isn't surprised it didn't
 * "stick". */
export const isPersistent = Platform.OS !== "web";

/**
 * Non-destructive, idempotent, one-way migration onto the default profile —
 * mirrors ../profiles.ts's `migrateLegacyKey`, but reimplemented locally
 * against SecureStore's (rather than AsyncStorage's) API. A no-op for every
 * profile other than the default one, and never overwrites (or deletes) an
 * existing per-profile or legacy connection.
 */
async function migrateLegacyConnectionIfNeeded(profileId: string): Promise<void> {
  if (profileId !== DEFAULT_PROFILE_ID) return;
  try {
    const [namespacedUrl, namespacedToken] = await Promise.all([
      SecureStore.getItemAsync(secureKeyFor(URL_KEY, profileId)),
      SecureStore.getItemAsync(secureKeyFor(TOKEN_KEY, profileId)),
    ]);
    if (namespacedUrl !== null || namespacedToken !== null) return;

    const [legacyUrl, legacyToken] = await Promise.all([SecureStore.getItemAsync(URL_KEY), SecureStore.getItemAsync(TOKEN_KEY)]);
    if (!legacyUrl || !legacyToken) return;

    await Promise.all([
      SecureStore.setItemAsync(secureKeyFor(URL_KEY, profileId), legacyUrl),
      SecureStore.setItemAsync(secureKeyFor(TOKEN_KEY, profileId), legacyToken),
    ]);
  } catch {
    // Best-effort — a failed migration must never block the (already
    // fail-safe) load path below; it simply tries again next load.
  }
}

/**
 * Saves the ACTIVE profile's Nightscout url + token. On native this writes to
 * the OS secure store and REJECTS if that fails (e.g. an unavailable
 * keystore) — the caller must treat that as "not connected" rather than
 * silently reporting success for a credential this sensitive. On web this
 * only ever updates the in-memory session value (for this profile) and
 * cannot fail.
 */
export async function saveConnection(connection: NightscoutConnection): Promise<void> {
  const profileId = getActiveProfileId();
  if (Platform.OS === "web") {
    webSessionConnections.set(profileId, connection);
    return;
  }
  try {
    await SecureStore.setItemAsync(secureKeyFor(URL_KEY, profileId), connection.url);
    await SecureStore.setItemAsync(secureKeyFor(TOKEN_KEY, profileId), connection.token);
  } catch {
    throw new Error("nightscout_secure_store_unavailable");
  }
}

/**
 * Loads the ACTIVE profile's stored connection, or `null` if none is saved
 * (or the platform store is unavailable/corrupt — never throws). Callers
 * that only need to know "is something connected" should prefer
 * `hasConnection()` below so the token stays scoped to the one place that
 * actually needs it (building an outgoing sync request).
 */
export async function loadConnection(): Promise<NightscoutConnection | null> {
  const profileId = getActiveProfileId();
  if (Platform.OS === "web") {
    return webSessionConnections.get(profileId) ?? null;
  }
  try {
    await migrateLegacyConnectionIfNeeded(profileId);
    const [url, token] = await Promise.all([
      SecureStore.getItemAsync(secureKeyFor(URL_KEY, profileId)),
      SecureStore.getItemAsync(secureKeyFor(TOKEN_KEY, profileId)),
    ]);
    if (!url || !token) return null;
    return { url, token };
  } catch {
    return null;
  }
}

/** True when a Nightscout connection is currently stored for the ACTIVE
 * profile (native: OS keystore; web: this session's in-memory value only). */
export async function hasConnection(): Promise<boolean> {
  return (await loadConnection()) !== null;
}

/**
 * Clears the ACTIVE profile's stored url + token. Best-effort and idempotent
 * — safe to call even when nothing is currently stored (e.g. the "Desligar"
 * button in ../screens/GlucoseScreen.tsx).
 */
export async function clearConnection(): Promise<void> {
  await clearProfileData(getActiveProfileId());
}

/**
 * Removes THIS SPECIFIC profile's Nightscout connection — used when a
 * profile is deleted (App.tsx's handleDeleteProfile) or when every profile's
 * data is wiped ("Apagar todos os meus dados"). Takes an explicit
 * `profileId` (not necessarily the active one), unlike `clearConnection`
 * above. Never touches the legacy, un-namespaced keys or any OTHER profile's
 * connection.
 */
export async function clearProfileData(profileId: string): Promise<void> {
  if (Platform.OS === "web") {
    webSessionConnections.delete(profileId);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(secureKeyFor(URL_KEY, profileId));
    await SecureStore.deleteItemAsync(secureKeyFor(TOKEN_KEY, profileId));
  } catch {
    // Best-effort: if the OS keystore itself can't be reached to delete,
    // there's nothing else this module can safely do.
  }
}
