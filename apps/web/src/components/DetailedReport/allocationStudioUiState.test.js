import { describe, it, expect } from 'vitest';
import {
    areDraftsEqual,
    isStudioDirty,
    sumCategoryDraft,
    isCategoryDirty,
    buildDraftSummaryItems,
    summarizeWithDraftOverlay,
    getDisplayDraftAllocations,
} from './allocationStudioUiState';
import { createEmptyDraftAllocations } from './instrumentAnalysisLogic';

describe('allocationStudioUiState', () => {
    it('areDraftsEqual treats equal amounts as equal', () => {
        const a = { ...createEmptyDraftAllocations(), SIP: 5000, PPF: 1000 };
        const b = { ...createEmptyDraftAllocations(), SIP: 5000, PPF: 1000 };
        expect(areDraftsEqual(a, b)).toBe(true);
        expect(isStudioDirty(a, b)).toBe(false);
    });

    it('areDraftsEqual detects differences', () => {
        const baseline = { ...createEmptyDraftAllocations(), SIP: 5000 };
        const draft = { ...createEmptyDraftAllocations(), SIP: 6000 };
        expect(areDraftsEqual(draft, baseline)).toBe(false);
        expect(isStudioDirty(draft, baseline)).toBe(true);
    });

    it('areDraftsEqual compares Life Insurance Saving Plans object drafts', () => {
        const a = {
            ...createEmptyDraftAllocations(),
            'Life Insurance Saving Plans': {
                premium: 3000,
                frequency: 'Monthly',
                duration: 10,
                insuredMember: 'Self',
            },
        };
        const b = {
            ...createEmptyDraftAllocations(),
            'Life Insurance Saving Plans': {
                premium: 3000,
                frequency: 'Monthly',
                duration: 10,
                insuredMember: 'Self',
            },
        };
        const c = {
            ...createEmptyDraftAllocations(),
            'Life Insurance Saving Plans': {
                premium: 4000,
                frequency: 'Monthly',
                duration: 10,
                insuredMember: 'Self',
            },
        };
        expect(areDraftsEqual(a, b)).toBe(true);
        expect(areDraftsEqual(a, c)).toBe(false);
    });

    it('sumCategoryDraft and isCategoryDirty work per accordion', () => {
        const category = { id: 'growth', instruments: ['SIP', 'Lumpsum', 'Direct Equity & ETFs'] };
        const baseline = { ...createEmptyDraftAllocations(), SIP: 5000 };
        const draft = { ...createEmptyDraftAllocations(), SIP: 7000, Lumpsum: 10000 };
        expect(sumCategoryDraft(category, draft)).toBe(17000);
        expect(isCategoryDirty(category, draft, baseline)).toBe(true);
        expect(isCategoryDirty(category, baseline, baseline)).toBe(false);
    });

    it('getDisplayDraftAllocations prefers draft while editing', () => {
        const draft = { ...createEmptyDraftAllocations(), SIP: 1 };
        const baseline = { ...createEmptyDraftAllocations(), SIP: 9 };
        expect(getDisplayDraftAllocations({
            isEditing: true,
            draftAllocations: draft,
            baselineAllocations: baseline,
        }).SIP).toBe(1);
        expect(getDisplayDraftAllocations({
            isEditing: false,
            draftAllocations: draft,
            baselineAllocations: baseline,
        }).SIP).toBe(9);
    });

    it('buildDraftSummaryItems creates pending rows for positive amounts', () => {
        const draft = { ...createEmptyDraftAllocations(), SIP: 5000, Lumpsum: 20000 };
        const items = buildDraftSummaryItems({
            draftAllocations: draft,
            planKey: '2026-6',
            calendarYear: 2026,
            monthIndex: 6,
        });
        expect(items).toHaveLength(2);
        expect(items.every((i) => i.pending)).toBe(true);
        expect(items.find((i) => i.type === 'SIP').amount).toBe(5000);
        expect(items.find((i) => i.type === 'SIP').isMonthly).toBe(true);
        expect(items.find((i) => i.type === 'Lumpsum').isMonthly).toBe(false);
    });

    it('summarizeWithDraftOverlay replaces editing month with draft', () => {
        const investmentAllocations = [
            {
                id: 1,
                type: 'SIP',
                amount: 120000,
                studioPlanKey: '2026-6',
                startMonth: 7,
                startYear: 2026,
            },
            {
                id: 2,
                type: 'SIP',
                amount: 60000,
                studioPlanKey: '2026-7',
                startMonth: 8,
                startYear: 2026,
            },
        ];
        const draft = { ...createEmptyDraftAllocations(), SIP: 8000, PPF: 2000 };
        const summary = summarizeWithDraftOverlay({
            investmentAllocations,
            draftAllocations: draft,
            planKey: '2026-6',
            calendarYear: 2026,
            monthIndex: 6,
            showDraft: true,
        });
        const july = summary.items.filter((i) => i.studioPlanKey === '2026-6');
        const august = summary.items.filter((i) => i.studioPlanKey === '2026-7');
        expect(july.every((i) => i.pending)).toBe(true);
        expect(july.find((i) => i.type === 'SIP').amount).toBe(8000);
        expect(july.find((i) => i.type === 'PPF').amount).toBe(2000);
        expect(august).toHaveLength(1);
        expect(august[0].pending).toBeFalsy();
    });

    it('scopes planned summary to protection vs investment', () => {
        const investmentAllocations = [
            {
                id: 1,
                type: 'Term Insurance',
                amount: 24000,
                studioPlanKey: '2026-6',
                startMonth: 7,
                startYear: 2026,
            },
            {
                id: 2,
                type: 'SIP',
                amount: 120000,
                studioPlanKey: '2026-6',
                startMonth: 7,
                startYear: 2026,
            },
            {
                id: 3,
                type: 'Liquid Mutual Fund',
                amount: 50000,
                studioPlanKey: '2026-6',
                startMonth: 7,
                startYear: 2026,
            },
        ];

        const protection = summarizeWithDraftOverlay({
            investmentAllocations,
            showDraft: false,
            scope: 'protection',
        });
        expect(protection.items.map((i) => i.type).sort()).toEqual([
            'Liquid Mutual Fund',
            'Term Insurance',
        ]);

        const investment = summarizeWithDraftOverlay({
            investmentAllocations,
            showDraft: false,
            scope: 'investment',
        });
        expect(investment.items.map((i) => i.type)).toEqual(['SIP']);
    });
});
