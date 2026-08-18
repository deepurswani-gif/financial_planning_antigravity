/**
 * FINBRELLA — Protection Gap / HLV Calculation Logic (Sketch)
 * -----------------------------------------------------------
 * Replaces the flat "(Expenses + EMI) x 200" formula with:
 *   1. Needs-based corpus (per person, income-share allocated)
 *   2. Classic HLV (PV of person's future net income)
 *   3. Income-based insurability cap (age-banded multiple table)
 * Final recommendation = MIN( MAX(needs, HLV), eligibility_cap )
 * The gap between "ideal" and "insurable" is surfaced explicitly.
 */

// ---------------------------------------------------------------
// 1. INCOME-BASED ELIGIBILITY TABLE
//    (industry rule-of-thumb; treat as configurable, insurers vary)
// ---------------------------------------------------------------
const INCOME_MULTIPLE_TABLE = [
  { minAge: 18, maxAge: 35, multiple: 25 },
  { minAge: 36, maxAge: 45, multiple: 20 },
  { minAge: 46, maxAge: 50, multiple: 15 },
  { minAge: 51, maxAge: 60, multiple: 10 },
  { minAge: 61, maxAge: 99, multiple: 5 },
];

function getIncomeMultiple(age) {
  const band = INCOME_MULTIPLE_TABLE.find(b => age >= b.minAge && age <= b.maxAge);
  return band ? band.multiple : 5; // conservative fallback
}

function incomeEligibilityCap(annualIncome, age) {
  return annualIncome * getIncomeMultiple(age);
}

// ---------------------------------------------------------------
// 2. NEEDS-BASED CORPUS (per person, not duplicated across spouses)
// ---------------------------------------------------------------
/**
 * @param person             { annualIncome, age, retirementAge, existingCover, liquidAssets, ownEmiShare }
 * @param household          { monthlyExpenses, otherSpouseAnnualIncome, discountRate, inflationRate }
 * @param goals              [{ amount, yearsFromNow }]  e.g. child education, marriage
 */
function needsBasedCorpus(person, household, goals = []) {
  const totalHouseholdIncome = person.annualIncome + household.otherSpouseAnnualIncome;

  // Income-share allocation: what fraction of household expenses
  // does THIS person's income currently support? That fraction is
  // what's actually at risk if this person dies (surviving spouse's
  // income continues to cover the rest).
  const incomeShare = totalHouseholdIncome > 0
    ? person.annualIncome / totalHouseholdIncome
    : 1; // single earner fallback

  const annualExpenseAtRisk = household.monthlyExpenses * 12 * incomeShare;

  // Years of income replacement needed: to the person's own
  // retirement age (proxy for "years the family depended on this income")
  const yearsToReplace = Math.max(person.retirementAge - person.age, 1);

  // PV of a growing annuity (expenses inflate, corpus discounted)
  const r = household.discountRate;      // e.g. 0.07 (post-tax investment return)
  const g = household.inflationRate;     // e.g. 0.06 (expense inflation)
  const pvExpenseReplacement = presentValueGrowingAnnuity(
    annualExpenseAtRisk, r, g, yearsToReplace
  );

  // Liabilities: this person's share of EMI-linked debt (outstanding principal,
  // not EMI x tenure — assume caller passes outstanding principal via ownEmiShare)
  const liabilities = person.ownEmiShare || 0;

  // Future goals, PV'd individually (education, marriage, etc.)
  const pvGoals = goals.reduce(
    (sum, goal) => sum + goal.amount / Math.pow(1 + r, goal.yearsFromNow),
    0
  );

  const grossNeed = pvExpenseReplacement + liabilities + pvGoals;
  const deductions = (person.existingCover || 0) + (person.liquidAssets || 0);

  return Math.max(grossNeed - deductions, 0);
}

// Present value of an annuity that grows at rate g, discounted at rate r, for n years
function presentValueGrowingAnnuity(firstPayment, r, g, n) {
  if (r === g) return firstPayment * n / (1 + r); // edge case
  const factor = (1 - Math.pow((1 + g) / (1 + r), n)) / (r - g);
  return firstPayment * factor;
}

// ---------------------------------------------------------------
// 3. CLASSIC HLV — present value of person's own future net income
//    (income they'd have earned, minus their own consumption)
// ---------------------------------------------------------------
function humanLifeValue(person, discountRate, selfConsumptionRate = 0.25) {
  const netContribution = person.annualIncome * (1 - selfConsumptionRate);
  const yearsToRetirement = Math.max(person.retirementAge - person.age, 1);
  // Flat annuity PV (simpler than growing-annuity version above;
  // use growth-adjusted version if you want salary growth built in)
  const r = discountRate;
  const pv = netContribution * (1 - Math.pow(1 + r, -yearsToRetirement)) / r;
  return pv;
}

// ---------------------------------------------------------------
// 4. FINAL RECOMMENDATION PER PERSON
// ---------------------------------------------------------------
function recommendCover(person, household, goals) {
  const needs = needsBasedCorpus(person, household, goals);
  const hlv = humanLifeValue(person, household.discountRate);
  const idealCover = Math.max(needs, hlv);

  const cap = incomeEligibilityCap(person.annualIncome, person.age);
  const recommendedSA = Math.min(idealCover, cap);

  return {
    idealCover: Math.round(idealCover),
    insurabilityCap: Math.round(cap),
    recommendedSA: Math.round(recommendedSA),
    shortfall: Math.max(Math.round(idealCover - cap), 0),
    isCapped: idealCover > cap,
  };
}

// ---------------------------------------------------------------
// EXAMPLE — matches the husband/wife scenario discussed
// ---------------------------------------------------------------
const household = {
  monthlyExpenses: 130000,
  discountRate: 0.07,
  inflationRate: 0.06,
};

const husband = {
  annualIncome: 200000 * 12,   // 24,00,000
  age: 35,
  retirementAge: 60,
  existingCover: 0,
  liquidAssets: 0,
  ownEmiShare: 0,
};
household.otherSpouseAnnualIncome = 50000 * 12; // for husband's calc, spouse income = wife's
const husbandResult = recommendCover(husband, household, []);

const wife = {
  annualIncome: 50000 * 12,    // 6,00,000
  age: 33,
  retirementAge: 60,
  existingCover: 0,
  liquidAssets: 0,
  ownEmiShare: 0,
};
household.otherSpouseAnnualIncome = 200000 * 12; // for wife's calc, spouse income = husband's
const wifeResult = recommendCover(wife, household, []);

console.log("Husband:", husbandResult);
console.log("Wife:", wifeResult);

/**
 * Expected shape of output (illustrative, actual numbers depend on
 * discount/inflation rates you finalize):
 *
 * Husband: { idealCover: ~2.3-2.6 Cr, insurabilityCap: ~4.8-6 Cr,
 *            recommendedSA: ideal figure (not capped), shortfall: 0 }
 *
 * Wife:    { idealCover: ~0.6-0.9 Cr, insurabilityCap: ~0.9-1.5 Cr,
 *            recommendedSA: min of the two, shortfall: likely 0 here
 *            since her income share of the need is small — but tune
 *            selfConsumptionRate / incomeShare logic to see this
 *            flip for higher-need, lower-income scenarios }
 */

module.exports = {
  getIncomeMultiple,
  incomeEligibilityCap,
  needsBasedCorpus,
  humanLifeValue,
  recommendCover,
};
