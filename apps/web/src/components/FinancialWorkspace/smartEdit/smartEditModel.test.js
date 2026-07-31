import { describe, it, expect, vi } from 'vitest';
import {
  buildFrequentlyUpdated,
  buildCategoryTree,
  searchSmartEdit,
  describeExperience,
  canLaunchSmartEditTarget,
  resolveTargetAvailability,
} from './smartEditModel';
import { getExperienceById } from '../../../experienceRegistry';
import { UI_CATEGORY_IDS } from '../../../questionRegistry/uiCategories';

describe('smartEditModel — experience-based Frequently Updated', () => {
  it('returns experience descriptors capped at the limit', () => {
    const items = buildFrequentlyUpdated({ limit: 6 });
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(6);
    for (const item of items) {
      expect(item.experienceId).toBeTruthy();
      expect(item.name).toBeTruthy();
    }
  });
});

describe('smartEditModel — category browsing', () => {
  it('returns non-empty categories with experience descriptors', () => {
    const tree = buildCategoryTree();
    expect(tree.length).toBeGreaterThan(0);
    for (const category of tree) {
      expect(UI_CATEGORY_IDS).toContain(category.id);
      expect(category.items.length).toBeGreaterThan(0);
      for (const item of category.items) {
        expect(item.experienceId).toBeTruthy();
      }
    }
  });
});

describe('smartEditModel — search returns experiences', () => {
  it('returns nothing for an empty query', () => {
    expect(searchSmartEdit('')).toEqual([]);
    expect(searchSmartEdit('   ')).toEqual([]);
  });

  it('searching “Salary” surfaces the Monthly Salary experience', () => {
    const results = searchSmartEdit('Salary');
    expect(results[0].experienceId).toBe('income.salary');
    expect(results[0].name).toBe('Monthly Salary');
  });

  it('searching “Home Loan” surfaces the Home Loan experience', () => {
    const results = searchSmartEdit('Home Loan');
    expect(results.some((r) => r.experienceId === 'liabilities.homeLoan')).toBe(true);
  });
});

describe('smartEditModel — descriptors', () => {
  it('describes an experience with name, category and collection flag', () => {
    const descriptor = describeExperience(getExperienceById('goals.collection'));
    expect(descriptor.experienceId).toBe('goals.collection');
    expect(descriptor.name).toBe('Goals');
    expect(descriptor.category).toBe('Goals');
    expect(descriptor.isCollection).toBe(true);
  });

  it('returns null for a missing experience', () => {
    expect(describeExperience(null)).toBeNull();
  });
});

describe('smartEditModel — Experience Availability Resolver', () => {
  it('Summary user sees Summary experiences as available / launchable', () => {
    const salary = describeExperience(getExperienceById('income.salary'), {
      capability: 'summary',
    });
    expect(salary.availability.available).toBe(true);
    expect(salary.availability.locked).toBe(false);
    expect(canLaunchSmartEditTarget(salary, { capability: 'summary' })).toBe(true);
  });

  it('Summary user sees Detailed experiences as locked with upgrade subtitle', () => {
    const homeLoan = describeExperience(getExperienceById('liabilities.homeLoan'), {
      capability: 'summary',
    });
    expect(homeLoan).not.toBeNull();
    expect(homeLoan.availability.locked).toBe(true);
    expect(homeLoan.availability.action).toBe('upgrade');
    expect(homeLoan.description).toBe('Available in Complete Financial Planning');
    expect(canLaunchSmartEditTarget(homeLoan, { capability: 'summary' })).toBe(false);
  });

  it('search keeps locked Detailed experiences visible for Summary users', () => {
    const homeLoan = searchSmartEdit('Home Loan', { capability: 'summary' }).find(
      (r) => r.experienceId === 'liabilities.homeLoan',
    );
    expect(homeLoan).toBeTruthy();
    expect(homeLoan.availability.locked).toBe(true);
    expect(canLaunchSmartEditTarget(homeLoan, { capability: 'summary' })).toBe(false);

    const life = searchSmartEdit('Life Insurance', { capability: 'summary' }).find(
      (r) => r.experienceId === 'protection.lifeInsurance',
    );
    expect(life).toBeTruthy();
    expect(life.availability.locked).toBe(true);

    const emi = searchSmartEdit('EMI', { capability: 'summary' }).find(
      (r) => r.experienceId === 'debt.loans',
    );
    expect(emi).toBeTruthy();
    expect(emi.availability.locked).toBe(true);
    expect(emi.description).toBe('Available in Complete Financial Planning');
  });

  it('Frequently Updated and Browse Categories keep locked items for Summary users', () => {
    const frequent = buildFrequentlyUpdated({ limit: 6, capability: 'summary' });
    expect(frequent.length).toBeGreaterThan(0);
    // Every visible item carries an availability model; none are hidden.
    for (const item of frequent) {
      expect(item.availability).toBeTruthy();
      expect(item.availability.hidden).toBe(false);
    }

    const tree = buildCategoryTree({ capability: 'summary' });
    const lockedSomewhere = tree.some((cat) =>
      cat.items.some((item) => item.availability?.locked),
    );
    expect(lockedSomewhere).toBe(true);
  });

  it('paid users retain existing launchable behaviour', () => {
    const homeLoan = describeExperience(getExperienceById('liabilities.homeLoan'), {
      capability: 'full',
    });
    expect(homeLoan.availability.available).toBe(true);
    expect(canLaunchSmartEditTarget(homeLoan, { capability: 'full' })).toBe(true);

    const results = searchSmartEdit('Home Loan', { capability: 'full' });
    const match = results.find((r) => r.experienceId === 'liabilities.homeLoan');
    expect(match.availability.locked).toBe(false);
  });

  it('hidden experiences never appear in search or browse', () => {
    const hiddenExperience = {
      id: 'future.advisorOnly',
      title: 'Advisor Review',
      aliases: [],
      experienceType: 'configure',
      launchStrategy: 'configure_screen',
      capability: 'any',
      requiredCapabilities: ['advisor'],
      uiCategory: 'protection',
      businessMeaning: 'Advisor-only experience',
    };
    expect(
      describeExperience(hiddenExperience, { capability: 'full' }),
    ).toBeNull();
  });

  it('resolveTargetAvailability locks footer Income Tax for Summary users', () => {
    const availability = resolveTargetAvailability('planning.incomeTax', {
      capability: 'summary',
    });
    expect(availability.locked).toBe(true);
    expect(availability.action).toBe('upgrade');
  });

  it('locked experiences never launch — callers must use onLockedExperience', () => {
    const onLaunch = vi.fn();
    const onLocked = vi.fn();
    const item = describeExperience(getExperienceById('liabilities.homeLoan'), {
      capability: 'summary',
    });

    // Mirror Smart Edit Drawer selection policy (pure assertion of the contract).
    const availability = item.availability;
    if (availability.locked || availability.action === 'upgrade') {
      onLocked(item, availability);
    } else if (availability.available && availability.action === 'launch') {
      onLaunch(item);
    }

    expect(onLaunch).not.toHaveBeenCalled();
    expect(onLocked).toHaveBeenCalledTimes(1);
    expect(onLocked.mock.calls[0][1].action).toBe('upgrade');
  });
});
