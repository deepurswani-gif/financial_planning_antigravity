import { INSTRUMENT_REGISTRY, getTotalDraftAllocated } from './instrumentAnalysisLogic';
import { MONTH_LABELS_LONG } from './moneyFlowLedgerLogic';

const parseAmount = (value) => parseFloat(value) || 0;
const PPF_ANNUAL_CAP = 150000;

export function computeDraftYearImpact(draftAllocations = {}, startMonth, calendarYear) {
    let impact = 0;
    Object.entries(draftAllocations).forEach(([type, amount]) => {
        if (!amount) return;
        const def = INSTRUMENT_REGISTRY[type];
        if (!def) return;
        if (def.inputMode === 'monthly') {
            const monthsActive = Math.max(0, 13 - startMonth);
            impact += amount * monthsActive;
        } else {
            impact += amount;
        }
    });
    return Math.round(impact);
}

export function getProratedYearSurplus(yearRow, planStartMonth, calendarYear) {
    if (!yearRow) return 0;
    if (yearRow.year === calendarYear) {
        const remainingMonths = Math.max(1, 12 - planStartMonth);
        return (yearRow.netInvestibleSurplus || 0) / 12 * remainingMonths;
    }
    return yearRow.netInvestibleSurplus || 0;
}

export function validateDraftPlan({
    draftAllocations = {},
    deployableSurplus = 0,
    journeyProjections = [],
    planStartMonth = 0,
    calendarYear,
    monthIndex,
    expenseCategories = {},
    investmentAllocations = [],
}) {
    const issues = [];
    const totalDraft = getTotalDraftAllocated(draftAllocations);
    const startMonth = monthIndex + 1;
    const monthLabel = MONTH_LABELS_LONG[monthIndex] || 'Month';

    if (totalDraft > deployableSurplus) {
        issues.push({
            id: 'surplus-exceeded',
            severity: 'error',
            message: `Draft allocation (₹${totalDraft.toLocaleString('en-IN')}) exceeds ${monthLabel} deployable surplus (₹${Math.round(deployableSurplus).toLocaleString('en-IN')}).`,
        });
    }

    const existingDeficit = journeyProjections.find((p) => p.yearHasDeficit);
    if (existingDeficit) {
        const deficitMonth = existingDeficit.yearDeficitMonth
            ? MONTH_LABELS_LONG[existingDeficit.yearDeficitMonth - 1]
            : null;
        issues.push({
            id: 'journey-deficit-exists',
            severity: 'warning',
            message: deficitMonth
                ? `Your journey already shows a cash-flow deficit around ${deficitMonth} ${existingDeficit.year} — adding allocations may worsen it.`
                : `Your journey already shows a cash-flow deficit in ${existingDeficit.year} — review before applying more allocations.`,
            deficitYear: existingDeficit.year,
            deficitMonth,
        });
    }

    const year1 = journeyProjections.find((p) => p.year === calendarYear) || journeyProjections[0];
    if (year1 && totalDraft > 0) {
        const proratedSurplus = getProratedYearSurplus(year1, planStartMonth, calendarYear);
        const currentAlloc = year1.yearAllocationsTotal || 0;
        const draftImpact = computeDraftYearImpact(draftAllocations, startMonth, calendarYear);
        const unallocatedAfter = proratedSurplus - currentAlloc - draftImpact;

        if (unallocatedAfter < 0) {
            issues.push({
                id: 'year-deficit-projected',
                severity: 'error',
                message: `This draft would exceed ${calendarYear} investible surplus by ₹${Math.round(Math.abs(unallocatedAfter)).toLocaleString('en-IN')} (including existing allocations).`,
                shortfall: Math.abs(unallocatedAfter),
            });
        } else if (unallocatedAfter < deployableSurplus * 0.1 && totalDraft > 0) {
            issues.push({
                id: 'surplus-tight',
                severity: 'warning',
                message: `Only ₹${Math.round(unallocatedAfter).toLocaleString('en-IN')} journey surplus would remain in ${calendarYear} after this plan.`,
            });
        }
    }

    const draftPpfMonthly = draftAllocations.PPF || 0;
    if (draftPpfMonthly > 0) {
        const existingPpfAnnual = parseAmount(expenseCategories?.savings?.ppf?.amount) * 12
            || parseAmount(expenseCategories?.savings?.ppf) * 12;
        const proposedPpfAnnual = investmentAllocations
            .filter((a) => a.type === 'PPF')
            .reduce((sum, a) => sum + parseAmount(a.amount), 0);
        const monthsActive = Math.max(0, 13 - startMonth);
        const draftPpfYear = draftPpfMonthly * monthsActive;
        const totalPpfYear = existingPpfAnnual + proposedPpfAnnual + draftPpfYear;

        if (totalPpfYear > PPF_ANNUAL_CAP) {
            issues.push({
                id: 'ppf-cap',
                severity: 'error',
                message: `PPF would exceed ₹1.5L/year cap by ₹${Math.round(totalPpfYear - PPF_ANNUAL_CAP).toLocaleString('en-IN')} — reduce PPF allocation.`,
            });
        }

        if (draftPpfMonthly > (INSTRUMENT_REGISTRY.PPF?.maxMonthly || 12500)) {
            issues.push({
                id: 'ppf-monthly-max',
                severity: 'warning',
                message: `PPF monthly allocation exceeds ₹12,500/month recommended cap.`,
            });
        }
    }

    const blockingErrors = issues.filter((i) => i.severity === 'error');
    return {
        issues,
        hasBlockingErrors: blockingErrors.length > 0,
        canApply: blockingErrors.length === 0 && totalDraft > 0 && totalDraft <= deployableSurplus,
        totalDraft,
    };
}

export function buildScenarioComparison({
    draftAllocations = {},
    topBundle,
    deployableSurplus,
    growthPreview,
    analysisBase,
    monthIndex,
    buildGrowthPreviewFn,
}) {
    if (!topBundle || !analysisBase || !buildGrowthPreviewFn) {
        return null;
    }

    const draftTotal = getTotalDraftAllocated(draftAllocations);
    const aiAllocations = { ...topBundle.allocations };
    const aiTotal = getTotalDraftAllocated(aiAllocations);

    const aiGrowth = buildGrowthPreviewFn({
        ...analysisBase,
        draftAllocations: aiAllocations,
        monthIndex,
    });

    const draftGrowthTotal = growthPreview?.scenarioTotal || growthPreview?.baselineTotal || 0;
    const aiGrowthTotal = aiGrowth?.scenarioTotal || aiGrowth?.baselineTotal || 0;
    const growthDelta = aiGrowthTotal - draftGrowthTotal;

    const draftUtilPct = deployableSurplus > 0
        ? Math.round((draftTotal / deployableSurplus) * 100)
        : 0;
    const aiUtilPct = deployableSurplus > 0
        ? Math.round((aiTotal / deployableSurplus) * 100)
        : 0;

    let recommendation = 'draft';
    if (draftTotal === 0 && aiTotal > 0) recommendation = 'ai';
    else if (aiTotal > 0 && growthDelta > 0 && draftUtilPct < aiUtilPct) recommendation = 'ai';
    else if (draftTotal > 0 && growthDelta < 0) recommendation = 'draft';

    return {
        draft: {
            label: 'Your draft',
            allocations: draftAllocations,
            total: draftTotal,
            utilPct: draftUtilPct,
            projectedTotal: draftGrowthTotal,
            growthDelta: growthPreview?.totalDelta || 0,
        },
        ai: {
            label: topBundle.label,
            bundleId: topBundle.id,
            allocations: aiAllocations,
            total: aiTotal,
            utilPct: aiUtilPct,
            projectedTotal: aiGrowthTotal,
            growthDelta: aiGrowth?.totalDelta || 0,
            narrative: topBundle.narrative,
        },
        growthDelta,
        recommendation,
        hasComparison: draftTotal > 0 || aiTotal > 0,
    };
}

export function buildStudioInsights({
    validation,
    growthPreview,
    goals = [],
    totalAllocated,
    deployableSurplus,
    activeBundleId,
    scenarioComparison,
}) {
    const insights = [];

    validation?.issues?.forEach((issue) => {
        insights.push({
            id: issue.id,
            tone: issue.severity === 'error' ? 'error' : 'warning',
            text: issue.message,
        });
    });

    if (deployableSurplus > 0 && totalAllocated === 0) {
        insights.push({
            id: 'start-allocating',
            tone: 'accent',
            text: `₹${Math.round(deployableSurplus).toLocaleString('en-IN')} is ready — pick an AI bundle or adjust instrument sliders to begin.`,
        });
    }

    if (growthPreview?.totalDelta > 0 && totalAllocated > 0) {
        insights.push({
            id: 'growth-uplift',
            tone: 'positive',
            text: `Your draft adds ₹${Math.round(growthPreview.totalDelta).toLocaleString('en-IN')} to projected instrument value by ${growthPreview.retirementYear}.`,
        });
    }

    if (activeBundleId && totalAllocated > 0) {
        insights.push({
            id: 'bundle-active',
            tone: 'accent',
            text: 'AI-recommended bundle applied — fine-tune any slider before saving or applying.',
        });
    }

    if (scenarioComparison?.recommendation === 'ai' && scenarioComparison.growthDelta > 0) {
        insights.push({
            id: 'ai-stronger',
            tone: 'accent',
            text: `The ${scenarioComparison.ai.label} bundle projects ₹${Math.round(scenarioComparison.growthDelta).toLocaleString('en-IN')} more growth than your current draft.`,
        });
    }

    const urgentGoal = goals
        .filter((g) => parseAmount(g.presentValue) > 0 || parseAmount(g.futureValue) > 0)
        .sort((a, b) => parseAmount(a.yearsToGoal) - parseAmount(b.yearsToGoal))[0];
    if (urgentGoal && totalAllocated > 0) {
        insights.push({
            id: 'goal-context',
            tone: 'neutral',
            text: `Nearest goal: ${urgentGoal.name || urgentGoal.placeholder} in ~${Math.round(parseAmount(urgentGoal.yearsToGoal))} years.`,
        });
    }

    return insights;
}

export function buildEnhancedBriefingLines({
    baseLines = [],
    validation,
    scenarioComparison,
    growthPreview,
}) {
    const extra = [];

    if (validation?.canApply && growthPreview?.hasDraft) {
        extra.push(
            `Your draft is within surplus limits and projects ₹${Math.round(growthPreview.scenarioTotal).toLocaleString('en-IN')} combined instrument value.`,
        );
    }

    if (scenarioComparison?.hasComparison && scenarioComparison.recommendation === 'ai') {
        extra.push(
            `Finbrella AI suggests the "${scenarioComparison.ai.label}" bundle may outperform your current draft on growth.`,
        );
    }

    if (validation?.hasBlockingErrors) {
        extra.push('Resolve the allocation alerts below before applying your plan.');
    }

    return [...baseLines, ...extra];
}
