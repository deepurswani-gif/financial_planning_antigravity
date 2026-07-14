/**
 * Health insurance annual premium master (age-band).
 * Update this table when insurer rates change — do not hardcode in engine logic.
 */

export const HEALTH_PREMIUM_BANDS = [
    { minAge: 25, maxAge: 30, annualPremium: 16500 },
    { minAge: 31, maxAge: 35, annualPremium: 19000 },
    { minAge: 36, maxAge: 40, annualPremium: 22500 },
    { minAge: 41, maxAge: 45, annualPremium: 28500 },
    { minAge: 46, maxAge: 50, annualPremium: 37000 },
    { minAge: 51, maxAge: 55, annualPremium: 52000 },
    { minAge: 56, maxAge: 60, annualPremium: 72000 },
];

/** Fallback when age is outside defined bands (clamp to nearest). */
export const HEALTH_PREMIUM_DEFAULT_ANNUAL = 22500;

/**
 * Resolve annual premium for an age from the master table.
 */
export function getHealthAnnualPremium(age, bands = HEALTH_PREMIUM_BANDS) {
    const a = Math.round(Number(age) || 0);
    if (!bands.length) return HEALTH_PREMIUM_DEFAULT_ANNUAL;

    const exact = bands.find((b) => a >= b.minAge && a <= b.maxAge);
    if (exact) return exact.annualPremium;

    if (a < bands[0].minAge) return bands[0].annualPremium;
    return bands[bands.length - 1].annualPremium;
}

export function getHealthMonthlyPremium(age, bands = HEALTH_PREMIUM_BANDS) {
    return Math.round(getHealthAnnualPremium(age, bands) / 12);
}
