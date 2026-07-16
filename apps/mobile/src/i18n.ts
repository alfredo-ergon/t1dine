// Lightweight i18n: Portuguese is the default language, English is a toggle.
// A small dictionary + React context is enough for this app's copy — no
// network fetch of translation bundles, so language switching stays
// available offline. Persisted choice is loaded once at startup and written
// back on every change (best-effort; UI never blocks on storage).

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Language = "pt" | "en";

export const DEFAULT_LANGUAGE: Language = "pt";
const LANGUAGE_STORAGE_KEY = "t1dine.lang";

type Dictionary = Record<string, string>;
type Vars = Record<string, string | number>;

const pt: Dictionary = {
  "app.name": "T1Dine",
  "app.tagline": "O que estou a comer?",
  "app.greeting": "O que vais comer hoje?",

  "splash.tagline": "A tua refeição, com confiança.",
  "splash.loading": "A preparar tudo…",

  "nav.search": "Procurar",
  "nav.meal": "Refeição",
  "nav.favourites": "Favoritos",
  "nav.glucose": "Glicose",
  "nav.back": "Voltar",

  "language.pt": "PT",
  "language.en": "EN",
  "language.switchLabel": "Idioma",

  "common.gramsUnit": "g",
  "common.carbsPer100gShort": "hidratos /100g",
  "common.gramsCarbsPer100": "gramas de hidratos por 100 gramas",

  "catalog.sourceOnline": "online",
  "catalog.sourceOffline": "offline / catálogo local",
  "catalog.refreshCta": "Atualizar catálogo",
  "catalog.refreshing": "A atualizar…",
  // Shown next to the result count, right under the online/offline status
  // dot — must always agree with it (never say "offline" while the dot is
  // green/"online", and vice versa).
  "catalog.metaOnline": "catálogo T1Dine · dados em direto (sintético)",
  "catalog.metaOffline": "catálogo local (sintético)",

  "filters.toggle": "Filtros de área",
  "filters.toggleActive": "Filtros de área ({count})",
  "filters.regionLabel": "Região",
  "filters.cuisineLabel": "Cozinha",
  "filters.clear": "Limpar filtros",
  "filters.activeSummary.one": "{count} filtro ativo",
  "filters.activeSummary.other": "{count} filtros ativos",
  "filters.noneActive": "Nenhum filtro ativo",

  "search.placeholder": "Procurar alimentos — ex. pão, arroz, apple",
  "search.hint": "Escreva o nome de um alimento em português ou inglês",
  "search.clear": "Limpar pesquisa",
  "search.results.one": "{count} alimento",
  "search.results.other": "{count} alimentos",
  "search.emptyTitle": "Sem resultados offline",
  "search.emptyBody": "Tente outro termo, ou crie um alimento personalizado.",
  "search.createFoodCta": "Criar alimento personalizado",
  "search.currentMeal": "Refeição atual",

  "food.type.ingredient": "Ingrediente",
  "food.type.packaged": "Embalado",
  "food.type.restaurant": "Restaurante",
  "food.type.recipe": "Receita",
  "food.type.custom": "Personalizado",

  "confidence.ariaPrefix": "Confiança:",
  "confidence.high": "Verificado",
  "confidence.medium": "Declarado",
  "confidence.low": "Baixa confiança",
  "confidence.unverified": "Não verificado",

  "favourite.add": "Adicionar aos favoritos",
  "favourite.remove": "Remover dos favoritos",

  "detail.uncertaintyNote": "Este valor não está analiticamente verificado. Confirme antes de confiar.",
  "detail.areaLabel": "Área",
  "detail.nutrientsTitle": "Nutrientes (por 100 g)",
  "detail.carbLabel": "Hidratos de carbono disponíveis",
  "detail.energyLabel": "Energia",
  "detail.provenanceTitle": "Proveniência",
  "detail.noProvenance": "Sem proveniência disponível.",
  "detail.sourceLabel": "Fonte",
  "detail.versionLabel": "Versão",
  "detail.marketLabel": "Mercado",
  "detail.methodLabel": "Método",
  "detail.retrievedLabel": "Obtido em",
  "detail.licenceLabel": "Licença",
  "detail.quantityLabel": "Quantidade",
  "detail.portionCarbLabel": "Nesta porção",
  "detail.addButton": "Adicionar à refeição",
  "detail.submitTitle": "Contribuir para a base de dados",
  "detail.submitHint": "Enviar este alimento para revisão. Só fica disponível para todos depois de aprovado por um curador.",
  "detail.submitCta": "Submeter para revisão",
  "detail.submitting": "A enviar…",
  "detail.submitSuccess": "Enviado para revisão. Será revisto antes de ficar público.",
  "detail.submitErrorOffline": "Sem ligação. Tente novamente mais tarde.",
  "detail.submitErrorGeneric": "Não foi possível enviar. Tente novamente.",

  "meal.title": "Refeição atual",
  "meal.items.one": "{count} alimento",
  "meal.items.other": "{count} alimentos",
  "meal.emptyTitle": "Ainda sem alimentos",
  "meal.emptyBody": "Procure e adicione alimentos para começar a construir a sua refeição.",
  "meal.remove": "Remover",
  "meal.removeItemLabel": "Remover {name} da refeição",
  "meal.decreaseLabel": "Diminuir quantidade de {name}",
  "meal.increaseLabel": "Aumentar quantidade de {name}",
  "meal.amountInputLabel": "Quantidade em gramas de {name}",
  "meal.totalsCarb": "Total de hidratos de carbono",
  "meal.totalsEnergy": "Total de energia",
  "meal.carbShort": "hidratos",
  "meal.uncertaintyBanner": "Alguns valores desta refeição não estão totalmente verificados. Confirme antes de confiar nos totais.",

  "meal.savedMealsOpenCta": "Refeições guardadas",
  "meal.saveMealCta": "Guardar refeição",
  "meal.updateSavedMealCta": "Atualizar «{name}»",
  "meal.updateSavedMealSuccess": "Refeição guardada atualizada.",
  "meal.saveAsNewCta": "Guardar como nova",
  "meal.saveMealNameLabel": "Nome da refeição",
  "meal.saveMealNamePlaceholder": "ex. Pequeno-almoço de semana",
  "meal.saveMealNameError": "Introduza um nome para a refeição.",
  "meal.saveMealConfirm": "Guardar",
  "meal.saveMealCancel": "Cancelar",
  "meal.saveMealSuccess": "Refeição guardada. Encontre-a em \"Refeições guardadas\".",

  "favourites.title": "Favoritos",
  "favourites.sectionFavourites": "Favoritos",
  "favourites.sectionRecents": "Recentes",
  "favourites.emptyFavourites": "Ainda sem favoritos. Toque na estrela num alimento para o guardar aqui.",
  "favourites.emptyRecents": "Ainda sem alimentos recentes.",

  "create.openCta": "Novo alimento",
  "create.title": "Criar alimento personalizado",
  "create.unverifiedNotice": "Alimentos personalizados são sempre marcados como não verificados. Confirme os valores antes de confiar neles.",
  "create.namePtLabel": "Nome (português)",
  "create.namePtPlaceholder": "ex. Bolo da avó",
  "create.nameEnLabel": "Nome (inglês)",
  "create.nameEnPlaceholder": "ex. Grandma's cake",
  "create.carbLabel": "Hidratos de carbono (g por 100 g)",
  "create.energyLabel": "Energia (kcal por 100 g)",
  "create.saveButton": "Guardar alimento",
  "create.cancelButton": "Cancelar",
  "create.errorNamePt": "O nome em português é obrigatório.",
  "create.errorCarb": "Introduza um valor de hidratos de carbono válido (0 ou mais).",
  "create.errorEnergy": "Introduza um valor de energia válido (0 ou mais).",

  "glucose.title": "Glicose",
  "glucose.safetyBanner": "Apenas leitura — não é aconselhamento clínico nem cálculo de dose.",
  "glucose.loading": "A carregar leituras…",
  "glucose.newestLabel": "Leitura mais recente",
  "glucose.recentTitle": "Leituras recentes",
  "glucose.noReadings": "Ainda sem leituras.",
  "glucose.justNow": "agora mesmo",
  "glucose.ageMinutesAgo": "há {count} min",
  "glucose.staleWarning": "Desatualizada",
  "glucose.allStaleWarning": "Não há leituras recentes. Os valores apresentados podem estar desatualizados.",
  "glucose.offlineTitle": "Sem ligação",
  "glucose.offlineBody": "Não foi possível obter leituras de glicose. Verifique a ligação e tente novamente.",
  "glucose.retry": "Tentar novamente",
  "glucose.sourceMock": "Dados de demonstração (mock)",
  "glucose.sourceLive": "Nightscout",
  "glucose.mgdlUnit": "mg/dL",
  "glucose.mmolUnit": "mmol/L",
  "glucose.direction.TripleUp": "a subir muito depressa",
  "glucose.direction.DoubleUp": "a subir depressa",
  "glucose.direction.SingleUp": "a subir",
  "glucose.direction.FortyFiveUp": "a subir ligeiramente",
  "glucose.direction.Flat": "estável",
  "glucose.direction.FortyFiveDown": "a descer ligeiramente",
  "glucose.direction.SingleDown": "a descer",
  "glucose.direction.DoubleDown": "a descer depressa",
  "glucose.direction.TripleDown": "a descer muito depressa",
  "glucose.direction.unknown": "tendência desconhecida",

  "profile.openLabel": "Perfil e definições",
  "profile.title": "Perfil",
  "profile.startupTitle": "Página inicial",
  "profile.startupBody": "Escolha o separador que abre quando inicia a app.",
  "profile.exportTitle": "Exportar os meus dados",
  "profile.exportBody": "Cria uma cópia, em formato JSON, dos dados guardados neste dispositivo: favoritos, recentes, alimentos personalizados, a refeição atual e as refeições guardadas.",
  "profile.exportButton": "Gerar exportação",
  "profile.exportEmpty": "Ainda sem dados guardados para exportar.",
  "profile.deleteTitle": "Apagar todos os meus dados",
  "profile.deleteBody": "Remove permanentemente, deste dispositivo, os favoritos, recentes, alimentos personalizados, a refeição atual e as refeições guardadas. Esta ação não pode ser desfeita.",
  "profile.deleteButton": "Apagar todos os dados",
  "profile.deleteConfirmTitle": "Tem a certeza?",
  "profile.deleteConfirmBody": "Esta ação vai apagar permanentemente todos os dados guardados neste dispositivo e não pode ser desfeita.",
  "profile.deleteConfirmCancel": "Cancelar",
  "profile.deleteConfirmConfirm": "Sim, apagar tudo",
  "profile.deleteSuccess": "Todos os dados guardados neste dispositivo foram apagados.",

  "profile.clinicalTitle": "Perfil clínico",
  "profile.clinicalIntro": "Estes valores só são usados para a Estimativa de dose. Não substituem o plano de tratamento da sua equipa de diabetes.",
  "profile.clinicalNudge": "Ainda não guardou o seu perfil clínico. Os valores abaixo são as predefinições — reveja-os e guarde antes de usar a Estimativa de dose.",
  "profile.clinicalVersionLabel": "Versão do perfil guardado",
  "profile.clinicalCarbRatioLabel": "Rácio de hidratos (g por 1 unidade)",
  "profile.clinicalCorrectionFactorLabel": "Fator de correção (mg/dL por 1 unidade)",
  "profile.clinicalTargetLabel": "Alvo de glicemia (mg/dL)",
  "profile.clinicalIncrementLabel": "Incremento da caneta",
  "profile.clinicalIncrementHalf": "Meias unidades (0,5)",
  "profile.clinicalIncrementWhole": "Unidades inteiras (1)",
  "profile.clinicalMaxDoseLabel": "Dose máxima (unidades)",
  "profile.clinicalHypoThresholdLabel": "Limiar de hipoglicemia (mg/dL)",
  "profile.clinicalSaveButton": "Guardar perfil clínico",
  "profile.clinicalSaveSuccess": "Perfil clínico guardado.",
  "profile.clinicalErrorPositive": "Introduza um valor positivo.",

  "meal.estimateDoseCta": "Estimar dose",
  "meal.estimateDoseDisabledHint": "Adicione alimentos à refeição para poder estimar a dose.",

  "savedMeals.title": "Refeições guardadas",
  "savedMeals.count.one": "{count} refeição guardada",
  "savedMeals.count.other": "{count} refeições guardadas",
  "savedMeals.searchLabel": "Procurar refeições guardadas por nome",
  "savedMeals.searchPlaceholder": "Procurar por nome",
  "savedMeals.emptyTitle": "Ainda sem refeições guardadas",
  "savedMeals.emptyBody": "Guarde uma refeição a partir do ecrã \"Refeição\" para a encontrar e reutilizar aqui.",
  "savedMeals.noResultsTitle": "Sem resultados",
  "savedMeals.noResultsBody": "Nenhuma refeição guardada corresponde a essa pesquisa.",
  "savedMeals.itemCount.one": "{count} alimento",
  "savedMeals.itemCount.other": "{count} alimentos",
  "savedMeals.totalCarbLabel": "Total de hidratos",
  "savedMeals.createdAtLabel": "Guardada em {date}",
  "savedMeals.useCta": "Usar",
  "savedMeals.useHint": "Carrega esta refeição guardada na refeição atual (substituindo-a) para rever os totais e avançar para a estimativa de dose.",
  "savedMeals.cloneCta": "Clonar e ajustar",
  "savedMeals.cloneHint": "Carrega uma cópia desta refeição guardada na refeição atual (substituindo-a) para ajustar quantidades sem alterar o original.",
  "savedMeals.renameCta": "Editar nome",
  "savedMeals.renameLabel": "Novo nome da refeição guardada",
  "savedMeals.renameSave": "Guardar nome",
  "savedMeals.renameCancel": "Cancelar",
  "savedMeals.renameError": "Introduza um nome.",
  "savedMeals.deleteCta": "Apagar",
  "savedMeals.deleteConfirmTitle": "Apagar esta refeição guardada?",
  "savedMeals.deleteConfirmBody": "Esta ação não pode ser desfeita.",
  "savedMeals.deleteConfirmConfirm": "Sim, apagar",
  "savedMeals.deleteConfirmCancel": "Cancelar",

  "dose.title": "Estimativa de dose",
  "dose.disclaimerBanner": "Estimativa — não é aconselhamento médico. Confirme sempre com a sua equipa de diabetes.",
  "dose.safetyRule": "REGRA DE SEGURANÇA: Não misturar — 50 g HC é o rácio da comida; 50 mg/dL é o fator de correção da glicemia. Confirme sempre a glicemia antes da refeição. Tenha atenção à insulina ativa, exercício, álcool, doença, vómitos ou refeição muito gordurosa. Se houver dúvida, hipoglicemia recente ou valores fora do normal, confirme com a equipa de diabetes.",
  "dose.mealCarbLabel": "Hidratos de carbono da refeição",
  "dose.glucoseLabel": "Glicemia atual (mg/dL)",
  "dose.glucosePlaceholder": "ex. 180",
  "dose.glucoseRequiredHint": "Obrigatório",
  "dose.activeInsulinLabel": "Insulina ativa (unidades)",
  "dose.activeInsulinCaption": "Se tem insulina ativa, indique-a. 0 se não tiver.",
  "dose.calculateButton": "Calcular estimativa",
  "dose.errorGlucoseRequired": "Introduza a glicemia atual antes de calcular.",
  "dose.resultPending": "Introduza a glicemia atual e toque em \"Calcular estimativa\".",
  "dose.workingTitle": "Como foi calculado",
  "dose.workingMealLine": "Insulina para HC: {carbs} ÷ {ratio} = {units} u",
  "dose.workingCorrectionLine": "Correção: ({glucose} − {target}) ÷ {factor} = {units} u",
  "dose.workingActiveInsulinLine": "Insulina ativa: − {units} u",
  "dose.workingTotalLine": "Total: {units} u",
  "dose.approximateDoseLabel": "Dose aproximada",
  "dose.approximateDoseUnit": "unidades",
  "dose.roundingNote": "arredondado ao incremento da caneta ({increment})",
  "dose.blockedTitle": "Não é possível estimar a dose",
  "dose.blockedHypoTitle": "Glicemia baixa — segurança em primeiro lugar",
  "dose.quickTablesTitle": "Tabelas rápidas (referência)",
  "dose.quickCarbTableTitle": "Hidratos → unidades (rácio {ratio} g)",
  "dose.quickCorrectionTableTitle": "Correção (alvo {target} mg/dL, fator {factor})",
  "dose.quickTableCarbUnit": "g",
  "dose.quickTableCorrectionUnit": "mg/dL",

  "account.openLabel": "Conta",
  "account.title": "Conta",
  "account.intro": "Crie uma conta ou entre para sincronizar os seus favoritos e alimentos personalizados entre dispositivos. A aplicação continua a funcionar sem conta e sem ligação.",
  "account.emailLabel": "Email",
  "account.emailPlaceholder": "nome@exemplo.com",
  "account.passwordLabel": "Palavra-passe",
  "account.passwordPlaceholder": "Pelo menos 8 caracteres",
  "account.loginButton": "Entrar",
  "account.loggingIn": "A entrar…",
  "account.registerButton": "Criar conta",
  "account.registering": "A criar conta…",
  "account.logoutButton": "Terminar sessão",
  "account.syncNowButton": "Sincronizar agora",
  "account.syncStatusLabel": "Estado da sincronização",
  "account.signedInAs": "Sessão iniciada como {email}",
  "account.errorEmailTaken": "Este email já está registado. Tente entrar.",
  "account.errorInvalidCredentials": "Email ou palavra-passe incorretos.",
  "account.errorValidation": "Verifique o email e a palavra-passe (mínimo 8 caracteres).",
  "account.errorOffline": "Sem ligação à internet. Tente novamente mais tarde.",
  "account.errorGeneric": "Não foi possível concluir o pedido. Tente novamente.",
  "account.errorEmailRequired": "Introduza um email.",
  "account.errorPasswordRequired": "Introduza uma palavra-passe.",

  "sync.status.idle": "Ainda não sincronizado",
  "sync.status.syncing": "A sincronizar…",
  "sync.status.synced": "Sincronizado",
  "sync.status.offline": "Sem ligação — sincroniza quando houver internet",
  "sync.status.error": "Erro de sincronização",

  "submissions.title": "As minhas contribuições",
  "submissions.count.one": "{count} contribuição",
  "submissions.count.other": "{count} contribuições",
  "submissions.emptyTitle": "Ainda sem contribuições",
  "submissions.emptyBody": "Quando submeter um alimento personalizado para revisão, ele aparece aqui.",
  "submissions.statusPending": "Pendente de revisão",
  "submissions.submittedAtLabel": "Submetido em {date}",
  "submissions.disclaimer": "Esta lista fica guardada apenas neste dispositivo. O estado pode já ter mudado — a app não verifica automaticamente o resultado da revisão pelo curador.",
  "favourites.openSubmissionsCta": "As minhas contribuições",
};

const en: Dictionary = {
  "app.name": "T1Dine",
  "app.tagline": "What am I eating?",
  "app.greeting": "What are you eating today?",

  "splash.tagline": "Your meal, with confidence.",
  "splash.loading": "Getting things ready…",

  "nav.search": "Search",
  "nav.meal": "Meal",
  "nav.favourites": "Favourites",
  "nav.glucose": "Glucose",
  "nav.back": "Back",

  "language.pt": "PT",
  "language.en": "EN",
  "language.switchLabel": "Language",

  "common.gramsUnit": "g",
  "common.carbsPer100gShort": "carbs /100g",
  "common.gramsCarbsPer100": "grams of carbs per 100 grams",

  "catalog.sourceOnline": "online",
  "catalog.sourceOffline": "offline / local catalog",
  "catalog.refreshCta": "Refresh catalog",
  "catalog.refreshing": "Refreshing…",
  "catalog.metaOnline": "T1Dine catalog · live data (synthetic)",
  "catalog.metaOffline": "local catalog (synthetic)",

  "filters.toggle": "Area filters",
  "filters.toggleActive": "Area filters ({count})",
  "filters.regionLabel": "Region",
  "filters.cuisineLabel": "Cuisine",
  "filters.clear": "Clear filters",
  "filters.activeSummary.one": "{count} active filter",
  "filters.activeSummary.other": "{count} active filters",
  "filters.noneActive": "No active filters",

  "search.placeholder": "Search foods — e.g. pao, arroz, apple",
  "search.hint": "Type a food name in Portuguese or English",
  "search.clear": "Clear search",
  "search.results.one": "{count} food",
  "search.results.other": "{count} foods",
  "search.emptyTitle": "No matches offline",
  "search.emptyBody": "Try another term, or create a custom food.",
  "search.createFoodCta": "Create custom food",
  "search.currentMeal": "Current meal",

  "food.type.ingredient": "Ingredient",
  "food.type.packaged": "Packaged",
  "food.type.restaurant": "Restaurant",
  "food.type.recipe": "Recipe",
  "food.type.custom": "Custom",

  "confidence.ariaPrefix": "Confidence:",
  "confidence.high": "Verified",
  "confidence.medium": "Declared",
  "confidence.low": "Low confidence",
  "confidence.unverified": "Unverified",

  "favourite.add": "Add to favourites",
  "favourite.remove": "Remove from favourites",

  "detail.uncertaintyNote": "This value is not analytically verified. Confirm before you rely on it.",
  "detail.areaLabel": "Area",
  "detail.nutrientsTitle": "Nutrients (per 100 g)",
  "detail.carbLabel": "Available carbohydrate",
  "detail.energyLabel": "Energy",
  "detail.provenanceTitle": "Provenance",
  "detail.noProvenance": "No provenance available.",
  "detail.sourceLabel": "Source",
  "detail.versionLabel": "Version",
  "detail.marketLabel": "Market",
  "detail.methodLabel": "Method",
  "detail.retrievedLabel": "Retrieved",
  "detail.licenceLabel": "Licence",
  "detail.quantityLabel": "Quantity",
  "detail.portionCarbLabel": "In this portion",
  "detail.addButton": "Add to meal",
  "detail.submitTitle": "Contribute to the database",
  "detail.submitHint": "Send this food for review. It only becomes available to everyone once a curator approves it.",
  "detail.submitCta": "Submit for review",
  "detail.submitting": "Submitting…",
  "detail.submitSuccess": "Submitted for review. It will be reviewed before becoming public.",
  "detail.submitErrorOffline": "No connection. Please try again later.",
  "detail.submitErrorGeneric": "Could not submit. Please try again.",

  "meal.title": "Current meal",
  "meal.items.one": "{count} item",
  "meal.items.other": "{count} items",
  "meal.emptyTitle": "No foods yet",
  "meal.emptyBody": "Search and add foods to start building your meal.",
  "meal.remove": "Remove",
  "meal.removeItemLabel": "Remove {name} from meal",
  "meal.decreaseLabel": "Decrease amount of {name}",
  "meal.increaseLabel": "Increase amount of {name}",
  "meal.amountInputLabel": "Amount in grams for {name}",
  "meal.totalsCarb": "Total carbohydrate",
  "meal.totalsEnergy": "Total energy",
  "meal.carbShort": "carbs",
  "meal.uncertaintyBanner": "Some values in this meal are not fully verified. Confirm before you trust the totals.",

  "meal.savedMealsOpenCta": "Saved meals",
  "meal.saveMealCta": "Save meal",
  "meal.updateSavedMealCta": "Update “{name}”",
  "meal.updateSavedMealSuccess": "Saved meal updated.",
  "meal.saveAsNewCta": "Save as new",
  "meal.saveMealNameLabel": "Meal name",
  "meal.saveMealNamePlaceholder": "e.g. Weekday breakfast",
  "meal.saveMealNameError": "Enter a name for the meal.",
  "meal.saveMealConfirm": "Save",
  "meal.saveMealCancel": "Cancel",
  "meal.saveMealSuccess": "Meal saved. Find it under \"Saved meals\".",

  "favourites.title": "Favourites",
  "favourites.sectionFavourites": "Favourites",
  "favourites.sectionRecents": "Recents",
  "favourites.emptyFavourites": "No favourites yet. Tap the star on a food to save it here.",
  "favourites.emptyRecents": "No recent foods yet.",

  "create.openCta": "New food",
  "create.title": "Create custom food",
  "create.unverifiedNotice": "Custom foods are always marked unverified. Confirm the values before you rely on them.",
  "create.namePtLabel": "Name (Portuguese)",
  "create.namePtPlaceholder": "e.g. Grandma's cake",
  "create.nameEnLabel": "Name (English)",
  "create.nameEnPlaceholder": "e.g. Grandma's cake",
  "create.carbLabel": "Carbohydrate (g per 100 g)",
  "create.energyLabel": "Energy (kcal per 100 g)",
  "create.saveButton": "Save food",
  "create.cancelButton": "Cancel",
  "create.errorNamePt": "The Portuguese name is required.",
  "create.errorCarb": "Enter a valid carbohydrate value (0 or more).",
  "create.errorEnergy": "Enter a valid energy value (0 or more).",

  "glucose.title": "Glucose",
  "glucose.safetyBanner": "Read-only — not clinical advice, and not a dose calculation.",
  "glucose.loading": "Loading readings…",
  "glucose.newestLabel": "Most recent reading",
  "glucose.recentTitle": "Recent readings",
  "glucose.noReadings": "No readings yet.",
  "glucose.justNow": "just now",
  "glucose.ageMinutesAgo": "{count} min ago",
  "glucose.staleWarning": "Stale",
  "glucose.allStaleWarning": "No recent readings. Values shown may be out of date.",
  "glucose.offlineTitle": "No connection",
  "glucose.offlineBody": "Could not fetch glucose readings. Check your connection and try again.",
  "glucose.retry": "Try again",
  "glucose.sourceMock": "Demo data (mock)",
  "glucose.sourceLive": "Nightscout",
  "glucose.mgdlUnit": "mg/dL",
  "glucose.mmolUnit": "mmol/L",
  "glucose.direction.TripleUp": "rising very fast",
  "glucose.direction.DoubleUp": "rising fast",
  "glucose.direction.SingleUp": "rising",
  "glucose.direction.FortyFiveUp": "rising slightly",
  "glucose.direction.Flat": "steady",
  "glucose.direction.FortyFiveDown": "falling slightly",
  "glucose.direction.SingleDown": "falling",
  "glucose.direction.DoubleDown": "falling fast",
  "glucose.direction.TripleDown": "falling very fast",
  "glucose.direction.unknown": "unknown trend",

  "profile.openLabel": "Profile and settings",
  "profile.title": "Profile",
  "profile.startupTitle": "Home screen",
  "profile.startupBody": "Choose which tab opens when the app starts.",
  "profile.exportTitle": "Export my data",
  "profile.exportBody": "Creates a JSON copy of the data stored on this device: favourites, recents, custom foods, the current meal, and saved meals.",
  "profile.exportButton": "Generate export",
  "profile.exportEmpty": "No stored data to export yet.",
  "profile.deleteTitle": "Delete all my data",
  "profile.deleteBody": "Permanently removes, from this device, your favourites, recents, custom foods, the current meal, and saved meals. This cannot be undone.",
  "profile.deleteButton": "Delete all data",
  "profile.deleteConfirmTitle": "Are you sure?",
  "profile.deleteConfirmBody": "This will permanently delete all data stored on this device and cannot be undone.",
  "profile.deleteConfirmCancel": "Cancel",
  "profile.deleteConfirmConfirm": "Yes, delete everything",
  "profile.deleteSuccess": "All data stored on this device has been deleted.",

  "profile.clinicalTitle": "Clinical profile",
  "profile.clinicalIntro": "These values are only used for the Dose Estimate. They do not replace the treatment plan from your diabetes team.",
  "profile.clinicalNudge": "You haven't saved your clinical profile yet. The values below are defaults — review and save them before using the Dose Estimate.",
  "profile.clinicalVersionLabel": "Saved profile version",
  "profile.clinicalCarbRatioLabel": "Carb ratio (g per 1 unit)",
  "profile.clinicalCorrectionFactorLabel": "Correction factor (mg/dL per 1 unit)",
  "profile.clinicalTargetLabel": "Glucose target (mg/dL)",
  "profile.clinicalIncrementLabel": "Pen increment",
  "profile.clinicalIncrementHalf": "Half units (0.5)",
  "profile.clinicalIncrementWhole": "Whole units (1)",
  "profile.clinicalMaxDoseLabel": "Maximum dose (units)",
  "profile.clinicalHypoThresholdLabel": "Hypoglycaemia threshold (mg/dL)",
  "profile.clinicalSaveButton": "Save clinical profile",
  "profile.clinicalSaveSuccess": "Clinical profile saved.",
  "profile.clinicalErrorPositive": "Enter a positive value.",

  "meal.estimateDoseCta": "Estimate dose",
  "meal.estimateDoseDisabledHint": "Add foods to the meal to estimate a dose.",

  "savedMeals.title": "Saved meals",
  "savedMeals.count.one": "{count} saved meal",
  "savedMeals.count.other": "{count} saved meals",
  "savedMeals.searchLabel": "Search saved meals by name",
  "savedMeals.searchPlaceholder": "Search by name",
  "savedMeals.emptyTitle": "No saved meals yet",
  "savedMeals.emptyBody": "Save a meal from the \"Meal\" screen to find and reuse it here.",
  "savedMeals.noResultsTitle": "No results",
  "savedMeals.noResultsBody": "No saved meal matches that search.",
  "savedMeals.itemCount.one": "{count} item",
  "savedMeals.itemCount.other": "{count} items",
  "savedMeals.totalCarbLabel": "Total carbohydrate",
  "savedMeals.createdAtLabel": "Saved on {date}",
  "savedMeals.useCta": "Use",
  "savedMeals.useHint": "Loads this saved meal into the current meal (replacing it) so you can review the totals and proceed to the dose estimate.",
  "savedMeals.cloneCta": "Clone and adjust",
  "savedMeals.cloneHint": "Loads a copy of this saved meal into the current meal (replacing it) so you can adjust quantities without changing the original.",
  "savedMeals.renameCta": "Edit name",
  "savedMeals.renameLabel": "New name for this saved meal",
  "savedMeals.renameSave": "Save name",
  "savedMeals.renameCancel": "Cancel",
  "savedMeals.renameError": "Enter a name.",
  "savedMeals.deleteCta": "Delete",
  "savedMeals.deleteConfirmTitle": "Delete this saved meal?",
  "savedMeals.deleteConfirmBody": "This cannot be undone.",
  "savedMeals.deleteConfirmConfirm": "Yes, delete",
  "savedMeals.deleteConfirmCancel": "Cancel",

  "dose.title": "Dose estimate",
  "dose.disclaimerBanner": "Estimate — not medical advice. Always confirm with your diabetes team.",
  "dose.safetyRule": "SAFETY RULE: Do not mix these up — 50 g of carbohydrate is the meal ratio; 50 mg/dL is the glucose correction factor. Always confirm your glucose before the meal. Take into account active insulin, exercise, alcohol, illness, vomiting, or a very high-fat meal. If in doubt, if you've had a recent low, or if values look unusual, confirm with your diabetes team.",
  "dose.mealCarbLabel": "Meal carbohydrate",
  "dose.glucoseLabel": "Current glucose (mg/dL)",
  "dose.glucosePlaceholder": "e.g. 180",
  "dose.glucoseRequiredHint": "Required",
  "dose.activeInsulinLabel": "Active insulin (units)",
  "dose.activeInsulinCaption": "If you have active insulin, enter it. 0 if you have none.",
  "dose.calculateButton": "Calculate estimate",
  "dose.errorGlucoseRequired": "Enter your current glucose before calculating.",
  "dose.resultPending": "Enter your current glucose and tap \"Calculate estimate\".",
  "dose.workingTitle": "How this was calculated",
  "dose.workingMealLine": "Insulin for carbs: {carbs} ÷ {ratio} = {units} u",
  "dose.workingCorrectionLine": "Correction: ({glucose} − {target}) ÷ {factor} = {units} u",
  "dose.workingActiveInsulinLine": "Active insulin: − {units} u",
  "dose.workingTotalLine": "Total: {units} u",
  "dose.approximateDoseLabel": "Approximate dose",
  "dose.approximateDoseUnit": "units",
  "dose.roundingNote": "rounded to the pen increment ({increment})",
  "dose.blockedTitle": "Cannot estimate a dose",
  "dose.blockedHypoTitle": "Low glucose — safety first",
  "dose.quickTablesTitle": "Quick tables (reference)",
  "dose.quickCarbTableTitle": "Carbs → units (ratio {ratio} g)",
  "dose.quickCorrectionTableTitle": "Correction (target {target} mg/dL, factor {factor})",
  "dose.quickTableCarbUnit": "g",
  "dose.quickTableCorrectionUnit": "mg/dL",

  "account.openLabel": "Account",
  "account.title": "Account",
  "account.intro": "Create an account or sign in to sync your favourites and custom foods across devices. The app keeps working with no account and no connection.",
  "account.emailLabel": "Email",
  "account.emailPlaceholder": "name@example.com",
  "account.passwordLabel": "Password",
  "account.passwordPlaceholder": "At least 8 characters",
  "account.loginButton": "Sign in",
  "account.loggingIn": "Signing in…",
  "account.registerButton": "Create account",
  "account.registering": "Creating account…",
  "account.logoutButton": "Sign out",
  "account.syncNowButton": "Sync now",
  "account.syncStatusLabel": "Sync status",
  "account.signedInAs": "Signed in as {email}",
  "account.errorEmailTaken": "This email is already registered. Try signing in instead.",
  "account.errorInvalidCredentials": "Incorrect email or password.",
  "account.errorValidation": "Check the email and password (minimum 8 characters).",
  "account.errorOffline": "No internet connection. Try again later.",
  "account.errorGeneric": "Could not complete the request. Please try again.",
  "account.errorEmailRequired": "Enter an email.",
  "account.errorPasswordRequired": "Enter a password.",

  "sync.status.idle": "Not synced yet",
  "sync.status.syncing": "Syncing…",
  "sync.status.synced": "Synced",
  "sync.status.offline": "Offline — will sync when back online",
  "sync.status.error": "Sync error",

  "submissions.title": "My submissions",
  "submissions.count.one": "{count} submission",
  "submissions.count.other": "{count} submissions",
  "submissions.emptyTitle": "No submissions yet",
  "submissions.emptyBody": "When you submit a custom food for review, it shows up here.",
  "submissions.statusPending": "Pending review",
  "submissions.submittedAtLabel": "Submitted on {date}",
  "submissions.disclaimer": "This list is stored only on this device. The status may have already changed — the app does not automatically check the curator's review outcome.",
  "favourites.openSubmissionsCta": "My submissions",
};

const DICTIONARIES: Record<Language, Dictionary> = { pt, en };

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

export type TranslateFn = (key: string, vars?: Vars) => string;

function translateWith(language: Language): TranslateFn {
  return (key, vars) => {
    const template = DICTIONARIES[language][key] ?? DICTIONARIES[DEFAULT_LANGUAGE][key] ?? key;
    return interpolate(template, vars);
  };
}

/** Picks a one/other plural key: `${base}.one` / `${base}.other` (CLDR-ish, good enough for pt/en). */
export function tPlural(t: TranslateFn, base: string, count: number): string {
  const key = count === 1 ? `${base}.one` : `${base}.other`;
  return t(key, { count });
}

export interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: TranslateFn;
  isLoaded: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === "pt" || stored === "en") {
          setLanguageState(stored);
        }
      })
      .catch(() => {
        // Offline-first: if storage is unavailable, keep the default language.
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next).catch(() => {
      // Best-effort persistence only; the UI already reflects the change.
    });
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t: translateWith(language), isLoaded }),
    [language, isLoaded, setLanguage],
  );

  return createElement(LanguageContext.Provider, { value }, children);
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage() must be used within a LanguageProvider");
  }
  return ctx;
}
