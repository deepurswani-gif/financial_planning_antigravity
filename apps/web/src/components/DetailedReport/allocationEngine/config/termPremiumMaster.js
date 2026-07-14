/**
 * Term insurance premium master.
 * Premiums are annual for cover slabs at each entry age.
 * Policy term / PPT assume cover continues to age 75.
 *
 * Future: replace table lookup with insurer quotation APIs; keep
 * estimateTermAnnualPremium() as the stable interface.
 */

/** Cover slabs in rupees — generic interpolator works for any ordered slabs. */
export const TERM_COVER_SLABS = [5_000_000, 10_000_000]; // ₹50L, ₹1Cr

/**
 * @typedef {{ age: number, policyTerm: number, premiumPaymentTerm: number, premiumsByCover: Record<number, number> }} TermPremiumRow
 */

/** @type {TermPremiumRow[]} */
export const TERM_PREMIUM_TABLE = [
    { age: 20, policyTerm: 55, premiumPaymentTerm: 55, premiumsByCover: { 5000000: 7000, 10000000: 10500 } },
    { age: 25, policyTerm: 50, premiumPaymentTerm: 50, premiumsByCover: { 5000000: 8500, 10000000: 13000 } },
    { age: 30, policyTerm: 45, premiumPaymentTerm: 45, premiumsByCover: { 5000000: 10000, 10000000: 14100 } },
    { age: 35, policyTerm: 40, premiumPaymentTerm: 40, premiumsByCover: { 5000000: 13000, 10000000: 20700 } },
    { age: 40, policyTerm: 35, premiumPaymentTerm: 35, premiumsByCover: { 5000000: 17500, 10000000: 28000 } },
    { age: 45, policyTerm: 30, premiumPaymentTerm: 30, premiumsByCover: { 5000000: 23200, 10000000: 36100 } },
    { age: 50, policyTerm: 25, premiumPaymentTerm: 25, premiumsByCover: { 5000000: 31300, 10000000: 52500 } },
    { age: 55, policyTerm: 20, premiumPaymentTerm: 20, premiumsByCover: { 5000000: 44000, 10000000: 76100 } },
    { age: 60, policyTerm: 15, premiumPaymentTerm: 15, premiumsByCover: { 5000000: 60000, 10000000: 110000 } },
    { age: 65, policyTerm: 10, premiumPaymentTerm: 10, premiumsByCover: { 5000000: 88000, 10000000: 167000 } },
];

/**
 * Linear interpolate / extrapolate Y for a cover amount against ordered cover slabs.
 * Works for any number of slabs (₹50L, ₹1Cr, ₹2Cr, …).
 */
export function interpolateCoverPremium(coverAmount, coverPremiumPairs = []) {
    const cover = Math.max(0, Number(coverAmount) || 0);
    if (cover <= 0 || !coverPremiumPairs.length) return 0;

    const pairs = [...coverPremiumPairs]
        .map(([c, p]) => [Number(c), Number(p)])
        .filter(([c, p]) => c > 0 && p >= 0)
        .sort((a, b) => a[0] - b[0]);

    if (!pairs.length) return 0;
    if (pairs.length === 1) {
        return Math.round(pairs[0][1] * (cover / pairs[0][0]));
    }

    if (cover <= pairs[0][0]) {
        return Math.round(pairs[0][1] * (cover / pairs[0][0]));
    }

    for (let i = 0; i < pairs.length - 1; i += 1) {
        const [c0, p0] = pairs[i];
        const [c1, p1] = pairs[i + 1];
        if (cover >= c0 && cover <= c1) {
            const t = (cover - c0) / (c1 - c0);
            return Math.round(p0 + t * (p1 - p0));
        }
    }

    // Extrapolate beyond last slab using last segment slope
    const [cA, pA] = pairs[pairs.length - 2];
    const [cB, pB] = pairs[pairs.length - 1];
    const slope = (pB - pA) / (cB - cA);
    return Math.max(0, Math.round(pB + slope * (cover - cB)));
}

function rowCoverPairs(row) {
    return Object.entries(row.premiumsByCover || {}).map(([c, p]) => [Number(c), Number(p)]);
}

function premiumAtAgeForCover(age, cover, table = TERM_PREMIUM_TABLE) {
    const sorted = [...table].sort((a, b) => a.age - b.age);
    if (!sorted.length) return 0;

    if (age <= sorted[0].age) {
        return interpolateCoverPremium(cover, rowCoverPairs(sorted[0]));
    }
    if (age >= sorted[sorted.length - 1].age) {
        return interpolateCoverPremium(cover, rowCoverPairs(sorted[sorted.length - 1]));
    }

    for (let i = 0; i < sorted.length - 1; i += 1) {
        const lo = sorted[i];
        const hi = sorted[i + 1];
        if (age >= lo.age && age <= hi.age) {
            if (age === lo.age) return interpolateCoverPremium(cover, rowCoverPairs(lo));
            if (age === hi.age) return interpolateCoverPremium(cover, rowCoverPairs(hi));
            const t = (age - lo.age) / (hi.age - lo.age);
            const pLo = interpolateCoverPremium(cover, rowCoverPairs(lo));
            const pHi = interpolateCoverPremium(cover, rowCoverPairs(hi));
            return Math.round(pLo + t * (pHi - pLo));
        }
    }

    return interpolateCoverPremium(cover, rowCoverPairs(sorted[sorted.length - 1]));
}

/**
 * Estimate annual term premium for any protection-gap cover amount.
 * @returns {{ annualPremium, monthlyPremium, ageUsed, policyTerm, premiumPaymentTerm, method }}
 */
export function estimateTermAnnualPremium(age, coverGap, table = TERM_PREMIUM_TABLE) {
    const cover = Math.max(0, Number(coverGap) || 0);
    const a = Math.round(Number(age) || 30);
    if (cover <= 0) {
        return {
            annualPremium: 0,
            monthlyPremium: 0,
            ageUsed: a,
            policyTerm: Math.max(0, 75 - a),
            premiumPaymentTerm: Math.max(0, 75 - a),
            method: 'none',
        };
    }

    const annualPremium = premiumAtAgeForCover(a, cover, table);
    const nearest = [...table].sort((x, y) => Math.abs(x.age - a) - Math.abs(y.age - a))[0];

    return {
        annualPremium,
        monthlyPremium: Math.round(annualPremium / 12),
        ageUsed: a,
        policyTerm: nearest?.policyTerm ?? Math.max(0, 75 - a),
        premiumPaymentTerm: nearest?.premiumPaymentTerm ?? Math.max(0, 75 - a),
        method: 'table_interpolate',
    };
}
