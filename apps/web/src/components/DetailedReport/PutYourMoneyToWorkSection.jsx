import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { resolveEmploymentType } from '../DetailedFlow/employmentTypeSync';
import { buildYourMoneyFlowReport } from './moneyFlowLedgerLogic';
import {
    buildAllocationStudioContext,
    buildDraftAllocationPlan,
    buildRecommendedBundles,
    computeAllocationImpactForMonth,
    createEmptyDraftAllocations,
    getAllocationPlanKey,
    getTotalDraftAllocated,
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
} from './instrumentAnalysisLogic';
import AllocationStudioHero from './AllocationStudioHero';
import JourneyConstraintsRail from './JourneyConstraintsRail';
import InstrumentCardGrid from './InstrumentCardGrid';
import RecommendedBundles from './RecommendedBundles';
import InstrumentAnalysisPanel from './InstrumentAnalysisPanel';
import GrowthPreviewStrip from './GrowthPreviewStrip';
import StudioInsightsRail from './StudioInsightsRail';
import PlannedInvestmentAllocationsPanel from './PlannedInvestmentAllocationsPanel';
import { summarizeInvestmentAllocations } from './investSurplusLogic';
import {
    validateDraftPlan,
    buildScenarioComparison,
    buildStudioInsights,
    buildEnhancedBriefingLines,
} from './allocationStudioValidation';

const PPF_ANNUAL_CAP = 150000;
const PPF_MAX_MONTHLY = 12500;
const PYMTW_GATE_KEY = '__pymtwGate';
const parseAmount = (value) => parseFloat(value) || 0;

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

const getMonthlyPpfCap = (expenseCategories = {}, investmentAllocations = [], draftAllocations = {}) => {
    const existingPpfAnnual = parseAmount(expenseCategories?.savings?.ppf?.amount) * 12
        || parseAmount(expenseCategories?.savings?.ppf) * 12;
    const proposedPpfAnnual = investmentAllocations
        .filter((a) => a.type === 'PPF')
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
        if (item.instrumentType) draft[item.instrumentType] = item.amount || 0;
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
            const raw = Math.round(parseAmount(alloc.amount));
            const amount = def.inputMode === 'monthly' ? Math.round(raw / 12) : raw;
            draft[type] = (draft[type] || 0) + Math.max(0, amount);
        });
    return draft;
};

const PutYourMoneyToWorkSection = () => {
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
    const [adjustmentSaveMessage, setAdjustmentSaveMessage] = useState('');
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
        ],
    );

    const planKey = studio.meta?.hasData
        ? getAllocationPlanKey(studio.meta.calendarYear, effectiveMonth)
        : null;

    useEffect(() => {
        if (!planKey) return;
        const saved = allocationPlans[planKey];
        if (saved?.status === 'draft') {
            const hasItems = (saved.items || []).some((item) => (item.amount || 0) > 0);
            setDraftAllocations(draftFromPlanItems(saved.items));
            setActiveBundleId(saved.selectedBundleId || null);
            setAppliedPlanKey(null);
            // Empty / AI-prefilled drafts stay on chooser; only user drafts with amounts open manual edit.
            setAvenuesMode(hasItems && !saved.selectedBundleId ? 'manual_edit' : 'choose');
        } else if (saved?.status === 'applied') {
            setDraftAllocations(createEmptyDraftAllocations());
            setActiveBundleId(saved.selectedBundleId || null);
            setAppliedPlanKey(planKey);
            setAvenuesMode(saved.selectedBundleId ? 'ai_applied' : 'manual_applied');
        } else {
            setDraftAllocations(createEmptyDraftAllocations());
            setActiveBundleId(null);
            setAppliedPlanKey(null);
            setAvenuesMode('choose');
        }
    }, [planKey, allocationPlans]);

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

    const totalAllocated = getTotalDraftAllocated(draftAllocations);
    const editingStudioImpact = useMemo(() => {
        if (!studio.meta?.hasData || !planKey) return 0;
        if (avenuesMode !== 'manual_edit') return 0;
        return computeAllocationImpactForMonth(
            (investmentAllocations || []).filter((a) => a.studioPlanKey === planKey),
            studio.meta.calendarYear,
            effectiveMonth,
        );
    }, [avenuesMode, investmentAllocations, planKey, studio.meta, effectiveMonth]);
    const availableSurplus = (studio.hero?.deployableSurplus || 0) + editingStudioImpact;
    const remaining = availableSurplus - totalAllocated;
    const ppfMaxByCap = useMemo(
        () => getMonthlyPpfCap(expenseCategories, investmentAllocations, { ...draftAllocations, PPF: 0 }),
        [expenseCategories, investmentAllocations, draftAllocations],
    );
    const maxForInstrument = useCallback((instrumentType) => {
        const genericMax = (draftAllocations[instrumentType] || 0) + Math.max(0, remaining);
        if (instrumentType !== 'PPF') return genericMax;
        return Math.min(genericMax, ppfMaxByCap);
    }, [draftAllocations, remaining, ppfMaxByCap]);

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
        });
    }, [
        draftAllocations,
        availableSurplus,
        studio.meta,
        journeyProjections,
        effectiveMonth,
        expenseCategories,
        investmentAllocations,
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
                draftAllocations[activePanelType] || 0,
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
        const rounded = instrumentType === 'PPF'
            ? Math.min(requested, maxForInstrument('PPF'))
            : Math.min(requested, maxForInstrument(instrumentType));
        const next = { ...draftAllocations, [instrumentType]: rounded };
        setDraftAllocations(next);
        setActiveBundleId(null);
        setAppliedPlanKey(null);
        setAvenuesMode('manual_edit');
        persistDraft(next, null);
    }, [draftAllocations, persistDraft, maxForInstrument]);

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
        });
        if (!planValidation.canApply) return false;

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
        setAppliedPlanKey(planKey);
        setAvenuesMode(bundleId ? 'ai_applied' : 'manual_applied');
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
        setDraftAllocations(createEmptyDraftAllocations());
        setActiveBundleId(null);
        setAppliedPlanKey(null);
        setAvenuesMode('manual_edit');
    }, []);

    const handleApplyManualAllocations = useCallback(() => {
        commitAppliedPlan(draftAllocations, null);
    }, [commitAppliedPlan, draftAllocations]);

    const allocationsSummary = useMemo(
        () => summarizeInvestmentAllocations(investmentAllocations),
        [investmentAllocations],
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
    }, []);

    const handleClearMonthPlan = useCallback((planKeyOverride) => {
        const targetKey = planKeyOverride || planKey;
        if (!targetKey || !studio.meta?.hasData) return;

        const [yearStr, monthStr] = String(targetKey).split('-');
        const calendarYear = parseInt(yearStr, 10);
        const monthIndex = parseInt(monthStr, 10);
        if (!Number.isFinite(calendarYear) || !Number.isFinite(monthIndex)) return;

        const nextAllocations = clearStudioMonthPlan({
            investmentAllocations,
            calendarYear,
            monthIndex,
        });
        setInvestmentAllocations(nextAllocations);

        const nextPlans = { ...allocationPlans };
        delete nextPlans[targetKey];
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
    ]);

    const handleEditMonthPlan = useCallback((planKeyOverride) => {
        const targetKey = planKeyOverride || planKey;
        if (!targetKey || !studio.meta?.hasData) return;

        const [yearStr, monthStr] = String(targetKey).split('-');
        const calendarYear = parseInt(yearStr, 10);
        const monthIndex = parseInt(monthStr, 10);
        if (!Number.isFinite(calendarYear) || !Number.isFinite(monthIndex)) return;

        const saved = allocationPlans[targetKey];
        const draftFromItems = draftFromPlanItems(saved?.items);
        const hasSavedItems = Object.values(draftFromItems).some((amount) => amount > 0);
        const nextDraft = hasSavedItems
            ? draftFromItems
            : draftFromStudioAllocations(investmentAllocations, targetKey);

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
    ]);

    const handleBackToAiRecommendations = useCallback(() => {
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
        avenuesMode,
        hasMonthPlan,
        planKey,
        allocationPlans,
        setAllocationPlans,
        resetLocalDraftState,
        handleClearMonthPlan,
    ]);

    const handleRemoveAllocation = useCallback((id) => {
        const removed = investmentAllocations.find((a) => a.id === id);
        const nextAllocations = removeInvestmentAllocationById(investmentAllocations, id);
        setInvestmentAllocations(nextAllocations);
        setAllocationPlans(pruneAllocationPlansForAllocations(allocationPlans, nextAllocations));

        if (removed?.studioPlanKey && removed.studioPlanKey === planKey) {
            const stillHasMonth = nextAllocations.some((a) => a.studioPlanKey === planKey);
            if (!stillHasMonth) {
                resetLocalDraftState();
            }
        }
    }, [
        investmentAllocations,
        setInvestmentAllocations,
        allocationPlans,
        setAllocationPlans,
        planKey,
        resetLocalDraftState,
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
                <h2>Put Your Money to Work</h2>
                <p className="text-muted">
                    Complete Your Money Flow first to unlock the allocation studio.
                </p>
            </div>
        );
    }

    return (
        <div className="pymtw-section">
            <AllocationStudioHero
                briefing={studio.briefing}
                hero={studio.hero}
                meta={studio.meta}
                selectableMonths={studio.selectableMonths}
                selectedMonthIndex={effectiveMonth}
                onMonthChange={setSelectedMonthIndex}
            />

            <div className="card pymtw-guidance-card">
                <p>
                    Do you have any expenses coming up in the next three months or are you planning to take a loan
                    for a future goal? Add those details here first. Once they&apos;re mapped, I&apos;ll calculate your
                    remaining available surplus and help you allocate it in the next step.
                </p>
            </div>

            <JourneyConstraintsRail
                journeyConstraints={studio.journeyConstraints}
                journeyAdjustments={journeyAdjustments}
                setJourneyAdjustments={handleJourneyAdjustmentsChange}
                defaultStartMonthIndex={effectiveMonth}
                defaultCalendarYear={studio.meta.calendarYear}
                selectableMonths={studio.selectableMonths}
                unallocatedSurplusByMonth={moneyFlowReport?.ledger?.unallocatedSurplus || []}
                onSaveAdjustments={handleSaveAdjustments}
                adjustmentsSaved={adjustmentsSaved}
                saveMessage={adjustmentSaveMessage}
            />

            {adjustmentsSaved && (
                <div className="card pymtw-recalculated-surplus-card">
                    <div>
                        <span className="pymtw-recalculated-label">Recalculated unallocated surplus</span>
                        <strong>₹{Math.round(studio.hero.deployableSurplus).toLocaleString('en-IN')}</strong>
                    </div>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleProceedToInvestmentAvenues}
                    >
                        Proceed to Investment Avenues to allocate the surplus
                    </button>
                </div>
            )}

            {!adjustmentsSaved && (
                <div className="pymtw-proceed-hint">
                    Save future financial adjustments to unlock investment avenues.
                </div>
            )}

            {showInvestmentAvenues && (
                <>
                    <RecommendedBundles
                        bundles={recommendedBundles}
                        deployableSurplus={studio.hero.deployableSurplus}
                        engineResult={engineResult}
                        avenuesMode={avenuesMode}
                        onApplyAiRecommendations={handleApplyAiRecommendations}
                        onStartManualAllocation={handleStartManualAllocation}
                        onBackToAiRecommendations={handleBackToAiRecommendations}
                        canApplyAi={Boolean(recommendedBundles[0]) && studio.hero.deployableSurplus > 0}
                    />

                    {avenuesMode === 'manual_edit' && (
                        <div id="pymtw-allocate-surplus">
                            <InstrumentCardGrid
                                instrumentCategories={studio.instrumentCategories}
                                draftAllocations={draftAllocations}
                                remainingSurplus={remaining}
                                getMaxAmountForInstrument={maxForInstrument}
                                onDraftChange={handleDraftChange}
                                onApplyManualAllocations={handleApplyManualAllocations}
                                canApplyManual={validation.canApply}
                            />
                        </div>
                    )}

                    {(avenuesMode === 'ai_applied' || avenuesMode === 'manual_applied') && (
                        <GrowthPreviewStrip growthPreview={appliedGrowthPreview || growthPreview} />
                    )}

                    <PlannedInvestmentAllocationsPanel
                        allocationsSummary={allocationsSummary}
                        onRemove={handleRemoveAllocation}
                        onEditMonthPlan={handleEditMonthPlan}
                        onClearMonthPlan={handleClearMonthPlan}
                    />

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
                instrumentType={activePanelType}
                baselineAnalysis={panelBaseline}
                scenarioAnalysis={panelScenario}
                goalDeltas={panelGoalDeltas}
                draftAmount={activePanelType ? (draftAllocations[activePanelType] || 0) : 0}
                maxAmount={activePanelType ? maxForInstrument(activePanelType) : Math.max(0, remaining)}
                onAmountChange={(amount) => activePanelType && handleDraftChange(activePanelType, amount)}
                isOpen={Boolean(activePanelType)}
                onClose={() => setActivePanelType(null)}
            />

            <style>{`
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
                    align-items: center;
                    gap: 1rem;
                    flex-wrap: wrap;
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
                .dr-chart-tooltip { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 0.75rem; font-size: 0.82rem; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
                .dr-chart-tooltip-label { font-weight: 700; margin-bottom: 0.25rem; }

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

                .pymtw-bundles { padding: 1.25rem; }
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
                .pymtw-zone-b { padding: 1.25rem; }
                .pymtw-adjust-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.75rem;
                    margin-top: 1.25rem;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border);
                }
                .pymtw-adjust-add-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                }
                .pymtw-adjust-list {
                    margin-top: 0.9rem;
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
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
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
                    justify-content: flex-end;
                    margin-top: 0.5rem;
                }
                .pymtw-instrument-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                    gap: 0.85rem;
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
