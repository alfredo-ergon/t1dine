import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { FadeIn } from "../components/FadeIn";
import { InkSurface } from "../components/InkSurface";
import { Mascot } from "../components/Mascot";
import { NightscoutConnectPanel } from "../components/NightscoutConnectPanel";
import { PressableScale } from "../components/PressableScale";
import { Skeleton } from "../components/Skeleton";
import { fetchGlucose, type GlucoseReading, type GlucoseResult } from "../api";
import { directionArrow, directionLabelKey, formatAge, glucoseSyncErrorKey } from "../glucose";
import { useLanguage } from "../i18n";
import { clearConnection, isPersistent, loadConnection, saveConnection, type NightscoutConnection } from "../nightscoutStore";
import { colors, elevation, fontWeights, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

// Slice 6 — READ-ONLY, explicitly NON-CLINICAL glucose display. This screen
// only ever calls `fetchGlucose()` — either with `{ mock: true }` (the
// deterministic offline "ver exemplo" demo feed) or with a `{ url, token }`
// pair loaded from the user's own secure Nightscout connection
// (../nightscoutStore.ts) — and formats fields the API already computed. It
// must never import or reference `@t1dine/dose-engine` or `src/dose/*`, and
// it must never compute or display an insulin/dose value — the safety
// banner below is permanent and non-dismissible, matching the module
// boundary documented in services/api/src/modules/nightscout.ts.
//
// The Nightscout token is a HIGH-IMPACT credential (CLAUDE.md): it is loaded
// from the secure store once per screen mount, held only in this component's
// state for as long as a sync request needs it, and is NEVER logged, NEVER
// displayed, and NEVER sent anywhere except this one proxied request. Sync is
// always an EXPLICIT user action (the "Sincronizar" button) — never
// automatic/polled.

type ReadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; messageKey: string }
  | { status: "ready"; result: GlucoseResult };

const READING_COUNT = 12;

export function GlucoseScreen() {
  const { t } = useLanguage();

  // The saved connection is (re)loaded from the secure store on every mount —
  // this screen is unmounted whenever an overlay (e.g. Perfil) is open (see
  // App.tsx), so returning here after "Apagar todos os meus dados" cleared
  // the store always reflects the current, correct connected/disconnected
  // state rather than a stale in-memory value.
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [connection, setConnection] = useState<NightscoutConnection | null>(null);

  const [demoMode, setDemoMode] = useState(false);
  const [demoState, setDemoState] = useState<ReadState>({ status: "idle" });
  const [liveState, setLiveState] = useState<ReadState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    loadConnection()
      .then((loaded) => {
        if (!cancelled) setConnection(loaded);
      })
      .finally(() => {
        if (!cancelled) setConnectionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDemo = useCallback(() => {
    setDemoState({ status: "loading" });
    fetchGlucose({ mock: true, count: READING_COUNT })
      .then((result) => setDemoState({ status: "ready", result }))
      .catch((error) => setDemoState({ status: "error", messageKey: glucoseSyncErrorKey(error) }));
  }, []);

  const handleToggleDemo = useCallback(() => {
    setDemoMode((prev) => {
      const next = !prev;
      if (next) loadDemo();
      return next;
    });
  }, [loadDemo]);

  // The ONLY place this screen ever reads url+token out of state to build a
  // request — always in direct response to the user tapping "Sincronizar",
  // never on a timer and never automatically on mount/connect.
  const handleSync = useCallback(() => {
    if (!connection) return;
    setLiveState({ status: "loading" });
    fetchGlucose({ url: connection.url, token: connection.token, count: READING_COUNT })
      .then((result) => setLiveState({ status: "ready", result }))
      .catch((error) => setLiveState({ status: "error", messageKey: glucoseSyncErrorKey(error) }));
  }, [connection]);

  const handleSaveConnection = useCallback(async (url: string, token: string) => {
    await saveConnection({ url, token });
    setConnection({ url, token });
    // A freshly (re)connected site has no synced data yet under this exact
    // url/token pair — reset to "idle" so the UI asks for a fresh, explicit
    // "Sincronizar" rather than ever showing data from a previous connection.
    setLiveState({ status: "idle" });
  }, []);

  const handleDisconnect = useCallback(() => {
    void clearConnection();
    setConnection(null);
    setLiveState({ status: "idle" });
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{t("glucose.title")}</Text>

      <View style={styles.safetyBanner} accessible accessibilityLabel={t("glucose.safetyBanner")}>
        <Text style={styles.safetyIcon}>ⓘ</Text>
        <Text style={styles.safetyText}>{t("glucose.safetyBanner")}</Text>
      </View>

      {!connectionLoading && (
        <NightscoutConnectPanel
          connected={connection !== null}
          currentUrl={connection?.url ?? null}
          isPersistent={isPersistent}
          onSave={handleSaveConnection}
          onDisconnect={handleDisconnect}
        />
      )}

      <DemoToggleRow enabled={demoMode} onToggle={handleToggleDemo} />

      {demoMode ? (
        <GlucoseStateView state={demoState} onAction={loadDemo} actionLabel={t("glucose.syncButton")} />
      ) : connection ? (
        <GlucoseStateView
          state={liveState}
          onAction={handleSync}
          actionLabel={t("glucose.syncButton")}
          idleNode={<NotSyncedPrompt onSync={handleSync} />}
        />
      ) : (
        <ConnectPromptEmpty />
      )}
    </ScrollView>
  );
}

function DemoToggleRow({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  const { t } = useLanguage();
  return (
    <FadeIn>
      <PressableScale
        onPress={onToggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
        accessibilityLabel={t("glucose.demoToggleLabel")}
        accessibilityHint={t("glucose.demoToggleHint")}
        style={[styles.demoRow, enabled && styles.demoRowActive]}
      >
        <View style={[styles.demoDot, enabled && styles.demoDotActive]} />
        <View style={styles.demoTextWrap}>
          <Text style={styles.demoLabel}>{t("glucose.demoToggleLabel")}</Text>
          <Text style={styles.demoHint}>{t("glucose.demoToggleHint")}</Text>
        </View>
      </PressableScale>
    </FadeIn>
  );
}

function ConnectPromptEmpty() {
  const { t } = useLanguage();
  return (
    <FadeIn>
      <View style={styles.center}>
        <Mascot size={84} />
        <Text style={styles.emptyTitle}>{t("glucose.connectPromptTitle")}</Text>
        <Text style={styles.emptyBody}>{t("glucose.connectPromptBody")}</Text>
      </View>
    </FadeIn>
  );
}

function NotSyncedPrompt({ onSync }: { onSync: () => void }) {
  const { t } = useLanguage();
  return (
    <FadeIn>
      <View style={styles.center}>
        <Mascot size={64} />
        <Text style={styles.emptyTitle}>{t("glucose.notSyncedTitle")}</Text>
        <Text style={styles.emptyBody}>{t("glucose.notSyncedBody")}</Text>
        <PressableScale onPress={onSync} accessibilityRole="button" accessibilityLabel={t("glucose.syncButton")} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>{t("glucose.syncButton")}</Text>
        </PressableScale>
      </View>
    </FadeIn>
  );
}

/**
 * Shared idle/loading/error/ready presentation for BOTH the demo feed and a
 * live Nightscout sync — the two are simply different `ReadState` sources
 * feeding the same untrusted-response-shaped `GlucoseResult` (see ../api.ts).
 * `idleNode` (only ever supplied for the live/connected case) covers "you're
 * connected but haven't tapped Sincronizar yet" — the demo feed never sits
 * idle since turning it on always triggers an immediate load.
 */
function GlucoseStateView({
  state,
  onAction,
  actionLabel,
  idleNode,
}: {
  state: ReadState;
  onAction: () => void;
  actionLabel: string;
  idleNode?: ReactNode;
}) {
  const { t } = useLanguage();

  if (state.status === "idle") {
    return idleNode ? <>{idleNode}</> : null;
  }

  if (state.status === "loading") {
    return (
      <View accessible accessibilityLabel={t("glucose.loading")}>
        <Skeleton height={128} radius={radius.xl} style={styles.skeletonCard} />
        <Skeleton height={16} width="60%" style={styles.skeletonLine} />
        <Skeleton height={44} style={styles.skeletonLine} />
        <Skeleton height={44} style={styles.skeletonLine} />
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <FadeIn>
        <View style={styles.center}>
          <Mascot size={84} />
          <Text style={styles.emptyTitle}>{t("glucose.syncErrorTitle")}</Text>
          <Text style={styles.emptyBody}>{t(state.messageKey)}</Text>
          <PressableScale onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>{actionLabel}</Text>
          </PressableScale>
        </View>
      </FadeIn>
    );
  }

  return <GlucoseReady result={state.result} onRefresh={onAction} refreshLabel={actionLabel} />;
}

function GlucoseReady({ result, onRefresh, refreshLabel }: { result: GlucoseResult; onRefresh: () => void; refreshLabel: string }) {
  const { t } = useLanguage();
  const { newest, readings, allStale, source } = result;

  return (
    <FadeIn>
      <View style={styles.sourceRow}>
        <Text style={styles.sourceText}>{source === "mock" ? t("glucose.sourceMock") : t("glucose.sourceLive")}</Text>
        <PressableScale onPress={onRefresh} accessibilityRole="button" accessibilityLabel={refreshLabel} style={styles.refreshButton} hitSlop={8}>
          <Text style={styles.refreshButtonText}>⟳ {refreshLabel}</Text>
        </PressableScale>
      </View>

      {newest ? (
        <InkSurface
          contentStyle={styles.newestContent}
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
        </InkSurface>
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
  demoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginBottom: spacing.md,
    minHeight: MIN_TAP_TARGET,
    ...elevation.sm.native,
  },
  demoRowActive: { borderColor: colors.brand, borderWidth: 1.5 },
  demoDot: { width: 20, height: 20, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.borderStrong },
  demoDotActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  demoTextWrap: { flex: 1 },
  demoLabel: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  demoHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  skeletonCard: { marginBottom: spacing.md },
  skeletonLine: { marginBottom: spacing.sm },
  center: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyTitle: { fontSize: typeScale.heading.size, fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing.md, textAlign: "center" },
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
  newestContent: { padding: spacing.lg },
  newestLabel: { fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  newestValueRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  newestArrow: { fontSize: 40, color: colors.focusRing, fontWeight: "700" },
  newestValue: { fontSize: typeScale.display.size, fontWeight: fontWeights.extrabold, color: colors.onBrand },
  newestUnit: { fontSize: typeScale.subheading.size, fontWeight: fontWeights.semibold, color: "rgba(255,255,255,0.7)" },
  newestSecondary: { fontSize: typeScale.subheading.size, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  newestDirection: { fontSize: 14, color: "rgba(255,255,255,0.85)", marginTop: spacing.sm },
  newestAge: { fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 2 },
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
