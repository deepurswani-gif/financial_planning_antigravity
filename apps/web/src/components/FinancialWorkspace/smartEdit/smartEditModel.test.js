import { describe, it, expect } from 'vitest';
import {
  buildFrequentlyUpdated,
  buildCategoryTree,
  searchSmartEdit,
  describeExperience,
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
