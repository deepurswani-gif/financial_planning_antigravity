import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildSummaryDraftPayload,
  clearSummaryDraft,
  getDraftSavedAtMs,
  getSummaryDraftStorageKey,
  hasMeaningfulSummaryDraft,
  loadSummaryDraft,
  loadSummaryUiDraft,
  patchSummaryUiDraft,
  saveSummaryDraft,
  saveSummaryUiDraft,
} from './summaryFlowStorage';

const USER_ID = 'test-user-123';

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
  };
}

describe('summaryFlowStorage', () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    clearSummaryDraft(USER_ID);
  });

  it('saves and loads summary draft payload', () => {
    const payload = buildSummaryDraftPayload({
      planId: 'plan-1',
      userId: USER_ID,
      familyMembers: [{ name: 'Alex', relation: 'Self' }],
      income: { self: '50000' },
      expenseCategories: { summaryHouseholdTotal: '30000' },
      assetCategories: {},
      liabilityCategories: {},
      goals: [],
      hasEMI: false,
      hasSpouseIncome: false,
      hasLifeInsurance: null,
      hasHealthInsurance: null,
      summaryLifeCover: '',
      summaryHealthCover: '',
      summaryReportGeneratedAt: null,
      contingencyFund: '',
      inflationRates: { incomeIncrement: 10, householdInflation: 6, educationInflation: 8 },
    });

    expect(saveSummaryDraft(USER_ID, payload)).toBe(true);
    const loaded = loadSummaryDraft(USER_ID);
    expect(loaded?.familyMembers?.[0]?.name).toBe('Alex');
    expect(loaded?.income?.self).toBe('50000');
    expect(loaded?.expenseCategories?.summaryHouseholdTotal).toBe('30000');
  });

  it('detects meaningful drafts', () => {
    expect(hasMeaningfulSummaryDraft(null)).toBe(false);
    expect(hasMeaningfulSummaryDraft({ familyMembers: [{ name: '' }] })).toBe(false);
    expect(hasMeaningfulSummaryDraft({ income: { self: '1000' } })).toBe(true);
    expect(hasMeaningfulSummaryDraft({ goals: [{ id: 'g1', name: 'Home' }] })).toBe(true);
  });

  it('compares draft timestamps', () => {
    const ms = getDraftSavedAtMs({ savedAt: '2026-07-08T10:00:00.000Z' });
    expect(ms).toBeGreaterThan(0);
    expect(getDraftSavedAtMs({})).toBe(0);
  });

  it('persists UI draft separately', () => {
    saveSummaryUiDraft(USER_ID, { questionIndexByStep: { profile: 2 } });
    patchSummaryUiDraft(USER_ID, { lastSummaryPath: '/summary-flow/profile' });

    const ui = loadSummaryUiDraft(USER_ID);
    expect(ui?.questionIndexByStep?.profile).toBe(2);
    expect(ui?.lastSummaryPath).toBe('/summary-flow/profile');
  });

  it('uses versioned storage keys', () => {
    expect(getSummaryDraftStorageKey(USER_ID)).toContain(USER_ID);
    expect(getSummaryDraftStorageKey(null)).toContain('guest');
  });
});
