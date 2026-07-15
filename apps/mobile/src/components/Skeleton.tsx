import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius } from "../theme";
import { useReducedMotion } from "../useReducedMotion";

export interface SkeletonProps {
  style?: StyleProp<ViewStyle>;
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
}

// Shimmer skeleton placeholder ("delightful... skeleton loaders while
// loading"). Purely decorative — screens using this always keep a
// non-visual, textual loading state available to screen readers elsewhere
// (e.g. the catalog source pill's "A atualizar…"), so this component is
// marked `accessibilityElementsHidden` and never itself carries meaning.
// Reduce-motion: renders a static soft-tinted block instead of shimmering.
export function Skeleton({ style, height = 16, width = "100%", radius: cornerRadius = radius.sm }: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, shimmer]);

  const opacity = reduceMotion ? 0.6 : shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { height, width, borderRadius: cornerRadius, opacity }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surfaceSunken },
});
