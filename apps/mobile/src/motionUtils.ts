// Converts the shared @t1dine/design-tokens motion tokens (CSS-flavoured —
// ms durations + CSS `cubic-bezier(...)` easing strings, so the admin/web app
// can use them verbatim) into React Native's `Easing.bezier` curves, so every
// screen in this app animates on the SAME curves/durations as the rest of
// T1Dine without duplicating the numbers.
import { Easing } from "react-native";

import { motion } from "./theme";

function parseCubicBezier(css: string): [number, number, number, number] {
  const match = css.match(/cubic-bezier\(([^)]+)\)/);
  const fallback: [number, number, number, number] = [0.2, 0, 0, 1];
  if (!match) return fallback;
  const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) return fallback;
  return [parts[0], parts[1], parts[2], parts[3]];
}

export const easings = {
  standard: Easing.bezier(...parseCubicBezier(motion.easing.standard)),
  emphasized: Easing.bezier(...parseCubicBezier(motion.easing.emphasized)),
  exit: Easing.bezier(...parseCubicBezier(motion.easing.exit)),
};

export const durations = motion.duration;
