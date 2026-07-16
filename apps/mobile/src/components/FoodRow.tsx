import { StyleSheet, Text, View } from "react-native";
import type { CanonicalFood } from "@t1dine/food-schema";

import { foodEmoji } from "../foodEmoji";
import { useLanguage } from "../i18n";
import { carbPer100g, displayName, FOOD_TYPE_KEY } from "../search";
import { colors, elevation, MIN_TAP_TARGET, radius, spacing } from "../theme";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { PressableScale } from "./PressableScale";

export interface FoodRowProps {
  food: CanonicalFood;
  isFavourite: boolean;
  onPress: (food: CanonicalFood) => void;
  onToggleFavourite: (food: CanonicalFood) => void;
}

// Shared food row used by Search, Favourites, and Recents — keeps naming,
// confidence, and the favourite star consistent across every list. Elevated
// card on the mist background (Aurora brief: "soft depth over borders"),
// with the carb-per-100g number set large and confident ("data as hero").
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
        <PressableScale
          style={({ pressed }) => [styles.main, pressed && styles.mainPressed]}
          onPress={() => onPress(food)}
          accessibilityRole="button"
          accessibilityLabel={`${primaryName}, ${typeLabel}, ${carb ?? "?"} ${t("common.gramsCarbsPer100")}`}
          scaleTo={0.98}
        >
          {/* Decorative food glyph — hidden from screen readers (the name/type
              label already carries the meaning). */}
          <View style={styles.emojiTile} accessible={false} importantForAccessibility="no-hide-descendants">
            <Text style={styles.emoji}>{foodEmoji(food)}</Text>
          </View>
          <View style={styles.textCol}>
            <Text style={styles.name} numberOfLines={1}>
              {primaryName}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {secondaryName} • {typeLabel}
            </Text>
            <ConfidenceBadge food={food} />
          </View>
        </PressableScale>

        <View style={styles.right}>
          <Text style={styles.carb}>{carb ?? "?"}</Text>
          <Text style={styles.carbLabel}>{t("common.carbsPer100gShort")}</Text>
          <PressableScale
            onPress={() => onToggleFavourite(food)}
            accessibilityRole="button"
            accessibilityLabel={`${isFavourite ? t("favourite.remove") : t("favourite.add")}: ${primaryName}`}
            accessibilityState={{ selected: isFavourite }}
            style={styles.star}
            hitSlop={8}
          >
            <Text style={[styles.starIcon, isFavourite && styles.starIconActive]}>{isFavourite ? "★" : "☆"}</Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginVertical: 5,
    ...elevation.sm.native,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  main: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  mainPressed: { backgroundColor: colors.surfaceSunken },
  emojiTile: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  emoji: { fontSize: 22 },
  textCol: { flex: 1 },
  name: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  // Single deliberate gap down to the confidence chip below — the chip
  // itself carries its own `marginTop` (see ConfidenceBadge), so this row
  // doesn't stack a second, redundant margin on top of it.
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  right: { alignItems: "flex-end", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: "space-between" },
  carb: { fontSize: 22, fontWeight: "800", color: colors.brandDark, fontVariant: ["tabular-nums"] },
  carbLabel: { fontSize: 11, color: colors.textFaint },
  star: { minWidth: MIN_TAP_TARGET, minHeight: MIN_TAP_TARGET, alignItems: "center", justifyContent: "center" },
  starIcon: { fontSize: 24, color: colors.starInactive },
  starIconActive: { color: colors.star },
});
