/**
 * Goal Funding Engine — monthly funding deficit per life goal.
 * requiredMonthly − existingMonthly = monthlyFundingDeficit
 */

import {
    enrichGoal,
    buildGoalReadiness,
    buildCashFlowSnapshot,
    getValidGoals,
    computeRequiredMonthlySIP,
    DEFAULT_INVESTMENT_CAGR,
} from '../../SummaryReport/FutureSelfLogic';
import { classifyGoalObjective, OBJECTIVE_TYPES } from './objectiveVehicleMap';
import { GOAL_ELIGIBLE_TYPES, STATUTORY_LIMITS } from './config';

const parseAmount = (value) => parseFloat(value) || 0;

/**
 * Attribute existing monthly contribution toward a goal type.
 */
export function attributeExistingMonthly(goalType, existingMonthly = {}) {
    if (goalType === OBJECTIVE_TYPES.RETIREMENT) {
        return (existingMonthly.PPF || 0)
            + (existingMonthly.NPS || 0)
            + Math.round((existingMonthly.SIP || 0) * 0.4);
    }
    if (
        goalType === OBJECTIVE_TYPES.CHILD_EDUCATION
        || goalType === OBJECTIVE_TYPES.CHILD_MARRIAGE
        || goalType === OBJECTIVE_TYPES.HOME
        || goalType === OBJECTIVE_TYPES.BUSINESS
        || goalType === OBJECTIVE_TYPES.OTHER
    ) {
        return Math.round((existingMonthly.SIP || 0) * 0.5);
    }
    return existingMonthly.SIP || 0;
}

/**
 * Build funded-goal rows with monthlyFundingDeficit.
 */
export function buildGoalFundingPlan({
    goals = [],
    cashFlowResults = null,
    expenseCategories = {},
    inflationRates = {},
    existingMonthly = {},
    currentYear = new Date().getFullYear(),
    goalCagr = STATUTORY_LIMITS.defaultGoalCagr || DEFAULT_INVESTMENT_CAGR,
} = {}) {
    const cashSnapshot = cashFlowResults
        ? buildCashFlowSnapshot(cashFlowResults, expenseCategories)
        : {
            monthlyIncome: 0,
            householdMonthly: 0,
            fixedOutflow: 0,
            monthlySurplus: 0,
            monthlyCommitted: existingMonthly.total || 0,
            currentMonthlyInvestment: existingMonthly.SIP || existingMonthly.total || 0,
            investmentProjectionSource: 'savings',
        };

    const validGoals = getValidGoals(goals);
    const fundedGoals = [];

    validGoals.forEach((goal) => {
        const type = classifyGoalObjective(goal);
        if (!GOAL_ELIGIBLE_TYPES.includes(type)) return;

        const enriched = enrichGoal(goal, currentYear);
        const readiness = buildGoalReadiness(enriched, cashSnapshot, inflationRates);
        const yearsLeft = Math.max(0.25, enriched.yearsToGoal || 1);
        const corpusGap = Math.max(0, readiness.gap || 0);
        const requiredMonthly = computeRequiredMonthlySIP(
            corpusGap > 0 ? corpusGap : 0,
            goalCagr,
            yearsLeft,
        );
        // If already achievable, required for remaining path may be 0
        const existingForGoal = attributeExistingMonthly(type, existingMonthly);
        const monthlyFundingDeficit = Math.max(0, requiredMonthly - existingForGoal);
        const inflation = parseAmount(goal.inflationRate) || 6;
        const velocity = corpusGap * (Math.pow(1 + inflation / 100, 1) - 1);

        fundedGoals.push({
            id: `goal_${goal.id}`,
            goalId: goal.id,
            type,
            label: goal.name || goal.placeholder || 'Goal',
            isGoal: true,
            isWaterfall: false,
            yearsLeft,
            gap: Math.round(corpusGap),
            futureCost: Math.round(readiness.futureCost || 0),
            coveragePercent: readiness.coveragePercent,
            requiredMonthlyContribution: requiredMonthly,
            existingMonthlyContribution: existingForGoal,
            monthlyFundingDeficit,
            monthlyFundingDeficitBefore: monthlyFundingDeficit,
            wealthGapVelocity: Math.round(velocity),
            inflationRate: inflation,
            priority: parseAmount(goal.priority) || (
                type === OBJECTIVE_TYPES.RETIREMENT ? 80
                    : type === OBJECTIVE_TYPES.CHILD_EDUCATION ? 85
                        : 50
            ),
            readiness,
        });
    });

    return {
        fundedGoals,
        cashSnapshot,
        totalMonthlyDeficit: fundedGoals.reduce((s, g) => s + g.monthlyFundingDeficit, 0),
    };
}
