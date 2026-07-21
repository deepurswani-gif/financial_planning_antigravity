import { describe, expect, it } from 'vitest';
import {
  createDefaultWorkspaceState,
  hydrateWorkspaceState,
  serializeWorkspaceState,
  persistedStateNeedsMigration,
  canonicalizeIdKeyedMap,
} from './workspaceStorage';
import { resolveCanonicalId, LEGACY_ID_ALIASES } from './workspaceNavConfig';

describe('identifier standardization', () => {
  it('resolves legacy calculator and report aliases to canonical IDs', () => {
    expect(resolveCanonicalId('per_loan')).toBe('personal_loan');
    expect(resolveCanonicalId('edu_loan')).toBe('education_loan');
    expect(resolveCanonicalId('equity')).toBe('equity_etfs');
    expect(resolveCanonicalId('fd')).toBe('fixed_deposit');
    expect(resolveCanonicalId('rd')).toBe('recurring_deposit');
    expect(resolveCanonicalId('your_future_self')).toBe('future_self');
    expect(resolveCanonicalId('sip')).toBe('sip');
  });

  it('exposes only the documented legacy alias keys', () => {
    expect(Object.keys(LEGACY_ID_ALIASES).sort()).toEqual(
      ['edu_loan', 'equity', 'fd', 'per_loan', 'rd', 'tax', 'your_future_self'].sort()
    );
  });
});

describe('workspaceStorage', () => {
  it('hydrates known navigation ids and drops invalid ones', () => {
    const hydrated = hydrateWorkspaceState({
      activePrimaryId: 'wealth_creation',
      activeSecondaryId: 'sip',
      activeSummaryReportId: 'safety_net',
      activeDetailReportId: 'your_moneys_magic',
      workspaceFocus: 'summary',
      openCalculatorId: 'sip',
      visitedCalculatorIds: ['sip', 'not_real'],
    });

    expect(hydrated.activePrimaryId).toBe('wealth_creation');
    expect(hydrated.activeSecondaryId).toBe('sip');
    expect(hydrated.activeSummaryReportId).toBe('safety_net');
    expect(hydrated.activeDetailReportId).toBe('your_moneys_magic');
    expect(hydrated.workspaceFocus).toBe('summary');
    expect(hydrated.openCalculatorId).toBe('sip');
    expect(hydrated.visitedCalculatorIds).toEqual(['sip']);
    expect(hydrated.drawerOpen).toBe(false);
    expect(hydrated.mode).toBe('full');
  });

  it('hydrates summary mode and forces summary focus', () => {
    const hydrated = hydrateWorkspaceState({
      mode: 'summary',
      workspaceFocus: 'detail',
      openCalculatorId: 'sip',
      visitedCalculatorIds: ['sip'],
    });
    expect(hydrated.mode).toBe('summary');
    expect(hydrated.workspaceFocus).toBe('summary');
    expect(hydrated.openCalculatorId).toBe(null);
  });

  it('migrates legacy IDs to canonical IDs during hydrate', () => {
    const hydrated = hydrateWorkspaceState({
      activePrimaryId: 'my_loans',
      activeSecondaryId: 'per_loan',
      secondaryByPrimary: {
        my_loans: 'edu_loan',
        stable_saving: 'fd',
        wealth_creation: 'equity',
      },
      openCalculatorId: 'rd',
      lastOpenedCalculatorId: 'per_loan',
      visitedCalculatorIds: ['per_loan', 'edu_loan', 'fd', 'rd', 'equity'],
      activeSummaryReportId: 'your_future_self',
      calculatorUi: {
        per_loan: { draft: { amount: '100' } },
        fd: { draft: { amount: '200' } },
      },
      summaryReportUi: {
        your_future_self: { draft: { note: 'keep me' } },
      },
    });

    expect(hydrated.activeSecondaryId).toBe('personal_loan');
    expect(hydrated.secondaryByPrimary).toEqual({
      my_loans: 'education_loan',
      stable_saving: 'fixed_deposit',
      wealth_creation: 'equity_etfs',
    });
    expect(hydrated.openCalculatorId).toBe('recurring_deposit');
    expect(hydrated.lastOpenedCalculatorId).toBe('personal_loan');
    expect(hydrated.visitedCalculatorIds).toEqual([
      'personal_loan',
      'education_loan',
      'fixed_deposit',
      'recurring_deposit',
      'equity_etfs',
    ]);
    expect(hydrated.activeSummaryReportId).toBe('future_self');
    expect(hydrated.calculatorUi.personal_loan.draft.amount).toBe('100');
    expect(hydrated.calculatorUi.fixed_deposit.draft.amount).toBe('200');
    expect(hydrated.calculatorUi.per_loan).toBeUndefined();
    expect(hydrated.summaryReportUi.future_self.draft.note).toBe('keep me');
    expect(hydrated.summaryReportUi.your_future_self).toBeUndefined();
  });

  it('detects when persisted state needs migration', () => {
    expect(persistedStateNeedsMigration({ activeSecondaryId: 'per_loan' })).toBe(true);
    expect(persistedStateNeedsMigration({ activeSummaryReportId: 'your_future_self' })).toBe(true);
    expect(persistedStateNeedsMigration({ activeSecondaryId: 'personal_loan' })).toBe(false);
  });

  it('canonicalizes ID-keyed maps', () => {
    expect(
      canonicalizeIdKeyedMap({
        fd: { a: 1 },
        fixed_deposit: { a: 2 },
      }).fixed_deposit
    ).toEqual({ a: 2 });
  });

  it('falls back to defaults for corrupt payloads', () => {
    const defaults = createDefaultWorkspaceState();
    const hydrated = hydrateWorkspaceState({
      activePrimaryId: 'nope',
      activeSummaryReportId: 'nope',
      activeDetailReportId: 'nope',
    });

    expect(hydrated.activePrimaryId).toBeNull();
    expect(hydrated.activeSummaryReportId).toBe(defaults.activeSummaryReportId);
    expect(hydrated.activeDetailReportId).toBe(defaults.activeDetailReportId);
  });

  it('serializes durable fields only', () => {
    const state = {
      ...createDefaultWorkspaceState(),
      drawerOpen: true,
      activePrimaryId: 'my_loans',
    };
    const serialized = serializeWorkspaceState(state);
    expect(serialized.drawerOpen).toBeUndefined();
    expect(serialized.activePrimaryId).toBe('my_loans');
  });
});
