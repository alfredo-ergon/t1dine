import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { ContinentGroup, Region } from "@t1dine/food-schema";

import { cuisineLabel, regionLabel } from "../areaLabels";
import { FadeIn } from "./FadeIn";
import { tPlural, useLanguage } from "../i18n";
import { colors, elevation, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";
import { PressableScale } from "./PressableScale";

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
// already-selected chip clears that axis. A summary row up top always makes
// the current filter state legible at a glance ("X filtros ativos" / "Limpar
// filtros"), even before scrolling through the chip rows.
export function AreaFilterPanel({ regionGroups, cuisines, selectedRegionId, selectedCuisine, onSelectRegion, onSelectCuisine }: AreaFilterPanelProps) {
  const { language, t } = useLanguage();
  const regions: Region[] = regionGroups.flatMap((group) => group.regions);
  const activeCount = (selectedRegionId ? 1 : 0) + (selectedCuisine ? 1 : 0);
  const hasSelection = activeCount > 0;

  return (
    <FadeIn distance={6}>
      <View style={styles.panel}>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryDot, hasSelection && styles.summaryDotActive]} />
          <Text style={styles.summaryText}>{hasSelection ? tPlural(t, "filters.activeSummary", activeCount) : t("filters.noneActive")}</Text>
          {hasSelection && (
            <PressableScale
              onPress={() => {
                onSelectRegion(null);
                onSelectCuisine(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("filters.clear")}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>{t("filters.clear")}</Text>
            </PressableScale>
          )}
        </View>

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
              <PressableScale
                key={region.id}
                onPress={() => onSelectRegion(isActive ? null : region.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive, checked: isActive }}
                accessibilityLabel={label}
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
              </PressableScale>
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
                  <PressableScale
                    key={cuisine}
                    onPress={() => onSelectCuisine(isActive ? null : cuisine)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isActive, checked: isActive }}
                    accessibilityLabel={label}
                    style={[styles.chip, isActive && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.sm.native,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  summaryDot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.textFaint },
  summaryDotActive: { backgroundColor: colors.brand },
  summaryText: { flex: 1, fontSize: typeScale.label.size, fontWeight: typeScale.label.weight, color: colors.textSecondary },
  clearButton: { minHeight: MIN_TAP_TARGET, justifyContent: "center", paddingHorizontal: spacing.sm },
  clearButtonText: { fontSize: 13, fontWeight: "700", color: colors.danger },
  groupLabel: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
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
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand, ...elevation.xs.native },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  chipTextActive: { color: colors.onBrand },
});
