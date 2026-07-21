/**
 * User-facing taxonomy for Quick Edit drawer and search facets.
 */

export const UI_CATEGORIES = Object.freeze([
  { id: 'personal_information', label: 'Personal Information', order: 10 },
  { id: 'income', label: 'Income', order: 20 },
  { id: 'expenses', label: 'Expenses', order: 30 },
  { id: 'insurance', label: 'Insurance', order: 40 },
  { id: 'investments', label: 'Investments', order: 50 },
  { id: 'assets', label: 'Assets', order: 60 },
  { id: 'loans_liabilities', label: 'Loans & Liabilities', order: 70 },
  { id: 'goals', label: 'Goals', order: 80 },
  { id: 'growth_assumptions', label: 'Growth Assumptions', order: 90 },
]);

export const UI_CATEGORY_IDS = Object.freeze(UI_CATEGORIES.map((c) => c.id));

export function isUiCategoryId(id) {
  return UI_CATEGORY_IDS.includes(id);
}

export function getUiCategory(id) {
  return UI_CATEGORIES.find((c) => c.id === id) ?? null;
}

export function listUiCategories() {
  return [...UI_CATEGORIES].sort((a, b) => a.order - b.order);
}
