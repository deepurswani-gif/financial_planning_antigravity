import { describe, it, expect } from 'vitest';
import {
    getMemberNetInflowForLedger,
    getLedgerHouseholdMonthly,
    computeTaxAdjustmentArray,
    syncLedgerFromMonthlyTotals,
    buildYourMoneyFlowReport,
    maskValuesForPlanStart,
    computeYtdTotal,
    aggregateToQuarterly,
    aggregateToAnnual,
    getDisplayValues,
    computeMoneyFlowInsights,
    VIEW_MODES,
    TAX_PAYMENT_MONTH,
    TAX_REFUND_MONTH,
} from './moneyFlowLedgerLogic';
import { createEmptyIncomeDetail } from '../DetailedFlow/incomeDetailSync';

const resolveEmploymentType = (member) => member?.employmentType || 'Private Sector';

describe('moneyFlowLedgerLogic', () => {
    it('getMemberNetInflowForLedger uses in-hand salary plus other income for salaried', () => {
        const detail = {
            ...createEmptyIncomeDetail(),
            inHandSalary: '80000',
            otherIncome: [{ amount: '5000' }],
        };
        expect(getMemberNetInflowForLedger(detail, 'Private Sector')).toBe(85000);
    });

    it('getLedgerHouseholdMonthly includes education via effective household helper', () => {
        const total = getLedgerHouseholdMonthly({
            summaryHouseholdTotal: '40000',
            household: { grocery: '', rent: '', education: '', lifestyle: '', medical: '', travel: '' },
        }, []);
        expect(total).toBe(40000);
    });

    it('computeTaxAdjustmentArray returns zeros for current calendar year', () => {
        const { adjustment, meta } = computeTaxAdjustmentArray({
            income: { selfDetail: createEmptyIncomeDetail() },
            familyMembers: [{ relation: 'Self', employmentType: 'Private Sector' }],
            hasSpouseIncome: false,
            resolveEmploymentType,
            calendarYear: 2026,
            asOfYear: 2026,
        });
        expect(adjustment).toEqual(Array(12).fill(0));
        expect(meta.applies).toBe(false);
    });

    it('computeTaxAdjustmentArray places additional tax in June for future year', () => {
        const detail = {
            ...createEmptyIncomeDetail(),
            needTaxPlanning: true,
            taxPlanning: {
                earnings: { basicPay: '150000' },
                deductions: { incomeTax: '10000', employeePF: '18000' },
            },
        };
        const { adjustment, meta } = computeTaxAdjustmentArray({
            income: { selfDetail: detail },
            familyMembers: [{ relation: 'Self', employmentType: 'Private Sector' }],
            hasSpouseIncome: false,
            resolveEmploymentType,
            calendarYear: 2027,
            asOfYear: 2026,
        });
        expect(meta.applies).toBe(true);
        expect(adjustment[TAX_PAYMENT_MONTH]).toBeLessThan(0);
        expect(adjustment.filter((v) => v !== 0)).toHaveLength(1);
    });

    it('computeTaxAdjustmentArray places refund in September when TDS exceeds actual tax', () => {
        const detail = {
            ...createEmptyIncomeDetail(),
            needTaxPlanning: true,
            inHandSalary: '50000',
            taxPlanning: {
                earnings: { basicPay: '50000' },
                deductions: { incomeTax: '50000' },
            },
        };
        const { adjustment, meta } = computeTaxAdjustmentArray({
            income: { selfDetail: detail },
            familyMembers: [{ relation: 'Self', employmentType: 'Private Sector' }],
            hasSpouseIncome: false,
            resolveEmploymentType,
            calendarYear: 2027,
            asOfYear: 2026,
        });
        if (meta.type === 'refund') {
            expect(adjustment[TAX_REFUND_MONTH]).toBeGreaterThan(0);
        }
    });

    it('syncLedgerFromMonthlyTotals preserves taxAdjustment and past months', () => {
        const prev = {
            income: [100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            household: [50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            emi: [20000, 20000, 20000, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            insurance: [1000, 1000, 1000, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            savings: [5000, 5000, 5000, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            taxAdjustment: Array(12).fill(0),
        };
        const currentMonth = new Date().getMonth();
        const next = syncLedgerFromMonthlyTotals(prev, {
            income: 90000,
            household: 30000,
            emi: 25000,
            insurance: 1500,
            savings: 8000,
            taxAdjustment: Array(12).fill(0),
        });
        expect(next.income[currentMonth]).toBe(90000);
        expect(next.household[currentMonth]).toBe(30000);
        expect(next.emi[currentMonth]).toBe(25000);
        expect(next.insurance[currentMonth]).toBe(1500);
        expect(next.savings[currentMonth]).toBe(8000);
        if (currentMonth > 0) {
            expect(next.income[0]).toBe(100);
            expect(next.emi[0]).toBe(20000);
            expect(next.savings[0]).toBe(5000);
        }
        expect(next.taxAdjustment).toEqual(Array(12).fill(0));
    });

    it('buildYourMoneyFlowReport uses per-month EMI, insurance, and savings from ledger', () => {
        const currentMonth = new Date().getMonth();
        const prevMonth = Math.max(0, currentMonth - 1);
        const emi = Array(12).fill(25000);
        const savings = Array(12).fill(10000);
        if (prevMonth !== currentMonth) {
            emi[prevMonth] = 20000;
            savings[prevMonth] = 8000;
        }

        const report = buildYourMoneyFlowReport({
            currentYearLedger: {
                income: Array(12).fill(100000),
                household: Array(12).fill(40000),
                emi,
                insurance: Array(12).fill(1000),
                savings,
                taxAdjustment: Array(12).fill(0),
            },
            planStartMonth: 0,
            familyMembers: [{ relation: 'Self', name: 'Alex', employmentType: 'Private Sector' }],
            income: { self: '100000' },
            expenseCategories: {
                household: { grocery: '10000', rent: '20000', education: '10000', lifestyle: '', medical: '', travel: '' },
                emi: { personalLoan: '25000' },
                insurance: { health: { value: '12000', frequency: 'Annual' }, life: {} },
                savings: { sip: '10000' },
            },
            hasSpouseIncome: false,
            resolveEmploymentType,
            journeyProjections: [],
            currentMonth,
        });

        if (prevMonth !== currentMonth) {
            expect(report.ledger.emi[prevMonth]).toBe(20000);
            expect(report.ledger.emi[currentMonth]).toBe(25000);
            expect(report.ledger.savings[prevMonth]).toBe(8000);
            expect(report.ledger.unallocatedSurplus[prevMonth]).not.toBe(report.ledger.unallocatedSurplus[currentMonth]);
        }
    });

    it('buildYourMoneyFlowReport computes surplus and unallocated rows', () => {
        const report = buildYourMoneyFlowReport({
            currentYearLedger: {
                income: Array(12).fill(100000),
                household: Array(12).fill(40000),
                emi: Array(12).fill(5000),
                insurance: Array(12).fill(1000),
                savings: Array(12).fill(10000),
                taxAdjustment: Array(12).fill(0),
            },
            planStartMonth: 3,
            familyMembers: [{ relation: 'Self', name: 'Alex', employmentType: 'Private Sector' }],
            income: { self: '100000' },
            expenseCategories: {
                household: { grocery: '10000', rent: '20000', education: '10000', lifestyle: '', medical: '', travel: '' },
                emi: { personalLoan: '5000' },
                insurance: { health: { value: '12000', frequency: 'Annual' }, life: {} },
                savings: { sip: '10000' },
            },
            hasSpouseIncome: false,
            resolveEmploymentType,
            journeyProjections: [{ year: new Date().getFullYear(), netInvestibleSurplus: 120000 }],
        });

        expect(report.ledger.monthlySurplus[0]).toBe(
            100000 - 40000 - report.baseline.monthlyEmi - report.baseline.monthlyInsurance,
        );
        expect(report.ledger.unallocatedSurplus[0]).toBe(
            report.ledger.monthlySurplus[0] - report.baseline.monthlySavings,
        );
        expect(report.totals.proratedSurplus).toBeGreaterThan(0);
    });

    it('maskValuesForPlanStart blanks months before plan start', () => {
        const masked = maskValuesForPlanStart([100, 200, 300, 400], 2);
        expect(masked).toEqual([null, null, 300, 400]);
    });

    it('computeYtdTotal sums from plan start through current month', () => {
        const values = [100, 200, 300, 400, 500];
        expect(computeYtdTotal(values, 2, 4)).toBe(1200);
        expect(computeYtdTotal(values, 5, 3)).toBeNull();
    });

    it('aggregateToQuarterly respects plan start month', () => {
        const values = Array(12).fill(1000);
        expect(aggregateToQuarterly(values, 0)).toEqual([3000, 3000, 3000, 3000]);
        expect(aggregateToQuarterly(values, 5)).toEqual([null, 1000, 3000, 3000]);
    });

    it('aggregateToAnnual sums from plan start through December', () => {
        const values = Array(12).fill(1000);
        expect(aggregateToAnnual(values, 3)).toBe(9000);
    });

    it('getDisplayValues returns masked monthly values', () => {
        const values = [10, 20, 30];
        expect(getDisplayValues(values, VIEW_MODES.MONTHLY, 1)).toEqual([null, 20, 30]);
    });

    it('computeMoneyFlowInsights includes emi burden and surplus allocation action link', () => {
        const report = buildYourMoneyFlowReport({
            currentYearLedger: {
                income: Array(12).fill(100000),
                household: Array(12).fill(40000),
                emi: Array(12).fill(5000),
                insurance: Array(12).fill(1000),
                savings: Array(12).fill(10000),
                taxAdjustment: Array(12).fill(0),
            },
            planStartMonth: 0,
            familyMembers: [{ relation: 'Self', name: 'Alex', employmentType: 'Private Sector' }],
            income: { self: '100000' },
            expenseCategories: {
                household: { grocery: '10000', rent: '20000', education: '10000', lifestyle: '', medical: '', travel: '' },
                emi: { personalLoan: '5000' },
                insurance: { health: { value: '12000', frequency: 'Annual' }, life: {} },
                savings: { sip: '10000' },
            },
            hasSpouseIncome: false,
            resolveEmploymentType,
            journeyProjections: [],
            currentMonth: 5,
        });

        const insights = computeMoneyFlowInsights(report);
        expect(insights.some((i) => i.id === 'emi-burden')).toBe(true);
        expect(insights.some((i) => i.id === 'allocate-surplus')).toBe(true);
        expect(insights.find((i) => i.id === 'allocate-surplus')?.actionTarget).toBe('#ius-section');
    });
});
