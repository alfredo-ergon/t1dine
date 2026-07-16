import { useEffect, useRef, useState } from "react";
import { Animated, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { CanonicalFood, ContinentGroup } from "@t1dine/food-schema";

import { AnimatedCounter } from "../components/AnimatedCounter";
import { AreaFilterPanel } from "../components/AreaFilterPanel";
import { FadeIn } from "../components/FadeIn";
import { FoodRow } from "../components/FoodRow";
import { InkSurface } from "../components/InkSurface";
import { Mascot } from "../components/Mascot";
import { PressableScale } from "../components/PressableScale";
import { Skeleton } from "../components/Skeleton";
import { tPlural, useLanguage } from "../i18n";
import { easings } from "../motionUtils";
import { colors, elevation, fontWeights, gradients, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";
import { useReducedMotion } from "../useReducedMotion";

export interface SearchScreenProps {
  query: string;
  onChangeQuery: (query: string) => void;
  results: CanonicalFood[];
  favouriteIds: Set<string>;
  onSelectFood: (food: CanonicalFood) => void;
  onToggleFavourite: (food: CanonicalFood) => void;
  onCreateFood: () => void;
  /** Opens the barcode scan flow (Slice: barcode scanning) — camera on native, manual entry on web. */
  onScanBarcode: () => void;
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

function EmptyState({ onCreateFood }: { onCreateFood: () => void }) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1500, easing: easings.standard, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1500, easing: easings.standard, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <FadeIn>
      <View style={styles.empty}>
        <Animated.View style={{ transform: [{ translateY }] }}>
          <Mascot size={92} />
        </Animated.View>
        <Text style={styles.emptyTitle}>{t("search.emptyTitle")}</Text>
        <Text style={styles.emptyBody}>{t("search.emptyBody")}</Text>
        <PressableScale onPress={onCreateFood} accessibilityRole="button" accessibilityLabel={t("search.createFoodCta")} style={styles.createCta}>
          <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.createCtaGradient}>
            <Text style={styles.createCtaText}>{t("search.createFoodCta")}</Text>
          </LinearGradient>
        </PressableScale>
      </View>
    </FadeIn>
  );
}

export function SearchScreen({
  query,
  onChangeQuery,
  results,
  favouriteIds,
  onSelectFood,
  onToggleFavourite,
  onCreateFood,
  onScanBarcode,
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
  const sourceText = catalogSource === "online" ? t("catalog.sourceOnline") : t("catalog.sourceOffline");
  // Must always agree with `sourceText`/the status dot above — never say
  // "offline" while the dot is green/"online", and vice versa.
  const catalogMetaText = catalogSource === "online" ? t("catalog.metaOnline") : t("catalog.metaOffline");
  const activeFilterCount = (selectedRegionId ? 1 : 0) + (selectedCuisine ? 1 : 0);
  const filtersLabel = activeFilterCount > 0 ? t("filters.toggleActive", { count: activeFilterCount }) : t("filters.toggle");

  return (
    <View style={styles.screen}>
      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <Text style={styles.inputIcon}>⌕</Text>
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
            returnKeyType="search"
            clearButtonMode="never"
          />
          {query.length > 0 && (
            <PressableScale
              onPress={() => onChangeQuery("")}
              accessibilityRole="button"
              accessibilityLabel={t("search.clear")}
              hitSlop={8}
              style={styles.clearButton}
            >
              <Text style={styles.clearIcon}>×</Text>
            </PressableScale>
          )}
        </View>
        <PressableScale
          onPress={onScanBarcode}
          accessibilityRole="button"
          accessibilityLabel={t("search.scanBarcodeLabel")}
          accessibilityHint={t("search.scanBarcodeHint")}
          style={styles.scanButton}
        >
          <Text style={styles.scanButtonIcon}>▤</Text>
        </PressableScale>
      </View>

      <View style={styles.sourceRow}>
        {catalogLoading ? (
          <View style={styles.sourceLoadingRow} accessible accessibilityLabel={t("catalog.refreshing")}>
            <Skeleton height={10} width={90} radius={radius.pill} />
          </View>
        ) : (
          <FadeIn key={catalogSource} distance={2} style={styles.sourcePill}>
            <View style={[styles.sourceDot, catalogSource === "online" ? styles.sourceDotOnline : styles.sourceDotOffline]} />
            <Text style={styles.sourceText}>{sourceText}</Text>
          </FadeIn>
        )}

        <PressableScale
          onPress={() => setFiltersOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          accessibilityLabel={filtersLabel}
          style={[styles.filtersButton, activeFilterCount > 0 && styles.filtersButtonActive]}
        >
          <Text style={[styles.filtersButtonText, activeFilterCount > 0 && styles.filtersButtonTextActive]}>{filtersLabel}</Text>
        </PressableScale>
        <PressableScale
          onPress={onRefreshCatalog}
          disabled={catalogLoading}
          accessibilityRole="button"
          accessibilityLabel={t("catalog.refreshCta")}
          hitSlop={8}
          style={styles.refreshButton}
        >
          <Text style={styles.refreshButtonText}>⟳</Text>
        </PressableScale>
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
        {tPlural(t, "search.results", results.length)} • {catalogMetaText}
      </Text>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState onCreateFood={onCreateFood} />}
        renderItem={({ item }) => (
          <FoodRow food={item} isFavourite={favouriteIds.has(item.id)} onPress={onSelectFood} onToggleFavourite={onToggleFavourite} />
        )}
      />

      {mealItemCount > 0 && (
        <InkSurface
          style={styles.mealBar}
          contentStyle={styles.mealBarContent}
          accessible
          accessibilityLabel={`${t("search.currentMeal")}: ${tPlural(t, "meal.items", mealItemCount)}, ${mealCarbGrams.toFixed(1)} ${t("common.gramsUnit")} ${t("meal.carbShort")}`}
        >
          <View>
            <Text style={styles.mealBarLabel}>{t("search.currentMeal")}</Text>
            <Text style={styles.mealBarSub}>{tPlural(t, "meal.items", mealItemCount)}</Text>
          </View>
          <View style={styles.mealBarCarbWrap}>
            <AnimatedCounter value={mealCarbGrams} decimals={1} style={styles.mealBarCarbs} suffix={` ${t("common.gramsUnit")}`} />
            <Text style={styles.mealBarCarbLabel}>{t("meal.carbShort")}</Text>
          </View>
        </InkSurface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xs },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceElevated,
    minHeight: MIN_TAP_TARGET,
    ...elevation.sm.native,
  },
  scanButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brand,
    ...elevation.sm.native,
  },
  scanButtonIcon: { fontSize: 20, color: colors.brandDark },
  inputIcon: { fontSize: 17, color: colors.textFaint, marginRight: spacing.xs },
  clearButton: {
    minWidth: 32,
    minHeight: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSunken,
    marginLeft: spacing.xs,
  },
  clearIcon: { fontSize: 18, lineHeight: 20, color: colors.textMuted, fontWeight: "700" },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    minHeight: MIN_TAP_TARGET,
  },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  sourceLoadingRow: { flex: 1, minHeight: MIN_TAP_TARGET, justifyContent: "center" },
  sourcePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: MIN_TAP_TARGET,
  },
  sourceDot: { width: 8, height: 8, borderRadius: radius.pill },
  sourceDotOnline: { backgroundColor: colors.success },
  sourceDotOffline: { backgroundColor: colors.textFaint },
  sourceText: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
  filtersButton: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  filtersButtonActive: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  filtersButtonText: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  filtersButtonTextActive: { color: colors.brandDark },
  refreshButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonText: { fontSize: 17, color: colors.textSecondary, fontWeight: "700" },
  resultMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.xs },
  empty: { padding: spacing.xxl, alignItems: "center" },
  emptyTitle: { fontSize: typeScale.heading.size, fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing.md },
  emptyBody: { fontSize: 14, color: colors.textMuted, marginTop: 4, textAlign: "center", maxWidth: 280 },
  createCta: { marginTop: spacing.lg, borderRadius: radius.pill, ...elevation.glow.native },
  createCtaGradient: {
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.pill,
  },
  createCtaText: { color: colors.onBrand, fontSize: 15, fontWeight: "700" },
  mealBar: { marginBottom: 14 },
  mealBarContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  mealBarLabel: { color: colors.onBrand, fontSize: 15, fontWeight: "700" },
  mealBarSub: { color: "rgba(255,255,255,0.72)", fontSize: 12, marginTop: 1 },
  mealBarCarbWrap: { alignItems: "flex-end" },
  mealBarCarbs: { color: colors.focusRing, fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"] },
  mealBarCarbLabel: { color: "rgba(255,255,255,0.72)", fontSize: 11 },
});
