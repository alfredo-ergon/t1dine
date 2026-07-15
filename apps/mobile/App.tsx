import { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { CanonicalFood } from "@t1dine/food-schema";
import type { MealLine } from "@t1dine/nutrition";
import { summariseMeal } from "@t1dine/nutrition";

import { fetchCatalog } from "./src/api";
import { Header } from "./src/components/Header";
import { Splash } from "./src/components/Splash";
import { TabBar, type TabKey } from "./src/components/TabBar";
import { CATALOG } from "./src/catalog";
import { buildCustomFood, type CustomFoodInput } from "./src/customFood";
import { DEFAULT_DOSE_PROFILE, type DoseProfile } from "./src/dose/profile";
import { bumpProfileVersion, loadDoseProfile, saveDoseProfile } from "./src/dose/profileStorage";
import { LanguageProvider, useLanguage } from "./src/i18n";
import { searchFoods } from "./src/search";
import { CreateFoodScreen } from "./src/screens/CreateFoodScreen";
import { DetailScreen } from "./src/screens/DetailScreen";
import { DoseReviewScreen } from "./src/screens/DoseReviewScreen";
import { FavouritesScreen } from "./src/screens/FavouritesScreen";
import { GlucoseScreen } from "./src/screens/GlucoseScreen";
import { MealScreen } from "./src/screens/MealScreen";
import { ProfileScreen, type DoseProfileFormValues } from "./src/screens/ProfileScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { loadCustomFoods, loadFavouriteIds, loadRecentIds, RECENTS_LIMIT, saveCustomFoods, saveFavouriteIds, saveRecentIds } from "./src/storage";
import { colors, spacing } from "./src/theme";

// Detail, Create-Food, Profile, and the Dose Assist "Estimativa de dose"
// review are stacked overlays reachable from any tab; Search, Meal,
// Favourites, and Glucose are the peer sections underneath them. This
// mirrors a simple push-navigation stack without pulling in a navigation
// library — Pressable + state, as the existing app already does.
type Overlay = { kind: "detail"; food: CanonicalFood } | { kind: "create" } | { kind: "profile" } | { kind: "doseReview" } | null;

function AppShell() {
  const { isLoaded: languageLoaded, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<TabKey>("search");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [query, setQuery] = useState("");

  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [customFoods, setCustomFoods] = useState<CanonicalFood[]>([]);
  const [meal, setMeal] = useState<MealLine[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Dose Assist clinical profile (Rácio/Fator/Alvo/Incremento/Dose
  // máxima/Limiar) — a separate, deliberately non-food AsyncStorage key
  // (src/dose/profileStorage.ts). `hasSavedDoseProfile` is false until the
  // user has explicitly saved it once, which drives the first-run nudge in
  // the Perfil screen's "Perfil clínico" section.
  const [doseProfile, setDoseProfile] = useState<DoseProfile>(DEFAULT_DOSE_PROFILE);
  const [hasSavedDoseProfile, setHasSavedDoseProfile] = useState(false);

  // Online catalog with offline-first fallback (Slice: API client). The
  // bundled local CATALOG is always the guaranteed baseline — it never waits
  // on this fetch — and a successful API response is only ever swapped in as
  // an enhancement. `remoteFoods === null` means "no online catalog yet /
  // unavailable", never "empty catalog".
  const [remoteFoods, setRemoteFoods] = useState<CanonicalFood[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const refreshCatalog = useCallback(() => {
    setCatalogLoading(true);
    fetchCatalog()
      .then((foods) => setRemoteFoods(foods))
      .catch(() => setRemoteFoods(null))
      .finally(() => setCatalogLoading(false));
  }, []);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  // Load everything once at startup. Until this resolves we must not write
  // back to storage — otherwise an empty initial state would clobber what
  // was persisted from a previous session (see the `dataLoaded` guards below).
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadFavouriteIds(), loadRecentIds(), loadCustomFoods(), loadDoseProfile()])
      .then(([loadedFavourites, loadedRecents, loadedCustomFoods, loadedDoseProfile]) => {
        if (cancelled) return;
        setFavouriteIds(loadedFavourites);
        setRecentIds(loadedRecents);
        setCustomFoods(loadedCustomFoods);
        setDoseProfile(loadedDoseProfile.profile);
        setHasSavedDoseProfile(loadedDoseProfile.hasSavedProfile);
      })
      .finally(() => {
        if (!cancelled) setDataLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dataLoaded) return;
    void saveFavouriteIds(favouriteIds);
  }, [favouriteIds, dataLoaded]);

  useEffect(() => {
    if (!dataLoaded) return;
    void saveRecentIds(recentIds);
  }, [recentIds, dataLoaded]);

  useEffect(() => {
    if (!dataLoaded) return;
    void saveCustomFoods(customFoods);
  }, [customFoods, dataLoaded]);

  const baseCatalog = remoteFoods ?? CATALOG;
  const catalogSource: "online" | "offline" = remoteFoods !== null ? "online" : "offline";
  const allFoods = useMemo(() => [...baseCatalog, ...customFoods], [baseCatalog, customFoods]);
  const favouriteIdSet = useMemo(() => new Set(favouriteIds), [favouriteIds]);
  const results = useMemo(() => searchFoods(query, allFoods), [query, allFoods]);
  // Single source of truth for meal totals — same summariseMeal() used here
  // for the quick-glance search bar and in MealScreen for the full breakdown.
  const mealSummary = useMemo(() => summariseMeal(meal), [meal]);

  function resolveFoods(ids: string[]): CanonicalFood[] {
    return ids
      .map((id) => allFoods.find((food) => food.id === id))
      .filter((food): food is CanonicalFood => food !== undefined);
  }

  const favouriteFoods = useMemo(() => resolveFoods(favouriteIds), [favouriteIds, allFoods]);
  const recentFoods = useMemo(() => resolveFoods(recentIds), [recentIds, allFoods]);

  const recordRecent = useCallback((foodId: string) => {
    setRecentIds((ids) => [foodId, ...ids.filter((id) => id !== foodId)].slice(0, RECENTS_LIMIT));
  }, []);

  const handleSelectFood = useCallback(
    (food: CanonicalFood) => {
      recordRecent(food.id);
      setOverlay({ kind: "detail", food });
    },
    [recordRecent],
  );

  const handleToggleFavourite = useCallback((food: CanonicalFood) => {
    setFavouriteIds((ids) => (ids.includes(food.id) ? ids.filter((id) => id !== food.id) : [food.id, ...ids]));
  }, []);

  const handleAddToMeal = useCallback((food: CanonicalFood) => {
    setMeal((lines) => {
      const existingIndex = lines.findIndex((line) => line.food.id === food.id);
      if (existingIndex >= 0) {
        const updated = [...lines];
        updated[existingIndex] = { ...updated[existingIndex], amount: updated[existingIndex].amount + 100 };
        return updated;
      }
      return [...lines, { food, amount: 100 }];
    });
    setOverlay(null);
    setActiveTab("meal");
  }, []);

  const handleChangeAmount = useCallback((foodId: string, amount: number) => {
    setMeal((lines) => lines.map((line) => (line.food.id === foodId ? { ...line, amount } : line)));
  }, []);

  const handleRemoveFromMeal = useCallback((foodId: string) => {
    setMeal((lines) => lines.filter((line) => line.food.id !== foodId));
  }, []);

  const handleCreateFood = useCallback(
    (input: CustomFoodInput) => {
      try {
        const food = buildCustomFood(input);
        setCustomFoods((foods) => [...foods, food]);
        recordRecent(food.id);
        setOverlay({ kind: "detail", food });
      } catch {
        // Boundary validation (assertCanonicalFood) failed unexpectedly —
        // keep the form open rather than silently discarding user input.
      }
    },
    [recordRecent],
  );

  // Slice 5 — local data rights: "Apagar todos os meus dados". Resets every
  // piece of locally persisted state (favourites, recents, custom foods) via
  // the same storage helpers used to save them, and clears the in-memory
  // meal (which has no separate persistence key of its own).
  const handleDeleteAllData = useCallback(() => {
    setFavouriteIds([]);
    setRecentIds([]);
    setCustomFoods([]);
    setMeal([]);
    void saveFavouriteIds([]);
    void saveRecentIds([]);
    void saveCustomFoods([]);
  }, []);

  // "Perfil clínico" save: merges the validated form values into the current
  // profile, bumps `version` (so the calculation's audit record reflects
  // this exact change — clinical-safety rule), and persists under its own
  // AsyncStorage key. This is the ONLY place a DoseProfile is written.
  const handleSaveDoseProfile = useCallback((updates: DoseProfileFormValues) => {
    setDoseProfile((current) => {
      const next: DoseProfile = { ...current, ...updates, version: bumpProfileVersion(current.version) };
      void saveDoseProfile(next);
      return next;
    });
    setHasSavedDoseProfile(true);
  }, []);

  if (!languageLoaded || !dataLoaded) {
    return <Splash />;
  }

  const showBack = overlay !== null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <Header
        showBack={showBack}
        onBack={() => setOverlay(null)}
        onCreateFood={() => setOverlay({ kind: "create" })}
        onOpenProfile={() => setOverlay({ kind: "profile" })}
      />

      {overlay?.kind === "detail" && (
        <DetailScreen
          food={overlay.food}
          isFavourite={favouriteIdSet.has(overlay.food.id)}
          onToggleFavourite={handleToggleFavourite}
          onAdd={handleAddToMeal}
        />
      )}

      {overlay?.kind === "create" && <CreateFoodScreen onCancel={() => setOverlay(null)} onSubmit={handleCreateFood} />}

      {overlay?.kind === "profile" && (
        <ProfileScreen
          language={language}
          favouriteIds={favouriteIds}
          recentIds={recentIds}
          customFoods={customFoods}
          meal={meal}
          onDeleteAll={handleDeleteAllData}
          doseProfile={doseProfile}
          hasSavedDoseProfile={hasSavedDoseProfile}
          onSaveDoseProfile={handleSaveDoseProfile}
        />
      )}

      {overlay?.kind === "doseReview" && <DoseReviewScreen totalCarbGrams={mealSummary.totalCarbGrams} profile={doseProfile} />}

      {overlay === null && (
        <>
          <View style={styles.tabBarWrap}>
            <TabBar active={activeTab} onChange={setActiveTab} mealItemCount={mealSummary.itemCount} />
          </View>

          {activeTab === "search" && (
            <SearchScreen
              query={query}
              onChangeQuery={setQuery}
              results={results}
              favouriteIds={favouriteIdSet}
              onSelectFood={handleSelectFood}
              onToggleFavourite={handleToggleFavourite}
              onCreateFood={() => setOverlay({ kind: "create" })}
              mealItemCount={mealSummary.itemCount}
              mealCarbGrams={mealSummary.totalCarbGrams}
              catalogSource={catalogSource}
              catalogLoading={catalogLoading}
              onRefreshCatalog={refreshCatalog}
            />
          )}

          {activeTab === "meal" && (
            <MealScreen
              lines={meal}
              onChangeAmount={handleChangeAmount}
              onRemove={handleRemoveFromMeal}
              onEstimateDose={() => setOverlay({ kind: "doseReview" })}
            />
          )}

          {activeTab === "favourites" && (
            <FavouritesScreen
              favourites={favouriteFoods}
              recents={recentFoods}
              favouriteIds={favouriteIdSet}
              onSelectFood={handleSelectFood}
              onToggleFavourite={handleToggleFavourite}
            />
          )}

          {activeTab === "glucose" && <GlucoseScreen />}
        </>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppShell />
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  tabBarWrap: { paddingHorizontal: spacing.xl },
});
