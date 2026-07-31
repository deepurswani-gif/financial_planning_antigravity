/**
 * Smart-edit summary → detail write-back.
 *
 * Summary reports prefer detailed fields when present. Smart edit often writes
 * the summary snapshot path; without write-back the report stays stale.
 * Mirrors syncEmergencyFundAmount: keep the preferred detail slot aligned.
 */

import { resolveEmploymentType } from '../components/DetailedFlow/employmentTypeSync';
import {
  createEmptyIncomeDetail,
  syncSummaryAmountToDetailPrimary,
} from '../components/DetailedFlow/incomeDetailSync';
import { sumUserEducationFromChildren } from '../components/DetailedFlow/expenseDetailSync';
import {
  emptyLifeEntry,
  createPolicySlot,
  getMemberInsuranceKey,
  isLifeCoverPolicy,
  isHealthCoverPolicy,
} from '../components/DetailedFlow/insuranceDetailSync';
import { syncEmergencyFundAmount } from '../components/DetailedFlow/wealthDetailSync';

const EMI_KEYS = ['personalLoan', 'homeLoan', 'educationLoan', 'carLoan', 'twoWheelerLoan', 'otherEmi'];

function normalizeAmount(amount) {
  if (amount === null || amount === undefined) return '';
  return String(amount);
}

function blankEmiMap(existing = {}) {
  const next = { otherEmiName: existing.otherEmiName || '' };
  EMI_KEYS.forEach((key) => {
    next[key] = '';
  });
  return next;
}

function blankInsurancePremiums(insurance = {}) {
  return {
    ...insurance,
    health: { value: '', frequency: 'Annual' },
    car: { value: '', frequency: 'Annual' },
    bike: { value: '', frequency: 'Annual' },
    others: { value: '', frequency: 'Annual' },
    life: Object.fromEntries(
      Object.keys(insurance.life || {}).map((key) => [key, emptyLifeEntry()]),
    ),
  };
}

function forceIncomeDetailFromSummary(detail, amount, employmentType) {
  return syncSummaryAmountToDetailPrimary(createEmptyIncomeDetail(), amount, employmentType);
}

function writeSelfIncome(snapshot, amount) {
  const normalized = normalizeAmount(amount);
  const selfMember = snapshot.familyMembers?.find((m) => m.relation?.toLowerCase() === 'self');
  const employmentType = resolveEmploymentType(selfMember);
  const income = {
    ...snapshot.income,
    summarySelfInHand: normalized,
    self: normalized,
    selfDetail: forceIncomeDetailFromSummary(snapshot.income?.selfDetail, normalized, employmentType),
  };
  return { ...snapshot, income };
}

function writeSpouseIncome(snapshot, amount) {
  const normalized = normalizeAmount(amount);
  const spouseMember = snapshot.familyMembers?.find((m) => m.relation?.toLowerCase() === 'spouse');
  const employmentType = resolveEmploymentType(spouseMember || { employmentType: 'Private Sector' });
  const income = {
    ...snapshot.income,
    summarySpouseInHand: normalized,
    spouse: normalized,
    spouseDetail: forceIncomeDetailFromSummary(snapshot.income?.spouseDetail, normalized, employmentType),
  };
  return { ...snapshot, income };
}

function writeHouseholdTotal(snapshot, amount) {
  const normalized = normalizeAmount(amount);
  const educationMonthly = sumUserEducationFromChildren(snapshot.familyMembers || []);
  const lifestyleAmount = educationMonthly > 0
    ? String(Math.max(0, (parseFloat(normalized) || 0) - educationMonthly))
    : normalized;

  return {
    ...snapshot,
    expenseCategories: {
      ...snapshot.expenseCategories,
      summaryHouseholdTotal: normalized,
      household: {
        ...(snapshot.expenseCategories?.household || {}),
        grocery: '',
        rent: '',
        lifestyle: lifestyleAmount,
        medical: '',
        travel: '',
        // Keep profile-linked education on household only if present as a scalar;
        // child education still comes from familyMembers.
        education: '',
      },
    },
  };
}

function writeEmiTotal(snapshot, amount) {
  const normalized = normalizeAmount(amount);
  return {
    ...snapshot,
    expenseCategories: {
      ...snapshot.expenseCategories,
      summaryEmiTotal: normalized,
      emi: blankEmiMap(snapshot.expenseCategories?.emi),
    },
  };
}

function writeInsurancePremiumTotal(snapshot, amount) {
  const normalized = normalizeAmount(amount);
  return {
    ...snapshot,
    expenseCategories: {
      ...snapshot.expenseCategories,
      summaryInsuranceTotal: normalized,
      insurance: blankInsurancePremiums(snapshot.expenseCategories?.insurance),
    },
  };
}

function writeMonthlyInvestments(snapshot, amount) {
  const normalized = normalizeAmount(amount);
  const savings = snapshot.expenseCategories?.savings || {};
  return {
    ...snapshot,
    expenseCategories: {
      ...snapshot.expenseCategories,
      summaryMonthlyInvestments: normalized,
      savings: {
        ...savings,
        sip: normalized,
        ppf: '',
        nps: '',
        rd: '',
        // Preserve otherSaving — that belongs to summaryOtherSavings.
        otherSaving: savings.otherSaving ?? '',
      },
    },
  };
}

function writeOtherSavings(snapshot, amount) {
  const normalized = normalizeAmount(amount);
  const savings = snapshot.expenseCategories?.savings || {};
  return {
    ...snapshot,
    expenseCategories: {
      ...snapshot.expenseCategories,
      summaryOtherSavings: normalized,
      savings: {
        ...savings,
        otherSaving: normalized,
      },
    },
  };
}

function writeLifeCover(snapshot, amount) {
  const normalized = normalizeAmount(amount);
  const cover = parseFloat(normalized) || 0;
  const selfMember = snapshot.familyMembers?.find((m) => m.relation === 'Self')
    || { name: 'Self', relation: 'Self' };
  const selfName = getMemberInsuranceKey(selfMember);
  const policies = Array.isArray(snapshot.policies) ? [...snapshot.policies] : [];

  const lifeIndexes = policies
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => !p.isProposed && isLifeCoverPolicy(p));

  let nextPolicies;
  if (cover <= 0) {
    nextPolicies = policies.map((p) => (
      !p.isProposed && isLifeCoverPolicy(p) ? { ...p, sumAssured: '' } : p
    ));
  } else if (lifeIndexes.length === 0) {
    const slot = createPolicySlot(selfName, {}, false);
    nextPolicies = [...policies, { ...slot, sumAssured: normalized }];
  } else {
    nextPolicies = policies.map((p, idx) => {
      if (idx === lifeIndexes[0].idx) return { ...p, sumAssured: normalized };
      if (!p.isProposed && isLifeCoverPolicy(p)) return { ...p, sumAssured: '' };
      return p;
    });
  }

  return {
    ...snapshot,
    summaryLifeCover: normalized,
    hasLifeInsurance: cover > 0 ? true : snapshot.hasLifeInsurance,
    policies: nextPolicies,
  };
}

function writeHealthCover(snapshot, amount) {
  const normalized = normalizeAmount(amount);
  const cover = parseFloat(normalized) || 0;
  const selfMember = snapshot.familyMembers?.find((m) => m.relation === 'Self')
    || { name: 'Self', relation: 'Self' };
  const selfName = getMemberInsuranceKey(selfMember);
  const policies = Array.isArray(snapshot.policies) ? [...snapshot.policies] : [];

  const healthIndexes = policies
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => !p.isProposed && isHealthCoverPolicy(p));

  let nextPolicies;
  if (cover <= 0) {
    nextPolicies = policies.map((p) => (
      !p.isProposed && isHealthCoverPolicy(p) ? { ...p, sumAssured: '' } : p
    ));
  } else if (healthIndexes.length === 0) {
    const slot = {
      ...createPolicySlot(selfName, {}, false),
      planType: 'Health Insurance',
      sumAssured: normalized,
    };
    nextPolicies = [...policies, slot];
  } else {
    nextPolicies = policies.map((p, idx) => {
      if (idx === healthIndexes[0].idx) return { ...p, sumAssured: normalized };
      if (!p.isProposed && isHealthCoverPolicy(p)) return { ...p, sumAssured: '' };
      return p;
    });
  }

  return {
    ...snapshot,
    summaryHealthCover: normalized,
    hasHealthInsurance: cover > 0 ? true : snapshot.hasHealthInsurance,
    policies: nextPolicies,
  };
}

function writePortfolioValue(snapshot, amount) {
  const normalized = normalizeAmount(amount);
  const assets = snapshot.assetCategories || {};
  return {
    ...snapshot,
    assetCategories: {
      ...assets,
      summaryPortfolioValue: normalized,
      investments: {
        ...(assets.investments || {}),
        mutualFunds: normalized,
        equity: '',
        fixedDeposit: '',
      },
      insurance: {
        ...(assets.insurance || {}),
        ulip: '',
      },
      retirement: {
        ...(assets.retirement || {}),
        epf: '',
        ppf: '',
        nps: '',
      },
      realEstate: {
        ...(assets.realEstate || {}),
        landPlot: '',
      },
    },
  };
}

function writeRealEstateValue(snapshot, amount) {
  const normalized = normalizeAmount(amount);
  const assets = snapshot.assetCategories || {};
  return {
    ...snapshot,
    assetCategories: {
      ...assets,
      summaryRealEstateAssets: normalized,
      realEstate: {
        ...(assets.realEstate || {}),
        residential: normalized,
        secondProperty: '',
      },
      vehicles: {
        ...(assets.vehicles || {}),
        idv: '',
      },
      valuables: {
        ...(assets.valuables || {}),
        gold: '',
        art: '',
      },
    },
  };
}

function writeOutstandingLoans(snapshot, amount) {
  const normalized = normalizeAmount(amount);
  const liabilities = snapshot.liabilityCategories || {};
  return {
    ...snapshot,
    liabilityCategories: {
      ...liabilities,
      summaryOutstandingLoans: normalized,
      loans: {
        ...(liabilities.loans || {}),
        home: normalized,
        car: '',
        education: '',
        otherEmis: '',
      },
    },
  };
}

function writeCreditCardDues(snapshot, amount) {
  const normalized = normalizeAmount(amount);
  const liabilities = snapshot.liabilityCategories || {};
  return {
    ...snapshot,
    liabilityCategories: {
      ...liabilities,
      summaryCreditCardDues: normalized,
      loans: {
        ...(liabilities.loans || {}),
        creditCard: normalized,
      },
    },
  };
}

function writeOtherPayables(snapshot, amount) {
  const normalized = normalizeAmount(amount);
  const liabilities = snapshot.liabilityCategories || {};
  return {
    ...snapshot,
    liabilityCategories: {
      ...liabilities,
      summaryOtherPayables: normalized,
      loans: {
        ...(liabilities.loans || {}),
        personal: normalized,
      },
    },
  };
}

function writeEmergencyFund(snapshot, amount) {
  return {
    ...snapshot,
    assetCategories: syncEmergencyFundAmount(snapshot.assetCategories || {}, amount),
  };
}

/** Field ids that trigger summary → detail write-back on smart-edit save. */
export const SMART_EDIT_WRITEBACK_FIELDS = Object.freeze({
  'income.self.monthlyTakeHome': writeSelfIncome,
  'income.spouse.monthlyTakeHome': writeSpouseIncome,
  'expenses.household.monthlyTotal': writeHouseholdTotal,
  'debt.emi.monthlyTotal': writeEmiTotal,
  'expenses.insurance.monthlyPremiumTotal': writeInsurancePremiumTotal,
  'savings.monthlyInvestments': writeMonthlyInvestments,
  'savings.otherMonthlySavings': writeOtherSavings,
  'protection.life.totalCover': writeLifeCover,
  'protection.health.totalCover': writeHealthCover,
  'assets.portfolioValue': writePortfolioValue,
  'assets.realEstateValue': writeRealEstateValue,
  'assets.emergencyFund': writeEmergencyFund,
  'assets.cash.savings': writeEmergencyFund,
  'liabilities.outstandingLoans': writeOutstandingLoans,
  'liabilities.creditCardDues': writeCreditCardDues,
  'liabilities.otherPayables': writeOtherPayables,
});

/**
 * Apply summary → detail write-back for a smart-edited field.
 * @param {object} snapshot - plan snapshot (income, expenseCategories, …)
 * @param {string} fieldId - question registry field id
 * @param {*} value - saved value
 * @returns {object} next snapshot (same reference if no write-back)
 */
export function applySmartEditWriteBack(snapshot, fieldId, value) {
  const writer = SMART_EDIT_WRITEBACK_FIELDS[fieldId];
  if (!writer) return snapshot;
  return writer(snapshot, value);
}
