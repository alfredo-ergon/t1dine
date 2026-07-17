import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { FadeIn } from "../components/FadeIn";
import { Mascot } from "../components/Mascot";
import { PressableScale } from "../components/PressableScale";
import { tPlural, useLanguage } from "../i18n";
import { historyDateKey, historyEntryLabel, historyTimeLabel, type HistoryEntry } from "../mealHistory";
import { colors, elevation, fontWeights, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

export interface HistoryScreenProps {
  history: HistoryEntry[];
  /** "Reutilizar": loads this entry's items into the current meal (replacing
   * it) for a brand-new calculation/meal — never links back to this entry,
   * so subsequent edits never rewrite what was actually logged before. */
  onReuse: (entry: HistoryEntry) => void;
  /** "Editar": loads this entry's items into the current meal (replacing it)
   * so it can be adjusted using the Meal screen's existing affordances, then
   * corrected in place via "Atualizar registo" (or logged as a new entry). */
  onEdit: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
}

interface DayGroup {
  dateKey: string;
  entries: HistoryEntry[];
}

// `history` is already most-recently-logged-first (see ../mealHistory.ts's
// loadHistory), so entries sharing a local calendar day are always adjacent
// — a single linear pass groups them without any extra re-sort.
function groupByDay(history: HistoryEntry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of history) {
    const dateKey = historyDateKey(entry.loggedAt);
    const last = groups[groups.length - 1];
    if (last && last.dateKey === dateKey) {
      last.entries.push(entry);
    } else {
      groups.push({ dateKey, entries: [entry] });
    }
  }
  return groups;
}

// "Diário" (meal HISTORY — a dated log of meals actually eaten), distinct
// from ../screens/SavedMealsScreen.tsx's reusable meal TEMPLATES. Read-mostly
// from the parent's perspective (App.tsx owns `history`, loaded once at
// startup): this screen only ever asks the parent to reuse/edit/delete an
// entry, exactly like SavedMealsScreen's use/clone/delete callbacks.
export function HistoryScreen({ history, onReuse, onEdit, onDelete }: HistoryScreenProps) {
  const { t } = useLanguage();

  const groups = useMemo(() => groupByDay(history), [history]);
  const hasAnyHistory = history.length > 0;

  // "Hoje"/"Ontem" read far more naturally than a bare ISO date on a day-old
  // entry, without needing a date-formatting dependency — computed against
  // the LOCAL calendar day (matching ../mealHistory.ts's historyDateKey).
  const todayKey = useMemo(() => historyDateKey(new Date()), []);
  const yesterdayKey = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return historyDateKey(yesterday);
  }, []);

  const dayLabel = (dateKey: string): string => {
    if (dateKey === todayKey) return t("history.today");
    if (dateKey === yesterdayKey) return t("history.yesterday");
    return dateKey;
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <FadeIn>
        <Text style={styles.h1}>{t("history.title")}</Text>
        <Text style={styles.meta}>{tPlural(t, "history.count", history.length)}</Text>
      </FadeIn>

      {!hasAnyHistory && (
        <FadeIn delay={80}>
          <View style={styles.empty}>
            <Mascot size={84} />
            <Text style={styles.emptyTitle}>{t("history.emptyTitle")}</Text>
            <Text style={styles.emptyBody}>{t("history.emptyBody")}</Text>
          </View>
        </FadeIn>
      )}

      {groups.map((group, groupIndex) => (
        <View key={group.dateKey}>
          <Text style={[styles.dateHeader, groupIndex === 0 && styles.dateHeaderFirst]}>{dayLabel(group.dateKey)}</Text>
          {group.entries.map((entry, index) => (
            <FadeIn key={entry.id} delay={Math.min(groupIndex * 3 + index, 8) * 40}>
              <HistoryEntryCard entry={entry} onReuse={onReuse} onEdit={onEdit} onDelete={onDelete} />
            </FadeIn>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

interface HistoryEntryCardProps {
  entry: HistoryEntry;
  onReuse: (entry: HistoryEntry) => void;
  onEdit: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
}

function HistoryEntryCard({ entry, onReuse, onEdit, onDelete }: HistoryEntryCardProps) {
  const { t } = useLanguage();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const label = historyEntryLabel(entry);
  const time = historyTimeLabel(entry.loggedAt);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {/* Decorative meal glyph — hidden from screen readers, same as
            SavedMealsScreen's card (a history entry, like a saved meal, may
            bundle several foods, so there's no single food to derive
            foodEmoji() from). */}
        <View style={styles.tile} accessible={false} importantForAccessibility="no-hide-descendants">
          <Text style={styles.tileGlyph}>🍽</Text>
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardName} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.cardMeta}>
            {time} • {tPlural(t, "savedMeals.itemCount", entry.items.length)} • {t("savedMeals.totalCarbLabel")}: {entry.totalCarbGrams.toFixed(1)}{" "}
            {t("common.gramsUnit")}
          </Text>
        </View>
      </View>

      {confirmingDelete ? (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>{t("history.deleteConfirmTitle")}</Text>
          <Text style={styles.confirmBody}>{t("history.deleteConfirmBody")}</Text>
          <View style={styles.actionRow}>
            <PressableScale
              onPress={() => setConfirmingDelete(false)}
              accessibilityRole="button"
              accessibilityLabel={t("history.deleteConfirmCancel")}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>{t("history.deleteConfirmCancel")}</Text>
            </PressableScale>
            <PressableScale
              onPress={() => onDelete(entry.id)}
              accessibilityRole="button"
              accessibilityLabel={t("history.deleteConfirmConfirm")}
              style={styles.dangerButton}
            >
              <Text style={styles.dangerButtonText}>{t("history.deleteConfirmConfirm")}</Text>
            </PressableScale>
          </View>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <PressableScale
            onPress={() => onReuse(entry)}
            accessibilityRole="button"
            accessibilityLabel={`${t("history.reuseCta")}: ${label}`}
            accessibilityHint={t("history.reuseHint")}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>{t("history.reuseCta")}</Text>
          </PressableScale>
          <PressableScale
            onPress={() => onEdit(entry)}
            accessibilityRole="button"
            accessibilityLabel={`${t("history.editCta")}: ${label}`}
            accessibilityHint={t("history.editHint")}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>{t("history.editCta")}</Text>
          </PressableScale>
          <PressableScale
            onPress={() => setConfirmingDelete(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t("history.deleteCta")}: ${label}`}
            style={styles.dangerOutlineButton}
            hitSlop={4}
          >
            <Text style={styles.dangerOutlineButtonText}>{t("history.deleteCta")}</Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingBottom: 40 },
  h1: { fontSize: typeScale.heading.size, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  empty: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyTitle: { fontSize: typeScale.heading.size, fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing.md, textAlign: "center" },
  emptyBody: { fontSize: 14, color: colors.textMuted, marginTop: 4, textAlign: "center", maxWidth: 300 },
  dateHeader: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
  },
  dateHeaderFirst: { marginTop: 0 },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.xs.native,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start" },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  tileGlyph: { fontSize: 20 },
  cardMain: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  primaryButton: {
    flex: 1,
    minWidth: 88,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    ...elevation.sm.native,
  },
  primaryButtonText: { color: colors.onBrand, fontSize: 14, fontWeight: "700" },
  secondaryButton: {
    flex: 1,
    minWidth: 88,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.sm,
  },
  secondaryButtonText: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  dangerOutlineButton: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: spacing.md,
  },
  dangerOutlineButtonText: { color: colors.danger, fontSize: 14, fontWeight: "700" },
  confirmCard: {
    backgroundColor: colors.confidenceUnverifiedBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  confirmTitle: { fontSize: 15, fontWeight: "800", color: colors.danger, marginBottom: spacing.xs },
  confirmBody: { fontSize: 13, color: colors.textSecondary },
  dangerButton: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  dangerButtonText: { color: colors.onBrand, fontSize: 14, fontWeight: "700" },
});
