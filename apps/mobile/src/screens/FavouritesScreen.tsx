import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { CanonicalFood } from "@t1dine/food-schema";

import { FoodRow } from "../components/FoodRow";
import { Mascot } from "../components/Mascot";
import { useLanguage } from "../i18n";
import { colors, fontSizes, fontWeights, spacing } from "../theme";

export interface FavouritesScreenProps {
  favourites: CanonicalFood[];
  recents: CanonicalFood[];
  favouriteIds: Set<string>;
  onSelectFood: (food: CanonicalFood) => void;
  onToggleFavourite: (food: CanonicalFood) => void;
}

// Favourites and Recents share one tab: both are lightweight, offline,
// user-scoped lists of the same food rows, so splitting them into separate
// top-level tabs would add navigation depth without adding value.
export function FavouritesScreen({ favourites, recents, favouriteIds, onSelectFood, onToggleFavourite }: FavouritesScreenProps) {
  const { t } = useLanguage();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{t("favourites.title")}</Text>

      <Text style={styles.sectionTitle}>{t("favourites.sectionFavourites")}</Text>
      {favourites.length === 0 ? (
        <View style={styles.empty}>
          <Mascot size={72} />
          <Text style={styles.emptyBody}>{t("favourites.emptyFavourites")}</Text>
        </View>
      ) : (
        favourites.map((food) => (
          <FoodRow key={food.id} food={food} isFavourite={favouriteIds.has(food.id)} onPress={onSelectFood} onToggleFavourite={onToggleFavourite} />
        ))
      )}

      <Text style={[styles.sectionTitle, styles.secondSection]}>{t("favourites.sectionRecents")}</Text>
      {recents.length === 0 ? (
        <Text style={styles.emptyBody}>{t("favourites.emptyRecents")}</Text>
      ) : (
        recents.map((food) => (
          <FoodRow key={food.id} food={food} isFavourite={favouriteIds.has(food.id)} onPress={onSelectFood} onToggleFavourite={onToggleFavourite} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingBottom: 40 },
  h1: { fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.textPrimary, marginBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textFaint, marginTop: 4, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  secondSection: { marginTop: 20 },
  empty: { alignItems: "center", paddingVertical: spacing.lg },
  emptyBody: { fontSize: 14, color: colors.textMuted, paddingVertical: 8, textAlign: "center" },
});
