import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { FadeIn } from "../components/FadeIn";
import { PressableScale } from "../components/PressableScale";
import type { CustomFoodInput } from "../customFood";
import { useLanguage } from "../i18n";
import { colors, elevation, fontWeights, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

export interface CreateFoodScreenProps {
  onCancel: () => void;
  onSubmit: (input: CustomFoodInput) => void;
}

interface FormErrors {
  namePt?: string;
  carb?: string;
  energy?: string;
}

export function CreateFoodScreen({ onCancel, onSubmit }: CreateFoodScreenProps) {
  const { t } = useLanguage();
  const [namePt, setNamePt] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [carbText, setCarbText] = useState("");
  const [energyText, setEnergyText] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const handleSubmit = () => {
    const carbValue = Number(carbText.replace(",", "."));
    const energyValue = Number(energyText.replace(",", "."));
    const nextErrors: FormErrors = {};

    if (namePt.trim().length === 0) nextErrors.namePt = t("create.errorNamePt");
    if (!Number.isFinite(carbValue) || carbValue < 0) nextErrors.carb = t("create.errorCarb");
    if (!Number.isFinite(energyValue) || energyValue < 0) nextErrors.energy = t("create.errorEnergy");

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({ namePt: namePt.trim(), nameEn: nameEn.trim(), carbPer100g: carbValue, energyPer100gKcal: energyValue });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <FadeIn>
        <Text style={styles.h1}>{t("create.title")}</Text>
        <View style={styles.notice} accessible accessibilityLabel={t("create.unverifiedNotice")}>
          <Text style={styles.noticeIcon}>◌</Text>
          <Text style={styles.noticeText}>{t("create.unverifiedNotice")}</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>{t("create.namePtLabel")}</Text>
          <TextInput
            style={styles.input}
            value={namePt}
            onChangeText={setNamePt}
            placeholder={t("create.namePtPlaceholder")}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={t("create.namePtLabel")}
          />
          {errors.namePt && <Text style={styles.error}>{errors.namePt}</Text>}

          <Text style={styles.label}>{t("create.nameEnLabel")}</Text>
          <TextInput
            style={styles.input}
            value={nameEn}
            onChangeText={setNameEn}
            placeholder={t("create.nameEnPlaceholder")}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={t("create.nameEnLabel")}
          />

          <Text style={styles.label}>{t("create.carbLabel")}</Text>
          <TextInput
            style={styles.input}
            value={carbText}
            onChangeText={setCarbText}
            keyboardType="numeric"
            accessibilityLabel={t("create.carbLabel")}
          />
          {errors.carb && <Text style={styles.error}>{errors.carb}</Text>}

          <Text style={styles.label}>{t("create.energyLabel")}</Text>
          <TextInput
            style={styles.input}
            value={energyText}
            onChangeText={setEnergyText}
            keyboardType="numeric"
            accessibilityLabel={t("create.energyLabel")}
          />
          {errors.energy && <Text style={styles.error}>{errors.energy}</Text>}
        </View>

        <View style={styles.buttonRow}>
          <PressableScale onPress={onCancel} accessibilityRole="button" accessibilityLabel={t("create.cancelButton")} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>{t("create.cancelButton")}</Text>
          </PressableScale>
          <PressableScale onPress={handleSubmit} accessibilityRole="button" accessibilityLabel={t("create.saveButton")} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>{t("create.saveButton")}</Text>
          </PressableScale>
        </View>
      </FadeIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingBottom: 40 },
  h1: { fontSize: typeScale.heading.size, fontWeight: fontWeights.extrabold, color: colors.textPrimary, marginBottom: spacing.sm },
  notice: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.confidenceUnverifiedBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeIcon: { color: colors.confidenceUnverified, fontSize: 16, fontWeight: "700" },
  noticeText: { flex: 1, fontSize: 13, color: colors.textSecondary },
  formCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    ...elevation.sm.native,
  },
  label: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.textFaint,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
  },
  input: {
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
  error: { color: colors.danger, fontSize: 13, marginTop: 4 },
  buttonRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xxl },
  cancelButton: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cancelButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  saveButton: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    ...elevation.sm.native,
  },
  saveButtonText: { color: colors.onBrand, fontSize: 16, fontWeight: "700" },
});
