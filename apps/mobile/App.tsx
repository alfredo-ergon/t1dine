import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform, SafeAreaView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
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
import { bumpProfileVersion, loadDoseProfile, saveDoseProfile } from "./src/dose/profileStorage";
import { LanguageProvider, useLanguage } from "./src/i18n";
import { clearConnection as clearNightscoutConnection } from "./src/nightscoutStore";
import { displayName, searchFoods } from "./src/search";
import { AccountScreen } from "./src/screens/AccountScreen";
import { BarcodeScanScreen } from "./src/screens/BarcodeScanScreen";
import { CreateFoodScreen } from "./src/screens/CreateFoodScreen";
import { DetailScreen } from "./src/screens/DetailScreen";
import { DoseReviewScreen } from "./src/screens/DoseReviewScreen";
import { FavouritesScreen } from "./src/screens/FavouritesScreen";
import { GlucoseScreen } from "./src/screens/GlucoseScreen";
import { MealScreen } from "./src/screens/MealScreen";
import { ProfileScreen, type DoseProfileFormValues } from "./src/screens/ProfileScreen";
import { SavedMealsScreen } from "./src/screens/SavedMealsScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { SubmissionsScreen } from "./src/screens/SubmissionsScreen";
import { buildSavedMealFromLines, loadSavedMeals, resolveSavedMealToLines, saveSavedMeals, type SavedMeal } from "./src/savedMeals";
import {
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
  | { kind: "create"; barcode?: string }
  | { kind: "profile" }
  | { kind: "account" }
  | { kind: "doseReview" }
  | { kind: "submissions" }
  | { kind: "savedMeals" }
  | { kind: "barcodeScan" }
  | null;

function AppShell() {
  const { isLoaded: languageLoaded, language } = useLanguage();

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
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadFavouriteIds(), loadRecentIds(), loadCustomFoods(), loadDoseProfile(), loadSession(), loadSavedMeals(), loadStartupTab()])
      .then(([loadedFavourites, loadedRecents, loadedCustomFoods, loadedDoseProfile, loadedSession, loadedSavedMeals, loadedStartupTab]) => {
        if (cancelled) return;
        setFavouriteIds(loadedFavourites);
        setRecentIds(loadedRecents);
        setCustomFoods(loadedCustomFoods);
        setDoseProfile(loadedDoseProfile.profile);
        setHasSavedDoseProfile(loadedDoseProfile.hasSavedProfile);
        setSession(loadedSession);
        setSavedMeals(loadedSavedMeals);
        // Apply the saved landing tab as the initial view. Safe to set
        // activeTab here (still behind the Splash until dataLoaded flips), so
        // there's no flash of the default "search" tab first.
        setStartupTab(loadedStartupTab);
        setActiveTab(loadedStartupTab);
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
  // exactly like a normal search selection; a miss hands the scanned/typed
  // code to CreateFoodScreen's pre-fill rather than silently discarding it —
  // there is no external (e.g. Open Food Facts) lookup in this version.
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

  // Slice 5 — local data rights: "Apagar todos os meus dados". Resets every
  // piece of locally persisted state (favourites, recents, custom foods,
  // saved meals) via the same storage helpers used to save them, clears the
  // in-memory meal (which has no separate persistence key of its own), and
  // clears any saved Nightscout connection (../src/nightscoutStore.ts — a
  // separate secure store, never AsyncStorage, but still local data this
  // device holds and must remove here). GlucoseScreen re-reads that store on
  // every mount, so it always reflects this as "not connected" afterwards.
  const handleDeleteAllData = useCallback(() => {
    setFavouriteIds([]);
    setRecentIds([]);
    setCustomFoods([]);
    setMeal([]);
    setSavedMeals([]);
    setActiveSavedMealId(null);
    void saveFavouriteIds([]);
    void saveRecentIds([]);
    void saveCustomFoods([]);
    void saveSavedMeals([]);
    void clearNightscoutConnection();
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <Header
        showBack={showBack}
        onBack={() => setOverlay(null)}
        onCreateFood={() => setOverlay({ kind: "create" })}
        onOpenProfile={() => setOverlay({ kind: "profile" })}
        onOpenAccount={() => setOverlay({ kind: "account" })}
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
          <CreateFoodScreen onCancel={() => setOverlay(null)} onSubmit={handleCreateFood} prefillBarcode={overlay.barcode ?? null} />
        )}

        {overlay?.kind === "barcodeScan" && (
          <BarcodeScanScreen
            foods={allFoods}
            onFound={handleBarcodeFound}
            onNotFound={handleBarcodeNotFound}
            onCancel={() => setOverlay(null)}
          />
        )}

        {overlay?.kind === "profile" && (
          <ProfileScreen
            language={language}
            favouriteIds={favouriteIds}
            recentIds={recentIds}
            customFoods={customFoods}
            meal={meal}
            savedMeals={savedMeals}
            onDeleteAll={handleDeleteAllData}
            doseProfile={doseProfile}
            hasSavedDoseProfile={hasSavedDoseProfile}
            onSaveDoseProfile={handleSaveDoseProfile}
            startupTab={startupTab}
            onChangeStartupTab={handleChangeStartupTab}
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
    </SafeAreaView>
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
    <LanguageProvider>
      <WebFrame>
        <AppShell />
      </WebFrame>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  tabBarWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  webBackdrop: { flex: 1, alignItems: "center", backgroundColor: colors.ink },
  webColumn: { flex: 1, width: "100%", maxWidth: 480 },
});
