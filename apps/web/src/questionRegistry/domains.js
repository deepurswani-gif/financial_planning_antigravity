/**
 * Technical domain ids — code organization only; never shown in Quick Edit UI.
 */

export const DOMAINS = Object.freeze([
  { id: 'family', label: 'Family' },
  { id: 'income', label: 'Income' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'protection', label: 'Protection' },
  { id: 'debt', label: 'Debt' },
  { id: 'savings', label: 'Savings' },
  { id: 'assets', label: 'Assets' },
  { id: 'liabilities', label: 'Liabilities' },
  { id: 'goals', label: 'Goals' },
  { id: 'assumptions', label: 'Assumptions' },
]);

export const DOMAIN_IDS = Object.freeze(DOMAINS.map((d) => d.id));

export function isDomainId(id) {
  return DOMAIN_IDS.includes(id);
}
