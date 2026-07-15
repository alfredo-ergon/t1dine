import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { CanonicalFood } from "@t1dine/food-schema";
import type { MealLine } from "@t1dine/nutrition";

import { buildDataExportBundle, formatDataExportJson } from "../dataExport";
import type { DoseProfile } from "../dose/profile";
import type { Language } from "../i18n";
import { useLanguage } from "../i18n";
import { colors, fontSizes, fontWeights, MIN_TAP_TARGET, radius, shadows, spacing } from "../theme";

/** The subset of DoseProfile the "Perfil clínico" form can edit — version and
 * glucoseUnit stay under the app's control (version bumps on every save;
 * glucoseUnit is fixed to mg/dL, matching every bound/label on this form). */
export type DoseProfileFormValues = Pick<
  DoseProfile,
  "carbGramsPerUnit" | "glucosePerCorrectionUnit" | "targetGlucose" | "administrationIncrementUnits" | "maximumEstimateUnits" | "minimumGlucoseToDose"
>;

export interface ProfileScreenProps {
  language: Language;
  favouriteIds: string[];
  recentIds: string[];
  customFoods: CanonicalFood[];
  meal: MealLine[];
  onDeleteAll: () => void;
  doseProfile: DoseProfile;
  hasSavedDoseProfile: boolean;
  onSaveDoseProfile: (updates: DoseProfileFormValues) => void;
}

// Slice 5 — local data rights. Everything here operates purely on-device:
// "export" reads the app's current in-memory state (which mirrors what
// src/storage.ts persists to AsyncStorage) into a JSON view, and "delete"
// clears that same storage plus in-memory state via `onDeleteAll`. Nothing
// in this screen makes a network call.
export function ProfileScreen({
  language,
  favouriteIds,
  recentIds,
  customFoods,
  meal,
  onDeleteAll,
  doseProfile,
  hasSavedDoseProfile,
  onSaveDoseProfile,
}: ProfileScreenProps) {
  const { t } = useLanguage();
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const hasAnyData = favouriteIds.length > 0 || recentIds.length > 0 || customFoods.length > 0 || meal.length > 0;

  const handleExport = () => {
    const bundle = buildDataExportBundle({ language, favouriteIds, recentIds, customFoods, meal });
    setExportJson(formatDataExportJson(bundle));
  };

  const handleConfirmDelete = () => {
    onDeleteAll();
    setConfirmingDelete(false);
    setExportJson(null);
    setDeleted(true);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.h1}>{t("profile.title")}</Text>

      <DoseProfileSection profile={doseProfile} hasSavedProfile={hasSavedDoseProfile} onSave={onSaveDoseProfile} />

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>{t("profile.exportTitle")}</Text>
      <Text style={styles.body}>{t("profile.exportBody")}</Text>
      <Pressable
        onPress={handleExport}
        accessibilityRole="button"
        accessibilityLabel={t("profile.exportButton")}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
      >
        <Text style={styles.primaryButtonText}>{t("profile.exportButton")}</Text>
      </Pressable>

      {exportJson !== null &&
        (hasAnyData ? (
          <TextInput
            style={styles.exportBox}
            value={exportJson}
            editable={false}
            multiline
            selectTextOnFocus
            accessibilityLabel={t("profile.exportTitle")}
          />
        ) : (
          <Text style={styles.body}>{t("profile.exportEmpty")}</Text>
        ))}

      <View style={styles.divider} />

      <Text style={[styles.sectionTitle, styles.dangerTitle]}>{t("profile.deleteTitle")}</Text>
      <Text style={styles.body}>{t("profile.deleteBody")}</Text>

      {deleted ? (
        <View style={styles.successBanner} accessible accessibilityLabel={t("profile.deleteSuccess")}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successText}>{t("profile.deleteSuccess")}</Text>
        </View>
      ) : confirmingDelete ? (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>{t("profile.deleteConfirmTitle")}</Text>
          <Text style={styles.body}>{t("profile.deleteConfirmBody")}</Text>
          <View style={styles.confirmRow}>
            <Pressable
              onPress={() => setConfirmingDelete(false)}
              accessibilityRole="button"
              accessibilityLabel={t("profile.deleteConfirmCancel")}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
            >
              <Text style={styles.cancelButtonText}>{t("profile.deleteConfirmCancel")}</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirmDelete}
              accessibilityRole="button"
              accessibilityLabel={t("profile.deleteConfirmConfirm")}
              style={({ pressed }) => [styles.dangerButton, pressed && styles.dangerButtonPressed]}
            >
              <Text style={styles.dangerButtonText}>{t("profile.deleteConfirmConfirm")}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setConfirmingDelete(true)}
          accessibilityRole="button"
          accessibilityLabel={t("profile.deleteButton")}
          style={({ pressed }) => [styles.dangerOutlineButton, pressed && styles.dangerOutlineButtonPressed]}
        >
          <Text style={styles.dangerOutlineButtonText}>{t("profile.deleteButton")}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

interface DoseProfileSectionProps {
  profile: DoseProfile;
  /** False until the user has explicitly saved a profile — drives the first-run nudge. */
  hasSavedProfile: boolean;
  onSave: (updates: DoseProfileFormValues) => void;
}

interface DoseProfileFormErrors {
  carbRatio?: string;
  correctionFactor?: string;
  target?: string;
  maxDose?: string;
  hypoThreshold?: string;
}

// "Perfil clínico" — the configurable settings behind the Dose Assist
// estimate (never a calculation itself). Values are edited as local draft
// text so the user can type freely; nothing is persisted until "Guardar
// perfil clínico" is pressed, at which point the parent (App) merges the
// validated values into the full DoseProfile, bumps its version, and
// persists it — so every saved change produces a fresh, distinct version for
// the dose calculation's audit record.
function DoseProfileSection({ profile, hasSavedProfile, onSave }: DoseProfileSectionProps) {
  const { t } = useLanguage();
  const [carbRatioText, setCarbRatioText] = useState(String(profile.carbGramsPerUnit));
  const [correctionFactorText, setCorrectionFactorText] = useState(String(profile.glucosePerCorrectionUnit));
  const [targetText, setTargetText] = useState(String(profile.targetGlucose));
  const [increment, setIncrement] = useState(profile.administrationIncrementUnits);
  const [maxDoseText, setMaxDoseText] = useState(String(profile.maximumEstimateUnits));
  const [hypoThresholdText, setHypoThresholdText] = useState(String(profile.minimumGlucoseToDose));
  const [errors, setErrors] = useState<DoseProfileFormErrors>({});
  const [saved, setSaved] = useState(false);

  // Re-sync the draft fields whenever the authoritative (saved) profile
  // version changes — e.g. right after a successful save — without
  // clobbering in-progress typing between saves (mirrors MealScreen's
  // "re-sync from the authoritative value" pattern for its amount field).
  useEffect(() => {
    setCarbRatioText(String(profile.carbGramsPerUnit));
    setCorrectionFactorText(String(profile.glucosePerCorrectionUnit));
    setTargetText(String(profile.targetGlucose));
    setIncrement(profile.administrationIncrementUnits);
    setMaxDoseText(String(profile.maximumEstimateUnits));
    setHypoThresholdText(String(profile.minimumGlucoseToDose));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.version]);

  const handleSave = () => {
    const parse = (text: string) => Number(text.trim().replace(",", "."));
    const carbRatio = parse(carbRatioText);
    const correctionFactor = parse(correctionFactorText);
    const target = parse(targetText);
    const maxDose = parse(maxDoseText);
    const hypoThreshold = parse(hypoThresholdText);
    const isPositive = (value: number) => Number.isFinite(value) && value > 0;

    const nextErrors: DoseProfileFormErrors = {};
    if (!isPositive(carbRatio)) nextErrors.carbRatio = t("profile.clinicalErrorPositive");
    if (!isPositive(correctionFactor)) nextErrors.correctionFactor = t("profile.clinicalErrorPositive");
    if (!isPositive(target)) nextErrors.target = t("profile.clinicalErrorPositive");
    if (!isPositive(maxDose)) nextErrors.maxDose = t("profile.clinicalErrorPositive");
    if (!isPositive(hypoThreshold)) nextErrors.hypoThreshold = t("profile.clinicalErrorPositive");

    setErrors(nextErrors);
    setSaved(false);
    if (Object.keys(nextErrors).length > 0) return;

    onSave({
      carbGramsPerUnit: carbRatio,
      glucosePerCorrectionUnit: correctionFactor,
      targetGlucose: target,
      administrationIncrementUnits: increment,
      maximumEstimateUnits: maxDose,
      minimumGlucoseToDose: hypoThreshold,
    });
    setSaved(true);
  };

  return (
    <View>
      <Text style={styles.sectionTitle}>{t("profile.clinicalTitle")}</Text>
      <Text style={styles.body}>{t("profile.clinicalIntro")}</Text>

      {!hasSavedProfile && (
        <View style={styles.nudgeBanner} accessible accessibilityLabel={t("profile.clinicalNudge")}>
          <Text style={styles.nudgeIcon}>ⓘ</Text>
          <Text style={styles.nudgeText}>{t("profile.clinicalNudge")}</Text>
        </View>
      )}

      <Text style={styles.fieldLabel}>{t("profile.clinicalCarbRatioLabel")}</Text>
      <TextInput
        style={styles.fieldInput}
        value={carbRatioText}
        onChangeText={setCarbRatioText}
        keyboardType="numeric"
        accessibilityLabel={t("profile.clinicalCarbRatioLabel")}
      />
      {errors.carbRatio && <Text style={styles.error}>{errors.carbRatio}</Text>}

      <Text style={styles.fieldLabel}>{t("profile.clinicalCorrectionFactorLabel")}</Text>
      <TextInput
        style={styles.fieldInput}
        value={correctionFactorText}
        onChangeText={setCorrectionFactorText}
        keyboardType="numeric"
        accessibilityLabel={t("profile.clinicalCorrectionFactorLabel")}
      />
      {errors.correctionFactor && <Text style={styles.error}>{errors.correctionFactor}</Text>}

      <Text style={styles.fieldLabel}>{t("profile.clinicalTargetLabel")}</Text>
      <TextInput
        style={styles.fieldInput}
        value={targetText}
        onChangeText={setTargetText}
        keyboardType="numeric"
        accessibilityLabel={t("profile.clinicalTargetLabel")}
      />
      {errors.target && <Text style={styles.error}>{errors.target}</Text>}

      <Text style={styles.fieldLabel}>{t("profile.clinicalIncrementLabel")}</Text>
      <View style={styles.incrementRow} accessibilityRole="radiogroup" accessibilityLabel={t("profile.clinicalIncrementLabel")}>
        <Pressable
          onPress={() => setIncrement(0.5)}
          accessibilityRole="radio"
          accessibilityState={{ selected: increment === 0.5, checked: increment === 0.5 }}
          accessibilityLabel={t("profile.clinicalIncrementHalf")}
          style={[styles.incrementOption, increment === 0.5 && styles.incrementOptionActive]}
        >
          <Text style={[styles.incrementOptionText, increment === 0.5 && styles.incrementOptionTextActive]}>
            {t("profile.clinicalIncrementHalf")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setIncrement(1)}
          accessibilityRole="radio"
          accessibilityState={{ selected: increment === 1, checked: increment === 1 }}
          accessibilityLabel={t("profile.clinicalIncrementWhole")}
          style={[styles.incrementOption, increment === 1 && styles.incrementOptionActive]}
        >
          <Text style={[styles.incrementOptionText, increment === 1 && styles.incrementOptionTextActive]}>
            {t("profile.clinicalIncrementWhole")}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.fieldLabel}>{t("profile.clinicalMaxDoseLabel")}</Text>
      <TextInput
        style={styles.fieldInput}
        value={maxDoseText}
        onChangeText={setMaxDoseText}
        keyboardType="numeric"
        accessibilityLabel={t("profile.clinicalMaxDoseLabel")}
      />
      {errors.maxDose && <Text style={styles.error}>{errors.maxDose}</Text>}

      <Text style={styles.fieldLabel}>{t("profile.clinicalHypoThresholdLabel")}</Text>
      <TextInput
        style={styles.fieldInput}
        value={hypoThresholdText}
        onChangeText={setHypoThresholdText}
        keyboardType="numeric"
        accessibilityLabel={t("profile.clinicalHypoThresholdLabel")}
      />
      {errors.hypoThreshold && <Text style={styles.error}>{errors.hypoThreshold}</Text>}

      <Text style={styles.versionCaption}>
        {t("profile.clinicalVersionLabel")}: {profile.version}
      </Text>

      <Pressable
        onPress={handleSave}
        accessibilityRole="button"
        accessibilityLabel={t("profile.clinicalSaveButton")}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
      >
        <Text style={styles.primaryButtonText}>{t("profile.clinicalSaveButton")}</Text>
      </Pressable>

      {saved && (
        <View style={[styles.successBanner, styles.clinicalSuccessSpacing]} accessible accessibilityLabel={t("profile.clinicalSaveSuccess")}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successText}>{t("profile.clinicalSaveSuccess")}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingBottom: 40 },
  h1: { fontSize: fontSizes.xl, fontWeight: fontWeights.extrabold, color: colors.textPrimary, marginBottom: spacing.sm },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textFaint,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dangerTitle: { color: colors.danger },
  body: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13, marginTop: 4 },
  primaryButton: {
    minHeight: MIN_TAP_TARGET,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    ...shadows.card.native,
  },
  primaryButtonPressed: { backgroundColor: colors.accentPressed },
  primaryButtonText: { color: colors.onBrand, fontSize: 15, fontWeight: "700" },
  exportBox: {
    marginTop: spacing.md,
    minHeight: 160,
    maxHeight: 260,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    padding: spacing.sm,
    fontSize: 12,
    fontFamily: "monospace",
    textAlignVertical: "top",
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: spacing.xl },
  successBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.confidenceHighBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "flex-start",
  },
  successIcon: { color: colors.confidenceHigh, fontSize: 16, fontWeight: "700" },
  successText: { flex: 1, fontSize: 14, color: colors.textSecondary, fontWeight: "600" },
  confirmCard: {
    backgroundColor: colors.confidenceUnverifiedBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
  },
  confirmTitle: { fontSize: 15, fontWeight: "800", color: colors.danger, marginBottom: spacing.xs },
  confirmRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  cancelButton: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  cancelButtonPressed: { backgroundColor: colors.accentSoft },
  cancelButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  dangerButton: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  dangerButtonPressed: { opacity: 0.85 },
  dangerButtonText: { color: colors.onBrand, fontSize: 15, fontWeight: "700" },
  dangerOutlineButton: {
    minHeight: MIN_TAP_TARGET,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  dangerOutlineButtonPressed: { backgroundColor: colors.confidenceUnverifiedBg },
  dangerOutlineButtonText: { color: colors.danger, fontSize: 15, fontWeight: "700" },

  nudgeBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.confidenceMediumBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: "flex-start",
  },
  nudgeIcon: { color: colors.confidenceMedium, fontSize: 16, fontWeight: "700" },
  nudgeText: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textFaint,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    minHeight: MIN_TAP_TARGET,
  },
  incrementRow: { flexDirection: "row", gap: spacing.sm },
  incrementOption: {
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
  incrementOptionActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  incrementOptionText: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
  incrementOptionTextActive: { color: colors.onBrand },
  versionCaption: { fontSize: 12, color: colors.textFaint, marginTop: spacing.md, marginBottom: spacing.sm },
  clinicalSuccessSpacing: { marginTop: spacing.sm },
});
