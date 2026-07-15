import { StyleSheet, Text, View } from "react-native";
import type { CanonicalFood } from "@t1dine/food-schema";

import { useLanguage } from "../i18n";
import { confidenceStyle, nutrient } from "../search";
import { radius, spacing } from "../theme";

// Confidence is always conveyed by colour + icon + text together, never
// colour alone — reused everywhere a food's confidence is shown. Filled with
// the design-system's soft confidence tint so the chip reads clearly even
// for users who can't distinguish the foreground colour.
export function ConfidenceBadge({ food }: { food: CanonicalFood }) {
  const { t } = useLanguage();
  const confidence = nutrient(food, "CHOAVL")?.confidence ?? "unverified";
  const style = confidenceStyle(confidence);
  const label = t(style.labelKey);

  return (
    <View
      style={[styles.badge, { backgroundColor: style.bg }]}
      accessible
      accessibilityLabel={`${t("confidence.ariaPrefix")} ${label}`}
    >
      <Text style={[styles.badgeText, { color: style.color }]}>
        {style.icon} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, marginTop: spacing.xs, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "700" },
});
