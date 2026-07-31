import { describe, it, expect } from 'vitest';
import { applySmartEditWriteBack } from './smartEditWriteBack';
import { getEffectiveMonthlyHousehold, getEffectiveMonthlyEmi } from '../components/DetailedFlow/expenseDetailSync';
import { getEffectiveMonthlyInsurance } from '../components/DetailedFlow/insuranceDetailSync';
import { getEffectiveMonthlySavings, getGrowthSavingsMonthly } from '../components/DetailedFlow/savingsDetailSync';
import { getEmergencyFundAmount } from '../components/DetailedFlow/wealthDetailSync';
import { getEffectiveLifeCover, getEffectiveHealthCover } from '../components/DetailedFlow/insuranceDetailSync';
import { calculateNetWorth } from '../components/AssetModule/AssetLogic';

function baseSnapshot(overrides = {}) {
  return {
    familyMembers: [{ name: 'Alex', relation: 'Self', employmentType: 'Private Sector' }],
    income: {
      summarySelfInHand: '50000',
      self: '50000',
      selfDetail: { inHandSalary: '80000', passiveIncome: '5000' },
    },
    expenseCategories: {
      summaryHouseholdTotal: '30000',
      household: { grocery: '10000', rent: '15000', lifestyle: '5000', medical: '', travel: '' },
      summaryEmiTotal: '5000',
      emi: { homeLoan: { principal: 1000000, emi: '20000', rate: 8, tenure: 20 } },
      summaryInsuranceTotal: '2000',
      insurance: {
        health: { value: '24000', frequency: 'Annual' },
        life: { Self: { policyCount: 1, premiums: [{ amount: '12000', frequency: 'Annual' }], value: '12000', frequency: 'Annual' } },
      },
      summaryMonthlyInvestments: '10000',
      summaryOtherSavings: '2000',
      savings: {
        sip: { amount: '15000' },
        ppf: { amount: '3000' },
        nps: '',
        rd: '',
        otherSaving: '2000',
      },
    },
    assetCategories: {
      summaryLiquidCash: '100000',
      summaryPortfolioValue: '500000',
      summaryRealEstateAssets: '2000000',
      cash: { savings: '250000', cashInHand: '' },
      investments: { equity: '100000', mutualFunds: '400000', fixedDeposit: '' },
      realEstate: { residential: '2000000', secondProperty: '', landPlot: '' },
      insurance: { ulip: '' },
      retirement: { epf: '', ppf: '', nps: '' },
      vehicles: { idv: '' },
      valuables: { gold: '', art: '' },
    },
    liabilityCategories: {
      summaryOutstandingLoans: '1000000',
      summaryCreditCardDues: '20000',
      summaryOtherPayables: '10000',
      loans: { home: '1000000', creditCard: '20000', personal: '10000', car: '50000', education: '', otherEmis: '' },
    },
    policies: [
      { id: '1', insuredName: 'Alex', planType: 'Term Insurance', sumAssured: '1000000', isProposed: false },
    ],
    summaryLifeCover: '0',
    summaryHealthCover: '',
    hasLifeInsurance: false,
    hasHealthInsurance: false,
    ...overrides,
  };
}

describe('applySmartEditWriteBack', () => {
  it('writes income summary into detail primary and clears breakdown extras', () => {
    const next = applySmartEditWriteBack(baseSnapshot(), 'income.self.monthlyTakeHome', '90000');
    expect(next.income.summarySelfInHand).toBe('90000');
    expect(next.income.selfDetail.inHandSalary).toBe('90000');
    expect(next.income.selfDetail.passiveIncome).toBeFalsy();
  });

  it('makes household effective total follow summary edit', () => {
    const next = applySmartEditWriteBack(baseSnapshot(), 'expenses.household.monthlyTotal', '45000');
    expect(next.expenseCategories.summaryHouseholdTotal).toBe('45000');
    expect(getEffectiveMonthlyHousehold(next.expenseCategories, next.familyMembers)).toBe(45000);
  });

  it('clears configured EMIs so summary EMI wins', () => {
    const next = applySmartEditWriteBack(baseSnapshot(), 'debt.emi.monthlyTotal', '12000');
    expect(next.expenseCategories.summaryEmiTotal).toBe('12000');
    expect(getEffectiveMonthlyEmi(next.expenseCategories)).toBe(12000);
  });

  it('clears insurance premiums so summary insurance wins', () => {
    const next = applySmartEditWriteBack(baseSnapshot(), 'expenses.insurance.monthlyPremiumTotal', '3500');
    expect(getEffectiveMonthlyInsurance(next.expenseCategories)).toBe(3500);
  });

  it('aligns growth savings with monthly investments edit', () => {
    const next = applySmartEditWriteBack(baseSnapshot(), 'savings.monthlyInvestments', '22000');
    expect(getGrowthSavingsMonthly(next.expenseCategories)).toBe(22000);
    expect(getEffectiveMonthlySavings(next.expenseCategories)).toBe(22000 + (parseFloat(next.expenseCategories.savings.otherSaving) || 0));
  });

  it('syncs emergency fund into cash.savings', () => {
    const next = applySmartEditWriteBack(baseSnapshot(), 'assets.emergencyFund', '400000');
    expect(getEmergencyFundAmount(next.assetCategories)).toBe(400000);
  });

  it('writes life cover onto a life policy so effective cover updates', () => {
    const next = applySmartEditWriteBack(baseSnapshot(), 'protection.life.totalCover', '7500000');
    expect(next.summaryLifeCover).toBe('7500000');
    expect(next.hasLifeInsurance).toBe(true);
    expect(getEffectiveLifeCover(next.summaryLifeCover, next.policies)).toBe(7500000);
  });

  it('creates a health policy when writing health cover', () => {
    const next = applySmartEditWriteBack(baseSnapshot(), 'protection.health.totalCover', '1000000');
    expect(next.hasHealthInsurance).toBe(true);
    expect(getEffectiveHealthCover(next.summaryHealthCover, next.hasHealthInsurance, next.policies)).toBe(1000000);
  });

  it('writes portfolio summary into mutualFunds detail used by net worth', () => {
    const next = applySmartEditWriteBack(baseSnapshot(), 'assets.portfolioValue', '800000');
    expect(next.assetCategories.summaryPortfolioValue).toBe('800000');
    expect(next.assetCategories.investments.mutualFunds).toBe('800000');
    expect(next.assetCategories.investments.equity).toBe('');
    const nw = calculateNetWorth(next.assetCategories, next.liabilityCategories);
    expect(nw.totalAssets).toBeGreaterThanOrEqual(800000);
  });

  it('writes outstanding loans into home loan detail', () => {
    const next = applySmartEditWriteBack(baseSnapshot(), 'liabilities.outstandingLoans', '1500000');
    expect(next.liabilityCategories.summaryOutstandingLoans).toBe('1500000');
    expect(next.liabilityCategories.loans.home).toBe('1500000');
    expect(next.liabilityCategories.loans.car).toBe('');
  });

  it('returns the same snapshot for unrelated fields', () => {
    const snap = baseSnapshot();
    const next = applySmartEditWriteBack(snap, 'goals.name', 'Car');
    expect(next).toBe(snap);
  });
});
