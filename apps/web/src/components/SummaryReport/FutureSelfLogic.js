/**
 * FutureSelfLogic.js
 * Pure calculations for the "Your Future Self" report section.
 */

import { calculateFutureCost } from '../GoalModule/GoalLogic';
import { getGrowthSavingsMonthly } from '../DetailedFlow/savingsDetailSync';
import { computeSIPProjection } from './MoneyStoryLogic';

export const HORIZON_YEARS = 5;
export const DEFAULT_INVESTMENT_CAGR = 12;
export const DEFAULT_GOAL_INFLATION = 6;

/**
 * Monthly SIP required to reach target corpus (annuity-due, beginning of month).
 * Inverse of computeSIPProjection FV formula.
 */
export const computeRequiredMonthlySIP = (targetCorpus, annualRate = DEFAULT_INVESTMENT_CAGR, years = 1) => {
    const fv = parseFloat(targetCorpus) || 0;
    const y = Math.max(years, 1 / 12);
    if (fv <= 0) return 0;

    const r = (annualRate / 100) / 12;
    const n = y * 12;
    const factor = (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
    if (factor <= 0) return 0;
    return Math.round(fv / factor);
};

export const getValidGoals = (goals) =>
    (goals || []).filter((g) => (parseFloat(g.presentValue) || 0) > 0 && (parseFloat(g.yearsToGoal) || 0) > 0);

/**
 * Monthly investment amount used for goal-readiness projections.
 * Prefers detailed growth savings (SIP + PPF + NPS); falls back to summary investments.
 * Excludes safer "other savings" (FDs, RDs, etc.).
 */
export const getMonthlyInvestmentForProjection = (expenseCategories = {}) => {
    const growthAmount = getGrowthSavingsMonthly(expenseCategories);
    if (growthAmount > 0) {
        return { amount: growthAmount, source: 'detailed_growth' };
    }

    const summaryInvest = parseFloat(expenseCategories.summaryMonthlyInvestments) || 0;
    if (summaryInvest > 0) {
        return { amount: summaryInvest, source: 'summary_consolidated' };
    }

    return { amount: 0, source: 'none' };
};

/**
 * Cash-flow snapshot for income journey & surplus projections.
 */
export const buildCashFlowSnapshot = (cashFlowResults, expenseCategories) => {
    const monthlyIncome = cashFlowResults?.totalIncome || 0;
    const householdMonthly = cashFlowResults?.categorySums?.household || 0;
    const emiMonthly = cashFlowResults?.categorySums?.emi || 0;
    const insuranceMonthly = cashFlowResults?.categorySums?.insurance || 0;
    const savingsMonthly = cashFlowResults?.totalSavings || 0;
    const fixedOutflow = emiMonthly + insuranceMonthly + savingsMonthly;
    const monthlyCommitted = householdMonthly + fixedOutflow;
    const monthlySurplus = Math.max(0, monthlyIncome - monthlyCommitted);
    const { amount: currentMonthlyInvestment, source: investmentProjectionSource } =
        getMonthlyInvestmentForProjection(expenseCategories);

    return {
        monthlyIncome,
        householdMonthly,
        emiMonthly,
        insuranceMonthly,
        savingsMonthly,
        fixedOutflow,
        monthlyCommitted,
        monthlySurplus,
        currentMonthlyInvestment,
        investmentProjectionSource
    };
};

export const enrichGoal = (goal, currentYear = new Date().getFullYear()) => {
    const presentValue = parseFloat(goal.presentValue) || 0;
    const yearsToGoal = parseFloat(goal.yearsToGoal) || 0;
    const inflationRate = parseFloat(goal.inflationRate) || DEFAULT_GOAL_INFLATION;
    const futureCost = goal.futureValue
        ? Math.round(parseFloat(goal.futureValue))
        : calculateFutureCost(presentValue, yearsToGoal, inflationRate);
    const inflationDelta = Math.max(0, futureCost - Math.round(presentValue));
    const yearsRounded = Math.round(yearsToGoal);
    const targetYear = currentYear + yearsRounded;
    const monthlySipNeeded = computeRequiredMonthlySIP(futureCost, DEFAULT_INVESTMENT_CAGR, yearsToGoal);

    return {
        ...goal,
        presentValueNum: presentValue,
        yearsToGoal,
        yearsRounded,
        yearsDisplay: yearsToGoal < 1 ? '<1 year' : `${yearsRounded} year${yearsRounded === 1 ? '' : 's'}`,
        targetYear,
        futureCost,
        inflationDelta,
        inflationRate,
        monthlySipNeeded,
        isNearTerm: yearsToGoal <= HORIZON_YEARS
    };
};

export const buildDreamsHeadline = (enrichedGoals) => {
    if (!enrichedGoals.length) return '';
    return [...enrichedGoals]
        .sort((a, b) => a.targetYear - b.targetYear || a.yearsToGoal - b.yearsToGoal)
        .map((g) => `${g.name} in ${g.targetYear}.`)
        .join(' ');
};

/**
 * Project FV of growing monthly surplus invested at CAGR until goal horizon.
 * Income grows annually; household inflates; EMIs + insurance + savings stay flat.
 */
export const projectFutureSurplusFV = ({
    monthlyIncome,
    householdMonthly,
    fixedOutflow,
    yearsToGoal,
    incomeGrowthPct,
    householdInflationPct,
    cagrPct = DEFAULT_INVESTMENT_CAGR
}) => {
    const totalMonths = Math.max(1, Math.round(yearsToGoal * 12));
    const r = cagrPct / 100 / 12;
    let balance = 0;
    let monthIndex = 0;
    let yearIndex = 0;

    while (monthIndex < totalMonths) {
        const income = monthlyIncome * Math.pow(1 + incomeGrowthPct / 100, yearIndex);
        const household = householdMonthly * Math.pow(1 + householdInflationPct / 100, yearIndex);
        const surplus = Math.max(0, income - household - fixedOutflow);

        for (let m = 0; m < 12 && monthIndex < totalMonths; m++) {
            balance = balance * (1 + r) + surplus;
            monthIndex++;
        }
        yearIndex++;
    }

    return Math.round(balance);
};

export const buildGoalReadiness = (enrichedGoal, cashSnapshot, inflationRates) => {
    const incomeGrowthPct = parseFloat(inflationRates?.incomeIncrement) || 10;
    const householdInflationPct = parseFloat(inflationRates?.householdInflation) || 6;

    const projectedCurrentSips = computeSIPProjection(
        cashSnapshot.currentMonthlyInvestment,
        DEFAULT_INVESTMENT_CAGR,
        enrichedGoal.yearsToGoal
    ).futureValue;

    const projectedFutureSurplus = projectFutureSurplusFV({
        monthlyIncome: cashSnapshot.monthlyIncome,
        householdMonthly: cashSnapshot.householdMonthly,
        fixedOutflow: cashSnapshot.fixedOutflow,
        yearsToGoal: enrichedGoal.yearsToGoal,
        incomeGrowthPct,
        householdInflationPct
    });

    const totalProjected = projectedCurrentSips + projectedFutureSurplus;
    const futureCost = enrichedGoal.futureCost;
    const gap = Math.max(0, futureCost - totalProjected);
    const isAchievable = totalProjected >= futureCost;
    const coveragePercent = futureCost > 0 ? Math.min(100, Math.round((totalProjected / futureCost) * 100)) : 0;

    return {
        ...enrichedGoal,
        projectedCurrentSips,
        projectedFutureSurplus,
        totalProjected,
        gap,
        isAchievable,
        coveragePercent,
        incomeGrowthPct,
        householdInflationPct,
        investmentProjectionSource: cashSnapshot.investmentProjectionSource,
        comfortableMessage:
            'Your current financial path indicates that this goal is comfortably achievable if your savings and income trends continue as expected.',
        gapMessage:
            'Based on current projections, there may be a gap between the resources available and the estimated future cost of this goal.'
    };
};

export const buildIncomeJourney = (cashSnapshot, inflationRates, currentYear = new Date().getFullYear()) => {
    const incomeGrowthPct = parseFloat(inflationRates?.incomeIncrement) || 10;
    const householdInflationPct = parseFloat(inflationRates?.householdInflation) || 6;
    const baseIncome = cashSnapshot.monthlyIncome;

    const points = [];
    for (let i = 0; i <= HORIZON_YEARS; i++) {
        points.push({
            index: i,
            label: i === 0 ? 'Today' : String(currentYear + i),
            year: currentYear + i,
            monthlyIncome: Math.round(baseIncome * Math.pow(1 + incomeGrowthPct / 100, i))
        });
    }

    const householdAtHorizon = Math.round(
        cashSnapshot.householdMonthly * Math.pow(1 + householdInflationPct / 100, HORIZON_YEARS)
    );
    const horizonYear = currentYear + HORIZON_YEARS;

    return {
        points,
        incomeGrowthPct,
        householdInflationPct,
        householdAtHorizon,
        horizonYear,
        monthlySurplus: cashSnapshot.monthlySurplus,
        monthlyCommitted: cashSnapshot.monthlyCommitted
    };
};

export const formatCompactFS = (amount) => {
    const abs = Math.abs(amount || 0);
    if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(2)} Cr`;
    if (abs >= 100000) return `₹${(abs / 100000).toFixed(2)} L`;
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount || 0);
};

export const buildFutureSelfReport = ({
    goals,
    cashFlowResults,
    expenseCategories,
    inflationRates,
    currentYear = new Date().getFullYear()
}) => {
    const cashSnapshot = buildCashFlowSnapshot(cashFlowResults, expenseCategories);
    const validGoals = getValidGoals(goals);
    const enrichedGoals = validGoals.map((g) => enrichGoal(g, currentYear));
    const nearTermGoals = enrichedGoals
        .filter((g) => g.isNearTerm)
        .map((g) => buildGoalReadiness(g, cashSnapshot, inflationRates))
        .sort((a, b) => a.targetYear - b.targetYear || a.yearsToGoal - b.yearsToGoal);
    const longTermGoals = enrichedGoals
        .filter((g) => !g.isNearTerm)
        .sort((a, b) => a.targetYear - b.targetYear);

    return {
        cashSnapshot,
        enrichedGoals,
        dreamsHeadline: buildDreamsHeadline(enrichedGoals),
        incomeJourney: buildIncomeJourney(cashSnapshot, inflationRates, currentYear),
        nearTermGoals,
        longTermGoals,
        hasIncomeData: cashSnapshot.monthlyIncome > 0,
        hasGoals: enrichedGoals.length > 0
    };
};
