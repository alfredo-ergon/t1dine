import { Pressable, StyleSheet, Text, View } from "react-native";

import { useLanguage } from "../i18n";
import { colors, MIN_TAP_TARGET, radius, shadows, spacing } from "../theme";

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

// Lightweight header tab bar — Pressable + state, no navigation library.
export function TabBar({ active, onChange, mealItemCount }: TabBarProps) {
  const { t } = useLanguage();

  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const label = t(tab.labelKey);
        const showBadge = tab.key === "meal" && mealItemCount > 0;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={showBadge ? `${label} (${mealItemCount})` : label}
            style={({ pressed }) => [styles.tab, isActive && styles.tabActive, pressed && styles.tabPressed]}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {label}
              {showBadge ? ` (${mealItemCount})` : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: spacing.md,
    ...shadows.card.native,
  },
  tab: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  tabActive: { backgroundColor: colors.brand },
  tabPressed: { opacity: 0.85 },
  tabText: { fontSize: 14, fontWeight: "700", color: colors.textMuted },
  tabTextActive: { color: colors.onBrand },
});
