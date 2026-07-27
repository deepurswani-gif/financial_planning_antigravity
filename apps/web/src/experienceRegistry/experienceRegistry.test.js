import { describe, it, expect } from 'vitest';
import {
  EXPERIENCE_REGISTRY,
  getExperienceById,
  listExperiences,
  searchExperiences,
  listFrequentlyUpdatedExperiences,
  listExperienceCategories,
  resolveLaunch,
  getExperienceRegistryDiagnostics,
} from './index';
import { validateExperience } from './schema';
import {
  EXPERIENCE_TYPES,
  LAUNCH_STRATEGIES,
} from './experienceTypes';
import { UI_CATEGORY_IDS } from '../questionRegistry/uiCategories';

describe('Experience Registry — integrity', () => {
  it('every experience is valid and ids are unique', () => {
    const ids = new Set();
    for (const experience of EXPERIENCE_REGISTRY) {
      expect(validateExperience(experience)).toEqual([]);
      expect(ids.has(experience.id)).toBe(false);
      ids.add(experience.id);
    }
  });

  it('covers every browsable registry field (no gaps)', () => {
    const diagnostics = getExperienceRegistryDiagnostics();
    expect(diagnostics.uncoveredBrowsableFieldIds).toEqual([]);
    expect(diagnostics.curated).toBeGreaterThan(0);
    expect(diagnostics.derived).toBeGreaterThan(0);
  });

  it('supports all experience types and launch strategies', () => {
    const types = new Set(EXPERIENCE_REGISTRY.map((e) => e.experienceType));
    const strategies = new Set(EXPERIENCE_REGISTRY.map((e) => e.launchStrategy));
    for (const type of EXPERIENCE_TYPES) expect(types.has(type)).toBe(true);
    for (const strategy of LAUNCH_STRATEGIES) expect(strategies.has(strategy)).toBe(true);
  });

  it('exposes the curated flagship experiences', () => {
    for (const id of [
      'income.salary',
      'expenses.household',
      'goals.collection',
      'family.children',
      'protection.lifeInsurance',
      'liabilities.homeLoan',
      'assets.fixedDeposits',
      'planning.incomeTax',
      'explain.totalEmi',
      'savings.addPpf',
      'savings.addNps',
      'savings.addRecurringDeposit',
      'assets.addFixedDeposit',
      'protection.vehicleInsurance',
    ]) {
      expect(getExperienceById(id)).not.toBeNull();
    }
  });
});

describe('Experience Registry — search represents intent, not fields', () => {
  const topId = (query) => searchExperiences(query)[0]?.id;

  it('“Salary” → Monthly Salary experience', () => {
    expect(topId('Salary')).toBe('income.salary');
  });

  it('“Home Loan” → Home Loan experience', () => {
    expect(topId('Home Loan')).toBe('liabilities.homeLoan');
  });

  it('“Life Insurance” → Life Insurance Policies experience', () => {
    expect(topId('Life Insurance')).toBe('protection.lifeInsurance');
  });

  it('“Goals” → Goals collection experience', () => {
    expect(topId('Goals')).toBe('goals.collection');
  });

  it('“Children” → Children experience', () => {
    expect(topId('Children')).toBe('family.children');
  });

  it('“Add Recurring Deposit” → add RD experience', () => {
    expect(topId('Add Recurring Deposit')).toBe('savings.addRecurringDeposit');
  });

  it('“Add PPF” / “Add NPS” / “Add FD” → add experiences', () => {
    expect(topId('Add PPF')).toBe('savings.addPpf');
    expect(topId('Add NPS')).toBe('savings.addNps');
    expect(topId('Add Fixed Deposit')).toBe('assets.addFixedDeposit');
  });

  it('“Car insurance” / “two-wheeler insurance” → vehicle insurance screen', () => {
    expect(topId('Car insurance')).toBe('protection.vehicleInsurance');
    expect(topId('two-wheeler insurance')).toBe('protection.vehicleInsurance');
  });

  it('returns nothing for an empty query', () => {
    expect(searchExperiences('')).toEqual([]);
  });
});

describe('Experience Registry — launch resolution (reuses existing surfaces)', () => {
  it('scalar → focused edit session on the canonical field', () => {
    const d = resolveLaunch(getExperienceById('income.salary'), { capability: 'summary' });
    expect(d.strategy).toBe('focused_edit_session');
    expect(d.fieldId).toBe('income.self.monthlyTakeHome');
  });

  it('collection → collection picker with an existing section', () => {
    const d = resolveLaunch(getExperienceById('goals.collection'), { capability: 'summary' });
    expect(d.strategy).toBe('collection_picker');
    expect(d.sectionId).toBeTruthy();
    expect(d.collectionResolver?.collectionFieldId).toBe('goals.items');
  });

  it('configure_modal → existing calculator modal id', () => {
    const d = resolveLaunch(getExperienceById('planning.incomeTax'), { capability: 'full' });
    expect(d.strategy).toBe('configure_modal');
    expect(d.calculatorId).toBe('income_tax');
  });

  it('configure_screen → existing section, no new mapping', () => {
    const d = resolveLaunch(getExperienceById('liabilities.homeLoan'), { capability: 'full' });
    expect(d.strategy).toBe('configure_screen');
    expect(d.sectionId).toBeTruthy();
  });

  it('PPF/NPS land on savings-breakdown (not focused edit)', () => {
    for (const id of ['savings.ppf', 'savings.nps', 'savings.addPpf', 'savings.addNps']) {
      const d = resolveLaunch(getExperienceById(id), { capability: 'full' });
      expect(d.strategy).toBe('configure_screen');
      expect(d.landingQuestionId).toBe('savings-breakdown');
      expect(d.sectionId).toBeTruthy();
    }
  });

  it('Add RD lands on savings-breakdown without requiring activation', () => {
    const d = resolveLaunch(getExperienceById('savings.addRecurringDeposit'), { capability: 'full' });
    expect(d.strategy).toBe('collection_picker');
    expect(d.landingQuestionId).toBe('savings-breakdown');
    expect(getExperienceById('savings.addRecurringDeposit').activation).toBeNull();
  });

  it('Add FD lands on wealth assets-breakdown without requiring activation', () => {
    const d = resolveLaunch(getExperienceById('assets.addFixedDeposit'), { capability: 'full' });
    expect(d.strategy).toBe('collection_picker');
    expect(d.landingQuestionId).toBe('assets-breakdown');
    expect(getExperienceById('assets.addFixedDeposit').activation).toBeNull();
  });

  it('vehicle insurance lands on vehicle-other-insurance (not focused edit)', () => {
    const d = resolveLaunch(getExperienceById('protection.vehicleInsurance'), { capability: 'full' });
    expect(d.strategy).toBe('configure_screen');
    expect(d.landingQuestionId).toBe('vehicle-other-insurance');
    expect(getExperienceById('protection.vehicleInsurance').activation).toBeNull();
  });

  it('read_only → explanation prose, not an edit', () => {
    const d = resolveLaunch(getExperienceById('explain.totalEmi'), { capability: 'full' });
    expect(d.strategy).toBe('readonly_explanation');
    expect(d.explanation).toBeTruthy();
  });
});

describe('Experience Registry — Frequently Updated + categories', () => {
  it('Frequently Updated is metadata-driven and capped', () => {
    const items = listFrequentlyUpdatedExperiences({ limit: 6 });
    expect(items.length).toBeLessThanOrEqual(6);
    for (const experience of items) {
      expect(['high', 'critical']).toContain(experience.quickEditPriority);
    }
  });

  it('category browse tree uses known UI categories only', () => {
    const tree = listExperienceCategories();
    expect(tree.length).toBeGreaterThan(0);
    for (const category of tree) {
      expect(UI_CATEGORY_IDS).toContain(category.id);
      expect(category.experiences.length).toBeGreaterThan(0);
    }
  });

  it('can filter to curated-only experiences', () => {
    const curated = listExperiences({ curatedOnly: true });
    expect(curated.length).toBeGreaterThan(0);
    expect(curated.every((e) => !e.derived)).toBe(true);
  });
});
