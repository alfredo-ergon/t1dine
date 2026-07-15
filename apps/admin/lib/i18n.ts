// Centralised UI copy. Portuguese (pt-PT) is the default and only language today
// — this is an internal PT curation tool. Copy is kept here (not inlined in
// components) so an EN toggle can be added later without touching the views.

import type { ConfidenceLevel } from "@t1dine/domain";
import type { FoodStatus, FoodType } from "@t1dine/food-schema";
import type { DataQualityFlag } from "./catalog";

export const t = {
  brand: "T1Dine",
  brandSuffix: "Curadoria",
  nav: {
    dashboard: "Painel",
    foods: "Alimentos",
    sources: "Fontes",
  },
  common: {
    synthetic: "Dados sintéticos — não são dados reais nem clínicos.",
    market: "Mercado",
    licence: "Licença",
    cadence: "Cadência",
    source: "Fonte",
  },
  dataSource: {
    api: "Dados: API em direto",
    local: "Dados: locais (API indisponível)",
  },
  dashboard: {
    title: "Painel",
    eyebrow: "Portal de curadoria",
    lede: "Visão geral do catálogo de curadoria de alimentos para Portugal. Todos os valores são sintéticos.",
    totalFoods: "Alimentos",
    sources: "Fontes",
    failing: "Falham validação",
    byStatus: "Por estado",
    byConfidence: "Por confiança",
  },
  foods: {
    title: "Alimentos",
    lede: "Reveja alimentos candidatos, a confiança e a proveniência antes de aprovar. As decisões abaixo são apenas demonstração.",
    mockWarning:
      "Aprovar/Rejeitar altera apenas o estado local desta sessão. Nada é persistido nem enviado para qualquer serviço.",
    filterStatus: "Filtrar por estado",
    filterConfidence: "Filtrar por confiança",
    all: "Todos",
    showing: "A mostrar",
    of: "de",
    emptyTitle: "Nenhum alimento corresponde aos filtros",
    emptyHint: "Ajuste o estado ou a confiança para ver mais resultados.",
    columns: {
      name: "Nome (pt-PT)",
      type: "Tipo",
      status: "Estado",
      confidence: "Confiança",
      carb: "HC /100 g",
      energy: "Energia /100 g",
      source: "Fonte",
      licence: "Licença",
      quality: "Qualidade",
      actions: "Ações",
    },
    approve: "Aprovar",
    reject: "Rejeitar",
    reset: "Repor",
    details: "Detalhes",
    hideDetails: "Ocultar",
    decidedApproved: "Aprovado (local)",
    decidedRejected: "Rejeitado (local)",
    provenanceTitle: "Proveniência",
    sourceId: "ID da fonte",
    sourceRecordId: "Registo de origem",
    version: "Versão",
    mappingVersion: "Versão do mapeamento",
    digest: "Resumo (SHA-256)",
    retrievedAt: "Obtido em",
    validationErrors: "Erros de validação",
  },
  sources: {
    title: "Fontes",
    lede: "Registo das fontes de dados alimentares sintéticas e respetivas licenças e cadências.",
    columns: {
      id: "ID",
      name: "Nome",
      market: "Mercado",
      licence: "Licença",
      cadence: "Cadência",
      foodCount: "N.º de alimentos",
    },
  },
} as const;

export const STATUS_LABELS: Record<FoodStatus, string> = {
  candidate: "Candidato",
  approved: "Aprovado",
  retired: "Retirado",
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
  unverified: "Não verificada",
};

export const DATA_QUALITY_LABELS: Record<DataQualityFlag, string> = {
  ok: "OK",
  warning: "A rever",
  invalid: "Inválido",
};

export const FOOD_TYPE_LABELS: Record<FoodType, string> = {
  ingredient: "Ingrediente",
  packaged: "Embalado",
  restaurant: "Restauração",
  recipe: "Receita",
  custom: "Personalizado",
};

/** Chip colour variants (CSS class suffix). Colour is always paired with text. */
export type ChipVariant =
  | "ok"
  | "warn"
  | "danger"
  | "neutral"
  | "accent"
  | "confidence-high"
  | "confidence-medium"
  | "confidence-low"
  | "confidence-unverified";

export function statusChipVariant(status: FoodStatus): ChipVariant {
  switch (status) {
    case "approved":
      return "ok";
    case "candidate":
      return "accent";
    case "retired":
      return "neutral";
  }
}

/** Confidence uses the dedicated confidence tokens (four distinct, ordered steps). */
export function confidenceChipVariant(confidence: ConfidenceLevel): ChipVariant {
  switch (confidence) {
    case "high":
      return "confidence-high";
    case "medium":
      return "confidence-medium";
    case "low":
      return "confidence-low";
    case "unverified":
      return "confidence-unverified";
  }
}

export function dataQualityChipVariant(quality: DataQualityFlag): ChipVariant {
  switch (quality) {
    case "ok":
      return "ok";
    case "warning":
      return "warn";
    case "invalid":
      return "danger";
  }
}
