// Pure, framework-independent presentation helpers for the read-only glucose
// display (Slice 6). This module only formats fields already computed by the
// API (mgdl/mmol/direction/ageMinutes/stale) — it never computes or infers
// anything, and it has zero connection to `@t1dine/dose-engine` or any
// insulin/dose value. Keep it that way: clinical calculation UI and food/
// glucose-estimation UI stay strictly separate (CLAUDE.md).

import { ApiError, isConnectivityError } from "./api";
import type { TranslateFn } from "./i18n";
import { colors } from "./theme";

/** Nightscout's documented `direction` strings -> a simple trend arrow. */
const DIRECTION_ARROW: Record<string, string> = {
  TripleUp: "⤊",
  DoubleUp: "⇈",
  SingleUp: "↑",
  FortyFiveUp: "↗",
  Flat: "→",
  FortyFiveDown: "↘",
  SingleDown: "↓",
  DoubleDown: "⇊",
  TripleDown: "⤋",
};

/** i18n dictionary keys (not literal text) — resolve with useLanguage().t(), matching ./search.ts's confidenceStyle() convention. */
const DIRECTION_LABEL_KEY: Record<string, string> = {
  TripleUp: "glucose.direction.TripleUp",
  DoubleUp: "glucose.direction.DoubleUp",
  SingleUp: "glucose.direction.SingleUp",
  FortyFiveUp: "glucose.direction.FortyFiveUp",
  Flat: "glucose.direction.Flat",
  FortyFiveDown: "glucose.direction.FortyFiveDown",
  SingleDown: "glucose.direction.SingleDown",
  DoubleDown: "glucose.direction.DoubleDown",
  TripleDown: "glucose.direction.TripleDown",
};

/** Trend arrow glyph for a Nightscout direction string; a neutral dot when absent/unrecognised. */
export function directionArrow(direction: string | undefined): string {
  if (!direction) return "•";
  return DIRECTION_ARROW[direction] ?? "•";
}

/** i18n key describing a Nightscout direction string in words (never arrow-only — WCAG "never colour/icon alone"). */
export function directionLabelKey(direction: string | undefined): string {
  if (!direction) return "glucose.direction.unknown";
  return DIRECTION_LABEL_KEY[direction] ?? "glucose.direction.unknown";
}

/** "agora mesmo" / "just now" for very fresh readings, otherwise "há {n} min" / "{n} min ago". */
export function formatAge(t: TranslateFn, ageMinutes: number): string {
  if (ageMinutes <= 0) return t("glucose.justNow");
  return t("glucose.ageMinutesAgo", { count: ageMinutes });
}

/**
 * Maps a failed `fetchGlucose()` call to an i18n key for a fail-closed,
 * user-facing message — NEVER the server's raw `message`/`error` text (which
 * this app must not trust or echo verbatim) and NEVER the url/token that was
 * sent. Distinguishes "no connectivity" (network/timeout) from an
 * authoritative upstream failure (a bad Nightscout url/token, or Nightscout
 * itself being unreachable/malformed) so the two can get different, more
 * actionable copy.
 */
export function glucoseSyncErrorKey(error: unknown): string {
  if (error instanceof ApiError) {
    if (isConnectivityError(error)) return "glucose.syncErrorOffline";
    if (error.code === "invalid_body") return "glucose.syncErrorInvalidConnection";
    if (error.code === "upstream_unreachable" || error.code === "upstream_error" || error.code === "upstream_malformed") {
      return "glucose.syncErrorUpstream";
    }
  }
  return "glucose.syncErrorGeneric";
}

// ---------------------------------------------------------------------------
// DISPLAY-ONLY glucose bands (Slice 6 polish).
//
// These thresholds exist ONLY to colour/label a reading in this read-only
// screen (in-range vs out-of-range, at a glance). They are NOT a clinical
// judgement, they are NOT configurable per-user, and they must NEVER be read
// by, or feed into, a dose calculation — this module (like the rest of
// ../glucose.ts and ../screens/GlucoseScreen.tsx) has zero connection to
// `@t1dine/dose-engine` or `src/dose/*` (CLAUDE.md: "Never put ... probabilistic
// inference inside the dose calculation path"; keep clinical calculation UI
// separate from food/glucose-estimation UI).
// ---------------------------------------------------------------------------

export const GLUCOSE_LOW_THRESHOLD_MGDL = 70;
export const GLUCOSE_HIGH_THRESHOLD_MGDL = 180;

export type GlucoseBand = "low" | "inRange" | "high";

/** Buckets a single mg/dL value for DISPLAY ONLY — see the module note above. */
export function glucoseBand(mgdl: number): GlucoseBand {
  if (mgdl < GLUCOSE_LOW_THRESHOLD_MGDL) return "low";
  if (mgdl > GLUCOSE_HIGH_THRESHOLD_MGDL) return "high";
  return "inRange";
}

export interface GlucoseBandStyle {
  /** i18n dictionary key — callers must run this through t() before display. */
  labelKey: string;
  /** A distinct glyph per band (never colour alone — WCAG 2.2): a downward
   * triangle for low, a circle for in-range, an upward triangle for high. */
  icon: string;
  color: string;
  /** Soft background tint for a badge/chip fill — always paired with `color` + `icon` + text. */
  bg: string;
}

/** Colour + shape + i18n label for a glucose band — reuses the existing
 * confidence colour scale (see ./theme / @t1dine/design-tokens) so this stays
 * visually consistent with the rest of the app without introducing new
 * design tokens. */
export function glucoseBandStyle(band: GlucoseBand): GlucoseBandStyle {
  switch (band) {
    case "low":
      return { labelKey: "glucose.band.low", icon: "▼", color: colors.confidenceUnverified, bg: colors.confidenceUnverifiedBg };
    case "high":
      return { labelKey: "glucose.band.high", icon: "▲", color: colors.confidenceLow, bg: colors.confidenceLowBg };
    case "inRange":
    default:
      return { labelKey: "glucose.band.inRange", icon: "●", color: colors.confidenceHigh, bg: colors.confidenceHighBg };
  }
}

// ---------------------------------------------------------------------------
// "Última sincronização há X" (Slice 6 polish) — purely a display of elapsed
// wall-clock time since the last successful `fetchGlucose()` call this screen
// made (demo or live, tracked separately by the caller). Never persisted,
// never sent anywhere.
// ---------------------------------------------------------------------------

/** "agora mesmo" / "just now" for a sync in the last minute, otherwise "há {n} min" / "{n} min ago". */
export function formatSyncAge(t: TranslateFn, syncedAtMs: number, nowMs: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((nowMs - syncedAtMs) / 60_000));
  if (minutes <= 0) return t("glucose.lastSyncedJustNow");
  return t("glucose.lastSyncedMinutesAgo", { count: minutes });
}
