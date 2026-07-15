import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { CanonicalFood } from "@t1dine/food-schema";

import { FadeIn } from "../components/FadeIn";
import { FoodRow } from "../components/FoodRow";
import { Mascot } from "../components/Mascot";
import { PressableScale } from "../components/PressableScale";
import { useLanguage } from "../i18n";
import { loadSubmissions } from "../submissions";
import { colors, elevation, fontWeights, radius, spacing, typeScale } from "../theme";

export interface FavouritesScreenProps {
  favourites: CanonicalFood[];
  recents: CanonicalFood[];
  favouriteIds: Set<string>;
  onSelectFood: (food: CanonicalFood) => void;
  onToggleFavourite: (food: CanonicalFood) => void;
  /** Opens "As minhas contribuições" (Slice: my submissions). */
  onOpenSubmissions: () => void;
}

// Favourites and Recents share one tab: both are lightweight, offline,
// user-scoped lists of the same food rows, so splitting them into separate
// top-level tabs would add navigation depth without adding value.
export function FavouritesScreen({ favourites, recents, favouriteIds, onSelectFood, onToggleFavourite, onOpenSubmissions }: FavouritesScreenProps) {
  const { t } = useLanguage();
  const [submissionCount, setSubmissionCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadSubmissions().then((records) => {
      if (!cancelled) setSubmissionCount(records.length);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{t("favourites.title")}</Text>

      <Text style={styles.sectionTitle}>{t("favourites.sectionFavourites")}</Text>
      {favourites.length === 0 ? (
        <FadeIn>
          <View style={styles.empty}>
            <Mascot size={72} />
            <Text style={styles.emptyBody}>{t("favourites.emptyFavourites")}</Text>
          </View>
        </FadeIn>
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

      <PressableScale
        onPress={onOpenSubmissions}
        accessibilityRole="button"
        accessibilityLabel={submissionCount > 0 ? `${t("favourites.openSubmissionsCta")} (${submissionCount})` : t("favourites.openSubmissionsCta")}
        style={styles.submissionsCard}
      >
        <View style={styles.submissionsIconWrap}>
          <Text style={styles.submissionsIcon}>◈</Text>
        </View>
        <Text style={styles.submissionsText}>
          {t("favourites.openSubmissionsCta")}
          {submissionCount > 0 ? ` (${submissionCount})` : ""}
        </Text>
        <Text style={styles.submissionsChevron}>›</Text>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingBottom: 40 },
  h1: { fontSize: typeScale.heading.size, fontWeight: fontWeights.extrabold, color: colors.textPrimary, marginBottom: 4 },
  sectionTitle: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    marginTop: 4,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
  },
  secondSection: { marginTop: 20 },
  empty: { alignItems: "center", paddingVertical: spacing.lg },
  emptyBody: { fontSize: 14, color: colors.textMuted, paddingVertical: 8, textAlign: "center" },
  submissionsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginTop: spacing.xl,
    ...elevation.sm.native,
  },
  submissionsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  submissionsIcon: { fontSize: 16, color: colors.brandDark },
  submissionsText: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  submissionsChevron: { fontSize: 20, color: colors.textFaint },
});
