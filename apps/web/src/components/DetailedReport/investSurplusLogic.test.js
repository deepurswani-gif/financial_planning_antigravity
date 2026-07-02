import { describe, it, expect } from 'vitest';
import {
    buildDeploymentSlices,
    buildInvestSurplusReport,
    computeInvestSurplusInsights,
    summarizeInvestmentAllocations,
} from './investSurplusLogic';

const moneyFlowReport = {
    meta: {
        calendarYear: 2026,
        planStartMonth: 0,
        currentMonth: 5,
    },
    members: { selfName: 'Raj Kumar' },
    baseline: { monthlySavings: 20000 },
    ledger: {
        unallocatedSurplus: Array(12).fill(25000),
    },
    totals: {
        ytdUnallocated: 150000,
        proratedUnallocated: 200000,
        fullYearUnallocated: 300000,
    },
    journeyLink: { proratedNetInvestibleSurplus: 180000 },
};

describe('investSurplusLogic', () => {
    it('summarizes monthly allocation commitments', () => {
        const summary = summarizeInvestmentAllocations([
            { id: 1, type: 'SIP', name: 'MF SIP', amount: '5000' },
            { id: 2, type: 'Lumpsum', name: 'Bonus', amount: '100000' },
        ]);
        expect(summary.monthlyCommitted).toBe(5000);
        expect(summary.count).toBe(2);
    });

    it('builds deployment slices from surplus', () => {
        const slices = buildDeploymentSlices(20000, { hasGap: true });
        expect(slices.length).toBe(3);
        expect(slices.find((s) => s.name === 'Emergency fund')?.value).toBe(4000);
        expect(slices.reduce((s, x) => s + x.value, 0)).toBe(20000);
    });

    it('builds invest surplus report from money flow', () => {
        const report = buildInvestSurplusReport({
            moneyFlowReport,
            familyMembers: [{ relation: 'Self', name: 'Raj', dob: '1986-01-01', retirementAge: 60 }],
            expenseCategories: { household: { grocery: { value: 10000, frequency: 'Monthly' } } },
            assetCategories: {},
            contingencyFund: '50000',
            summaryLifeCover: '1000000',
            investmentAllocations: [],
        });
        expect(report.meta.hasData).toBe(true);
        expect(report.hero.monthlyFreeCash).toBe(25000);
        expect(report.suggestions.length).toBeGreaterThan(0);
    });

    it('generates insights for positive surplus', () => {
        const report = buildInvestSurplusReport({
            moneyFlowReport,
            familyMembers: [{ relation: 'Self', dob: '1986-01-01', retirementAge: 60 }],
            expenseCategories: {},
            assetCategories: {},
            investmentAllocations: [],
        });
        const insights = computeInvestSurplusInsights(report);
        expect(insights.some((i) => i.id === 'monthly-surplus')).toBe(true);
    });
});
