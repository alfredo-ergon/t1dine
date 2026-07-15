import type { ReactNode } from "react";
import { Pressable, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from "react-native";

import { useReducedMotion } from "../useReducedMotion";

export interface PressableScaleProps extends Omit<PressableProps, "style" | "children"> {
  /** Same shape as RN's `Pressable` style prop — forwarded as-is, with a
   * press-state scale transform layered on top. */
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  children?: ReactNode;
  /** Scale applied while pressed (0-1). Defaults to a subtle 0.96. */
  scaleTo?: number;
}

// Shared tactile press feedback ("Purposeful motion: press feedback
// (scale/opacity)") for every primary/secondary action in the app. This is a
// drop-in replacement for a raw `Pressable` — it renders exactly one host
// element (no extra wrapping view), so it is safe to use anywhere a
// `Pressable` is used today, including inside `flex: 1` row layouts. Honors
// reduce-motion by never applying the scale transform (a11y — a static press
// still has the existing background/opacity feedback most buttons already
// carry via their own `pressed &&` styles).
export function PressableScale({ style, children, scaleTo = 0.96, ...rest }: PressableScaleProps) {
  const reduceMotion = useReducedMotion();

  return (
    <Pressable
      {...rest}
      style={(state) => {
        const base = typeof style === "function" ? style(state) : style;
        if (reduceMotion || !state.pressed) return base;
        return [base, { transform: [{ scale: scaleTo }] }];
      }}
    >
      {children}
    </Pressable>
  );
}
