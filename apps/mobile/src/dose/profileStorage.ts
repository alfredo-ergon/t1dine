// Offline persistence for the user's Dose Assist clinical profile — a NEW,
// separate AsyncStorage key from the food/meal data in ../storage.ts, since
// this is clinical configuration, not food data. Local-device only; nothing
// here is synced or sent anywhere.
//
// As with ../storage.ts, values coming back out of AsyncStorage are still
// "external" input (CLAUDE.md: "All external data is untrusted. Validate at
// boundaries."), so a stored profile is re-validated on load and never
// trusted as-is. A corrupt/missing record must fail closed to the safe
// built-in default (DEFAULT_DOSE_PROFILE) rather than crash or silently use
// an invalid value in a dose calculation.
//
// This module has NO import of @t1dine/dose-engine — it only reads/writes
// the plain DoseProfile settings object.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { getActiveProfileId, migrateLegacyKey, profileKey } from "../profiles";
import { DEFAULT_DOSE_PROFILE, type DoseProfile, type GlucoseUnit } from "./profile";

// Slice: caregiver profiles ("Perfis"). The clinical Dose Assist profile is
// per-profile too — a caregiver's own carb ratio/correction factor must never
// be applied to a dependent's estimate, or vice versa (this is a KEY-only
// namespacing change — no dose calculation/maths in ../dose/index or
// packages/dose-engine is touched). `DOSE_PROFILE_KEY` below is used as the
// "base" passed to `profileKey`/`migrateLegacyKey`.
const DOSE_PROFILE_KEY = "t1dine.doseProfile";

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isGlucoseUnit(value: unknown): value is GlucoseUnit {
  return value === "mg/dL" || value === "mmol/L";
}

function isDoseProfile(value: unknown): value is DoseProfile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    isFinitePositiveNumber(candidate.carbGramsPerUnit) &&
    isFinitePositiveNumber(candidate.glucosePerCorrectionUnit) &&
    isFinitePositiveNumber(candidate.targetGlucose) &&
    isGlucoseUnit(candidate.glucoseUnit) &&
    isFinitePositiveNumber(candidate.administrationIncrementUnits) &&
    isFinitePositiveNumber(candidate.maximumEstimateUnits) &&
    isFinitePositiveNumber(candidate.minimumGlucoseToDose) &&
    typeof candidate.version === "string" &&
    candidate.version.trim().length > 0
  );
}

export interface LoadedDoseProfile {
  profile: DoseProfile;
  /** False when nothing valid was ever saved — drives the first-run nudge. */
  hasSavedProfile: boolean;
}

/** Loads the ACTIVE profile's persisted clinical profile, falling back to
 * the safe built-in default. */
export async function loadDoseProfile(): Promise<LoadedDoseProfile> {
  const profileId = getActiveProfileId();
  const key = profileKey(DOSE_PROFILE_KEY, profileId);
  await migrateLegacyKey(DOSE_PROFILE_KEY, profileId, key);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return { profile: DEFAULT_DOSE_PROFILE, hasSavedProfile: false };
    }
    const parsed = JSON.parse(raw) as unknown;
    if (isDoseProfile(parsed)) {
      return { profile: parsed, hasSavedProfile: true };
    }
    // Corrupt/invalid record: fail closed to the safe default rather than
    // trust a partially-shaped or hand-edited value.
    return { profile: DEFAULT_DOSE_PROFILE, hasSavedProfile: false };
  } catch {
    return { profile: DEFAULT_DOSE_PROFILE, hasSavedProfile: false };
  }
}

export async function saveDoseProfile(profile: DoseProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(profileKey(DOSE_PROFILE_KEY, getActiveProfileId()), JSON.stringify(profile));
  } catch {
    // Best-effort persistence only; offline-first UX must not block on
    // storage errors (matches ../storage.ts's writeJson).
  }
}

/**
 * Removes THIS SPECIFIC profile's clinical Dose Assist profile — used when a
 * profile is deleted (App.tsx's handleDeleteProfile) or when every profile's
 * data is wiped ("Apagar todos os meus dados"). Takes an explicit
 * `profileId` (not necessarily the active one).
 */
export async function clearProfileData(profileId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(profileKey(DOSE_PROFILE_KEY, profileId));
  } catch {
    // Best-effort persistence only.
  }
}

/**
 * Bumps the trailing integer of a "profile-N" version string so every saved
 * change produces a new, distinct version for the dose calculation's audit
 * record (clinical-safety rule: "require explicit ... profile version").
 * Falls back to appending "-2" for any version string with no trailing
 * digits, so this never throws or produces an empty/duplicate version.
 */
export function bumpProfileVersion(version: string): string {
  const match = version.match(/^(.*?)(\d+)$/);
  if (match) {
    const [, prefix, digits] = match;
    const next = parseInt(digits, 10) + 1;
    return `${prefix}${next}`;
  }
  return `${version}-2`;
}
