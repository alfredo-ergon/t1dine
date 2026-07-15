import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";

import { durations, easings } from "../motionUtils";
import { useReducedMotion } from "../useReducedMotion";

export interface FadeInProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Extra delay (ms) before the entrance starts — lets a list stagger its rows. */
  delay?: number;
  /** Vertical distance (dp) the content slides up from. Defaults to a gentle 10. */
  distance?: number;
}

// "Purposeful motion: fade+slide entrances" — a single reusable wrapper so
// every screen/empty-state/card enters the same, calm way instead of
// popping in abruptly. Respects reduce-motion (renders instantly, fully
// visible, no transform) per the Aurora brief's accessibility requirement.
export function FadeIn({ children, style, delay = 0, distance = 10 }: FadeInProps) {
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: durations.slow,
      delay,
      easing: easings.standard,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
