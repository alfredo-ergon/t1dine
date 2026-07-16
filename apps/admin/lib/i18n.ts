// Centralised UI copy. Portuguese (pt-PT) is the default and only language today
// — this is an internal PT curation tool. Copy is kept here (not inlined in
// components) so an EN toggle can be added later without touching the views.

import type { ConfidenceLevel } from "@t1dine/domain";
import type { FoodStatus, FoodType, PreparationState } from "@t1dine/food-schema";
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
    settings: "Definições",
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
    // Hero + headline metric cards
    approved: "Alimentos aprovados",
    approvedHint: "Publicados no catálogo",
    pending: "Submissões pendentes",
    pendingHint: "À espera de revisão",
    aiCandidates: "Candidatos de IA",
    aiCandidatesHint: "Gerados por IA na fila",
    heroCtaReview: "Rever fila",
    heroCtaAi: "Gerar com IA",
    // Curator metrics section (behind sign-in)
    curatorTitle: "Fila de curadoria",
    curatorLede: "Métricas em tempo real da fila de revisão. Requer sessão de curador.",
    signInTitle: "Inicie sessão para ver a fila",
    signInHint: "Veja submissões pendentes e candidatos de IA depois de iniciar sessão.",
    signInCta: "Ir para a revisão",
    metricsError: "Não foi possível carregar as métricas de curadoria.",
    retry: "Tentar novamente",
    // Quick actions
    quickActions: "Ações rápidas",
    actionReview: "Rever candidatos",
    actionAdd: "Adicionar alimento",
    actionAi: "Gerar com IA",
    actionSettings: "Configurar IA",
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
    attribution: "Atribuição",
    preparationState: "Preparação",
    foodGroup: "Grupo alimentar",
  },
  sources: {
    title: "Fontes",
    lede: "Registo das fontes de dados alimentares e respetivas licenças e cadências.",
    columns: {
      id: "ID",
      name: "Nome",
      market: "Mercado",
      licence: "Licença",
      cadence: "Cadência",
      foodCount: "N.º de alimentos",
    },
    governanceTitle: "Governança das fontes",
    governanceLede:
      "Estado de governança e obrigações de licença por fonte. A atribuição obrigatória tem de permanecer visível onde os dados são apresentados.",
    governanceStatus: "Estado de governança",
    attribution: "Atribuição obrigatória",
    openQuestionsLabel: "Questões de licença em aberto",
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
    // Bulk selection + actions
    selectRowAria: "Selecionar candidato",
    selectAllLabel: "Selecionar todos os visíveis",
    selectAllAria: "Selecionar ou anular todos os candidatos visíveis",
    bulkBarAria: "Ações em lote sobre os candidatos selecionados",
    selectedCount: "selecionados",
    bulkApprove: "Aprovar selecionados",
    bulkReject: "Rejeitar selecionados",
    bulkClear: "Limpar seleção",
    bulkRunning: "A processar…",
    bulkProgress: "A processar",
    bulkApprovedToast: "Candidatos aprovados e publicados",
    bulkRejectedToast: "Candidatos rejeitados e retirados",
    bulkPartialLead: "Concluído",
    bulkPartialOk: "com sucesso",
    bulkPartialFail: "com erro",
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
  settings: {
    title: "Definições",
    lede: "Configurações do portal de curadoria. As alterações aplicam-se a todo o backoffice.",
    ia: {
      title: "Inteligência artificial",
      lede: "Configure o fornecedor de IA (Anthropic), a chave de API e o modelo usados para gerar candidatos de alimentos. A IA nunca faz parte do cálculo de dose.",
      statusTitle: "Estado atual",
      provider: "Fornecedor",
      keyState: "Chave de API",
      keySet: "Configurada",
      keyNotSet: "Sem chave",
      keyMaskedLabel: "Chave",
      effectiveSource: "Origem em uso",
      sourceAdmin: "Definida no backoffice",
      sourceEnv: "Variável de ambiente",
      sourceNone: "Nenhuma",
      enabledState: "Estado da IA",
      enabledOn: "Ligada",
      enabledOff: "Desligada",
      updatedAt: "Última atualização",
      never: "—",
      formTitle: "Atualizar configuração",
      apiKeyLabel: "Nova chave de API",
      apiKeyPlaceholder: "sk-ant-…",
      apiKeyHint: "Cole uma nova chave para a substituir. Deixe em branco para manter a atual.",
      clearKey: "Limpar chave",
      clearKeyHint: "Remove a chave guardada no backoffice e volta a usar a variável de ambiente, se existir.",
      modelLabel: "Modelo",
      modelHint: "Modelo Anthropic usado para gerar candidatos.",
      noModels: "Sem modelos disponíveis.",
      enabledToggle: "IA ligada",
      enabledToggleHint: "Quando desligada, a geração assistida por IA fica indisponível.",
      securityNotePt: "A chave é guardada de forma cifrada no servidor e nunca é mostrada nem registada.",
      securityNoteEn: "The key is stored encrypted on the server and never shown or logged.",
      save: "Guardar alterações",
      saving: "A guardar…",
      saved: "Configuração guardada.",
      cleared: "Chave removida.",
      loading: "A carregar configuração…",
      loadError: "Não foi possível carregar a configuração de IA. Confirme que tem sessão de curador.",
      errorKeyRequired: "Introduza uma chave de API para ativar a IA.",
      errorInvalidModel: "Modelo inválido. Escolha um da lista.",
      errorGeneric: "Não foi possível guardar a configuração. Tente novamente.",
    },
  },
} as const;

/**
 * English copy for the strings added with the Aurora redesign + IA settings page.
 * Portuguese (`t`) remains the rendered default for this internal tool; this
 * mirror keeps every new user-facing string available in EN so a locale toggle
 * can be wired without re-translating. The IA security note is shown in BOTH
 * languages in the UI (see `t.settings.ia.securityNote{Pt,En}`).
 */
export const en = {
  nav: { settings: "Settings" },
  review: {
    // Bulk selection + actions (mirror of the new PT strings in `t.review`)
    selectRowAria: "Select candidate",
    selectAllLabel: "Select all visible",
    selectAllAria: "Select or clear all visible candidates",
    bulkBarAria: "Bulk actions on the selected candidates",
    selectedCount: "selected",
    bulkApprove: "Approve selected",
    bulkReject: "Reject selected",
    bulkClear: "Clear selection",
    bulkRunning: "Processing…",
    bulkProgress: "Processing",
    bulkApprovedToast: "Candidates approved and published",
    bulkRejectedToast: "Candidates rejected and retired",
    bulkPartialLead: "Done",
    bulkPartialOk: "succeeded",
    bulkPartialFail: "failed",
  },
  dashboard: {
    title: "Dashboard",
    eyebrow: "Curation portal",
    lede: "Overview of the food curation catalog. All values are synthetic.",
    approved: "Approved foods",
    approvedHint: "Published to the catalog",
    pending: "Pending submissions",
    pendingHint: "Awaiting review",
    aiCandidates: "AI candidates",
    aiCandidatesHint: "AI-generated in the queue",
    heroCtaReview: "Review queue",
    heroCtaAi: "Generate with AI",
    curatorTitle: "Curation queue",
    curatorLede: "Live metrics from the review queue. Requires a curator session.",
    signInTitle: "Sign in to see the queue",
    signInHint: "View pending submissions and AI candidates once you sign in.",
    signInCta: "Go to review",
    metricsError: "Could not load curation metrics.",
    retry: "Try again",
    quickActions: "Quick actions",
    actionReview: "Review candidates",
    actionAdd: "Add food",
    actionAi: "Generate with AI",
    actionSettings: "Configure AI",
  },
  settings: {
    title: "Settings",
    lede: "Curation portal settings. Changes apply across the whole backoffice.",
    ia: {
      title: "Artificial intelligence",
      lede: "Configure the AI provider (Anthropic), the API key, and the model used to generate food candidates. AI is never part of the dose calculation.",
      statusTitle: "Current status",
      provider: "Provider",
      keyState: "API key",
      keySet: "Configured",
      keyNotSet: "No key",
      keyMaskedLabel: "Key",
      effectiveSource: "Effective source",
      sourceAdmin: "Set in the backoffice",
      sourceEnv: "Environment variable",
      sourceNone: "None",
      enabledState: "AI status",
      enabledOn: "On",
      enabledOff: "Off",
      updatedAt: "Last updated",
      never: "—",
      formTitle: "Update configuration",
      apiKeyLabel: "New API key",
      apiKeyPlaceholder: "sk-ant-…",
      apiKeyHint: "Paste a new key to replace it. Leave blank to keep the current one.",
      clearKey: "Clear key",
      clearKeyHint: "Removes the key stored in the backoffice and falls back to the environment variable, if any.",
      modelLabel: "Model",
      modelHint: "Anthropic model used to generate candidates.",
      noModels: "No models available.",
      enabledToggle: "AI enabled",
      enabledToggleHint: "When off, AI-assisted generation is unavailable.",
      securityNotePt: "A chave é guardada de forma cifrada no servidor e nunca é mostrada nem registada.",
      securityNoteEn: "The key is stored encrypted on the server and never shown or logged.",
      save: "Save changes",
      saving: "Saving…",
      saved: "Configuration saved.",
      cleared: "Key removed.",
      loading: "Loading configuration…",
      loadError: "Could not load the AI configuration. Make sure you have a curator session.",
      errorKeyRequired: "Enter an API key to enable AI.",
      errorInvalidModel: "Invalid model. Choose one from the list.",
      errorGeneric: "Could not save the configuration. Please try again.",
    },
  },
} as const;

/**
 * Friendly display names for known Anthropic model ids, used only as a fallback
 * label when the server's `availableModels` sends bare id strings without their
 * own label. The authoritative list always comes from the API.
 */
export const AI_MODEL_LABELS: Record<string, string> = {
  "claude-opus-4-8": "Claude Opus 4.8",
  "claude-opus-4-7": "Claude Opus 4.7",
  "claude-opus-4-6": "Claude Opus 4.6",
  "claude-sonnet-5": "Claude Sonnet 5",
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "claude-haiku-4-5": "Claude Haiku 4.5",
  "claude-fable-5": "Claude Fable 5",
};

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

/** pt-PT labels for the controlled preparation-state vocabulary (INSA foods). */
export const PREPARATION_STATE_LABELS: Record<PreparationState, string> = {
  raw: "Cru",
  cooked: "Cozido",
  roasted: "Assado",
  fried: "Frito",
  grilled: "Grelhado",
  stewed: "Estufado",
  dried: "Seco/desidratado",
  candied: "Cristalizado",
  preserved: "Conservado",
  reconstituted: "Reconstituído",
  unknown: "Desconhecido",
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
