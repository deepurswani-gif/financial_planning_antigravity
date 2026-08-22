import {
    INSTRUMENT_REGISTRY,
    STUDIO_INSTRUMENT_TYPES,
    LISP_INSTRUMENT_TYPE,
    createEmptyDraftAllocations,
    getTotalDraftAllocated,
    getDraftTypeAmount,
    areDraftTypeValuesEqual,
    isLispDraft,
    getLispDraftMonthly,
    normalizeAllocType,
} from './instrumentAnalysisLogic';
import { summarizeInvestmentAllocations } from './investSurplusLogic';
import { isProtectionAllocationType } from './putYourMoneyToWorkLogic';

const parseAmount = (value) => parseFloat(value) || 0;

export function areDraftsEqual(a = {}, b = {}) {
    return STUDIO_INSTRUMENT_TYPES.every(
        (type) => areDraftTypeValuesEqual(a[type], b[type], type),
    );
}

export function isStudioDirty(draft = {}, baseline = {}) {
    return !areDraftsEqual(draft, baseline);
}

export function sumCategoryDraft(category, draftAllocations = {}) {
    if (!category?.instruments?.length) return 0;
    return category.instruments.reduce((sum, entry) => {
        const type = typeof entry === 'string' ? entry : entry?.type;
        if (!type) return sum;
        return sum + Math.max(0, Math.round(getDraftTypeAmount(draftAllocations, type)));
    }, 0);
}

export function isCategoryDirty(category, draft = {}, baseline = {}) {
    if (!category?.instruments?.length) return false;
    return category.instruments.some((entry) => {
        const type = typeof entry === 'string' ? entry : entry?.type;
        if (!type) return false;
        return !areDraftTypeValuesEqual(draft[type], baseline[type], type);
    });
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
 * @param {'protection'|'investment'|null} scope
 * @returns {(type: string) => boolean}
 */
export function allocationTypeMatchesScope(scope) {
    if (scope === 'protection') return (type) => isProtectionAllocationType(type);
    if (scope === 'investment') return (type) => !isProtectionAllocationType(type);
    return () => true;
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
    scope = null,
}) {
    const startMonth = monthIndex + 1;
    const items = [];
    const typeAllowed = allocationTypeMatchesScope(scope);

    STUDIO_INSTRUMENT_TYPES.forEach((type) => {
        if (!typeAllowed(type)) return;
        const amount = Math.max(0, Math.round(getDraftTypeAmount(draftAllocations, type)));
        if (amount <= 0) return;
        const def = INSTRUMENT_REGISTRY[type];
        if (!def) return;
        const isMonthly = def.inputMode === 'monthly';
        const value = draftAllocations[type];
        const item = {
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
        };
        if ((type === LISP_INSTRUMENT_TYPE || type === 'Term Insurance') && isLispDraft(value)) {
            item.insuredMember = value.insuredMember || '';
            item.frequency = value.frequency || 'Monthly';
            item.duration = parseInt(value.duration, 10) || 10;
            item.premium = Math.round(parseAmount(value.premium));
        }
        items.push(item);
    });

    return items;
}

/**
 * Overlay draft for the editing month onto committed allocations for display.
 * Other months stay committed; editing month uses draft rows with pending badges.
 * @param {'protection'|'investment'|null} [scope] - Gaps vs PYMTW planned tables
 */
export function summarizeWithDraftOverlay({
    investmentAllocations = [],
    draftAllocations = {},
    planKey,
    calendarYear,
    monthIndex,
    showDraft = false,
    scope = null,
}) {
    const typeAllowed = allocationTypeMatchesScope(scope);
    const scopedAllocations = (investmentAllocations || []).filter((a) => typeAllowed(a?.type));

    if (!showDraft || !planKey) {
        return summarizeInvestmentAllocations(scopedAllocations);
    }

    const committedOthers = scopedAllocations.filter(
        (a) => a.studioPlanKey !== planKey,
    );
    const otherSummary = summarizeInvestmentAllocations(committedOthers);
    const draftItems = buildDraftSummaryItems({
        draftAllocations,
        planKey,
        calendarYear,
        monthIndex,
        scope,
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
    getDraftTypeAmount,
    getLispDraftMonthly,
};
