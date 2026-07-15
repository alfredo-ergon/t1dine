import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ContinentGroup, Region } from "@t1dine/food-schema";

import { cuisineLabel, regionLabel } from "../areaLabels";
import { useLanguage } from "../i18n";
import { colors, MIN_TAP_TARGET, radius, spacing } from "../theme";

export interface AreaFilterPanelProps {
  /** Continent → region groups (the `AREA_TAXONOMY` shape) — only continents
   * with at least one seeded region are rendered. */
  regionGroups: ContinentGroup[];
  /** Cuisine tags available in the currently-loaded catalog (see `../areaFilter`'s `availableCuisineTags`). */
  cuisines: string[];
  selectedRegionId: string | null;
  selectedCuisine: string | null;
  onSelectRegion: (regionId: string | null) => void;
  onSelectCuisine: (cuisine: string | null) => void;
}

// Browse-by-area filter panel — a toggleable chip picker for a region
// (continent → region, e.g. "Sul da Europa (Mediterrânico)") and a cuisine
// tag (e.g. "portuguesa"), shown beneath SearchScreen's search input. Each
// axis is independent (CLAUDE.md: "country, market, ... cuisine ... are
// separate dimensions") and each is a single-select toggle: tapping the
// already-selected chip clears that axis.
export function AreaFilterPanel({ regionGroups, cuisines, selectedRegionId, selectedCuisine, onSelectRegion, onSelectCuisine }: AreaFilterPanelProps) {
  const { language, t } = useLanguage();
  const regions: Region[] = regionGroups.flatMap((group) => group.regions);
  const hasSelection = selectedRegionId !== null || selectedCuisine !== null;

  return (
    <View style={styles.panel}>
      <Text style={styles.groupLabel}>{t("filters.regionLabel")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        accessibilityRole="radiogroup"
        accessibilityLabel={t("filters.regionLabel")}
      >
        {regions.map((region) => {
          const isActive = region.id === selectedRegionId;
          const label = regionLabel(region, language);
          return (
            <Pressable
              key={region.id}
              onPress={() => onSelectRegion(isActive ? null : region.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive, checked: isActive }}
              accessibilityLabel={label}
              style={({ pressed }) => [styles.chip, isActive && styles.chipActive, pressed && styles.chipPressed]}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {cuisines.length > 0 && (
        <>
          <Text style={styles.groupLabel}>{t("filters.cuisineLabel")}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            accessibilityRole="radiogroup"
            accessibilityLabel={t("filters.cuisineLabel")}
          >
            {cuisines.map((cuisine) => {
              const isActive = cuisine === selectedCuisine;
              const label = cuisineLabel(cuisine, language);
              return (
                <Pressable
                  key={cuisine}
                  onPress={() => onSelectCuisine(isActive ? null : cuisine)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive, checked: isActive }}
                  accessibilityLabel={label}
                  style={({ pressed }) => [styles.chip, isActive && styles.chipActive, pressed && styles.chipPressed]}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      {hasSelection && (
        <Pressable
          onPress={() => {
            onSelectRegion(null);
            onSelectCuisine(null);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("filters.clear")}
          style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
        >
          <Text style={styles.clearButtonText}>{t("filters.clear")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  chipRow: { gap: spacing.xs, paddingBottom: spacing.sm },
  chip: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipPressed: { opacity: 0.85 },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  chipTextActive: { color: colors.onBrand },
  clearButton: { alignSelf: "flex-start", minHeight: MIN_TAP_TARGET, justifyContent: "center", paddingHorizontal: spacing.sm },
  clearButtonPressed: { opacity: 0.6 },
  clearButtonText: { fontSize: 13, fontWeight: "700", color: colors.danger },
});
