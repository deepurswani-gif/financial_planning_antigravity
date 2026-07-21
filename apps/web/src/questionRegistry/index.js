import { FAMILY_FIELDS } from './fields/family';
import { INCOME_FIELDS } from './fields/income';
import { EXPENSE_FIELDS } from './fields/expenses';
import { DEBT_FIELDS } from './fields/debt';
import { PROTECTION_FIELDS } from './fields/protection';
import { SAVINGS_FIELDS } from './fields/savings';
import { ASSET_FIELDS } from './fields/assets';
import { LIABILITY_FIELDS } from './fields/liabilities';
import { GOAL_FIELDS } from './fields/goals';
import { ASSUMPTION_FIELDS } from './fields/assumptions';
import { assertField } from './schema';
import { listUiCategories, getUiCategory } from './uiCategories';
import { searchFields } from './search';
import {
  listFrequentlyUpdated,
  listSuggested,
  listDefaultPinFieldIds,
} from './rankQuickEdit';
import { resolveEditTarget, getImpactedReports } from './resolveEditTarget';
import { validateRegistry } from './validateRegistry';

const ALL_FIELDS = [
  ...FAMILY_FIELDS,
  ...INCOME_FIELDS,
  ...EXPENSE_FIELDS,
  ...DEBT_FIELDS,
  ...PROTECTION_FIELDS,
  ...SAVINGS_FIELDS,
  ...ASSET_FIELDS,
  ...LIABILITY_FIELDS,
  ...GOAL_FIELDS,
  ...ASSUMPTION_FIELDS,
];

// Fail fast in development if a seed entry is malformed.
ALL_FIELDS.forEach(assertField);

/** @type {ReadonlyArray<import('./schema').QuestionField>} */
export const QUESTION_REGISTRY = Object.freeze(ALL_FIELDS);

const BY_ID = new Map(QUESTION_REGISTRY.map((field) => [field.id, field]));

export function listFields(options = {}) {
  let fields = [...QUESTION_REGISTRY];
  if (options.uiCategory) {
    fields = fields.filter((f) => f.uiCategory === options.uiCategory);
  }
  if (options.domain) {
    fields = fields.filter((f) => f.domain === options.domain);
  }
  if (options.kind) {
    fields = fields.filter((f) => f.kind === options.kind);
  }
  if (options.importance) {
    fields = fields.filter((f) => f.importance === options.importance);
  }
  if (options.quickEditPriority) {
    fields = fields.filter((f) => f.quickEditPriority === options.quickEditPriority);
  }
  return fields;
}

export function getFieldById(id) {
  return BY_ID.get(id) ?? null;
}

export function hasField(id) {
  return BY_ID.has(id);
}

export function searchQuestionFields(query, options = {}) {
  return searchFields(listFields(options), query);
}

export {
  listUiCategories,
  getUiCategory,
  listFrequentlyUpdated,
  listSuggested,
  listDefaultPinFieldIds,
  resolveEditTarget,
  getImpactedReports,
  validateRegistry,
};

export function getRegistryDiagnostics() {
  return validateRegistry(QUESTION_REGISTRY);
}
