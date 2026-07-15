import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { CanonicalFood, ContinentGroup } from "@t1dine/food-schema";

import { AreaFilterPanel } from "../components/AreaFilterPanel";
import { FoodRow } from "../components/FoodRow";
import { Mascot } from "../components/Mascot";
import { tPlural, useLanguage } from "../i18n";
import { colors, fontSizes, fontWeights, MIN_TAP_TARGET, radius, shadows, spacing } from "../theme";

export interface SearchScreenProps {
  query: string;
  onChangeQuery: (query: string) => void;
  results: CanonicalFood[];
  favouriteIds: Set<string>;
  onSelectFood: (food: CanonicalFood) => void;
  onToggleFavourite: (food: CanonicalFood) => void;
  onCreateFood: () => void;
  mealItemCount: number;
  mealCarbGrams: number;
  /** "online" once the API catalog has loaded successfully; "offline" while using the bundled local catalog. */
  catalogSource: "online" | "offline";
  catalogLoading: boolean;
  onRefreshCatalog: () => void;
  /** Browse-by-area filters (Slice: browse by area). */
  regionGroups: ContinentGroup[];
  cuisines: string[];
  selectedRegionId: string | null;
  selectedCuisine: string | null;
  onSelectRegion: (regionId: string | null) => void;
  onSelectCuisine: (cuisine: string | null) => void;
}

export function SearchScreen({
  query,
  onChangeQuery,
  results,
  favouriteIds,
  onSelectFood,
  onToggleFavourite,
  onCreateFood,
  mealItemCount,
  mealCarbGrams,
  catalogSource,
  catalogLoading,
  onRefreshCatalog,
  regionGroups,
  cuisines,
  selectedRegionId,
  selectedCuisine,
  onSelectRegion,
  onSelectCuisine,
}: SearchScreenProps) {
  const { t } = useLanguage();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sourceText = catalogLoading
    ? t("catalog.refreshing")
    : catalogSource === "online"
      ? t("catalog.sourceOnline")
      : t("catalog.sourceOffline");
  const activeFilterCount = (selectedRegionId ? 1 : 0) + (selectedCuisine ? 1 : 0);
  const filtersLabel = activeFilterCount > 0 ? t("filters.toggleActive", { count: activeFilterCount }) : t("filters.toggle");

  return (
    <View style={styles.screen}>
      <Text style={styles.tagline}>{t("app.tagline")}</Text>

      <TextInput
        style={styles.input}
        placeholder={t("search.placeholder")}
        placeholderTextColor={colors.textFaint}
        value={query}
        onChangeText={onChangeQuery}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel={t("search.hint")}
        accessibilityHint={t("search.hint")}
      />

      <View style={styles.sourceRow}>
        <View style={[styles.sourceDot, catalogSource === "online" ? styles.sourceDotOnline : styles.sourceDotOffline]} />
        <Text style={styles.sourceText}>{sourceText}</Text>
        <Pressable
          onPress={() => setFiltersOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          accessibilityLabel={filtersLabel}
          style={({ pressed }) => [styles.filtersButton, activeFilterCount > 0 && styles.filtersButtonActive, pressed && styles.filtersButtonPressed]}
        >
          <Text style={[styles.filtersButtonText, activeFilterCount > 0 && styles.filtersButtonTextActive]}>{filtersLabel}</Text>
        </Pressable>
        <Pressable
          onPress={onRefreshCatalog}
          disabled={catalogLoading}
          accessibilityRole="button"
          accessibilityLabel={t("catalog.refreshCta")}
          hitSlop={8}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.refreshButtonPressed]}
        >
          <Text style={styles.refreshButtonText}>⟳</Text>
        </Pressable>
      </View>

      {filtersOpen && (
        <AreaFilterPanel
          regionGroups={regionGroups}
          cuisines={cuisines}
          selectedRegionId={selectedRegionId}
          selectedCuisine={selectedCuisine}
          onSelectRegion={onSelectRegion}
          onSelectCuisine={onSelectCuisine}
        />
      )}

      <Text style={styles.resultMeta}>
        {tPlural(t, "search.results", results.length)} • {t("common.catalogLabel")}
      </Text>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Mascot size={84} />
            <Text style={styles.emptyTitle}>{t("search.emptyTitle")}</Text>
            <Text style={styles.emptyBody}>{t("search.emptyBody")}</Text>
            <Pressable
              onPress={onCreateFood}
              accessibilityRole="button"
              accessibilityLabel={t("search.createFoodCta")}
              style={({ pressed }) => [styles.createCta, pressed && styles.createCtaPressed]}
            >
              <Text style={styles.createCtaText}>{t("search.createFoodCta")}</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <FoodRow food={item} isFavourite={favouriteIds.has(item.id)} onPress={onSelectFood} onToggleFavourite={onToggleFavourite} />
        )}
      />

      {mealItemCount > 0 && (
        <View
          style={styles.mealBar}
          accessible
          accessibilityLabel={`${t("search.currentMeal")}: ${tPlural(t, "meal.items", mealItemCount)}, ${mealCarbGrams.toFixed(1)} ${t("common.gramsUnit")} ${t("meal.carbShort")}`}
        >
          <Text style={styles.mealBarText}>{t("search.currentMeal")}: {tPlural(t, "meal.items", mealItemCount)}</Text>
          <Text style={styles.mealBarCarbs}>
            {mealCarbGrams.toFixed(1)} {t("common.gramsUnit")} {t("meal.carbShort")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  tagline: { fontSize: fontSizes.base, color: colors.textSecondary, marginTop: 2, marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    minHeight: MIN_TAP_TARGET,
    ...shadows.card.native,
  },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 10 },
  sourceDot: { width: 8, height: 8, borderRadius: radius.pill },
  sourceDotOnline: { backgroundColor: colors.success },
  sourceDotOffline: { backgroundColor: colors.textFaint },
  sourceText: { fontSize: 12, color: colors.textMuted, flex: 1 },
  filtersButton: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  filtersButtonActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  filtersButtonPressed: { opacity: 0.8 },
  filtersButtonText: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  filtersButtonTextActive: { color: colors.accent },
  refreshButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonPressed: { opacity: 0.6 },
  refreshButtonText: { fontSize: 17, color: colors.textSecondary, fontWeight: "700" },
  resultMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: 6 },
  empty: { padding: spacing.xxl, alignItems: "center" },
  emptyTitle: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing.md },
  emptyBody: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: 4, textAlign: "center" },
  createCta: {
    marginTop: spacing.lg,
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    ...shadows.card.native,
  },
  createCtaPressed: { backgroundColor: colors.accentPressed },
  createCtaText: { color: colors.onBrand, fontSize: 15, fontWeight: "700" },
  mealBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    ...shadows.floating.native,
  },
  mealBarText: { color: colors.onBrand, fontSize: 15, fontWeight: "600" },
  mealBarCarbs: { color: colors.brandSoft, fontSize: 16, fontWeight: "800" },
});
