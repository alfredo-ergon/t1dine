// The ONLY module in the mobile app permitted to import the dose engine
// (enforced by the dependency-cruiser isolation guard). It maps a user's
// profile + the current meal/glucose into the engine's input and returns the
// deterministic result. It also centralises the Portuguese/English safety copy
// for every "blocked" reason so the UI can present a clear, non-alarming
// message and NEVER a number when the engine fails closed.
//
// Nothing here is AI. Nothing here is a medical recommendation. The result is
// an estimate that the user must review and confirm with their diabetes team.

import { calculateDoseEstimate, type DoseEstimateInput, type DoseEstimateResult } from "@t1dine/dose-engine";

import type { DoseProfile } from "./profile";

export type { DoseEstimateResult } from "@t1dine/dose-engine";

export interface EstimateDoseParams {
  /** Confirmed available carbohydrate for the meal, in grams. */
  totalCarbGrams: number;
  /** Current blood glucose, in the profile's unit. */
  glucoseValue: number;
  /** Active insulin on board, in units (the user states it; 0 if none). */
  activeInsulinUnits: number;
  profile: DoseProfile;
  /** ISO timestamps; default to "now" from the caller (kept injectable/testable). */
  glucoseMeasuredAtIso: string;
  calculatedAtIso: string;
}

export function estimateDose(params: EstimateDoseParams): DoseEstimateResult {
  const input: DoseEstimateInput = {
    confirmedCarbohydrateGrams: params.totalCarbGrams,
    glucoseValue: params.glucoseValue,
    glucoseUnit: params.profile.glucoseUnit,
    glucoseMeasuredAt: params.glucoseMeasuredAtIso,
    calculatedAt: params.calculatedAtIso,
    targetGlucose: params.profile.targetGlucose,
    carbGramsPerUnit: params.profile.carbGramsPerUnit,
    glucosePerCorrectionUnit: params.profile.glucosePerCorrectionUnit,
    activeInsulinUnits: params.activeInsulinUnits,
    administrationIncrementUnits: params.profile.administrationIncrementUnits,
    maximumEstimateUnits: params.profile.maximumEstimateUnits,
    minimumGlucoseToDose: params.profile.minimumGlucoseToDose,
    profileVersion: params.profile.version,
  };
  return calculateDoseEstimate(input);
}

const REASON_TEXT: Record<string, { pt: string; en: string }> = {
  "invalid-carb-ratio": { pt: "Rácio de hidratos inválido no perfil.", en: "Invalid carb ratio in profile." },
  "invalid-correction-factor": { pt: "Fator de correção inválido no perfil.", en: "Invalid correction factor in profile." },
  "invalid-administration-increment": { pt: "Incremento da caneta inválido no perfil.", en: "Invalid pen increment in profile." },
  "invalid-maximum-estimate": { pt: "Dose máxima inválida no perfil.", en: "Invalid maximum dose in profile." },
  "missing-profile-version": { pt: "Perfil de dose não configurado.", en: "Dose profile is not configured." },
  "invalid-glucose-unit": { pt: "Unidade de glicemia inválida.", en: "Invalid glucose unit." },
  "invalid-carbohydrate": { pt: "Valor de hidratos inválido.", en: "Invalid carbohydrate value." },
  "carbohydrate-implausible": { pt: "Valor de hidratos demasiado alto — verifique.", en: "Carbohydrate value too high — please check." },
  "active-insulin-unknown-or-invalid": {
    pt: "Insulina ativa não indicada. Indique a insulina ativa (0 se não tiver).",
    en: "Active insulin not provided. Enter active insulin (0 if none).",
  },
  "invalid-timestamp": { pt: "Data/hora inválida.", en: "Invalid timestamp." },
  "glucose-timestamp-in-future": { pt: "A leitura de glicemia tem data futura.", en: "The glucose reading is future-dated." },
  "glucose-out-of-plausible-range": { pt: "Glicemia fora do intervalo plausível — verifique.", en: "Glucose out of plausible range — please check." },
  "invalid-target-glucose": { pt: "Alvo de glicemia inválido no perfil.", en: "Invalid target glucose in profile." },
  "invalid-hypo-threshold": { pt: "Limiar de hipoglicemia inválido no perfil.", en: "Invalid hypo threshold in profile." },
  "glucose-below-safe-threshold": {
    pt: "Glicemia baixa (hipoglicemia). Trate primeiro a hipoglicemia — não é indicada insulina. Confirme com a sua equipa de diabetes.",
    en: "Low glucose (hypoglycaemia). Treat the low first — no insulin is suggested. Confirm with your diabetes team.",
  },
  "calculated-value-not-finite": { pt: "Não foi possível calcular. Verifique os valores.", en: "Could not calculate. Please check the values." },
  "calculated-value-below-zero": {
    pt: "O cálculo dá um valor negativo. Não é indicada insulina agora. Confirme com a sua equipa.",
    en: "The calculation is negative. No insulin is suggested now. Confirm with your team.",
  },
  "calculated-value-exceeds-maximum": {
    pt: "O valor calculado excede a dose máxima do seu perfil. Confirme com a sua equipa.",
    en: "The calculated value exceeds your profile's maximum dose. Confirm with your team.",
  },
};

/** Human-readable, non-alarming message for a "blocked" reason code. Defaults to a safe generic. */
export function describeDoseBlockReason(reason: string, language: "pt" | "en" = "pt"): string {
  const entry = REASON_TEXT[reason];
  if (!entry) {
    return language === "pt"
      ? "Não é possível estimar a dose com os valores atuais. Confirme com a sua equipa."
      : "Cannot estimate a dose with the current values. Confirm with your team.";
  }
  return entry[language];
}
