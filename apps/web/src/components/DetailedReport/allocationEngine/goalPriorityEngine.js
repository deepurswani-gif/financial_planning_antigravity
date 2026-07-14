/**
 * Goal priority rules — fund top 1 (or at most 2) goals.
 * Sort: years remaining (nearest first) → user priority → monthly funding deficit.
 * Retirement does not crowd out nearer goals when contribution is already adequate.
 */

import { OBJECTIVE_TYPES } from './objectiveVehicleMap';
import { getProductsForHorizon, resolveAllocationPolicy } from './config';

/**
 * Sort goals for practical CFP-style funding.
 */
export function sortGoalsByPriority(goals = [], policy = resolveAllocationPolicy()) {
    return [...goals].sort((a, b) => {
        const yearsA = Number(a.yearsLeft) || 99;
        const yearsB = Number(b.yearsLeft) || 99;
        if (yearsA !== yearsB) return yearsA - yearsB;
        const priA = Number(a.priority) || 0;
        const priB = Number(b.priority) || 0;
        if (priB !== priA) return priB - priA;
        return (Number(b.monthlyFundingDeficit) || 0) - (Number(a.monthlyFundingDeficit) || 0);
    }).map((g) => {
        const horizon = getProductsForHorizon(g.yearsLeft);
        return {
            ...g,
            vehicles: horizon.vehicles,
            horizonProducts: horizon.products,
            horizonLabel: horizon.horizonLabel,
        };
    });
}

/**
 * Retirement with adequate existing contribution should not compete every month.
 */
export function isRetirementAdequatelyFunded(goal, policy = resolveAllocationPolicy()) {
    if (goal.type !== OBJECTIVE_TYPES.RETIREMENT) return false;
    const existing = Number(goal.existingMonthlyContribution) || 0;
    const deficit = Number(goal.monthlyFundingDeficit) || 0;
    return deficit <= 0 || existing >= (policy.retirementMinimumMonthly || 0);
}

/**
 * Select goals to fund this month (1, or 2 if surplus is large enough).
 */
export function selectGoalsToFund(fundedGoals = [], goalSurplus = 0, policyOverrides = {}) {
    const policy = resolveAllocationPolicy(policyOverrides);
    const minAmt = policy.minMeaningfulAllocation || 500;
    const surplus = Math.max(0, Math.round(goalSurplus));

    if (surplus < minAmt) {
        return { selected: [], deferred: fundedGoals, policy };
    }

    const ranked = sortGoalsByPriority(fundedGoals, policy);

    // Prefer nearer goals: demote adequately-funded retirement behind near-term deficits
    const active = [];
    const deferred = [];
    ranked.forEach((g) => {
        if (isRetirementAdequatelyFunded(g, policy)) {
            deferred.push({ ...g, deferReason: 'retirement_adequate' });
            return;
        }
        if ((g.monthlyFundingDeficit || 0) <= 0 && g.type === OBJECTIVE_TYPES.RETIREMENT) {
            deferred.push({ ...g, deferReason: 'no_deficit' });
            return;
        }
        active.push(g);
    });

    // If nothing else needs money, still allow retirement / remaining ranked goals
    const pool = active.length
        ? active
        : ranked.filter((g) => (g.monthlyFundingDeficit || 0) > 0 || g.type === OBJECTIVE_TYPES.RETIREMENT);

    const maxGoals = Math.max(1, policy.maxGoalsToFund || 2);
    const selected = [];

    if (pool.length) {
        selected.push(pool[0]);
    }

    if (pool.length > 1 && maxGoals >= 2) {
        const topNeed = Math.max(0, Number(pool[0].monthlyFundingDeficit) || 0);
        const leftoverAfterTop = topNeed > 0
            ? Math.max(0, surplus - topNeed)
            : Math.max(0, Math.floor(surplus / 2));
        // Only fund a second goal when meaningful surplus remains after the top goal's need
        if (leftoverAfterTop >= Math.max(minAmt, policy.secondGoalMinSurplus || 5000)) {
            selected.push(pool[1]);
        }
    }

    const selectedIds = new Set(selected.map((g) => g.id));
    const rest = [
        ...deferred,
        ...pool.filter((g) => !selectedIds.has(g.id)),
        ...ranked.filter((g) => !selectedIds.has(g.id) && !deferred.find((d) => d.id === g.id)),
    ];

    return {
        selected,
        deferred: rest,
        ranked,
        policy,
    };
}
