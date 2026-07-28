import { describe, it, expect } from 'vitest';
import {
    buildEnhancedBriefingLines,
    buildScenarioComparison,
    buildStudioInsights,
    computeDraftYearImpact,
    validateDraftPlan,
} from './allocationStudioValidation';
import { createEmptyDraftAllocations, getTotalDraftAllocated } from './instrumentAnalysisLogic';
import { buildGrowthPreview } from './instrumentAnalysisLogic';

const journeyProjections = [
    {
        year: 2026,
        netInvestibleSurplus: 360000,
        yearAllocationsTotal: 60000,
        yearHasDeficit: false,
    },
    {
        year: 2028,
        yearHasDeficit: true,
        yearDeficitMonth: 6,
    },
];

describe('allocationStudioValidation', () => {
    it('computes draft year impact for monthly instruments', () => {
        const impact = computeDraftYearImpact({ SIP: 10000, Lumpsum: 50000 }, 7, 2026);
        expect(impact).toBe(10000 * 6 + 50000);
    });

    it('flags surplus exceeded', () => {
        const result = validateDraftPlan({
            draftAllocations: { SIP: 40000 },
            deployableSurplus: 30000,
            journeyProjections,
            planStartMonth: 0,
            calendarYear: 2026,
            monthIndex: 6,
        });
        expect(result.hasBlockingErrors).toBe(true);
        expect(result.issues.some((i) => i.id === 'surplus-exceeded')).toBe(true);
    });

    it('warns on existing journey deficit', () => {
        const result = validateDraftPlan({
            draftAllocations: { SIP: 5000 },
            deployableSurplus: 30000,
            journeyProjections,
            planStartMonth: 0,
            calendarYear: 2026,
            monthIndex: 6,
        });
        expect(result.issues.some((i) => i.id === 'journey-deficit-exists')).toBe(true);
    });

    it('includes lumpsum in draft total for surplus checks', () => {
        const total = getTotalDraftAllocated({
            SIP: 3000,
            Lumpsum: 3000,
            'Direct Equity & ETFs': 2000,
        });
        expect(total).toBe(8000);
    });

    it('allows PPF reduction when editing existing studio plan', () => {
        const result = validateDraftPlan({
            draftAllocations: { PPF: 5000 },
            deployableSurplus: 20000,
            journeyProjections,
            planStartMonth: 6,
            calendarYear: 2026,
            monthIndex: 6,
            expenseCategories: {},
            investmentAllocations: [{
                id: 1,
                type: 'PPF',
                amount: 150000,
                studioPlanKey: '2026-6',
            }],
            excludePlanKey: '2026-6',
        });
        expect(result.issues.some((i) => i.id === 'ppf-cap')).toBe(false);
        expect(result.canApply).toBe(true);
    });

    it('blocks apply when year deficit projected', () => {
        const result = validateDraftPlan({
            draftAllocations: { SIP: 50000 },
            deployableSurplus: 60000,
            journeyProjections: [{
                year: 2026,
                netInvestibleSurplus: 120000,
                yearAllocationsTotal: 100000,
                yearHasDeficit: false,
            }],
            planStartMonth: 0,
            calendarYear: 2026,
            monthIndex: 6,
        });
        expect(result.canApply).toBe(false);
        expect(result.issues.some((i) => i.id === 'year-deficit-projected')).toBe(true);
    });

    it('builds scenario comparison between draft and AI', () => {
        const analysisBase = {
            expenseCategories: { savings: { sip: '5000' } },
            assetCategories: {},
            investmentAllocations: [],
            calculatorInputs: { sip: { rate: 12 } },
            goalMappings: {},
            goals: [],
            familyMembers: [{ relation: 'Self', dob: '1990-01-01', retirementAge: 60 }],
            currentYear: 2026,
        };
        const draft = { ...createEmptyDraftAllocations(), SIP: 5000 };
        const comparison = buildScenarioComparison({
            draftAllocations: draft,
            topBundle: {
                id: 'balanced',
                label: 'Balanced growth',
                allocations: { SIP: 15000, PPF: 5000 },
                narrative: 'Test bundle',
            },
            deployableSurplus: 30000,
            growthPreview: buildGrowthPreview({ ...analysisBase, draftAllocations: draft, monthIndex: 6 }),
            analysisBase,
            monthIndex: 6,
            buildGrowthPreviewFn: buildGrowthPreview,
        });
        expect(comparison.hasComparison).toBe(true);
        expect(comparison.draft.total).toBe(5000);
        expect(comparison.ai.total).toBeGreaterThan(5000);
    });

    it('builds studio insights from validation', () => {
        const insights = buildStudioInsights({
            validation: { issues: [{ id: 'x', severity: 'warning', message: 'Test warning' }] },
            growthPreview: { totalDelta: 100000, retirementYear: 2046 },
            goals: [{ name: 'Home', yearsToGoal: 5, presentValue: 1000000 }],
            totalAllocated: 10000,
            deployableSurplus: 30000,
            activeBundleId: null,
            scenarioComparison: null,
        });
        expect(insights.length).toBeGreaterThan(0);
        expect(insights.some((i) => i.id === 'growth-uplift')).toBe(true);
    });

    it('extends briefing lines with validation context', () => {
        const lines = buildEnhancedBriefingLines({
            baseLines: ['Base line'],
            validation: { hasBlockingErrors: true, canApply: false },
            scenarioComparison: null,
            growthPreview: null,
        });
        expect(lines.length).toBeGreaterThan(1);
        expect(lines.some((l) => l.includes('alerts'))).toBe(true);
    });
});
