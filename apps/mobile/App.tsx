import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { CanonicalFood, ContinentGroup } from "@t1dine/food-schema";
import { AREA_TAXONOMY } from "@t1dine/food-schema";
import type { MealLine } from "@t1dine/nutrition";
import { summariseMeal } from "@t1dine/nutrition";

import { fetchCatalog, getSyncState, isConnectivityError, login, putSyncState, register, type SyncState } from "./src/api";
import { availableCuisineTags, filterByArea } from "./src/areaFilter";
import { clearSession, loadSession, saveSession, type StoredSession } from "./src/auth";
import { AuroraBackground } from "./src/components/AuroraBackground";
import { Header } from "./src/components/Header";
import { Splash } from "./src/components/Splash";
import { TabBar, type TabKey } from "./src/components/TabBar";
import { CATALOG } from "./src/catalog";
import { buildCustomFood, type CustomFoodInput } from "./src/customFood";
import { DEFAULT_DOSE_PROFILE, type DoseProfile } from "./src/dose/profile";
import { bumpProfileVersion, clearProfileData as clearDoseProfileData, loadDoseProfile, saveDoseProfile } from "./src/dose/profileStorage";
import { LanguageProvider, useLanguage } from "./src/i18n";
import { clearProfileData as clearNightscoutProfileData } from "./src/nightscoutStore";
import {
  addProfile,
  DEFAULT_PROFILE_ID,
  deleteProfile,
  loadProfiles,
  renameProfile,
  resetToDefaultProfile,
  setActiveProfile,
  type Profile,
  type ProfileKind,
} from "./src/profiles";
import { carbPer100g, displayName, searchFoods } from "./src/search";
import { AccountScreen } from "./src/screens/AccountScreen";
import { BarcodeScanScreen } from "./src/screens/BarcodeScanScreen";
import { CreateFoodScreen } from "./src/screens/CreateFoodScreen";
import { DetailScreen } from "./src/screens/DetailScreen";
import { DoseReviewScreen } from "./src/screens/DoseReviewScreen";
import { FavouritesScreen } from "./src/screens/FavouritesScreen";
import { GlucoseScreen } from "./src/screens/GlucoseScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { MealScreen } from "./src/screens/MealScreen";
import { ProfileScreen, type DoseProfileFormValues } from "./src/screens/ProfileScreen";
import { ProfilesScreen } from "./src/screens/ProfilesScreen";
import { RecipesScreen } from "./src/screens/RecipesScreen";
import { SavedMealsScreen } from "./src/screens/SavedMealsScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { SubmissionsScreen } from "./src/screens/SubmissionsScreen";
import {
  buildHistoryEntryFromLines,
  clearProfileData as clearHistoryProfileData,
  deleteHistoryEntry,
  historyEntryLabel,
  loadHistory,
  logMeal,
  resolveHistoryEntryToLines,
  updateHistoryEntry,
  type HistoryEntry,
} from "./src/mealHistory";
import {
  buildRecipe,
  clearProfileData as clearRecipesProfileData,
  deleteRecipe,
  loadRecipes,
  recipeToMealLine,
  saveRecipe,
  type Recipe,
  type RecipeInput,
} from "./src/recipes";
import {
  buildSavedMealFromLines,
  clearProfileData as clearSavedMealsProfileData,
  loadSavedMeals,
  resolveSavedMealToLines,
  saveSavedMeals,
  type SavedMeal,
} from "./src/savedMeals";
import {
  clearProfileData as clearStorageProfileData,
  DEFAULT_STARTUP_TAB,
  loadCustomFoods,
  loadFavouriteIds,
  loadRecentIds,
  loadStartupTab,
  RECENTS_LIMIT,
  saveCustomFoods,
  saveFavouriteIds,
  saveRecentIds,
  saveStartupTab,
} from "./src/storage";
import { clearProfileData as clearSubmissionsProfileData } from "./src/submissions";
import { mergeSyncState, type SyncStatus } from "./src/sync";
import { colors, gradients, spacing } from "./src/theme";

// Detail, Create-Food, Profile, Account, "As minhas contribuições", and the
// Dose Assist "Estimativa de dose" review are stacked overlays reachable
// from any tab; Search, Meal, Favourites, and Glucose are the peer sections
// underneath them. This mirrors a simple push-navigation stack without
// pulling in a navigation library — Pressable + state, as the existing app
// already does.
type Overlay =
  | { kind: "detail"; food: CanonicalFood }
  | {
      kind: "create";
      barcode?: string;
      /** Set only via the barcode scanner's Open Food Facts (OFF) fallback
       * ("Guardar como o meu alimento") — pre-fills this candidate's name and
       * carbohydrate as normal, fully EDITABLE starting values (never
       * read-only, unlike `barcode`), since OFF data is never trusted as-is.
       * Absent for every other route into "create". */
      prefillNamePt?: string;
      prefillCarbPer100g?: number;
    }
  | { kind: "profile" }
  | { kind: "profiles" }
  | { kind: "account" }
  | { kind: "doseReview" }
  | { kind: "submissions" }
  | { kind: "savedMeals" }
  | { kind: "history" }
  | { kind: "recipes" }
  | { kind: "barcodeScan" }
  | null;

function AppShell() {
  const { isLoaded: languageLoaded, language, t } = useLanguage();

  // Slice: caregiver profiles ("Perfis") — one device, several LOCAL
  // profiles (the caregiver's own "self" profile + any dependents they
  // manage), each with its OWN local data (see ./src/profiles.ts, and every
  // store it namespaces). `activeProfileId` mirrors ./src/profiles.ts's
  // synchronous `getActiveProfileId()` cache, which every OTHER per-profile
  // store reads internally — this state exists purely for the UI (the
  // Header chip + ProfilesScreen) to know what to render; it is never read
  // by any store itself.
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string>(DEFAULT_PROFILE_ID);

  const [activeTab, setActiveTab] = useState<TabKey>(DEFAULT_STARTUP_TAB);
  // User-configurable landing tab (Perfil → "Página inicial"). Persisted
  // device-locally; applied as the initial `activeTab` on startup.
  const [startupTab, setStartupTab] = useState<TabKey>(DEFAULT_STARTUP_TAB);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [query, setQuery] = useState("");

  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [customFoods, setCustomFoods] = useState<CanonicalFood[]>([]);
  const [meal, setMeal] = useState<MealLine[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // "Refeições guardadas" (Slice: refeições repetidas) — a local-first,
  // user-curated list (like favourites/customFoods above), not an
  // append-only log like ../src/submissions.ts, so it's persisted the same
  // way: in-memory state here, written back to AsyncStorage by the
  // `dataLoaded`-guarded effect below.
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);

  // When the current meal was loaded from a saved meal via "Usar", this holds
  // that saved meal's id so the Meal screen can offer "Atualizar" (update it
  // in place) alongside "Guardar como nova". Null when the current meal was
  // built from scratch or cloned ("Clonar e ajustar"), so those only ever
  // save a brand-new record — keeping the saved original untouched.
  const [activeSavedMealId, setActiveSavedMealId] = useState<string | null>(null);

  // "Diário" (meal HISTORY — a dated log of meals actually eaten), distinct
  // from `savedMeals` above (reusable, undated TEMPLATES). Same local-first
  // ownership shape as `savedMeals`: App.tsx holds the in-memory list (loaded
  // once at startup below), but — unlike savedMeals' single "overwrite the
  // whole array" persistence effect — every mutation here goes through
  // ../src/mealHistory.ts's own read-current-then-write functions (logMeal/
  // updateHistoryEntry/deleteHistoryEntry/clearHistory), which read the
  // on-device list fresh before writing rather than trusting this in-memory
  // mirror, and return the resulting list to sync it back.
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // When the current meal was loaded from a Diário entry via "Editar", this
  // holds that entry's id so the Meal screen can offer "Atualizar registo"
  // (correct it in place, preserving its original logged date/time)
  // alongside "Registar como nova". Null when the current meal was built
  // from scratch, freshly logged, or loaded via "Reutilizar" (which
  // deliberately never links back — see loadHistoryEntryIntoCurrent).
  const [editingHistoryEntryId, setEditingHistoryEntryId] = useState<string | null>(null);

  // "Receitas" (recipe carb calculator — Slice: Receitas) — a local-first,
  // user-curated list, same ownership shape as `history` above: App.tsx holds
  // the in-memory list (loaded once at startup below), but every mutation
  // goes through ../src/recipes.ts's own read-current-then-write functions
  // (saveRecipe/deleteRecipe/clearRecipes), which read the on-device list
  // fresh before writing rather than trusting this in-memory mirror, and
  // return the resulting list to sync it back. No separate "whole-array
  // overwrite" persistence effect is needed (unlike `savedMeals` below).
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  // Dose Assist clinical profile (Rácio/Fator/Alvo/Incremento/Dose
  // máxima/Limiar) — a separate, deliberately non-food AsyncStorage key
  // (src/dose/profileStorage.ts). `hasSavedDoseProfile` is false until the
  // user has explicitly saved it once, which drives the first-run nudge in
  // the Perfil screen's "Perfil clínico" section.
  const [doseProfile, setDoseProfile] = useState<DoseProfile>(DEFAULT_DOSE_PROFILE);
  const [hasSavedDoseProfile, setHasSavedDoseProfile] = useState(false);

  // Browse-by-area filters (Slice: browse by area + cuisine) — independent
  // axes, both optional, applied to the CATALOG only (never to a user's own
  // custom foods — see areaFilter.ts).
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);

  // Accounts + multi-device sync (Slice: accounts + multi-device sync).
  // `session` is `null` until loaded/signed-in — every other piece of state
  // in this app keeps working with no session at all (offline-first).
  const [session, setSession] = useState<StoredSession | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncVersion, setSyncVersion] = useState(0);

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
  //
  // `loadProfiles` is deliberately AWAITED FIRST, before the Promise.all
  // below — every other store's load function reads
  // ./src/profiles.ts's synchronous `getActiveProfileId()` cache the instant
  // it starts running (before its own first `await`), so that cache must
  // already reflect the persisted active profile id BEFORE any of those
  // calls are even made. Running `loadProfiles()` inside the same
  // Promise.all as the rest would race: `Promise.all` calls every function
  // in the array synchronously (up to each one's own first `await`) before
  // `loadProfiles()` has had a chance to update the cache, which would
  // silently read the wrong profile's data on every app restart after a
  // profile switch. Gated on `languageLoaded` so the localized default
  // profile name ("Eu"/"Me") is seeded correctly on a genuine first run.
  useEffect(() => {
    if (!languageLoaded) return;
    let cancelled = false;

    (async () => {
      const loadedProfiles = await loadProfiles(t("profiles.defaultName"));
      if (cancelled) return;
      setProfiles(loadedProfiles.profiles);
      setActiveProfileIdState(loadedProfiles.activeProfileId);

      const [
        loadedFavourites,
        loadedRecents,
        loadedCustomFoods,
        loadedDoseProfile,
        loadedSession,
        loadedSavedMeals,
        loadedHistory,
        loadedRecipes,
        loadedStartupTab,
      ] = await Promise.all([
        loadFavouriteIds(),
        loadRecentIds(),
        loadCustomFoods(),
        loadDoseProfile(),
        loadSession(),
        loadSavedMeals(),
        loadHistory(),
        loadRecipes(),
        loadStartupTab(),
      ]);
      if (cancelled) return;
      setFavouriteIds(loadedFavourites);
      setRecentIds(loadedRecents);
      setCustomFoods(loadedCustomFoods);
      setDoseProfile(loadedDoseProfile.profile);
      setHasSavedDoseProfile(loadedDoseProfile.hasSavedProfile);
      setSession(loadedSession);
      setSavedMeals(loadedSavedMeals);
      setHistory(loadedHistory);
      setRecipes(loadedRecipes);
      // Apply the saved landing tab as the initial view. Safe to set
      // activeTab here (still behind the Splash until dataLoaded flips), so
      // there's no flash of the default "search" tab first.
      setStartupTab(loadedStartupTab);
      setActiveTab(loadedStartupTab);
    })().finally(() => {
      if (!cancelled) setDataLoaded(true);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageLoaded]);

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

  useEffect(() => {
    if (!dataLoaded) return;
    void saveSavedMeals(savedMeals);
  }, [savedMeals, dataLoaded]);

  const baseCatalog = remoteFoods ?? CATALOG;
  const catalogSource: "online" | "offline" = remoteFoods !== null ? "online" : "offline";
  // Every food this app knows about right now, UNFILTERED by area — this is
  // what favourites/recents resolve against, so an active area/cuisine
  // filter in Search never hides an already-favourited or recently-viewed
  // food elsewhere in the app.
  const allFoods = useMemo(() => [...baseCatalog, ...customFoods], [baseCatalog, customFoods]);

  // Browse-by-area (Slice: browse by area + cuisine). The filter is applied
  // to the CATALOG only, before combining with the user's own custom foods
  // (which have no countries/cuisineTags of their own and must never be
  // hidden by a geography/cuisine filter) — see areaFilter.ts.
  const regionGroups: ContinentGroup[] = AREA_TAXONOMY;
  const cuisines = useMemo(() => availableCuisineTags(baseCatalog), [baseCatalog]);
  const searchableFoods = useMemo(() => {
    const areaFiltered = filterByArea(baseCatalog, { regionId: selectedRegionId, cuisine: selectedCuisine });
    return [...areaFiltered, ...customFoods];
  }, [baseCatalog, customFoods, selectedRegionId, selectedCuisine]);

  const favouriteIdSet = useMemo(() => new Set(favouriteIds), [favouriteIds]);
  const results = useMemo(() => searchFoods(query, searchableFoods), [query, searchableFoods]);
  // Single source of truth for meal totals — same summariseMeal() used here
  // for the quick-glance search bar and in MealScreen for the full breakdown.
  const mealSummary = useMemo(() => summariseMeal(meal), [meal]);

  // Display label for the Diário entry the current meal is linked to (see
  // `editingHistoryEntryId` above), or null — passed to MealScreen so it can
  // offer "Atualizar registo «label»" only when such a link exists.
  const editingHistoryEntryLabel = useMemo(() => {
    const entry = history.find((candidate) => candidate.id === editingHistoryEntryId);
    return entry ? historyEntryLabel(entry) : null;
  }, [history, editingHistoryEntryId]);

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

  const handleAddToMeal = useCallback((food: CanonicalFood, amountGrams = 100) => {
    setMeal((lines) => {
      const existingIndex = lines.findIndex((line) => line.food.id === food.id);
      if (existingIndex >= 0) {
        const updated = [...lines];
        updated[existingIndex] = { ...updated[existingIndex], amount: updated[existingIndex].amount + amountGrams };
        return updated;
      }
      return [...lines, { food, amount: amountGrams }];
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

  // Barcode scanning (Slice: barcode scanning). A match against `allFoods`
  // (catalog + the user's own custom foods, unfiltered by area) opens Detail
  // exactly like a normal search selection; a miss on THIS device's catalog
  // offers BarcodeScanScreen's own Open Food Facts (OFF) fallback lookup, and
  // only a miss on BOTH hands the scanned/typed code to CreateFoodScreen's
  // pre-fill rather than silently discarding it.
  const handleBarcodeFound = useCallback(
    (food: CanonicalFood) => {
      recordRecent(food.id);
      setOverlay({ kind: "detail", food });
    },
    [recordRecent],
  );

  const handleBarcodeNotFound = useCallback((barcode: string) => {
    setOverlay({ kind: "create", barcode });
  }, []);

  // "Adicionar à refeição" on an OFF LOW-CONFIDENCE candidate (barcode
  // scanning — OFF fallback). Deliberately the SAME add-to-meal path as
  // everywhere else (`handleAddToMeal` below) — the candidate is never
  // persisted to the catalog or to the user's own custom foods, it only ever
  // becomes a line in the CURRENT meal, carrying its `confidence:
  // "unverified"` nutrient with it (MealScreen already reacts to that).
  const handleAddOffCandidate = useCallback(
    (food: CanonicalFood) => {
      handleAddToMeal(food);
    },
    [handleAddToMeal],
  );

  // "Guardar como o meu alimento" on an OFF candidate — routes to
  // CreateFoodScreen with the candidate's barcode/name/carbs PRE-FILLED but
  // fully editable (never silently trusted: the user must review/correct and
  // explicitly save, exactly like any other custom food — see
  // ./src/customFood.ts).
  const handleSaveOffCandidate = useCallback((barcode: string, food: CanonicalFood) => {
    setOverlay({ kind: "create", barcode, prefillNamePt: displayName(food, "pt"), prefillCarbPer100g: carbPer100g(food) });
  }, []);

  // Slice 5 — local data rights: "Apagar todos os meus dados". Resets every
  // piece of locally persisted state for the ACTIVE profile immediately (so
  // the UI reflects the wipe instantly), then — Slice: caregiver profiles
  // ("Perfis") — clears EVERY profile's data across every store (favourites/
  // recents/custom foods, Diário, saved meals, recipes, my submissions, the
  // Nightscout connection, and the clinical Dose Assist profile — each a
  // separate AsyncStorage/SecureStore namespace; see ./src/profiles.ts's
  // `clearProfileData` convention), and finally collapses the profile LIST
  // back to a single, fresh default profile (CLAUDE.md/task: "clears ALL
  // profiles' data and resets to a single default profile"). GlucoseScreen
  // re-reads its store on every mount, so it always reflects "not connected"
  // afterwards.
  const handleDeleteAllData = useCallback(() => {
    setFavouriteIds([]);
    setRecentIds([]);
    setCustomFoods([]);
    setMeal([]);
    setSavedMeals([]);
    setActiveSavedMealId(null);
    setHistory([]);
    setEditingHistoryEntryId(null);
    setRecipes([]);
    setDoseProfile(DEFAULT_DOSE_PROFILE);
    setHasSavedDoseProfile(false);
    void saveFavouriteIds([]);
    void saveRecentIds([]);
    void saveCustomFoods([]);
    void saveSavedMeals([]);

    void (async () => {
      const idsToClear = profiles.map((profile) => profile.id);
      await Promise.all(
        idsToClear.flatMap((id) => [
          clearStorageProfileData(id),
          clearHistoryProfileData(id),
          clearSavedMealsProfileData(id),
          clearRecipesProfileData(id),
          clearSubmissionsProfileData(id),
          clearNightscoutProfileData(id),
          clearDoseProfileData(id),
        ]),
      );
      const reset = await resetToDefaultProfile(t("profiles.defaultName"));
      setProfiles(reset.profiles);
      setActiveProfileIdState(reset.activeProfileId);
    })();
  }, [profiles, t]);

  // Slice: caregiver profiles ("Perfis") — add/rename/delete the profile
  // LIST. Deleting refuses (returns the list unchanged, defended again at the
  // ./src/profiles.ts layer) for the ACTIVE profile and for the LAST
  // remaining profile — see deleteProfile's own doc comment. Only on an
  // ACTUAL deletion do we also clear that profile's data in every other
  // store; a refused delete must never wipe anything.
  const handleAddProfile = useCallback((name: string, kind: ProfileKind) => {
    void addProfile(name, kind).then(setProfiles);
  }, []);

  const handleRenameProfile = useCallback((id: string, name: string) => {
    void renameProfile(id, name).then(setProfiles);
  }, []);

  const handleDeleteProfile = useCallback((id: string) => {
    void (async () => {
      const nextProfiles = await deleteProfile(id);
      setProfiles(nextProfiles);
      const wasActuallyDeleted = !nextProfiles.some((profile) => profile.id === id);
      if (!wasActuallyDeleted) return;
      await Promise.all([
        clearStorageProfileData(id),
        clearHistoryProfileData(id),
        clearSavedMealsProfileData(id),
        clearRecipesProfileData(id),
        clearSubmissionsProfileData(id),
        clearNightscoutProfileData(id),
        clearDoseProfileData(id),
      ]);
    })();
  }, []);

  // Slice: caregiver profiles ("Perfis") — the actual profile switch, called
  // by ../src/screens/ProfilesScreen.tsx only AFTER its own inline "Mudar
  // para «Nome»?" confirmation. SAFETY (cross-profile isolation): persists +
  // updates ./src/profiles.ts's active-id cache FIRST, THEN reloads every
  // per-profile store fresh for the newly active profile — never trusting
  // in-memory state carried over from the previous profile — and clears any
  // in-progress current meal / "edit this saved meal or Diário entry in
  // place" link, since those belong to the PREVIOUS profile's session.
  // Closes whatever overlay is open (the profiles switcher itself), so the
  // tab underneath remounts against the newly active profile.
  const handleSwitchProfile = useCallback((id: string) => {
    void (async () => {
      await setActiveProfile(id);
      setActiveProfileIdState(id);

      const [loadedFavourites, loadedRecents, loadedCustomFoods, loadedDoseProfile, loadedSavedMeals, loadedHistory, loadedRecipes] =
        await Promise.all([
          loadFavouriteIds(),
          loadRecentIds(),
          loadCustomFoods(),
          loadDoseProfile(),
          loadSavedMeals(),
          loadHistory(),
          loadRecipes(),
        ]);

      setFavouriteIds(loadedFavourites);
      setRecentIds(loadedRecents);
      setCustomFoods(loadedCustomFoods);
      setDoseProfile(loadedDoseProfile.profile);
      setHasSavedDoseProfile(loadedDoseProfile.hasSavedProfile);
      setSavedMeals(loadedSavedMeals);
      setHistory(loadedHistory);
      setRecipes(loadedRecipes);

      setMeal([]);
      setActiveSavedMealId(null);
      setEditingHistoryEntryId(null);
      setOverlay(null);
    })();
  }, []);

  // "Guardar refeição" (Slice: refeições repetidas). Builds a snapshot of the
  // CURRENT meal — never a reference to it — so later edits to the current
  // meal, or to the underlying foods, never retroactively change a meal that
  // was already saved (CLAUDE.md: "Preserve original source values and
  // transformation history").
  const handleSaveMeal = useCallback(
    (name: string) => {
      const built = buildSavedMealFromLines(name, meal, (food) => displayName(food, language));
      setSavedMeals((current) => [built, ...current]);
      // The current meal now corresponds to this freshly-saved record, so
      // subsequent "Atualizar" edits target it (not whatever it was cloned
      // from, if anything).
      setActiveSavedMealId(built.id);
    },
    [meal, language],
  );

  // "Atualizar «nome»" — rewrites the linked saved meal's items/total from the
  // CURRENT meal while preserving its id, name, and original createdAt. This
  // is the ONLY in-place mutation of a saved meal's contents; every other save
  // path (buildSavedMealFromLines) mints a brand-new record, so the immutable
  // "save is always a fresh snapshot" default is preserved and updating is an
  // explicit, user-initiated action.
  const handleUpdateSavedMeal = useCallback(
    (id: string) => {
      setSavedMeals((current) => {
        const existing = current.find((savedMeal) => savedMeal.id === id);
        if (!existing) return current;
        const rebuilt = buildSavedMealFromLines(existing.name, meal, (food) => displayName(food, language));
        const updated: SavedMeal = { ...rebuilt, id: existing.id, name: existing.name, createdAt: existing.createdAt };
        return current.map((savedMeal) => (savedMeal.id === id ? updated : savedMeal));
      });
    },
    [meal, language],
  );

  const handleRenameSavedMeal = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    setSavedMeals((current) => current.map((savedMeal) => (savedMeal.id === id ? { ...savedMeal, name: trimmed } : savedMeal)));
  }, []);

  const handleDeleteSavedMeal = useCallback((id: string) => {
    setSavedMeals((current) => current.filter((savedMeal) => savedMeal.id !== id));
    setActiveSavedMealId((currentId) => (currentId === id ? null : currentId));
  }, []);

  // "Usar" and "Clonar e ajustar" both replace the CURRENT meal with a fresh
  // reconstruction of the saved meal (never a reference to the saved
  // record's own item objects), then switch to the editable Meal screen —
  // where quantities are already always editable (see MealScreen) and
  // "Guardar refeição" always creates a brand-new saved-meal record. That
  // combination is what makes "Clonar e ajustar" safe by construction: any
  // post-load quantity edit can never mutate the saved original, whether the
  // user got there via "Usar" or "Clonar e ajustar". The two actions are
  // intentionally the same operation today, kept as two named callbacks so
  // the two clearly-labelled entry points in SavedMealsScreen can diverge
  // later (e.g. "Usar" skipping straight to Estimativa de dose) without a
  // breaking change to that screen's props.
  const loadSavedMealIntoCurrent = useCallback(
    (savedMeal: SavedMeal, linkForEditing: boolean) => {
      setMeal(resolveSavedMealToLines(savedMeal, allFoods));
      // "Usar" links the current meal to its saved origin so the user can
      // edit and update it in place; "Clonar e ajustar" deliberately does
      // not, so tweaks are saved as a new meal and the original is untouched.
      setActiveSavedMealId(linkForEditing ? savedMeal.id : null);
      setOverlay(null);
      setActiveTab("meal");
    },
    [allFoods],
  );

  const handleUseSavedMeal = useCallback((savedMeal: SavedMeal) => loadSavedMealIntoCurrent(savedMeal, true), [loadSavedMealIntoCurrent]);
  const handleCloneSavedMeal = useCallback((savedMeal: SavedMeal) => loadSavedMealIntoCurrent(savedMeal, false), [loadSavedMealIntoCurrent]);

  // "Registar no diário" (Slice: meal history / Diário). Builds a snapshot of
  // the CURRENT meal — never a reference to it — so later edits to the
  // current meal, or to the underlying foods, never retroactively change a
  // meal that was already logged as eaten (CLAUDE.md: "Preserve original
  // source values and transformation history"). Always creates a brand-new,
  // dated entry; ../src/mealHistory.ts's logMeal() reads the on-device
  // Diário fresh before writing, so this is safe even if `history` hasn't
  // finished hydrating from storage yet. Links the current meal to the
  // freshly-logged entry so an immediate correction can use "Atualizar
  // registo" instead of hunting for it in the Diário.
  const handleLogMeal = useCallback(
    (name?: string) => {
      const entry = buildHistoryEntryFromLines(meal, (food) => displayName(food, language), name);
      setEditingHistoryEntryId(entry.id);
      void logMeal(entry).then(setHistory);
    },
    [meal, language],
  );

  // "Atualizar registo «label»" — corrects the linked Diário entry's
  // items/total from the CURRENT meal, preserving its id, name, and original
  // loggedAt (so fixing a mistake never makes it look like the meal was
  // eaten at a different time). This is the ONLY in-place mutation of a
  // history entry's contents; every other log path (buildHistoryEntryFromLines
  // via handleLogMeal) mints a brand-new, freshly-dated entry.
  const handleUpdateHistoryEntry = useCallback(
    (id: string) => {
      const existing = history.find((entry) => entry.id === id);
      if (!existing) return;
      const rebuilt = buildHistoryEntryFromLines(meal, (food) => displayName(food, language), existing.name, existing.loggedAt);
      const updated: HistoryEntry = { ...rebuilt, id: existing.id };
      void updateHistoryEntry(updated).then(setHistory);
    },
    [history, meal, language],
  );

  const handleDeleteHistoryEntry = useCallback((id: string) => {
    void deleteHistoryEntry(id).then(setHistory);
    setEditingHistoryEntryId((currentId) => (currentId === id ? null : currentId));
  }, []);

  // "Reutilizar" and "Editar" both replace the CURRENT meal with a fresh
  // reconstruction of the Diário entry (never a reference to the entry's own
  // item objects), then switch to the editable Meal screen — mirroring
  // loadSavedMealIntoCurrent above. "Editar" links back (so "Atualizar
  // registo" can correct that exact entry in place); "Reutilizar" deliberately
  // does not, so adjustments are logged as a brand-new, separately-dated
  // entry and the original historical record is left untouched.
  const loadHistoryEntryIntoCurrent = useCallback(
    (entry: HistoryEntry, linkForEditing: boolean) => {
      setMeal(resolveHistoryEntryToLines(entry, allFoods));
      setEditingHistoryEntryId(linkForEditing ? entry.id : null);
      setOverlay(null);
      setActiveTab("meal");
    },
    [allFoods],
  );

  const handleReuseHistoryEntry = useCallback((entry: HistoryEntry) => loadHistoryEntryIntoCurrent(entry, false), [loadHistoryEntryIntoCurrent]);
  const handleEditHistoryEntry = useCallback((entry: HistoryEntry) => loadHistoryEntryIntoCurrent(entry, true), [loadHistoryEntryIntoCurrent]);

  // "Receitas" (recipe carb calculator — Slice: Receitas). `editing` is the
  // recipe being replaced in place (from RecipesScreen's "Editar"), or `null`
  // for a brand-new one — ../src/recipes.ts's buildRecipe() is the ONLY place
  // that assigns a recipe's id/createdAt, mirroring buildCustomFood/
  // buildSavedMealFromLines elsewhere in this file. saveRecipe() reads the
  // on-device list fresh before writing, so this is safe even before
  // `recipes` has finished hydrating from storage.
  const handleSaveRecipe = useCallback((input: RecipeInput, editing: Recipe | null) => {
    const recipe = buildRecipe(input, editing ?? undefined);
    void saveRecipe(recipe).then(setRecipes);
  }, []);

  const handleDeleteRecipe = useCallback((id: string) => {
    void deleteRecipe(id).then(setRecipes);
  }, []);

  // "Adicionar à refeição" (Usar receita) — turns `portions` portions of
  // `recipe` into a MealLine (../src/recipes.ts's recipeToMealLine) and adds
  // it through the EXISTING, unmodified meal-adding pipeline (handleAddToMeal
  // above), so it merges/totals/flows into the dose review and the Diário
  // exactly like adding any other food.
  const handleUseRecipe = useCallback(
    (recipe: Recipe, portions: number) => {
      const line = recipeToMealLine(recipe, portions);
      handleAddToMeal(line.food, line.amount);
    },
    [handleAddToMeal],
  );

  // "Perfil clínico" save: merges the validated form values into the current
  // profile, bumps `version` (so the calculation's audit record reflects
  // this exact change — clinical-safety rule), and persists under its own
  // AsyncStorage key. This is the ONLY place a DoseProfile is written.
  // Perfil → "Página inicial": persists the chosen landing tab. Applies on the
  // next app open (it deliberately doesn't navigate the current session).
  const handleChangeStartupTab = useCallback((tab: TabKey) => {
    setStartupTab(tab);
    void saveStartupTab(tab);
  }, []);

  const handleSaveDoseProfile = useCallback((updates: DoseProfileFormValues) => {
    setDoseProfile((current) => {
      const next: DoseProfile = { ...current, ...updates, version: bumpProfileVersion(current.version) };
      void saveDoseProfile(next);
      return next;
    });
    setHasSavedDoseProfile(true);
  }, []);

  // Accounts + multi-device sync (Slice: accounts + multi-device sync).
  //
  // MERGE RULE — CLAUDE.md: "Never merge conflicting food values by silently
  // averaging them." A sync is always a UNION over favourites/customFoods
  // (see src/sync.ts's mergeSyncState), never a pick-one-and-discard —
  // logging in on a second device must never silently drop data that exists
  // only locally or only in the cloud.
  //
  // `performSyncBootstrap` pulls the cloud snapshot right after a successful
  // login/register, merges it with THIS device's current local data, applies
  // the merge locally immediately (so the merge is visible even if the
  // follow-up push below fails), then pushes the merged result back —
  // re-merging and retrying exactly once if the push hits a version conflict
  // (CLAUDE.md: "a sync conflict must be surfaced and reconciled explicitly,
  // never overwritten blindly").
  const performSyncBootstrap = useCallback(async (token: string, localFavourites: string[], localCustomFoods: CanonicalFood[]) => {
    setSyncStatus("syncing");
    try {
      const remote = await getSyncState(token);
      const merged = mergeSyncState({ favouriteIds: localFavourites, customFoods: localCustomFoods }, remote.state);
      setFavouriteIds(merged.favourites);
      setCustomFoods(merged.customFoods);

      let putResult = await putSyncState(token, merged, remote.version);
      if (putResult.outcome === "conflict") {
        const remerged = mergeSyncState({ favouriteIds: merged.favourites, customFoods: merged.customFoods }, putResult.snapshot.state);
        setFavouriteIds(remerged.favourites);
        setCustomFoods(remerged.customFoods);
        putResult = await putSyncState(token, remerged, putResult.snapshot.version);
      }

      if (putResult.outcome === "ok") {
        setSyncVersion(putResult.version);
        setSyncStatus("synced");
      } else {
        // Conflict persisted after one retry — the local data is still safe
        // (already merged as a union and applied above); the next sync
        // (manual "Sincronizar agora" or the background push) will retry.
        setSyncStatus("offline");
      }
    } catch (error) {
      setSyncStatus(isConnectivityError(error) ? "offline" : "error");
    }
  }, []);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      // Throws a typed ApiError on failure — the caller (AccountScreen)
      // catches it and shows a message; nothing here is touched on failure.
      const { token } = await login(email, password);
      const nextSession: StoredSession = { token, email };
      setSession(nextSession);
      void saveSession(nextSession);
      void performSyncBootstrap(token, favouriteIds, customFoods);
    },
    [favouriteIds, customFoods, performSyncBootstrap],
  );

  const handleRegister = useCallback(
    async (email: string, password: string) => {
      const { token } = await register(email, password);
      const nextSession: StoredSession = { token, email };
      setSession(nextSession);
      void saveSession(nextSession);
      void performSyncBootstrap(token, favouriteIds, customFoods);
    },
    [favouriteIds, customFoods, performSyncBootstrap],
  );

  const handleLogout = useCallback(() => {
    // Deliberately does NOT touch favourites/recents/customFoods — those are
    // local-first data the user keeps on this device after logging out
    // (see src/auth.ts's clearSession).
    setSession(null);
    setSyncStatus("idle");
    setSyncVersion(0);
    void clearSession();
  }, []);

  // Pushes the CURRENT local favourites/customFoods to the cloud. Used both
  // by the "Sincronizar agora" button and by the debounced background-push
  // effect below — always best-effort: a network failure only ever changes
  // `syncStatus`, never throws into the UI.
  const pushSyncState = useCallback(async () => {
    if (!session) return;
    setSyncStatus("syncing");
    try {
      const state: SyncState = { favourites: favouriteIds, customFoods };
      let putResult = await putSyncState(session.token, state, syncVersion);
      if (putResult.outcome === "conflict") {
        const merged = mergeSyncState({ favouriteIds, customFoods }, putResult.snapshot.state);
        setFavouriteIds(merged.favourites);
        setCustomFoods(merged.customFoods);
        putResult = await putSyncState(session.token, merged, putResult.snapshot.version);
      }
      if (putResult.outcome === "ok") {
        setSyncVersion(putResult.version);
        setSyncStatus("synced");
      } else {
        setSyncStatus("offline");
      }
    } catch (error) {
      setSyncStatus(isConnectivityError(error) ? "offline" : "error");
    }
  }, [session, favouriteIds, customFoods, syncVersion]);

  // Best-effort background push: while signed in, any local change to
  // favourites/customFoods is (debounced) synced to the cloud. Never blocks
  // the UI and never drops local data on failure — a failed push just leaves
  // `syncStatus` as "offline"/"error" until the next successful attempt.
  useEffect(() => {
    if (!dataLoaded || !session || syncStatus === "syncing") return;
    const timer = setTimeout(() => {
      void pushSyncState();
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favouriteIds, customFoods, session, dataLoaded]);

  if (!languageLoaded || !dataLoaded) {
    return <Splash />;
  }

  const showBack = overlay !== null;
  // By the time any UI renders (behind the Splash gate above), `profiles`
  // always has at least the default one — this fallback only guards the
  // type, never a real runtime path, mirroring ../src/dose/profile.ts's
  // DEFAULT_DOSE_PROFILE "fail closed to a safe default" convention.
  const activeProfile: Profile =
    profiles.find((profile) => profile.id === activeProfileId) ??
    ({ id: DEFAULT_PROFILE_ID, name: t("profiles.defaultName"), kind: "self", createdAt: new Date(0).toISOString() } as Profile);

  return (
    <View style={styles.safe}>
      <StatusBar style="dark" />
      <Header
        showBack={showBack}
        onBack={() => setOverlay(null)}
        onCreateFood={() => setOverlay({ kind: "create" })}
        onOpenProfile={() => setOverlay({ kind: "profile" })}
        onOpenAccount={() => setOverlay({ kind: "account" })}
        activeProfileName={activeProfile.name}
        onOpenProfiles={() => setOverlay({ kind: "profiles" })}
      />

      <LinearGradient colors={gradients.mist.colors} start={gradients.mist.start} end={gradients.mist.end} style={styles.body}>
        {/* Signature Aurora glow, painted once over the mist gradient and
            behind every screen. Decorative + non-interactive. */}
        <AuroraBackground />

        {overlay?.kind === "detail" && (
          <DetailScreen
            food={overlay.food}
            isFavourite={favouriteIdSet.has(overlay.food.id)}
            onToggleFavourite={handleToggleFavourite}
            onAdd={handleAddToMeal}
            authToken={session?.token ?? null}
          />
        )}

        {overlay?.kind === "create" && (
          <CreateFoodScreen
            onCancel={() => setOverlay(null)}
            onSubmit={handleCreateFood}
            prefillBarcode={overlay.barcode ?? null}
            prefillNamePt={overlay.prefillNamePt ?? null}
            prefillCarbPer100g={overlay.prefillCarbPer100g ?? null}
          />
        )}

        {overlay?.kind === "barcodeScan" && (
          <BarcodeScanScreen
            foods={allFoods}
            onFound={handleBarcodeFound}
            onNotFound={handleBarcodeNotFound}
            onCancel={() => setOverlay(null)}
            onAddOffCandidate={handleAddOffCandidate}
            onSaveOffCandidate={handleSaveOffCandidate}
          />
        )}

        {overlay?.kind === "profile" && (
          <ProfileScreen
            language={language}
            activeProfile={activeProfile}
            favouriteIds={favouriteIds}
            recentIds={recentIds}
            customFoods={customFoods}
            meal={meal}
            savedMeals={savedMeals}
            history={history}
            recipes={recipes}
            onDeleteAll={handleDeleteAllData}
            doseProfile={doseProfile}
            hasSavedDoseProfile={hasSavedDoseProfile}
            onSaveDoseProfile={handleSaveDoseProfile}
            startupTab={startupTab}
            onChangeStartupTab={handleChangeStartupTab}
          />
        )}

        {overlay?.kind === "profiles" && (
          <ProfilesScreen
            profiles={profiles}
            activeProfileId={activeProfileId}
            onAddProfile={handleAddProfile}
            onRenameProfile={handleRenameProfile}
            onDeleteProfile={handleDeleteProfile}
            onSwitchProfile={handleSwitchProfile}
          />
        )}

        {overlay?.kind === "account" && (
          <AccountScreen
            session={session}
            syncStatus={syncStatus}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onLogout={handleLogout}
            onSyncNow={() => void pushSyncState()}
          />
        )}

        {overlay?.kind === "doseReview" && <DoseReviewScreen totalCarbGrams={mealSummary.totalCarbGrams} profile={doseProfile} />}

        {overlay?.kind === "submissions" && <SubmissionsScreen />}

        {overlay?.kind === "savedMeals" && (
          <SavedMealsScreen
            savedMeals={savedMeals}
            onUse={handleUseSavedMeal}
            onClone={handleCloneSavedMeal}
            onRename={handleRenameSavedMeal}
            onDelete={handleDeleteSavedMeal}
          />
        )}

        {overlay?.kind === "history" && (
          <HistoryScreen history={history} onReuse={handleReuseHistoryEntry} onEdit={handleEditHistoryEntry} onDelete={handleDeleteHistoryEntry} />
        )}

        {overlay?.kind === "recipes" && (
          <RecipesScreen recipes={recipes} allFoods={allFoods} onSave={handleSaveRecipe} onDelete={handleDeleteRecipe} onUse={handleUseRecipe} />
        )}

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
                onScanBarcode={() => setOverlay({ kind: "barcodeScan" })}
                mealItemCount={mealSummary.itemCount}
                mealCarbGrams={mealSummary.totalCarbGrams}
                catalogSource={catalogSource}
                catalogLoading={catalogLoading}
                onRefreshCatalog={refreshCatalog}
                regionGroups={regionGroups}
                cuisines={cuisines}
                selectedRegionId={selectedRegionId}
                selectedCuisine={selectedCuisine}
                onSelectRegion={setSelectedRegionId}
                onSelectCuisine={setSelectedCuisine}
              />
            )}

            {activeTab === "meal" && (
              <MealScreen
                lines={meal}
                onChangeAmount={handleChangeAmount}
                onRemove={handleRemoveFromMeal}
                onEstimateDose={() => setOverlay({ kind: "doseReview" })}
                savedMealsCount={savedMeals.length}
                latestSavedMeal={savedMeals[0] ?? null}
                onUseSavedMeal={handleUseSavedMeal}
                onOpenSavedMeals={() => setOverlay({ kind: "savedMeals" })}
                onSaveMeal={handleSaveMeal}
                editingSavedMealName={savedMeals.find((savedMeal) => savedMeal.id === activeSavedMealId)?.name ?? null}
                onUpdateSavedMeal={() => {
                  if (activeSavedMealId) handleUpdateSavedMeal(activeSavedMealId);
                }}
                historyCount={history.length}
                onOpenHistory={() => setOverlay({ kind: "history" })}
                onLogMeal={handleLogMeal}
                editingHistoryEntryLabel={editingHistoryEntryLabel}
                onUpdateHistoryEntry={() => {
                  if (editingHistoryEntryId) handleUpdateHistoryEntry(editingHistoryEntryId);
                }}
                recipesCount={recipes.length}
                onOpenRecipes={() => setOverlay({ kind: "recipes" })}
              />
            )}

            {activeTab === "favourites" && (
              <FavouritesScreen
                favourites={favouriteFoods}
                recents={recentFoods}
                favouriteIds={favouriteIdSet}
                onSelectFood={handleSelectFood}
                onToggleFavourite={handleToggleFavourite}
                onOpenSubmissions={() => setOverlay({ kind: "submissions" })}
              />
            )}

            {activeTab === "glucose" && <GlucoseScreen />}
          </>
        )}
      </LinearGradient>
    </View>
  );
}

// T1Dine is a phone app. On native (iOS/Android) it should always fill the
// device screen exactly as before — this component is a no-op there. On web
// only, a full-bleed phone UI stretched across a desktop browser window reads
// as broken rather than "responsive", so we centre it in a fixed, phone-like
// column (~480px, matching common phone widths) over a neutral backdrop,
// which is also what lets Header.tsx measure a realistic (narrow) width via
// onLayout instead of the full, much wider, browser window.
function WebFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }
  return (
    <View style={styles.webBackdrop}>
      <View style={styles.webColumn}>{children}</View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <WebFrame>
          <AppShell />
        </WebFrame>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  tabBarWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  webBackdrop: { flex: 1, alignItems: "center", backgroundColor: colors.ink },
  webColumn: { flex: 1, width: "100%", maxWidth: 480 },
});
