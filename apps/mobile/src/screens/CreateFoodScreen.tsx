import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { FadeIn } from "../components/FadeIn";
import { PressableScale } from "../components/PressableScale";
import type { CustomFoodInput } from "../customFood";
import { useLanguage } from "../i18n";
import { colors, elevation, fontWeights, gradients, MIN_TAP_TARGET, radius, spacing, typeScale } from "../theme";

export interface CreateFoodScreenProps {
  onCancel: () => void;
  onSubmit: (input: CustomFoodInput) => void;
  /** Pre-fills a scanned/typed barcode from the barcode "not found" fallback
   * (BarcodeScanScreen) so the food created here becomes findable by that
   * exact code next time. `null`/undefined for the normal "+ Novo alimento"
   * entry point, which has no barcode context. Shown read-only — the user
   * cannot edit a scanned code from this form. */
  prefillBarcode?: string | null;
}

interface FormErrors {
  namePt?: string;
  carb?: string;
  energy?: string;
}

export function CreateFoodScreen({ onCancel, onSubmit, prefillBarcode = null }: CreateFoodScreenProps) {
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

    onSubmit({
      namePt: namePt.trim(),
      nameEn: nameEn.trim(),
      carbPer100g: carbValue,
      energyPer100gKcal: energyValue,
      ...(prefillBarcode ? { barcode: prefillBarcode } : {}),
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <FadeIn>
        <Text style={styles.h1}>{t("create.title")}</Text>
        <View style={styles.notice} accessible accessibilityLabel={t("create.unverifiedNotice")}>
          <Text style={styles.noticeIcon}>◌</Text>
          <Text style={styles.noticeText}>{t("create.unverifiedNotice")}</Text>
        </View>

        {prefillBarcode && (
          <View
            style={styles.barcodeNotice}
            accessible
            accessibilityLabel={`${t("create.barcodeLabel")}: ${prefillBarcode}. ${t("create.barcodePrefillNote")}`}
          >
            <Text style={styles.barcodeNoticeIcon}>▤</Text>
            <View style={styles.barcodeNoticeTextWrap}>
              <Text style={styles.barcodeNoticeLabel}>{t("create.barcodeLabel")}</Text>
              <Text style={styles.barcodeNoticeValue}>{prefillBarcode}</Text>
              <Text style={styles.barcodeNoticeHint}>{t("create.barcodePrefillNote")}</Text>
            </View>
          </View>
        )}

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
          <PressableScale onPress={handleSubmit} accessibilityRole="button" accessibilityLabel={t("create.saveButton")} style={styles.saveButtonWrap}>
            <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={styles.saveButtonGradient}>
              <Text style={styles.saveButtonText}>{t("create.saveButton")}</Text>
            </LinearGradient>
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
  barcodeNotice: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.brandTint,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brand,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: "flex-start",
  },
  barcodeNoticeIcon: { color: colors.brandDark, fontSize: 20 },
  barcodeNoticeTextWrap: { flex: 1 },
  barcodeNoticeLabel: {
    fontSize: typeScale.overline.size,
    fontWeight: typeScale.overline.weight,
    color: colors.brandDark,
    textTransform: "uppercase",
    letterSpacing: typeScale.overline.letterSpacing,
  },
  barcodeNoticeValue: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginTop: 2, fontVariant: ["tabular-nums"] },
  barcodeNoticeHint: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
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
  saveButtonWrap: {
    flex: 1,
    borderRadius: radius.pill,
    ...elevation.glow.native,
  },
  saveButtonGradient: {
    minHeight: MIN_TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  saveButtonText: { color: colors.onBrand, fontSize: 16, fontWeight: "700" },
});
