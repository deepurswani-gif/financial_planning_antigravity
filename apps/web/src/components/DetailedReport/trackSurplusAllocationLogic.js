import { computeSIPData } from '../Calculators/SIPCalculator';
import { computeLumpsumData } from '../Calculators/LumpsumCalculator';
import { computeEquityData } from '../Calculators/EquityCalculator';
import { computePPFData } from '../Calculators/PPFCalculator';
import { computeNPSData } from '../Calculators/NPSCalculator';
import { computeFDData } from '../Calculators/FDCalculator';
import { computeRDData } from '../Calculators/RDCalculator';
import { calculateYearlyInsuranceSummary } from '../InsuranceModule/InsuranceLogic';
import { MONTH_LABELS_LONG } from './moneyFlowLedgerLogic';
import { computeAllocationImpactForMonth } from './putYourMoneyToWorkLogic';

/**
 * Your Money's Magic — downstream consumer only.
 *
 * Locked ownership rules:
 * - Money Flow, Journey and Put Your Money To Work own their own calculations. This module
 *   must never modify or replace their outputs; it only consumes them and derives additional
 *   goal-funding projections.
 * - Corpus reduction after a goal is funded is delegated to the existing calculator engines
 *   through goalMappings. No withdrawal engine lives here.
 * - Surplus is never recalculated: current-year surplus comes from the Money Flow ledger and
 *   future-year surplus comes from Journey projections.
 */

const parseAmount = (value) => parseFloat(value) || 0;

const GROWTH_AVENUE_ORDER = ['sip', 'equity', 'lumpsum'];
const RETIREMENT_AVENUE_ORDER = ['ppf', 'nps'];
const MATURITY_AVENUE_ORDER = ['fd', 'rd', 'insurance'];

/** Avenues whose corpus reduction is performed inside the calculator engines via goalMappings. */
export const ENGINE_WITHDRAWAL_AVENUES = ['sip', 'equity', 'lumpsum'];
const ENGINE_WITHDRAWAL_SET = new Set(ENGINE_WITHDRAWAL_AVENUES);

/** Internal engine name: Residual Growth Pool. User-facing name: Future Invested Surplus. */
export const FUTURE_SURPLUS_AVENUE_ID = 'futureSurplus';
export const RESIDUAL_POOL_RATE = 0.10;
export const CUSTOMIZABLE_ALLOCATION_AVENUES = [
    FUTURE_SURPLUS_AVENUE_ID,
    ...ENGINE_WITHDRAWAL_AVENUES,
];

/** Single wealth scenario: existing + PYMTW + residual pool. */
export const SCENARIO_WEALTH = 'wealth';

/** @deprecated Kept for any transitional imports; prefer SCENARIO_WEALTH. */
export const SCENARIO_BASELINE = 'baseline';
/** @deprecated Prefer SCENARIO_WEALTH. */
export const SCENARIO_PLAN = 'plan';
/** @deprecated Prefer SCENARIO_WEALTH. */
export const SCENARIO_MAXIMUM = 'maximum';

/** Stable goal accent palette — one colour identity per goal, not per scenario. */
export const GOAL_ACCENT_PALETTE = [
    { id: 'blue', hex: '#2563eb', soft: 'rgba(37, 99, 235, 0.10)', ink: '#1d4ed8' },
    { id: 'amber', hex: '#d97706', soft: 'rgba(217, 119, 6, 0.10)', ink: '#b45309' },
    { id: 'violet', hex: '#7c3aed', soft: 'rgba(124, 58, 237, 0.10)', ink: '#6d28d9' },
    { id: 'emerald', hex: '#059669', soft: 'rgba(5, 150, 105, 0.10)', ink: '#047857' },
    { id: 'rose', hex: '#e11d48', soft: 'rgba(225, 29, 72, 0.10)', ink: '#be123c' },
    { id: 'cyan', hex: '#0891b2', soft: 'rgba(8, 145, 178, 0.10)', ink: '#0e7490' },
    { id: 'indigo', hex: '#4f46e5', soft: 'rgba(79, 70, 229, 0.10)', ink: '#4338ca' },
    { id: 'teal', hex: '#0d9488', soft: 'rgba(13, 148, 136, 0.10)', ink: '#0f766e' },
];

/** Keep only SIP / Equity / Lumpsum keys for engine-backed planning state. */
export function sanitizeEngineMappings(goalMappings = {}) {
    const cleaned = {};
    Object.entries(goalMappings || {}).forEach(([goalId, mapping]) => {
        if (!mapping || typeof mapping !== 'object') return;
        const next = {};
        ENGINE_WITHDRAWAL_AVENUES.forEach((key) => {
            const amount = Math.round(parseAmount(mapping[key]));
            if (amount > 0) next[key] = amount;
        });
        if (Object.keys(next).length > 0) cleaned[goalId] = next;
    });
    return cleaned;
}

/** Keep editable YMM allocation keys, including an explicit zero residual override. */
export function sanitizePlanningMappings(goalMappings = {}) {
    const cleaned = {};
    Object.entries(goalMappings || {}).forEach(([goalId, mapping]) => {
        if (!mapping || typeof mapping !== 'object') return;
        const next = {};
        ENGINE_WITHDRAWAL_AVENUES.forEach((key) => {
            const amount = Math.round(parseAmount(mapping[key]));
            if (amount > 0) next[key] = amount;
        });
        if (Object.prototype.hasOwnProperty.call(mapping, FUTURE_SURPLUS_AVENUE_ID)) {
            next[FUTURE_SURPLUS_AVENUE_ID] = Math.max(
                0,
                Math.round(parseAmount(mapping[FUTURE_SURPLUS_AVENUE_ID])),
            );
        }
        if (Object.keys(next).length > 0) cleaned[goalId] = next;
    });
    return cleaned;
}

export function mergeGoalMapping(existingMappings = {}, goalId, avenueAmounts = {}) {
    const next = { ...sanitizePlanningMappings(existingMappings) };
    const cleaned = {};
    ENGINE_WITHDRAWAL_AVENUES.forEach((key) => {
        const amount = Math.round(parseAmount(avenueAmounts[key]));
        if (amount > 0) cleaned[key] = amount;
    });
    if (Object.prototype.hasOwnProperty.call(avenueAmounts, FUTURE_SURPLUS_AVENUE_ID)) {
        cleaned[FUTURE_SURPLUS_AVENUE_ID] = Math.max(
            0,
            Math.round(parseAmount(avenueAmounts[FUTURE_SURPLUS_AVENUE_ID])),
        );
    }
    if (Object.keys(cleaned).length === 0) {
        delete next[goalId];
    } else {
        next[goalId] = cleaned;
    }
    return next;
}

export function buildApplyPayload(goalId, avenueAmounts = {}) {
    const mapping = {};
    ENGINE_WITHDRAWAL_AVENUES.forEach((key) => {
        const amount = Math.round(parseAmount(avenueAmounts[key]));
        if (amount > 0) mapping[key] = amount;
    });
    if (Object.prototype.hasOwnProperty.call(avenueAmounts, FUTURE_SURPLUS_AVENUE_ID)) {
        mapping[FUTURE_SURPLUS_AVENUE_ID] = Math.max(
            0,
            Math.round(parseAmount(avenueAmounts[FUTURE_SURPLUS_AVENUE_ID])),
        );
    }
    return { goalId, mapping };
}

export function clampAvenueAmount(amount, availableMax) {
    const value = Math.round(parseAmount(amount));
    const max = Math.max(0, Math.round(parseAmount(availableMax)));
    if (value <= 0) return 0;
    return Math.min(value, max);
}

const AVENUE_LABELS = {
    sip: 'SIP',
    equity: 'Direct Equity & ETFs',
    lumpsum: 'Lumpsum Mutual Fund',
    ppf: 'PPF',
    nps: 'NPS',
    fd: 'Fixed Deposit',
    rd: 'Recurring Deposit',
    insurance: 'Life Insurance (Endowment)',
    [FUTURE_SURPLUS_AVENUE_ID]: 'Accumulated surplus not yet invested',
};

export function avenueLabel(avenueId) {
    return AVENUE_LABELS[avenueId] || avenueId;
}

export function scenarioLabel(scenarioId, targetYear) {
    return `Your Wealth by ${targetYear}`;
}

export function scenarioDescription(scenarioId) {
    return 'Existing investments, planned surplus investments, and accumulated surplus';
}

/**
 * Build a per-goal residual calculation summary for Customize expandable UI.
 * Collapses yearly unallocated surplus into one "Surplus till {goalYear}" line.
 */
export function buildResidualBreakdownForGoal({
    goalId,
    targetYear,
    residualDraw = 0,
    totalAvailable = residualDraw,
    contributionsByYear = {},
    timeline = [],
    asOfYear = new Date().getFullYear(),
    residualRatePct = Math.round(RESIDUAL_POOL_RATE * 100),
} = {}) {
    const yearsUpToGoal = Object.entries(contributionsByYear)
        .filter(([year]) => {
            const y = parseInt(year, 10);
            return Number.isFinite(y) && y >= asOfYear && y <= targetYear;
        });
    const surplusTillGoal = yearsUpToGoal.reduce(
        (sum, [, amount]) => sum + Math.max(0, Math.round(parseAmount(amount))),
        0,
    );

    const relevantTimeline = (timeline || []).filter((row) => row.year <= targetYear);
    const growthTillGoal = relevantTimeline.reduce((sum, row) => sum + (row.growth || 0), 0);
    const maturityTillGoal = relevantTimeline.reduce((sum, row) => sum + (row.maturityAdded || 0), 0);

    let drawnByEarlierGoals = 0;
    let reachedThisGoal = false;
    relevantTimeline.forEach((row) => {
        (row.goalDraws || []).forEach((d) => {
            if (reachedThisGoal) return;
            if (goalId && d.goalId === goalId) {
                reachedThisGoal = true;
                return;
            }
            drawnByEarlierGoals += d.amount || 0;
        });
    });

    return {
        targetYear,
        residualDraw: Math.round(residualDraw),
        residualRatePct,
        surplusTillGoal: Math.round(surplusTillGoal),
        surplusTillLabel: `Surplus till ${targetYear}`,
        growthTillGoal: Math.round(growthTillGoal),
        maturityTillGoal: Math.round(maturityTillGoal),
        drawnByEarlierGoals: Math.round(drawnByEarlierGoals),
        totalAvailable: Math.round(totalAvailable),
        lines: [
            {
                id: 'surplus',
                label: `Surplus till ${targetYear}`,
                amount: Math.round(surplusTillGoal),
            },
            {
                id: 'growth',
                label: `Growth at ${residualRatePct}%`,
                amount: Math.round(growthTillGoal),
            },
            {
                id: 'maturity',
                label: 'Unused FD / RD / Insurance maturities',
                amount: Math.round(maturityTillGoal),
            },
            {
                id: 'earlier',
                label: 'Used by earlier goals',
                amount: Math.round(drawnByEarlierGoals),
            },
            {
                id: 'drawn',
                label: 'Allocated to this goal',
                amount: Math.round(residualDraw),
            },
            {
                id: 'total',
                label: 'Total amount available for this goal',
                amount: Math.round(totalAvailable),
            },
        ].filter((line) => line.amount > 0 || line.id === 'drawn' || line.id === 'total'),
    };
}

export function isRetirementGoal(goal = {}) {
    const id = String(goal.id || '').toLowerCase();
    const name = String(goal.name || goal.placeholder || '').toLowerCase();
    const templateId = String(goal.templateId || '').toLowerCase();
    return id === 'retirement'
        || id.startsWith('retirement')
        || templateId === 'retirement'
        || name.includes('retirement');
}

export function pickGoalAccent(goal = {}, index = 0) {
    if (isRetirementGoal(goal)) {
        return GOAL_ACCENT_PALETTE.find((p) => p.id === 'emerald') || GOAL_ACCENT_PALETTE[3];
    }
    const name = String(goal.name || goal.placeholder || '').toLowerCase();
    if (name.includes('car') || name.includes('bike') || name.includes('vehicle')) {
        return GOAL_ACCENT_PALETTE[0];
    }
    if (name.includes('educat') || name.includes('school') || name.includes('college')) {
        return GOAL_ACCENT_PALETTE[1];
    }
    if (name.includes('house') || name.includes('home') || name.includes('flat') || name.includes('property')) {
        return GOAL_ACCENT_PALETTE[2];
    }
    if (name.includes('marri') || name.includes('wedding')) {
        return GOAL_ACCENT_PALETTE[4];
    }
    if (name.includes('tour') || name.includes('travel') || name.includes('holiday') || name.includes('vacation')) {
        return GOAL_ACCENT_PALETTE[5];
    }
    return GOAL_ACCENT_PALETTE[index % GOAL_ACCENT_PALETTE.length];
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

function parseMonthKey(planKey) {
    if (!planKey || typeof planKey !== 'string') return null;
    const [yearStr, monthStr] = planKey.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10);
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return null;
    return { year, monthIndex };
}

export function labelForPlanKey(planKey) {
    const parsed = parseMonthKey(planKey);
    if (!planKey || typeof planKey !== 'string') return 'This month';
    if (!parsed) return planKey;
    const monthLabel = MONTH_LABELS_LONG[parsed.monthIndex] || 'Month';
    return `${monthLabel} ${parsed.year}`;
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

export function computeAsOfCorpus({ assetCategories = {}, calculatorInputs = {} } = {}) {
    const mfCorpus = parseAmount(assetCategories?.investments?.mutualFunds)
        || parseAmount(assetCategories?.equity?.mfEquity)
        || parseAmount(assetCategories?.equity?.stocks)
        || 0;
    const equityCorpus = parseAmount(assetCategories?.investments?.equity)
        || parseAmount(assetCategories?.equity?.stocks)
        || 0;
    const corpus = {
        sip: Math.round(mfCorpus),
        equity: Math.round(equityCorpus),
        lumpsum: Math.round(parseAmount(calculatorInputs?.lumpsum?.amount)),
        ppf: Math.round(parseAmount(assetCategories?.retirement?.ppf)),
        nps: Math.round(parseAmount(assetCategories?.retirement?.nps)),
        total: 0,
    };
    corpus.total = corpus.sip + corpus.equity + corpus.lumpsum + corpus.ppf + corpus.nps;
    return corpus;
}

/**
 * Project a single funding variant.
 *
 * @param {boolean} includeProposedAllocations - false = existing investments and commitments only
 *   (Scenario 1 baseline); true = including Put Your Money To Work allocations.
 * @param {object} goalMappings - calculation-state assignments, shaped exactly like the persistent
 *   planning state so the existing engines apply the goal-year withdrawal themselves.
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
    includeProposedAllocations = true,
    goalMappings = {},
    goals = [],
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

    const studio = (types) => (
        includeProposedAllocations ? filterStudioAllocations(investmentAllocations, types) : []
    );

    const proposedSip = studio(['SIP']);
    const proposedEquity = studio(['Direct Equity & ETFs']);
    const proposedLumpsum = studio(['Lumpsum', 'Lump Sum']);
    const proposedPpf = studio(['PPF']);
    const proposedNps = studio(['NPS']);
    const proposedFd = studio(['Fixed Deposit']);
    const proposedRd = studio(['Recurring Deposit', 'RD']).map((a) => ({
        id: a.id,
        name: a.name,
        startYear: parseInt(a.startYear, 10) || asOfYear,
        startMonth: parseInt(a.startMonth, 10) || asOfMonth,
        duration: parseInt(a.duration, 10) || 5,
        amount: parseAmount(a.amount),
        isBaseline: false,
    }));

    const sipSchedule = computeSIPData(
        asOfYear, monthlySip, sipRate, tenureYears, mfCorpus, sipEvents, proposedSip, goalMappings, goals,
    );
    const equitySchedule = computeEquityData(
        equityCorpus, equityRate, tenureYears, asOfMonth, asOfYear, equityEvents, proposedEquity, goalMappings, goals,
    );
    const lumpsumSchedule = computeLumpsumData(
        lumpsumBase, lumpsumRate, tenureYears, asOfMonth, asOfYear, lumpsumEvents, proposedLumpsum, goalMappings, goals,
    );
    const ppfSchedule = computePPFData(proposedPpf, ppfRate, expenseCategories?.savings?.ppf || {}).results || [];
    const npsSchedule = computeNPSData(
        proposedNps, npsRate, parseAmount(npsCfg.annuity) || 40, parseAmount(npsCfg.annuityRate) || 6,
        selfMember, expenseCategories?.savings?.nps || {}, npsCorpus,
    ).schedule || [];
    const fdSchedule = computeFDData(proposedFd, fdRate, fdFrequency, baselineFDs).schedule || [];
    const rdSchedule = computeRDData([...baselineRDs, ...proposedRd], rdRate).schedule || [];

    return {
        growth: {
            sip: { schedule: sipSchedule, field: 'valueAfterWithdrawal' },
            equity: { schedule: equitySchedule, field: 'valueAfterWithdrawal' },
            lumpsum: { schedule: lumpsumSchedule, field: 'valueAfterWithdrawal' },
            ppf: { schedule: ppfSchedule, field: 'endValue' },
            nps: { schedule: npsSchedule, field: 'endValue' },
        },
        maturity: {
            fd: { schedule: fdSchedule },
            rd: { schedule: rdSchedule },
            insurance: { byYear: buildInsuranceMaturitiesByYear(policies) },
        },
    };
}

export function sortGoalsNearestFirst(goals = [], asOfYear = new Date().getFullYear()) {
    return [...goals]
        .filter((g) => getGoalFutureValue(g) > 0)
        .sort((a, b) => getGoalTargetYear(a, asOfYear) - getGoalTargetYear(b, asOfYear));
}

function collectMaturityTotals(schedules, years) {
    const totals = {};
    years.forEach((year) => {
        totals[year] = {
            fd: maturityAtYear(schedules.maturity.fd.schedule, year),
            rd: maturityAtYear(schedules.maturity.rd.schedule, year),
            insurance: Math.round(parseAmount(schedules.maturity.insurance.byYear[year])),
        };
    });
    return totals;
}

/**
 * Nearest Goal First funding pass for one variant.
 *
 * Investment order is locked: SIP -> Equity -> Lumpsum -> PPF -> NPS (retirement only)
 * -> FD -> RD -> Insurance.
 *
 * Seeded goalMappings (already Accepted & Applied goals) feed the engines. For each goal we
 * measure availability from schedules that include only earlier goals' withdrawals, assign,
 * then continue so later goals see the reduced corpus.
 *
 * overridesByGoalId may replace the recommended SIP/Equity/Lumpsum take for a goal
 * (draft Customize Allocation before Apply).
 */
export function runFundingPass({
    goals = [],
    scheduleInputs = {},
    includeProposedAllocations = true,
    asOfYear = new Date().getFullYear(),
    horizonYear = asOfYear,
    seededGoalMappings = {},
    overridesByGoalId = {},
    preAllocatedByGoalId = {},
} = {}) {
    const sorted = sortGoalsNearestFirst(goals, asOfYear);
    const seed = sanitizeEngineMappings(seededGoalMappings);
    const goalMappings = {};
    const byGoalId = {};

    const buildSchedules = (mappings) => buildAvenueSchedules({
        ...scheduleInputs,
        asOfYear,
        includeProposedAllocations,
        goalMappings: mappings,
        goals: sorted,
    });

    const years = [];
    for (let year = asOfYear; year <= horizonYear; year += 1) years.push(year);

    const maturityTotals = collectMaturityTotals(buildSchedules({}), years);
    const maturityRemaining = {};
    years.forEach((year) => { maturityRemaining[year] = { ...maturityTotals[year] }; });

    const nominalConsumed = { ppf: 0, nps: 0 };

    sorted.forEach((goal) => {
        const targetYear = getGoalTargetYear(goal, asOfYear);
        const goalAmount = getGoalFutureValue(goal);
        const preAllocated = clampAvenueAmount(preAllocatedByGoalId[goal.id], goalAmount);
        const retirement = isRetirementGoal(goal);
        const draws = [];
        let remainingNeed = Math.max(0, goalAmount - preAllocated);

        const schedulesBefore = buildSchedules(goalMappings);

        const override = overridesByGoalId[goal.id];
        const hasOverride = override && typeof override === 'object';
        const seededForGoal = seed[goal.id] || null;

        const growthKeys = [
            ...GROWTH_AVENUE_ORDER,
            ...(retirement ? RETIREMENT_AVENUE_ORDER : []),
        ];

        const engineTakes = {};

        growthKeys.forEach((key) => {
            const pack = schedulesBefore.growth[key];
            if (!pack) return;
            const projected = valueAtYear(pack.schedule, targetYear, pack.field);
            const available = Math.max(0, projected - (nominalConsumed[key] || 0));

            let take = 0;
            if (ENGINE_WITHDRAWAL_SET.has(key)) {
                if (hasOverride) {
                    take = Math.min(
                        remainingNeed,
                        clampAvenueAmount(override[key], available),
                    );
                } else if (seededForGoal) {
                    take = Math.min(
                        remainingNeed,
                        clampAvenueAmount(seededForGoal[key], available),
                    );
                } else {
                    take = Math.min(Math.max(0, remainingNeed), available);
                }
                engineTakes[key] = Math.round(take);
            } else {
                take = Math.min(Math.max(0, remainingNeed), available);
            }

            if (take <= 0) return;

            remainingNeed -= take;
            draws.push({
                id: key,
                label: avenueLabel(key),
                kind: 'growth',
                amount: Math.round(take),
                availableAtGoalYear: Math.round(available),
                availableBefore: Math.round(available),
                allocated: Math.round(take),
                remainingAfter: Math.round(Math.max(0, available - take)),
                editable: ENGINE_WITHDRAWAL_SET.has(key),
            });

            if (!ENGINE_WITHDRAWAL_SET.has(key)) {
                nominalConsumed[key] = (nominalConsumed[key] || 0) + take;
            }
        });

        if (ENGINE_WITHDRAWAL_AVENUES.some((key) => (engineTakes[key] || 0) > 0)
            || hasOverride
            || seededForGoal) {
            const mapping = {};
            ENGINE_WITHDRAWAL_AVENUES.forEach((key) => {
                const amount = Math.round(engineTakes[key] || 0);
                if (amount > 0) mapping[key] = amount;
            });
            if (Object.keys(mapping).length > 0) {
                goalMappings[goal.id] = mapping;
            } else {
                delete goalMappings[goal.id];
            }
        }

        const availableMaturity = maturityRemaining[targetYear] || { fd: 0, rd: 0, insurance: 0 };
        MATURITY_AVENUE_ORDER.forEach((key) => {
            const pool = Math.max(0, availableMaturity[key] || 0);
            const take = Math.min(Math.max(0, remainingNeed), pool);
            if (take <= 0) return;
            availableMaturity[key] = pool - take;
            remainingNeed -= take;
            draws.push({
                id: key,
                label: avenueLabel(key),
                kind: 'maturity',
                amount: Math.round(take),
                availableAtGoalYear: Math.round(pool),
                availableBefore: Math.round(pool),
                allocated: Math.round(take),
                remainingAfter: Math.round(Math.max(0, pool - take)),
                editable: false,
            });
        });

        const funded = draws.reduce((sum, d) => sum + d.amount, 0);
        const editableAvenues = ENGINE_WITHDRAWAL_AVENUES.map((key) => {
            const existing = draws.find((d) => d.id === key);
            const pack = schedulesBefore.growth[key];
            const projected = pack
                ? valueAtYear(pack.schedule, targetYear, pack.field)
                : 0;
            const availableBefore = existing
                ? existing.availableBefore
                : Math.max(0, projected);
            const recommended = existing ? existing.amount : 0;
            const applied = Math.round(parseAmount((seed[goal.id] || {})[key]));
            return {
                id: key,
                label: avenueLabel(key),
                availableMax: Math.round(availableBefore),
                recommended,
                applied,
                amount: hasOverride
                    ? clampAvenueAmount(override[key], availableBefore)
                    : recommended,
            };
        }).filter((row) => row.availableMax > 0 || row.recommended > 0 || row.applied > 0);

        byGoalId[goal.id] = {
            goalId: goal.id,
            targetYear,
            goalAmount,
            preAllocated,
            draws,
            funded: Math.round(funded),
            gap: Math.max(0, Math.round(goalAmount - preAllocated - funded)),
            editableAvenues,
            isApplied: Boolean(seed[goal.id]),
            calculationAudit: draws.map((d) => ({
                id: d.id,
                label: d.label,
                kind: d.kind,
                availableBefore: d.availableBefore,
                allocated: d.allocated,
                remainingAfter: d.remainingAfter,
            })),
        };
    });

    const maturityLeftoverByYear = {};
    years.forEach((year) => {
        const remaining = maturityRemaining[year] || {};
        const leftover = MATURITY_AVENUE_ORDER.reduce(
            (sum, key) => sum + Math.max(0, remaining[key] || 0),
            0,
        );
        if (leftover > 0) maturityLeftoverByYear[year] = Math.round(leftover);
    });

    return {
        byGoalId,
        goalMappings,
        maturityTotalsByYear: maturityTotals,
        maturityLeftoverByYear,
        schedules: buildSchedules(goalMappings),
    };
}

/**
 * Residual Growth Pool contributions (user-facing: Future Invested Surplus).
 *
 * Sources 1 and 2 only: current-year surplus that survives the last planned PYMTW month, and
 * future-year unallocated surplus taken straight from Journey. Unused FD / RD / Insurance
 * maturities (sources 3-5) are added during the year-by-year simulation.
 */
export function buildResidualContributions({
    journeyProjections = [],
    monthlyUnallocatedSurplus = [],
    investmentAllocations = [],
    plannedMonths = [],
    asOfYear = new Date().getFullYear(),
    asOfMonthIndex = new Date().getMonth(),
    planStartMonthIndex = 0,
    horizonYear = asOfYear,
} = {}) {
    const byYear = {};

    const plannedMonthIndexes = (plannedMonths || [])
        .map((m) => parseMonthKey(m.key))
        .filter((parsed) => parsed && parsed.year === asOfYear)
        .map((parsed) => parsed.monthIndex);
    const lastPlannedMonthIndex = plannedMonthIndexes.length
        ? Math.max(...plannedMonthIndexes)
        : asOfMonthIndex - 1;
    const tailStartMonthIndex = Math.max(
        0,
        lastPlannedMonthIndex + 1,
        asOfMonthIndex,
        planStartMonthIndex,
    );

    const tailMonths = [];
    let currentYearTail = 0;
    for (let month = tailStartMonthIndex; month <= 11; month += 1) {
        const ledger = parseAmount(monthlyUnallocatedSurplus[month]);
        const committed = computeAllocationImpactForMonth(investmentAllocations, asOfYear, month);
        const remaining = Math.round(Math.max(0, ledger - committed));
        if (remaining <= 0) continue;
        currentYearTail += remaining;
        tailMonths.push({ monthIndex: month, label: MONTH_LABELS_LONG[month], amount: remaining });
    }
    if (currentYearTail > 0) byYear[asOfYear] = currentYearTail;

    const futureYears = [];
    (journeyProjections || []).forEach((row) => {
        const year = parseInt(row?.year, 10);
        if (!Number.isFinite(year) || year <= asOfYear || year > horizonYear) return;
        const amount = Math.round(Math.max(0, parseAmount(row.unallocatedSurplus)));
        if (amount <= 0) return;
        byYear[year] = Math.round((byYear[year] || 0) + amount);
        futureYears.push({ year, amount });
    });

    return {
        byYear,
        currentYearTail: Math.round(currentYearTail),
        tailMonths,
        tailStartMonthIndex,
        futureYears,
    };
}

/**
 * Residual Pool Timing Convention (locked). For each calendar year:
 *   1. compound the opening balance
 *   2. add yearly surplus contributions
 *   3. add FD / RD / Insurance maturities
 *   4. fund goals occurring in that year
 *   5. carry the closing balance forward to the next year
 */
export function simulateResidualPool({
    contributionsByYear = {},
    maturityLeftoverByYear = {},
    goalQueue = [],
    asOfYear = new Date().getFullYear(),
    horizonYear = asOfYear,
    rate = RESIDUAL_POOL_RATE,
    overridesByGoalId = {},
} = {}) {
    const drawByGoalId = {};
    const availableBeforeByGoalId = {};
    const timeline = [];
    let balance = 0;

    for (let year = asOfYear; year <= horizonYear; year += 1) {
        const opening = balance;
        const growth = opening * rate;
        balance = opening + growth;

        const surplusAdded = Math.max(0, Math.round(parseAmount(contributionsByYear[year])));
        balance += surplusAdded;

        const maturityAdded = Math.max(0, Math.round(parseAmount(maturityLeftoverByYear[year])));
        balance += maturityAdded;

        const goalDraws = [];
        goalQueue
            .filter((entry) => entry.targetYear === year)
            .forEach((entry) => {
                const need = Math.max(0, parseAmount(entry.gap));
                const availableBefore = Math.round(Math.min(need, Math.max(0, balance)));
                availableBeforeByGoalId[entry.goalId] = availableBefore;
                const override = overridesByGoalId[entry.goalId];
                const hasOverride = override !== undefined && override !== null;
                const draw = hasOverride
                    ? clampAvenueAmount(override, availableBefore)
                    : availableBefore;
                if (draw <= 0) return;
                balance -= draw;
                drawByGoalId[entry.goalId] = Math.round((drawByGoalId[entry.goalId] || 0) + draw);
                goalDraws.push({ goalId: entry.goalId, name: entry.name, amount: draw });
            });

        timeline.push({
            year,
            opening: Math.round(opening),
            growth: Math.round(growth),
            surplusAdded,
            maturityAdded,
            goalDraws,
            closing: Math.round(balance),
        });
    }

    return {
        drawByGoalId,
        availableBeforeByGoalId,
        timeline,
        closingBalance: Math.round(balance),
    };
}

function buildScenario(scenarioId, targetYear, goalAmount, draws) {
    const composition = draws
        .filter((item) => item.amount > 0)
        .map((item) => ({ ...item, amount: Math.round(item.amount) }));
    const projectedWealth = composition.reduce((sum, item) => sum + item.amount, 0);
    return {
        id: scenarioId,
        label: scenarioLabel(scenarioId, targetYear),
        description: scenarioDescription(scenarioId),
        goalAmount,
        projectedWealth,
        remainingGap: Math.max(0, Math.round(goalAmount - projectedWealth)),
        fundedPct: goalAmount > 0
            ? Math.min(100, Math.round((projectedWealth / goalAmount) * 100))
            : 0,
        composition,
    };
}

export function buildTrackSurplusAllocationReport({
    goals = [],
    expenseCategories = {},
    assetCategories = {},
    calculatorInputs = {},
    investmentAllocations = [],
    familyMembers = [],
    policies = [],
    journeyProjections = [],
    monthlyUnallocatedSurplus = [],
    planStartMonth = 0,
    asOfDate = new Date(),
    goalMappings: persistedGoalMappings = {},
    overridesByGoalId = {},
    customizedGoalIds = null,
} = {}) {
    const asOfYear = asOfDate.getFullYear();
    const asOfMonth = asOfDate.getMonth() + 1;
    const asOfMonthIndex = asOfDate.getMonth();
    const asOfMonthLabel = MONTH_LABELS_LONG[asOfMonthIndex] || 'This month';
    const persistedPlanningMappings = sanitizePlanningMappings(persistedGoalMappings);
    const customizedSet = Array.isArray(customizedGoalIds)
        ? new Set(customizedGoalIds)
        : null;
    const customizedMappings = customizedSet
        ? Object.fromEntries(
            Object.entries(persistedPlanningMappings)
                .filter(([goalId]) => customizedSet.has(goalId)),
        )
        : persistedPlanningMappings;
    const seededGoalMappings = sanitizeEngineMappings(customizedMappings);

    const plannedMonths = derivePlannedMonths(investmentAllocations);
    const plannedMonthsNotice = buildPlannedMonthsNotice(plannedMonths);
    const hasPymtwPlans = plannedMonths.length > 0;

    const activeGoals = sortGoalsNearestFirst(goals, asOfYear);
    const farthestYears = activeGoals.reduce((max, g) => (
        Math.max(max, getGoalTargetYear(g, asOfYear) - asOfYear)
    ), 10);
    const tenureYears = Math.max(15, farthestYears + 2);
    const horizonYear = asOfYear + farthestYears;

    const scheduleInputs = {
        expenseCategories,
        assetCategories,
        calculatorInputs,
        investmentAllocations,
        familyMembers,
        policies,
        asOfMonth,
        tenureYears,
    };

    // Discover unused maturities before allocating the residual pool. This pass is not
    // presented to the user; it only conserves FD / RD / Insurance maturity cash.
    const maturityDiscoveryPass = runFundingPass({
        goals: activeGoals,
        scheduleInputs,
        includeProposedAllocations: true,
        asOfYear,
        horizonYear,
        seededGoalMappings,
        overridesByGoalId,
    });

    const residualContributions = buildResidualContributions({
        journeyProjections,
        monthlyUnallocatedSurplus,
        investmentAllocations,
        plannedMonths,
        asOfYear,
        asOfMonthIndex,
        planStartMonthIndex: planStartMonth,
        horizonYear,
    });

    const goalQueue = activeGoals.map((goal) => {
        return {
            goalId: goal.id,
            name: goal.name || goal.placeholder || 'Goal',
            targetYear: getGoalTargetYear(goal, asOfYear),
            // Accumulated surplus is the first funding source, so it sees full goal need.
            gap: getGoalFutureValue(goal),
        };
    });

    const recommendedResidual = simulateResidualPool({
        contributionsByYear: residualContributions.byYear,
        maturityLeftoverByYear: maturityDiscoveryPass.maturityLeftoverByYear,
        goalQueue,
        asOfYear,
        horizonYear,
    });

    const residualOverridesByGoalId = {};
    activeGoals.forEach((goal) => {
        const draft = overridesByGoalId[goal.id];
        if (draft && Object.prototype.hasOwnProperty.call(draft, FUTURE_SURPLUS_AVENUE_ID)) {
            residualOverridesByGoalId[goal.id] = draft[FUTURE_SURPLUS_AVENUE_ID];
            return;
        }
        const saved = customizedMappings[goal.id];
        if (saved && Object.prototype.hasOwnProperty.call(saved, FUTURE_SURPLUS_AVENUE_ID)) {
            residualOverridesByGoalId[goal.id] = saved[FUTURE_SURPLUS_AVENUE_ID];
        }
    });

    const residual = simulateResidualPool({
        contributionsByYear: residualContributions.byYear,
        maturityLeftoverByYear: maturityDiscoveryPass.maturityLeftoverByYear,
        goalQueue,
        asOfYear,
        horizonYear,
        overridesByGoalId: residualOverridesByGoalId,
    });

    // Residual allocations are reserved first. Investment engines can only fund each
    // goal's remaining need, preserving SIP / Equity / Lumpsum for future growth.
    const planPass = runFundingPass({
        goals: activeGoals,
        scheduleInputs,
        includeProposedAllocations: true,
        asOfYear,
        horizonYear,
        seededGoalMappings,
        overridesByGoalId,
        preAllocatedByGoalId: residual.drawByGoalId,
    });

    const residualRatePct = Math.round(RESIDUAL_POOL_RATE * 100);

    const goalCards = activeGoals.map((goal, index) => {
        const targetYear = getGoalTargetYear(goal, asOfYear);
        const goalAmount = getGoalFutureValue(goal);
        const planResult = planPass.byGoalId[goal.id] || {};
        const planDraws = planResult.draws || [];
        const residualDraw = residual.drawByGoalId[goal.id] || 0;
        const residualAvailable = residual.availableBeforeByGoalId[goal.id] || 0;
        const recommendedResidualDraw = recommendedResidual.drawByGoalId[goal.id] || 0;
        const savedResidual = customizedMappings[goal.id]?.[FUTURE_SURPLUS_AVENUE_ID];

        const wealthDraws = residualDraw > 0
            ? [{
                id: FUTURE_SURPLUS_AVENUE_ID,
                label: avenueLabel(FUTURE_SURPLUS_AVENUE_ID),
                kind: 'futureSurplus',
                amount: residualDraw,
                availableBefore: residualAvailable,
                allocated: residualDraw,
                remainingAfter: Math.max(0, residualAvailable - residualDraw),
                editable: true,
            }, ...planDraws]
            : planDraws;

        const wealthScenario = buildScenario(SCENARIO_WEALTH, targetYear, goalAmount, wealthDraws);

        // Display-only maturity rows for Customize when maturity year === goal year.
        const maturityAtGoalYear = planDraws
            .filter((d) => d.kind === 'maturity' && (d.id === 'fd' || d.id === 'rd') && d.amount > 0)
            .map((d) => ({
                id: d.id,
                label: d.label,
                amount: d.amount,
            }));

        const residualBreakdown = buildResidualBreakdownForGoal({
            goalId: goal.id,
            targetYear,
            residualDraw,
            totalAvailable: residualAvailable,
            contributionsByYear: residualContributions.byYear,
            timeline: residual.timeline,
            asOfYear,
            residualRatePct,
        });

        return {
            goalId: goal.id,
            name: goal.name || goal.placeholder || 'Goal',
            targetYear,
            goalAmount,
            isRetirement: isRetirementGoal(goal),
            accent: pickGoalAccent(goal, index),
            scenario: wealthScenario,
            scenarios: { [SCENARIO_WEALTH]: wealthScenario },
            scenarioOrder: [SCENARIO_WEALTH],
            futureSurplusUsed: residualDraw,
            residualBreakdown,
            maturityAtGoalYear,
            editableAvenues: [
                {
                    id: FUTURE_SURPLUS_AVENUE_ID,
                    label: avenueLabel(FUTURE_SURPLUS_AVENUE_ID),
                    availableMax: residualAvailable,
                    recommended: recommendedResidualDraw,
                    applied: savedResidual === undefined ? 0 : savedResidual,
                    amount: residualDraw,
                },
                ...(planResult.editableAvenues || []),
            ].filter((row) => (
                row.availableMax > 0
                || row.recommended > 0
                || row.applied > 0
                || row.id !== FUTURE_SURPLUS_AVENUE_ID
            )),
            calculationAudit: [
                ...(residualDraw > 0
                    ? [{
                        id: FUTURE_SURPLUS_AVENUE_ID,
                        label: avenueLabel(FUTURE_SURPLUS_AVENUE_ID),
                        kind: 'futureSurplus',
                        availableBefore: residualAvailable,
                        allocated: residualDraw,
                        remainingAfter: Math.max(0, residualAvailable - residualDraw),
                    }]
                    : []),
                ...(planResult.calculationAudit || []),
            ],
            isApplied: Boolean(customizedMappings[goal.id]),
            recommendedMapping: sanitizePlanningMappings({
                [goal.id]: {
                    [FUTURE_SURPLUS_AVENUE_ID]: recommendedResidualDraw,
                    ...Object.fromEntries(
                        (planResult.editableAvenues || []).map((row) => [row.id, row.recommended]),
                    ),
                },
            })[goal.id] || {},
            appliedMapping: customizedMappings[goal.id] || {},
        };
    });

    const totals = goalCards.reduce((acc, card) => {
        acc.goalAmount += card.goalAmount;
        acc.projectedWealth += card.scenario.projectedWealth;
        acc.remainingGap += card.scenario.remainingGap;
        return acc;
    }, {
        goalAmount: 0,
        projectedWealth: 0,
        remainingGap: 0,
    });

    const farthestGoalYear = activeGoals.reduce(
        (max, g) => Math.max(max, getGoalTargetYear(g, asOfYear)),
        asOfYear,
    );

    return {
        meta: {
            asOfYear,
            asOfMonth,
            asOfMonthIndex,
            asOfMonthLabel,
            asOfLabel: `${asOfMonthLabel} ${asOfYear}`,
            horizonYear,
            farthestGoalYear,
            hasPymtwPlans,
            hasGoals: goalCards.length > 0,
            plannedMonthsNotice,
            residualRatePct,
        },
        plannedMonths,
        asOfCorpus: computeAsOfCorpus({ assetCategories, calculatorInputs }),
        totals,
        goalCards,
        futureSurplus: {
            contributions: residualContributions,
            timeline: residual.timeline,
            unusedAtHorizon: residual.closingBalance,
            totalDrawn: Object.values(residual.drawByGoalId).reduce((sum, v) => sum + v, 0),
        },
        /**
         * Recommended assignments from this report pass (residual first, then engines).
         * Auto-synced into goalMappings for non-customized goals; Customize Save overrides.
         */
        assignments: {
            currentPlan: sanitizePlanningMappings(Object.fromEntries(
                activeGoals.map((goal) => [
                    goal.id,
                    {
                        ...((residual.drawByGoalId[goal.id] || 0) > 0
                            ? {
                                [FUTURE_SURPLUS_AVENUE_ID]:
                                    residual.drawByGoalId[goal.id],
                            }
                            : {}),
                        ...(planPass.goalMappings[goal.id] || {}),
                    },
                ]),
            )),
            persisted: persistedPlanningMappings,
        },
    };
}
