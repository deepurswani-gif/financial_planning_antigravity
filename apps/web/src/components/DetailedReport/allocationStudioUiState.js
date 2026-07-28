import {
    INSTRUMENT_REGISTRY,
    STUDIO_INSTRUMENT_TYPES,
    createEmptyDraftAllocations,
    getTotalDraftAllocated,
    normalizeAllocType,
} from './instrumentAnalysisLogic';
import { summarizeInvestmentAllocations } from './investSurplusLogic';

const parseAmount = (value) => parseFloat(value) || 0;

export function areDraftsEqual(a = {}, b = {}) {
    return STUDIO_INSTRUMENT_TYPES.every(
        (type) => Math.round(parseAmount(a[type])) === Math.round(parseAmount(b[type])),
    );
}

export function isStudioDirty(draft = {}, baseline = {}) {
    return !areDraftsEqual(draft, baseline);
}

export function sumCategoryDraft(category, draftAllocations = {}) {
    if (!category?.instruments?.length) return 0;
    return category.instruments.reduce(
        (sum, type) => sum + Math.max(0, Math.round(parseAmount(draftAllocations[type]))),
        0,
    );
}

export function isCategoryDirty(category, draft = {}, baseline = {}) {
    if (!category?.instruments?.length) return false;
    return category.instruments.some(
        (type) => Math.round(parseAmount(draft[type])) !== Math.round(parseAmount(baseline[type])),
    );
}

export function getDisplayDraftAllocations({
    isEditing = false,
    draftAllocations = {},
    baselineAllocations = {},
}) {
    if (isEditing) return draftAllocations;
    return baselineAllocations;
}

/**
 * Build Planned-table summary items for a draft month (display-only).
 * Amounts match summarizeInvestmentAllocations: monthly instruments show monthly amount.
 */
export function buildDraftSummaryItems({
    draftAllocations = {},
    planKey,
    calendarYear,
    monthIndex,
}) {
    const startMonth = monthIndex + 1;
    const items = [];

    STUDIO_INSTRUMENT_TYPES.forEach((type) => {
        const amount = Math.max(0, Math.round(parseAmount(draftAllocations[type])));
        if (amount <= 0) return;
        const def = INSTRUMENT_REGISTRY[type];
        if (!def) return;
        const isMonthly = def.inputMode === 'monthly';
        items.push({
            id: `draft-${planKey}-${type}`,
            type: def.allocType || type,
            name: `Studio ${type}`,
            amount,
            isMonthly,
            annualImpact: isMonthly ? amount * 12 : amount,
            studioPlanKey: planKey,
            startMonth,
            startYear: calendarYear,
            pending: true,
            instrumentType: type,
        });
    });

    return items;
}

/**
 * Overlay draft for the editing month onto committed allocations for display.
 * Other months stay committed; editing month uses draft rows with pending badges.
 */
export function summarizeWithDraftOverlay({
    investmentAllocations = [],
    draftAllocations = {},
    planKey,
    calendarYear,
    monthIndex,
    showDraft = false,
}) {
    if (!showDraft || !planKey) {
        return summarizeInvestmentAllocations(investmentAllocations);
    }

    const committedOthers = (investmentAllocations || []).filter(
        (a) => a.studioPlanKey !== planKey,
    );
    const otherSummary = summarizeInvestmentAllocations(committedOthers);
    const draftItems = buildDraftSummaryItems({
        draftAllocations,
        planKey,
        calendarYear,
        monthIndex,
    });

    const items = [...otherSummary.items, ...draftItems];
    const monthlyCommitted = items
        .filter((i) => i.isMonthly)
        .reduce((sum, i) => sum + (i.amount || 0), 0);

    return {
        items,
        monthlyCommitted,
        count: items.length,
    };
}

export function draftInstrumentTypeFromSummaryItem(item) {
    if (item?.instrumentType) return item.instrumentType;
    return normalizeAllocType(item?.type) || item?.type;
}

export {
    createEmptyDraftAllocations,
    getTotalDraftAllocated,
};
