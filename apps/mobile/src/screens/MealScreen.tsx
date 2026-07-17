import { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { MealLine, MealLineSummary } from "@t1dine/nutrition";
import { summariseMeal } from "@t1dine/nutrition";

import { AnimatedCounter } from "../components/AnimatedCounter";
import { FadeIn } from "../components/FadeIn";
import { InkSurface } from "../components/InkSurface";
import { Mascot } from "../components/Mascot";
import { PressableScale } from "../components/PressableScale";
import { foodEmoji } from "../foodEmoji";
import { tPlural, useLanguage } from "../i18n";
import type { SavedMeal } from "../savedMeals";
import { confidenceStyle, displayName } from "../search";
import { colors, elevation, fontWeights, gradients, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

export interface MealScreenProps {
  lines: MealLine[];
  onChangeAmount: (foodId: string, amountGrams: number) => void;
  onRemove: (foodId: string) => void;
  /** Opens the "Estimativa de dose" screen with this meal's confirmed carbohydrate total. */
  onEstimateDose: () => void;
  /** Count for the "Refeições guardadas" entry point badge — always reachable, even with an empty current meal. */
  savedMealsCount: number;
  /** The most recently saved meal, surfaced (highlighted) on an empty meal for one-tap reuse — or null if none exist yet. */
  latestSavedMeal: SavedMeal | null;
  /** Loads a saved meal into the current meal for editing ("Usar"). */
  onUseSavedMeal: (meal: SavedMeal) => void;
  /** Opens the "Refeições guardadas" screen (Slice: refeições repetidas). */
  onOpenSavedMeals: () => void;
  /** Saves the current meal (as-is) under a user-given name — always a NEW record. */
  onSaveMeal: (name: string) => void;
  /** Name of the saved meal the current meal is linked to (loaded via "Usar"),
   * or null. When set, the save area also offers "Atualizar «name»". */
  editingSavedMealName: string | null;
  /** Updates the linked saved meal in place (its items/total) from the current meal. */
  onUpdateSavedMeal: () => void;
  /** Count for the "Diário" entry point badge — always reachable, even with an empty current meal. */
  historyCount: number;
  /** Opens the "Diário" screen (meal HISTORY — a dated log of meals actually eaten). */
  onOpenHistory: () => void;
  /** Count for the "Receitas" entry point badge — always reachable, even with an empty current meal. */
  recipesCount: number;
  /** Opens the "Receitas" screen (recipe carb calculator — build a dish from ingredients, add portions to the meal). */
  onOpenRecipes: () => void;
  /** Logs the current meal (as-is), snapshotted under an optional user-given
   * name, as a NEW entry in the Diário — never overwrites an existing entry. */
  onLogMeal: (name?: string) => void;
  /** Display label of the Diário entry the current meal is linked to (loaded
   * via "Editar" in the Diário), or null. When set, the log area also offers
   * "Atualizar registo «label»". */
  editingHistoryEntryLabel: string | null;
  /** Corrects the linked Diário entry in place (its items/total) from the
   * current meal, preserving its original logged date/time. */
  onUpdateHistoryEntry: () => void;
}

const STEP_GRAMS = 5;
const MIN_GRAMS = 0;
const MAX_GRAMS = 5000;

function clamp(value: number): number {
  return Math.min(MAX_GRAMS, Math.max(MIN_GRAMS, value));
}

interface MealLineRowProps {
  line: MealLineSummary;
  onChangeAmount: (foodId: string, amountGrams: number) => void;
  onRemove: (foodId: string) => void;
}

function MealLineRow({ line, onChangeAmount, onRemove }: MealLineRowProps) {
  const { language, t } = useLanguage();
  const name = displayName(line.food, language);
  const lineStyle = confidenceStyle(line.confidence);
  // Local text buffer so the user can freely type/clear the field; it only
  // re-syncs from the authoritative amount (e.g. after a stepper tap) and
  // commits back on blur/submit rather than on every keystroke.
  const [text, setText] = useState(String(line.amount));

  useEffect(() => {
    setText(String(line.amount));
  }, [line.amount]);

  const commit = () => {
    const parsed = Number(text.replace(",", "."));
    if (Number.isFinite(parsed)) {
      onChangeAmount(line.food.id, clamp(parsed));
    } else {
      setText(String(line.amount));
    }
  };

  return (
    <View style={styles.line}>
      <View style={styles.lineHeader}>
        {/* Decorative food glyph — hidden from screen readers. */}
        <View style={styles.emojiTile} accessible={false} importantForAccessibility="no-hide-descendants">
          <Text style={styles.emoji}>{foodEmoji(line.food)}</Text>
        </View>
        <View style={styles.lineMain}>
          <Text style={styles.lineName}>{name}</Text>
          <Text style={styles.lineSub}>
            {line.carbGrams.toFixed(1)} {t("common.gramsUnit")} {t("meal.carbShort")} • {Math.round(line.energyKcal)} kcal
          </Text>
          <View
            style={[styles.miniBadge, { backgroundColor: lineStyle.bg }]}
            accessible
            accessibilityLabel={`${t("confidence.ariaPrefix")} ${t(lineStyle.labelKey)}`}
          >
            <Text style={[styles.miniBadgeText, { color: lineStyle.color }]}>
              {lineStyle.icon} {t(lineStyle.labelKey)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.lineControls}>
        <View style={styles.stepper}>
          <PressableScale
            onPress={() => onChangeAmount(line.food.id, clamp(line.amount - STEP_GRAMS))}
            accessibilityRole="button"
            accessibilityLabel={t("meal.decreaseLabel", { name })}
            style={styles.stepperButton}
            hitSlop={4}
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </PressableScale>

          <TextInput
            style={styles.amountInput}
            keyboardType="numeric"
            value={text}
            onChangeText={setText}
            onBlur={commit}
            onSubmitEditing={commit}
            accessibilityLabel={t("meal.amountInputLabel", { name })}
          />
          <Text style={styles.gramsUnit}>{t("common.gramsUnit")}</Text>

          <PressableScale
            onPress={() => onChangeAmount(line.food.id, clamp(line.amount + STEP_GRAMS))}
            accessibilityRole="button"
            accessibilityLabel={t("meal.increaseLabel", { name })}
            style={styles.stepperButton}
            hitSlop={4}
          >
            <Text style={styles.stepperButtonText}>+</Text>
          </PressableScale>
        </View>

        <PressableScale
          onPress={() => onRemove(line.food.id)}
          accessibilityRole="button"
          accessibilityLabel={t("meal.removeItemLabel", { name })}
          style={styles.removeButton}
        >
          <Text style={styles.removeButtonText}>{t("meal.remove")}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

// Entry point to "Refeições guardadas" (Slice: refeições repetidas) — kept
// visible regardless of whether the current meal has any items, since
// browsing/reusing a saved meal is often exactly how a meal gets its first
// item (mirrors FavouritesScreen's "As minhas contribuições" entry card).
interface SavedMealsEntryCardProps {
  count: number;
  onPress: () => void;
}

function SavedMealsEntryCard({ count, onPress }: SavedMealsEntryCardProps) {
  const { t } = useLanguage();
  const label = count > 0 ? `${t("meal.savedMealsOpenCta")} (${count})` : t("meal.savedMealsOpenCta");

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.savedMealsCard}>
      <View style={styles.savedMealsIconWrap}>
        <Text style={styles.savedMealsIcon}>⟲</Text>
      </View>
      <Text style={styles.savedMealsText}>
        {t("meal.savedMealsOpenCta")}
        {count > 0 ? ` (${count})` : ""}
      </Text>
      <Text style={styles.savedMealsChevron}>›</Text>
    </PressableScale>
  );
}

// Entry point to "Diário" (meal HISTORY — a dated log of meals actually
// eaten, distinct from "Refeições guardadas" above, which are reusable
// TEMPLATES with no date). Kept visible regardless of whether the current
// meal has any items, exactly like SavedMealsEntryCard, since browsing past
// entries is a normal thing to do independent of what's currently being
// built.
interface HistoryEntryCardProps {
  count: number;
  onPress: () => void;
}

function DiaryEntryCard({ count, onPress }: HistoryEntryCardProps) {
  const { t } = useLanguage();
  const label = count > 0 ? `${t("meal.historyOpenCta")} (${count})` : t("meal.historyOpenCta");

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.savedMealsCard}>
      <View style={styles.savedMealsIconWrap}>
        <Text style={styles.savedMealsIcon}>📖</Text>
      </View>
      <Text style={styles.savedMealsText}>
        {t("meal.historyOpenCta")}
        {count > 0 ? ` (${count})` : ""}
      </Text>
      <Text style={styles.savedMealsChevron}>›</Text>
    </PressableScale>
  );
}

// Entry point to "Receitas" (recipe carb calculator — Slice: Receitas). Same
// always-visible shape as SavedMealsEntryCard/DiaryEntryCard above: browsing
// or building a recipe is a normal thing to do independent of the current
// meal's contents, so this never hides behind "add a food first".
interface RecipesEntryCardProps {
  count: number;
  onPress: () => void;
}

function RecipesEntryCard({ count, onPress }: RecipesEntryCardProps) {
  const { t } = useLanguage();
  const label = count > 0 ? `${t("meal.recipesOpenCta")} (${count})` : t("meal.recipesOpenCta");

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.savedMealsCard}>
      <View style={styles.savedMealsIconWrap}>
        <Text style={styles.savedMealsIcon}>🍲</Text>
      </View>
      <Text style={styles.savedMealsText}>
        {t("meal.recipesOpenCta")}
        {count > 0 ? ` (${count})` : ""}
      </Text>
      <Text style={styles.savedMealsChevron}>›</Text>
    </PressableScale>
  );
}

// The most recent saved meal, surfaced right on an empty Meal screen so the
// common "repeat my usual meal" case is a single tap ("Usar") instead of
// drilling into the full list first. Only shown when the current meal is
// empty (so a one-tap load never silently replaces a meal in progress); the
// full list stays one tap away via the entry card below.
function LatestSavedMealCard({ meal, onUse }: { meal: SavedMeal; onUse: (meal: SavedMeal) => void }) {
  const { t } = useLanguage();
  return (
    <View style={styles.latestCard}>
      <View style={styles.latestHeader}>
        <View style={styles.latestTile} accessible={false} importantForAccessibility="no-hide-descendants">
          <Text style={styles.latestGlyph}>🍽</Text>
        </View>
        <View style={styles.latestMain}>
          <Text style={styles.latestKicker}>{t("meal.latestSavedMealKicker")}</Text>
          <Text style={styles.latestName} numberOfLines={1}>
            {meal.name}
          </Text>
          <Text style={styles.latestMeta}>
            {tPlural(t, "savedMeals.itemCount", meal.items.length)} • {meal.totalCarbGrams.toFixed(1)} {t("common.gramsUnit")} {t("meal.carbShort")}
          </Text>
        </View>
      </View>
      <PressableScale
        onPress={() => onUse(meal)}
        accessibilityRole="button"
        accessibilityLabel={`${t("savedMeals.useCta")}: ${meal.name}`}
        style={styles.latestUseButton}
      >
        <Text style={styles.latestUseButtonText}>{t("savedMeals.useCta")}</Text>
      </PressableScale>
    </View>
  );
}

interface SaveMealCardProps {
  /** Saves the current meal as a brand-new saved-meal record. */
  onSaveNew: (name: string) => void;
  /** Name of the linked saved meal (loaded via "Usar"), or null. When set,
   * "Atualizar «name»" is offered alongside "Guardar como nova". */
  editingSavedMealName: string | null;
  /** Updates that linked saved meal in place. */
  onUpdate: () => void;
}

// Save area — deliberately secondary/outline actions (never the brand-gradient
// CTA reserved for "Estimar dose") so they never compete with the primary
// food-to-dose flow. When the current meal was loaded from a saved meal via
// "Usar", it offers BOTH "Atualizar «name»" (update it in place) and "Guardar
// como nova"; otherwise just "Guardar refeição". Local-only UI state
// (editing/name/error/success) — the actual writes are delegated to the parent.
function SaveMealCard({ onSaveNew, editingSavedMealName, onUpdate }: SaveMealCardProps) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);

  const handleOpen = () => {
    setEditing(true);
    setJustSaved(false);
    setJustUpdated(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setName("");
    setError(null);
  };

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError(t("meal.saveMealNameError"));
      return;
    }
    onSaveNew(trimmed);
    setEditing(false);
    setName("");
    setError(null);
    setJustSaved(true);
  };

  const handleUpdate = () => {
    onUpdate();
    setJustUpdated(true);
    setJustSaved(false);
  };

  if (editing) {
    return (
      <FadeIn>
        <View style={styles.saveMealCard}>
          <Text style={styles.saveMealLabel}>{t("meal.saveMealNameLabel")}</Text>
          <TextInput
            style={styles.saveMealInput}
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (error) setError(null);
            }}
            placeholder={t("meal.saveMealNamePlaceholder")}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={t("meal.saveMealNameLabel")}
            autoFocus
          />
          {error && <Text style={styles.saveMealError}>{error}</Text>}
          <View style={styles.saveMealButtonRow}>
            <PressableScale
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel={t("meal.saveMealCancel")}
              style={styles.saveMealCancelButton}
            >
              <Text style={styles.saveMealCancelButtonText}>{t("meal.saveMealCancel")}</Text>
            </PressableScale>
            <PressableScale
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel={t("meal.saveMealConfirm")}
              style={styles.saveMealConfirmButton}
            >
              <Text style={styles.saveMealConfirmButtonText}>{t("meal.saveMealConfirm")}</Text>
            </PressableScale>
          </View>
        </View>
      </FadeIn>
    );
  }

  return (
    <View>
      {editingSavedMealName ? (
        <>
          <PressableScale
            onPress={handleUpdate}
            accessibilityRole="button"
            accessibilityLabel={t("meal.updateSavedMealCta", { name: editingSavedMealName })}
            style={styles.updateMealButton}
          >
            <Text style={styles.updateMealButtonText} numberOfLines={1}>
              {t("meal.updateSavedMealCta", { name: editingSavedMealName })}
            </Text>
          </PressableScale>
          <PressableScale
            onPress={handleOpen}
            accessibilityRole="button"
            accessibilityLabel={t("meal.saveAsNewCta")}
            style={styles.saveMealOpenButton}
          >
            <Text style={styles.saveMealOpenButtonText}>{t("meal.saveAsNewCta")}</Text>
          </PressableScale>
        </>
      ) : (
        <PressableScale
          onPress={handleOpen}
          accessibilityRole="button"
          accessibilityLabel={t("meal.saveMealCta")}
          style={styles.saveMealOpenButton}
        >
          <Text style={styles.saveMealOpenButtonText}>{t("meal.saveMealCta")}</Text>
        </PressableScale>
      )}
      {justUpdated && (
        <FadeIn>
          <View style={styles.saveMealSuccessBanner} accessible accessibilityLabel={t("meal.updateSavedMealSuccess")}>
            <Text style={styles.saveMealSuccessIcon}>✓</Text>
            <Text style={styles.saveMealSuccessText}>{t("meal.updateSavedMealSuccess")}</Text>
          </View>
        </FadeIn>
      )}
      {justSaved && (
        <FadeIn>
          <View style={styles.saveMealSuccessBanner} accessible accessibilityLabel={t("meal.saveMealSuccess")}>
            <Text style={styles.saveMealSuccessIcon}>✓</Text>
            <Text style={styles.saveMealSuccessText}>{t("meal.saveMealSuccess")}</Text>
          </View>
        </FadeIn>
      )}
    </View>
  );
}

interface LogMealCardProps {
  /** Logs the current meal as a brand-new Diário entry, under an optional name. */
  onLogNew: (name?: string) => void;
  /** Display label of the linked Diário entry (loaded via "Editar"), or null.
   * When set, "Atualizar registo «label»" is offered alongside "Registar como nova". */
  editingHistoryEntryLabel: string | null;
  /** Corrects that linked entry in place. */
  onUpdate: () => void;
}

// The "Registar no diário" area — deliberately secondary/outline actions
// (never the brand-gradient CTA reserved for "Estimar dose"), mirroring
// SaveMealCard's own visual weight right above it. The meal's optional NAME
// is the only thing that differs from SaveMealCard's flow (a saved meal's
// name is required; a logged meal's is optional — see ../mealHistory.ts).
// When the current meal was loaded from the Diário via "Editar", this offers
// BOTH "Atualizar registo «label»" (correct that entry in place, preserving
// its original logged date/time) and "Registar como nova" (log a brand-new,
// separate entry instead); otherwise just "Registar no diário". Local-only
// UI state (editing/name/success) — the actual writes are delegated to the
// parent, exactly like SaveMealCard.
function LogMealCard({ onLogNew, editingHistoryEntryLabel, onUpdate }: LogMealCardProps) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [justLogged, setJustLogged] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);

  const handleOpen = () => {
    setEditing(true);
    setJustLogged(false);
    setJustUpdated(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setName("");
  };

  const handleConfirm = () => {
    const trimmed = name.trim();
    onLogNew(trimmed.length > 0 ? trimmed : undefined);
    setEditing(false);
    setName("");
    setJustLogged(true);
  };

  const handleUpdate = () => {
    onUpdate();
    setJustUpdated(true);
    setJustLogged(false);
  };

  if (editing) {
    return (
      <FadeIn>
        <View style={styles.saveMealCard}>
          <Text style={styles.saveMealLabel}>{t("meal.logMealNameLabel")}</Text>
          <TextInput
            style={styles.saveMealInput}
            value={name}
            onChangeText={setName}
            placeholder={t("meal.logMealNamePlaceholder")}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={t("meal.logMealNameLabel")}
            autoFocus
          />
          <View style={styles.saveMealButtonRow}>
            <PressableScale
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel={t("meal.logMealCancel")}
              style={styles.saveMealCancelButton}
            >
              <Text style={styles.saveMealCancelButtonText}>{t("meal.logMealCancel")}</Text>
            </PressableScale>
            <PressableScale
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel={t("meal.logMealConfirm")}
              style={styles.saveMealConfirmButton}
            >
              <Text style={styles.saveMealConfirmButtonText}>{t("meal.logMealConfirm")}</Text>
            </PressableScale>
          </View>
        </View>
      </FadeIn>
    );
  }

  return (
    <View>
      {editingHistoryEntryLabel ? (
        <>
          <PressableScale
            onPress={handleUpdate}
            accessibilityRole="button"
            accessibilityLabel={t("meal.updateHistoryEntryCta", { name: editingHistoryEntryLabel })}
            style={styles.updateMealButton}
          >
            <Text style={styles.updateMealButtonText} numberOfLines={1}>
              {t("meal.updateHistoryEntryCta", { name: editingHistoryEntryLabel })}
            </Text>
          </PressableScale>
          <PressableScale
            onPress={handleOpen}
            accessibilityRole="button"
            accessibilityLabel={t("meal.logAsNewCta")}
            style={styles.saveMealOpenButton}
          >
            <Text style={styles.saveMealOpenButtonText}>{t("meal.logAsNewCta")}</Text>
          </PressableScale>
        </>
      ) : (
        <PressableScale
          onPress={handleOpen}
          accessibilityRole="button"
          accessibilityLabel={t("meal.logMealCta")}
          style={styles.saveMealOpenButton}
        >
          <Text style={styles.saveMealOpenButtonText}>{t("meal.logMealCta")}</Text>
        </PressableScale>
      )}
      {justUpdated && (
        <FadeIn>
          <View style={styles.saveMealSuccessBanner} accessible accessibilityLabel={t("meal.updateHistoryEntrySuccess")}>
            <Text style={styles.saveMealSuccessIcon}>✓</Text>
            <Text style={styles.saveMealSuccessText}>{t("meal.updateHistoryEntrySuccess")}</Text>
          </View>
        </FadeIn>
      )}
      {justLogged && (
        <FadeIn>
          <View style={styles.saveMealSuccessBanner} accessible accessibilityLabel={t("meal.logMealSuccess")}>
            <Text style={styles.saveMealSuccessIcon}>✓</Text>
            <Text style={styles.saveMealSuccessText}>{t("meal.logMealSuccess")}</Text>
          </View>
        </FadeIn>
      )}
    </View>
  );
}

export function MealScreen({
  lines,
  onChangeAmount,
  onRemove,
  onEstimateDose,
  savedMealsCount,
  latestSavedMeal,
  onUseSavedMeal,
  onOpenSavedMeals,
  onSaveMeal,
  editingSavedMealName,
  onUpdateSavedMeal,
  historyCount,
  onOpenHistory,
  onLogMeal,
  editingHistoryEntryLabel,
  onUpdateHistoryEntry,
  recipesCount,
  onOpenRecipes,
}: MealScreenProps) {
  const { t } = useLanguage();
  // Deterministic, framework-independent meal maths shared with the API —
  // no clinical authority, just food carbohydrate/energy totals.
  const summary = useMemo(() => summariseMeal(lines), [lines]);
  const aggregateStyle = confidenceStyle(summary.aggregateConfidence);

  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>{t("meal.title")}</Text>
      <Text style={styles.meta}>{tPlural(t, "meal.items", summary.itemCount)}</Text>

      {summary.itemCount === 0 && latestSavedMeal && <LatestSavedMealCard meal={latestSavedMeal} onUse={onUseSavedMeal} />}

      <SavedMealsEntryCard count={savedMealsCount} onPress={onOpenSavedMeals} />
      <DiaryEntryCard count={historyCount} onPress={onOpenHistory} />
      <RecipesEntryCard count={recipesCount} onPress={onOpenRecipes} />

      <FlatList
        data={summary.lines}
        keyExtractor={(line) => line.food.id}
        ListEmptyComponent={
          <FadeIn>
            <View style={styles.empty}>
              <Mascot size={84} />
              <Text style={styles.emptyTitle}>{t("meal.emptyTitle")}</Text>
              <Text style={styles.emptyBody}>{t("meal.emptyBody")}</Text>
            </View>
          </FadeIn>
        }
        renderItem={({ item }) => <MealLineRow line={item} onChangeAmount={onChangeAmount} onRemove={onRemove} />}
      />

      {summary.itemCount > 0 && (
        <InkSurface style={styles.totals} contentStyle={styles.totalsContent}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{t("meal.totalsCarb")}</Text>
            <AnimatedCounter value={summary.totalCarbGrams} decimals={1} style={styles.totalsValueHero} suffix={` ${t("common.gramsUnit")}`} />
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{t("meal.totalsEnergy")}</Text>
            <Text style={styles.totalsValue}>{summary.totalEnergyKcal} kcal</Text>
          </View>

          {summary.hasUncertainty && (
            <View
              style={[styles.uncertaintyBanner, { backgroundColor: aggregateStyle.bg }]}
              accessible
              accessibilityLabel={t("meal.uncertaintyBanner")}
            >
              <Text style={[styles.uncertaintyIcon, { color: aggregateStyle.color }]}>{aggregateStyle.icon}</Text>
              <Text style={styles.uncertaintyText}>{t("meal.uncertaintyBanner")}</Text>
            </View>
          )}
        </InkSurface>
      )}

      {summary.itemCount > 0 && (
        <SaveMealCard onSaveNew={onSaveMeal} editingSavedMealName={editingSavedMealName} onUpdate={onUpdateSavedMeal} />
      )}

      {summary.itemCount > 0 && (
        <LogMealCard onLogNew={onLogMeal} editingHistoryEntryLabel={editingHistoryEntryLabel} onUpdate={onUpdateHistoryEntry} />
      )}

      <PressableScale
        onPress={onEstimateDose}
        disabled={summary.itemCount === 0}
        accessibilityRole="button"
        accessibilityLabel={t("meal.estimateDoseCta")}
        accessibilityState={{ disabled: summary.itemCount === 0 }}
        style={summary.itemCount === 0 ? styles.estimateDoseButtonDisabled : styles.estimateDoseButtonWrap}
      >
        {summary.itemCount === 0 ? (
          <Text style={[styles.estimateDoseButtonText, styles.estimateDoseButtonTextDisabled]}>{t("meal.estimateDoseCta")}</Text>
        ) : (
          <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.estimateDoseButtonGradient}>
            <Text style={styles.estimateDoseButtonText}>{t("meal.estimateDoseCta")}</Text>
          </LinearGradient>
        )}
      </PressableScale>
      {summary.itemCount === 0 && <Text style={styles.estimateDoseDisabledHint}>{t("meal.estimateDoseDisabledHint")}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  h1: { fontSize: typeScale.heading.size, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: 10 },
  empty: { padding: spacing.xxl, alignItems: "center" },
  emptyTitle: { fontSize: typeScale.heading.size, fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing.md },
  emptyBody: { fontSize: 14, color: colors.textMuted, marginTop: 4, textAlign: "center" },
  line: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginVertical: 6,
    ...elevation.sm.native,
  },
  lineHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  emojiTile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  emoji: { fontSize: 20 },
  lineMain: { flex: 1 },
  lineName: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  lineSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  miniBadge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, marginTop: spacing.xs },
  miniBadgeText: { fontSize: 11, fontWeight: "700" },
  lineControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  stepperButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTint,
    borderRadius: radius.sm,
  },
  stepperButtonText: { fontSize: 20, fontWeight: "700", color: colors.brandDark },
  amountInput: {
    minWidth: 56,
    minHeight: MIN_TAP_TARGET,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    textAlign: "center",
    fontSize: 16,
    color: colors.textPrimary,
    paddingHorizontal: spacing.xs,
  },
  gramsUnit: { fontSize: 13, color: colors.textMuted },
  removeButton: {
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  removeButtonText: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  totals: { marginTop: spacing.sm, marginBottom: spacing.md },
  totalsContent: { padding: spacing.md },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  totalsLabel: { fontSize: 14, color: "rgba(255,255,255,0.72)" },
  totalsValue: { fontSize: 16, fontWeight: "800", color: colors.onBrand },
  totalsValueHero: { fontSize: 22, fontWeight: "800", color: colors.focusRing, fontVariant: ["tabular-nums"] },
  uncertaintyBanner: { flexDirection: "row", gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm, alignItems: "flex-start" },
  uncertaintyIcon: { fontSize: 16, fontWeight: "700" },
  uncertaintyText: { flex: 1, fontSize: 13, color: colors.textSecondary },
  estimateDoseButtonWrap: { borderRadius: radius.pill, marginBottom: spacing.xs, ...elevation.glow.native },
  estimateDoseButtonGradient: { minHeight: MIN_TAP_TARGET, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  estimateDoseButtonDisabled: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  estimateDoseButtonText: { color: colors.onBrand, fontSize: 16, fontWeight: "700" },
  estimateDoseButtonTextDisabled: { color: colors.textFaint },
  estimateDoseDisabledHint: { fontSize: 12.5, color: colors.textMuted, textAlign: "center", marginBottom: spacing.md },

  // Highlighted "most recent saved meal" card — a subtle brand accent + a
  // slightly stronger elevation so it reads as the featured shortcut.
  latestCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.md.native,
  },
  latestHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  latestTile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  latestGlyph: { fontSize: 22 },
  latestMain: { flex: 1 },
  latestKicker: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.brandDark,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
  },
  latestName: { fontSize: 17, fontWeight: "800", color: colors.textPrimary, marginTop: 2 },
  latestMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  latestUseButton: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    ...elevation.sm.native,
  },
  latestUseButtonText: { color: colors.onBrand, fontSize: 15, fontWeight: "800" },
  savedMealsCard: {
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
  savedMealsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  savedMealsIcon: { fontSize: 16, color: colors.brandDark },
  savedMealsText: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  savedMealsChevron: { fontSize: 20, color: colors.textFaint },

  saveMealOpenButton: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    marginBottom: spacing.sm,
  },
  saveMealOpenButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  // The "update this saved meal" action — brand-tinted so it reads as the
  // primary of the two save options, without borrowing the big gradient CTA
  // reserved for "Estimar dose".
  updateMealButton: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  updateMealButtonText: { color: colors.brandDark, fontSize: 15, fontWeight: "700" },
  saveMealCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.sm.native,
  },
  saveMealLabel: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
  },
  saveMealInput: {
    minHeight: MIN_TAP_TARGET,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  saveMealError: { color: colors.danger, fontSize: 13, marginTop: 4 },
  saveMealButtonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  saveMealCancelButton: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  saveMealCancelButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  saveMealConfirmButton: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    ...elevation.sm.native,
  },
  saveMealConfirmButtonText: { color: colors.onBrand, fontSize: 15, fontWeight: "700" },
  saveMealSuccessBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.confidenceHighBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: "flex-start",
  },
  saveMealSuccessIcon: { color: colors.confidenceHigh, fontSize: 16, fontWeight: "700" },
  saveMealSuccessText: { flex: 1, fontSize: 14, color: colors.textSecondary, fontWeight: "600" },
});
