import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { FadeIn } from "../components/FadeIn";
import { PressableScale } from "../components/PressableScale";
import { useLanguage } from "../i18n";
import type { Profile, ProfileKind } from "../profiles";
import { colors, elevation, fontWeights, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

export interface ProfilesScreenProps {
  profiles: Profile[];
  activeProfileId: string;
  onAddProfile: (name: string, kind: ProfileKind) => void;
  onRenameProfile: (id: string, name: string) => void;
  /** Deleting a profile removes ITS data. ../../App.tsx (and ../profiles.ts's
   * `deleteProfile` as a hard backstop) refuses this for the active profile
   * and for the last remaining profile — this screen also never renders the
   * delete action on the active profile's own card. */
  onDeleteProfile: (id: string) => void;
  /** Performs the actual switch (reloading every per-profile store) — called
   * only AFTER this screen's own inline "Mudar para «Nome»?" confirmation. */
  onSwitchProfile: (id: string) => void;
}

// "Perfis" (caregiver profiles) — one device, several LOCAL profiles (the
// caregiver's own "self" profile + any dependents they manage), each with its
// OWN favourites/custom foods/saved meals/Diário/receitas/contribuições/
// Nightscout connection/perfil clínico (see ../profiles.ts + every store it
// namespaces). This screen only edits the profile LIST and requests a
// switch — App.tsx owns the actual reload that follows a confirmed switch (or
// the data wipe that follows a confirmed delete), so there is exactly one
// place that decides what "switching profile" means for every other piece of
// app state. Distinct from ../screens/ProfileScreen.tsx ("Perfil" — home tab
// preference, data export/delete, and the Dose Assist clinical profile),
// which is scoped to the currently active profile only.
export function ProfilesScreen({ profiles, activeProfileId, onAddProfile, onRenameProfile, onDeleteProfile, onSwitchProfile }: ProfilesScreenProps) {
  const { t } = useLanguage();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <FadeIn>
        <Text style={styles.h1}>{t("profiles.title")}</Text>
        <Text style={styles.intro}>{t("profiles.intro")}</Text>
      </FadeIn>

      {profiles.map((profile, index) => (
        <FadeIn key={profile.id} delay={Math.min(index, 6) * 40}>
          <ProfileCard
            profile={profile}
            isActive={profile.id === activeProfileId}
            onRename={onRenameProfile}
            onDelete={onDeleteProfile}
            onSwitch={onSwitchProfile}
          />
        </FadeIn>
      ))}

      <FadeIn delay={Math.min(profiles.length, 6) * 40 + 40}>
        <AddProfileCard onAdd={onAddProfile} />
      </FadeIn>
    </ScrollView>
  );
}

interface ProfileCardProps {
  profile: Profile;
  isActive: boolean;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onSwitch: (id: string) => void;
}

function ProfileCard({ profile, isActive, onRename, onDelete, onSwitch }: ProfileCardProps) {
  const { t } = useLanguage();
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmingSwitch, setConfirmingSwitch] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const createdDate = profile.createdAt.slice(0, 10);
  const kindLabel = profile.kind === "self" ? t("profiles.kindSelf") : t("profiles.kindDependent");

  const handleStartRename = () => {
    setNameDraft(profile.name);
    setRenameError(null);
    setRenaming(true);
  };

  const handleConfirmRename = () => {
    const trimmed = nameDraft.trim();
    if (trimmed.length === 0) {
      setRenameError(t("profiles.renameError"));
      return;
    }
    onRename(profile.id, trimmed);
    setRenaming(false);
  };

  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      {renaming ? (
        <View>
          <Text style={styles.fieldLabel}>{t("profiles.renameLabel")}</Text>
          <TextInput
            style={styles.input}
            value={nameDraft}
            onChangeText={(value) => {
              setNameDraft(value);
              if (renameError) setRenameError(null);
            }}
            accessibilityLabel={t("profiles.renameLabel")}
            autoFocus
          />
          {renameError && <Text style={styles.error}>{renameError}</Text>}
          <View style={styles.actionRow}>
            <PressableScale
              onPress={() => setRenaming(false)}
              accessibilityRole="button"
              accessibilityLabel={t("profiles.renameCancel")}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>{t("profiles.renameCancel")}</Text>
            </PressableScale>
            <PressableScale
              onPress={handleConfirmRename}
              accessibilityRole="button"
              accessibilityLabel={t("profiles.renameSave")}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>{t("profiles.renameSave")}</Text>
            </PressableScale>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.cardHeader}>
            <View style={styles.tile} accessible={false} importantForAccessibility="no-hide-descendants">
              <Text style={styles.tileGlyph}>{profile.kind === "self" ? "🧑" : "🧒"}</Text>
            </View>
            <View style={styles.cardMain}>
              <View style={styles.nameRow}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {profile.name}
                </Text>
                {isActive && (
                  <View style={styles.activeBadge} accessible accessibilityLabel={t("profiles.activeBadge")}>
                    <Text style={styles.activeBadgeText}>{t("profiles.activeBadge")}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardMeta}>{kindLabel}</Text>
              <Text style={styles.cardDate}>{t("profiles.createdAtLabel", { date: createdDate })}</Text>
            </View>
            <PressableScale
              onPress={handleStartRename}
              accessibilityRole="button"
              accessibilityLabel={`${t("profiles.renameCta")}: ${profile.name}`}
              style={styles.renameIconButton}
              hitSlop={4}
            >
              <Text style={styles.renameIconText}>✎</Text>
            </PressableScale>
          </View>

          {confirmingSwitch ? (
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>{t("profiles.switchConfirmTitle", { name: profile.name })}</Text>
              <Text style={styles.confirmBody}>{t("profiles.switchConfirmBody", { name: profile.name })}</Text>
              <View style={styles.actionRow}>
                <PressableScale
                  onPress={() => setConfirmingSwitch(false)}
                  accessibilityRole="button"
                  accessibilityLabel={t("profiles.switchConfirmCancel")}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>{t("profiles.switchConfirmCancel")}</Text>
                </PressableScale>
                <PressableScale
                  onPress={() => {
                    setConfirmingSwitch(false);
                    onSwitch(profile.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("profiles.switchConfirmConfirm")}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>{t("profiles.switchConfirmConfirm")}</Text>
                </PressableScale>
              </View>
            </View>
          ) : confirmingDelete ? (
            <View style={styles.confirmCard}>
              <Text style={[styles.confirmTitle, styles.dangerText]}>{t("profiles.deleteConfirmTitle", { name: profile.name })}</Text>
              <Text style={styles.confirmBody}>{t("profiles.deleteConfirmBody")}</Text>
              <View style={styles.actionRow}>
                <PressableScale
                  onPress={() => setConfirmingDelete(false)}
                  accessibilityRole="button"
                  accessibilityLabel={t("profiles.deleteConfirmCancel")}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>{t("profiles.deleteConfirmCancel")}</Text>
                </PressableScale>
                <PressableScale
                  onPress={() => {
                    setConfirmingDelete(false);
                    onDelete(profile.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("profiles.deleteConfirmConfirm")}
                  style={styles.dangerButton}
                >
                  <Text style={styles.dangerButtonText}>{t("profiles.deleteConfirmConfirm")}</Text>
                </PressableScale>
              </View>
            </View>
          ) : (
            <View style={styles.actionRow}>
              {!isActive && (
                <PressableScale
                  onPress={() => setConfirmingSwitch(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t("profiles.switchCta", { name: profile.name })}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>{t("profiles.switchCta", { name: profile.name })}</Text>
                </PressableScale>
              )}
              {!isActive ? (
                <PressableScale
                  onPress={() => setConfirmingDelete(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t("profiles.deleteCta")}
                  style={styles.dangerOutlineButton}
                  hitSlop={4}
                >
                  <Text style={styles.dangerOutlineButtonText}>{t("profiles.deleteCta")}</Text>
                </PressableScale>
              ) : (
                <Text style={styles.hint}>{t("profiles.deleteActiveHint")}</Text>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

interface AddProfileCardProps {
  onAdd: (name: string, kind: ProfileKind) => void;
}

function AddProfileCard({ onAdd }: AddProfileCardProps) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ProfileKind>("dependent");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError(t("profiles.addErrorName"));
      return;
    }
    onAdd(trimmed, kind);
    setName("");
    setKind("dependent");
    setError(null);
  };

  return (
    <View style={styles.addCard}>
      <Text style={styles.sectionTitle}>{t("profiles.addTitle")}</Text>

      <Text style={styles.fieldLabel}>{t("profiles.addNameLabel")}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={(value) => {
          setName(value);
          if (error) setError(null);
        }}
        placeholder={t("profiles.addNamePlaceholder")}
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={t("profiles.addNameLabel")}
      />
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.fieldLabel}>{t("profiles.addKindLabel")}</Text>
      <View style={styles.kindRow} accessibilityRole="radiogroup" accessibilityLabel={t("profiles.addKindLabel")}>
        <PressableScale
          onPress={() => setKind("self")}
          accessibilityRole="radio"
          accessibilityState={{ selected: kind === "self", checked: kind === "self" }}
          accessibilityLabel={t("profiles.addKindSelf")}
          style={[styles.kindOption, kind === "self" && styles.kindOptionActive]}
        >
          <Text style={[styles.kindOptionText, kind === "self" && styles.kindOptionTextActive]}>{t("profiles.addKindSelf")}</Text>
        </PressableScale>
        <PressableScale
          onPress={() => setKind("dependent")}
          accessibilityRole="radio"
          accessibilityState={{ selected: kind === "dependent", checked: kind === "dependent" }}
          accessibilityLabel={t("profiles.addKindDependent")}
          style={[styles.kindOption, kind === "dependent" && styles.kindOptionActive]}
        >
          <Text style={[styles.kindOptionText, kind === "dependent" && styles.kindOptionTextActive]}>{t("profiles.addKindDependent")}</Text>
        </PressableScale>
      </View>

      <PressableScale onPress={handleAdd} accessibilityRole="button" accessibilityLabel={t("profiles.addCta")} style={styles.primaryButtonWide}>
        <Text style={styles.primaryButtonText}>{t("profiles.addCta")}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingBottom: 40 },
  h1: { fontSize: typeScale.heading.size, fontWeight: fontWeights.extrabold, color: colors.textPrimary },
  intro: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md, lineHeight: 20 },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.xs.native,
  },
  cardActive: { borderColor: colors.brand, borderWidth: 1.5 },
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
  cardMain: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  cardName: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, flexShrink: 1 },
  activeBadge: {
    backgroundColor: colors.confidenceHighBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  activeBadgeText: { fontSize: 11, fontWeight: "800", color: colors.confidenceHigh, letterSpacing: 0.3 },
  renameIconButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  renameIconText: { fontSize: 16, color: colors.textMuted },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  cardDate: { fontSize: 12, color: colors.textFaint, marginTop: 2, marginBottom: spacing.sm },
  hint: { flex: 1, fontSize: 13, color: colors.textFaint, fontStyle: "italic", paddingVertical: spacing.sm },
  fieldLabel: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
  },
  input: {
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
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap", alignItems: "center" },
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
  primaryButtonWide: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    alignSelf: "flex-start",
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
  dangerButton: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  dangerButtonText: { color: colors.onBrand, fontSize: 14, fontWeight: "700" },
  dangerText: { color: colors.danger },
  confirmCard: {
    backgroundColor: colors.confidenceUnverifiedBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  confirmTitle: { fontSize: 15, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.xs },
  confirmBody: { fontSize: 13, color: colors.textSecondary },
  addCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    marginTop: spacing.sm,
    ...elevation.sm.native,
  },
  sectionTitle: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
  },
  kindRow: { flexDirection: "row", gap: spacing.sm },
  kindOption: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  kindOptionActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  kindOptionText: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
  kindOptionTextActive: { color: colors.onBrand },
});
