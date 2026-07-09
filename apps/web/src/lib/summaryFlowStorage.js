const STORAGE_VERSION = 1;
const STORAGE_KEY_PREFIX = 'fp_summary_draft_v';

export function getSummaryDraftStorageKey(userId) {
  return `${STORAGE_KEY_PREFIX}${STORAGE_VERSION}_${userId || 'guest'}`;
}

export function buildSummaryDraftPayload({
  planId,
  userId,
  familyMembers,
  income,
  expenseCategories,
  assetCategories,
  liabilityCategories,
  goals,
  hasEMI,
  hasSpouseIncome,
  hasLifeInsurance,
  hasHealthInsurance,
  summaryLifeCover,
  summaryHealthCover,
  summaryReportGeneratedAt,
  contingencyFund,
  inflationRates,
  ui,
}) {
  return {
    version: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    planId: planId ?? null,
    userId: userId ?? null,
    familyMembers,
    income,
    expenseCategories,
    assetCategories,
    liabilityCategories,
    goals,
    hasEMI,
    hasSpouseIncome,
    hasLifeInsurance,
    hasHealthInsurance,
    summaryLifeCover,
    summaryHealthCover,
    summaryReportGeneratedAt,
    contingencyFund,
    inflationRates,
    ui: ui ?? {},
  };
}

export function saveSummaryDraft(userId, payload) {
  try {
    localStorage.setItem(getSummaryDraftStorageKey(userId), JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn('Failed to save summary draft to localStorage:', error);
    return false;
  }
}

export function loadSummaryDraft(userId) {
  try {
    const raw = localStorage.getItem(getSummaryDraftStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== STORAGE_VERSION) return null;
    return parsed;
  } catch (error) {
    console.warn('Failed to load summary draft from localStorage:', error);
    return null;
  }
}

function getSummaryUiStorageKey(userId) {
  return `fp_summary_ui_v${STORAGE_VERSION}_${userId || 'guest'}`;
}

export function clearSummaryDraft(userId) {
  try {
    localStorage.removeItem(getSummaryDraftStorageKey(userId));
    localStorage.removeItem(getSummaryUiStorageKey(userId));
  } catch (error) {
    console.warn('Failed to clear summary draft from localStorage:', error);
  }
}

export function saveSummaryUiDraft(userId, ui) {
  try {
    localStorage.setItem(getSummaryUiStorageKey(userId), JSON.stringify(ui ?? {}));
    return true;
  } catch (error) {
    console.warn('Failed to save summary UI draft to localStorage:', error);
    return false;
  }
}

export function loadSummaryUiDraft(userId) {
  try {
    const raw = localStorage.getItem(getSummaryUiStorageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to load summary UI draft from localStorage:', error);
    return null;
  }
}

export function getDraftSavedAtMs(draft) {
  if (!draft?.savedAt) return 0;
  const ms = new Date(draft.savedAt).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function hasMeaningfulSummaryDraft(draft) {
  if (!draft) return false;

  const self = draft.familyMembers?.[0];
  if (self?.name || self?.mobile || self?.dob) return true;

  const income = draft.income || {};
  if (
    income.self ||
    income.spouse ||
    income.summarySelfInHand ||
    income.summarySpouseInHand
  ) {
    return true;
  }

  const expenses = draft.expenseCategories || {};
  if (
    expenses.summaryHouseholdTotal ||
    expenses.summaryEmiTotal ||
    expenses.summaryMonthlyInvestments ||
    expenses.summaryOtherSavings
  ) {
    return true;
  }

  const assets = draft.assetCategories || {};
  if (
    assets.summaryPortfolioValue ||
    assets.summaryLiquidCash ||
    assets.summaryRealEstateAssets
  ) {
    return true;
  }

  const liabilities = draft.liabilityCategories || {};
  if (
    liabilities.summaryOutstandingLoans ||
    liabilities.summaryCreditCardDues ||
    liabilities.summaryOtherPayables
  ) {
    return true;
  }

  if (Array.isArray(draft.goals) && draft.goals.length > 0) return true;
  if (draft.summaryLifeCover || draft.summaryHealthCover) return true;
  if (draft.hasLifeInsurance !== null && draft.hasLifeInsurance !== undefined) return true;
  if (draft.hasHealthInsurance !== null && draft.hasHealthInsurance !== undefined) return true;
  if (draft.summaryReportGeneratedAt) return true;

  return false;
}

export function patchSummaryUiDraft(userId, uiPatch) {
  const existing = loadSummaryUiDraft(userId) || {};
  return saveSummaryUiDraft(userId, { ...existing, ...uiPatch });
}
