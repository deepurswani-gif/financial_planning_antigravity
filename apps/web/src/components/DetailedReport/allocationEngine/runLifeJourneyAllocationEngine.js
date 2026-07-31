/**
 * Finbrella Life Journey Allocation Engine — configurable Financial Planning Rule Engine.
 *
 * Sequence:
 * 1. Protection policy (Term / Health / Emergency % of surplus, capped at need)
 * 2. Remaining surplus → Goal allocation
 * 3. Fund top 1–2 goals by years / priority / monthly deficit
 * 4. Horizon map → instruments
 *
 * No FPI, CRITIC, Need Score, or Explanation Engine.
 */

import { determineLifeStage } from './lifeStageEngine';
import { buildLifeObjectiveGaps } from './gapEngine';
import { buildGoalFundingPlan } from './goalFundingEngine';
import { runProtectionEngine } from './protectionEngine';
import { selectGoalsToFund } from './goalPriorityEngine';
import { allocateGoalsByRules } from './allocationOptimizer';
import { STATUTORY_LIMITS, resolveAllocationPolicy } from './config';

const parseAmount = (value) => parseFloat(value) || 0;

function formatInr(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(Math.round(amount || 0));
}

/**
 * Run the simplified life-journey rule engine.
 */
export function runLifeJourneyAllocationEngine({
    deployableSurplus = 0,
    familyMembers = [],
    expenseCategories = {},
    assetCategories = {},
    contingencyFund = '',
    summaryLifeCover = '',
    summaryHealthCover = '',
    hasHealthInsurance = null,
    policies = [],
    goals = [],
    cashFlowResults = null,
    inflationRates = {},
    surplusRate = 0,
    netWorth = 0,
    emiRatio = 0,
    hasStableIncome = true,
    ppfMaxMonthly = STATUTORY_LIMITS.ppfMaxMonthly,
    currentYear = new Date().getFullYear(),
    policyOverrides = {},
} = {}) {
    const surplus = Math.max(0, Math.round(parseAmount(deployableSurplus)));
    const policy = resolveAllocationPolicy(policyOverrides);

    const lifeStage = determineLifeStage({
        familyMembers,
        surplusRate,
        netWorth,
        emiRatio,
        hasStableIncome,
    });

    const gaps = buildLifeObjectiveGaps({
        familyMembers,
        expenseCategories,
        assetCategories,
        contingencyFund,
        summaryLifeCover,
        summaryHealthCover,
        hasHealthInsurance,
        policies,
    });

    // STEP 1 – Protection policy
    const protection = runProtectionEngine({
        familyMembers,
        expenseCategories,
        assetCategories,
        contingencyFund,
        summaryLifeCover,
        summaryHealthCover,
        hasHealthInsurance,
        policies,
        deployableSurplus: surplus,
        policyOverrides,
    });

    const goalSurplus = Math.max(0, protection.residualSurplus);

    // STEP 2–3 – Goal funding deficits + priority selection (top 1–2)
    const goalFunding = buildGoalFundingPlan({
        goals,
        cashFlowResults,
        expenseCategories,
        inflationRates,
        existingMonthly: gaps.existingMonthly,
        currentYear,
    });

    const { selected, deferred, ranked } = selectGoalsToFund(
        goalFunding.fundedGoals,
        goalSurplus,
        policyOverrides,
    );

    // STEP 4 – Horizon instruments for selected goals
    const allocation = allocateGoalsByRules({
        goalSurplus,
        selectedGoals: selected,
        mandatoryAllocations: protection.mandatoryAllocations,
        existingMonthly: gaps.existingMonthly,
        ppfMaxMonthly,
        policyOverrides,
    });

    const draftAllocations = { ...(allocation.draftAllocations || {}) };
    delete draftAllocations.Gold;

    const grandTotal = Object.values(draftAllocations).reduce((s, v) => s + (v || 0), 0) || 0;
    const percentages = {};
    Object.entries(draftAllocations).forEach(([type, amount]) => {
        if (amount > 0 && grandTotal > 0) {
            percentages[type] = Math.round((amount / grandTotal) * 1000) / 10;
        }
    });

    const headline = buildHeadline(protection, selected, goalSurplus, surplus);
    const goalCards = selected.map((g, idx) => ({
        id: g.id,
        label: g.label,
        rank: idx + 1,
        yearsLeft: g.yearsLeft,
        horizonLabel: g.horizonLabel,
        monthlyFundingDeficit: g.monthlyFundingDeficit,
        priority: g.priority,
        summary: `Funding ${g.label} (${g.horizonLabel || `${g.yearsLeft} yrs`}) — deficit ${formatInr(g.monthlyFundingDeficit)}/mo.`,
    }));

    const bundles = surplus > 0
        ? [{
            id: 'life_journey',
            label: 'Life Journey plan',
            tone: 'primary',
            allocations: { ...draftAllocations },
            sipAmount: draftAllocations.SIP || 0,
            reserves: {
                emergency: protection.emergency?.monthlyAllocation || 0,
                protection: (protection.term?.monthlyAllocation || 0)
                    + (protection.health?.monthlyAllocation || 0),
            },
            narrative: headline,
            score: 100,
            unallocated: Math.max(0, surplus - grandTotal),
            goalCards,
            engine: true,
        }]
        : [];

    return {
        lifeStage,
        gaps,
        goalFunding,
        rankedGoals: ranked,
        selectedGoals: selected,
        deferredGoals: deferred,
        protection,
        waterfall: {
            // Compatibility shape for older UI (steps / mandatory totals)
            mandatoryAllocations: protection.mandatoryAllocations,
            residualSurplus: goalSurplus,
            steps: protection.steps,
            mandatoryTotal: protection.monthlyTotal,
            protection,
        },
        allocation,
        draftAllocations,
        percentages,
        headline,
        goalCards,
        objectiveCards: goalCards,
        explanations: [],
        bundles,
        policy,
        diagnostics: {
            deployableSurplus: surplus,
            protectionTotal: protection.monthlyTotal,
            goalSurplus,
            grandTotal,
            goalsFunded: selected.map((g) => g.label),
            sequence: [
                'protection_policy',
                'goal_allocation',
                'goal_priority',
                'horizon_instrument_map',
            ],
        },
    };
}

function buildHeadline(protection, selectedGoals, goalSurplus, surplus) {
    const prot = protection.monthlyTotal || 0;
    const top = selectedGoals[0];
    if (prot > 0 && top) {
        return `₹${Math.round(prot).toLocaleString('en-IN')}/mo secures protection & emergency first; ${formatInr(goalSurplus)} funds ${top.label}${selectedGoals.length > 1 ? ` and ${selectedGoals[1].label}` : ''}.`;
    }
    if (prot > 0) {
        return `This month focuses on protection & emergency hygiene (${formatInr(prot)} of ${formatInr(surplus)}).`;
    }
    if (top) {
        return `Hygiene targets look complete. Surplus of ${formatInr(surplus)} goes to ${top.label}${selectedGoals.length > 1 ? ` and ${selectedGoals[1].label}` : ''}.`;
    }
    return 'Add deployable surplus to see a practical monthly plan.';
}

export function buildLifeJourneyRecommendedBundles(params) {
    const result = runLifeJourneyAllocationEngine(params);
    return {
        bundles: result.bundles,
        engineResult: result,
    };
}
