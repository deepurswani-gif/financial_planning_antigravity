import { computeSIPData } from '../Calculators/SIPCalculator';
import { computeLumpsumData } from '../Calculators/LumpsumCalculator';
import { computeEquityData } from '../Calculators/EquityCalculator';
import { computePPFData } from '../Calculators/PPFCalculator';
import { computeNPSData } from '../Calculators/NPSCalculator';
import { computeFDData } from '../Calculators/FDCalculator';
import { computeRDData } from '../Calculators/RDCalculator';
import { calculateYearlyInsuranceSummary } from '../InsuranceModule/InsuranceLogic';
import { MONTH_LABELS_LONG } from './moneyFlowLedgerLogic';

const parseAmount = (value) => parseFloat(value) || 0;

const GROWTH_AVENUE_ORDER = ['sip', 'equity', 'lumpsum'];
const RETIREMENT_AVENUE_ORDER = ['ppf', 'nps'];
const MATURITY_AVENUE_ORDER = ['fd', 'rd', 'insurance'];

const AVENUE_LABELS = {
    sip: 'SIP',
    equity: 'Direct Equity & ETFs',
    lumpsum: 'Lumpsum Mutual Fund',
    ppf: 'PPF',
    nps: 'NPS',
    fd: 'Fixed Deposit',
    rd: 'Recurring Deposit',
    insurance: 'Life Insurance (Endowment)',
};

export function isRetirementGoal(goal = {}) {
    const id = String(goal.id || '').toLowerCase();
    const name = String(goal.name || goal.placeholder || '').toLowerCase();
    const templateId = String(goal.templateId || '').toLowerCase();
    return id === 'retirement'
        || id.startsWith('retirement')
        || templateId === 'retirement'
        || name.includes('retirement');
}

export function getGoalFutureValue(goal = {}) {
    if (goal.futureValue != null && goal.futureValue !== '') {
        return Math.round(parseAmount(goal.futureValue));
    }
    const pv = parseAmount(goal.presentValue);
    const years = parseAmount(goal.yearsToGoal);
    const rawInflation = goal.inflationRate;
    const inflation = (rawInflation === undefined || rawInflation === null || rawInflation === '')
        ? 6
        : parseAmount(rawInflation);
    return Math.round(pv * Math.pow(1 + inflation / 100, years));
}

export function getGoalTargetYear(goal = {}, asOfYear = new Date().getFullYear()) {
    return asOfYear + Math.round(parseAmount(goal.yearsToGoal));
}

export function monthKeyForAllocation(item = {}) {
    if (item.studioPlanKey) return item.studioPlanKey;
    const startYear = parseInt(item.startYear, 10);
    const startMonth = parseInt(item.startMonth, 10);
    if (Number.isFinite(startYear) && Number.isFinite(startMonth) && startMonth >= 1 && startMonth <= 12) {
        return `${startYear}-${startMonth - 1}`;
    }
    return null;
}

export function labelForPlanKey(planKey) {
    if (!planKey || typeof planKey !== 'string') return 'This month';
    const [yearStr, monthStr] = planKey.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10);
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return planKey;
    const monthLabel = MONTH_LABELS_LONG[monthIndex] || 'Month';
    return `${monthLabel} ${year}`;
}

/** Distinct planned months from PYMTW applied allocations, sorted chronologically. */
export function derivePlannedMonths(investmentAllocations = []) {
    const seen = new Set();
    const months = [];
    (investmentAllocations || []).forEach((item) => {
        const key = monthKeyForAllocation(item);
        if (!key || seen.has(key)) return;
        seen.add(key);
        months.push({
            key,
            label: labelForPlanKey(key),
            monthLabel: labelForPlanKey(key).replace(/\s+\d{4}$/, ''),
        });
    });
    months.sort((a, b) => {
        const [ay, am] = a.key.split('-').map(Number);
        const [by, bm] = b.key.split('-').map(Number);
        return (ay - by) || (am - bm);
    });
    return months;
}

export function buildPlannedMonthsNotice(plannedMonths = []) {
    if (!plannedMonths.length) {
        return 'Complete Put Your Money to Work to include surplus allocations in this report.';
    }
    const labels = plannedMonths.map((m) => m.monthLabel || m.label);
    if (labels.length === 1) {
        return `Outcomes of this report include your planning for the month of ${labels[0]}.`;
    }
    if (labels.length === 2) {
        return `Outcomes of this report include your planning for the months of ${labels[0]} and ${labels[1]}.`;
    }
    const head = labels.slice(0, -1).join(', ');
    const tail = labels[labels.length - 1];
    return `Outcomes of this report include your planning for the months of ${head}, and ${tail}.`;
}

function valueAtYear(schedule = [], year, valueField = 'valueAfterWithdrawal') {
    if (!schedule.length) return 0;
    const exact = schedule.find((row) => row.year === year);
    if (exact) return Math.round(parseAmount(exact[valueField]));
    const prior = [...schedule].filter((row) => row.year <= year).sort((a, b) => b.year - a.year)[0];
    if (prior) return Math.round(parseAmount(prior[valueField]));
    return 0;
}

function maturityAtYear(schedule = [], year) {
    if (!schedule.length) return 0;
    const exact = schedule.find((row) => row.year === year);
    if (!exact) return 0;
    return Math.round(parseAmount(exact.maturityValue));
}

function filterStudioAllocations(investmentAllocations = [], types = []) {
    const typeSet = new Set(types);
    return (investmentAllocations || []).filter((a) => typeSet.has(a.type) && a.studioPlanKey);
}

function normalizeBaselineRdStreams(expenseCategories = {}, asOfYear, asOfMonth) {
    const raw = expenseCategories?.savings?.rd;
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((item, idx) => {
        const amount = parseAmount(item?.amount !== undefined ? item.amount : item);
        if (amount <= 0) return null;
        return {
            id: `baseline-rd-${idx}`,
            name: item?.name || 'Existing RD',
            startYear: parseInt(item?.startYear, 10) || asOfYear,
            startMonth: parseInt(item?.startMonth, 10) || asOfMonth,
            duration: parseInt(item?.duration, 10) || 5,
            amount,
            isBaseline: true,
        };
    }).filter(Boolean);
}

function buildInsuranceMaturitiesByYear(policies = []) {
    const summary = calculateYearlyInsuranceSummary(policies || []);
    const byYear = {};
    summary.forEach((row) => {
        const total = (row.maturities || []).reduce((sum, m) => sum + parseAmount(m.amount), 0);
        if (total > 0) byYear[row.year] = Math.round(total);
    });
    return byYear;
}

/**
 * Project growth / maturity pools for baseline (no PYMTW) and enhanced (with PYMTW).
 * Today's corpus at as-of = current holdings; schedules project forward from as-of year.
 */
export function buildAvenueSchedules({
    expenseCategories = {},
    assetCategories = {},
    calculatorInputs = {},
    investmentAllocations = [],
    familyMembers = [],
    policies = [],
    asOfYear = new Date().getFullYear(),
    asOfMonth = new Date().getMonth() + 1,
    tenureYears = 50,
} = {}) {
    const sipRate = parseAmount(calculatorInputs.sip?.rate) || 12;
    const sipEvents = calculatorInputs.sip?.events || calculatorInputs.sip?.increments || [];
    const monthlySip = parseAmount(
        expenseCategories?.savings?.sip?.amount !== undefined
            ? expenseCategories.savings.sip.amount
            : expenseCategories?.savings?.sip,
    );
    const mfCorpus = parseAmount(assetCategories?.investments?.mutualFunds)
        || parseAmount(assetCategories?.equity?.mfEquity)
        || parseAmount(assetCategories?.equity?.stocks)
        || 0;

    const equityRate = parseAmount(calculatorInputs.equity?.rate) || 15;
    const equityEvents = calculatorInputs.equity?.events || [];
    const equityCorpus = parseAmount(assetCategories?.investments?.equity)
        || parseAmount(assetCategories?.equity?.stocks)
        || 0;

    const lumpsumCfg = calculatorInputs.lumpsum || {};
    const lumpsumBase = parseAmount(lumpsumCfg.amount);
    const lumpsumRate = parseAmount(lumpsumCfg.rate) || 12;
    const lumpsumEvents = lumpsumCfg.events || [];

    const ppfRate = parseAmount(calculatorInputs.ppf?.rate) || 7.1;
    const npsCfg = calculatorInputs.nps || {};
    const npsRate = parseAmount(npsCfg.rate) || 10;
    const npsCorpus = parseAmount(assetCategories?.retirement?.nps);
    const selfMember = (familyMembers || []).find((m) => m.relation?.toLowerCase() === 'self');

    const fdCfg = calculatorInputs.fd || {};
    const fdRate = parseAmount(fdCfg.rate) || 7;
    const fdFrequency = fdCfg.frequency || 'Quarterly';
    const rawFD = assetCategories?.investments?.fixedDeposit;
    const baselineFDs = Array.isArray(rawFD) ? rawFD : (rawFD ? [rawFD] : []);

    const rdRate = parseAmount(calculatorInputs.rd?.rate) || 7;
    const baselineRDs = normalizeBaselineRdStreams(expenseCategories, asOfYear, asOfMonth);

    const proposedSip = filterStudioAllocations(investmentAllocations, ['SIP']);
    const proposedEquity = filterStudioAllocations(investmentAllocations, ['Direct Equity & ETFs']);
    const proposedLumpsum = filterStudioAllocations(investmentAllocations, ['Lumpsum', 'Lump Sum']);
    const proposedPpf = filterStudioAllocations(investmentAllocations, ['PPF']);
    const proposedNps = filterStudioAllocations(investmentAllocations, ['NPS']);
    const proposedFd = filterStudioAllocations(investmentAllocations, ['Fixed Deposit']);
    const proposedRd = filterStudioAllocations(investmentAllocations, ['Recurring Deposit', 'RD']).map((a) => ({
        id: a.id,
        name: a.name,
        startYear: parseInt(a.startYear, 10) || asOfYear,
        startMonth: parseInt(a.startMonth, 10) || asOfMonth,
        duration: parseInt(a.duration, 10) || 5,
        amount: parseAmount(a.amount),
        isBaseline: false,
    }));

    const baselineSip = computeSIPData(
        asOfYear, monthlySip, sipRate, tenureYears, mfCorpus, sipEvents, [], {}, [],
    );
    const enhancedSip = computeSIPData(
        asOfYear, monthlySip, sipRate, tenureYears, mfCorpus, sipEvents, proposedSip, {}, [],
    );

    const baselineEquity = computeEquityData(
        equityCorpus, equityRate, tenureYears, asOfMonth, asOfYear, equityEvents, [], {}, [],
    );
    const enhancedEquity = computeEquityData(
        equityCorpus, equityRate, tenureYears, asOfMonth, asOfYear, equityEvents, proposedEquity, {}, [],
    );

    const baselineLumpsum = computeLumpsumData(
        lumpsumBase, lumpsumRate, tenureYears, asOfMonth, asOfYear, lumpsumEvents, [], {}, [],
    );
    const enhancedLumpsum = computeLumpsumData(
        lumpsumBase, lumpsumRate, tenureYears, asOfMonth, asOfYear, lumpsumEvents, proposedLumpsum, {}, [],
    );

    const baselinePpf = computePPFData([], ppfRate, expenseCategories?.savings?.ppf || {}).results || [];
    const enhancedPpf = computePPFData(proposedPpf, ppfRate, expenseCategories?.savings?.ppf || {}).results || [];

    const baselineNps = computeNPSData(
        [], npsRate, parseAmount(npsCfg.annuity) || 40, parseAmount(npsCfg.annuityRate) || 6,
        selfMember, expenseCategories?.savings?.nps || {}, npsCorpus,
    ).schedule || [];
    const enhancedNps = computeNPSData(
        proposedNps, npsRate, parseAmount(npsCfg.annuity) || 40, parseAmount(npsCfg.annuityRate) || 6,
        selfMember, expenseCategories?.savings?.nps || {}, npsCorpus,
    ).schedule || [];

    const baselineFd = computeFDData([], fdRate, fdFrequency, baselineFDs).schedule || [];
    const enhancedFd = computeFDData(proposedFd, fdRate, fdFrequency, baselineFDs).schedule || [];

    const baselineRd = computeRDData(baselineRDs, rdRate).schedule || [];
    const enhancedRd = computeRDData([...baselineRDs, ...proposedRd], rdRate).schedule || [];

    const insuranceByYear = buildInsuranceMaturitiesByYear(policies);

    const asOfCorpus = {
        sip: Math.round(mfCorpus),
        equity: Math.round(equityCorpus),
        lumpsum: Math.round(lumpsumBase),
        ppf: Math.round(parseAmount(assetCategories?.retirement?.ppf)),
        nps: Math.round(npsCorpus),
        total: 0,
    };
    asOfCorpus.total = asOfCorpus.sip + asOfCorpus.equity + asOfCorpus.lumpsum
        + asOfCorpus.ppf + asOfCorpus.nps;

    return {
        asOfCorpus,
        growth: {
            sip: { baseline: baselineSip, enhanced: enhancedSip, field: 'valueAfterWithdrawal' },
            equity: { baseline: baselineEquity, enhanced: enhancedEquity, field: 'valueAfterWithdrawal' },
            lumpsum: { baseline: baselineLumpsum, enhanced: enhancedLumpsum, field: 'valueAfterWithdrawal' },
            ppf: { baseline: baselinePpf, enhanced: enhancedPpf, field: 'endValue' },
            nps: { baseline: baselineNps, enhanced: enhancedNps, field: 'endValue' },
        },
        maturity: {
            fd: { baseline: baselineFd, enhanced: enhancedFd },
            rd: { baseline: baselineRd, enhanced: enhancedRd },
            insurance: { byYear: insuranceByYear },
        },
    };
}

/**
 * Nearest-first: walk goals ascending by year; assign min(need, available) per avenue;
 * later goals only receive the remainder of each growth pool.
 */
export function assignNearestFirst({
    goals = [],
    schedules,
    asOfYear = new Date().getFullYear(),
} = {}) {
    const sorted = [...goals]
        .filter((g) => getGoalFutureValue(g) > 0)
        .sort((a, b) => getGoalTargetYear(a, asOfYear) - getGoalTargetYear(b, asOfYear));

    const consumedBaseline = {
        sip: 0, equity: 0, lumpsum: 0, ppf: 0, nps: 0,
    };
    const consumedEnhanced = {
        sip: 0, equity: 0, lumpsum: 0, ppf: 0, nps: 0,
    };

    return sorted.map((goal) => {
        const targetYear = getGoalTargetYear(goal, asOfYear);
        const futureValue = getGoalFutureValue(goal);
        const retirement = isRetirementGoal(goal);

        const growthKeys = [
            ...GROWTH_AVENUE_ORDER,
            ...(retirement ? RETIREMENT_AVENUE_ORDER : []),
        ];

        const avenues = [];
        let todayCorpus = 0;
        let afterAllocation = 0;
        let remainingNeedBaseline = futureValue;
        let remainingNeedEnhanced = futureValue;

        growthKeys.forEach((key) => {
            const pack = schedules.growth[key];
            if (!pack) return;

            const projectedEnhanced = valueAtYear(pack.enhanced, targetYear, pack.field);
            const poolBaseline = Math.max(
                0,
                valueAtYear(pack.baseline, targetYear, pack.field) - consumedBaseline[key],
            );
            const poolEnhanced = Math.max(0, projectedEnhanced - consumedEnhanced[key]);

            const todayValue = Math.min(remainingNeedBaseline, poolBaseline);
            const afterValue = Math.min(remainingNeedEnhanced, poolEnhanced);

            consumedBaseline[key] += todayValue;
            consumedEnhanced[key] += afterValue;
            remainingNeedBaseline -= todayValue;
            remainingNeedEnhanced -= afterValue;
            todayCorpus += todayValue;
            afterAllocation += afterValue;

            if (todayValue > 0 || afterValue > 0 || poolBaseline > 0 || poolEnhanced > 0) {
                avenues.push({
                    id: key,
                    type: AVENUE_LABELS[key],
                    kind: 'growth',
                    todayValue,
                    afterValue,
                    currentValue: Math.round(projectedEnhanced),
                    poolBaseline,
                    poolEnhanced,
                });
            }
        });

        MATURITY_AVENUE_ORDER.forEach((key) => {
            let todayValue = 0;
            let afterValue = 0;
            let currentValue = 0;

            if (key === 'insurance') {
                const mat = schedules.maturity.insurance.byYear[targetYear] || 0;
                currentValue = mat;
                todayValue = Math.min(remainingNeedBaseline, mat);
                afterValue = Math.min(remainingNeedEnhanced, mat);
            } else {
                const pack = schedules.maturity[key];
                const baseMat = maturityAtYear(pack.baseline, targetYear);
                const enhMat = maturityAtYear(pack.enhanced, targetYear);
                currentValue = enhMat;
                todayValue = Math.min(remainingNeedBaseline, baseMat);
                afterValue = Math.min(remainingNeedEnhanced, enhMat);
            }

            if (todayValue <= 0 && afterValue <= 0) return;

            remainingNeedBaseline -= todayValue;
            remainingNeedEnhanced -= afterValue;
            todayCorpus += todayValue;
            afterAllocation += afterValue;

            avenues.push({
                id: key,
                type: AVENUE_LABELS[key],
                kind: 'maturity',
                todayValue,
                afterValue,
                currentValue: Math.round(currentValue),
            });
        });

        const shortfall = Math.max(0, Math.round(futureValue - afterAllocation));

        return {
            goalId: goal.id,
            name: goal.name || goal.placeholder || 'Goal',
            targetYear,
            futureValue,
            isRetirement: retirement,
            todayCorpus: Math.round(todayCorpus),
            afterAllocation: Math.round(afterAllocation),
            shortfall,
            fundedPct: futureValue > 0
                ? Math.min(100, Math.round((afterAllocation / futureValue) * 100))
                : 0,
            avenues,
        };
    });
}

export function buildTrackSurplusAllocationReport({
    goals = [],
    expenseCategories = {},
    assetCategories = {},
    calculatorInputs = {},
    investmentAllocations = [],
    familyMembers = [],
    policies = [],
    asOfDate = new Date(),
} = {}) {
    const asOfYear = asOfDate.getFullYear();
    const asOfMonth = asOfDate.getMonth() + 1;
    const asOfMonthIndex = asOfDate.getMonth();
    const asOfMonthLabel = MONTH_LABELS_LONG[asOfMonthIndex] || 'This month';

    const plannedMonths = derivePlannedMonths(investmentAllocations);
    const plannedMonthsNotice = buildPlannedMonthsNotice(plannedMonths);
    const hasPymtwPlans = plannedMonths.length > 0;

    const activeGoals = (goals || []).filter((g) => getGoalFutureValue(g) > 0);
    const farthestYears = activeGoals.reduce((max, g) => {
        const y = getGoalTargetYear(g, asOfYear) - asOfYear;
        return Math.max(max, y);
    }, 10);
    const tenureYears = Math.max(15, farthestYears + 2);

    const schedules = buildAvenueSchedules({
        expenseCategories,
        assetCategories,
        calculatorInputs,
        investmentAllocations,
        familyMembers,
        policies,
        asOfYear,
        asOfMonth,
        tenureYears,
    });

    const goalCards = assignNearestFirst({
        goals: activeGoals,
        schedules,
        asOfYear,
    });

    const totals = goalCards.reduce((acc, card) => {
        acc.todayCorpus += card.todayCorpus;
        acc.afterAllocation += card.afterAllocation;
        acc.futureValue += card.futureValue;
        acc.shortfall += card.shortfall;
        return acc;
    }, { todayCorpus: 0, afterAllocation: 0, futureValue: 0, shortfall: 0 });

    return {
        meta: {
            asOfYear,
            asOfMonth,
            asOfMonthIndex,
            asOfMonthLabel,
            asOfLabel: `${asOfMonthLabel} ${asOfYear}`,
            hasPymtwPlans,
            hasGoals: goalCards.length > 0,
            plannedMonthsNotice,
        },
        plannedMonths,
        asOfCorpus: schedules.asOfCorpus,
        totals,
        goalCards,
    };
}
