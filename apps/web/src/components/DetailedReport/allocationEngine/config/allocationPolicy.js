/**
 * Financial planning allocation policy — all surplus-split rules live here.
 * No protection/goal percentages should be hardcoded in engine logic.
 */

export const ALLOCATION_POLICY = {
    /**
     * When any protection hygiene gap exists, share of monthly surplus
     * reserved for protection (term + health + emergency).
     * Unused budget (after premium/target caps) flows to goals automatically.
     */
    protectionShareOfSurplus: 0.5,

    /**
     * Slices of TOTAL surplus (must sum to protectionShareOfSurplus).
     * Example default: 20% + 20% + 10% = 50%.
     */
    termShareOfSurplus: 0.2,
    healthShareOfSurplus: 0.2,
    emergencyShareOfSurplus: 0.1,

    /** Remainder of surplus for life goals (also receives unused protection budget). */
    goalShareOfSurplus: 0.5,

    /**
     * Emergency top-up vehicle(s). Stops once target corpus is met.
     */
    emergencyVehicles: [
        { studioKey: 'Liquid Mutual Fund', weight: 0.7 },
        { studioKey: 'Fixed Deposit', weight: 0.3 },
    ],

    /**
     * Goal funding: fund the top goal; if surplus is large enough, fund at most two.
     */
    maxGoalsToFund: 2,
    /** Second goal only if remaining surplus after top goal is at least this amount. */
    secondGoalMinSurplus: 5000,
    /** Skip meaningless micro-allocations below this monthly amount. */
    minMeaningfulAllocation: 500,

    /**
     * Retirement stays a long-term objective but should not crowd out nearer goals
     * when existing retirement contribution is already adequate.
     */
    retirementMinimumMonthly: 5000,
    /** Years-to-goal above which a goal is treated as long-horizon (retirement deprioritized vs near goals). */
    nearTermGoalMaxYears: 10,
};

/**
 * Resolve effective policy with optional overrides.
 */
export function resolveAllocationPolicy(overrides = {}) {
    return {
        ...ALLOCATION_POLICY,
        ...overrides,
        emergencyVehicles: overrides.emergencyVehicles || ALLOCATION_POLICY.emergencyVehicles,
    };
}
