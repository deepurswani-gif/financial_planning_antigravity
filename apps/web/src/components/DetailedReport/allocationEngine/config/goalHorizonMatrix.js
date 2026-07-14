/**
 * Goal horizon → internal product matrix (CFP mapping).
 * Studio keys feed draft allocations; uiLabel is what the family sees.
 * Internal classification stays hidden from users.
 */

/**
 * @typedef {{
 *   minYears: number,
 *   maxYears: number | null,
 *   products: Array<{
 *     internalId: string,
 *     studioKey: string,
 *     uiLabel: string,
 *     weight: number
 *   }>
 * }} HorizonBand
 */

/** @type {HorizonBand[]} */
export const GOAL_HORIZON_MATRIX = [
    {
        minYears: 0,
        maxYears: 1,
        products: [
            {
                internalId: 'liquid_mutual_fund',
                studioKey: 'Liquid Mutual Fund',
                uiLabel: 'Liquid Mutual Fund',
                weight: 1,
            },
        ],
    },
    {
        minYears: 1,
        maxYears: 3,
        products: [
            {
                internalId: 'sip_hybrid_balanced',
                studioKey: 'SIP',
                uiLabel: 'SIP',
                weight: 1,
            },
        ],
    },
    {
        minYears: 3,
        maxYears: 5,
        products: [
            {
                internalId: 'sip_equity',
                studioKey: 'SIP',
                uiLabel: 'SIP',
                weight: 1,
            },
        ],
    },
    {
        minYears: 5,
        maxYears: 6,
        products: [
            {
                internalId: 'fixed_deposit',
                studioKey: 'Fixed Deposit',
                uiLabel: 'FD',
                weight: 0.4,
            },
            {
                internalId: 'recurring_deposit',
                studioKey: 'Recurring Deposit',
                uiLabel: 'RD',
                weight: 0.2,
            },
            {
                internalId: 'sip_equity',
                studioKey: 'SIP',
                uiLabel: 'SIP',
                weight: 0.4,
            },
        ],
    },
    {
        minYears: 7,
        maxYears: null,
        products: [
            {
                internalId: 'sip_equity',
                studioKey: 'SIP',
                uiLabel: 'SIP',
                weight: 0.65,
            },
            {
                internalId: 'direct_equity_etf',
                studioKey: 'Direct Equity & ETFs',
                uiLabel: 'Equity',
                weight: 0.35,
            },
        ],
    },
];

/**
 * Resolve horizon band for years remaining.
 */
export function resolveHorizonBand(yearsLeft, matrix = GOAL_HORIZON_MATRIX) {
    const years = Math.max(0, Number(yearsLeft) || 0);
    for (const band of matrix) {
        const max = band.maxYears == null ? Infinity : band.maxYears;
        if (years >= band.minYears && years <= max) {
            return band;
        }
    }
    return matrix[matrix.length - 1];
}

/**
 * Products for a goal horizon (studio keys + internal metadata).
 */
export function getProductsForHorizon(yearsLeft, matrix = GOAL_HORIZON_MATRIX) {
    const band = resolveHorizonBand(yearsLeft, matrix);
    return {
        band,
        products: band?.products || [],
        vehicles: [...new Set((band?.products || []).map((p) => p.studioKey))],
        horizonLabel: band?.maxYears == null
            ? `${band.minYears}+ years`
            : band.minYears === band.maxYears
                ? `${band.minYears} year`
                : `${band.minYears}–${band.maxYears} years`,
    };
}
