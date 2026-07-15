import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { FadeIn } from "../components/FadeIn";
import { Mascot } from "../components/Mascot";
import { PressableScale } from "../components/PressableScale";
import { tPlural, useLanguage } from "../i18n";
import type { SavedMeal } from "../savedMeals";
import { searchSavedMeals } from "../savedMeals";
import { colors, elevation, fontWeights, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

export interface SavedMealsScreenProps {
  savedMeals: SavedMeal[];
  /** "Usar": loads this saved meal into the current meal (replacing it) to review totals and proceed to the dose estimate. */
  onUse: (meal: SavedMeal) => void;
  /** "Clonar e ajustar": loads a copy into the current meal (replacing it) so quantities can be tweaked without touching the saved original. */
  onClone: (meal: SavedMeal) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

// "Refeições guardadas" (Slice: refeições repetidas). Local-first and fully
// controlled by the parent (App.tsx owns the `savedMeals` list and its
// mutations) — same shape as MealScreen/SearchScreen, not the read-only,
// self-loading pattern SubmissionsScreen uses, because this screen needs to
// mutate the list (rename/delete) and to hand a saved meal back to the
// current, editable meal (use/clone).
export function SavedMealsScreen({ savedMeals, onUse, onClone, onRename, onDelete }: SavedMealsScreenProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchSavedMeals(query, savedMeals), [query, savedMeals]);
  const hasAnySavedMeals = savedMeals.length > 0;
  const hasResults = results.length > 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <FadeIn>
        <Text style={styles.h1}>{t("savedMeals.title")}</Text>
        <Text style={styles.meta}>{tPlural(t, "savedMeals.count", savedMeals.length)}</Text>
      </FadeIn>

      {hasAnySavedMeals && (
        <FadeIn delay={40}>
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={t("savedMeals.searchPlaceholder")}
              placeholderTextColor={colors.textFaint}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel={t("savedMeals.searchLabel")}
            />
          </View>
        </FadeIn>
      )}

      {!hasAnySavedMeals && (
        <FadeIn delay={80}>
          <View style={styles.empty}>
            <Mascot size={84} />
            <Text style={styles.emptyTitle}>{t("savedMeals.emptyTitle")}</Text>
            <Text style={styles.emptyBody}>{t("savedMeals.emptyBody")}</Text>
          </View>
        </FadeIn>
      )}

      {hasAnySavedMeals && !hasResults && (
        <FadeIn delay={80}>
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t("savedMeals.noResultsTitle")}</Text>
            <Text style={styles.emptyBody}>{t("savedMeals.noResultsBody")}</Text>
          </View>
        </FadeIn>
      )}

      {results.map((meal, index) => (
        <FadeIn key={meal.id} delay={Math.min(index, 6) * 40}>
          <SavedMealCard meal={meal} onUse={onUse} onClone={onClone} onRename={onRename} onDelete={onDelete} />
        </FadeIn>
      ))}
    </ScrollView>
  );
}

interface SavedMealCardProps {
  meal: SavedMeal;
  onUse: (meal: SavedMeal) => void;
  onClone: (meal: SavedMeal) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function SavedMealCard({ meal, onUse, onClone, onRename, onDelete }: SavedMealCardProps) {
  const { t } = useLanguage();
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(meal.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const createdDate = meal.createdAt.slice(0, 10);

  const handleStartRename = () => {
    setNameDraft(meal.name);
    setRenameError(null);
    setRenaming(true);
  };

  const handleConfirmRename = () => {
    const trimmed = nameDraft.trim();
    if (trimmed.length === 0) {
      setRenameError(t("savedMeals.renameError"));
      return;
    }
    onRename(meal.id, trimmed);
    setRenaming(false);
  };

  const handleCancelRename = () => {
    setRenaming(false);
    setRenameError(null);
  };

  return (
    <View style={styles.card}>
      {renaming ? (
        <View>
          <Text style={styles.renameLabel}>{t("savedMeals.renameLabel")}</Text>
          <TextInput
            style={styles.renameInput}
            value={nameDraft}
            onChangeText={(value) => {
              setNameDraft(value);
              if (renameError) setRenameError(null);
            }}
            accessibilityLabel={t("savedMeals.renameLabel")}
            autoFocus
          />
          {renameError && <Text style={styles.error}>{renameError}</Text>}
          <View style={styles.actionRow}>
            <PressableScale
              onPress={handleCancelRename}
              accessibilityRole="button"
              accessibilityLabel={t("savedMeals.renameCancel")}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>{t("savedMeals.renameCancel")}</Text>
            </PressableScale>
            <PressableScale
              onPress={handleConfirmRename}
              accessibilityRole="button"
              accessibilityLabel={t("savedMeals.renameSave")}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>{t("savedMeals.renameSave")}</Text>
            </PressableScale>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.cardHeader}>
            <Text style={styles.cardName}>{meal.name}</Text>
            <PressableScale
              onPress={handleStartRename}
              accessibilityRole="button"
              accessibilityLabel={`${t("savedMeals.renameCta")}: ${meal.name}`}
              style={styles.renameIconButton}
              hitSlop={4}
            >
              <Text style={styles.renameIconText}>✎</Text>
            </PressableScale>
          </View>

          <Text style={styles.cardMeta}>
            {tPlural(t, "savedMeals.itemCount", meal.items.length)} • {t("savedMeals.totalCarbLabel")}: {meal.totalCarbGrams.toFixed(1)}{" "}
            {t("common.gramsUnit")}
          </Text>
          <Text style={styles.cardDate}>{t("savedMeals.createdAtLabel", { date: createdDate })}</Text>

          {confirmingDelete ? (
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>{t("savedMeals.deleteConfirmTitle")}</Text>
              <Text style={styles.confirmBody}>{t("savedMeals.deleteConfirmBody")}</Text>
              <View style={styles.actionRow}>
                <PressableScale
                  onPress={() => setConfirmingDelete(false)}
                  accessibilityRole="button"
                  accessibilityLabel={t("savedMeals.deleteConfirmCancel")}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>{t("savedMeals.deleteConfirmCancel")}</Text>
                </PressableScale>
                <PressableScale
                  onPress={() => onDelete(meal.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t("savedMeals.deleteConfirmConfirm")}
                  style={styles.dangerButton}
                >
                  <Text style={styles.dangerButtonText}>{t("savedMeals.deleteConfirmConfirm")}</Text>
                </PressableScale>
              </View>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <PressableScale
                onPress={() => onUse(meal)}
                accessibilityRole="button"
                accessibilityLabel={t("savedMeals.useCta")}
                accessibilityHint={t("savedMeals.useHint")}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>{t("savedMeals.useCta")}</Text>
              </PressableScale>
              <PressableScale
                onPress={() => onClone(meal)}
                accessibilityRole="button"
                accessibilityLabel={t("savedMeals.cloneCta")}
                accessibilityHint={t("savedMeals.cloneHint")}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>{t("savedMeals.cloneCta")}</Text>
              </PressableScale>
              <PressableScale
                onPress={() => setConfirmingDelete(true)}
                accessibilityRole="button"
                accessibilityLabel={t("savedMeals.deleteCta")}
                style={styles.dangerOutlineButton}
                hitSlop={4}
              >
                <Text style={styles.dangerOutlineButtonText}>{t("savedMeals.deleteCta")}</Text>
              </PressableScale>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingBottom: 40 },
  h1: { fontSize: typeScale.heading.size, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceElevated,
    minHeight: MIN_TAP_TARGET,
    marginBottom: spacing.md,
    ...elevation.sm.native,
  },
  searchIcon: { fontSize: 17, color: colors.textFaint, marginRight: spacing.xs },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: colors.textPrimary, minHeight: MIN_TAP_TARGET },
  empty: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyTitle: { fontSize: typeScale.heading.size, fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing.md, textAlign: "center" },
  emptyBody: { fontSize: 14, color: colors.textMuted, marginTop: 4, textAlign: "center", maxWidth: 300 },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.xs.native,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardName: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  renameIconButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  renameIconText: { fontSize: 16, color: colors.textMuted },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  cardDate: { fontSize: 12, color: colors.textFaint, marginTop: 2, marginBottom: spacing.sm },
  renameLabel: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
  },
  renameInput: {
    minHeight: MIN_TAP_TARGET,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 4 },
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
