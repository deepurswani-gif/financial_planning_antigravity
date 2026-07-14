/**
 * Statutory limits and hygiene defaults — configuration only.
 */

export const STATUTORY_LIMITS = {
    ppfAnnualCap: 150000,
    ppfMaxMonthly: 12500,
    section80CLimit: 150000,
    healthMinimumCover: 1_000_000,
    lifeCoverMultiplierMonths: 200,
    emergencyMonths: 6,
    /** Months over which to top up emergency gap from surplus */
    emergencyFillMonths: 12,
    defaultGoalCagr: 12,
    termCoverToAge: 75,
};

export const HYGIENE_OBJECTIVE_TYPES = [
    'emergency_fund',
    'protection',
    'health',
];

/** Life goals eligible for monthly goal allocation (not hygiene). */
export const GOAL_ELIGIBLE_TYPES = [
    'retirement',
    'child_education',
    'child_marriage',
    'home',
    'business',
    'other',
];

/** @deprecated Use GOAL_ELIGIBLE_TYPES */
export const FPI_ELIGIBLE_GOAL_TYPES = GOAL_ELIGIBLE_TYPES;
