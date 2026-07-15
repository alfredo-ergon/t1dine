import { useEffect, useRef, useState } from "react";
import { Animated, type StyleProp, type TextStyle } from "react-native";

import { durations, easings } from "../motionUtils";
import { useReducedMotion } from "../useReducedMotion";

export interface AnimatedCounterProps {
  /** The current numeric value to display (e.g. a running carb-gram total). */
  value: number;
  /** Decimal places to render. Defaults to 1 (matches this app's gram formatting). */
  decimals?: number;
  style?: StyleProp<TextStyle>;
  /** Optional suffix rendered after the number with the same style (e.g. " g"). */
  suffix?: string;
  accessibilityLabel?: string;
}

// "Data as hero: nutrient totals ... large, confident, beautifully set
// numbers" + "Purposeful motion: animated number counters for totals". Used
// for meal/search carb totals — deliberately NOT used for the Dose Assist
// screen's estimated units, where a mid-animation value could be misread as
// an actionable dose (CLAUDE.md clinical-safety boundary keeps that number a
// plain, static text render instead).
export function AnimatedCounter({ value, decimals = 1, style, suffix, accessibilityLabel }: AnimatedCounterProps) {
  const reduceMotion = useReducedMotion();
  const animatedValue = useRef(new Animated.Value(value)).current;
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    if (reduceMotion) {
      animatedValue.setValue(value);
      setDisplayValue(value);
      previousValue.current = value;
      return;
    }
    if (previousValue.current === value) return;
    previousValue.current = value;
    const animation = Animated.timing(animatedValue, {
      toValue: value,
      duration: durations.base,
      easing: easings.standard,
      useNativeDriver: false,
    });
    animation.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduceMotion]);

  useEffect(() => {
    const listenerId = animatedValue.addListener(({ value: current }) => setDisplayValue(current));
    return () => animatedValue.removeListener(listenerId);
  }, [animatedValue]);

  const text = `${displayValue.toFixed(decimals)}${suffix ?? ""}`;

  return (
    <Animated.Text style={style} accessibilityLabel={accessibilityLabel} accessible={Boolean(accessibilityLabel)}>
      {text}
    </Animated.Text>
  );
}
