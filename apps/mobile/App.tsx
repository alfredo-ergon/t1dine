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
import { Header } from "./src/components/Header";
import { Splash } from "./src/components/Splash";
import { TabBar, type TabKey } from "./src/components/TabBar";
import { CATALOG } from "./src/catalog";
import { buildCustomFood, type CustomFoodInput } from "./src/customFood";
import { DEFAULT_DOSE_PROFILE, type DoseProfile } from "./src/dose/profile";
import { bumpProfileVersion, loadDoseProfile, saveDoseProfile } from "./src/dose/profileStorage";
import { LanguageProvider, useLanguage } from "./src/i18n";
import { searchFoods } from "./src/search";
import { AccountScreen } from "./src/screens/AccountScreen";
import { CreateFoodScreen } from "./src/screens/CreateFoodScreen";
import { DetailScreen } from "./src/screens/DetailScreen";
import { DoseReviewScreen } from "./src/screens/DoseReviewScreen";
import { FavouritesScreen } from "./src/screens/FavouritesScreen";
import { GlucoseScreen } from "./src/screens/GlucoseScreen";
import { MealScreen } from "./src/screens/MealScreen";
import { ProfileScreen, type DoseProfileFormValues } from "./src/screens/ProfileScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { SubmissionsScreen } from "./src/screens/SubmissionsScreen";
import { loadCustomFoods, loadFavouriteIds, loadRecentIds, RECENTS_LIMIT, saveCustomFoods, saveFavouriteIds, saveRecentIds } from "./src/storage";
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
  | { kind: "create" }
  | { kind: "profile" }
  | { kind: "account" }
  | { kind: "doseReview" }
  | { kind: "submissions" }
  | null;

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
    Promise.all([loadFavouriteIds(), loadRecentIds(), loadCustomFoods(), loadDoseProfile(), loadSession()])
      .then(([loadedFavourites, loadedRecents, loadedCustomFoods, loadedDoseProfile, loadedSession]) => {
        if (cancelled) return;
        setFavouriteIds(loadedFavourites);
        setRecentIds(loadedRecents);
        setCustomFoods(loadedCustomFoods);
        setDoseProfile(loadedDoseProfile.profile);
        setHasSavedDoseProfile(loadedDoseProfile.hasSavedProfile);
        setSession(loadedSession);
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
        {overlay?.kind === "detail" && (
          <DetailScreen
            food={overlay.food}
            isFavourite={favouriteIdSet.has(overlay.food.id)}
            onToggleFavourite={handleToggleFavourite}
            onAdd={handleAddToMeal}
            authToken={session?.token ?? null}
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
