import { describe, expect, it } from 'vitest';
import {
  QUESTION_REGISTRY,
  getFieldById,
  getRegistryDiagnostics,
  listFields,
  listFrequentlyUpdated,
  listSuggested,
  listDefaultPinFieldIds,
  resolveEditTarget,
  searchQuestionFields,
} from './index';
import { validateField } from './schema';
import {
  SUMMARY_QUESTION_IDS_BY_SECTION,
  DETAILED_QUESTION_IDS_BY_SECTION,
  getFieldIdsForLegacyQuestion,
} from './legacyQuestionMap';
import { SECTION_IDS } from '../components/FinancialWorkspace/sectionIds';
import { EDIT_EXPERIENCE_TYPES } from './editExperiences';

describe('questionRegistry Phase 1', () => {
  it('loads a non-empty Summary seed without schema errors', () => {
    expect(QUESTION_REGISTRY.length).toBeGreaterThanOrEqual(25);
    const diagnostics = getRegistryDiagnostics();
    expect(diagnostics.errorCount, JSON.stringify(diagnostics.issues, null, 2)).toBe(0);
  });

  it('has unique field ids', () => {
    const ids = QUESTION_REGISTRY.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('requires independent importance and quickEditPriority on every entry', () => {
    for (const field of QUESTION_REGISTRY) {
      expect(field.importance).toBeTruthy();
      expect(field.quickEditPriority).toBeTruthy();
      const errors = validateField(field);
      expect(errors, field.id).toEqual([]);
    }
  });

  it('keeps DOB as critical importance but low Quick Edit priority', () => {
    const dob = getFieldById('family.self.dob');
    expect(dob.importance).toBe('critical');
    expect(dob.quickEditPriority).toBe('low');
  });

  it('keeps salary as critical importance with high Quick Edit priority', () => {
    const salary = getFieldById('income.self.monthlyTakeHome');
    expect(salary.importance).toBe('critical');
    expect(salary.quickEditPriority).toBe('high');
  });

  it('maps every Summary progressive question (except narrative) to at least one surface', () => {
    const mapped = new Set();
    for (const field of QUESTION_REGISTRY) {
      for (const surface of field.editSurfaces ?? []) {
        if (surface.flow === 'summary') mapped.add(surface.questionId);
      }
    }

    for (const [sectionId, questionIds] of Object.entries(SUMMARY_QUESTION_IDS_BY_SECTION)) {
      expect(Object.values(SECTION_IDS)).toContain(sectionId);
      for (const questionId of questionIds) {
        if (questionId === 'INTRO' || questionId === 'SUMMARY') continue;
        expect(mapped.has(questionId), `${sectionId}/${questionId}`).toBe(true);
      }
    }
  });

  it('uses stable section ids on all edit surfaces', () => {
    const stable = new Set(Object.values(SECTION_IDS));
    for (const field of QUESTION_REGISTRY) {
      for (const surface of field.editSurfaces ?? []) {
        expect(stable.has(surface.sectionId), `${field.id} → ${surface.sectionId}`).toBe(true);
      }
    }
  });

  it('searches by alias and id', () => {
    const byAlias = searchQuestionFields('emergency');
    expect(byAlias.some((f) => f.id === 'assets.emergencyFund')).toBe(true);

    const byId = searchQuestionFields('family.self.dob');
    expect(byId[0]?.id).toBe('family.self.dob');
  });

  it('ranks Frequently Updated by quickEditPriority only', () => {
    const frequent = listFrequentlyUpdated(QUESTION_REGISTRY);
    expect(frequent.every((f) => f.quickEditPriority === 'critical')).toBe(true);
    expect(frequent.some((f) => f.id === 'family.self.dob')).toBe(false);
  });

  it('lists suggested edits from high quickEditPriority', () => {
    const suggested = listSuggested(QUESTION_REGISTRY);
    expect(suggested.length).toBeGreaterThan(0);
    expect(
      suggested.every((f) => f.quickEditPriority === 'high' || f.quickEditPriority === 'critical'),
    ).toBe(true);
  });

  it('default pins use quickEditPriority critical fields', () => {
    const pins = listDefaultPinFieldIds(QUESTION_REGISTRY);
    expect(pins.length).toBeGreaterThan(0);
    expect(pins.every((id) => getFieldById(id).quickEditPriority === 'critical')).toBe(true);
  });

  it('resolves edit targets for summary capability', () => {
    const field = getFieldById('savings.monthlyInvestments');
    const target = resolveEditTarget(field, { capability: 'summary' });
    expect(target.sectionId).toBe(SECTION_IDS.SAVINGS);
    expect(target.questionId).toBe('savings-investments');
    expect(target.flow).toBe('summary');
  });

  it('filters by uiCategory', () => {
    const insurance = listFields({ uiCategory: 'insurance' });
    expect(insurance.length).toBeGreaterThan(0);
    expect(insurance.every((f) => f.uiCategory === 'insurance')).toBe(true);
  });
});

describe('questionRegistry Phase 2', () => {
  it('includes Detailed-only fields and growth assumptions', () => {
    expect(QUESTION_REGISTRY.length).toBeGreaterThanOrEqual(60);
    expect(getFieldById('family.children')).toBeTruthy();
    expect(getFieldById('debt.emi.loans')).toBeTruthy();
    expect(getFieldById('protection.life.policies')).toBeTruthy();
    expect(getFieldById('assumptions.incomeGrowthRate')).toBeTruthy();
    expect(getFieldById('assets.custom')).toBeTruthy();
  });

  it('maps every Detailed question id (per section) to at least one surface', () => {
    /** @type {Map<string, Set<string>>} */
    const mapped = new Map();
    for (const field of QUESTION_REGISTRY) {
      for (const surface of field.editSurfaces ?? []) {
        if (surface.flow !== 'detailed') continue;
        if (!mapped.has(surface.sectionId)) mapped.set(surface.sectionId, new Set());
        mapped.get(surface.sectionId).add(surface.questionId);
      }
    }

    for (const [sectionId, questionIds] of Object.entries(DETAILED_QUESTION_IDS_BY_SECTION)) {
      const set = mapped.get(sectionId) ?? new Set();
      for (const questionId of questionIds) {
        expect(set.has(questionId), `${sectionId}/${questionId}`).toBe(true);
      }
    }
  });

  it('registers breakdown, collection, and modal edit experiences', () => {
    const types = new Set(QUESTION_REGISTRY.map((f) => f.editExperience?.type));
    expect(types.has('breakdown')).toBe(true);
    expect(types.has('collection')).toBe(true);
    expect(types.has('modal')).toBe(true);
    for (const type of types) {
      expect(EDIT_EXPERIENCE_TYPES.includes(type), type).toBe(true);
    }
  });

  it('declares modalIds for EMI, life policy, and investment modals', () => {
    expect(getFieldById('debt.emi.loans').editExperience.modalId).toBe('loanDetails');
    expect(getFieldById('protection.life.policies').editExperience.modalId).toBe(
      'lifePolicyDetails',
    );
    expect(getFieldById('savings.ppf').editExperience.modalId).toBe('investmentDetails');
    expect(getFieldById('assets.fixedDeposits').editExperience.modalId).toBe('investmentDetails');
  });

  it('resolves breakdown intent to detailed savings breakup', () => {
    const field = getFieldById('savings.monthlyInvestments');
    const target = resolveEditTarget(field, { capability: 'full', intent: 'breakdown' });
    expect(target.flow).toBe('detailed');
    expect(target.sectionId).toBe(SECTION_IDS.MONEY_IN_MONEY_OUT);
    expect(target.questionId).toBe('savings-breakdown');
  });

  it('disambiguates colliding recap question ids by section', () => {
    const familyRecap = getFieldIdsForLegacyQuestion('recap', SECTION_IDS.FAMILY_INFORMATION);
    const moneyRecap = getFieldIdsForLegacyQuestion('recap', SECTION_IDS.MONEY_IN_MONEY_OUT);
    expect(familyRecap).toContain('family.self.dob');
    expect(moneyRecap).toContain('income.self.monthlyTakeHome');
    expect(familyRecap).not.toEqual(moneyRecap);
  });

  it('reports no unmapped detailed questions in diagnostics', () => {
    const diagnostics = getRegistryDiagnostics();
    const unmapped = diagnostics.issues.filter((i) => i.code === 'unmapped_detailed_question');
    expect(unmapped, JSON.stringify(unmapped, null, 2)).toEqual([]);
  });

  it('keeps growthExpectations section id without requiring drawer registration', () => {
    expect(SECTION_IDS.GROWTH_EXPECTATIONS).toBe('growthExpectations');
    const growth = getFieldById('assumptions.householdInflationRate');
    expect(growth.editSurfaces[0].sectionId).toBe(SECTION_IDS.GROWTH_EXPECTATIONS);
  });
});
