import { describe, it, expect } from 'vitest';
import {
    analyzeSipBaseline,
    analyzeSipScenario,
    applySipAllocationPlan,
    buildAllocationStudioContext,
    buildDraftAllocationPlan,
    buildInstrumentCards,
    buildRecommendedBundles,
    compareSipGoalImpacts,
    computeAllocationImpactForMonth,
    computeDeployableSurplusWithCarry,
    computeJourneyAdjustmentImpactForMonth,
    getAllocationPlanKey,
    getGoalFutureValue,
    getSelectableMonths,
    getLoanStartMonths,
    clampLoanStartMonth,
    summarizeJourneyConstraints,
    validateJourneyAdjustmentsAgainstSurplus,
} from './putYourMoneyToWorkLogic';

const moneyFlowReport = {
    meta: {
        calendarYear: 2026,
        planStartMonth: 0,
        currentMonth: 6,
    },
    members: { selfName: 'Priya Sharma' },
    ledger: {
        unallocatedSurplus: [20000, 22000, 25000, 25000, 28000, 30000, 30000, 0, 0, 0, 0, 0],
    },
    totals: {
        ytdUnallocated: 150000,
        proratedUnallocated: 200000,
        fullYearUnallocated: 300000,
    },
    journeyLink: { proratedNetInvestibleSurplus: 180000 },
};

describe('putYourMoneyToWorkLogic', () => {
    it('returns forward-looking selectable months for planning', () => {
        const months = getSelectableMonths(0, 6);
        expect(months).toHaveLength(3);
        expect(months[0].label).toBe('July');
        expect(months[1].label).toBe('August');
        expect(months[2].label).toBe('September');
    });

    it('restricts future loan start months to current month onward in the current year', () => {
        const months = getLoanStartMonths(2026, 2026, 6);
        expect(months).toHaveLength(6);
        expect(months[0].label).toBe('July');
        expect(months[months.length - 1].label).toBe('December');
    });

    it('allows all months for future loan start years', () => {
        const months = getLoanStartMonths(2027, 2026, 6);
        expect(months).toHaveLength(12);
        expect(months[0].label).toBe('January');
    });

    it('clamps past loan start months when the year is current', () => {
        expect(clampLoanStartMonth(3, 2026, 2026, 6)).toBe(7);
        expect(clampLoanStartMonth(9, 2026, 2026, 6)).toBe(9);
    });

    it('does not clamp loan start months for future years', () => {
        expect(clampLoanStartMonth(3, 2027, 2026, 6)).toBe(3);
    });

    it('summarizes journey adjustments', () => {
        const summary = summarizeJourneyConstraints([
            {
                id: 1, type: 'expense', name: 'School fees', startYear: 2028, startMonth: 7, amount: 120000, duration: 4,
            },
            { id: 2, type: 'loan', name: 'Home loan', startYear: 2029, emi: 45000, amount: 540000, principal: 5000000, rate: 8.5, tenure: 240 },
        ], [], 2026);

        expect(summary.hasItems).toBe(true);
        expect(summary.items).toHaveLength(2);
        expect(summary.items[0].monthlyImpact).toBe(120000);
        expect(summary.items[0].projectionNote).toContain('July 2028');
        expect(summary.items[1].isLoan).toBe(true);
    });

    it('groups instrument cards by category', () => {
        const categories = buildInstrumentCards([
            { id: 1, type: 'SIP', name: 'Equity SIP', amount: '10000' },
            { id: 2, type: 'PPF', name: 'PPF', amount: '12500' },
        ]);

        const growth = categories.find((c) => c.id === 'growth');
        const sip = growth.instruments.find((i) => i.type === 'SIP');
        expect(sip.monthlyTotal).toBe(10000);
        expect(sip.isInteractive).toBe(true);
    });

    it('analyzes SIP baseline with goals', () => {
        const analysis = analyzeSipBaseline({
            expenseCategories: { savings: { sip: '5000' } },
            assetCategories: { investments: { mutualFunds: '200000' } },
            investmentAllocations: [{ id: 1, type: 'SIP', name: 'Large cap', amount: '5000', startMonth: 7, startYear: 2026 }],
            calculatorInputs: { sip: { rate: 12 } },
            goalMappings: { g1: { sip: 500000 } },
            goals: [{ id: 'g1', name: 'Child education', presentValue: 1000000, yearsToGoal: 8, inflationRate: 6 }],
            familyMembers: [{ relation: 'Self', dob: '1990-01-01', retirementAge: 60 }],
            currentYear: 2026,
        });

        expect(analysis.totalMonthly).toBe(10000);
        expect(analysis.goalImpacts).toHaveLength(1);
        expect(analysis.retirementCorpus).toBeGreaterThan(0);
        expect(analysis.growthSeries.length).toBeGreaterThan(0);
    });

    it('builds full allocation studio context', () => {
        const ctx = buildAllocationStudioContext({
            moneyFlowReport: {
                ...moneyFlowReport,
                meta: { ...moneyFlowReport.meta, planStartMonth: 6 },
                ledger: {
                    unallocatedSurplus: [0, 0, 0, 0, 0, 0, 30000, 0, 0, 0, 0, 0],
                },
            },
            familyMembers: [{ relation: 'Self', name: 'Priya', dob: '1990-01-01', retirementAge: 60 }],
            expenseCategories: {},
            assetCategories: {},
            journeyAdjustments: [],
            journeyProjections: [],
            // Studio stores recurring amounts as annual totals (₹5,000/mo → ₹60,000).
            investmentAllocations: [{ id: 1, type: 'SIP', name: 'MF', amount: '60000', startMonth: 7, startYear: 2026 }],
            goals: [{ id: 'g1', name: 'Home', presentValue: 5000000, yearsToGoal: 5 }],
            selectedMonthIndex: 6,
        });

        expect(ctx.meta.hasData).toBe(true);
        expect(ctx.meta.monthLabel).toBe('July');
        expect(ctx.hero.deployableSurplus).toBe(25000);
        expect(ctx.hero.carriedForward).toBe(0);
        expect(ctx.briefing.lines.length).toBeGreaterThan(0);
        expect(ctx.sipAnalysis.totalMonthly).toBeGreaterThanOrEqual(0);
    });

    it('carries leftover unallocated surplus into later months with recurring SIP', () => {
        const ledger = [0, 0, 0, 0, 0, 0, 20000, 20000, 20000, 0, 0, 0];
        // ₹12,000/mo SIP stored as annual ₹144,000 starting July
        const allocations = [{
            id: 1,
            type: 'SIP',
            name: 'Studio SIP (Jul 2026)',
            amount: 144000,
            startMonth: 7,
            startYear: 2026,
            studioPlanKey: '2026-6',
        }];

        expect(computeAllocationImpactForMonth(allocations, 2026, 6)).toBe(12000);
        expect(computeAllocationImpactForMonth(allocations, 2026, 7)).toBe(12000);

        const july = computeDeployableSurplusWithCarry({
            unallocatedSurplusByMonth: ledger,
            investmentAllocations: allocations,
            journeyAdjustments: [],
            calendarYear: 2026,
            planStartMonth: 6,
            selectedMonthIndex: 6,
        });
        expect(july.deployableSurplus).toBe(8000);
        expect(july.carriedForward).toBe(0);

        const aug = computeDeployableSurplusWithCarry({
            unallocatedSurplusByMonth: ledger,
            investmentAllocations: allocations,
            journeyAdjustments: [],
            calendarYear: 2026,
            planStartMonth: 6,
            selectedMonthIndex: 7,
        });
        // Aug: 20000 + 8000 carry - 12000 recurring = 16000
        expect(aug.carriedForward).toBe(8000);
        expect(aug.deployableSurplus).toBe(16000);

        const ctx = buildAllocationStudioContext({
            moneyFlowReport: {
                ...moneyFlowReport,
                meta: { ...moneyFlowReport.meta, planStartMonth: 6, currentMonth: 6 },
                ledger: { unallocatedSurplus: ledger },
            },
            familyMembers: [{ relation: 'Self', name: 'Priya', dob: '1990-01-01', retirementAge: 60 }],
            expenseCategories: {},
            assetCategories: {},
            journeyAdjustments: [],
            journeyProjections: [],
            investmentAllocations: allocations,
            goals: [],
            selectedMonthIndex: 7,
        });
        expect(ctx.hero.deployableSurplus).toBe(16000);
        expect(ctx.hero.carriedForward).toBe(8000);
    });

    it('carries unused one-time allocation leftovers across months', () => {
        const ledger = [0, 0, 0, 0, 0, 0, 20000, 20000, 20000, 0, 0, 0];
        const allocations = [{
            id: 1,
            type: 'Lumpsum',
            name: 'Studio Lumpsum (Jul 2026)',
            amount: 12000,
            startMonth: 7,
            startYear: 2026,
            studioPlanKey: '2026-6',
        }];

        const aug = computeDeployableSurplusWithCarry({
            unallocatedSurplusByMonth: ledger,
            investmentAllocations: allocations,
            journeyAdjustments: [],
            calendarYear: 2026,
            planStartMonth: 6,
            selectedMonthIndex: 7,
        });
        // July leftover 8000 + Aug 20000 = 28000 (lumpsum does not recur)
        expect(aug.carriedForward).toBe(8000);
        expect(aug.deployableSurplus).toBe(28000);

        const sep = computeDeployableSurplusWithCarry({
            unallocatedSurplusByMonth: ledger,
            investmentAllocations: allocations,
            journeyAdjustments: [],
            calendarYear: 2026,
            planStartMonth: 6,
            selectedMonthIndex: 8,
        });
        // Aug unused 28000 carries + Sep 20000 = 48000
        expect(sep.carriedForward).toBe(28000);
        expect(sep.deployableSurplus).toBe(48000);
    });

    it('rejects journey adjustments that exceed monthly unallocated surplus', () => {
        const surplus = [0, 0, 0, 0, 0, 0, 20000, 20000, 20000, 20000, 20000, 20000];
        const over = validateJourneyAdjustmentsAgainstSurplus([
            { id: 1, type: 'expense', name: 'Trip', startYear: 2026, startMonth: 7, amount: 15000 },
            {
                id: 2, type: 'loan', name: 'Personal', startYear: 2026, startMonth: 7,
                emi: 10000, tenure: 12, amount: 120000,
            },
        ], surplus, 2026);
        expect(over.ok).toBe(false);
        expect(over.monthLabel).toBe('July');
        expect(over.surplus).toBe(20000);
        expect(over.impact).toBe(25000);

        const ok = validateJourneyAdjustmentsAgainstSurplus([
            { id: 1, type: 'expense', name: 'Trip', startYear: 2026, startMonth: 7, amount: 15000 },
            {
                id: 2, type: 'loan', name: 'Personal', startYear: 2026, startMonth: 7,
                emi: 5000, tenure: 6, amount: 60000,
            },
        ], surplus, 2026);
        expect(ok).toEqual({ ok: true });
    });

    it('deducts one-time standard expenses from deployable surplus in the selected month', () => {
        const deduction = computeJourneyAdjustmentImpactForMonth([
            { id: 1, type: 'expense', name: 'Mobile', startYear: 2026, startMonth: 7, amount: 30000 },
        ], 2026, 6);
        expect(deduction).toBe(30000);

        const ctx = buildAllocationStudioContext({
            moneyFlowReport: {
                ...moneyFlowReport,
                ledger: {
                    unallocatedSurplus: [0, 0, 0, 0, 0, 0, 40000, 0, 0, 0, 0, 0],
                },
            },
            familyMembers: [{ relation: 'Self', name: 'Priya', dob: '1990-01-01', retirementAge: 60 }],
            expenseCategories: {},
            assetCategories: {},
            journeyAdjustments: [
                { id: 1, type: 'expense', name: 'Mobile', startYear: 2026, startMonth: 7, amount: 30000 },
            ],
            journeyProjections: [],
            investmentAllocations: [],
            goals: [],
            selectedMonthIndex: 6,
        });

        expect(ctx.hero.monthlyFreeCash).toBe(40000);
        expect(ctx.hero.journeyMonthDeduction).toBe(30000);
        expect(ctx.hero.deployableSurplus).toBe(10000);
    });

    it('computes goal future value with inflation', () => {
        const fv = getGoalFutureValue({ presentValue: 100000, yearsToGoal: 10, inflationRate: 6 });
        expect(fv).toBeGreaterThan(100000);
    });

    it('compares baseline vs scenario SIP goal impacts', () => {
        const baseParams = {
            expenseCategories: { savings: { sip: '5000' } },
            assetCategories: {},
            investmentAllocations: [],
            calculatorInputs: { sip: { rate: 12 } },
            goalMappings: {},
            goals: [{ id: 'g1', name: 'Home', presentValue: 5000000, yearsToGoal: 10, inflationRate: 6 }],
            familyMembers: [{ relation: 'Self', dob: '1990-01-01', retirementAge: 60 }],
            currentYear: 2026,
        };
        const baseline = analyzeSipBaseline(baseParams);
        const scenario = analyzeSipScenario(baseParams, 20000, 6, 2026);
        const deltas = compareSipGoalImpacts(baseline.goalImpacts, scenario.goalImpacts);

        expect(scenario.retirementCorpus).toBeGreaterThan(baseline.retirementCorpus);
        expect(deltas[0].projectedFundedDelta).toBeGreaterThanOrEqual(0);
        expect(scenario.scenarioMonthly).toBe(20000);
    });

    it('builds life journey recommended plan from engine', () => {
        const bundles = buildRecommendedBundles({
            deployableSurplus: 30000,
            contingencyData: { gap: 100000, emergencyFundHave: 50000 },
            protectionData: { hasGap: true, coverageHave: 1000000 },
            goals: [{ id: 'g1', name: 'Education', presentValue: 1000000, yearsToGoal: 5, inflationRate: 8 }],
            familyMembers: [{ relation: 'Self', dob: '1990-01-01', retirementAge: 60 }],
            expenseCategories: {
                household: { grocery: { value: 15000, frequency: 'Monthly' } },
                savings: { sip: 3000 },
            },
            hasHealthInsurance: true,
            summaryHealthCover: '1000000',
        });
        expect(bundles).toHaveLength(1);
        expect(bundles[0].id).toBe('life_journey');
        expect(bundles[0].engineResult).toBeTruthy();
        const total = Object.values(bundles[0].allocations).reduce((s, v) => s + v, 0);
        expect(total).toBeLessThanOrEqual(30000);
        expect(total).toBeGreaterThan(0);
    });

    it('applies SIP allocation plan to investment allocations', () => {
        const result = applySipAllocationPlan({
            investmentAllocations: [],
            draftSipAmount: 15000,
            calendarYear: 2026,
            monthIndex: 6,
        });
        expect(result).toHaveLength(1);
        expect(result[0].amount).toBe(15000);
        expect(result[0].studioPlanKey).toBe('2026-6');
    });

    it('builds engine allocations covering instruments', () => {
        const bundles = buildRecommendedBundles({
            deployableSurplus: 30000,
            contingencyData: { gap: 0, isHealthy: true, emergencyFundHave: 500000 },
            protectionData: { hasGap: false, coverageHave: 20000000 },
            goals: [{ id: 'g1', name: 'Education', presentValue: 1000000, yearsToGoal: 5, inflationRate: 8 }],
            familyMembers: [{ relation: 'Self', dob: '1990-01-01', retirementAge: 60 }],
            expenseCategories: {
                household: { grocery: { value: 10000, frequency: 'Monthly' } },
                savings: { sip: 2000, ppf: 2000, nps: 2000 },
            },
            contingencyFund: '500000',
            summaryLifeCover: '20000000',
            summaryHealthCover: '1000000',
            hasHealthInsurance: true,
        });
        expect(bundles[0].allocations).toBeDefined();
        const total = Object.values(bundles[0].allocations).reduce((s, v) => s + v, 0);
        expect(total).toBe(30000);
        expect(bundles[0].id).toBe('life_journey');
        expect(bundles[0].engineResult?.diagnostics?.sequence?.[0]).toBe('protection_policy');
    });

    it('builds draft allocation plan snapshot', () => {
        const draft = buildDraftAllocationPlan({
            planKey: '2026-6',
            deployableSurplus: 30000,
            draftAllocations: { SIP: 20000, PPF: 5000 },
            selectedBundleId: 'balanced',
            calendarYear: 2026,
            monthIndex: 6,
            monthLabel: 'July',
            growthPreview: { baselineTotal: 1000000, scenarioTotal: 1500000, rows: [] },
        });
        expect(draft.status).toBe('draft');
        expect(draft.items).toHaveLength(2);
        expect(draft.computedSnapshot.retirementCorpusDelta).toBe(500000);
    });
});
