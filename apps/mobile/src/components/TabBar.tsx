import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

import { useLanguage } from "../i18n";
import { durations, easings } from "../motionUtils";
import { colors, elevation, MIN_TAP_TARGET, radius, spacing } from "../theme";
import { PressableScale } from "./PressableScale";
import { useReducedMotion } from "../useReducedMotion";

export type TabKey = "search" | "meal" | "favourites" | "glucose";

interface TabBarProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  mealItemCount: number;
}

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: "search", labelKey: "nav.search" },
  { key: "meal", labelKey: "nav.meal" },
  { key: "favourites", labelKey: "nav.favourites" },
  { key: "glucose", labelKey: "nav.glucose" },
];

const BAR_PADDING = 4;

// Elevated, glassy floating tab bar with an animated active-segment
// indicator that slides beneath the selected tab (Aurora brief: "elevated,
// glassy (surfaceGlass) floating tab bar with an animated active indicator").
// Still plain Pressable-driven state under the hood — no navigation library.
export function TabBar({ active, onChange, mealItemCount }: TabBarProps) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;

  const activeIndex = TABS.findIndex((tab) => tab.key === active);
  const segmentWidth = barWidth > 0 ? (barWidth - BAR_PADDING * 2) / TABS.length : 0;

  useEffect(() => {
    if (segmentWidth === 0) return;
    const toValue = segmentWidth * activeIndex;
    if (reduceMotion) {
      indicatorX.setValue(toValue);
      return;
    }
    Animated.timing(indicatorX, {
      toValue,
      duration: durations.base,
      easing: easings.emphasized,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, segmentWidth, reduceMotion]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.bar} accessibilityRole="tablist" onLayout={handleLayout}>
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: segmentWidth,
              transform: [{ translateX: indicatorX }],
            },
          ]}
        />
      )}
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const label = t(tab.labelKey);
        const showBadge = tab.key === "meal" && mealItemCount > 0;
        return (
          <PressableScale
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={showBadge ? `${label} (${mealItemCount})` : label}
            style={styles.tab}
            scaleTo={0.94}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {label}
              {showBadge ? ` (${mealItemCount})` : ""}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surfaceGlass,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: BAR_PADDING,
    marginBottom: spacing.md,
    ...elevation.md.native,
  },
  indicator: {
    position: "absolute",
    top: BAR_PADDING,
    left: BAR_PADDING,
    bottom: BAR_PADDING,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    ...elevation.glow.native,
  },
  tab: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  tabText: { fontSize: 14, fontWeight: "700", color: colors.textMuted },
  tabTextActive: { color: colors.onBrand },
});
