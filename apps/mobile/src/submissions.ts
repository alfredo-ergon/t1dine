// Local-first record of the foods THIS user has submitted to the shared
// catalog (Slice: "As minhas contribuições" / my submissions). There is no
// per-user submissions GET endpoint on the API, so this is deliberately
// device-local only — recorded at submit time from DetailScreen's own
// successful `POST /catalog/submissions` response, never fetched from the
// network. Like every other local list in this app (favourites/recents),
// values read back out of AsyncStorage are re-validated rather than trusted
// (CLAUDE.md: "All external data is untrusted. Validate at boundaries.").

import AsyncStorage from "@react-native-async-storage/async-storage";

import { getActiveProfileId, migrateLegacyKey, profileKey } from "./profiles";

// Slice: caregiver profiles ("Perfis"). "As minhas contribuições" is
// per-profile — see ../mealHistory.ts's identical note. `SUBMISSIONS_KEY`
// below is used as the "base" passed to `profileKey`/`migrateLegacyKey`.
const SUBMISSIONS_KEY = "t1dine.mySubmissions";

/** Always "pending" today — this app has no way to learn that a curator has
 * since approved/rejected a submission (no per-user status endpoint), so the
 * status shown is honestly "as of submission time", never claimed as live. */
export type SubmissionStatus = "pending";

export interface SubmissionRecord {
  /** The catalog submission id returned by `POST /catalog/submissions`. */
  id: string;
  /** Display name captured at submit time (in whichever language was active). */
  name: string;
  /** ISO timestamp of when this device submitted it. */
  submittedAt: string;
  status: SubmissionStatus;
}

function isSubmissionRecord(value: unknown): value is SubmissionRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.submittedAt === "string" &&
    record.status === "pending"
  );
}

/** Loads every submission recorded on this device (for the ACTIVE profile),
 * newest first. Never throws — corrupt/unavailable storage degrades to an
 * empty list. */
export async function loadSubmissions(): Promise<SubmissionRecord[]> {
  const profileId = getActiveProfileId();
  const key = profileKey(SUBMISSIONS_KEY, profileId);
  await migrateLegacyKey(SUBMISSIONS_KEY, profileId, key);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSubmissionRecord);
  } catch {
    return [];
  }
}

/** Records a just-submitted food (for the ACTIVE profile) at the front of the
 * list (de-duplicated by id, in case the same submission id were ever
 * recorded twice). Best-effort: a storage failure here must never surface as
 * an error on top of an already-successful submission. */
export async function recordSubmission(record: SubmissionRecord): Promise<void> {
  try {
    const existing = await loadSubmissions();
    const next = [record, ...existing.filter((item) => item.id !== record.id)];
    await AsyncStorage.setItem(profileKey(SUBMISSIONS_KEY, getActiveProfileId()), JSON.stringify(next));
  } catch {
    // Best-effort persistence only — the submission itself already succeeded.
  }
}

/**
 * Removes THIS SPECIFIC profile's entire submissions list — used when a
 * profile is deleted (App.tsx's handleDeleteProfile) or when every profile's
 * data is wiped ("Apagar todos os meus dados"). Takes an explicit
 * `profileId` (not necessarily the active one).
 */
export async function clearProfileData(profileId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(profileKey(SUBMISSIONS_KEY, profileId));
  } catch {
    // Best-effort persistence only.
  }
}
