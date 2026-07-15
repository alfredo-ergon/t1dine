import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CanonicalFood } from "@t1dine/food-schema";

import { useLanguage } from "../i18n";
import { carbPer100g, displayName, FOOD_TYPE_KEY } from "../search";
import { colors, MIN_TAP_TARGET, radius, shadows, spacing } from "../theme";
import { ConfidenceBadge } from "./ConfidenceBadge";

export interface FoodRowProps {
  food: CanonicalFood;
  isFavourite: boolean;
  onPress: (food: CanonicalFood) => void;
  onToggleFavourite: (food: CanonicalFood) => void;
}

// Shared food row used by Search, Favourites, and Recents — keeps naming,
// confidence, and the favourite star consistent across every list.
export function FoodRow({ food, isFavourite, onPress, onToggleFavourite }: FoodRowProps) {
  const { language, t } = useLanguage();
  const secondaryLanguage = language === "pt" ? "en" : "pt";
  const carb = carbPer100g(food);
  const primaryName = displayName(food, language);
  const secondaryName = displayName(food, secondaryLanguage);
  const typeLabel = t(FOOD_TYPE_KEY[food.type]);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.main, pressed && styles.mainPressed]}
          onPress={() => onPress(food)}
          accessibilityRole="button"
          accessibilityLabel={`${primaryName}, ${typeLabel}, ${carb ?? "?"} ${t("common.gramsCarbsPer100")}`}
        >
          <Text style={styles.name}>{primaryName}</Text>
          <Text style={styles.sub}>
            {secondaryName} • {typeLabel}
          </Text>
          <ConfidenceBadge food={food} />
        </Pressable>

        <View style={styles.right}>
          <Text style={styles.carb}>{carb ?? "?"} g</Text>
          <Text style={styles.carbLabel}>{t("common.carbsPer100gShort")}</Text>
          <Pressable
            onPress={() => onToggleFavourite(food)}
            accessibilityRole="button"
            accessibilityLabel={`${isFavourite ? t("favourite.remove") : t("favourite.add")}: ${primaryName}`}
            accessibilityState={{ selected: isFavourite }}
            style={({ pressed }) => [styles.star, pressed && styles.starPressed]}
            hitSlop={8}
          >
            <Text style={[styles.starIcon, isFavourite && styles.starIconActive]}>{isFavourite ? "★" : "☆"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 6,
    ...shadows.card.native,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  main: { flex: 1, padding: spacing.md },
  mainPressed: { backgroundColor: colors.accentSoft },
  name: { fontSize: 17, fontWeight: "600", color: colors.textPrimary },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.xs },
  right: { alignItems: "flex-end", padding: spacing.md, paddingLeft: 0, justifyContent: "space-between" },
  carb: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  carbLabel: { fontSize: 11, color: colors.textFaint },
  star: { minWidth: MIN_TAP_TARGET, minHeight: MIN_TAP_TARGET, alignItems: "center", justifyContent: "center" },
  starPressed: { opacity: 0.6 },
  starIcon: { fontSize: 24, color: colors.starInactive },
  starIconActive: { color: colors.star },
});
