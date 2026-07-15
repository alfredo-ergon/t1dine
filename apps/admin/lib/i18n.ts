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
    areas: "Áreas",
    review: "Revisão",
    add: "Adicionar",
    ai: "IA",
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
  auth: {
    title: "Sessão de curador",
    lede: "Inicie sessão com uma conta de curadoria para rever, adicionar e gerar alimentos.",
    email: "Email",
    password: "Palavra-passe",
    submit: "Iniciar sessão",
    submitting: "A iniciar sessão…",
    hint: "Conta de demonstração:",
    checking: "A verificar sessão…",
    genericError: "Não foi possível iniciar sessão. Tente novamente.",
  },
  curator: {
    active: "Sessão de curador",
    logout: "Terminar sessão",
  },
  review: {
    title: "Fila de revisão",
    lede: "Alimentos candidatos submetidos por utilizadores e gerados por IA. Reveja a proveniência e a validação antes de aprovar ou rejeitar. As ações abaixo são reais e alteram o estado no servidor.",
    aiNote:
      "Os alimentos gerados por IA entram aqui como candidatos e nunca são publicados automaticamente — só ficam visíveis no catálogo depois de aprovados por um curador.",
    filterSource: "Filtrar por origem",
    filterRegion: "Filtrar por área",
    allSources: "Todas as origens",
    allRegions: "Todas as áreas",
    reload: "Recarregar",
    reloading: "A recarregar…",
    loading: "A carregar candidatos…",
    showing: "A mostrar",
    of: "de",
    candidates: "candidatos",
    emptyTitle: "Sem candidatos para rever",
    emptyHint: "Não há alimentos candidatos que correspondam a estes filtros. Gere alguns em IA ou aguarde submissões.",
    approve: "Aprovar",
    reject: "Rejeitar",
    approving: "A aprovar…",
    rejecting: "A rejeitar…",
    approvedToast: "Aprovado e publicado no catálogo.",
    rejectedToast: "Rejeitado (retirado, mantido para auditoria).",
    columns: {
      name: "Nome (pt-PT)",
      source: "Origem",
      region: "Área",
      confidence: "Confiança",
      carb: "HC /100 g",
      energy: "Energia /100 g",
      validation: "Validação",
      actions: "Ações",
    },
    valid: "Válido",
    invalid: "Inválido",
    provenance: "Proveniência",
    unknownRegion: "Sem área",
  },
  add: {
    title: "Adicionar alimento",
    lede: "Adicione manualmente um alimento ao catálogo. Uma adição de curador é publicada como aprovada. Todos os valores são sintéticos.",
    namePt: "Nome (pt-PT)",
    nameEn: "Nome (en)",
    country: "País (ISO, ex.: PT)",
    type: "Tipo",
    carb: "Hidratos de carbono /100 g",
    energy: "Energia /100 g (kcal)",
    cuisine: "Etiquetas de cozinha (separadas por vírgulas)",
    cuisineHint: "A cozinha é um eixo separado da área geográfica.",
    mediterranean: "Cozinha mediterrânica",
    mediterraneanHint: "Adiciona a etiqueta de cozinha «mediterrânica».",
    submit: "Adicionar ao catálogo",
    submitting: "A adicionar…",
    successTitle: "Alimento adicionado",
    successBody: "foi criado e aprovado.",
    seeInFoods: "Ver em Alimentos",
    addAnother: "Adicionar outro",
    validationTitle: "Corrija os seguintes campos:",
    required: "Preencha o nome (pt-PT e en) e um país válido.",
  },
  ai: {
    title: "Gerar com IA",
    lede: "Gere alimentos candidatos assistidos por IA para uma área, cozinha ou país.",
    warningTitle: "Os resultados de IA são candidatos, não dados aprovados",
    warningBody:
      "Cada alimento gerado entra na Fila de revisão como candidato com confiança «não verificada». Nunca é publicado automaticamente — um curador tem de o rever e aprovar. A IA nunca faz parte do cálculo de dose.",
    region: "Área (opcional)",
    cuisine: "Cozinha (opcional)",
    country: "País (opcional, ISO)",
    count: "Quantidade (1–20)",
    anyRegion: "Qualquer área",
    cuisineHint: "Sugestões:",
    submit: "Gerar candidatos",
    submitting: "A gerar…",
    resultTitle: "candidatos gerados",
    resultBody: "Foram criados como candidatos na Fila de revisão. Reveja e aprove antes de publicar.",
    goToReview: "Ir para a Fila de revisão",
    generateMore: "Gerar mais",
    countError: "A quantidade tem de estar entre 1 e 20.",
  },
  areas: {
    title: "Explorar por área",
    lede: "Navegue pelos alimentos aprovados por continente e área geográfica. A área é derivada do país do alimento.",
    axisNote:
      "«Mediterrânica» (Sul da Europa) é uma ÁREA geográfica. As etiquetas de cozinha (incluindo a dieta mediterrânica) são um eixo separado guardado em cada alimento.",
    filterArea: "Área",
    allAreas: "Todas as áreas",
    mediterraneanBadge: "Mediterrânica",
    loading: "A carregar catálogo…",
    error: "Não foi possível carregar o catálogo. Confirme que a API está disponível.",
    foods: "alimentos",
    noneInArea: "Sem alimentos aprovados nesta área.",
    noneTitle: "Sem alimentos aprovados",
    noneHint: "Ainda não há alimentos aprovados para mostrar por área.",
    columns: {
      name: "Nome (pt-PT)",
      type: "Tipo",
      country: "País",
      cuisine: "Cozinha",
      carb: "HC /100 g",
      energy: "Energia /100 g",
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

/** Where a stored/submitted food originated (the review-queue "Origem" chip).
 * Kept in step with `FoodSource` in `app/lib/adminApi.ts`. */
export const SUBMISSION_SOURCE_LABELS: Record<"seed" | "user" | "ai" | "admin", string> = {
  seed: "Semente",
  user: "Utilizador",
  ai: "IA",
  admin: "Admin",
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

/** Chip colour for the review-queue "Origem" (submission source). */
export function submissionSourceChipVariant(source: "seed" | "user" | "ai" | "admin"): ChipVariant {
  switch (source) {
    case "ai":
      return "accent";
    case "user":
      return "neutral";
    case "admin":
      return "ok";
    case "seed":
      return "neutral";
  }
}
