import { describe, it, expect } from 'vitest';
import {
    analyzeInstrument,
    applyAllocationPlan,
    buildGrowthPreview,
    clearStudioMonthPlan,
    compareInstrumentGoalImpacts,
    createEmptyDraftAllocations,
    getTotalDraftAllocated,
    INSTRUMENT_REGISTRY,
    monthHasStudioPlan,
    pruneAllocationPlansForAllocations,
    removeInvestmentAllocationById,
} from './instrumentAnalysisLogic';

const baseParams = {
    expenseCategories: { savings: { sip: '5000' } },
    assetCategories: { investments: { mutualFunds: '100000' } },
    investmentAllocations: [],
    calculatorInputs: { sip: { rate: 12 }, ppf: { rate: 7.1 }, fd: { rate: 7 } },
    goalMappings: {},
    goals: [{ id: 'g1', name: 'Retirement', presentValue: 5000000, yearsToGoal: 20, inflationRate: 6 }],
    familyMembers: [{ relation: 'Self', dob: '1990-01-01', retirementAge: 60 }],
    currentYear: 2026,
};

describe('instrumentAnalysisLogic', () => {
    it('exposes all studio instrument types', () => {
        expect(Object.keys(INSTRUMENT_REGISTRY)).toHaveLength(14);
    });

    it('sums draft allocations for surplus check', () => {
        const draft = { ...createEmptyDraftAllocations(), SIP: 10000, Lumpsum: 50000 };
        expect(getTotalDraftAllocated(draft)).toBe(60000);
    });

    it('analyzes SIP scenario with higher headline value', () => {
        const baseline = analyzeInstrument('SIP', baseParams, 0, 6, 2026);
        const scenario = analyzeInstrument('SIP', baseParams, 20000, 6, 2026);
        expect(scenario.headlineValue).toBeGreaterThanOrEqual(baseline.headlineValue);
        expect(scenario.scenarioAmount).toBe(20000);
    });

    it('analyzes PPF instrument', () => {
        const analysis = analyzeInstrument('PPF', baseParams, 5000, 6, 2026);
        expect(analysis.headlineValue).toBeGreaterThan(0);
        expect(analysis.inputMode).toBe('monthly');
    });

    it('builds growth preview with draft rows', () => {
        const preview = buildGrowthPreview({
            ...baseParams,
            draftAllocations: { SIP: 10000, PPF: 5000 },
            monthIndex: 6,
        });
        expect(preview.hasDraft).toBe(true);
        expect(preview.rows.length).toBe(2);
        expect(preview.scenarioTotal).toBeGreaterThanOrEqual(preview.baselineTotal);
    });

    it('compares instrument goal impacts', () => {
        const base = analyzeInstrument('SIP', baseParams, 0, 6, 2026);
        const scenario = analyzeInstrument('SIP', baseParams, 15000, 6, 2026);
        const deltas = compareInstrumentGoalImpacts(base.goalImpacts, scenario.goalImpacts);
        expect(deltas[0].projectedFundedDelta).toBeGreaterThanOrEqual(0);
    });

    it('applies multi-instrument allocation plan', () => {
        const draft = { ...createEmptyDraftAllocations(), SIP: 10000, 'Fixed Deposit': 50000 };
        const result = applyAllocationPlan({
            investmentAllocations: [],
            draftAllocations: draft,
            calendarYear: 2026,
            monthIndex: 6,
        });
        expect(result).toHaveLength(2);
        expect(result[0].studioPlanKey).toBe('2026-6');
        expect(result.find((r) => r.type === 'SIP')?.amount).toBe(120000);
    });

    it('enforces 15-year PPF horizon in analysis and plan application', () => {
        const ppfParams = {
            ...baseParams,
            investmentAllocations: [{
                id: 1,
                type: 'PPF',
                name: 'Legacy PPF',
                amount: 120000,
                startMonth: 1,
                startYear: 2026,
                duration: 30,
            }],
        };
        const analysis = analyzeInstrument('PPF', ppfParams, 5000, 6, 2026);
        const applied = applyAllocationPlan({
            investmentAllocations: [],
            draftAllocations: { ...createEmptyDraftAllocations(), PPF: 5000 },
            calendarYear: 2026,
            monthIndex: 6,
        });
        const appliedPpf = applied.find((row) => row.type === 'PPF');

        expect(analysis.growthSeries.length).toBeLessThanOrEqual(16);
        expect(appliedPpf?.duration).toBe(15);
    });

    it('clears all studio allocations for a month', () => {
        const applied = applyAllocationPlan({
            investmentAllocations: [{ id: 99, type: 'SIP', amount: 60000, studioPlanKey: '2026-5' }],
            draftAllocations: { ...createEmptyDraftAllocations(), SIP: 10000, PPF: 5000 },
            calendarYear: 2026,
            monthIndex: 6,
        });
        expect(applied.filter((a) => a.studioPlanKey === '2026-6')).toHaveLength(2);

        const cleared = clearStudioMonthPlan({
            investmentAllocations: applied,
            calendarYear: 2026,
            monthIndex: 6,
        });
        expect(cleared).toHaveLength(1);
        expect(cleared[0].studioPlanKey).toBe('2026-5');
        expect(monthHasStudioPlan(cleared, 2026, 6)).toBe(false);
        expect(monthHasStudioPlan(applied, 2026, 6)).toBe(true);
    });

    it('removes a single allocation by id', () => {
        const list = [
            { id: 1, type: 'SIP', amount: 60000, studioPlanKey: '2026-6' },
            { id: 2, type: 'PPF', amount: 60000, studioPlanKey: '2026-6' },
        ];
        expect(removeInvestmentAllocationById(list, 1)).toEqual([list[1]]);
    });

    it('prunes applied allocation plans without matching allocations', () => {
        const plans = {
            '2026-6': { status: 'applied', items: [] },
            '2026-7': { status: 'draft', items: [] },
            '2026-8': { status: 'applied', items: [] },
        };
        const allocations = [{ id: 1, type: 'SIP', studioPlanKey: '2026-8' }];
        const pruned = pruneAllocationPlansForAllocations(plans, allocations);
        expect(pruned['2026-6']).toBeUndefined();
        expect(pruned['2026-7']?.status).toBe('draft');
        expect(pruned['2026-8']?.status).toBe('applied');
    });
});
