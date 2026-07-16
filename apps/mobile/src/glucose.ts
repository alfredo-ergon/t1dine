// Pure, framework-independent presentation helpers for the read-only glucose
// display (Slice 6). This module only formats fields already computed by the
// API (mgdl/mmol/direction/ageMinutes/stale) — it never computes or infers
// anything, and it has zero connection to `@t1dine/dose-engine` or any
// insulin/dose value. Keep it that way: clinical calculation UI and food/
// glucose-estimation UI stay strictly separate (CLAUDE.md).

import { ApiError, isConnectivityError } from "./api";
import type { TranslateFn } from "./i18n";

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
