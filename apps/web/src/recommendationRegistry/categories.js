/**
 * Recommendation categories — high-level financial DOMAINS only.
 *
 * Categories intentionally stay coarse (Phase 6 Refinement 2). Granular
 * concepts like "Protection Gap", "Goal Funding Gap" or "High EMI Burden"
 * are modelled as recommendation TYPES (see recommendationTypes.js), not
 * categories. Keeping categories domain-level keeps grouping clean and
 * scalable for dashboards, notifications and AI assistants.
 *
 * Extensible: append to CATEGORIES to introduce a new domain.
 */

export const CATEGORIES = Object.freeze([
  { id: 'protection', label: 'Protection' },
  { id: 'emergency', label: 'Emergency' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'investments', label: 'Investments' },
  { id: 'retirement', label: 'Retirement' },
  { id: 'goals', label: 'Goals' },
  { id: 'tax', label: 'Tax' },
  { id: 'wealth', label: 'Wealth' },
  { id: 'behaviour', label: 'Behaviour' },
]);

const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));
const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function isCategoryId(value) {
  return CATEGORY_IDS.has(value);
}

export function getCategory(id) {
  return BY_ID.get(id) ?? null;
}

export function listCategories() {
  return [...CATEGORIES];
}
