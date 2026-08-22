import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { resolveEmploymentType } from '../DetailedFlow/employmentTypeSync';
import { buildYourMoneyFlowReport } from './moneyFlowLedgerLogic';
import {
    buildAllocationStudioContext,
    buildDraftAllocationPlan,
    buildRecommendedBundles,
    computeAllocationImpactForMonth,
    createEmptyDraftAllocations,
    getAllocationPlanKey,
    PROTECTION_ALLOCATION_TYPES,
    getPymtwInstrumentCategories,
} from './putYourMoneyToWorkLogic';
import {
    analyzeInstrument,
    applyAllocationPlan,
    buildGrowthPreview,
    clearStudioMonthPlan,
    compareInstrumentGoalImpacts,
    INSTRUMENT_REGISTRY,
    monthHasStudioPlan,
    normalizeAllocType,
    pruneAllocationPlansForAllocations,
    removeInvestmentAllocationById,
    LISP_INSTRUMENT_TYPE,
    createEmptyLispDraft,
    isLispDraft,
    lispDraftFromAllocation,
    getDraftTypeAmount,
    areDraftTypeValuesEqual,
} from './instrumentAnalysisLogic';
import AllocationStudioHero from './AllocationStudioHero';
import JourneyConstraintsRail from './JourneyConstraintsRail';
import InstrumentCardGrid from './InstrumentCardGrid';
import RecommendedBundles from './RecommendedBundles';
import InstrumentAnalysisPanel from './InstrumentAnalysisPanel';
import GrowthPreviewStrip from './GrowthPreviewStrip';
import StudioInsightsRail from './StudioInsightsRail';
import PlannedInvestmentAllocationsPanel from './PlannedInvestmentAllocationsPanel';
import RecalculatedSurplusPanel from './RecalculatedSurplusPanel';
import SurplusMonthChips from './SurplusMonthChips';
import AllocateSurplusPanel from './AllocateSurplusPanel';
import { useNavigateToDetailReport } from './reportNavigation';
import {
    validateDraftPlan,
    buildScenarioComparison,
    buildStudioInsights,
    buildEnhancedBriefingLines,
} from './allocationStudioValidation';
import {
    draftInstrumentTypeFromSummaryItem,
    getDisplayDraftAllocations,
    summarizeWithDraftOverlay,
} from './allocationStudioUiState';

const PPF_ANNUAL_CAP = 150000;
const PPF_MAX_MONTHLY = 12500;
const PYMTW_GATE_KEY = '__pymtwGate';
const parseAmount = (value) => parseFloat(value) || 0;

const GAPS_REPLACE_TYPES = [...PROTECTION_ALLOCATION_TYPES];
const PYMTW_REPLACE_TYPES = getPymtwInstrumentCategories()
    .flatMap((c) => c.instruments);

const getPymtwGate = (allocationPlans = {}) => ({
    adjustmentsSaved: Boolean(allocationPlans[PYMTW_GATE_KEY]?.adjustmentsSaved),
    showInvestmentAvenues: Boolean(allocationPlans[PYMTW_GATE_KEY]?.showInvestmentAvenues),
});

const withPymtwGate = (allocationPlans = {}, patch = {}) => ({
    ...allocationPlans,
    [PYMTW_GATE_KEY]: {
        ...(allocationPlans[PYMTW_GATE_KEY] || {}),
        ...patch,
    },
});

const hasUnlockedInvestmentAvenues = (allocationPlans = {}, investmentAllocations = []) => {
    const hasStudioPlan = (investmentAllocations || []).some((a) => a?.studioPlanKey);
    const hasMonthPlan = Object.entries(allocationPlans || {}).some(
        ([key, plan]) => key !== PYMTW_GATE_KEY && plan && (plan.status === 'applied' || plan.status === 'draft'),
    );
    return hasStudioPlan || hasMonthPlan;
};

const getMonthlyPpfCap = (
    expenseCategories = {},
    investmentAllocations = [],
    draftAllocations = {},
    excludePlanKey = null,
) => {
    const existingPpfAnnual = parseAmount(expenseCategories?.savings?.ppf?.amount) * 12
        || parseAmount(expenseCategories?.savings?.ppf) * 12;
    const proposedPpfAnnual = investmentAllocations
        .filter((a) => a.type === 'PPF' && a.studioPlanKey !== excludePlanKey)
        .reduce((sum, a) => sum + parseAmount(a.amount), 0);
    const draftPpfAnnual = Object.entries(draftAllocations).reduce((sum, [type, amount]) => (
        type === 'PPF' ? sum + (parseAmount(amount) * 12) : sum
    ), 0);
    const availableAnnual = Math.max(0, PPF_ANNUAL_CAP - existingPpfAnnual - proposedPpfAnnual - draftPpfAnnual);
    return Math.min(PPF_MAX_MONTHLY, Math.floor(availableAnnual / 12));
};

const analysisParams = ({
    expenseCategories,
    assetCategories,
    investmentAllocations,
    calculatorInputs,
    goalMappings,
    goals,
    familyMembers,
    calendarYear,
}) => ({
    expenseCategories,
    assetCategories,
    investmentAllocations,
    calculatorInputs,
    goalMappings,
    goals,
    familyMembers,
    currentYear: calendarYear,
});

const draftFromPlanItems = (items) => {
    const draft = createEmptyDraftAllocations();
    items?.forEach((item) => {
        if (!item.instrumentType) return;
        if (item.instrumentType === LISP_INSTRUMENT_TYPE || item.instrumentType === 'Term Insurance') {
            draft[item.instrumentType] = {
                premium: Math.round(parseAmount(item.premium ?? item.amount)),
                frequency: item.frequency || 'Monthly',
                duration: parseInt(item.duration, 10) || 10,
                insuredMember: item.insuredMember || '',
            };
            return;
        }
        draft[item.instrumentType] = item.amount || 0;
    });
    return draft;
};

const draftFromStudioAllocations = (investmentAllocations = [], studioPlanKey) => {
    const draft = createEmptyDraftAllocations();
    investmentAllocations
        .filter((alloc) => alloc.studioPlanKey === studioPlanKey)
        .forEach((alloc) => {
            const type = normalizeAllocType(alloc.type) || alloc.type;
            const def = INSTRUMENT_REGISTRY[type];
            if (!def || !(type in draft)) return;
            if (type === LISP_INSTRUMENT_TYPE || type === 'Term Insurance') {
                draft[type] = lispDraftFromAllocation(alloc);
                return;
            }
            const raw = Math.round(parseAmount(alloc.amount));
            const amount = def.inputMode === 'monthly' ? Math.round(raw / 12) : raw;
            draft[type] = (draft[type] || 0) + Math.max(0, amount);
        });
    return draft;
};

const PutYourMoneyToWorkSection = ({ mode = 'pymtw' }) => {
    const isGaps = mode === 'gaps';
    const reportScope = isGaps ? 'gaps' : 'pymtw';
    const replaceTypes = isGaps ? GAPS_REPLACE_TYPES : PYMTW_REPLACE_TYPES;
    const navigateToDetailReport = useNavigateToDetailReport();
    const [wizardStep, setWizardStep] = useState(1);
    const {
        currentYearLedger,
        planStartMonth,
        familyMembers,
        income,
        expenseCategories,
        hasSpouseIncome,
        journeyProjections,
        journeyAdjustments,
        setJourneyAdjustments,
        assetCategories,
        contingencyFund,
        summaryLifeCover,
        investmentAllocations,
        setInvestmentAllocations,
        calculatorInputs,
        goalMappings,
        goals,
        allocationPlans,
        setAllocationPlans,
        summaryHealthCover,
        hasHealthInsurance,
        inflationRates,
        policies,
        liabilityCategories,
    } = useFinancialPlan();

    const moneyFlowReport = useMemo(
        () => buildYourMoneyFlowReport({
            currentYearLedger,
            planStartMonth,
            familyMembers,
            income,
            expenseCategories,
            hasSpouseIncome,
            resolveEmploymentType,
            journeyProjections,
        }),
        [
            currentYearLedger,
            planStartMonth,
            familyMembers,
            income,
            expenseCategories,
            hasSpouseIncome,
            journeyProjections,
        ],
    );

    const defaultMonth = moneyFlowReport?.meta?.currentMonth >= (moneyFlowReport?.meta?.planStartMonth ?? 0)
        ? moneyFlowReport.meta.currentMonth
        : (moneyFlowReport?.meta?.planStartMonth ?? 0);

    const [selectedMonthIndex, setSelectedMonthIndex] = useState(null);
    const [activePanelType, setActivePanelType] = useState(null);
    const [draftAllocations, setDraftAllocations] = useState(() => createEmptyDraftAllocations());
    const [activeBundleId, setActiveBundleId] = useState(null);
    const [appliedPlanKey, setAppliedPlanKey] = useState(null);
    const [avenuesMode, setAvenuesMode] = useState('choose');
    const [isManualEditing, setIsManualEditing] = useState(false);
    const [applyError, setApplyError] = useState('');
    const [adjustmentSaveMessage, setAdjustmentSaveMessage] = useState('');
    const [draftHydratedFromApplied, setDraftHydratedFromApplied] = useState(false);
    const [lastAppliedBundleId, setLastAppliedBundleId] = useState(null);
    const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
    const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
    const [pendingMonthIndex, setPendingMonthIndex] = useState(null);
    const [pendingLeaveToAi, setPendingLeaveToAi] = useState(false);
    const [expandedAvenueType, setExpandedAvenueType] = useState(null);
    const persistedGate = getPymtwGate(allocationPlans);
    const inferredUnlocked = hasUnlockedInvestmentAvenues(allocationPlans, investmentAllocations);
    const adjustmentsSaved = persistedGate.adjustmentsSaved || inferredUnlocked;
    const showInvestmentAvenues = persistedGate.showInvestmentAvenues || inferredUnlocked;
    const effectiveMonth = selectedMonthIndex ?? defaultMonth;

    const studio = useMemo(
        () => buildAllocationStudioContext({
            moneyFlowReport,
            expenseCategories,
            assetCategories,
            contingencyFund,
            summaryLifeCover,
            familyMembers,
            journeyAdjustments,
            journeyProjections,
            investmentAllocations,
            calculatorInputs,
            goalMappings,
            goals,
            selectedMonthIndex: effectiveMonth,
            reportScope,
            policies,
            liabilityCategories,
            income,
            inflationRates,
        }),
        [
            moneyFlowReport,
            expenseCategories,
            assetCategories,
            contingencyFund,
            summaryLifeCover,
            familyMembers,
            journeyAdjustments,
            journeyProjections,
            investmentAllocations,
            calculatorInputs,
            goalMappings,
            goals,
            effectiveMonth,
            reportScope,
            policies,
            liabilityCategories,
            income,
            inflationRates,
        ],
    );

    const planKey = studio.meta?.hasData
        ? getAllocationPlanKey(studio.meta.calendarYear, effectiveMonth)
        : null;

    useEffect(() => {
        if (!planKey || isManualEditing) return;
        const saved = allocationPlans[planKey];
        if (saved?.status === 'draft') {
            const hasItems = (saved.items || []).some((item) => (item.amount || 0) > 0);
            setDraftAllocations(draftFromPlanItems(saved.items));
            setActiveBundleId(saved.selectedBundleId || null);
            setAppliedPlanKey(null);
            setAvenuesMode(hasItems && !saved.selectedBundleId ? 'manual_edit' : 'choose');
            setDraftHydratedFromApplied(false);
        } else if (saved?.status === 'applied') {
            setDraftAllocations(createEmptyDraftAllocations());
            setActiveBundleId(saved.selectedBundleId || null);
            setLastAppliedBundleId(saved.selectedBundleId || null);
            setAppliedPlanKey(planKey);
            setAvenuesMode(saved.selectedBundleId ? 'ai_applied' : 'manual_applied');
            setDraftHydratedFromApplied(false);
        } else {
            setDraftAllocations(createEmptyDraftAllocations());
            setActiveBundleId(null);
            setAppliedPlanKey(null);
            setAvenuesMode('choose');
            setDraftHydratedFromApplied(false);
        }
    }, [planKey, allocationPlans, isManualEditing]);

    const appliedBaseline = useMemo(() => {
        if (!planKey) return createEmptyDraftAllocations();
        return draftFromStudioAllocations(investmentAllocations, planKey);
    }, [investmentAllocations, planKey]);

    const replaceTypeSet = useMemo(() => new Set(replaceTypes), [replaceTypes]);

    const scopedDraftTotal = useCallback((draft) => (
        replaceTypes.reduce((sum, type) => sum + Math.max(0, getDraftTypeAmount(draft, type)), 0)
    ), [replaceTypes]);

    const areScopedDraftsEqual = useCallback((a, b) => (
        replaceTypes.every((type) => areDraftTypeValuesEqual(a?.[type], b?.[type], type))
    ), [replaceTypes]);

    const hasScopedMonthPlan = useMemo(() => {
        if (!planKey) return false;
        return (investmentAllocations || []).some((a) => {
            if (a.studioPlanKey !== planKey) return false;
            const type = normalizeAllocType(a.type) || a.type;
            return replaceTypeSet.has(type);
        });
    }, [investmentAllocations, planKey, replaceTypeSet]);

    const hasAppliedMonthPlan = Boolean(
        planKey
        && (
            hasScopedMonthPlan
            || allocationPlans[planKey]?.status === 'applied'
            || appliedPlanKey === planKey
        ),
    );

    const isEditingMonth = avenuesMode === 'manual_edit';
    const isDirty = isEditingMonth && !areScopedDraftsEqual(draftAllocations, appliedBaseline);
    const headerAllocations = getDisplayDraftAllocations({
        isEditing: isEditingMonth,
        draftAllocations,
        baselineAllocations: appliedBaseline,
    });
    const stickyTotalAllocation = scopedDraftTotal(headerAllocations);
    const editingMonthLabel = studio.meta?.hasData
        ? `Editing ${studio.meta.monthLabel} ${studio.meta.calendarYear}`
        : '';
    const saveLabel = hasAppliedMonthPlan && draftHydratedFromApplied ? 'Save Changes' : 'Save Plan';
    const statusHint = isEditingMonth && !isDirty ? 'No changes to save.' : '';

    const doMonthChange = useCallback((monthIndex) => {
        setIsManualEditing(false);
        setDraftHydratedFromApplied(false);
        setShowReplaceConfirm(false);
        setPendingMonthIndex(null);
        setPendingLeaveToAi(false);
        setSaveSuccessMessage('');
        setApplyError('');
        setAvenuesMode('choose');
        setAppliedPlanKey(null);
        setActiveBundleId(null);
        setDraftAllocations(createEmptyDraftAllocations());
        setSelectedMonthIndex(monthIndex);
    }, []);

    const handleMonthChange = useCallback((monthIndex) => {
        if (monthIndex === effectiveMonth) return;
        if (isDirty) {
            setPendingMonthIndex(monthIndex);
            return;
        }
        doMonthChange(monthIndex);
    }, [effectiveMonth, isDirty, doMonthChange]);

    const analysisBase = useMemo(() => {
        if (!studio.meta?.hasData) return null;
        return analysisParams({
            expenseCategories,
            assetCategories,
            investmentAllocations,
            calculatorInputs,
            goalMappings,
            goals,
            familyMembers,
            calendarYear: studio.meta.calendarYear,
        });
    }, [
        studio.meta,
        expenseCategories,
        assetCategories,
        investmentAllocations,
        calculatorInputs,
        goalMappings,
        goals,
        familyMembers,
    ]);

    const totalAllocated = scopedDraftTotal(
        isEditingMonth ? draftAllocations : (hasAppliedMonthPlan ? appliedBaseline : draftAllocations),
    );
    const editingStudioImpact = useMemo(() => {
        if (!studio.meta?.hasData || !planKey) return 0;
        if (avenuesMode !== 'manual_edit' && !hasAppliedMonthPlan && !isGaps) return 0;
        const monthRows = (investmentAllocations || []).filter((a) => a.studioPlanKey === planKey);
        const scopedRows = monthRows.filter((a) => {
            const type = normalizeAllocType(a.type) || a.type;
            return replaceTypes.includes(type);
        });
        return computeAllocationImpactForMonth(
            scopedRows,
            studio.meta.calendarYear,
            effectiveMonth,
        );
    }, [
        avenuesMode,
        hasAppliedMonthPlan,
        investmentAllocations,
        planKey,
        studio.meta,
        effectiveMonth,
        replaceTypes,
        isGaps,
    ]);
    // Gaps: Protection claims surplus before FFA — add journey deduction back into the draft ceiling.
    const availableSurplus = (studio.hero?.deployableSurplus || 0)
        + editingStudioImpact
        + (isGaps ? (studio.hero?.journeyMonthDeduction || 0) : 0);
    const remaining = availableSurplus - totalAllocated;
    const ppfMaxByCap = useMemo(
        () => getMonthlyPpfCap(
            expenseCategories,
            investmentAllocations,
            {
                ...(isEditingMonth ? draftAllocations : (hasAppliedMonthPlan ? appliedBaseline : draftAllocations)),
                PPF: 0,
            },
            planKey,
        ),
        [
            expenseCategories,
            investmentAllocations,
            draftAllocations,
            isEditingMonth,
            hasAppliedMonthPlan,
            appliedBaseline,
            planKey,
        ],
    );
    const maxForInstrument = useCallback((instrumentType) => {
        const display = isEditingMonth
            ? draftAllocations
            : (hasAppliedMonthPlan ? appliedBaseline : draftAllocations);
        const currentDraft = getDraftTypeAmount(display, instrumentType);
        const genericMax = currentDraft + Math.max(0, remaining);
        if (instrumentType !== 'PPF') return genericMax;
        return Math.min(genericMax, Math.max(currentDraft, ppfMaxByCap));
    }, [
        draftAllocations,
        isEditingMonth,
        hasAppliedMonthPlan,
        appliedBaseline,
        remaining,
        ppfMaxByCap,
    ]);

    const growthPreview = useMemo(() => {
        if (!analysisBase || !studio.meta?.hasData) return null;
        return buildGrowthPreview({
            ...analysisBase,
            draftAllocations,
            monthIndex: effectiveMonth,
        });
    }, [analysisBase, draftAllocations, effectiveMonth, studio.meta]);

    const appliedGrowthPreview = useMemo(() => {
        if (avenuesMode !== 'ai_applied' && avenuesMode !== 'manual_applied') return null;
        const snap = allocationPlans[planKey]?.computedSnapshot;
        if (!snap) return null;
        return {
            hasDraft: true,
            baselineTotal: snap.retirementCorpusBefore || 0,
            scenarioTotal: snap.retirementCorpusAfter || 0,
            totalDelta: snap.retirementCorpusDelta || 0,
            retirementYear: snap.retirementYear || growthPreview?.retirementYear,
            rows: [],
        };
    }, [avenuesMode, allocationPlans, planKey, growthPreview?.retirementYear]);

    const recommendedBundles = useMemo(
        () => buildRecommendedBundles({
            deployableSurplus: studio.hero?.deployableSurplus || 0,
            contingencyData: studio.safety?.contingencyData,
            protectionData: studio.safety?.protectionData,
            goals,
            familyMembers,
            expenseCategories,
            assetCategories,
            contingencyFund,
            summaryLifeCover,
            summaryHealthCover,
            hasHealthInsurance,
            policies,
            inflationRates,
            ppfMaxMonthly: ppfMaxByCap,
        }),
        [
            studio.hero,
            studio.safety,
            goals,
            familyMembers,
            expenseCategories,
            assetCategories,
            contingencyFund,
            summaryLifeCover,
            summaryHealthCover,
            hasHealthInsurance,
            policies,
            inflationRates,
            ppfMaxByCap,
        ],
    );

    const engineResult = recommendedBundles[0]?.engineResult || null;

    const validation = useMemo(() => {
        if (!studio.meta?.hasData) return { issues: [], hasBlockingErrors: false, canApply: false };
        return validateDraftPlan({
            draftAllocations,
            deployableSurplus: availableSurplus,
            journeyProjections,
            planStartMonth: studio.meta.planStartMonth,
            calendarYear: studio.meta.calendarYear,
            monthIndex: effectiveMonth,
            expenseCategories,
            investmentAllocations,
            excludePlanKey: avenuesMode === 'manual_edit' ? planKey : null,
        });
    }, [
        draftAllocations,
        availableSurplus,
        studio.meta,
        journeyProjections,
        effectiveMonth,
        expenseCategories,
        investmentAllocations,
        avenuesMode,
        planKey,
    ]);

    const scenarioComparison = useMemo(() => {
        if (!analysisBase || !recommendedBundles.length) return null;
        return buildScenarioComparison({
            draftAllocations,
            topBundle: recommendedBundles[0],
            deployableSurplus: studio.hero?.deployableSurplus || 0,
            growthPreview,
            analysisBase,
            monthIndex: effectiveMonth,
            buildGrowthPreviewFn: buildGrowthPreview,
        });
    }, [
        draftAllocations,
        recommendedBundles,
        studio.hero,
        growthPreview,
        analysisBase,
        effectiveMonth,
    ]);

    const studioInsights = useMemo(
        () => buildStudioInsights({
            validation,
            growthPreview,
            goals,
            totalAllocated,
            deployableSurplus: studio.hero?.deployableSurplus || 0,
            activeBundleId,
            scenarioComparison,
        }),
        [validation, growthPreview, goals, totalAllocated, studio.hero, activeBundleId, scenarioComparison],
    );

    const enhancedBriefingLines = useMemo(
        () => buildEnhancedBriefingLines({
            baseLines: studio.briefing?.lines || [],
            validation,
            scenarioComparison,
            growthPreview,
        }),
        [studio.briefing, validation, scenarioComparison, growthPreview],
    );

    const panelBaseline = useMemo(() => (
        activePanelType && analysisBase
            ? analyzeInstrument(activePanelType, analysisBase, 0, effectiveMonth, studio.meta.calendarYear)
            : null
    ), [activePanelType, analysisBase, effectiveMonth, studio.meta?.calendarYear]);

    const panelScenario = useMemo(() => (
        activePanelType && analysisBase
            ? analyzeInstrument(
                activePanelType,
                analysisBase,
                getDraftTypeAmount(draftAllocations, activePanelType),
                effectiveMonth,
                studio.meta.calendarYear,
            )
            : null
    ), [activePanelType, analysisBase, draftAllocations, effectiveMonth, studio.meta?.calendarYear]);

    const panelGoalDeltas = useMemo(
        () => compareInstrumentGoalImpacts(
            panelBaseline?.goalImpacts || [],
            panelScenario?.goalImpacts || [],
        ),
        [panelBaseline, panelScenario],
    );

    const persistDraft = useCallback((draft, bundleId) => {
        if (!planKey || !studio.meta?.hasData || !analysisBase) return;
        const draftPlan = buildDraftAllocationPlan({
            planKey,
            deployableSurplus: studio.hero.deployableSurplus,
            draftAllocations: draft,
            selectedBundleId: bundleId,
            calendarYear: studio.meta.calendarYear,
            monthIndex: effectiveMonth,
            monthLabel: studio.meta.monthLabel,
            growthPreview: buildGrowthPreview({
                ...analysisBase,
                draftAllocations: draft,
                monthIndex: effectiveMonth,
            }),
        });
        setAllocationPlans({ ...allocationPlans, [planKey]: draftPlan });
    }, [
        planKey,
        studio,
        effectiveMonth,
        analysisBase,
        allocationPlans,
        setAllocationPlans,
    ]);

    const handleDraftChange = useCallback((instrumentType, amount) => {
        const requested = Math.max(0, Math.round(amount));
        const leavingAppliedView = avenuesMode !== 'manual_edit' && hasAppliedMonthPlan;
        const base = leavingAppliedView ? appliedBaseline : draftAllocations;

        let maxAllowed;
        if (leavingAppliedView) {
            const monthRows = (investmentAllocations || []).filter((a) => a.studioPlanKey === planKey);
            const scopedRows = monthRows.filter((a) => {
                const type = normalizeAllocType(a.type) || a.type;
                return replaceTypes.includes(type);
            });
            const impact = computeAllocationImpactForMonth(
                scopedRows,
                studio.meta?.calendarYear,
                effectiveMonth,
            );
            const avail = (studio.hero?.deployableSurplus || 0)
                + impact
                + (isGaps ? (studio.hero?.journeyMonthDeduction || 0) : 0);
            const others = scopedDraftTotal(base) - getDraftTypeAmount(base, instrumentType);
            maxAllowed = Math.max(getDraftTypeAmount(base, instrumentType), avail - others);
            if (instrumentType === 'PPF') {
                maxAllowed = Math.min(
                    maxAllowed,
                    Math.max(
                        getDraftTypeAmount(base, 'PPF'),
                        getMonthlyPpfCap(expenseCategories, investmentAllocations, { ...base, PPF: 0 }, planKey),
                    ),
                );
            }
        } else {
            maxAllowed = maxForInstrument(instrumentType);
        }

        const rounded = Math.min(requested, Math.max(0, maxAllowed));
        const next = { ...base, [instrumentType]: rounded };
        setDraftAllocations(next);
        setActiveBundleId(null);
        setAppliedPlanKey(null);
        setAvenuesMode('manual_edit');
        setIsManualEditing(true);
        setApplyError('');
        setSaveSuccessMessage('');
        if (leavingAppliedView) {
            setDraftHydratedFromApplied(true);
        } else if (avenuesMode !== 'manual_edit') {
            setDraftHydratedFromApplied(false);
        }
        persistDraft(next, null);
    }, [
        draftAllocations,
        persistDraft,
        avenuesMode,
        hasAppliedMonthPlan,
        appliedBaseline,
        investmentAllocations,
        planKey,
        studio,
        effectiveMonth,
        expenseCategories,
        maxForInstrument,
        replaceTypes,
        scopedDraftTotal,
        isGaps,
    ]);

    const handleLispDraftChange = useCallback((lispDraft, targetType = LISP_INSTRUMENT_TYPE) => {
        const leavingAppliedView = avenuesMode !== 'manual_edit' && hasAppliedMonthPlan;
        const base = leavingAppliedView ? appliedBaseline : draftAllocations;
        const nextLisp = isLispDraft(lispDraft) ? { ...createEmptyLispDraft(targetType), ...lispDraft } : createEmptyLispDraft(targetType);
        const next = { ...base, [targetType]: nextLisp };
        setDraftAllocations(next);
        setActiveBundleId(null);
        setAppliedPlanKey(null);
        setAvenuesMode('manual_edit');
        setIsManualEditing(true);
        setApplyError('');
        setSaveSuccessMessage('');
        if (leavingAppliedView) {
            setDraftHydratedFromApplied(true);
        } else if (avenuesMode !== 'manual_edit') {
            setDraftHydratedFromApplied(false);
        }
        persistDraft(next, null);
    }, [
        avenuesMode,
        hasAppliedMonthPlan,
        appliedBaseline,
        draftAllocations,
        persistDraft,
    ]);

    const enterManualEditIfNeeded = useCallback(() => {
        if (avenuesMode === 'choose') {
            setDraftAllocations({ ...appliedBaseline });
            setAvenuesMode('manual_edit');
            setIsManualEditing(true);
            setDraftHydratedFromApplied(hasAppliedMonthPlan);
        }
    }, [avenuesMode, appliedBaseline, hasAppliedMonthPlan]);

    const handleExpandAvenue = useCallback((type) => {
        enterManualEditIfNeeded();
        setExpandedAvenueType((prev) => (prev === type ? null : type));
    }, [enterManualEditIfNeeded]);

    const commitAppliedPlan = useCallback((allocations, bundleId) => {
        if (!planKey || !studio.meta?.hasData) return false;

        const planValidation = validateDraftPlan({
            draftAllocations: allocations,
            deployableSurplus: availableSurplus,
            journeyProjections,
            planStartMonth: studio.meta.planStartMonth,
            calendarYear: studio.meta.calendarYear,
            monthIndex: effectiveMonth,
            expenseCategories,
            investmentAllocations,
            excludePlanKey: planKey,
        });
        if (!planValidation.canApply) {
            const firstError = planValidation.issues.find((issue) => issue.severity === 'error');
            setApplyError(firstError?.message || 'Unable to apply allocations. Please review your draft.');
            return false;
        }

        setApplyError('');
        const preview = analysisBase
            ? buildGrowthPreview({
                ...analysisBase,
                draftAllocations: allocations,
                monthIndex: effectiveMonth,
            })
            : growthPreview;

        const updatedAllocations = applyAllocationPlan({
            investmentAllocations,
            draftAllocations: allocations,
            calendarYear: studio.meta.calendarYear,
            monthIndex: effectiveMonth,
            // Full AI bundle replaces the whole month; manual/scoped saves merge by report.
            replaceTypes: bundleId ? null : replaceTypes,
        });
        setInvestmentAllocations(updatedAllocations);

        const applied = {
            ...buildDraftAllocationPlan({
                planKey,
                deployableSurplus: studio.hero.deployableSurplus,
                draftAllocations: allocations,
                selectedBundleId: bundleId,
                calendarYear: studio.meta.calendarYear,
                monthIndex: effectiveMonth,
                monthLabel: studio.meta.monthLabel,
                growthPreview: preview,
            }),
            status: 'applied',
            appliedAt: new Date().toISOString(),
        };
        setAllocationPlans({ ...allocationPlans, [planKey]: applied });
        setDraftAllocations(createEmptyDraftAllocations());
        setActiveBundleId(bundleId);
        setLastAppliedBundleId(bundleId);
        setAppliedPlanKey(planKey);
        setAvenuesMode(bundleId ? 'ai_applied' : 'manual_applied');
        setIsManualEditing(false);
        setDraftHydratedFromApplied(false);
        setShowReplaceConfirm(false);
        setSaveSuccessMessage(
            `✓ ${studio.meta.monthLabel} allocation plan updated successfully.`,
        );
        return true;
    }, [
        planKey,
        studio,
        journeyProjections,
        effectiveMonth,
        expenseCategories,
        investmentAllocations,
        setInvestmentAllocations,
        analysisBase,
        growthPreview,
        allocationPlans,
        setAllocationPlans,
        availableSurplus,
        replaceTypes,
    ]);

    const handleApplyAiRecommendations = useCallback(() => {
        const bundle = recommendedBundles[0];
        if (!bundle) return;
        const next = { ...createEmptyDraftAllocations(), ...bundle.allocations };
        if (next.PPF > 0) {
            next.PPF = Math.min(Math.max(0, Math.round(next.PPF)), ppfMaxByCap);
        }
        const applied = commitAppliedPlan(next, bundle.id);
        if (!applied) {
            setDraftAllocations(next);
            setActiveBundleId(bundle.id);
            setAppliedPlanKey(null);
            persistDraft(next, bundle.id);
        }
    }, [recommendedBundles, ppfMaxByCap, commitAppliedPlan, persistDraft]);

    const handleStartManualAllocation = useCallback(() => {
        if (isGaps) {
            navigateToDetailReport('put_your_money_to_work');
            return;
        }
        setDraftAllocations(createEmptyDraftAllocations());
        setActiveBundleId(null);
        setAppliedPlanKey(null);
        setAvenuesMode('manual_edit');
        setIsManualEditing(true);
        setApplyError('');
        setDraftHydratedFromApplied(false);
        setSaveSuccessMessage('');
        setShowReplaceConfirm(false);
    }, [isGaps, navigateToDetailReport]);

    // Gaps: keep Protection studio in edit mode so sliders/save work without AI gate.
    // Always hydrate from the month's committed Protection rows so we don't look "dirty"
    // with an empty draft and block month chips after the first switch.
    useEffect(() => {
        if (!isGaps || !studio.meta?.hasData || !planKey) return;
        if (avenuesMode !== 'choose') return;
        const baseline = draftFromStudioAllocations(investmentAllocations, planKey);
        setDraftAllocations(baseline);
        setDraftHydratedFromApplied(
            GAPS_REPLACE_TYPES.some((type) => parseAmount(baseline[type]) > 0),
        );
        setAvenuesMode('manual_edit');
        setIsManualEditing(true);
    }, [isGaps, studio.meta?.hasData, avenuesMode, planKey, investmentAllocations]);

    const performSavePlan = useCallback(() => {
        const ok = commitAppliedPlan(draftAllocations, null);
        if (ok && pendingMonthIndex != null) {
            const nextMonth = pendingMonthIndex;
            setPendingMonthIndex(null);
            doMonthChange(nextMonth);
        }
        return ok;
    }, [commitAppliedPlan, draftAllocations, pendingMonthIndex, doMonthChange]);

    const handleApplyManualAllocations = useCallback(() => {
        if (!isDirty) return;
        if (hasAppliedMonthPlan && !draftHydratedFromApplied) {
            setShowReplaceConfirm(true);
            return;
        }
        performSavePlan();
    }, [
        isDirty,
        hasAppliedMonthPlan,
        draftHydratedFromApplied,
        performSavePlan,
    ]);

    const handleConfirmReplacePlan = useCallback(() => {
        performSavePlan();
    }, [performSavePlan]);

    const handleDiscardChanges = useCallback(() => {
        if (!planKey || !studio.meta?.hasData) return;

        setApplyError('');
        setSaveSuccessMessage('');
        setShowReplaceConfirm(false);

        const hasCommittedRows = (investmentAllocations || []).some(
            (a) => a.studioPlanKey === planKey,
        );

        if (hasCommittedRows) {
            const baseline = draftFromStudioAllocations(investmentAllocations, planKey);
            const bundleId = lastAppliedBundleId;
            const restored = {
                ...buildDraftAllocationPlan({
                    planKey,
                    deployableSurplus: studio.hero?.deployableSurplus || 0,
                    draftAllocations: baseline,
                    selectedBundleId: bundleId,
                    calendarYear: studio.meta.calendarYear,
                    monthIndex: effectiveMonth,
                    monthLabel: studio.meta.monthLabel,
                    growthPreview: analysisBase
                        ? buildGrowthPreview({
                            ...analysisBase,
                            draftAllocations: baseline,
                            monthIndex: effectiveMonth,
                        })
                        : null,
                }),
                status: 'applied',
            };
            setAllocationPlans({ ...allocationPlans, [planKey]: restored });
            setDraftAllocations(createEmptyDraftAllocations());
            setActiveBundleId(bundleId);
            setAppliedPlanKey(planKey);
            setAvenuesMode(bundleId ? 'ai_applied' : 'manual_applied');
            setIsManualEditing(false);
            setDraftHydratedFromApplied(false);
            return;
        }

        const nextPlans = { ...allocationPlans };
        if (nextPlans[planKey]?.status === 'draft') {
            delete nextPlans[planKey];
            setAllocationPlans(nextPlans);
        }
        setDraftAllocations(createEmptyDraftAllocations());
        setActiveBundleId(null);
        setAppliedPlanKey(null);
        setAvenuesMode('choose');
        setIsManualEditing(false);
        setDraftHydratedFromApplied(false);
    }, [
        planKey,
        studio,
        investmentAllocations,
        lastAppliedBundleId,
        effectiveMonth,
        analysisBase,
        allocationPlans,
        setAllocationPlans,
    ]);

    const handleMonthSwitchStay = useCallback(() => {
        setPendingMonthIndex(null);
    }, []);

    const handleMonthSwitchDiscard = useCallback(() => {
        const nextMonth = pendingMonthIndex;
        handleDiscardChanges();
        if (nextMonth != null) doMonthChange(nextMonth);
    }, [pendingMonthIndex, handleDiscardChanges, doMonthChange]);

    const handleMonthSwitchSave = useCallback(() => {
        if (hasAppliedMonthPlan && !draftHydratedFromApplied) {
            setShowReplaceConfirm(true);
            return;
        }
        performSavePlan();
    }, [
        hasAppliedMonthPlan,
        draftHydratedFromApplied,
        performSavePlan,
    ]);

    const allocationsSummary = useMemo(
        () => summarizeWithDraftOverlay({
            investmentAllocations,
            draftAllocations,
            planKey,
            calendarYear: studio.meta?.calendarYear,
            monthIndex: effectiveMonth,
            showDraft: isEditingMonth,
            scope: isGaps ? 'protection' : 'investment',
        }),
        [
            investmentAllocations,
            draftAllocations,
            planKey,
            studio.meta?.calendarYear,
            effectiveMonth,
            isEditingMonth,
            isGaps,
        ],
    );

    const hasMonthPlan = Boolean(
        studio.meta?.hasData
        && (
            monthHasStudioPlan(investmentAllocations, studio.meta.calendarYear, effectiveMonth)
            || allocationPlans[planKey]?.status === 'applied'
            || appliedPlanKey === planKey
        ),
    );

    const resetLocalDraftState = useCallback(() => {
        setDraftAllocations(createEmptyDraftAllocations());
        setActiveBundleId(null);
        setAppliedPlanKey(null);
        setAvenuesMode('choose');
        setIsManualEditing(false);
        setApplyError('');
        setDraftHydratedFromApplied(false);
        setShowReplaceConfirm(false);
        setSaveSuccessMessage('');
        setPendingMonthIndex(null);
        setPendingLeaveToAi(false);
    }, []);

    const handleClearMonthPlan = useCallback((planKeyOverride, { force = false } = {}) => {
        const targetKey = planKeyOverride || planKey;
        if (!targetKey || !studio.meta?.hasData) return;
        if (!force && isDirty && targetKey === planKey) return;

        const [yearStr, monthStr] = String(targetKey).split('-');
        const calendarYear = parseInt(yearStr, 10);
        const monthIndex = parseInt(monthStr, 10);
        if (!Number.isFinite(calendarYear) || !Number.isFinite(monthIndex)) return;

        const nextAllocations = clearStudioMonthPlan({
            investmentAllocations,
            calendarYear,
            monthIndex,
            clearTypes: replaceTypes,
        });
        setInvestmentAllocations(nextAllocations);

        const nextPlans = { ...allocationPlans };
        // Keep plan meta if other scope still has rows for this month
        const stillHasPlan = nextAllocations.some((a) => a.studioPlanKey === targetKey);
        if (!stillHasPlan) {
            delete nextPlans[targetKey];
        }
        setAllocationPlans(pruneAllocationPlansForAllocations(nextPlans, nextAllocations));

        if (targetKey === planKey) {
            resetLocalDraftState();
        }
    }, [
        planKey,
        studio.meta,
        investmentAllocations,
        setInvestmentAllocations,
        allocationPlans,
        setAllocationPlans,
        resetLocalDraftState,
        isDirty,
        replaceTypes,
    ]);

    const handleEditMonthPlan = useCallback((planKeyOverride) => {
        const targetKey = planKeyOverride || planKey;
        if (!targetKey || !studio.meta?.hasData) return;

        const [yearStr, monthStr] = String(targetKey).split('-');
        const calendarYear = parseInt(yearStr, 10);
        const monthIndex = parseInt(monthStr, 10);
        if (!Number.isFinite(calendarYear) || !Number.isFinite(monthIndex)) return;

        if (isDirty && monthIndex !== effectiveMonth) {
            setPendingMonthIndex(monthIndex);
            return;
        }

        const priorBundleId = allocationPlans[targetKey]?.selectedBundleId
            || (targetKey === planKey ? lastAppliedBundleId : null);
        if (priorBundleId) setLastAppliedBundleId(priorBundleId);

        const nextDraft = draftFromStudioAllocations(investmentAllocations, targetKey);

        const monthLabel = studio.selectableMonths?.find((m) => m.monthIndex === monthIndex)?.label
            || studio.meta.monthLabel
            || `Month ${monthIndex + 1}`;

        const draftPlan = {
            ...buildDraftAllocationPlan({
                planKey: targetKey,
                deployableSurplus: studio.hero?.deployableSurplus || 0,
                draftAllocations: nextDraft,
                selectedBundleId: null,
                calendarYear,
                monthIndex,
                monthLabel,
                growthPreview: analysisBase
                    ? buildGrowthPreview({
                        ...analysisBase,
                        draftAllocations: nextDraft,
                        monthIndex,
                    })
                    : null,
            }),
            status: 'draft',
        };

        setAllocationPlans(withPymtwGate({
            ...allocationPlans,
            [targetKey]: draftPlan,
        }, {
            adjustmentsSaved: true,
            showInvestmentAvenues: true,
        }));

        setSelectedMonthIndex(monthIndex);
        setDraftAllocations(nextDraft);
        setActiveBundleId(null);
        setAppliedPlanKey(null);
        setAvenuesMode('manual_edit');
        setIsManualEditing(true);
        setDraftHydratedFromApplied(true);
        setApplyError('');
        setSaveSuccessMessage('');
        setShowReplaceConfirm(false);

        requestAnimationFrame(() => {
            document.getElementById('pymtw-allocate-surplus')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        });
    }, [
        planKey,
        studio,
        allocationPlans,
        investmentAllocations,
        setAllocationPlans,
        analysisBase,
        isDirty,
        effectiveMonth,
        lastAppliedBundleId,
    ]);

    const handleBackToAiRecommendations = useCallback(() => {
        if (isDirty) {
            setPendingLeaveToAi(true);
            return;
        }
        // Prefer a soft return when nothing was applied yet (manual edit only).
        if (avenuesMode === 'manual_edit' && !hasMonthPlan) {
            if (planKey && allocationPlans[planKey]?.status === 'draft') {
                const nextPlans = { ...allocationPlans };
                delete nextPlans[planKey];
                setAllocationPlans(nextPlans);
            }
            resetLocalDraftState();
            return;
        }
        handleClearMonthPlan(planKey);
    }, [
        isDirty,
        avenuesMode,
        hasMonthPlan,
        planKey,
        allocationPlans,
        setAllocationPlans,
        resetLocalDraftState,
        handleClearMonthPlan,
    ]);

    const handleLeaveStay = useCallback(() => {
        setPendingLeaveToAi(false);
        setPendingMonthIndex(null);
    }, []);

    const handleLeaveDiscardAndGo = useCallback(() => {
        handleDiscardChanges();
        setPendingLeaveToAi(false);
        handleClearMonthPlan(planKey, { force: true });
    }, [handleDiscardChanges, handleClearMonthPlan, planKey]);

    const handleRemoveAllocation = useCallback((item) => {
        if (!item) return;

        const itemPlanKey = item.studioPlanKey || null;
        const type = draftInstrumentTypeFromSummaryItem(item);

        // Current month (pending draft or committed studio rows) → draft-only until Save.
        if (item.pending || (itemPlanKey && itemPlanKey === planKey)) {
            const base = isEditingMonth
                ? draftAllocations
                : draftFromStudioAllocations(investmentAllocations, planKey);
            if (!isEditingMonth) {
                setDraftHydratedFromApplied(true);
                const priorBundle = allocationPlans[planKey]?.selectedBundleId || lastAppliedBundleId;
                if (priorBundle) setLastAppliedBundleId(priorBundle);
            }
            const next = { ...base, [type]: 0 };
            setDraftAllocations(next);
            setActiveBundleId(null);
            setAppliedPlanKey(null);
            setAvenuesMode('manual_edit');
            setIsManualEditing(true);
            setApplyError('');
            setSaveSuccessMessage('');
            persistDraft(next, null);
            return;
        }

        // Non-current-month committed rows: keep immediate remove (not in this edit session).
        if (item.id == null || String(item.id).startsWith('draft-')) return;
        const nextAllocations = removeInvestmentAllocationById(investmentAllocations, item.id);
        setInvestmentAllocations(nextAllocations);
        setAllocationPlans(pruneAllocationPlansForAllocations(allocationPlans, nextAllocations));
    }, [
        planKey,
        isEditingMonth,
        draftAllocations,
        investmentAllocations,
        allocationPlans,
        lastAppliedBundleId,
        persistDraft,
        setInvestmentAllocations,
        setAllocationPlans,
    ]);

    const handleJourneyAdjustmentsChange = useCallback((updater) => {
        setJourneyAdjustments(updater);
        setAllocationPlans((prev) => withPymtwGate(prev, {
            adjustmentsSaved: false,
            showInvestmentAvenues: false,
        }));
        setAvenuesMode('choose');
        setAdjustmentSaveMessage('');
    }, [setJourneyAdjustments, setAllocationPlans]);

    const handleSaveAdjustments = useCallback(() => {
        setAllocationPlans((prev) => withPymtwGate(prev, {
            adjustmentsSaved: true,
            showInvestmentAvenues: Boolean(prev?.[PYMTW_GATE_KEY]?.showInvestmentAvenues),
        }));
        setAdjustmentSaveMessage('Future financial adjustments saved. You can now proceed.');
    }, [setAllocationPlans]);

    const handleSkipAdjustments = useCallback(() => {
        setAllocationPlans((prev) => withPymtwGate(prev, {
            adjustmentsSaved: true,
            showInvestmentAvenues: Boolean(prev?.[PYMTW_GATE_KEY]?.showInvestmentAvenues),
        }));
        setAdjustmentSaveMessage('No future adjustments. You can now proceed.');
    }, [setAllocationPlans]);

    const handleProceedToInvestmentAvenues = useCallback(() => {
        setAllocationPlans((prev) => withPymtwGate(prev, {
            adjustmentsSaved: true,
            showInvestmentAvenues: true,
        }));
    }, [setAllocationPlans]);

    useEffect(() => {
        if (!showInvestmentAvenues) {
            setActivePanelType(null);
        }
    }, [showInvestmentAvenues]);

    if (!studio.meta?.hasData) {
        return (
            <div className="pymtw-section card pymtw-empty-state">
                <h2>{isGaps ? 'Fix Your Financial Gaps' : 'Put Your Money to Work'}</h2>
                <p className="text-muted">
                    Complete Your Money Flow first to unlock this report.
                </p>
            </div>
        );
    }

    const monthSwitchConfirm = (pendingMonthIndex != null || pendingLeaveToAi) ? (
        <div className="pymtw-confirm-panel" role="alertdialog" aria-labelledby="pymtw-leave-title">
            <p id="pymtw-leave-title" className="pymtw-confirm-title">
                {pendingLeaveToAi
                    ? 'You have unsaved changes.'
                    : `You have unsaved changes for ${studio.meta.monthLabel}.`}
            </p>
            <p className="pymtw-confirm-body">
                {pendingLeaveToAi
                    ? 'Discard changes before returning to AI recommendations, or stay and keep editing.'
                    : 'Save, discard, or stay on the current month. Your draft will not be lost silently.'}
            </p>
            <div className="pymtw-confirm-actions">
                {!pendingLeaveToAi && (
                    <button type="button" className="btn btn-primary" onClick={handleMonthSwitchSave}>
                        Save Changes
                    </button>
                )}
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={pendingLeaveToAi ? handleLeaveDiscardAndGo : handleMonthSwitchDiscard}
                >
                    Discard Changes
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleLeaveStay}>
                    Stay on Current Month
                </button>
            </div>
        </div>
    ) : null;

    const replaceConfirm = showReplaceConfirm ? (
        <div className="pymtw-confirm-panel" role="alertdialog" aria-labelledby="pymtw-replace-title">
            <p id="pymtw-replace-title" className="pymtw-confirm-title">
                This month already has an allocation plan.
            </p>
            <p className="pymtw-confirm-body">
                Saving now will replace the existing month&apos;s allocations.
            </p>
            <div className="pymtw-confirm-actions">
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowReplaceConfirm(false)}
                >
                    Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleConfirmReplacePlan}>
                    Replace Plan
                </button>
            </div>
        </div>
    ) : null;

    const pymtwAvenueInstruments = studio.instrumentCategories.flatMap((category) => (
        category.instruments.map((instrument) => ({
            ...instrument,
            categoryId: category.id,
            categoryLabel: category.label,
            displayName: category.instrumentLabels?.[instrument.type] || instrument.type,
            note: category.instrumentNotes?.[instrument.type],
        }))
    ));
    const displayDraftForPanel = isEditingMonth
        ? draftAllocations
        : (hasAppliedMonthPlan ? appliedBaseline : draftAllocations);

    const currentMonthLedgerUnallocated = studio.hero.threeMonthOutlook?.find(
        (o) => o.monthIndex === effectiveMonth,
    )?.ledgerUnallocated || studio.hero.threeMonthOutlook?.[0]?.ledgerUnallocated || 0;

    return (
        <div className={`pymtw-section ${isGaps ? 'fyfg-section' : ''}`}>
            {isGaps ? (
                <div className="fyfg-wizard-container" style={{ background: '#ffffff', minHeight: '100%', padding: '1rem 0' }}>
                    {/* Persistent Segmented Connected Progress Tracker */}
                    <div className="fyfg-progress-tracker-wrap" style={{ position: 'relative', marginBottom: '2rem', padding: 0, background: 'transparent' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            {/* Horizontal connecting background track */}
                            <div style={{ position: 'absolute', top: '18px', left: '10%', right: '10%', height: '2px', background: '#E5E7EB', zIndex: 1 }} />
                            {/* Horizontal progress filled line */}
                            <div style={{ position: 'absolute', top: '18px', left: '10%', width: `${((wizardStep - 1) / 3) * 80}%`, height: '2px', background: '#0f766e', transition: 'width 0.3s ease', zIndex: 1 }} />

                            {[
                                { id: 1, label: 'Pick a month' },
                                { id: 2, label: 'Cover your gaps' },
                                { id: 3, label: 'Plan ahead' },
                                { id: 4, label: 'See your surplus' },
                            ].map((s) => {
                                const isActive = wizardStep === s.id;
                                const isDone = wizardStep > s.id;
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setWizardStep(s.id)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: 0,
                                            position: 'relative',
                                            zIndex: 2,
                                        }}
                                    >
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 700,
                                            fontSize: '0.85rem',
                                            transition: 'all 0.2s ease',
                                            background: isDone
                                                ? '#10b981'
                                                : isActive
                                                    ? '#0f766e'
                                                    : '#ffffff',
                                            color: isDone || isActive ? '#ffffff' : '#64748b',
                                            border: isDone
                                                ? '2px solid #10b981'
                                                : isActive
                                                    ? '3px solid #0f766e'
                                                    : '2px solid #cbd5e1',
                                            boxShadow: isActive ? '0 0 0 4px rgba(15, 118, 110, 0.12)' : 'none',
                                        }}>
                                            {isDone ? '✓' : s.id}
                                        </div>
                                        <span style={{
                                            fontSize: '0.82rem',
                                            fontWeight: isActive ? 700 : isDone ? 600 : 500,
                                            color: isActive
                                                ? '#0f766e'
                                                : isDone
                                                    ? '#0f172a'
                                                    : '#64748b',
                                        }}>
                                            {s.id}. {s.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* One-Line Context Sentence Strip */}
                    <div className="fyfg-context-strip" style={{ marginBottom: '1.75rem', color: '#0f766e', fontWeight: 600, fontSize: '0.9rem', background: 'transparent', padding: 0 }}>
                        {wizardStep === 1 && 'Step 1 of 4 · Pick a month to analyze your financial foundation'}
                        {wizardStep === 2 && 'Step 2 of 4 · Cover your protection gaps before investing surplus'}
                        {wizardStep === 3 && 'Step 3 of 4 · Plan ahead for upcoming expenses & loans over the next 3 months'}
                        {wizardStep === 4 && 'Step 4 of 4 · Review your recalculated surplus & AI recommendations'}
                    </div>

                    {/* STEP 1: PICK A MONTH */}
                    {wizardStep === 1 && (
                        <div className="fyfg-step-1-canvas" style={{ padding: 0 }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-main)' }}>
                                Let&apos;s plan for {editingMonthLabel} — you have <span style={{ color: '#0f766e' }}>{formatCurrency(Math.max(0, currentMonthLedgerUnallocated))}</span> free this month.
                            </h2>
                            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '0 0 1.5rem' }}>
                                Based on your current recurring income and expenses.
                            </p>

                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                    Want to plan a different month?
                                </label>
                                <SurplusMonthChips
                                    months={studio.selectableMonths}
                                    outlook={studio.hero.threeMonthOutlook}
                                    selectedMonthIndex={effectiveMonth}
                                    onSelect={handleMonthChange}
                                    amountKey="ledger"
                                />
                            </div>

                            {monthSwitchConfirm}
                            {replaceConfirm}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #E5E7EB' }}>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => setWizardStep(2)}
                                    style={{ padding: '0.75rem 1.5rem', fontWeight: 700, borderRadius: '12px', fontSize: '0.95rem' }}
                                >
                                    Continue to Cover Your Gaps →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: COVER YOUR GAPS */}
                    {wizardStep === 2 && (
                        <>
                            <InstrumentCardGrid
                                instrumentCategories={studio.instrumentCategories}
                                draftAllocations={
                                    isEditingMonth
                                        ? draftAllocations
                                        : (hasAppliedMonthPlan ? appliedBaseline : draftAllocations)
                                }
                                headerAllocations={headerAllocations}
                                baselineAllocations={appliedBaseline}
                                remainingSurplus={remaining}
                                getMaxAmountForInstrument={maxForInstrument}
                                currentPlanKey={planKey}
                                familyMembers={familyMembers}
                                onLispDraftChange={handleLispDraftChange}
                                onDraftChange={(type, amount) => {
                                    const current = Math.round(
                                        getDraftTypeAmount(
                                            isEditingMonth
                                                ? draftAllocations
                                                : (hasAppliedMonthPlan ? appliedBaseline : draftAllocations),
                                            type,
                                        ),
                                    );
                                    if (Math.round(amount || 0) === current) return;
                                    handleDraftChange(type, amount);
                                }}
                                onApplyManualAllocations={handleApplyManualAllocations}
                                canApplyManual={validation.canApply}
                                applyError={applyError}
                                selectableMonths={studio.selectableMonths}
                                selectedMonthIndex={effectiveMonth}
                                onMonthChange={handleMonthChange}
                                calendarYear={studio.meta.calendarYear}
                                isDirty={isDirty}
                                showStickyBar
                                showMonthPicker={false}
                                editingMonthLabel={editingMonthLabel}
                                totalMonthlyAllocation={stickyTotalAllocation}
                                saveLabel={saveLabel}
                                statusHint={statusHint}
                                saveSuccessMessage={saveSuccessMessage}
                                onDiscardChanges={handleDiscardChanges}
                                showUnsavedBanner={isDirty}
                                monthSwitchConfirm={null}
                                replaceConfirm={null}
                            />

                            <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #E5E7EB' }}>
                                <PlannedInvestmentAllocationsPanel
                                    allocationsSummary={allocationsSummary}
                                    onRemove={handleRemoveAllocation}
                                    onEditMonthPlan={handleEditMonthPlan}
                                    onClearMonthPlan={handleClearMonthPlan}
                                    clearDisabled={isDirty}
                                    clearDisabledReason="Save or discard changes before clearing this month plan."
                                    title="Planned Protection allocations"
                                    editLabel="Edit – Show Protection avenues"
                                    monthChipsAriaLabel="Protection allocation months"
                                    plainSummary={true}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #E5E7EB' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setWizardStep(1)}
                                >
                                    ← Back to Month
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => setWizardStep(3)}
                                    style={{ padding: '0.75rem 1.5rem', fontWeight: 700, borderRadius: '12px' }}
                                >
                                    Continue to Plan Ahead →
                                </button>
                            </div>
                        </>
                    )}

                    {/* STEP 3: PLAN AHEAD */}
                    {wizardStep === 3 && (
                        <>
                            <JourneyConstraintsRail
                                journeyConstraints={studio.journeyConstraints}
                                journeyAdjustments={journeyAdjustments}
                                setJourneyAdjustments={handleJourneyAdjustmentsChange}
                                defaultStartMonthIndex={studio.selectableMonths?.[0]?.monthIndex
                                    ?? studio.meta.currentMonth
                                    ?? 0}
                                defaultCalendarYear={studio.meta.calendarYear}
                                selectableMonths={studio.selectableMonths}
                                unallocatedSurplusByMonth={moneyFlowReport?.ledger?.unallocatedSurplus || []}
                                investmentAllocations={investmentAllocations}
                                planStartMonth={studio.meta.planStartMonth ?? 0}
                                onSaveAdjustments={handleSaveAdjustments}
                                onSkipAdjustments={() => {
                                    handleSkipAdjustments();
                                    setWizardStep(4);
                                }}
                                adjustmentsSaved={adjustmentsSaved}
                                saveMessage={adjustmentSaveMessage}
                            />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setWizardStep(2)}
                                >
                                    ← Back to Gaps
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => setWizardStep(4)}
                                    style={{ padding: '0.75rem 1.5rem', fontWeight: 700, borderRadius: '12px' }}
                                >
                                    See Your Surplus →
                                </button>
                            </div>
                        </>
                    )}

                    {/* STEP 4: SEE YOUR SURPLUS */}
                    {wizardStep === 4 && (
                        <>
                            <div style={{ marginBottom: '1rem', padding: '0.85rem 1.25rem', background: '#fff', borderRadius: '14px', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                Great — here&apos;s what that means for your money this month 👇
                            </div>

                            <RecalculatedSurplusPanel
                                outlook={studio.hero.journeyAdjustedOutlook}
                                onProceed={handleProceedToInvestmentAvenues}
                                proceedLabel="Show recommended surplus allocation"
                                showProceed={false}
                            />

                            {showInvestmentAvenues && (
                                <div style={{ marginTop: '1.25rem' }}>
                                    <RecommendedBundles
                                        bundles={recommendedBundles}
                                        deployableSurplus={studio.hero.deployableSurplus}
                                        engineResult={engineResult}
                                        avenuesMode={avenuesMode === 'manual_edit' ? 'choose' : avenuesMode}
                                        onApplyAiRecommendations={handleApplyAiRecommendations}
                                        onStartManualAllocation={handleStartManualAllocation}
                                        onBackToAiRecommendations={handleBackToAiRecommendations}
                                        canApplyAi={Boolean(recommendedBundles[0]) && studio.hero.deployableSurplus > 0}
                                    />
                                </div>
                            )}

                            <div style={{ textAlign: 'left', marginTop: '1.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setWizardStep(3)}
                                >
                                    ← Back to Plan Ahead
                                </button>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <>
                    <AllocateSurplusPanel
                        editingMonthLabel={editingMonthLabel}
                        totalSurplus={studio.hero?.deployableSurplus || 0}
                        allocatedAmount={stickyTotalAllocation}
                        remainingSurplus={remaining}
                        isDirty={isDirty}
                        canSave={validation.canApply && isDirty}
                        saveLabel={saveLabel}
                        statusHint={statusHint}
                        applyError={applyError}
                        saveSuccessMessage={saveSuccessMessage}
                        onDiscard={handleDiscardChanges}
                        onSave={handleApplyManualAllocations}
                        avenues={pymtwAvenueInstruments}
                        expandedType={expandedAvenueType}
                        onExpandType={handleExpandAvenue}
                        draftAllocations={displayDraftForPanel}
                        getMaxAmountForInstrument={maxForInstrument}
                        onDraftChange={(type, amount) => {
                            const current = Math.round(getDraftTypeAmount(displayDraftForPanel, type));
                            if (Math.round(amount || 0) === current) return;
                            if (avenuesMode !== 'manual_edit') {
                                setAvenuesMode('manual_edit');
                                setIsManualEditing(true);
                            }
                            handleDraftChange(type, amount);
                        }}
                        onLispDraftChange={handleLispDraftChange}
                        familyMembers={familyMembers}
                        currentPlanKey={planKey}
                        monthSwitchConfirm={monthSwitchConfirm}
                        replaceConfirm={replaceConfirm}
                        surplusMonthChips={(
                            <SurplusMonthChips
                                months={studio.selectableMonths}
                                outlook={studio.hero.journeyAdjustedOutlook}
                                selectedMonthIndex={effectiveMonth}
                                onSelect={handleMonthChange}
                                amountKey="deployable"
                            />
                        )}
                    />

                    <PlannedInvestmentAllocationsPanel
                        allocationsSummary={allocationsSummary}
                        onRemove={handleRemoveAllocation}
                        onEditMonthPlan={handleEditMonthPlan}
                        onClearMonthPlan={handleClearMonthPlan}
                        clearDisabled={isDirty}
                        clearDisabledReason="Save or discard changes before clearing this month plan."
                        title="Planned investment allocations"
                        editLabel="Edit – Show Investment Avenues"
                        monthChipsAriaLabel="Investment allocation months"
                    />

                    <AllocationStudioHero hero={studio.hero} />

                    {(avenuesMode === 'ai_applied' || avenuesMode === 'manual_applied' || hasAppliedMonthPlan) && (
                        <GrowthPreviewStrip growthPreview={appliedGrowthPreview || growthPreview} />
                    )}

                    <div className="card pymtw-analysis-summary">
                        <h3 className="pymtw-zone-title">{studio.briefing?.headline || 'Allocation Studio analysis'}</h3>
                        <p className="pymtw-zone-sub">{studio.briefing?.greeting}</p>
                        <div className="pymtw-briefing-lines">
                            {enhancedBriefingLines.map((line) => (
                                <p key={line} className="pymtw-briefing-line">{line}</p>
                            ))}
                        </div>
                    </div>

                    <StudioInsightsRail insights={studioInsights} />
                </>
            )}

            <InstrumentAnalysisPanel
                instrumentType={expandedAvenueType}
                baselineAnalysis={panelBaseline}
                scenarioAnalysis={panelScenario}
                goalDeltas={panelGoalDeltas}
                draftAmount={expandedAvenueType ? getDraftTypeAmount(draftAllocations, expandedAvenueType) : 0}
                maxAmount={expandedAvenueType ? maxForInstrument(expandedAvenueType) : Math.max(0, remaining)}
                onAmountChange={(amount) => expandedAvenueType && handleDraftChange(expandedAvenueType, amount)}
                isOpen={Boolean(activePanelType)}
                onClose={() => setActivePanelType(null)}
            />

            <style>{`
                .fyfg-hero { padding: 1.5rem 1.25rem; background: linear-gradient(135deg, rgba(15,118,110,0.08), rgba(15,118,110,0.02)); }
                .fyfg-hero-title { margin: 0 0 0.75rem; font-size: 1.45rem; line-height: 1.3; color: var(--text-main); }
                .fyfg-hero-message { margin: 0; line-height: 1.55; color: var(--text-muted, #64748b); }
                .fyfg-month-select, .pymtw-available-surplus, .pymtw-avenue-picker { padding: 1.25rem; }
                .pymtw-avenue-group { margin-top: 1rem; }
                .pymtw-avenue-group-label { margin: 0 0 0.5rem; font-size: 0.95rem; }
                .pymtw-avenue-chip-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
                .pymtw-avenue-chip {
                    border: 1px solid var(--border-color, #e2e8f0);
                    background: #fff;
                    border-radius: 999px;
                    padding: 0.45rem 0.85rem;
                    cursor: pointer;
                    font-size: 0.85rem;
                }
                .pymtw-avenue-chip-selected {
                    border-color: var(--primary, #0f766e);
                    background: rgba(15,118,110,0.1);
                    font-weight: 600;
                }
                .pymtw-allocate-panel { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
                .pymtw-allocate-panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 1rem;
                    flex-wrap: wrap;
                }
                .pymtw-editing-month { margin: 0.25rem 0 0; color: var(--text-muted, #64748b); font-size: 0.95rem; }
                .pymtw-total-surplus { text-align: right; }
                .pymtw-total-surplus-label {
                    display: block;
                    font-size: 0.8rem;
                    color: var(--text-muted, #64748b);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .pymtw-total-surplus-value {
                    display: block;
                    font-size: 1.75rem;
                    line-height: 1.2;
                    color: var(--text-main);
                }
                .pymtw-surplus-progress { display: flex; flex-direction: column; gap: 0.4rem; }
                .pymtw-surplus-progress-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    font-size: 0.9rem;
                    color: var(--text-muted, #64748b);
                }
                .pymtw-surplus-progress-row strong { color: var(--text-main); }
                .pymtw-surplus-progress-track {
                    height: 10px;
                    border-radius: 999px;
                    background: rgba(15, 118, 110, 0.12);
                    overflow: hidden;
                }
                .pymtw-surplus-progress-fill {
                    height: 100%;
                    background: var(--primary, #0f766e);
                    border-radius: 999px;
                    transition: width 0.2s ease;
                }
                .pymtw-allocate-actions {
                    display: flex;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                }
                .pymtw-avenues-block {
                    margin-top: 0.5rem;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border-color, #e2e8f0);
                }
                .pymtw-avenues-title { margin: 0 0 0.35rem; font-size: 1.05rem; }
                .pymtw-avenue-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 0.85rem;
                    margin-top: 0.85rem;
                    width: 100%;
                }
                @media (min-width: 640px) {
                    .pymtw-avenue-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
                }
                .pymtw-avenue-chip-card {
                    border: 1px solid var(--border-color, #e2e8f0);
                    border-radius: 12px;
                    background: #fff;
                    overflow: hidden;
                    align-self: start;
                    transition: border-color 0.15s ease, box-shadow 0.15s ease;
                }
                .pymtw-avenue-chip-card-expanded {
                    border-color: var(--primary, #0f766e);
                    box-shadow: 0 0 0 1px rgba(15, 118, 110, 0.2);
                }
                .pymtw-avenue-chip-header {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.75rem;
                    padding: 0.85rem 1rem;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    text-align: left;
                    color: var(--text-main);
                }
                .pymtw-avenue-chip-header-main {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.55rem;
                    min-width: 0;
                    flex-wrap: wrap;
                }
                .pymtw-avenue-chip-icon { flex-shrink: 0; color: var(--primary, #0f766e); }
                .pymtw-expand-chip-label {
                    font-size: 0.95rem;
                    font-weight: 600;
                }
                .pymtw-expand-chip-badge {
                    font-size: 0.75rem;
                    font-weight: 600;
                    padding: 0.15rem 0.5rem;
                    border-radius: 999px;
                    background: rgba(15, 118, 110, 0.12);
                    color: var(--primary, #0f766e);
                }
                .pymtw-avenue-chip-chevron {
                    flex-shrink: 0;
                    color: var(--text-muted, #64748b);
                    transition: transform 0.2s ease;
                }
                .pymtw-avenue-chip-chevron-open {
                    transform: rotate(180deg);
                }
                .pymtw-avenue-chip-body {
                    padding: 0 1rem 1rem;
                    border-top: 1px solid var(--border-color, #e2e8f0);
                }
                .pymtw-avenue-chip-note {
                    margin: 0.75rem 0 0.65rem;
                    font-size: 0.85rem;
                    color: var(--text-muted, #64748b);
                    line-height: 1.4;
                }
                .pymtw-month-history { margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem; }
                .pymtw-month-history-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    align-items: baseline;
                    font-size: 0.85rem;
                    color: var(--text-muted, #64748b);
                }
                .pymtw-month-history-row strong { color: var(--text-main); }
                .pymtw-month-history-label { margin-left: auto; }
                .pymtw-lisp-form { display: flex; flex-direction: column; gap: 0.75rem; }
                .pymtw-lisp-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 0.85rem;
                }
                @media (max-width: 700px) {
                    .pymtw-lisp-grid { grid-template-columns: 1fr; }
                    .pymtw-total-surplus { text-align: left; }
                }
                .pymtw-lisp-field label { display: block; margin-bottom: 0.35rem; font-size: 0.85rem; }
                .pymtw-lisp-field select,
                .pymtw-lisp-field input {
                    width: 100%;
                    padding: 0.65rem 0.75rem;
                    border-radius: 8px;
                    border: 1px solid var(--border-color, #e2e8f0);
                    background: #fff;
                    color: var(--text-main);
                }
                .pymtw-lisp-hint { display: block; margin-top: 0.35rem; color: var(--text-muted, #64748b); }
                .pymtw-allocate-split {
                    display: grid;
                    grid-template-columns: 40% 60%;
                    gap: 1rem;
                    padding: 1rem;
                    align-items: start;
                }
                @media (max-width: 900px) {
                    .pymtw-allocate-split { grid-template-columns: 1fr; }
                }
                .pymtw-allocate-split-left .pymtw-sticky-action-bar {
                    position: static;
                    border: 1px solid var(--border-color, #e2e8f0);
                    border-radius: 12px;
                }
                .pymtw-unsaved-banner {
                    padding: 0.75rem 1rem;
                    border-radius: 10px;
                    background: rgba(245, 158, 11, 0.12);
                    border: 1px solid rgba(245, 158, 11, 0.35);
                    color: var(--text-main);
                }
                .pymtw-section {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    padding: 0 1rem 2rem;
                }
                .pymtw-empty-state {
                    padding: 2rem;
                    text-align: center;
                    min-height: 280px;
                }
                .pymtw-guidance-card {
                    padding: 1rem 1.25rem;
                    border: 1px dashed rgba(124,58,237,0.35);
                    background: rgba(124,58,237,0.06);
                    color: var(--text-main);
                    line-height: 1.55;
                }
                .pymtw-guidance-card p { margin: 0; }
                .pymtw-adjust-save {
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border);
                    display: flex;
                    align-items: center;
                    gap: 0.9rem;
                    flex-wrap: wrap;
                }
                .pymtw-adjust-summary {
                    margin-top: 1.25rem;
                    padding-top: 1.1rem;
                    border-top: 1px solid var(--border);
                }
                .pymtw-adjust-accordion-panel {
                    padding: 0.15rem 0 0.85rem;
                }
                .pymtw-adjust-summary-grid {
                    display: grid;
                    gap: 0.85rem;
                    margin-top: 0.75rem;
                }
                .pymtw-adjust-summary-grid-1 { grid-template-columns: 1fr; }
                .pymtw-adjust-summary-grid-2 { grid-template-columns: repeat(2, 1fr); }
                .pymtw-adjust-summary-grid-3 { grid-template-columns: repeat(3, 1fr); }
                @media (max-width: 900px) {
                    .pymtw-adjust-summary-grid-2,
                    .pymtw-adjust-summary-grid-3 { grid-template-columns: 1fr; }
                }
                .pymtw-adjust-summary-month-card {
                    padding: 0.85rem;
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    background: var(--bg-card);
                }
                .pymtw-adjust-summary-month-title {
                    margin: 0 0 0.65rem;
                    font-size: 0.88rem;
                    font-weight: 600;
                }
                .pymtw-adjust-saved-msg {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.45rem;
                    color: #059669;
                    font-size: 0.88rem;
                    font-weight: 600;
                }
                .pymtw-adjust-save-error {
                    display: inline-flex;
                    align-items: flex-start;
                    gap: 0.45rem;
                    color: #B91C1C;
                    font-size: 0.88rem;
                    font-weight: 600;
                    max-width: 36rem;
                    line-height: 1.4;
                }
                .pymtw-recalculated-surplus-card {
                    padding: 1rem 1.25rem;
                    border: 1px solid rgba(16,185,129,0.35);
                    background: rgba(16,185,129,0.08);
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 1rem;
                    flex-wrap: wrap;
                }
                .pymtw-recalculated-body {
                    flex: 1;
                    min-width: min(100%, 280px);
                }
                .pymtw-recalculated-sub {
                    margin: 0.25rem 0 0.75rem;
                    font-size: 0.82rem;
                    color: var(--text-muted);
                }
                .pymtw-recalculated-label {
                    display: block;
                    font-size: 0.76rem;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    color: var(--text-muted);
                    margin-bottom: 0.3rem;
                }
                .pymtw-recalculated-surplus-card strong {
                    font-size: 1.3rem;
                    color: #059669;
                }
                .pymtw-proceed-hint {
                    margin-top: -0.5rem;
                    font-size: 0.85rem;
                    color: var(--text-muted);
                }

                .dr-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.65s cubic-bezier(0.16,1,0.3,1), transform 0.65s cubic-bezier(0.16,1,0.3,1); }
                .dr-reveal.dr-visible { opacity: 1; transform: translateY(0); }
                /* Scope under .pymtw-section so keep-alive sibling report styles cannot clash with YMF dark tooltips */
                .pymtw-section .dr-chart-tooltip { background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 0.75rem; font-size: 0.82rem; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
                .pymtw-section .dr-chart-tooltip-label { font-weight: 700; margin-bottom: 0.25rem; }

                .pymtw-zone-a {
                    padding: 1.5rem;
                    background: linear-gradient(135deg, rgba(124,58,237,0.08), rgba(16,185,129,0.06));
                    border: 1px solid rgba(124,58,237,0.15);
                }
                .pymtw-zone-a-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                }
                .pymtw-ai-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    font-size: 0.78rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #7C3AED;
                    background: rgba(124,58,237,0.1);
                    padding: 0.35rem 0.75rem;
                    border-radius: 20px;
                }
                .pymtw-month-picker {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-muted);
                }
                .pymtw-month-picker select {
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    padding: 0.4rem 0.65rem;
                    background: var(--bg-card);
                    color: var(--text-main);
                    font-size: 0.9rem;
                    cursor: pointer;
                }
                .pymtw-briefing-lines { margin-bottom: 1.25rem; }
                .pymtw-briefing-line {
                    margin: 0 0 0.5rem;
                    font-size: 0.92rem;
                    line-height: 1.6;
                    color: var(--text-main);
                }
                .pymtw-analysis-summary {
                    padding: 1.25rem;
                    border: 1px solid var(--border);
                    background: linear-gradient(180deg, rgba(124,58,237,0.04), transparent);
                }
                .pymtw-hero-kpis {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                    gap: 0.85rem;
                }
                .pymtw-kpi {
                    padding: 0.85rem 1rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 10px;
                }
                .pymtw-kpi span {
                    display: block;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin-bottom: 0.2rem;
                }
                .pymtw-kpi strong { font-size: 1.1rem; }
                .pymtw-kpi-accent { color: #7C3AED; }
                .pymtw-kpi-carry {
                    display: block;
                    margin-top: 0.25rem;
                    font-size: 0.72rem;
                    font-style: normal;
                    font-weight: 500;
                    color: var(--text-muted);
                    line-height: 1.35;
                }

                .pymtw-surplus-month-grid {
                    display: grid;
                    gap: 0.85rem;
                }
                .pymtw-surplus-grid-1 { grid-template-columns: 1fr; }
                .pymtw-surplus-grid-2 { grid-template-columns: repeat(2, 1fr); }
                .pymtw-surplus-grid-3 { grid-template-columns: repeat(3, 1fr); }
                @media (max-width: 900px) {
                    .pymtw-surplus-grid-2,
                    .pymtw-surplus-grid-3 { grid-template-columns: 1fr; }
                }
                .pymtw-surplus-month-card {
                    padding: 0.85rem 1rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 10px;
                }
                .pymtw-surplus-month-title {
                    display: block;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin-bottom: 0.2rem;
                }
                .pymtw-surplus-month-value {
                    display: block;
                    font-size: 1.25rem;
                    color: #7C3AED;
                }
                .pymtw-surplus-alloc-list {
                    list-style: none;
                    margin: 0.5rem 0 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }
                .pymtw-surplus-alloc-list li {
                    display: flex;
                    justify-content: space-between;
                    gap: 0.5rem;
                    font-size: 0.78rem;
                    color: var(--text-muted);
                }
                .pymtw-surplus-alloc-chip {
                    padding: 0.1rem 0.45rem;
                    border-radius: 999px;
                    background: rgba(124,58,237,0.08);
                    color: var(--text-main);
                }
                .pymtw-surplus-calc-lines {
                    margin-top: 0.5rem;
                    padding-top: 0.5rem;
                    border-top: 1px dashed var(--border);
                }
                .pymtw-surplus-calc-line {
                    margin: 0;
                    font-size: 0.72rem;
                    line-height: 1.45;
                    color: var(--text-muted);
                }
                .pymtw-allocate-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }
                @media (max-width: 700px) {
                    .pymtw-allocate-header { flex-direction: column; }
                }

                .pymtw-bundles { padding: 1.25rem; }
                .pymtw-bundles-details-toggle {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    margin: 0 0 0.75rem;
                    padding: 0;
                    border: none;
                    background: none;
                    color: var(--primary);
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                }
                .pymtw-bundles-details {
                    margin-bottom: 0.75rem;
                }
                .pymtw-avenue-chip {
                    display: inline-block;
                    padding: 0.15rem 0.5rem;
                    margin: 0.15rem 0.35rem 0.15rem 0;
                    border-radius: 999px;
                    font-size: 0.72rem;
                    font-weight: 500;
                    background: rgba(124,58,237,0.08);
                    color: var(--text-main);
                    border: 1px solid rgba(124,58,237,0.15);
                }
                .pymtw-category-avenue-chips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.25rem;
                    margin-top: 0.35rem;
                }
                .pymtw-surplus-kpi-row {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: baseline;
                    gap: 0.75rem 1.25rem;
                    margin: 0.75rem 0 1rem;
                }
                .pymtw-surplus-kpi {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }
                .pymtw-surplus-kpi-label {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    font-size: 0.82rem;
                    color: var(--text-muted);
                }
                .pymtw-surplus-kpi-value {
                    font-size: 1.45rem;
                    font-weight: 700;
                    line-height: 1.2;
                    color: var(--text-main);
                }
                .pymtw-surplus-kpi-divider {
                    color: var(--text-muted);
                    font-size: 1.25rem;
                    font-weight: 300;
                    align-self: center;
                }
                .pymtw-avenue-line {
                    margin: 0 0 1.15rem;
                    font-size: 0.92rem;
                    line-height: 1.55;
                    color: var(--text-main);
                }
                .pymtw-avenue-amount {
                    font-size: 1.05rem;
                    font-weight: 700;
                }
                .pymtw-avenue-sep { color: var(--text-muted); }
                .pymtw-surplus-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border);
                }
                .pymtw-clear-plan-btn { margin-left: auto; }
                @media (max-width: 640px) {
                    .pymtw-clear-plan-btn { margin-left: 0; width: 100%; }
                    .pymtw-surplus-actions .btn { width: 100%; }
                }

                .pymtw-insights-rail { padding: 1.25rem; }
                .pymtw-insights-list {
                    margin: 0;
                    padding: 0;
                    list-style: none;
                    display: flex;
                    flex-direction: column;
                    gap: 0.65rem;
                }
                .pymtw-insight {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.6rem;
                    font-size: 0.88rem;
                    line-height: 1.5;
                }
                .pymtw-insight-icon { flex-shrink: 0; margin-top: 2px; color: var(--text-muted); }
                .pymtw-insight-error .pymtw-insight-icon { color: #ef4444; }
                .pymtw-insight-warning .pymtw-insight-icon { color: #d97706; }
                .pymtw-insight-positive .pymtw-insight-icon { color: #059669; }
                .pymtw-insight-accent { color: var(--primary); font-weight: 500; }
                .pymtw-insight-accent .pymtw-insight-icon { color: #7C3AED; }
                .pymtw-insight-error { color: #ef4444; }

                .pymtw-scenario-compare { padding: 1.25rem; }
                .pymtw-compare-grid {
                    display: grid;
                    grid-template-columns: 1fr auto 1fr;
                    gap: 1rem;
                    align-items: stretch;
                }
                @media (max-width: 768px) {
                    .pymtw-compare-grid { grid-template-columns: 1fr; }
                    .pymtw-compare-vs { text-align: center; }
                }
                .pymtw-compare-col {
                    padding: 1rem;
                    border-radius: 12px;
                    border: 1px solid var(--border);
                    background: var(--bg-main);
                }
                .pymtw-compare-winner {
                    border-color: #7C3AED;
                    box-shadow: 0 0 0 1px rgba(124,58,237,0.15);
                }
                .pymtw-compare-col-head {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.85rem;
                }
                .pymtw-compare-col-head h4 { margin: 0; flex: 1; font-size: 0.95rem; }
                .pymtw-compare-badge {
                    font-size: 0.68rem;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: #7C3AED;
                    font-weight: 700;
                }
                .pymtw-compare-stat { margin-bottom: 0.65rem; }
                .pymtw-compare-stat span { display: block; font-size: 0.72rem; color: var(--text-muted); }
                .pymtw-compare-stat strong { font-size: 1.05rem; }
                .pymtw-compare-stat em { display: block; font-size: 0.75rem; color: var(--text-muted); font-style: normal; margin-top: 0.15rem; }
                .pymtw-compare-alloc { margin: 0.5rem 0 0; font-size: 0.78rem; color: var(--primary); line-height: 1.45; }
                .pymtw-compare-narrative { margin: 0.5rem 0 0; font-size: 0.8rem; color: var(--text-muted); line-height: 1.45; }
                .pymtw-compare-vs {
                    display: flex;
                    align-items: center;
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: var(--text-muted);
                }
                .pymtw-use-ai-btn {
                    margin-top: 0.75rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    padding: 0.5rem 0.85rem;
                    border: none;
                    border-radius: 8px;
                    background: #7C3AED;
                    color: white;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                }
                .pymtw-compare-foot {
                    margin: 1rem 0 0;
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    text-align: center;
                    line-height: 1.5;
                }

                .pymtw-apply-errors {
                    width: 100%;
                    display: flex;
                    align-items: flex-start;
                    gap: 0.5rem;
                    margin: 0;
                    font-size: 0.82rem;
                    color: #ef4444;
                    line-height: 1.45;
                }

                .pymtw-bundles-sub { margin: -0.25rem 0 1rem !important; }
                .pymtw-bundles-headline {
                    margin: 0 0 1rem;
                    font-size: 0.9rem;
                    line-height: 1.5;
                    color: var(--text);
                }
                .pymtw-fpi-stack {
                    margin: 0 0 1.25rem;
                    padding: 1rem;
                    border-radius: 10px;
                    background: rgba(16, 185, 129, 0.06);
                    border: 1px solid rgba(16, 185, 129, 0.18);
                }
                .pymtw-fpi-title {
                    margin: 0 0 0.65rem;
                    font-size: 0.85rem;
                    font-weight: 700;
                }
                .pymtw-fpi-list {
                    margin: 0;
                    padding: 0;
                    list-style: none;
                    display: flex;
                    flex-direction: column;
                    gap: 0.65rem;
                }
                .pymtw-fpi-item p {
                    margin: 0.25rem 0 0;
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    line-height: 1.45;
                }
                .pymtw-fpi-item-head {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }
                .pymtw-fpi-rank {
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: #059669;
                }
                .pymtw-fpi-score {
                    margin-left: auto;
                    font-size: 0.72rem;
                    color: var(--text-muted);
                }
                .pymtw-engine-explanations {
                    margin-top: 1.25rem;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border);
                }
                .pymtw-explain-list {
                    margin: 0;
                    padding-left: 1.1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.55rem;
                    font-size: 0.82rem;
                    line-height: 1.45;
                    color: var(--text-muted);
                }
                .pymtw-explain-list strong { color: var(--text); }
                .pymtw-explain-inaction { display: block; margin-top: 0.2rem; font-size: 0.78rem; }
                .pymtw-bundle-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 1rem;
                }
                .pymtw-bundle-card {
                    text-align: left;
                    padding: 1.15rem;
                    border-radius: 12px;
                    border: 1px solid var(--border);
                    background: var(--bg-card);
                    cursor: pointer;
                    transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
                    position: relative;
                }
                .pymtw-bundle-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.06); }
                .pymtw-bundle-active { border-color: #7C3AED; box-shadow: 0 0 0 2px rgba(124,58,237,0.15); }
                .pymtw-bundle-warning { border-left: 3px solid #F59E0B; }
                .pymtw-bundle-primary { border-left: 3px solid var(--primary); }
                .pymtw-bundle-accent { border-left: 3px solid #10B981; }
                .pymtw-bundle-rank {
                    position: absolute;
                    top: 0.65rem;
                    right: 0.65rem;
                    font-size: 0.68rem;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: #7C3AED;
                    font-weight: 700;
                }
                .pymtw-bundle-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    background: rgba(124,58,237,0.1);
                    color: #7C3AED;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 0.65rem;
                }
                .pymtw-bundle-card h4 { margin: 0 0 0.4rem; font-size: 1rem; }
                .pymtw-bundle-narrative { margin: 0 0 0.5rem; font-size: 0.82rem; color: var(--text-muted); line-height: 1.5; }
                .pymtw-bundle-alloc-line { margin: 0 0 0.65rem; font-size: 0.75rem; color: var(--primary); line-height: 1.4; }
                .pymtw-bundle-amounts {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.5rem;
                    font-size: 0.82rem;
                }
                .pymtw-bundle-amounts span { display: block; color: var(--text-muted); font-size: 0.72rem; }

                .pymtw-zone-title {
                    margin: 0 0 0.5rem;
                    font-size: 1.05rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 0.45rem;
                }
                .pymtw-zone-sub {
                    margin: 0 0 1rem;
                    font-size: 0.86rem;
                    color: var(--text-muted);
                    line-height: 1.5;
                }
                .pymtw-remaining-surplus {
                    font-size: 1.15rem;
                    font-weight: 700;
                    color: #059669;
                }
                .pymtw-zone-b { padding: 1.25rem; }
                .pymtw-adjust-category-footer {
                    margin-top: 0.9rem;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                }
                .pymtw-adjust-add-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                }
                .pymtw-adjust-list {
                    margin-top: 0.75rem;
                    display: grid;
                    gap: 0.9rem;
                }
                .pymtw-adjust-card {
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    background: var(--bg-main);
                    padding: 0.9rem;
                    display: grid;
                    gap: 0.75rem;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                }
                .pymtw-adjust-card .input-group { margin-bottom: 0; }
                .pymtw-adjust-emi {
                    grid-column: 1 / -1;
                    padding: 0.75rem;
                    border-radius: 8px;
                    border: 1px solid var(--border);
                    background: var(--bg-card);
                    font-size: 0.85rem;
                    color: var(--text-muted);
                }
                .pymtw-adjust-remove-btn {
                    grid-column: 1 / -1;
                    width: fit-content;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                }
                .pymtw-empty-rail {
                    display: flex;
                    gap: 0.75rem;
                    align-items: flex-start;
                    padding: 1rem;
                    background: var(--bg-main);
                    border-radius: 10px;
                    color: var(--text-muted);
                    font-size: 0.88rem;
                    line-height: 1.5;
                }
                .pymtw-constraint-list { display: flex; flex-direction: column; gap: 0.75rem; }
                .pymtw-constraint-chip {
                    display: flex;
                    gap: 0.75rem;
                    padding: 0.85rem;
                    border-radius: 10px;
                    border: 1px solid var(--border);
                    background: var(--bg-main);
                    align-items: flex-start;
                }
                .pymtw-constraint-remove-btn {
                    margin-left: auto;
                    flex-shrink: 0;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    white-space: nowrap;
                }
                .pymtw-constraint-loan { border-left: 3px solid #6366F1; }
                .pymtw-constraint-expense { border-left: 3px solid #F59E0B; }
                .pymtw-constraint-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--bg-card);
                    flex-shrink: 0;
                }
                .pymtw-constraint-body { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.84rem; }
                .pymtw-constraint-body strong { font-size: 0.92rem; }
                .pymtw-constraint-meta, .pymtw-constraint-note { color: var(--text-muted); font-size: 0.78rem; }
                .pymtw-constraint-impact { font-weight: 600; color: var(--text-main); }
                .pymtw-constraint-total {
                    margin-top: 1rem;
                    padding-top: 0.85rem;
                    border-top: 1px solid var(--border);
                    font-size: 0.85rem;
                    color: var(--text-muted);
                }

                .pymtw-category-block { margin-bottom: 0.75rem; }
                .pymtw-category-toggle {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.85rem;
                    padding: 0.95rem 1.05rem;
                    margin: 0;
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    background: var(--bg-card);
                    cursor: pointer;
                    text-align: left;
                    color: inherit;
                    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
                    transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
                }
                .pymtw-category-toggle:hover {
                    border-color: rgba(16,185,129,0.55);
                    background: rgba(16,185,129,0.04);
                    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.08);
                }
                .pymtw-category-toggle:focus-visible {
                    outline: 2px solid rgba(16,185,129,0.55);
                    outline-offset: 2px;
                }
                .pymtw-category-open .pymtw-category-toggle {
                    border-bottom-left-radius: 0;
                    border-bottom-right-radius: 0;
                    border-color: rgba(16,185,129,0.45);
                    border-bottom-color: transparent;
                    background: rgba(16,185,129,0.06);
                }
                .pymtw-category-toggle-main {
                    display: flex;
                    flex-direction: column;
                    gap: 0.2rem;
                    min-width: 0;
                }
                .pymtw-category-label {
                    margin: 0;
                    font-size: 1rem;
                    text-transform: none;
                    letter-spacing: 0;
                    color: var(--text-main);
                    font-weight: 700;
                }
                .pymtw-category-meta {
                    font-size: 0.78rem;
                    color: var(--text-muted);
                    line-height: 1.4;
                }
                .pymtw-category-status-row {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 0.5rem 0.75rem;
                    margin-top: 0.35rem;
                }
                .pymtw-category-save-chip {
                    font-size: 0.72rem;
                    font-weight: 700;
                    letter-spacing: 0.02em;
                }
                .pymtw-category-save-chip-saved { color: #047857; }
                .pymtw-category-save-chip-dirty { color: #b45309; }
                .pymtw-unsaved-banner {
                    display: flex;
                    flex-direction: column;
                    gap: 0.15rem;
                    margin: 0 0 1rem;
                    padding: 0.75rem 1rem;
                    border-radius: 10px;
                    border: 1px solid rgba(245, 158, 11, 0.35);
                    background: rgba(251, 191, 36, 0.12);
                    color: #92400e;
                    font-size: 0.88rem;
                }
                .pymtw-unsaved-banner strong { font-weight: 700; }
                .pymtw-confirm-panel {
                    margin: 0 0 1rem;
                    padding: 1rem 1.1rem;
                    border-radius: 10px;
                    border: 1px solid rgba(5, 150, 105, 0.35);
                    background: rgba(16, 185, 129, 0.08);
                }
                .pymtw-confirm-title {
                    margin: 0 0 0.35rem;
                    font-weight: 700;
                    color: var(--text-main);
                }
                .pymtw-confirm-body {
                    margin: 0 0 0.85rem;
                    font-size: 0.88rem;
                    color: var(--text-muted);
                }
                .pymtw-confirm-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }
                .pymtw-sticky-action-bar {
                    position: sticky;
                    bottom: 0;
                    z-index: 20;
                    margin-top: 1.25rem;
                    padding: 0.9rem 1rem;
                    border: 1px solid var(--border);
                    border-radius: 12px 12px 0 0;
                    background: var(--bg-card, #fff);
                    box-shadow: 0 -6px 20px rgba(15, 23, 42, 0.08);
                }
                .pymtw-sticky-action-main {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 1rem;
                }
                .pymtw-sticky-meta {
                    display: flex;
                    flex-direction: column;
                    gap: 0.45rem;
                    min-width: 0;
                }
                .pymtw-sticky-month {
                    font-size: 1rem;
                    color: var(--text-main);
                }
                .pymtw-sticky-kpis {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.85rem 1.25rem;
                }
                .pymtw-sticky-kpi {
                    display: flex;
                    flex-direction: column;
                    gap: 0.15rem;
                }
                .pymtw-sticky-kpi-label {
                    font-size: 0.72rem;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: var(--text-muted);
                    font-weight: 600;
                }
                .pymtw-sticky-status {
                    font-size: 0.85rem;
                    font-weight: 700;
                }
                .pymtw-sticky-status-dirty { color: #b45309; }
                .pymtw-sticky-status-saved { color: #047857; }
                .pymtw-sticky-hint {
                    margin: 0;
                    font-size: 0.8rem;
                    color: var(--text-muted);
                }
                .pymtw-sticky-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }
                .pymtw-save-success {
                    margin-top: 0.65rem;
                    font-size: 0.88rem;
                    font-weight: 600;
                    color: #047857;
                }
                .pymtw-category-action {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    flex-shrink: 0;
                    padding: 0.35rem 0.65rem;
                    border-radius: 999px;
                    background: rgba(16,185,129,0.12);
                    color: #047857;
                    font-size: 0.78rem;
                    font-weight: 650;
                }
                .pymtw-category-action-open {
                    background: rgba(15, 23, 42, 0.06);
                    color: var(--text-muted);
                }
                .pymtw-category-action-label { white-space: nowrap; }
                .pymtw-category-chevron {
                    flex-shrink: 0;
                    transition: transform 0.2s ease;
                }
                .pymtw-category-chevron-open { transform: rotate(180deg); }
                .pymtw-category-open .pymtw-instrument-grid {
                    border: 1px solid rgba(16,185,129,0.45);
                    border-top: none;
                    border-radius: 0 0 10px 10px;
                    padding: 0.85rem;
                }
                @media (max-width: 520px) {
                    .pymtw-category-action-label { display: none; }
                }
                .pymtw-instrument-note {
                    margin: 0;
                    font-size: 0.8rem;
                    line-height: 1.4;
                    color: var(--text-muted);
                }
                .pymtw-amount-input-wrap {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.2rem;
                    font-weight: 700;
                }
                .pymtw-amount-prefix,
                .pymtw-amount-suffix {
                    font-size: 0.85rem;
                    color: var(--text-muted);
                }
                .pymtw-amount-input {
                    width: 6.5rem;
                    padding: 0.2rem 0.35rem;
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    background: var(--bg-main);
                    color: var(--text-main);
                    font-size: 0.95rem;
                    font-weight: 700;
                    text-align: right;
                }
                .pymtw-manual-apply-row {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                }
                .pymtw-apply-error {
                    width: 100%;
                    max-width: 36rem;
                    padding: 0.65rem 0.85rem;
                    border-radius: 8px;
                    background: rgba(239,68,68,0.08);
                    border: 1px solid rgba(239,68,68,0.25);
                    color: #B91C1C;
                    font-size: 0.85rem;
                    line-height: 1.4;
                    text-align: left;
                }
                .pymtw-instrument-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
                    gap: 1rem;
                    width: 100%;
                }
                .pymtw-instrument-card {
                    padding: 1rem;
                    border-radius: 12px;
                    border: 1px solid var(--border);
                    background: var(--bg-card);
                    display: flex;
                    flex-direction: column;
                    gap: 0.65rem;
                }
                .pymtw-instrument-active {
                    border-color: rgba(16,185,129,0.45);
                    box-shadow: 0 0 0 1px rgba(16,185,129,0.1);
                }
                .pymtw-instrument-locked { opacity: 0.88; }
                .pymtw-instrument-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .pymtw-instrument-title-row {
                    display: flex;
                    align-items: center;
                    gap: 0.45rem;
                }
                .pymtw-instrument-title-row h4 { margin: 0; font-size: 0.95rem; }
                .pymtw-coming-soon {
                    font-size: 0.68rem;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: var(--text-muted);
                    background: var(--bg-main);
                    padding: 0.15rem 0.45rem;
                    border-radius: 4px;
                }
                .pymtw-goal-tag {
                    font-size: 0.72rem;
                    padding: 0.15rem 0.45rem;
                    border-radius: 4px;
                    background: rgba(37,99,235,0.08);
                    color: var(--primary);
                }
                .pymtw-instrument-tags { display: flex; flex-wrap: wrap; gap: 0.35rem; }
                .pymtw-sip-slider-block { display: flex; flex-direction: column; gap: 0.4rem; }
                .pymtw-sip-slider-head {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.82rem;
                }
                .pymtw-sip-slider-head span { color: var(--text-muted); }
                .pymtw-sip-slider {
                    width: 100%;
                    accent-color: #10B981;
                    cursor: pointer;
                }
                .pymtw-sip-slider-labels {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.72rem;
                    color: var(--text-muted);
                }
                .pymtw-instrument-stats {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                }
                .pymtw-instrument-stats span { display: block; color: var(--text-muted); font-size: 0.72rem; }
                .pymtw-instrument-empty {
                    margin: 0;
                    font-size: 0.82rem;
                    color: var(--text-muted);
                    font-style: italic;
                }
                .pymtw-analyze-btn {
                    margin-top: auto;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.35rem;
                    padding: 0.55rem 0.75rem;
                    border: none;
                    border-radius: 8px;
                    background: #10B981;
                    color: white;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s ease;
                }
                .pymtw-analyze-btn:hover { background: #059669; }
                .pymtw-instrument-foot {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin-top: auto;
                }

                .pymtw-zone-d { padding: 1.25rem; }

                .pymtw-growth-strip { padding: 1.25rem; }
                .pymtw-growth-totals {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                    gap: 1rem;
                    margin-bottom: 0;
                }
                .pymtw-growth-totals span { display: block; font-size: 0.72rem; color: var(--text-muted); }
                .pymtw-growth-totals strong { font-size: 1.05rem; }
                .pymtw-growth-scenario { color: #10B981; }

                .pymtw-outcome-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.25rem;
                }
                .pymtw-outcome-stat {
                    display: flex;
                    gap: 0.75rem;
                    align-items: flex-start;
                    padding: 1rem;
                    background: var(--bg-main);
                    border-radius: 10px;
                    border: 1px solid var(--border);
                }
                .pymtw-outcome-stat span { display: block; font-size: 0.75rem; color: var(--text-muted); }
                .pymtw-outcome-stat strong { font-size: 1.1rem; display: block; }
                .pymtw-outcome-delta {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.15rem;
                    font-size: 0.78rem;
                    font-style: normal;
                    color: #059669;
                    font-weight: 600;
                    margin-top: 0.15rem;
                }
                .pymtw-outcome-icon {
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    color: #7C3AED;
                }
                .pymtw-outcome-goals h4 { margin: 0 0 0.75rem; font-size: 0.92rem; }
                .pymtw-outcome-goal-row {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    grid-template-rows: auto auto;
                    gap: 0.25rem 0.75rem;
                    align-items: center;
                    margin-bottom: 0.75rem;
                }
                .pymtw-outcome-goal-label { display: flex; flex-direction: column; }
                .pymtw-outcome-goal-label span { font-size: 0.75rem; color: var(--text-muted); }
                .pymtw-outcome-goal-bar {
                    grid-column: 1 / -1;
                    height: 6px;
                    background: var(--border);
                    border-radius: 3px;
                    overflow: hidden;
                }
                .pymtw-outcome-goal-bar div {
                    height: 100%;
                    background: linear-gradient(90deg, #10B981, #059669);
                    border-radius: 3px;
                    transition: width 0.35s ease;
                }
                .pymtw-outcome-goal-pct { font-size: 0.82rem; font-weight: 700; color: var(--primary); }
                .pymtw-outcome-empty { font-size: 0.88rem; color: var(--text-muted); margin: 0; }

                .pymtw-apply-bar {
                    position: fixed;
                    bottom: var(--summary-report-action-bar-offset, 4.75rem);
                    left: 0;
                    right: 0;
                    z-index: 95;
                    padding: 0.75rem 1rem;
                    background: linear-gradient(to top, var(--bg-main) 80%, transparent);
                    pointer-events: none;
                }
                .pymtw-apply-inner {
                    pointer-events: auto;
                }
                .pymtw-apply-inner {
                    max-width: 1100px;
                    margin: 0 auto;
                    padding: 1rem 1.25rem;
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                    box-shadow: 0 -4px 24px rgba(0,0,0,0.08);
                }
                .pymtw-apply-stats {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1.5rem;
                }
                .pymtw-apply-stats span { display: block; font-size: 0.72rem; color: var(--text-muted); }
                .pymtw-apply-stats strong { font-size: 1rem; }
                .pymtw-apply-sip { color: #10B981; }
                .pymtw-apply-over { color: #ef4444; }
                .pymtw-apply-actions { display: flex; gap: 0.65rem; flex-wrap: wrap; }
                .pymtw-save-btn, .pymtw-apply-btn, .pymtw-clear-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                }
                .pymtw-apply-warning {
                    width: 100%;
                    margin: 0;
                    font-size: 0.82rem;
                    color: #ef4444;
                }

                .pymtw-panel-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.45);
                    z-index: 1000;
                    display: flex;
                    justify-content: flex-end;
                    animation: pymtw-fade-in 0.2s ease;
                }
                @keyframes pymtw-fade-in { from { opacity: 0; } to { opacity: 1; } }
                .pymtw-panel {
                    width: min(520px, 100vw);
                    height: 100%;
                    background: var(--bg-card);
                    border-left: 1px solid var(--border);
                    overflow-y: auto;
                    padding: 1.5rem;
                    animation: pymtw-slide-in 0.3s cubic-bezier(0.16,1,0.3,1);
                }
                @keyframes pymtw-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
                .pymtw-panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 1rem;
                }
                .pymtw-panel-header h3 { margin: 0.35rem 0 0; font-size: 1.25rem; }
                .pymtw-panel-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    font-size: 0.72rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #10B981;
                    letter-spacing: 0.04em;
                }
                .pymtw-panel-close {
                    border: none;
                    background: var(--bg-main);
                    border-radius: 8px;
                    padding: 0.4rem;
                    cursor: pointer;
                    color: var(--text-muted);
                }
                .pymtw-panel-slider-block {
                    margin-bottom: 1rem;
                    padding: 0.85rem;
                    background: var(--bg-main);
                    border-radius: 10px;
                    border: 1px solid var(--border);
                }
                .pymtw-panel-narrative {
                    font-size: 0.9rem;
                    line-height: 1.6;
                    color: var(--text-main);
                    margin: 0 0 1.25rem;
                    padding: 0.85rem;
                    background: rgba(16,185,129,0.06);
                    border-radius: 10px;
                    border-left: 3px solid #10B981;
                }
                .pymtw-panel-kpis {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 0.65rem;
                    margin-bottom: 1.25rem;
                }
                .pymtw-panel-kpi {
                    padding: 0.75rem;
                    background: var(--bg-main);
                    border-radius: 8px;
                    border: 1px solid var(--border);
                }
                .pymtw-panel-kpi span { display: block; font-size: 0.72rem; color: var(--text-muted); }
                .pymtw-panel-kpi strong { font-size: 0.95rem; }
                .pymtw-panel-kpi-highlight {
                    grid-column: 1 / -1;
                    background: rgba(16,185,129,0.08);
                    border-color: rgba(16,185,129,0.3);
                }
                .pymtw-delta-positive { color: #059669; font-style: normal; font-weight: 600; font-size: 0.85em; }
                .pymtw-panel-chart { padding: 1rem; margin-bottom: 1.25rem; }
                .pymtw-panel-chart h4 { margin: 0 0 0.25rem; font-size: 0.95rem; }
                .pymtw-chart-sub { margin: 0 0 0.75rem; font-size: 0.78rem; color: var(--text-muted); }
                .pymtw-panel-goals h4 { margin: 0 0 0.75rem; font-size: 0.95rem; }
                .pymtw-goal-impact-list { display: flex; flex-direction: column; gap: 1rem; }
                .pymtw-goal-impact-row {
                    padding: 0.85rem;
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    background: var(--bg-main);
                }
                .pymtw-goal-impact-head {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    margin-bottom: 0.5rem;
                    font-size: 0.82rem;
                }
                .pymtw-goal-impact-head span { color: var(--text-muted); }
                .pymtw-goal-impact-bar-wrap {
                    display: flex;
                    align-items: center;
                    gap: 0.65rem;
                    margin-bottom: 0.5rem;
                }
                .pymtw-goal-impact-bar {
                    flex: 1;
                    height: 8px;
                    background: var(--border);
                    border-radius: 4px;
                    overflow: hidden;
                }
                .pymtw-goal-impact-fill {
                    height: 100%;
                    background: var(--primary);
                    border-radius: 4px;
                    transition: width 0.35s ease;
                }
                .pymtw-fill-muted { background: #94A3B8; }
                .pymtw-goal-impact-pct { font-size: 0.78rem; font-weight: 700; min-width: 72px; text-align: right; }
                .pymtw-goal-delta-bars { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.5rem; }
                .pymtw-goal-delta-row {
                    display: grid;
                    grid-template-columns: 72px 1fr 48px;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }
                .pymtw-goal-impact-stats {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem 1rem;
                    font-size: 0.78rem;
                    color: var(--text-muted);
                }
            `}</style>
        </div>
    );
};

export default PutYourMoneyToWorkSection;
