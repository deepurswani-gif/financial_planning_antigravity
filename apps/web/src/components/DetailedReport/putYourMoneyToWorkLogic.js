import { calculateAge } from '../ProfileModule/ProfileLogic';
import { computeSIPData } from '../Calculators/SIPCalculator';
import { calculateContingencyData, calculateProtectionData } from '../SummaryReport/SafetyNetLogic';
import { getEmergencyFundAmount } from '../DetailedFlow/wealthDetailSync';
import { MONTH_LABELS_LONG, MONTH_LABELS_SHORT } from './moneyFlowLedgerLogic';
import { buildDeploymentSlices, summarizeInvestmentAllocations } from './investSurplusLogic';
import {
    INSTRUMENT_REGISTRY,
    createEmptyDraftAllocations,
    draftAllocationsToItems,
    getTotalDraftAllocated,
} from './instrumentAnalysisLogic';
import { runLifeJourneyAllocationEngine } from './allocationEngine';

export { INSTRUMENT_REGISTRY, createEmptyDraftAllocations, getTotalDraftAllocated, draftAllocationsToItems };

const parseAmount = (value) => parseFloat(value) || 0;

const RECURRING_ALLOC_TYPES = [
    'SIP', 'PPF', 'NPS', 'Life Insurance', 'Term Insurance', 'Health Insurance',
    'Life Insurance Saving Plans', 'Recurring Deposit', 'RD',
];

/** Studio apply stores recurring amounts as annual totals; convert to monthly. */
export function getRecurringMonthlyAmount(alloc = {}) {
    const amount = parseAmount(alloc.amount);
    const type = alloc.type;
    const freq = String(alloc.frequency || 'Monthly').toLowerCase();
    if (type === 'Life Insurance' || type === 'Life Insurance Saving Plans') {
        if (freq === 'quarterly') return amount / 3;
        if (freq === 'monthly') return amount;
        if (alloc.studioPlanKey) return amount / 12;
        return amount;
    }
    return amount / 12;
}

export function allocationHasStartedByMonth(alloc = {}, calendarYear, monthIndex) {
    const startYear = parseInt(alloc.startYear, 10);
    const startMonth = parseInt(alloc.startMonth, 10);
    if (!Number.isFinite(startYear) || !Number.isFinite(startMonth)) {
        return true;
    }
    const month = monthIndex + 1;
    if (startYear < calendarYear) return true;
    if (startYear > calendarYear) return false;
    return startMonth <= month;
}

export function isRecurringAllocationType(type) {
    return RECURRING_ALLOC_TYPES.includes(type);
}

/**
 * Surplus consumed by investment allocations in a single calendar month.
 * Recurring: monthly amount every month on/after start.
 * One-time: full amount only in the start month (skipped if no start — matches prior global-commit behavior).
 */
export function computeAllocationImpactForMonth(
    investmentAllocations = [],
    calendarYear,
    monthIndex,
) {
    const month = monthIndex + 1;
    let impact = 0;

    investmentAllocations.forEach((alloc) => {
        const type = alloc.type === 'RD' ? 'Recurring Deposit' : alloc.type;
        if (isRecurringAllocationType(type) || isRecurringAllocationType(alloc.type)) {
            if (!allocationHasStartedByMonth(alloc, calendarYear, monthIndex)) return;
            impact += getRecurringMonthlyAmount(alloc);
            return;
        }

        const startYear = parseInt(alloc.startYear, 10);
        const startMonth = parseInt(alloc.startMonth, 10);
        if (!Number.isFinite(startYear) || !Number.isFinite(startMonth)) return;
        if (startYear === calendarYear && startMonth === month) {
            impact += parseAmount(alloc.amount);
        }
    });

    return Math.round(impact);
}

function getInstrumentDisplayLabel(type) {
    for (let i = 0; i < INSTRUMENT_CATEGORIES.length; i += 1) {
        const cat = INSTRUMENT_CATEGORIES[i];
        if (cat.instrumentLabels?.[type]) return cat.instrumentLabels[type];
    }
    return type;
}

function getAllocationsAppliedInMonth(investmentAllocations = [], calendarYear, monthIndex) {
    const planKey = getAllocationPlanKey(calendarYear, monthIndex);
    return investmentAllocations
        .filter((alloc) => alloc.studioPlanKey === planKey)
        .map((alloc) => {
            const type = alloc.type === 'RD' ? 'Recurring Deposit' : alloc.type;
            const isRecurring = isRecurringAllocationType(type) || isRecurringAllocationType(alloc.type);
            const amount = isRecurring
                ? Math.round(getRecurringMonthlyAmount(alloc))
                : Math.round(parseAmount(alloc.amount));
            return {
                type,
                label: getInstrumentDisplayLabel(type),
                amount,
                isRecurring,
            };
        })
        .filter((item) => item.amount > 0);
}

const formatInr = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`;

/**
 * Build deployable-surplus outlook cards for current month + next 2 months.
 * @param {boolean} [options.excludeInvestmentAllocations] - journey-adjusted baseline only
 */
export function buildThreeMonthSurplusOutlook({
    unallocatedSurplusByMonth = [],
    investmentAllocations = [],
    journeyAdjustments = [],
    calendarYear,
    planStartMonth = 0,
    currentMonth = new Date().getMonth(),
    excludeInvestmentAllocations = false,
}) {
    const selectableMonths = getSelectableMonths(planStartMonth, currentMonth);
    const allocs = excludeInvestmentAllocations ? [] : investmentAllocations;
    const start = Math.max(0, Math.min(11, planStartMonth));
    const monthSnapshots = [];

    selectableMonths.forEach((sel) => {
        const target = sel.monthIndex;
        let carryIn = 0;
        const steps = [];

        for (let m = start; m <= target; m += 1) {
            const ledger = parseAmount(unallocatedSurplusByMonth[m]);
            const available = ledger + carryIn;
            const allocImpact = computeAllocationImpactForMonth(allocs, calendarYear, m);
            const journeyImpact = computeJourneyAdjustmentImpactForMonth(
                journeyAdjustments,
                calendarYear,
                m,
            );
            const leftover = Math.max(0, available - allocImpact - journeyImpact);
            steps.push({
                monthIndex: m,
                label: MONTH_LABELS_LONG[m],
                ledger,
                carryIn,
                allocImpact,
                journeyImpact,
                leftover,
            });
            if (m < target) {
                carryIn = leftover;
            }
        }

        const last = steps[steps.length - 1];
        const prior = steps.length > 1 ? steps[steps.length - 2] : null;
        const allocationsInMonth = getAllocationsAppliedInMonth(allocs, calendarYear, target);

        const recurringFromPriorMonths = [];
        if (prior) {
            const seen = new Set();
            allocs.forEach((alloc) => {
                const type = alloc.type === 'RD' ? 'Recurring Deposit' : alloc.type;
                if (!isRecurringAllocationType(type) && !isRecurringAllocationType(alloc.type)) return;
                if (!alloc.studioPlanKey) return;
                const parts = String(alloc.studioPlanKey).split('-');
                const planMonthIndex = parseInt(parts[1], 10);
                if (!Number.isFinite(planMonthIndex) || planMonthIndex >= target) return;
                if (!allocationHasStartedByMonth(alloc, calendarYear, target)) return;
                const key = `${alloc.studioPlanKey}-${type}`;
                if (seen.has(key)) return;
                seen.add(key);
                recurringFromPriorMonths.push({
                    type,
                    label: getInstrumentDisplayLabel(type),
                    amount: Math.round(getRecurringMonthlyAmount(alloc)),
                    fromMonthIndex: planMonthIndex,
                    fromMonthLabel: MONTH_LABELS_LONG[planMonthIndex],
                });
            });
        }

        const calculationLines = [];
        if (prior) {
            let running = last.ledger;
            calculationLines.push(`${last.label} surplus ${formatInr(running)}`);
            recurringFromPriorMonths.forEach((item) => {
                running -= item.amount;
                calculationLines.push(`− ${item.fromMonthLabel} ${item.label} ${formatInr(item.amount)}`);
            });
            if (recurringFromPriorMonths.length > 0) {
                calculationLines.push(`= ${formatInr(running)}`);
            }
            calculationLines.push(`+ ${prior.label} remaining ${formatInr(prior.leftover)}`);
            calculationLines.push(`= ${formatInr(last.leftover)}`);
        }

        monthSnapshots.push({
            monthIndex: target,
            label: sel.label,
            title: `Surplus ${sel.label} ${calendarYear}`,
            ledgerUnallocated: Math.round(last.ledger),
            deployableSurplus: Math.round(last.leftover),
            carryFromPrior: Math.round(last.carryIn),
            allocationsInMonth,
            recurringFromPriorMonths,
            calculationLines,
        });
    });

    return monthSnapshots;
}

export function groupJourneyConstraintsByMonth(
    items = [],
    selectableMonths = [],
    calendarYear = new Date().getFullYear(),
) {
    if (!items.length || !selectableMonths.length) {
        return [];
    }

    const windowSet = new Set(selectableMonths.map((m) => m.monthIndex));
    const byMonth = new Map();

    items.forEach((item) => {
        let monthIndex;
        if (item.isLoan) {
            const startMonth = parseInt(item.startMonth, 10) || 1;
            monthIndex = startMonth - 1;
            if (parseInt(item.startYear, 10) !== calendarYear) return;
        } else {
            monthIndex = (parseInt(item.startMonth, 10) || 1) - 1;
            if (parseInt(item.startYear, 10) !== calendarYear) return;
        }
        if (!windowSet.has(monthIndex)) return;

        if (!byMonth.has(monthIndex)) {
            const monthMeta = selectableMonths.find((m) => m.monthIndex === monthIndex);
            byMonth.set(monthIndex, {
                monthIndex,
                label: monthMeta?.label || MONTH_LABELS_LONG[monthIndex],
                title: `${monthMeta?.label || MONTH_LABELS_LONG[monthIndex]} ${calendarYear}`,
                items: [],
            });
        }
        byMonth.get(monthIndex).items.push(item);
    });

    return Array.from(byMonth.values()).sort((a, b) => a.monthIndex - b.monthIndex);
}

export function computeDeployableSurplusWithCarry({
    unallocatedSurplusByMonth = [],
    investmentAllocations = [],
    journeyAdjustments = [],
    calendarYear,
    planStartMonth = 0,
    selectedMonthIndex = 0,
}) {
    const start = Math.max(0, Math.min(11, planStartMonth));
    const selected = Math.max(start, Math.min(11, selectedMonthIndex));
    let carryIn = 0;
    let deployableSurplus = 0;
    let carriedForward = 0;

    for (let m = start; m <= selected; m += 1) {
        const ledger = parseAmount(unallocatedSurplusByMonth[m]);
        const available = ledger + carryIn;
        const allocImpact = computeAllocationImpactForMonth(
            investmentAllocations,
            calendarYear,
            m,
        );
        const journeyImpact = computeJourneyAdjustmentImpactForMonth(
            journeyAdjustments,
            calendarYear,
            m,
        );
        const leftover = Math.max(0, available - allocImpact - journeyImpact);

        if (m < selected) {
            carryIn = leftover;
        } else {
            carriedForward = carryIn;
            deployableSurplus = leftover;
        }
    }

    return {
        deployableSurplus: Math.round(deployableSurplus),
        carriedForward: Math.round(carriedForward),
        monthlyFreeCash: Math.round(parseAmount(unallocatedSurplusByMonth[selected])),
    };
}

export const INSTRUMENT_CATEGORIES = [
    {
        id: 'protection',
        label: 'Protection',
        instruments: ['Term Insurance', 'Health Insurance', 'Liquid Mutual Fund'],
        instrumentLabels: {
            'Liquid Mutual Fund': 'Emergency Fund',
        },
        instrumentNotes: {
            'Liquid Mutual Fund': 'These funds will be invested in Liquid Mutual Funds.',
        },
        goalTags: ['Family security'],
    },
    {
        id: 'growth',
        label: 'Growth for most goals',
        instruments: ['SIP', 'Lumpsum', 'Direct Equity & ETFs'],
        goalTags: ['Education', 'Home', 'Wealth', 'Retirement'],
    },
    {
        id: 'short_term',
        label: 'Short-term certainty',
        instruments: ['Fixed Deposit', 'Recurring Deposit'],
        goalTags: ['Near-term goals'],
    },
    {
        id: 'retirement',
        label: 'Retirement & long horizon',
        instruments: ['PPF', 'NPS', 'Life Insurance Saving Plans'],
        goalTags: ['Retirement', 'Legacy'],
    },
];

export function getGoalFutureValue(goal) {
    if (goal.futureValue) return parseAmount(goal.futureValue);
    const pv = parseAmount(goal.presentValue);
    const years = parseAmount(goal.yearsToGoal);
    const inflation = parseAmount(goal.inflationRate) || 6;
    return pv * Math.pow(1 + inflation / 100, years);
}

export function getGoalTargetYear(goal, currentYear = new Date().getFullYear()) {
    return currentYear + Math.round(parseAmount(goal.yearsToGoal));
}

export function getSelectableMonths(planStartMonth = 0, currentMonth = new Date().getMonth()) {
    const anchorMonth = Math.max(0, Math.min(11, Math.max(planStartMonth, currentMonth)));
    const start = anchorMonth;
    const end = Math.min(11, anchorMonth + 2);
    const months = [];
    for (let m = start; m <= end; m += 1) {
        months.push({
            monthIndex: m,
            label: MONTH_LABELS_LONG[m],
            shortLabel: MONTH_LABELS_LONG[m].slice(0, 3),
        });
    }
    if (months.length === 0) {
        months.push({
            monthIndex: start,
            label: MONTH_LABELS_LONG[start],
            shortLabel: MONTH_LABELS_LONG[start].slice(0, 3),
        });
    }
    return months;
}

export function getLoanStartMonths(
    selectedYear,
    calendarYear,
    currentMonthIndex = new Date().getMonth(),
) {
    const year = parseInt(selectedYear, 10) || calendarYear;
    const minMonthIndex = year <= calendarYear
        ? Math.max(0, Math.min(11, currentMonthIndex))
        : 0;
    const months = [];
    for (let m = minMonthIndex; m < 12; m += 1) {
        months.push({
            monthIndex: m,
            value: m + 1,
            label: MONTH_LABELS_LONG[m],
        });
    }
    return months;
}

export function clampLoanStartMonth(
    startMonth,
    startYear,
    calendarYear,
    currentMonthIndex = new Date().getMonth(),
) {
    const year = parseInt(startYear, 10) || calendarYear;
    const month = parseInt(startMonth, 10) || (currentMonthIndex + 1);
    const minMonth = year <= calendarYear ? currentMonthIndex + 1 : 1;
    return Math.max(month, minMonth);
}

export function computeJourneyAdjustmentImpactForMonth(
    journeyAdjustments = [],
    calendarYear,
    monthIndex,
) {
    const month = monthIndex + 1;
    let deduction = 0;

    journeyAdjustments.forEach((adj) => {
        const startYear = parseInt(adj.startYear, 10) || calendarYear;
        const startMonth = parseInt(adj.startMonth, 10) || 1;

        if (adj.type === 'loan') {
            const tenureMonths = parseInt(adj.tenure, 10) || 12;
            const emi = parseAmount(adj.emi);
            const loanStartAbsolute = (startYear * 12) + startMonth;
            const loanEndAbsolute = loanStartAbsolute + tenureMonths - 1;
            const currentAbsolute = (calendarYear * 12) + month;

            if (currentAbsolute >= loanStartAbsolute && currentAbsolute <= loanEndAbsolute) {
                deduction += emi;
            }
        } else if (startYear === calendarYear && startMonth === month) {
            deduction += parseAmount(adj.amount);
        }
    });

    return Math.round(deduction);
}

/**
 * Ensures journey expense amounts + loan EMIs do not exceed each month's unallocated surplus.
 * @returns {{ ok: true } | { ok: false, message: string, monthLabel: string, monthIndex: number, surplus: number, impact: number }}
 */
export function validateJourneyAdjustmentsAgainstSurplus(
    adjustments = [],
    unallocatedSurplusByMonth = [],
    calendarYear = new Date().getFullYear(),
) {
    if (!adjustments.length) {
        return { ok: true };
    }

    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
        const impact = computeJourneyAdjustmentImpactForMonth(
            adjustments,
            calendarYear,
            monthIndex,
        );
        if (impact <= 0) continue;

        const surplus = Math.round(parseAmount(unallocatedSurplusByMonth[monthIndex]));
        if (impact > surplus) {
            const monthLabel = MONTH_LABELS_LONG[monthIndex] || 'Month';
            return {
                ok: false,
                monthIndex,
                monthLabel,
                surplus,
                impact,
                message: `${monthLabel} surplus is ₹${surplus.toLocaleString('en-IN')}; planned impact is ₹${impact.toLocaleString('en-IN')}. Reduce expenses or loan EMI so they fit within the available surplus.`,
            };
        }
    }

    return { ok: true };
}

export function summarizeJourneyConstraints(journeyAdjustments = [], journeyProjections = [], calendarYear) {
    if (!journeyAdjustments.length) {
        return { items: [], hasItems: false, totalAnnualImpact: 0 };
    }

    const items = journeyAdjustments.map((adj) => {
        const isLoan = adj.type === 'loan';
        const startYear = parseInt(adj.startYear, 10) || calendarYear;
        const startMonth = parseInt(adj.startMonth, 10) || 1;
        const monthLabel = MONTH_LABELS_LONG[Math.max(0, Math.min(11, startMonth - 1))];
        const monthlyImpact = isLoan
            ? parseAmount(adj.emi)
            : parseAmount(adj.amount);
        const annualImpact = isLoan ? parseAmount(adj.amount) || monthlyImpact * 12 : parseAmount(adj.amount);

        const projectionRow = journeyProjections.find((p) => p.year === startYear);
        const affectsSurplusFrom = isLoan ? startYear : `${monthLabel} ${startYear}`;

        return {
            id: adj.id,
            type: adj.type,
            name: adj.name || (isLoan ? 'Future loan' : 'Future expense'),
            isLoan,
            startYear,
            startMonth,
            monthLabel,
            duration: isLoan ? (parseInt(adj.duration, 10) || 1) : 1,
            monthlyImpact: Math.round(monthlyImpact),
            annualImpact: Math.round(annualImpact),
            principal: isLoan ? parseAmount(adj.principal) : null,
            rate: isLoan ? parseAmount(adj.rate) : null,
            tenure: isLoan ? parseInt(adj.tenure, 10) : null,
            affectsSurplusFrom,
            hasStarted: startYear <= calendarYear,
            projectionNote: projectionRow
                ? (isLoan
                    ? `Reduces investible surplus from ${startYear}`
                    : `One-time deduction in ${monthLabel} ${startYear}`)
                : (isLoan
                    ? `Scheduled from ${startYear}`
                    : `Scheduled for ${monthLabel} ${startYear}`),
        };
    });

    const totalAnnualImpact = items.reduce((sum, item) => sum + item.annualImpact, 0);

    return { items, hasItems: items.length > 0, totalAnnualImpact };
}

export function buildInstrumentCards(investmentAllocations = []) {
    const byType = {};
    investmentAllocations.forEach((alloc) => {
        const type = alloc.type === 'RD' ? 'Recurring Deposit' : alloc.type === 'FD' ? 'Fixed Deposit' : alloc.type;
        if (!byType[type]) {
            byType[type] = { type, items: [], monthlyTotal: 0, annualTotal: 0, count: 0 };
        }
        const amount = parseAmount(alloc.amount);
        const isMonthly = RECURRING_ALLOC_TYPES.includes(alloc.type)
            || alloc.type === 'Recurring Deposit';
        byType[type].items.push({
            id: alloc.id,
            name: alloc.name || alloc.type,
            amount,
            isMonthly,
            startMonth: alloc.startMonth,
            startYear: alloc.startYear,
        });
        byType[type].count += 1;
        if (isMonthly) {
            const monthlyAmount = alloc.studioPlanKey
                ? getRecurringMonthlyAmount({ ...alloc, type })
                : amount;
            byType[type].monthlyTotal += monthlyAmount;
            byType[type].annualTotal += alloc.studioPlanKey ? amount : amount * 12;
        } else {
            byType[type].annualTotal += amount;
        }
    });

    return INSTRUMENT_CATEGORIES.map((category) => ({
        ...category,
        instruments: category.instruments.map((type) => {
            const data = byType[type] || {
                type,
                items: [],
                monthlyTotal: 0,
                annualTotal: 0,
                count: 0,
            };
            return {
                ...data,
                hasAllocations: data.count > 0,
                isInteractive: true,
                registry: INSTRUMENT_REGISTRY[type] || null,
            };
        }),
    }));
}

export function getAllocationPlanKey(calendarYear, monthIndex) {
    return `${calendarYear}-${monthIndex}`;
}

export function getExistingMonthlySip(expenseCategories = {}) {
    const sipField = expenseCategories?.savings?.sip;
    if (sipField && typeof sipField === 'object' && sipField.amount !== undefined) {
        return parseAmount(sipField.amount);
    }
    return parseAmount(sipField);
}

function toCalculatorProposedSips(allocations = [], extraScenario = null) {
    const proposed = allocations
        .filter((a) => a.type === 'SIP')
        .map((a) => ({
            ...a,
            amount: parseAmount(a.amount) * 12,
        }));

    if (extraScenario && extraScenario.additionalMonthly > 0) {
        proposed.push({
            id: 'scenario-sip',
            type: 'SIP',
            amount: extraScenario.additionalMonthly * 12,
            startMonth: extraScenario.startMonth,
            startYear: extraScenario.startYear,
        });
    }

    return proposed;
}

function buildGoalImpactsFromSipData(sipData, goals, goalMappings, currentYear) {
    const activeGoals = goals
        .filter((g) => getGoalFutureValue(g) > 0)
        .sort((a, b) => parseAmount(a.yearsToGoal) - parseAmount(b.yearsToGoal));

    return activeGoals.map((goal) => {
        const targetYear = getGoalTargetYear(goal, currentYear);
        const futureValue = Math.round(getGoalFutureValue(goal));
        const row = sipData.find((r) => r.year === targetYear);
        const availableAtGoalYear = Math.round(row?.valueAfterWithdrawal || 0);
        const sipMapped = Math.round(parseAmount((goalMappings[goal.id] || {}).sip));
        const totalMapped = Object.values(goalMappings[goal.id] || {})
            .reduce((sum, val) => sum + parseAmount(val), 0);
        const fundedPct = futureValue > 0
            ? Math.min(100, Math.round((totalMapped / futureValue) * 100))
            : 0;
        const projectedFundedPct = futureValue > 0
            ? Math.min(100, Math.round((availableAtGoalYear / futureValue) * 100))
            : 0;
        const sipContributionPct = futureValue > 0
            ? Math.min(100, Math.round((sipMapped / futureValue) * 100))
            : 0;

        return {
            goalId: goal.id,
            name: goal.name || goal.placeholder || 'Goal',
            targetYear,
            yearsAway: Math.max(0, targetYear - currentYear),
            futureValue,
            availableAtGoalYear,
            sipMapped,
            totalMapped,
            fundedPct,
            projectedFundedPct,
            sipContributionPct,
            shortfall: Math.max(0, futureValue - totalMapped),
            projectedShortfall: Math.max(0, futureValue - availableAtGoalYear),
        };
    });
}

function runSipAnalysis({
    expenseCategories = {},
    assetCategories = {},
    investmentAllocations = [],
    calculatorInputs = {},
    goalMappings = {},
    goals = [],
    familyMembers = [],
    currentYear = new Date().getFullYear(),
    additionalMonthly = 0,
    scenarioStartMonth = null,
    scenarioStartYear = null,
}) {
    const selfMember = familyMembers.find((m) => m.relation?.toLowerCase() === 'self');
    const currentAge = selfMember?.dob ? calculateAge(selfMember.dob) : parseAmount(selfMember?.age) || 30;
    const retirementAge = parseInt(selfMember?.retirementAge, 10) || 60;
    const yearsToRetirement = Math.max(1, retirementAge - currentAge);
    const retirementYear = currentYear + yearsToRetirement;

    const sipConfig = calculatorInputs.sip || {};
    const expectedReturns = parseAmount(sipConfig.rate) || 12;
    const sipEvents = sipConfig.events || sipConfig.increments || [];
    const storedProposedSIPs = investmentAllocations.filter((a) => a.type === 'SIP');

    const existingMonthly = getExistingMonthlySip(expenseCategories);
    const proposedMonthly = storedProposedSIPs.reduce((sum, s) => sum + parseAmount(s.amount), 0);
    const scenarioMonthly = Math.max(0, additionalMonthly);
    const totalMonthly = existingMonthly + proposedMonthly + scenarioMonthly;

    const defaultCorpus = parseAmount(assetCategories?.investments?.mutualFunds)
        || parseAmount(assetCategories?.equity?.mfEquity)
        || parseAmount(assetCategories?.equity?.stocks)
        || 0;

    const extraScenario = scenarioMonthly > 0 && scenarioStartMonth != null
        ? {
            additionalMonthly: scenarioMonthly,
            startMonth: scenarioStartMonth,
            startYear: scenarioStartYear || currentYear,
        }
        : null;

    const sipData = computeSIPData(
        currentYear,
        existingMonthly,
        expectedReturns,
        yearsToRetirement,
        defaultCorpus,
        sipEvents,
        toCalculatorProposedSips(storedProposedSIPs, extraScenario),
        goalMappings,
        goals,
    );

    const retirementRow = sipData.find((r) => r.year === retirementYear) || sipData[sipData.length - 1];
    const retirementCorpus = Math.round(retirementRow?.valueAfterWithdrawal || 0);
    const goalImpacts = buildGoalImpactsFromSipData(sipData, goals, goalMappings, currentYear);

    const growthSeries = sipData
        .filter((_, idx) => idx % Math.max(1, Math.floor(sipData.length / 12)) === 0 || idx === sipData.length - 1)
        .map((row) => ({
            year: row.year,
            label: String(row.year),
            corpus: Math.round(row.valueAfterWithdrawal),
            invested: Math.round(row.annualInvestment),
            withdrawal: Math.round(row.withdrawal),
        }));

    return {
        existingMonthly,
        proposedMonthly,
        scenarioMonthly,
        totalMonthly,
        expectedReturns,
        yearsToRetirement,
        retirementYear,
        retirementCorpus,
        goalImpacts,
        growthSeries,
        hasProposedSips: storedProposedSIPs.length > 0,
        proposedSipCount: storedProposedSIPs.length,
    };
}

export function analyzeSipBaseline(params) {
    return runSipAnalysis({ ...params, additionalMonthly: 0 });
}

export function analyzeSipScenario(params, additionalMonthly, monthIndex, calendarYear) {
    return runSipAnalysis({
        ...params,
        additionalMonthly,
        scenarioStartMonth: monthIndex + 1,
        scenarioStartYear: calendarYear,
    });
}

export function compareSipGoalImpacts(baselineImpacts = [], scenarioImpacts = []) {
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

/**
 * Life Journey Allocation Engine entry for the studio.
 * Replaces fixed-percentage bundles with FPI → waterfall → residual scoring.
 * Returns studio-compatible bundles plus `engineResult` when called via buildLifeJourneyRecommendation.
 */
export function buildRecommendedBundles({
    deployableSurplus = 0,
    contingencyData = {},
    protectionData = {},
    goals = [],
    familyMembers = [],
    expenseCategories = {},
    assetCategories = {},
    contingencyFund = '',
    summaryLifeCover = '',
    summaryHealthCover = '',
    hasHealthInsurance = null,
    cashFlowResults = null,
    inflationRates = {},
    surplusRate = 0,
    netWorth = 0,
    emiRatio = 0,
    ppfMaxMonthly = 12500,
} = {}) {
    const surplus = Math.max(0, deployableSurplus);
    if (surplus <= 0) return [];

    const engineResult = runLifeJourneyAllocationEngine({
        deployableSurplus: surplus,
        familyMembers,
        expenseCategories,
        assetCategories,
        contingencyFund: contingencyFund
            || contingencyData?.emergencyFundHave
            || '',
        summaryLifeCover: summaryLifeCover
            || protectionData?.coverageHave
            || '',
        summaryHealthCover,
        hasHealthInsurance,
        goals,
        cashFlowResults,
        inflationRates,
        surplusRate,
        netWorth,
        emiRatio,
        ppfMaxMonthly,
    });

    const bundles = (engineResult.bundles || []).map((b) => {
        const allocTotal = getTotalDraftAllocated(b.allocations);
        return {
            ...b,
            sipAmount: Math.min(b.sipAmount || b.allocations?.SIP || 0, surplus),
            unallocated: Math.max(0, surplus - allocTotal),
            engineResult,
        };
    });

    return bundles;
}

/** Full engine payload for UI (FPI stack, explanations, diagnostics). */
export function buildLifeJourneyRecommendation(params) {
    const bundles = buildRecommendedBundles(params);
    const engineResult = bundles[0]?.engineResult || null;
    return { bundles, engineResult };
}

export function buildDraftAllocationPlan({
    planKey,
    deployableSurplus,
    draftAllocations = {},
    draftSipAmount,
    selectedBundleId,
    calendarYear,
    monthIndex,
    monthLabel,
    baselineAnalysis,
    scenarioAnalysis,
    goalDeltas,
    growthPreview,
}) {
    const allocations = draftAllocations && Object.keys(draftAllocations).length
        ? draftAllocations
        : (draftSipAmount > 0 ? { SIP: draftSipAmount } : {});

    return {
        planKey,
        status: 'draft',
        calendarYear,
        monthIndex,
        monthLabel,
        surplusAvailable: deployableSurplus,
        selectedBundleId,
        items: draftAllocationsToItems(allocations, selectedBundleId ? 'ai' : 'user'),
        computedSnapshot: {
            retirementCorpusBefore: baselineAnalysis?.retirementCorpus || growthPreview?.baselineTotal || 0,
            retirementCorpusAfter: scenarioAnalysis?.retirementCorpus || growthPreview?.scenarioTotal || 0,
            retirementCorpusDelta: (scenarioAnalysis?.retirementCorpus || growthPreview?.scenarioTotal || 0)
                - (baselineAnalysis?.retirementCorpus || growthPreview?.baselineTotal || 0),
            retirementYear: growthPreview?.retirementYear || null,
            goalDeltas: goalDeltas?.filter((g) => g.projectedFundedDelta !== 0).slice(0, 6) || [],
            growthPreview: growthPreview?.rows || [],
        },
        updatedAt: new Date().toISOString(),
    };
}

export function applySipAllocationPlan({
    investmentAllocations = [],
    draftSipAmount,
    calendarYear,
    monthIndex,
    planLabel = 'Studio SIP',
}) {
    if (draftSipAmount <= 0) return investmentAllocations;

    const planKey = getAllocationPlanKey(calendarYear, monthIndex);
    const startMonth = monthIndex + 1;
    const filtered = investmentAllocations.filter(
        (a) => !(a.type === 'SIP' && a.studioPlanKey === planKey),
    );

    return [
        ...filtered,
        {
            id: Date.now(),
            type: 'SIP',
            name: `${planLabel} (${MONTH_LABELS_SHORT[monthIndex]} ${calendarYear})`,
            amount: draftSipAmount,
            startMonth,
            startYear: calendarYear,
            duration: 10,
            expectedReturn: 12,
            frequency: 'Monthly',
            studioPlanKey: planKey,
        },
    ];
}

export function buildCombinedGrowthSeries(baselineSeries = [], scenarioSeries = []) {
    const byYear = Object.fromEntries(baselineSeries.map((row) => [row.year, row]));
    return scenarioSeries.map((scenarioRow) => ({
        ...scenarioRow,
        baselineCorpus: byYear[scenarioRow.year]?.corpus || 0,
        scenarioCorpus: scenarioRow.corpus,
    }));
}

export function buildAllocationBriefing({
    userName = 'there',
    calendarYear,
    monthLabel,
    deployableSurplus,
    monthlyFreeCash,
    journeyConstraints,
    activeGoalCount,
    instrumentCardCount,
    safetyFlags = [],
}) {
    const lines = [];

    if (deployableSurplus > 0) {
        lines.push(
            `For ${monthLabel} ${calendarYear}, you have ₹${Math.round(deployableSurplus).toLocaleString('en-IN')} ready to deploy after existing commitments.`,
        );
    } else if (monthlyFreeCash > 0) {
        lines.push(
            `${monthLabel} ${calendarYear} shows ₹${Math.round(monthlyFreeCash).toLocaleString('en-IN')} free cash, but planned investments already account for it.`,
        );
    } else {
        lines.push(
            `No deployable surplus in ${monthLabel} ${calendarYear} — review cash flow before allocating new investments.`,
        );
    }

    if (journeyConstraints?.hasItems) {
        lines.push(
            `${journeyConstraints.items.length} future financial adjustment${journeyConstraints.items.length > 1 ? 's' : ''} will shape your surplus envelope from upcoming years.`,
        );
    }

    if (activeGoalCount > 0) {
        lines.push(
            `Analyzing ${activeGoalCount} active goal${activeGoalCount > 1 ? 's' : ''} across ${instrumentCardCount} investment avenue${instrumentCardCount > 1 ? 's' : ''}.`,
        );
    }

    safetyFlags.forEach((flag) => lines.push(flag));

    return {
        headline: `${monthLabel} ${calendarYear} · Allocation Studio`,
        greeting: `${userName}, here is your personalized surplus analysis.`,
        lines,
    };
}

export function buildAllocationStudioContext({
    moneyFlowReport,
    expenseCategories = {},
    assetCategories = {},
    contingencyFund = '',
    summaryLifeCover = '',
    familyMembers = [],
    journeyAdjustments = [],
    journeyProjections = [],
    investmentAllocations = [],
    calculatorInputs = {},
    goalMappings = {},
    goals = [],
    selectedMonthIndex,
}) {
    if (!moneyFlowReport?.meta) {
        return { meta: { hasData: false } };
    }

    const { meta, ledger, members, journeyLink } = moneyFlowReport;
    const calendarYear = meta.calendarYear;
    const planStartMonth = meta.planStartMonth ?? 0;
    const defaultMonth = meta.currentMonth >= planStartMonth ? meta.currentMonth : planStartMonth;
    const monthIndex = selectedMonthIndex ?? defaultMonth;

    const monthlyFreeCash = monthIndex >= planStartMonth
        ? (ledger.unallocatedSurplus[monthIndex] || 0)
        : 0;

    const allocationsSummary = summarizeInvestmentAllocations(investmentAllocations);
    const journeyMonthDeduction = computeJourneyAdjustmentImpactForMonth(
        journeyAdjustments,
        calendarYear,
        monthIndex,
    );
    const {
        deployableSurplus,
        carriedForward,
    } = monthIndex >= planStartMonth
        ? computeDeployableSurplusWithCarry({
            unallocatedSurplusByMonth: ledger.unallocatedSurplus || [],
            investmentAllocations,
            journeyAdjustments,
            calendarYear,
            planStartMonth,
            selectedMonthIndex: monthIndex,
        })
        : { deployableSurplus: 0, carriedForward: 0 };

    const protectionData = calculateProtectionData(expenseCategories, summaryLifeCover, familyMembers);
    const contingencyData = calculateContingencyData(
        expenseCategories,
        getEmergencyFundAmount(assetCategories, contingencyFund),
        familyMembers,
    );

    const journeyConstraints = summarizeJourneyConstraints(
        journeyAdjustments,
        journeyProjections,
        calendarYear,
    );

    const instrumentCategories = buildInstrumentCards(investmentAllocations);
    const instrumentCardCount = instrumentCategories.reduce(
        (sum, cat) => sum + cat.instruments.length,
        0,
    );

    const activeGoals = goals.filter((g) => getGoalFutureValue(g) > 0);
    const sipAnalysis = analyzeSipBaseline({
        expenseCategories,
        assetCategories,
        investmentAllocations,
        calculatorInputs,
        goalMappings,
        goals,
        familyMembers,
        currentYear: calendarYear,
    });

    const safetyFlags = [];
    if (contingencyData.gap > 0) {
        safetyFlags.push(
            `Emergency fund is ~${Math.round(contingencyData.monthsCoveredByFund * 10) / 10} months covered; ₹${Math.round(contingencyData.gap).toLocaleString('en-IN')} gap to ideal.`,
        );
    }
    if (protectionData.hasGap) {
        safetyFlags.push('Life cover gap detected — protection should be prioritized alongside wealth building.');
    }

    const monthLabel = MONTH_LABELS_LONG[monthIndex] || 'Month';
    const briefing = buildAllocationBriefing({
        userName: members?.selfName?.split(' ')[0] || 'there',
        calendarYear,
        monthLabel,
        deployableSurplus,
        monthlyFreeCash,
        journeyConstraints,
        activeGoalCount: activeGoals.length,
        instrumentCardCount,
        safetyFlags,
    });

    const journeyYearRow = journeyProjections.find((p) => p.year === calendarYear);
    const journeyYearSurplus = journeyLink?.proratedNetInvestibleSurplus
        || journeyYearRow?.netInvestibleSurplus
        || 0;

    const selectableMonths = getSelectableMonths(planStartMonth, meta.currentMonth);

    const threeMonthOutlook = buildThreeMonthSurplusOutlook({
        unallocatedSurplusByMonth: ledger.unallocatedSurplus || [],
        investmentAllocations,
        journeyAdjustments,
        calendarYear,
        planStartMonth,
        currentMonth: meta.currentMonth,
    });

    const journeyAdjustedOutlook = buildThreeMonthSurplusOutlook({
        unallocatedSurplusByMonth: ledger.unallocatedSurplus || [],
        investmentAllocations: [],
        journeyAdjustments,
        calendarYear,
        planStartMonth,
        currentMonth: meta.currentMonth,
        excludeInvestmentAllocations: true,
    });

    return {
        meta: {
            hasData: true,
            calendarYear,
            planStartMonth,
            currentMonth: meta.currentMonth,
            selectedMonthIndex: monthIndex,
            monthLabel,
            userName: members?.selfName?.split(' ')[0] || 'there',
        },
        hero: {
            monthlyFreeCash,
            deployableSurplus,
            carriedForward,
            monthlyCommitted: allocationsSummary.monthlyCommitted,
            journeyMonthDeduction,
            journeyYearSurplus,
            ytdUnallocated: moneyFlowReport.totals?.ytdUnallocated || 0,
            threeMonthOutlook,
            journeyAdjustedOutlook,
        },
        briefing,
        journeyConstraints,
        instrumentCategories,
        sipAnalysis,
        safety: { protectionData, contingencyData },
        selectableMonths,
    };
}

export function buildSipAnalysisNarrative(sipAnalysis, isScenario = false) {
    if (!sipAnalysis?.totalMonthly && !sipAnalysis?.scenarioMonthly) {
        return 'No SIP contributions detected yet. Existing savings or proposed SIPs will appear here once configured.';
    }

    const parts = [];

    if (isScenario && sipAnalysis.scenarioMonthly > 0) {
        parts.push(
            `Adding ₹${Math.round(sipAnalysis.scenarioMonthly).toLocaleString('en-IN')}/month brings your total SIP path to ₹${Math.round(sipAnalysis.totalMonthly).toLocaleString('en-IN')}/month`,
        );
    } else {
        parts.push(
            `Your current SIP path commits ₹${Math.round(sipAnalysis.totalMonthly).toLocaleString('en-IN')}/month`,
        );
    }

    if (sipAnalysis.proposedMonthly > 0 && !isScenario) {
        parts.push(`including ₹${Math.round(sipAnalysis.proposedMonthly).toLocaleString('en-IN')}/month from proposed allocations`);
    }

    parts.push(
        `— projected to reach ₹${sipAnalysis.retirementCorpus.toLocaleString('en-IN')} by retirement at ${sipAnalysis.expectedReturns}% p.a.`,
    );

    const topGoal = sipAnalysis.goalImpacts.find((g) => g.projectedShortfall > 0 || g.shortfall > 0);
    if (topGoal) {
        const pct = isScenario ? topGoal.projectedFundedPct : topGoal.fundedPct;
        const shortfall = isScenario ? topGoal.projectedShortfall : topGoal.shortfall;
        parts.push(
            ` ${topGoal.name} (${topGoal.targetYear}) is ${pct}% on track via SIP corpus; ₹${shortfall.toLocaleString('en-IN')} remains.`,
        );
    }

    return parts.join('');
}
