import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { FadeIn } from "../components/FadeIn";
import { Mascot } from "../components/Mascot";
import { PressableScale } from "../components/PressableScale";
import { Skeleton } from "../components/Skeleton";
import { fetchGlucose, type GlucoseReading, type GlucoseResult } from "../api";
import { directionArrow, directionLabelKey, formatAge } from "../glucose";
import { useLanguage } from "../i18n";
import { colors, elevation, fontWeights, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

// Slice 6 — READ-ONLY, explicitly NON-CLINICAL glucose display. This screen
// only ever calls `fetchGlucose()` (a GET-equivalent, mock-mode-only read)
// and formats fields the API already computed. It must never import or
// reference `@t1dine/dose-engine`, and it must never compute or display an
// insulin/dose value — the safety banner below is permanent and
// non-dismissible, matching the module boundary documented in
// services/api/src/modules/nightscout.ts.

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; result: GlucoseResult };

const READING_COUNT = 12;

export function GlucoseScreen() {
  const { t } = useLanguage();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    fetchGlucose({ count: READING_COUNT })
      .then((result) => setState({ status: "ready", result }))
      .catch(() => setState({ status: "error" }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{t("glucose.title")}</Text>

      <View style={styles.safetyBanner} accessible accessibilityLabel={t("glucose.safetyBanner")}>
        <Text style={styles.safetyIcon}>ⓘ</Text>
        <Text style={styles.safetyText}>{t("glucose.safetyBanner")}</Text>
      </View>

      {state.status === "loading" && (
        <View accessible accessibilityLabel={t("glucose.loading")}>
          <Skeleton height={128} radius={radius.xl} style={styles.skeletonCard} />
          <Skeleton height={16} width="60%" style={styles.skeletonLine} />
          <Skeleton height={44} style={styles.skeletonLine} />
          <Skeleton height={44} style={styles.skeletonLine} />
        </View>
      )}

      {state.status === "error" && (
        <FadeIn>
          <View style={styles.center}>
            <Mascot size={84} />
            <Text style={styles.emptyTitle}>{t("glucose.offlineTitle")}</Text>
            <Text style={styles.emptyBody}>{t("glucose.offlineBody")}</Text>
            <PressableScale onPress={load} accessibilityRole="button" accessibilityLabel={t("glucose.retry")} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>{t("glucose.retry")}</Text>
            </PressableScale>
          </View>
        </FadeIn>
      )}

      {state.status === "ready" && <GlucoseReady result={state.result} onRefresh={load} />}
    </ScrollView>
  );
}

function GlucoseReady({ result, onRefresh }: { result: GlucoseResult; onRefresh: () => void }) {
  const { t } = useLanguage();
  const { newest, readings, allStale, source } = result;

  return (
    <FadeIn>
      <View style={styles.sourceRow}>
        <Text style={styles.sourceText}>{source === "mock" ? t("glucose.sourceMock") : t("glucose.sourceLive")}</Text>
        <PressableScale onPress={onRefresh} accessibilityRole="button" accessibilityLabel={t("glucose.retry")} style={styles.refreshButton} hitSlop={8}>
          <Text style={styles.refreshButtonText}>⟳ {t("glucose.retry")}</Text>
        </PressableScale>
      </View>

      {newest ? (
        <View
          style={styles.newestCard}
          accessible
          accessibilityLabel={`${t("glucose.newestLabel")}: ${Math.round(newest.mgdl)} ${t("glucose.mgdlUnit")}, ${newest.mmol.toFixed(1)} ${t("glucose.mmolUnit")}, ${t(directionLabelKey(newest.direction))}, ${formatAge(t, newest.ageMinutes)}`}
        >
          <Text style={styles.newestLabel}>{t("glucose.newestLabel")}</Text>
          <View style={styles.newestValueRow}>
            <Text style={styles.newestArrow}>{directionArrow(newest.direction)}</Text>
            <View>
              <Text style={styles.newestValue}>
                {Math.round(newest.mgdl)} <Text style={styles.newestUnit}>{t("glucose.mgdlUnit")}</Text>
              </Text>
              <Text style={styles.newestSecondary}>
                {newest.mmol.toFixed(1)} {t("glucose.mmolUnit")}
              </Text>
            </View>
          </View>
          <Text style={styles.newestDirection}>{t(directionLabelKey(newest.direction))}</Text>
          <Text style={styles.newestAge}>{formatAge(t, newest.ageMinutes)}</Text>
        </View>
      ) : (
        <View style={styles.center}>
          <Mascot size={64} />
          <Text style={styles.emptyBody}>{t("glucose.noReadings")}</Text>
        </View>
      )}

      {allStale && readings.length > 0 && (
        <View style={styles.staleBanner} accessible accessibilityLabel={t("glucose.allStaleWarning")}>
          <Text style={styles.staleBannerIcon}>▲</Text>
          <Text style={styles.staleBannerText}>{t("glucose.allStaleWarning")}</Text>
        </View>
      )}

      {readings.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t("glucose.recentTitle")}</Text>
          {readings.map((reading) => (
            <GlucoseRow key={reading.iso} reading={reading} />
          ))}
        </>
      )}
    </FadeIn>
  );
}

function GlucoseRow({ reading }: { reading: GlucoseReading }) {
  const { t } = useLanguage();
  const label = `${Math.round(reading.mgdl)} ${t("glucose.mgdlUnit")}, ${reading.mmol.toFixed(1)} ${t("glucose.mmolUnit")}, ${t(directionLabelKey(reading.direction))}, ${formatAge(t, reading.ageMinutes)}${reading.stale ? `, ${t("glucose.staleWarning")}` : ""}`;

  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      <Text style={styles.rowArrow}>{directionArrow(reading.direction)}</Text>
      <View style={styles.rowMain}>
        <Text style={styles.rowValue}>
          {Math.round(reading.mgdl)} {t("glucose.mgdlUnit")} • {reading.mmol.toFixed(1)} {t("glucose.mmolUnit")}
        </Text>
        <Text style={styles.rowAge}>{formatAge(t, reading.ageMinutes)}</Text>
      </View>
      {reading.stale && (
        <View style={styles.staleTag}>
          <Text style={styles.staleTagText}>{t("glucose.staleWarning")}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingBottom: 40 },
  h1: { fontSize: typeScale.heading.size, fontWeight: fontWeights.extrabold, color: colors.textPrimary, marginTop: spacing.sm },
  safetyBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.confidenceMediumBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    alignItems: "flex-start",
  },
  safetyIcon: { color: colors.confidenceMedium, fontSize: 16, fontWeight: "700" },
  safetyText: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  skeletonCard: { marginBottom: spacing.md },
  skeletonLine: { marginBottom: spacing.sm },
  center: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyTitle: { fontSize: typeScale.heading.size, fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing.md },
  emptyBody: { fontSize: 14, color: colors.textMuted, marginTop: 4, textAlign: "center" },
  retryButton: {
    marginTop: spacing.lg,
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    ...elevation.sm.native,
  },
  retryButtonText: { color: colors.onBrand, fontSize: 15, fontWeight: "700" },
  sourceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  sourceText: { fontSize: 12, color: colors.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  refreshButton: { minHeight: MIN_TAP_TARGET, justifyContent: "center", paddingHorizontal: spacing.sm },
  refreshButtonText: { fontSize: 13, color: colors.accent, fontWeight: "700" },
  newestCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    ...elevation.md.native,
  },
  newestLabel: { fontSize: 12, color: colors.textFaint, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  newestValueRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  newestArrow: { fontSize: 40, color: colors.brand, fontWeight: "700" },
  newestValue: { fontSize: typeScale.display.size, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  newestUnit: { fontSize: typeScale.subheading.size, fontWeight: fontWeights.semibold, color: colors.textMuted },
  newestSecondary: { fontSize: typeScale.subheading.size, color: colors.textMuted, marginTop: 2 },
  newestDirection: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm },
  newestAge: { fontSize: 13, color: colors.textFaint, marginTop: 2 },
  staleBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.confidenceLowBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    alignItems: "flex-start",
  },
  staleBannerIcon: { color: colors.confidenceLow, fontSize: 16, fontWeight: "700" },
  staleBannerText: { flex: 1, fontSize: 13, color: colors.textSecondary },
  sectionTitle: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.sm,
    marginVertical: 4,
  },
  rowArrow: { fontSize: 20, color: colors.textSecondary, width: 28, textAlign: "center" },
  rowMain: { flex: 1 },
  rowValue: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  rowAge: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  staleTag: { backgroundColor: colors.confidenceLowBg, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  staleTagText: { fontSize: 11, fontWeight: "700", color: colors.confidenceLow },
});
