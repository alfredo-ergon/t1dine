import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { elevation, gradients, radius } from "../theme";

interface InkSurfaceProps {
  children: ReactNode;
  /** Outer wrapper style — use for margins/positioning (carries the shadow). */
  style?: StyleProp<ViewStyle>;
  /** Inner gradient style — use for padding/layout of the content. */
  contentStyle?: StyleProp<ViewStyle>;
  accessible?: boolean;
  accessibilityLabel?: string;
}

// The "striking dark bar" from the Aurora brief — a signature ink-gradient
// surface used for the current-meal bar (Search) and the meal totals (Meal).
// Follows the established shadow-on-wrapper pattern (see DetailScreen's
// addButton): the outer View carries the elevation so the shadow isn't
// clipped, while the inner LinearGradient clips the rounded content corners.
export function InkSurface({ children, style, contentStyle, accessible, accessibilityLabel }: InkSurfaceProps) {
  return (
    <View style={[styles.wrap, style]} accessible={accessible} accessibilityLabel={accessibilityLabel}>
      <LinearGradient
        colors={gradients.ink.colors}
        start={gradients.ink.start}
        end={gradients.ink.end}
        style={[styles.gradient, contentStyle]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, ...elevation.lg.native },
  gradient: { borderRadius: radius.lg, overflow: "hidden" },
});
