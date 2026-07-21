/**
 * Landing Targets — stable logical destinations for editing intent.
 *
 * A landing target names *the first interactive control the user expects to
 * edit* using a stable logical id (e.g. `insurance.life`, `loan.personal`,
 * `asset.fd`). It never encodes question indexes or route positions, so it stays
 * valid even if question ordering changes.
 *
 * Landing targets describe navigation intent ONLY. They reference a canonical
 * Question Registry field (`fieldId`) purely so the resolver can look up the
 * concrete (section, question) from the registry's own `editSurfaces` — no
 * field metadata is duplicated here.
 */

/** How the destination should be presented once reached. */
export const LANDING_CONTROLS = Object.freeze([
  'scalar', // a single value — Focused Edit opens directly (no section browsing)
  'question', // land on a specific question in a section
  'configure', // land on a question and reveal/auto-launch its Configure control
  'collection', // open a collection — instance list if any exist, else Add mode
]);

/**
 * @typedef {object} LandingTarget
 * @property {string} id                 stable logical id
 * @property {'scalar'|'question'|'configure'|'collection'} control
 * @property {string} fieldId            canonical field used to resolve the question
 * @property {string} [collectionFieldId] collection whose instances are edited
 */

/** @type {ReadonlyArray<LandingTarget>} */
export const LANDING_TARGETS = Object.freeze([
  // —— Income ——
  { id: 'income.selfSalary', control: 'scalar', fieldId: 'income.self.monthlyTakeHome' },
  { id: 'income.spouseSalary', control: 'scalar', fieldId: 'income.spouse.monthlyTakeHome' },

  // —— Expenses ——
  { id: 'expenses.household', control: 'scalar', fieldId: 'expenses.household.monthlyTotal' },

  // —— Insurance ——
  {
    id: 'insurance.life',
    control: 'collection',
    fieldId: 'protection.life.policies',
    collectionFieldId: 'protection.life.policies',
  },
  { id: 'insurance.health', control: 'configure', fieldId: 'protection.health.totalCover' },
  { id: 'insurance.vehicle', control: 'configure', fieldId: 'protection.vehicle.premiums' },

  // —— Loans (configure the EMI/loan object) ——
  { id: 'loan.home', control: 'configure', fieldId: 'debt.emi.loans' },
  { id: 'loan.personal', control: 'configure', fieldId: 'debt.emi.loans' },
  { id: 'loan.car', control: 'configure', fieldId: 'debt.emi.loans' },
  { id: 'loan.education', control: 'configure', fieldId: 'debt.emi.loans' },

  // —— Investments / recurring savings ——
  { id: 'investment.sip', control: 'scalar', fieldId: 'savings.sip' },
  { id: 'investment.ppf', control: 'scalar', fieldId: 'savings.ppf' },
  { id: 'investment.nps', control: 'scalar', fieldId: 'savings.nps' },
  {
    id: 'investment.rd',
    control: 'collection',
    fieldId: 'savings.rd',
    collectionFieldId: 'savings.rd',
  },

  // —— Assets ——
  {
    id: 'asset.fd',
    control: 'collection',
    fieldId: 'assets.fixedDeposits',
    collectionFieldId: 'assets.fixedDeposits',
  },
  { id: 'asset.mutualFunds', control: 'scalar', fieldId: 'assets.investments.mutualFunds' },
  { id: 'asset.equity', control: 'scalar', fieldId: 'assets.investments.equity' },
  {
    id: 'asset.gold',
    control: 'collection',
    fieldId: 'assets.custom',
    collectionFieldId: 'assets.custom',
  },

  // —— Goals ——
  { id: 'goal.selection', control: 'collection', fieldId: 'goals.item.name', collectionFieldId: 'goals.items' },
  { id: 'goal.years', control: 'question', fieldId: 'goals.item.yearsToGoal' },
  { id: 'goal.value', control: 'question', fieldId: 'goals.item.presentValue' },
]);

const BY_ID = new Map(LANDING_TARGETS.map((target) => [target.id, target]));

export function getLandingTarget(id) {
  return BY_ID.get(id) ?? null;
}

export function isLandingTargetId(id) {
  return BY_ID.has(id);
}

export function listLandingTargets() {
  return [...LANDING_TARGETS];
}

/** Map an experience type to a default landing control (when no explicit target). */
export function defaultControlForExperienceType(experienceType) {
  switch (experienceType) {
    case 'collection':
      return 'collection';
    case 'configure':
      return 'configure';
    case 'wizard':
    case 'read_only':
      return 'question';
    case 'scalar':
    default:
      return 'scalar';
  }
}
