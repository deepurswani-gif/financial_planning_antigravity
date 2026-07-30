import { calculateAge } from '../ProfileModule/ProfileLogic';
import { computeSIPData } from '../Calculators/SIPCalculator';
import { computeLumpsumData } from '../Calculators/LumpsumCalculator';
import { computeEquityData } from '../Calculators/EquityCalculator';
import { computePPFData } from '../Calculators/PPFCalculator';
import { computeNPSData } from '../Calculators/NPSCalculator';
import { computeFDData } from '../Calculators/FDCalculator';
import { computeRDData } from '../Calculators/RDCalculator';
import { MONTH_LABELS_SHORT } from './moneyFlowLedgerLogic';

const parseAmount = (value) => parseFloat(value) || 0;
const PPF_MAX_DURATION_YEARS = 15;

function normalizePpfDuration(duration, fallback = PPF_MAX_DURATION_YEARS) {
    const parsed = parseInt(duration, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(PPF_MAX_DURATION_YEARS, parsed);
}

function getGoalFutureValue(goal) {
    if (goal.futureValue) return parseAmount(goal.futureValue);
    const pv = parseAmount(goal.presentValue);
    const years = parseAmount(goal.yearsToGoal);
    const inflation = parseAmount(goal.inflationRate) || 6;
    return pv * Math.pow(1 + inflation / 100, years);
}

function getGoalTargetYear(goal, currentYear = new Date().getFullYear()) {
    return currentYear + Math.round(parseAmount(goal.yearsToGoal));
}

function getAllocationPlanKey(calendarYear, monthIndex) {
    return `${calendarYear}-${monthIndex}`;
}

export const INSTRUMENT_REGISTRY = {
    SIP: {
        allocType: 'SIP',
        goalKey: 'sip',
        inputMode: 'monthly',
        step: 500,
        defaultRate: 12,
        defaultDuration: 10,
    },
    Lumpsum: {
        allocType: 'Lumpsum',
        goalKey: 'lumpsum',
        inputMode: 'lumpsum',
        step: 1000,
        defaultRate: 12,
        defaultDuration: 10,
    },
    'Direct Equity & ETFs': {
        allocType: 'Direct Equity & ETFs',
        goalKey: 'equity',
        inputMode: 'lumpsum',
        step: 1000,
        defaultRate: 12,
        defaultDuration: 10,
    },
    PPF: {
        allocType: 'PPF',
        goalKey: null,
        inputMode: 'monthly',
        step: 500,
        defaultRate: 7.1,
        defaultDuration: PPF_MAX_DURATION_YEARS,
        maxDurationYears: PPF_MAX_DURATION_YEARS,
        maxMonthly: 12500,
    },
    NPS: {
        allocType: 'NPS',
        goalKey: null,
        inputMode: 'monthly',
        step: 500,
        defaultRate: 10,
        defaultDuration: 10,
    },
    'Fixed Deposit': {
        allocType: 'Fixed Deposit',
        goalKey: 'fd',
        inputMode: 'lumpsum',
        step: 1000,
        defaultRate: 6,
        defaultDuration: 5,
    },
    'Liquid Mutual Fund': {
        allocType: 'Liquid Mutual Fund',
        goalKey: null,
        inputMode: 'lumpsum',
        step: 1000,
        defaultRate: 5.5,
        defaultDuration: 3,
    },
    'Recurring Deposit': {
        allocType: 'Recurring Deposit',
        goalKey: 'rd',
        inputMode: 'monthly',
        step: 500,
        defaultRate: 6,
        defaultDuration: 5,
    },
    'Life Insurance': {
        allocType: 'Life Insurance',
        goalKey: null,
        inputMode: 'monthly',
        step: 500,
        defaultRate: 0,
        defaultDuration: 10,
        isProtection: true,
    },
    'Term Insurance': {
        allocType: 'Term Insurance',
        goalKey: null,
        inputMode: 'monthly',
        step: 500,
        defaultRate: 0,
        defaultDuration: 10,
        isProtection: true,
    },
    'Health Insurance': {
        allocType: 'Health Insurance',
        goalKey: null,
        inputMode: 'monthly',
        step: 500,
        defaultRate: 0,
        defaultDuration: 10,
        isProtection: true,
    },
    'Life Insurance Saving Plans': {
        allocType: 'Life Insurance Saving Plans',
        goalKey: null,
        inputMode: 'monthly',
        step: 500,
        defaultRate: 5,
        defaultDuration: 10,
    },
    Gold: {
        allocType: 'Gold',
        goalKey: null,
        inputMode: 'lumpsum',
        step: 1000,
        defaultRate: 10,
        defaultDuration: 10,
    },
    'Other Investment': {
        allocType: 'Other Investment',
        goalKey: null,
        inputMode: 'lumpsum',
        step: 1000,
        defaultRate: 10,
        defaultDuration: 10,
    },
};

export const STUDIO_INSTRUMENT_TYPES = Object.keys(INSTRUMENT_REGISTRY);

export const LISP_INSTRUMENT_TYPE = 'Life Insurance Saving Plans';

export const LISP_FREQUENCIES = ['Monthly', 'Quarterly', 'Half-Yearly', 'Annual'];

export function normalizeAllocType(type) {
    if (type === 'FD') return 'Fixed Deposit';
    if (type === 'RD') return 'Recurring Deposit';
    return type;
}

/** True for Life Insurance and Life Insurance Saving Plans allocation rows. */
export function isLifeInsuranceAllocType(type) {
    return type === 'Life Insurance' || type === LISP_INSTRUMENT_TYPE;
}

export function createEmptyLispDraft() {
    return {
        premium: 0,
        frequency: 'Monthly',
        duration: INSTRUMENT_REGISTRY[LISP_INSTRUMENT_TYPE]?.defaultDuration || 10,
        insuredMember: '',
    };
}

export function isLispDraft(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value)
        && ('premium' in value || 'insuredMember' in value || 'frequency' in value);
}

/** Installment premium → monthly surplus impact (same rules as legacy Life Insurance). */
export function premiumToMonthlyEquivalent(premium, frequency = 'Monthly') {
    const amount = Math.max(0, parseAmount(premium));
    const freq = String(frequency || 'Monthly').toLowerCase();
    if (freq === 'quarterly') return amount / 3;
    if (freq === 'half-yearly' || freq === 'half yearly') return amount / 6;
    if (freq === 'annual' || freq === 'annually') return amount / 12;
    return amount;
}

export function getLispDraftMonthly(draft) {
    if (!isLispDraft(draft)) return Math.max(0, parseAmount(draft));
    return premiumToMonthlyEquivalent(draft.premium, draft.frequency);
}

/** Numeric monthly/lumpsum amount used for surplus totals and max clamps. */
export function getDraftTypeAmount(draftAllocations = {}, type) {
    const value = draftAllocations?.[type];
    if (type === LISP_INSTRUMENT_TYPE) return getLispDraftMonthly(value);
    return Math.max(0, parseAmount(value));
}

export function createEmptyDraftAllocations() {
    return Object.fromEntries(STUDIO_INSTRUMENT_TYPES.map((t) => (
        t === LISP_INSTRUMENT_TYPE ? [t, createEmptyLispDraft()] : [t, 0]
    )));
}

export function getDraftMonthlyImpact(instrumentType, amount) {
    const def = INSTRUMENT_REGISTRY[instrumentType];
    if (!def) return 0;
    if (instrumentType === LISP_INSTRUMENT_TYPE) {
        const monthly = isLispDraft(amount) ? getLispDraftMonthly(amount) : parseAmount(amount);
        return monthly > 0 ? monthly : 0;
    }
    if (amount <= 0) return 0;
    return def.inputMode === 'monthly' ? amount : 0;
}

export function getTotalDraftAllocated(draftAllocations = {}) {
    return STUDIO_INSTRUMENT_TYPES.reduce(
        (sum, type) => sum + getDraftTypeAmount(draftAllocations, type),
        0,
    );
}

export function draftAllocationsToItems(draftAllocations = {}, source = 'user') {
    return STUDIO_INSTRUMENT_TYPES
        .filter((type) => getDraftTypeAmount(draftAllocations, type) > 0)
        .map((type) => {
            const value = draftAllocations[type];
            if (type === LISP_INSTRUMENT_TYPE && isLispDraft(value)) {
                return {
                    instrumentType: type,
                    amount: getLispDraftMonthly(value),
                    premium: Math.round(parseAmount(value.premium)),
                    frequency: value.frequency || 'Monthly',
                    duration: parseInt(value.duration, 10) || 10,
                    insuredMember: value.insuredMember || '',
                    source,
                };
            }
            return {
                instrumentType: type,
                amount: value,
                source,
            };
        });
}

/** Hydrate LISP draft from a persisted allocation row. */
export function lispDraftFromAllocation(alloc = {}) {
    const empty = createEmptyLispDraft();
    if (!alloc) return empty;
    // New installment+member shape (or any row with insuredMember)
    if (alloc.insuredMember) {
        return {
            premium: Math.round(parseAmount(alloc.amount)),
            frequency: alloc.frequency || 'Monthly',
            duration: parseInt(alloc.duration, 10) || empty.duration,
            insuredMember: alloc.insuredMember || '',
        };
    }
    // Legacy studio annual storage → treat as monthly premium installment
    return {
        premium: Math.round(parseAmount(alloc.amount) / 12),
        frequency: 'Monthly',
        duration: parseInt(alloc.duration, 10) || empty.duration,
        insuredMember: '',
    };
}

export function areDraftTypeValuesEqual(a, b, type) {
    if (type === LISP_INSTRUMENT_TYPE) {
        const left = isLispDraft(a) ? a : createEmptyLispDraft();
        const right = isLispDraft(b) ? b : createEmptyLispDraft();
        return Math.round(parseAmount(left.premium)) === Math.round(parseAmount(right.premium))
            && String(left.frequency || 'Monthly') === String(right.frequency || 'Monthly')
            && (parseInt(left.duration, 10) || 10) === (parseInt(right.duration, 10) || 10)
            && String(left.insuredMember || '') === String(right.insuredMember || '');
    }
    return Math.round(parseAmount(a)) === Math.round(parseAmount(b));
}

function buildGoalImpacts(series, goals, goalMappings, currentYear, goalKey, valueField = 'corpus') {
    const activeGoals = goals
        .filter((g) => getGoalFutureValue(g) > 0)
        .sort((a, b) => parseAmount(a.yearsToGoal) - parseAmount(b.yearsToGoal));

    return activeGoals.map((goal) => {
        const targetYear = getGoalTargetYear(goal, currentYear);
        const futureValue = Math.round(getGoalFutureValue(goal));
        const row = series.find((r) => r.year === targetYear);
        const availableAtGoalYear = Math.round(row?.[valueField] || row?.corpus || row?.endValue || row?.maturityValue || 0);
        const mapped = goalKey ? Math.round(parseAmount((goalMappings[goal.id] || {})[goalKey])) : 0;
        const totalMapped = Object.values(goalMappings[goal.id] || {})
            .reduce((sum, val) => sum + parseAmount(val), 0);
        const projectedFundedPct = futureValue > 0
            ? Math.min(100, Math.round((availableAtGoalYear / futureValue) * 100))
            : 0;

        return {
            goalId: goal.id,
            name: goal.name || goal.placeholder || 'Goal',
            targetYear,
            yearsAway: Math.max(0, targetYear - currentYear),
            futureValue,
            availableAtGoalYear,
            totalMapped,
            fundedPct: futureValue > 0 ? Math.min(100, Math.round((totalMapped / futureValue) * 100)) : 0,
            projectedFundedPct,
            shortfall: Math.max(0, futureValue - totalMapped),
            projectedShortfall: Math.max(0, futureValue - availableAtGoalYear),
            mapped,
        };
    });
}

function makeScenarioAlloc(allocType, amount, startMonth, startYear, def) {
    const storedAmount = def.inputMode === 'monthly' ? amount * 12 : amount;
    const duration = allocType === 'PPF'
        ? normalizePpfDuration(def.defaultDuration, PPF_MAX_DURATION_YEARS)
        : def.defaultDuration;
    return {
        id: `scenario-${allocType}`,
        type: allocType,
        name: `Studio ${allocType}`,
        amount: storedAmount,
        startMonth,
        startYear,
        duration,
        expectedReturn: def.defaultRate,
        frequency: 'Monthly',
    };
}

function toGrowthSeries(rows, valueField) {
    if (!rows?.length) return [];
    const step = Math.max(1, Math.floor(rows.length / 12));
    return rows
        .filter((_, idx) => idx % step === 0 || idx === rows.length - 1)
        .map((row) => ({
            year: row.year,
            label: String(row.year),
            corpus: Math.round(row[valueField] || 0),
        }));
}

function getRetirementYear(familyMembers, currentYear) {
    const selfMember = familyMembers.find((m) => m.relation?.toLowerCase() === 'self');
    const currentAge = selfMember?.dob ? calculateAge(selfMember.dob) : parseAmount(selfMember?.age) || 30;
    const retirementAge = parseInt(selfMember?.retirementAge, 10) || 60;
    return currentYear + Math.max(1, retirementAge - currentAge);
}

function simpleLumpsumSeries(amount, rate, currentYear, retirementYear) {
    if (amount <= 0) return [];
    const series = [];
    const years = retirementYear - currentYear;
    for (let y = 0; y <= years; y += 1) {
        const year = currentYear + y;
        series.push({
            year,
            corpus: Math.round(amount * Math.pow(1 + rate / 100, y)),
        });
    }
    return series;
}

export function analyzeInstrument(
    instrumentType,
    {
        expenseCategories = {},
        assetCategories = {},
        investmentAllocations = [],
        calculatorInputs = {},
        goalMappings = {},
        goals = [],
        familyMembers = [],
        currentYear = new Date().getFullYear(),
    },
    scenarioAmount = 0,
    monthIndex = 0,
    calendarYear = currentYear,
) {
    const def = INSTRUMENT_REGISTRY[instrumentType];
    if (!def) return null;

    const startMonth = monthIndex + 1;
    const retirementYear = getRetirementYear(familyMembers, currentYear);
    const yearsToRetirement = retirementYear - currentYear;
    const allocType = def.allocType;
    const stored = investmentAllocations.filter((a) => normalizeAllocType(a.type) === instrumentType || a.type === allocType);
    const proposedMonthly = stored.reduce((sum, a) => {
        if (def.inputMode === 'monthly') return sum + parseAmount(a.amount) / 12;
        return sum;
    }, 0);
    const proposedLumpsum = stored.reduce((sum, a) => {
        if (def.inputMode === 'lumpsum') return sum + parseAmount(a.amount);
        return sum;
    }, 0);

    const scenario = Math.max(0, scenarioAmount);
    let series = [];
    let headlineValue = 0;
    const calcKey = instrumentType === 'SIP' ? 'sip'
        : instrumentType === 'Lumpsum' ? 'lumpsum'
            : instrumentType === 'Direct Equity & ETFs' ? 'equity'
                : instrumentType === 'PPF' ? 'ppf'
                    : instrumentType === 'NPS' ? 'nps'
                        : instrumentType === 'Fixed Deposit' ? 'fd'
                            : instrumentType === 'Recurring Deposit' ? 'rd' : null;
    const cfg = calcKey ? (calculatorInputs[calcKey] || {}) : {};
    const rate = parseAmount(cfg.rate) || def.defaultRate;

    if (instrumentType === 'SIP') {
        const existing = parseAmount(expenseCategories?.savings?.sip?.amount ?? expenseCategories?.savings?.sip);
        const corpus = parseAmount(assetCategories?.investments?.mutualFunds)
            || parseAmount(assetCategories?.equity?.mfEquity) || 0;
        const proposed = stored.map((a) => ({ ...a, amount: parseAmount(a.amount) * 12 }));
        if (scenario > 0) {
            proposed.push(makeScenarioAlloc(allocType, scenario, startMonth, calendarYear, def));
        }
        const data = computeSIPData(
            currentYear, existing, rate, yearsToRetirement, corpus,
            cfg.events || cfg.increments || [], proposed, goalMappings, goals,
        );
        series = data.map((r) => ({ year: r.year, corpus: r.valueAfterWithdrawal }));
        headlineValue = Math.round(series.find((r) => r.year === retirementYear)?.corpus || 0);
    } else if (instrumentType === 'Lumpsum') {
        const base = parseAmount(cfg.amount) || 0;
        const proposed = [...stored];
        if (scenario > 0) proposed.push(makeScenarioAlloc(allocType, scenario, startMonth, calendarYear, def));
        const data = computeLumpsumData(
            base, rate, yearsToRetirement, startMonth, currentYear,
            cfg.events || [], proposed, goalMappings, goals,
        );
        series = data.map((r) => ({ year: r.year, corpus: r.valueAfterWithdrawal }));
        headlineValue = Math.round(series.find((r) => r.year === retirementYear)?.corpus || 0);
    } else if (instrumentType === 'Direct Equity & ETFs') {
        const corpus = parseAmount(assetCategories?.investments?.equity) || parseAmount(assetCategories?.equity?.stocks) || 0;
        const proposed = [...stored];
        if (scenario > 0) proposed.push(makeScenarioAlloc(allocType, scenario, startMonth, calendarYear, def));
        const data = computeEquityData(
            corpus, rate, yearsToRetirement, startMonth, currentYear,
            cfg.events || [], proposed, goalMappings, goals,
        );
        series = data.map((r) => ({ year: r.year, corpus: r.valueAfterWithdrawal }));
        headlineValue = Math.round(series.find((r) => r.year === retirementYear)?.corpus || 0);
    } else if (instrumentType === 'PPF') {
        const proposed = stored.map((a) => ({
            ...a,
            duration: normalizePpfDuration(a.duration, def.defaultDuration),
        }));
        if (scenario > 0) proposed.push(makeScenarioAlloc(allocType, scenario, startMonth, calendarYear, def));
        const data = computePPFData(proposed, rate, expenseCategories?.savings?.ppf || {}).results || [];
        series = data.map((r) => ({ year: r.year, corpus: r.endValue }));
        headlineValue = Math.round(series[series.length - 1]?.corpus || 0);
    } else if (instrumentType === 'NPS') {
        const self = familyMembers.find((m) => m.relation?.toLowerCase() === 'self');
        const proposed = [...stored];
        if (scenario > 0) proposed.push(makeScenarioAlloc(allocType, scenario, startMonth, calendarYear, def));
        const data = computeNPSData(
            proposed, rate, parseFloat(cfg.annuity) || 40, parseFloat(cfg.annuityRate) || 6,
            self, expenseCategories?.savings?.nps || {},
            parseAmount(assetCategories?.retirement?.nps) || 0,
        ).schedule || [];
        series = data.map((r) => ({ year: r.year, corpus: r.endValue }));
        headlineValue = Math.round(series[series.length - 1]?.corpus || 0);
    } else if (instrumentType === 'Fixed Deposit') {
        const rawFD = assetCategories?.investments?.fixedDeposit;
        const baselineFDs = Array.isArray(rawFD) ? rawFD : (rawFD ? [rawFD] : []);
        const proposed = [...stored];
        if (scenario > 0) proposed.push(makeScenarioAlloc(allocType, scenario, startMonth, calendarYear, def));
        const data = computeFDData(proposed, rate, cfg.frequency || 'Quarterly', baselineFDs).schedule || [];
        series = data.map((r) => ({ year: r.year, corpus: (r.endValue || 0) + (r.maturityValue || 0) }));
        headlineValue = Math.round(series.find((r) => r.year === retirementYear)?.corpus || series[series.length - 1]?.corpus || 0);
    } else if (instrumentType === 'Recurring Deposit') {
        const streams = [...stored.map((a) => ({
            id: a.id,
            name: a.name,
            startYear: parseInt(a.startYear, 10) || calendarYear,
            startMonth: parseInt(a.startMonth, 10) || startMonth,
            duration: parseInt(a.duration, 10) || def.defaultDuration,
            amount: parseAmount(a.amount),
            isBaseline: false,
        }))];
        if (scenario > 0) {
            streams.push({
                id: 'scenario-rd',
                name: 'Studio RD',
                startYear: calendarYear,
                startMonth,
                duration: def.defaultDuration,
                amount: scenario * 12,
                isBaseline: false,
            });
        }
        const data = computeRDData(streams, rate).schedule || [];
        series = data.map((r) => ({ year: r.year, corpus: (r.endValue || 0) + (r.maturityValue || 0) }));
        headlineValue = Math.round(series.find((r) => r.year === retirementYear)?.corpus || series[series.length - 1]?.corpus || 0);
    } else {
        const base = proposedLumpsum + scenario;
        series = simpleLumpsumSeries(base, rate, currentYear, retirementYear);
        headlineValue = Math.round(series[series.length - 1]?.corpus || 0);
    }

    const growthSeries = toGrowthSeries(series, 'corpus');
    const goalImpacts = buildGoalImpacts(series, goals, goalMappings, currentYear, def.goalKey, 'corpus');

    return {
        instrumentType,
        inputMode: def.inputMode,
        expectedReturns: rate,
        retirementYear,
        headlineValue,
        proposedMonthly,
        proposedLumpsum,
        scenarioAmount: scenario,
        goalImpacts,
        growthSeries,
        isProtection: def.isProtection || false,
        maxMonthly: def.maxMonthly,
        goalKey: def.goalKey,
    };
}

export function compareInstrumentGoalImpacts(baselineImpacts = [], scenarioImpacts = []) {
    const scenarioByGoal = Object.fromEntries(scenarioImpacts.map((g) => [g.goalId, g]));
    return baselineImpacts.map((base) => {
        const scenario = scenarioByGoal[base.goalId] || base;
        return {
            ...base,
            scenarioProjectedFundedPct: scenario.projectedFundedPct,
            scenarioAvailableAtGoalYear: scenario.availableAtGoalYear,
            projectedFundedDelta: scenario.projectedFundedPct - base.projectedFundedPct,
            corpusDelta: scenario.availableAtGoalYear - base.availableAtGoalYear,
            scenarioShortfall: scenario.projectedShortfall,
        };
    });
}

export function buildGrowthPreview({
    expenseCategories,
    assetCategories,
    investmentAllocations,
    calculatorInputs,
    goalMappings,
    goals,
    familyMembers,
    currentYear,
    draftAllocations = {},
    monthIndex,
}) {
    const retirementYear = getRetirementYear(familyMembers, currentYear);
    const instrumentKeys = STUDIO_INSTRUMENT_TYPES.filter((t) => getDraftTypeAmount(draftAllocations, t) > 0);

    const baselineTotal = STUDIO_INSTRUMENT_TYPES.reduce((sum, type) => {
        const a = analyzeInstrument(type, {
            expenseCategories, assetCategories, investmentAllocations,
            calculatorInputs, goalMappings, goals, familyMembers, currentYear,
        }, 0, monthIndex, currentYear);
        return sum + (a?.headlineValue || 0);
    }, 0);

    const scenarioTotal = STUDIO_INSTRUMENT_TYPES.reduce((sum, type) => {
        const a = analyzeInstrument(type, {
            expenseCategories, assetCategories, investmentAllocations,
            calculatorInputs, goalMappings, goals, familyMembers, currentYear,
        }, getDraftTypeAmount(draftAllocations, type), monthIndex, currentYear);
        return sum + (a?.headlineValue || 0);
    }, 0);

    const rows = instrumentKeys.map((type) => {
        const base = analyzeInstrument(type, {
            expenseCategories, assetCategories, investmentAllocations,
            calculatorInputs, goalMappings, goals, familyMembers, currentYear,
        }, 0, monthIndex, currentYear);
        const scenario = analyzeInstrument(type, {
            expenseCategories, assetCategories, investmentAllocations,
            calculatorInputs, goalMappings, goals, familyMembers, currentYear,
        }, getDraftTypeAmount(draftAllocations, type), monthIndex, currentYear);
        return {
            type,
            baseline: base?.headlineValue || 0,
            scenario: scenario?.headlineValue || 0,
            delta: (scenario?.headlineValue || 0) - (base?.headlineValue || 0),
            draftAmount: getDraftTypeAmount(draftAllocations, type),
        };
    });

    return {
        retirementYear,
        baselineTotal,
        scenarioTotal,
        totalDelta: scenarioTotal - baselineTotal,
        rows,
        hasDraft: instrumentKeys.length > 0,
    };
}

export function applyAllocationPlan({
    investmentAllocations = [],
    draftAllocations = {},
    calendarYear,
    monthIndex,
    /** When set, only replace these instrument types for the month plan; other types are preserved. */
    replaceTypes = null,
}) {
    const planKey = getAllocationPlanKey(calendarYear, monthIndex);
    const startMonth = monthIndex + 1;
    const typesToWrite = Array.isArray(replaceTypes) && replaceTypes.length > 0
        ? replaceTypes.filter((t) => STUDIO_INSTRUMENT_TYPES.includes(t))
        : STUDIO_INSTRUMENT_TYPES;
    const replaceSet = new Set(typesToWrite);

    const filtered = investmentAllocations.filter((a) => {
        if (a.studioPlanKey !== planKey) return true;
        const type = normalizeAllocType(a.type) || a.type;
        return !replaceSet.has(type);
    });
    const additions = [];

    typesToWrite.forEach((instrumentType) => {
        const def = INSTRUMENT_REGISTRY[instrumentType];
        if (!def) return;

        if (instrumentType === LISP_INSTRUMENT_TYPE) {
            const raw = draftAllocations[instrumentType];
            if (isLispDraft(raw)) {
                const premium = Math.round(parseAmount(raw.premium));
                if (premium <= 0 || !raw.insuredMember) return;
                additions.push({
                    id: Date.now() + additions.length,
                    type: def.allocType,
                    name: `Studio ${instrumentType} (${MONTH_LABELS_SHORT[monthIndex]} ${calendarYear})`,
                    amount: premium,
                    startMonth,
                    startYear: calendarYear,
                    duration: parseInt(raw.duration, 10) || def.defaultDuration,
                    expectedReturn: def.defaultRate,
                    frequency: raw.frequency || 'Monthly',
                    insuredMember: raw.insuredMember,
                    studioPlanKey: planKey,
                });
                return;
            }
            // Numeric draft (e.g. AI bundle): keep legacy annual storage
            const monthly = Math.round(parseAmount(raw));
            if (monthly <= 0) return;
            additions.push({
                id: Date.now() + additions.length,
                type: def.allocType,
                name: `Studio ${instrumentType} (${MONTH_LABELS_SHORT[monthIndex]} ${calendarYear})`,
                amount: monthly * 12,
                startMonth,
                startYear: calendarYear,
                duration: def.defaultDuration,
                expectedReturn: def.defaultRate,
                frequency: 'Monthly',
                studioPlanKey: planKey,
            });
            return;
        }

        const amount = draftAllocations[instrumentType] || 0;
        if (amount <= 0) return;
        additions.push({
            id: Date.now() + additions.length,
            type: def.allocType,
            name: `Studio ${instrumentType} (${MONTH_LABELS_SHORT[monthIndex]} ${calendarYear})`,
            amount: def.inputMode === 'monthly' ? amount * 12 : amount,
            startMonth,
            startYear: calendarYear,
            duration: instrumentType === 'PPF'
                ? normalizePpfDuration(def.defaultDuration, PPF_MAX_DURATION_YEARS)
                : def.defaultDuration,
            expectedReturn: def.defaultRate,
            frequency: 'Monthly',
            studioPlanKey: planKey,
        });
    });

    return [...filtered, ...additions];
}

export function clearStudioMonthPlan({
    investmentAllocations = [],
    calendarYear,
    monthIndex,
    /** When set, only clear these instrument types for the month. */
    clearTypes = null,
}) {
    const planKey = getAllocationPlanKey(calendarYear, monthIndex);
    if (!Array.isArray(clearTypes) || clearTypes.length === 0) {
        return investmentAllocations.filter((a) => a.studioPlanKey !== planKey);
    }
    const clearSet = new Set(clearTypes);
    return investmentAllocations.filter((a) => {
        if (a.studioPlanKey !== planKey) return true;
        const type = normalizeAllocType(a.type) || a.type;
        return !clearSet.has(type);
    });
}

export function removeInvestmentAllocationById(investmentAllocations = [], id) {
    return investmentAllocations.filter((a) => a.id !== id);
}

export function pruneAllocationPlansForAllocations(allocationPlans = {}, investmentAllocations = []) {
    const activeKeys = new Set(
        investmentAllocations
            .map((a) => a.studioPlanKey)
            .filter(Boolean),
    );
    const next = {};
    Object.entries(allocationPlans).forEach(([key, plan]) => {
        if (key === '__pymtwGate') {
            next[key] = plan;
            return;
        }
        if (activeKeys.has(key) || plan?.status === 'draft') {
            next[key] = plan;
        }
    });
    return next;
}

export function monthHasStudioPlan(investmentAllocations = [], calendarYear, monthIndex) {
    const planKey = getAllocationPlanKey(calendarYear, monthIndex);
    return investmentAllocations.some((a) => a.studioPlanKey === planKey);
}

export function buildInstrumentAnalysisNarrative(analysis, isScenario = false) {
    if (!analysis) return '';
    const { instrumentType, scenarioAmount, headlineValue, expectedReturns, retirementYear, goalImpacts } = analysis;
    const amtLabel = analysis.inputMode === 'monthly'
        ? `₹${Math.round(scenarioAmount).toLocaleString('en-IN')}/month`
        : `₹${Math.round(scenarioAmount).toLocaleString('en-IN')}`;

    let text = isScenario && scenarioAmount > 0
        ? `Adding ${amtLabel} to ${instrumentType}`
        : `Your current ${instrumentType} path`;

    if (analysis.isProtection) {
        text += ' strengthens family protection and long-term security';
    } else {
        text += ` projects to ₹${headlineValue.toLocaleString('en-IN')} by ${retirementYear} at ${expectedReturns}% p.a.`;
    }

    const topGoal = goalImpacts?.find((g) => g.projectedShortfall > 0);
    if (topGoal && analysis.goalKey) {
        const pct = isScenario ? topGoal.projectedFundedPct : topGoal.projectedFundedPct;
        text += ` ${topGoal.name} (${topGoal.targetYear}) reaches ${pct}% SIP-path coverage.`;
    }

    return text;
}
