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
  /** Switches to the Procurar (search) tab so the user can quickly add more
   * foods to the current meal — the primary action of this screen. Kept
   * front-and-centre so "build my meal" never means hunting for a way back to
   * search. */
  onAddFoods: () => void;
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

// The primary action of this screen: jump back to Procurar to add more foods.
// A solid brand button so "add more" is unmistakable and one tap away, whether
// the meal is empty or already has items — this is what the screen is FOR.
function AddFoodsButton({ onPress }: { onPress: () => void }) {
  const { t } = useLanguage();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("meal.addFoods")}
      style={styles.addFoodsButton}
    >
      <View style={styles.addFoodsPlus} accessible={false} importantForAccessibility="no-hide-descendants">
        <Text style={styles.addFoodsPlusText}>＋</Text>
      </View>
      <Text style={styles.addFoodsText}>{t("meal.addFoods")}</Text>
    </PressableScale>
  );
}

// Compact secondary navigation chip, grouped three-across under the "Mais"
// heading at the very bottom of the screen. Deliberately quiet (muted surface,
// small) so it never competes with the food list or the add-foods action —
// these are places you occasionally go, not the meal you're building now.
interface MoreChipProps {
  icon: string;
  label: string;
  count: number;
  onPress: () => void;
}

function MoreChip({ icon, label, count, onPress }: MoreChipProps) {
  const accessibilityLabel = count > 0 ? `${label} (${count})` : label;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={styles.moreChip}>
      <View style={styles.moreChipIconWrap} accessible={false} importantForAccessibility="no-hide-descendants">
        <Text style={styles.moreChipIcon}>{icon}</Text>
        {count > 0 && (
          <View style={styles.moreChipCount}>
            <Text style={styles.moreChipCountText}>{count}</Text>
          </View>
        )}
      </View>
      <Text style={styles.moreChipLabel} numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );
}

// The most recent saved meal, surfaced right on an empty Meal screen so the
// common "repeat my usual meal" case is a single tap ("Usar") instead of
// drilling into the full list first. Only shown when the current meal is
// empty (so a one-tap load never silently replaces a meal in progress); the
// full list stays one tap away via the "Mais" row below.
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
  onAddFoods,
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
  const hasItems = summary.itemCount > 0;

  // The whole screen scrolls as ONE list: the foods are the spine (the focus),
  // with the title + quick "add foods" action pinned above them as the list
  // header, and the totals / save-log / secondary navigation below as the
  // footer. This keeps the foods immediately visible instead of buried under
  // navigation cards, and avoids nesting a scroll view inside a scroll view.
  const header = (
    <View>
      <Text style={styles.h1}>{t("meal.title")}</Text>
      <Text style={styles.meta}>{tPlural(t, "meal.items", summary.itemCount)}</Text>

      <AddFoodsButton onPress={onAddFoods} />

      {!hasItems && latestSavedMeal && <LatestSavedMealCard meal={latestSavedMeal} onUse={onUseSavedMeal} />}

      {hasItems && <Text style={styles.sectionLabel}>{t("meal.inThisMeal")}</Text>}
    </View>
  );

  const footer = (
    <View>
      {hasItems && (
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

      {hasItems && (
        <PressableScale
          onPress={onEstimateDose}
          accessibilityRole="button"
          accessibilityLabel={t("meal.estimateDoseCta")}
          style={styles.estimateDoseButtonWrap}
        >
          <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.estimateDoseButtonGradient}>
            <Text style={styles.estimateDoseButtonText}>{t("meal.estimateDoseCta")}</Text>
          </LinearGradient>
        </PressableScale>
      )}

      {hasItems && <SaveMealCard onSaveNew={onSaveMeal} editingSavedMealName={editingSavedMealName} onUpdate={onUpdateSavedMeal} />}

      {hasItems && <LogMealCard onLogNew={onLogMeal} editingHistoryEntryLabel={editingHistoryEntryLabel} onUpdate={onUpdateHistoryEntry} />}

      {/* Secondary navigation, demoted to the bottom and compacted so the food
          list stays the focus. Always reachable, even with an empty meal —
          browsing a saved meal/recipe is often how a meal gets its first item. */}
      <Text style={[styles.sectionLabel, styles.moreLabel]}>{t("meal.moreSection")}</Text>
      <View style={styles.moreRow}>
        <MoreChip icon="⟲" label={t("meal.savedMealsOpenCta")} count={savedMealsCount} onPress={onOpenSavedMeals} />
        <MoreChip icon="📖" label={t("meal.historyOpenCta")} count={historyCount} onPress={onOpenHistory} />
        <MoreChip icon="🍲" label={t("meal.recipesOpenCta")} count={recipesCount} onPress={onOpenRecipes} />
      </View>
    </View>
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.listContent}
      data={summary.lines}
      keyExtractor={(line) => line.food.id}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  h1: { fontSize: typeScale.heading.size, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  sectionLabel: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  empty: { padding: spacing.xxl, alignItems: "center" },
  emptyTitle: { fontSize: typeScale.heading.size, fontWeight: fontWeights.bold, color: colors.textPrimary, marginTop: spacing.md },
  emptyBody: { fontSize: 14, color: colors.textMuted, marginTop: 4, textAlign: "center" },

  // Primary action — a solid brand button so "add more foods" is the loudest,
  // clearest thing on the screen after the foods themselves.
  addFoodsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: MIN_TAP_TARGET + 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    marginBottom: spacing.md,
    ...elevation.sm.native,
  },
  addFoodsPlus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  addFoodsPlusText: { color: colors.onBrand, fontSize: 18, fontWeight: "800", lineHeight: 20 },
  addFoodsText: { color: colors.onBrand, fontSize: 16, fontWeight: "800" },

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
  lineControls: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  // flex:1 so the stepper takes exactly the space left after the (fixed-width)
  // Remove button — the amount field then fills the middle instead of
  // stretching to a browser-default width and shoving "Remover" off-screen on
  // narrow phones.
  stepper: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.xs },
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
    flex: 1,
    minWidth: 48,
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
    flexShrink: 0,
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  removeButtonText: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  totals: { marginTop: spacing.md, marginBottom: spacing.md },
  totalsContent: { padding: spacing.md },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  totalsLabel: { fontSize: 14, color: "rgba(255,255,255,0.72)" },
  totalsValue: { fontSize: 16, fontWeight: "800", color: colors.onBrand },
  totalsValueHero: { fontSize: 22, fontWeight: "800", color: colors.focusRing, fontVariant: ["tabular-nums"] },
  uncertaintyBanner: { flexDirection: "row", gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm, alignItems: "flex-start" },
  uncertaintyIcon: { fontSize: 16, fontWeight: "700" },
  uncertaintyText: { flex: 1, fontSize: 13, color: colors.textSecondary },
  estimateDoseButtonWrap: { borderRadius: radius.pill, marginBottom: spacing.sm, ...elevation.glow.native },
  estimateDoseButtonGradient: { minHeight: MIN_TAP_TARGET, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  estimateDoseButtonText: { color: colors.onBrand, fontSize: 16, fontWeight: "700" },

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

  // Compact secondary-navigation row ("Mais"), three chips across.
  moreLabel: { marginTop: spacing.lg },
  moreRow: { flexDirection: "row", gap: spacing.sm },
  moreChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: spacing.xs,
    minHeight: 78,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...elevation.sm.native,
  },
  moreChipIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  moreChipIcon: { fontSize: 16, color: colors.brandDark },
  moreChipCount: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  moreChipCountText: { color: colors.onBrand, fontSize: 11, fontWeight: "800" },
  moreChipLabel: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, textAlign: "center" },

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
