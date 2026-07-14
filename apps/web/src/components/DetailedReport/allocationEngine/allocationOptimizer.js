/**
 * Simple goal → instrument allocator (rule engine).
 * Splits each selected goal's rupee share across horizon-mapped vehicles by config weights.
 * No CRITIC / Need Score / FPI.
 */

import { STATUTORY_LIMITS, resolveAllocationPolicy } from './config';

const parseAmount = (value) => parseFloat(value) || 0;

/**
 * Allocate goal surplus across selected goals (at most 1–2), then across horizon products.
 */
export function allocateGoalsByRules({
    goalSurplus = 0,
    selectedGoals = [],
    mandatoryAllocations = {},
    existingMonthly = {},
    ppfMaxMonthly = STATUTORY_LIMITS.ppfMaxMonthly,
    policyOverrides = {},
} = {}) {
    const policy = resolveAllocationPolicy(policyOverrides);
    const minAmt = policy.minMeaningfulAllocation || 500;
    let remaining = Math.max(0, Math.round(parseAmount(goalSurplus)));
    const draftAllocations = { ...mandatoryAllocations };
    const residualLines = [];
    const objectiveShares = [];

    if (remaining < minAmt || !selectedGoals.length) {
        return {
            draftAllocations,
            residualLines: [],
            objectiveShares: [],
            residualTotal: 0,
            mandatoryTotal: Object.values(mandatoryAllocations).reduce((s, v) => s + v, 0),
            leftoverSurplus: remaining,
        };
    }

    // Share pool: prefer funding top goal deficit first, then second
    const goalBudgets = selectedGoals.map((g, index) => {
        const deficit = Math.max(0, Math.round(g.monthlyFundingDeficit || 0));
        return { goal: g, deficit, index, amount: 0 };
    });

    goalBudgets.forEach((row) => {
        if (remaining < minAmt) return;
        const want = row.deficit > 0 ? row.deficit : remaining;
        const give = Math.min(remaining, want);
        // Avoid tiny scraps on non-primary goals
        if (row.index > 0 && give < minAmt) return;
        row.amount = give;
        remaining -= give;
    });

    // If primary still has room and leftover exists (deficit unknown / 0), dump into primary
    if (remaining >= minAmt && goalBudgets[0]) {
        goalBudgets[0].amount += remaining;
        remaining = 0;
    }

    let ppfUsed = (mandatoryAllocations.PPF || 0) + (existingMonthly.PPF || 0);

    goalBudgets.forEach(({ goal, amount, deficit }) => {
        if (amount < minAmt) {
            objectiveShares.push({
                objectiveId: goal.id,
                label: goal.label,
                amount: 0,
                monthlyFundingDeficitBefore: deficit,
                monthlyFundingDeficitAfter: deficit,
                horizonLabel: goal.horizonLabel,
            });
            return;
        }

        const products = (goal.horizonProducts || []).filter((p) => p.studioKey && p.studioKey !== 'Gold');
        const weightSum = products.reduce((s, p) => s + (p.weight || 0), 0) || products.length || 1;
        const vehicleLines = [];
        let used = 0;

        products.forEach((product, i) => {
            let part = i === products.length - 1
                ? amount - used
                : Math.floor(amount * ((product.weight || 0) / weightSum));

            if (product.studioKey === 'PPF') {
                const room = Math.max(0, ppfMaxMonthly - ppfUsed);
                if (part > room) {
                    const spill = part - room;
                    part = room;
                    const spillKey = products.find((p) => p.studioKey === 'SIP')?.studioKey || 'SIP';
                    if (spill > 0) {
                        draftAllocations[spillKey] = (draftAllocations[spillKey] || 0) + spill;
                        vehicleLines.push({
                            instrumentType: spillKey,
                            amount: spill,
                            objectiveId: goal.id,
                            objectiveLabel: goal.label,
                            uiLabel: 'SIP',
                            horizonLabel: goal.horizonLabel,
                            source: 'goal_policy_spill',
                        });
                        used += spill;
                    }
                }
                ppfUsed += part;
            }

            if (part > 0) {
                draftAllocations[product.studioKey] = (draftAllocations[product.studioKey] || 0) + part;
                vehicleLines.push({
                    instrumentType: product.studioKey,
                    amount: part,
                    objectiveId: goal.id,
                    objectiveLabel: goal.label,
                    uiLabel: product.uiLabel || product.studioKey,
                    internalProduct: product.internalId,
                    horizonLabel: goal.horizonLabel,
                    source: 'goal_policy',
                    monthlyFundingDeficitBefore: deficit,
                    monthlyFundingDeficitAfter: Math.max(0, deficit - amount),
                });
                used += part;
            }
        });

        // Single-product fallback
        if (!products.length && amount > 0) {
            draftAllocations.SIP = (draftAllocations.SIP || 0) + amount;
            vehicleLines.push({
                instrumentType: 'SIP',
                amount,
                objectiveId: goal.id,
                objectiveLabel: goal.label,
                uiLabel: 'SIP',
                horizonLabel: goal.horizonLabel,
                source: 'goal_policy_fallback',
            });
        }

        vehicleLines.forEach((line) => residualLines.push(line));
        objectiveShares.push({
            objectiveId: goal.id,
            label: goal.label,
            amount,
            vehicles: vehicleLines,
            monthlyFundingDeficitBefore: deficit,
            monthlyFundingDeficitAfter: Math.max(0, deficit - amount),
            horizonLabel: goal.horizonLabel,
            yearsLeft: goal.yearsLeft,
            priority: goal.priority,
        });
    });

    delete draftAllocations.Gold;

    return {
        draftAllocations,
        residualLines,
        objectiveShares,
        residualTotal: Object.values(draftAllocations).reduce((s, v) => s + v, 0)
            - Object.values(mandatoryAllocations).reduce((s, v) => s + v, 0),
        mandatoryTotal: Object.values(mandatoryAllocations).reduce((s, v) => s + v, 0),
        leftoverSurplus: remaining,
        grandTotal: Object.values(draftAllocations).reduce((s, v) => s + v, 0),
    };
}

/** @deprecated Name kept for callers that imported the old optimizer. */
export const allocateByObjectiveThenVehicle = allocateGoalsByRules;
