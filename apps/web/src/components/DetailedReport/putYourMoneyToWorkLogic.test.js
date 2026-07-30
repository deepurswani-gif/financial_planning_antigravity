import { describe, it, expect } from 'vitest';
import {
    analyzeSipBaseline,
    analyzeSipScenario,
    applySipAllocationPlan,
    buildAllocationStudioContext,
    buildDraftAllocationPlan,
    buildInstrumentCards,
    buildRecommendedBundles,
    buildThreeMonthSurplusOutlook,
    compareSipGoalImpacts,
    computeAllocationImpactForMonth,
    computeDeployableSurplusWithCarry,
    computeJourneyAdjustmentImpactForMonth,
    getAllocationPlanKey,
    getGoalFutureValue,
    getRecurringMonthlyAmount,
    getSelectableMonths,
    getLoanStartMonths,
    clampLoanStartMonth,
    groupJourneyConstraintsByMonth,
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

    it('restricts future loan start months to the PYMTW window (current + 2 months)', () => {
        const months = getLoanStartMonths(2026, 2026, 6);
        expect(months).toHaveLength(3);
        expect(months[0].label).toBe('July');
        expect(months[1].label).toBe('August');
        expect(months[months.length - 1].label).toBe('September');
    });

    it('keeps future loan start years within the same current + 2 month window', () => {
        const months = getLoanStartMonths(2027, 2026, 6);
        expect(months).toHaveLength(3);
        expect(months[0].label).toBe('July');
        expect(months[months.length - 1].label).toBe('September');
    });

    it('clamps loan start months to the PYMTW window', () => {
        expect(clampLoanStartMonth(3, 2026, 2026, 6)).toBe(7);
        expect(clampLoanStartMonth(9, 2026, 2026, 6)).toBe(9);
        expect(clampLoanStartMonth(12, 2026, 2026, 6)).toBe(9);
    });

    it('clamps loan start months for future years into the PYMTW window', () => {
        expect(clampLoanStartMonth(3, 2027, 2026, 6)).toBe(7);
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

    it('treats studio Life Insurance Saving Plans annual amount as monthly (not full year in one month)', () => {
        // Draft ₹3,000/mo → stored annual ₹36,000. Surplus ₹8,000/mo from July.
        const ledger = [0, 0, 0, 0, 0, 0, 8000, 8000, 8000, 0, 0, 0];
        const allocations = [{
            id: 1,
            type: 'Life Insurance Saving Plans',
            name: 'Studio Life Insurance Saving Plans (Jul 2026)',
            amount: 36000,
            frequency: 'Monthly',
            startMonth: 7,
            startYear: 2026,
            studioPlanKey: '2026-6',
        }];

        expect(getRecurringMonthlyAmount(allocations[0])).toBe(3000);
        expect(computeAllocationImpactForMonth(allocations, 2026, 6)).toBe(3000);
        expect(computeAllocationImpactForMonth(allocations, 2026, 7)).toBe(3000);

        const july = computeDeployableSurplusWithCarry({
            unallocatedSurplusByMonth: ledger,
            investmentAllocations: allocations,
            journeyAdjustments: [],
            calendarYear: 2026,
            planStartMonth: 6,
            selectedMonthIndex: 6,
        });
        expect(july.deployableSurplus).toBe(5000);

        const aug = computeDeployableSurplusWithCarry({
            unallocatedSurplusByMonth: ledger,
            investmentAllocations: allocations,
            journeyAdjustments: [],
            calendarYear: 2026,
            planStartMonth: 6,
            selectedMonthIndex: 7,
        });
        // Aug: 8000 + 5000 July leftover - 3000 recurring = 10000
        expect(aug.carriedForward).toBe(5000);
        expect(aug.deployableSurplus).toBe(10000);

        const outlook = buildThreeMonthSurplusOutlook({
            unallocatedSurplusByMonth: ledger,
            investmentAllocations: allocations,
            journeyAdjustments: [],
            calendarYear: 2026,
            planStartMonth: 6,
            currentMonth: 6,
        });
        const augustCard = outlook.find((m) => m.monthIndex === 7);
        expect(augustCard.deployableSurplus).toBe(10000);
        const julyRecurringOnAug = augustCard.recurringFromPriorMonths
            .find((r) => r.type === 'Life Insurance Saving Plans');
        expect(julyRecurringOnAug.amount).toBe(3000);
    });

    it('treats Life Insurance Saving Plans with insuredMember as installment premium', () => {
        const alloc = {
            id: 1,
            type: 'Life Insurance Saving Plans',
            amount: 6000,
            frequency: 'Quarterly',
            insuredMember: 'Priya',
            startMonth: 7,
            startYear: 2026,
            studioPlanKey: '2026-6',
        };
        expect(getRecurringMonthlyAmount(alloc)).toBe(2000);
        expect(computeAllocationImpactForMonth([alloc], 2026, 6)).toBe(2000);
    });

    it('buildInstrumentCards skips zero amounts and builds month history', () => {
        const cards = buildInstrumentCards([
            {
                id: 1,
                type: 'SIP',
                amount: 0,
                studioPlanKey: '2026-6',
                startMonth: 7,
                startYear: 2026,
            },
            {
                id: 2,
                type: 'SIP',
                amount: 36000,
                studioPlanKey: '2026-5',
                startMonth: 6,
                startYear: 2026,
            },
        ], { reportScope: 'pymtw' });
        const growth = cards.find((c) => c.id === 'growth');
        const sip = growth.instruments.find((i) => i.type === 'SIP');
        expect(sip.count).toBe(1);
        expect(sip.hasAllocations).toBe(true);
        expect(sip.monthHistory).toHaveLength(1);
        expect(sip.monthHistory[0].monthLabel).toBe('June 2026');
        expect(Math.round(sip.monthHistory[0].monthlyAmount)).toBe(3000);
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

    it('allows future loans when EMI fits the PYMTW window even if later ledger months are empty', () => {
        // July–Sep have surplus; Oct–Dec are 0 (common when only near-term months are projected).
        const surplus = [0, 0, 0, 0, 0, 0, 30000, 30000, 30000, 0, 0, 0];
        const selectableMonths = [
            { monthIndex: 6, label: 'July' },
            { monthIndex: 7, label: 'August' },
            { monthIndex: 8, label: 'September' },
        ];

        const result = validateJourneyAdjustmentsAgainstSurplus(
            [{
                id: 1,
                type: 'loan',
                name: 'Personal Loan',
                startYear: 2026,
                startMonth: 7,
                emi: 10000,
                tenure: 24,
                amount: 120000,
                principal: 200000,
                rate: 12,
            }],
            surplus,
            2026,
            { planStartMonth: 6, selectableMonths },
        );
        expect(result).toEqual({ ok: true });
    });

    it('still rejects future loans when EMI exceeds surplus inside the PYMTW window', () => {
        const surplus = [0, 0, 0, 0, 0, 0, 8000, 8000, 8000, 0, 0, 0];
        const selectableMonths = [
            { monthIndex: 6, label: 'July' },
            { monthIndex: 7, label: 'August' },
            { monthIndex: 8, label: 'September' },
        ];

        const result = validateJourneyAdjustmentsAgainstSurplus(
            [{
                id: 1,
                type: 'loan',
                name: 'Personal Loan',
                startYear: 2026,
                startMonth: 7,
                emi: 10000,
                tenure: 24,
                amount: 120000,
            }],
            surplus,
            2026,
            { planStartMonth: 6, selectableMonths },
        );
        expect(result.ok).toBe(false);
        expect(result.monthLabel).toBe('July');
        expect(result.surplus).toBe(8000);
        expect(result.impact).toBe(10000);
    });

    it('rejects future financial adjustments when the month surplus is already fully allocated', () => {
        const surplus = [0, 0, 0, 0, 0, 0, 30000, 25000, 20000, 0, 0, 0];
        const allocations = [{
            id: 1,
            type: 'Liquid Mutual Fund',
            name: 'Emergency Fund',
            amount: 30000,
            startMonth: 7,
            startYear: 2026,
            studioPlanKey: '2026-6',
        }];

        const over = validateJourneyAdjustmentsAgainstSurplus(
            [{ id: 1, type: 'expense', name: 'Vacation', startYear: 2026, startMonth: 7, amount: 30000 }],
            surplus,
            2026,
            { investmentAllocations: allocations, planStartMonth: 6 },
        );
        expect(over.ok).toBe(false);
        expect(over.monthLabel).toBe('July');
        expect(over.surplus).toBe(0);
        expect(over.impact).toBe(30000);
        expect(over.message).toMatch(/no surplus available for future financial adjustments/i);
        expect(over.message).toMatch(/Protection/i);

        const laterMonthOk = validateJourneyAdjustmentsAgainstSurplus(
            [{ id: 2, type: 'expense', name: 'Laptop', startYear: 2026, startMonth: 8, amount: 20000 }],
            surplus,
            2026,
            { investmentAllocations: allocations, planStartMonth: 6 },
        );
        expect(laterMonthOk).toEqual({ ok: true });
    });

    it('limits future financial adjustments to residual surplus after partial allocation', () => {
        const surplus = [0, 0, 0, 0, 0, 0, 30000, 0, 0, 0, 0, 0];
        const allocations = [{
            id: 1,
            type: 'Liquid Mutual Fund',
            name: 'Emergency Fund',
            amount: 20000,
            startMonth: 7,
            startYear: 2026,
            studioPlanKey: '2026-6',
        }];

        const over = validateJourneyAdjustmentsAgainstSurplus(
            [{ id: 1, type: 'expense', name: 'Trip', startYear: 2026, startMonth: 7, amount: 15000 }],
            surplus,
            2026,
            { investmentAllocations: allocations, planStartMonth: 6 },
        );
        expect(over.ok).toBe(false);
        expect(over.surplus).toBe(10000);
        expect(over.impact).toBe(15000);

        const ok = validateJourneyAdjustmentsAgainstSurplus(
            [{ id: 1, type: 'expense', name: 'Trip', startYear: 2026, startMonth: 7, amount: 10000 }],
            surplus,
            2026,
            { investmentAllocations: allocations, planStartMonth: 6 },
        );
        expect(ok).toEqual({ ok: true });
    });

    it('deducts Protection before FFA in deployable surplus and outlook breakdown', () => {
        const ledger = [0, 0, 0, 0, 0, 0, 50000, 50000, 50000, 0, 0, 0];
        const protection = [{
            id: 1,
            type: 'Term Insurance',
            name: 'Term',
            amount: 120000, // ₹10,000/mo annual storage
            startMonth: 7,
            startYear: 2026,
            studioPlanKey: '2026-6',
        }];
        const ffa = [{
            id: 1,
            type: 'expense',
            name: 'Trip',
            startYear: 2026,
            startMonth: 7,
            amount: 15000,
        }];

        const july = computeDeployableSurplusWithCarry({
            unallocatedSurplusByMonth: ledger,
            investmentAllocations: protection,
            journeyAdjustments: ffa,
            calendarYear: 2026,
            planStartMonth: 6,
            selectedMonthIndex: 6,
        });
        // 50000 - 10000 protection - 15000 FFA = 25000
        expect(july.protectionImpact).toBe(10000);
        expect(july.journeyImpact).toBe(15000);
        expect(july.deployableSurplus).toBe(25000);

        const outlook = buildThreeMonthSurplusOutlook({
            unallocatedSurplusByMonth: ledger,
            investmentAllocations: protection,
            journeyAdjustments: ffa,
            calendarYear: 2026,
            planStartMonth: 6,
            currentMonth: 6,
        });
        const julyCard = outlook.find((m) => m.monthIndex === 6);
        expect(julyCard.ledgerUnallocated).toBe(50000);
        expect(julyCard.protectionImpact).toBe(10000);
        expect(julyCard.journeyImpact).toBe(15000);
        expect(julyCard.deployableSurplus).toBe(25000);
    });

    it('does not let growth allocations block FFA validation (Protection-before-FFA only)', () => {
        const surplus = [0, 0, 0, 0, 0, 0, 30000, 0, 0, 0, 0, 0];
        const growth = [{
            id: 1,
            type: 'SIP',
            name: 'SIP',
            amount: 300000, // ₹25,000/mo
            startMonth: 7,
            startYear: 2026,
            studioPlanKey: '2026-6',
        }];

        const ok = validateJourneyAdjustmentsAgainstSurplus(
            [{ id: 1, type: 'expense', name: 'Trip', startYear: 2026, startMonth: 7, amount: 20000 }],
            surplus,
            2026,
            { investmentAllocations: growth, planStartMonth: 6 },
        );
        expect(ok).toEqual({ ok: true });
    });

    it('scopes instrument categories by report', () => {
        const all = buildInstrumentCards([]);
        expect(all.map((c) => c.id)).toEqual(['protection', 'growth', 'retirement']);
        expect(all.find((c) => c.id === 'growth').instruments.map((i) => i.type)).toContain('Fixed Deposit');
        expect(all.find((c) => c.id === 'retirement').instruments.map((i) => i.type)).toEqual(['PPF', 'NPS']);

        const gaps = buildInstrumentCards([], { reportScope: 'gaps' });
        expect(gaps.map((c) => c.id)).toEqual(['protection']);

        const pymtw = buildInstrumentCards([], { reportScope: 'pymtw' });
        expect(pymtw.map((c) => c.id)).toEqual(['growth', 'retirement']);
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

    it('builds three-month surplus outlook with allocation breakdown', () => {
        const ledger = [0, 0, 0, 0, 0, 0, 20000, 20000, 20000, 0, 0, 0];
        const allocations = [
            {
                id: 1,
                type: 'SIP',
                name: 'Studio SIP (Jul 2026)',
                amount: 60000,
                startMonth: 7,
                startYear: 2026,
                studioPlanKey: '2026-6',
            },
            {
                id: 2,
                type: 'Liquid Mutual Fund',
                name: 'Emergency Fund (Jul 2026)',
                amount: 3000,
                startMonth: 7,
                startYear: 2026,
                studioPlanKey: '2026-6',
            },
        ];

        const outlook = buildThreeMonthSurplusOutlook({
            unallocatedSurplusByMonth: ledger,
            investmentAllocations: allocations,
            journeyAdjustments: [],
            calendarYear: 2026,
            planStartMonth: 6,
            currentMonth: 6,
        });

        expect(outlook).toHaveLength(3);
        expect(outlook[0].deployableSurplus).toBe(12000);
        expect(outlook[0].allocationsInMonth).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ label: 'SIP', amount: 5000 }),
                expect.objectContaining({ label: 'Emergency Fund', amount: 3000 }),
            ]),
        );
        expect(outlook[1].deployableSurplus).toBe(27000);
        expect(outlook[1].calculationLines.some((l) => l.includes('August surplus'))).toBe(true);
        expect(outlook[1].calculationLines.some((l) => l.includes('₹27,000'))).toBe(true);
    });

    it('groups journey constraints by month within planning window', () => {
        const months = getSelectableMonths(6, 6);
        const grouped = groupJourneyConstraintsByMonth([
            {
                id: 1,
                type: 'expense',
                name: 'Trip',
                isLoan: false,
                startYear: 2026,
                startMonth: 7,
                monthLabel: 'July',
                monthlyImpact: 5000,
                annualImpact: 5000,
                projectionNote: 'One-time',
            },
            {
                id: 2,
                type: 'loan',
                name: 'Car loan',
                isLoan: true,
                startYear: 2026,
                startMonth: 8,
                monthLabel: 'August',
                monthlyImpact: 8000,
                annualImpact: 96000,
                projectionNote: 'EMI',
            },
        ], months, 2026);

        expect(grouped).toHaveLength(2);
        expect(grouped[0].label).toBe('July');
        expect(grouped[1].label).toBe('August');
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
