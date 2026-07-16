// Lightweight recent-trend sparkline for the read-only Glucose screen (Slice
// 6 polish). DISPLAY ONLY: this renders fields the API already computed
// (`GlucoseReading.mgdl`) and never computes, infers, or feeds anything to a
// dose calculation — it has zero connection to `@t1dine/dose-engine` or
// `src/dose/*` (CLAUDE.md; see also ../glucose.ts's module note). Purely
// decorative/redundant with the textual reading list already shown below it,
// so it is hidden from screen readers behind a single summary label on the
// wrapping View.

import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect } from "react-native-svg";

import type { GlucoseReading } from "../api";
import { glucoseBand, glucoseBandStyle, GLUCOSE_HIGH_THRESHOLD_MGDL, GLUCOSE_LOW_THRESHOLD_MGDL } from "../glucose";
import { useLanguage } from "../i18n";
import { colors, radius } from "../theme";

export interface GlucoseTrendSparklineProps {
  /** Newest-first, matching `GlucoseResult.readings` — reversed internally so
   * the chart reads left (oldest) to right (newest), like a normal trend line. */
  readings: GlucoseReading[];
  height?: number;
}

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 40;
// Fixed scaling floor/ceiling (mg/dL), rather than auto-scaling to whatever
// the current min/max happens to be — a genuinely dangerous swing must never
// be visually flattened into the same shape as a mild one just because it's
// the only data on screen.
const CHART_FLOOR_MGDL = 40;
const CHART_CEILING_MGDL = 260;

function scaleY(mgdl: number): number {
  const clamped = Math.min(CHART_CEILING_MGDL, Math.max(CHART_FLOOR_MGDL, mgdl));
  const ratio = (clamped - CHART_FLOOR_MGDL) / (CHART_CEILING_MGDL - CHART_FLOOR_MGDL);
  return VIEWBOX_HEIGHT - ratio * VIEWBOX_HEIGHT;
}

export function GlucoseTrendSparkline({ readings, height = 64 }: GlucoseTrendSparklineProps) {
  const { t } = useLanguage();

  // A single point (or none) has no "trend" to show — the caller already
  // guards on this, but stay defensive.
  if (readings.length < 2) return null;

  const chronological = [...readings].reverse();
  const points = chronological.map((reading, index) => ({
    x: (index / (chronological.length - 1)) * VIEWBOX_WIDTH,
    y: scaleY(reading.mgdl),
    reading,
  }));
  const polylinePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const lowY = scaleY(GLUCOSE_LOW_THRESHOLD_MGDL);
  const highY = scaleY(GLUCOSE_HIGH_THRESHOLD_MGDL);

  const mgdlValues = chronological.map((reading) => reading.mgdl);
  const min = Math.round(Math.min(...mgdlValues));
  const max = Math.round(Math.max(...mgdlValues));
  const summary = t("glucose.trend.summary", { min, max });

  return (
    <View style={[styles.wrap, { height }]} accessible accessibilityLabel={summary}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {/* Reference tint for the "high" zone (above 180 mg/dL, display-only). */}
        <Rect x={0} y={0} width={VIEWBOX_WIDTH} height={Math.max(0, highY)} fill={colors.confidenceLowBg} opacity={0.7} />
        {/* Reference tint for the "low" zone (below 70 mg/dL, display-only). */}
        <Rect x={0} y={lowY} width={VIEWBOX_WIDTH} height={Math.max(0, VIEWBOX_HEIGHT - lowY)} fill={colors.confidenceUnverifiedBg} opacity={0.7} />
        <Line x1={0} y1={lowY} x2={VIEWBOX_WIDTH} y2={lowY} stroke={colors.confidenceUnverified} strokeWidth={0.6} strokeDasharray="2,2" />
        <Line x1={0} y1={highY} x2={VIEWBOX_WIDTH} y2={highY} stroke={colors.confidenceLow} strokeWidth={0.6} strokeDasharray="2,2" />

        <Polyline points={polylinePoints} fill="none" stroke={colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {points.map((point, index) => {
          const style = glucoseBandStyle(glucoseBand(point.reading.mgdl));
          const isNewest = index === points.length - 1;
          return <Circle key={point.reading.iso} cx={point.x} cy={point.y} r={isNewest ? 3 : 1.5} fill={style.color} />;
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
});
