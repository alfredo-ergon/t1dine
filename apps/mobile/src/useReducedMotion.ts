// Shared "prefers reduced motion" hook. Every entrance/press/counter
// animation in this app must guard on this — WCAG 2.2 / platform
// accessibility guidance: users who have asked their OS to reduce motion
// must see the same information with no (or near-instant) animation, never
// a diminished experience otherwise. Works on native (iOS "Reduce Motion" /
// Android "Remove animations") and degrades safely on web, where the
// underlying API may be partial.
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;

    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled())
      .then((value) => {
        if (mounted) setReduced(Boolean(value));
      })
      .catch(() => {
        // Unsupported on this platform/runtime — default to full motion.
      });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value: boolean) => {
      setReduced(Boolean(value));
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
