import { reconcileAmounts } from './detailReconcile';

/** Parse asset amount from scalar, configured object, or FD/RD array item. */
export function getAssetAmount(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (Array.isArray(val)) {
        return val.reduce((sum, item) => sum + getAssetAmount(item), 0);
    }
    if (typeof val === 'object' && val.amount !== undefined) {
        return parseFloat(val.amount) || 0;
    }
    return parseFloat(val) || 0;
}

export function sumFixedDeposits(fixedDeposit) {
    return getAssetAmount(fixedDeposit);
}

const NON_SNAPSHOT_DETAIL_KEYS = [
    ['realEstate', 'secondProperty'],
    ['realEstate', 'landPlot'],
    ['vehicles', 'idv'],
    ['valuables', 'gold'],
    ['valuables', 'art'],
    ['cash', 'cashInHand'],
    ['investments', 'equity'],
    ['investments', 'fixedDeposit'],
    ['insurance', 'ulip'],
    ['retirement', 'epf'],
    ['retirement', 'ppf'],
    ['retirement', 'nps'],
];

const SUMMARY_ALIAS_DETAIL_KEYS = [
    ['investments', 'mutualFunds'],
    ['cash', 'savings'],
    ['realEstate', 'residential'],
];

export function hasWealthDetailEntered(assetCategories = {}) {
    if (Array.isArray(assetCategories.custom) && assetCategories.custom.some((c) => getAssetAmount(c?.value) > 0 || c?.label)) {
        return true;
    }
    if (NON_SNAPSHOT_DETAIL_KEYS.some(([cat, key]) => getAssetAmount(assetCategories[cat]?.[key]) > 0)) {
        return true;
    }
    return SUMMARY_ALIAS_DETAIL_KEYS.some(([cat, key]) => getAssetAmount(assetCategories[cat]?.[key]) > 0)
        && !isOnlyLegacySummaryScalars(assetCategories);
}

/** True when only the three consolidated summary scalars are populated (no real breakdown). */
export function isOnlyLegacySummaryScalars(assetCategories = {}) {
    const hasAlias = SUMMARY_ALIAS_DETAIL_KEYS.some(([cat, key]) => getAssetAmount(assetCategories[cat]?.[key]) > 0);
    if (!hasAlias) return false;
    if (NON_SNAPSHOT_DETAIL_KEYS.some(([cat, key]) => getAssetAmount(assetCategories[cat]?.[key]) > 0)) {
        return false;
    }
    if (Array.isArray(assetCategories.custom) && assetCategories.custom.length > 0) {
        return false;
    }
    return true;
}

/** True when only consolidated summary liability scalars are populated. */
export function isOnlyLegacySummaryLiabilities(liabilityCategories = {}) {
    const loans = liabilityCategories.loans || {};
    const hasSummaryScalars = getAssetAmount(loans.home) > 0
        || getAssetAmount(loans.creditCard) > 0
        || getAssetAmount(loans.personal) > 0;
    if (!hasSummaryScalars) return false;
    return ['car', 'twoWheeler', 'education', 'otherEmis'].every((key) => getAssetAmount(loans[key]) <= 0)
        && !(Array.isArray(liabilityCategories.custom) && liabilityCategories.custom.length > 0);
}

export function hasLiabilityDetailEntered(liabilityCategories = {}) {
    if (Array.isArray(liabilityCategories.custom) && liabilityCategories.custom.some((c) => getAssetAmount(c?.value) > 0 || c?.label)) {
        return true;
    }
    const loans = liabilityCategories.loans || {};
    if (['car', 'twoWheeler', 'education', 'otherEmis'].some((key) => getAssetAmount(loans[key]) > 0)) {
        return true;
    }
    const hasScalar = ['home', 'personal', 'creditCard'].some((key) => getAssetAmount(loans[key]) > 0);
    return hasScalar && !isOnlyLegacySummaryLiabilities(liabilityCategories);
}

/** Summary-flow wrote consolidated figures into detail keys before snapshot fields existed. */
export function isLegacySummaryOnlyAssetStorage(assetCategories = {}) {
    if (assetCategories.summaryPortfolioValue || assetCategories.summaryLiquidCash || assetCategories.summaryRealEstateAssets) {
        return false;
    }
    if (hasWealthDetailEntered(assetCategories)) return false;

    return getAssetAmount(assetCategories.investments?.mutualFunds) > 0
        || getAssetAmount(assetCategories.cash?.savings) > 0
        || getAssetAmount(assetCategories.realEstate?.residential) > 0;
}

export function isLegacySummaryOnlyLiabilityStorage(liabilityCategories = {}) {
    if (liabilityCategories.summaryOutstandingLoans || liabilityCategories.summaryCreditCardDues || liabilityCategories.summaryOtherPayables) {
        return false;
    }
    if (hasLiabilityDetailEntered(liabilityCategories)) return false;

    const loans = liabilityCategories.loans || {};
    return getAssetAmount(loans.home) > 0
        || getAssetAmount(loans.creditCard) > 0
        || getAssetAmount(loans.personal) > 0;
}

/** Migrate legacy summary scalars into dedicated snapshot fields (never double-count). */
export function syncSummaryWealthSnapshots(assetCategories = {}, liabilityCategories = {}) {
    let summaryPortfolioValue = assetCategories.summaryPortfolioValue ?? '';
    let summaryLiquidCash = assetCategories.summaryLiquidCash ?? '';
    let summaryRealEstateAssets = assetCategories.summaryRealEstateAssets ?? '';
    let summaryOutstandingLoans = liabilityCategories.summaryOutstandingLoans ?? '';
    let summaryCreditCardDues = liabilityCategories.summaryCreditCardDues ?? '';
    let summaryOtherPayables = liabilityCategories.summaryOtherPayables ?? '';

    if (!summaryPortfolioValue && getAssetAmount(assetCategories.investments?.mutualFunds) > 0) {
        summaryPortfolioValue = String(getAssetAmount(assetCategories.investments.mutualFunds));
    }
    if (!summaryLiquidCash && getAssetAmount(assetCategories.cash?.savings) > 0) {
        summaryLiquidCash = String(getAssetAmount(assetCategories.cash.savings));
    }
    if (!summaryRealEstateAssets && getAssetAmount(assetCategories.realEstate?.residential) > 0) {
        summaryRealEstateAssets = String(getAssetAmount(assetCategories.realEstate.residential));
    }
    if (!summaryOutstandingLoans && getAssetAmount(liabilityCategories.loans?.home) > 0) {
        summaryOutstandingLoans = String(getAssetAmount(liabilityCategories.loans.home));
    }
    if (!summaryCreditCardDues && getAssetAmount(liabilityCategories.loans?.creditCard) > 0) {
        summaryCreditCardDues = String(getAssetAmount(liabilityCategories.loans.creditCard));
    }
    if (!summaryOtherPayables && getAssetAmount(liabilityCategories.loans?.personal) > 0) {
        summaryOtherPayables = String(getAssetAmount(liabilityCategories.loans.personal));
    }

    return {
        summaryPortfolioValue,
        summaryLiquidCash,
        summaryRealEstateAssets,
        summaryOutstandingLoans,
        summaryCreditCardDues,
        summaryOtherPayables,
    };
}

export function getSummaryAssetTotal(assetCategories = {}) {
    return getAssetAmount(assetCategories.summaryPortfolioValue)
        + getAssetAmount(assetCategories.summaryLiquidCash)
        + getAssetAmount(assetCategories.summaryRealEstateAssets);
}

export function getSummaryLiabilityTotal(liabilityCategories = {}, hasEMI = false) {
    let total = getAssetAmount(liabilityCategories.summaryCreditCardDues)
        + getAssetAmount(liabilityCategories.summaryOtherPayables);
    if (hasEMI) {
        total += getAssetAmount(liabilityCategories.summaryOutstandingLoans);
    }
    return total;
}

/** Move legacy others.other into custom[] once; preserve value. */
export function migrateLegacyOtherAsset(assetCategories = {}) {
    const otherVal = assetCategories.others?.other;
    if (!otherVal || getAssetAmount(otherVal) <= 0) {
        return assetCategories;
    }
    const custom = Array.isArray(assetCategories.custom) ? [...assetCategories.custom] : [];
    const alreadyMigrated = custom.some((c) => c.label === 'Other Assets' && getAssetAmount(c.value) === getAssetAmount(otherVal));
    if (alreadyMigrated) {
        return { ...assetCategories, others: { ...assetCategories.others, other: '' } };
    }
    return {
        ...assetCategories,
        others: { ...assetCategories.others, other: '' },
        custom: [...custom, { label: 'Other Assets', value: String(getAssetAmount(otherVal)) }],
    };
}

function blankAssetDetailFields(assetCategories = {}) {
    return {
        realEstate: { residential: '', secondProperty: '', landPlot: '' },
        vehicles: { idv: '' },
        valuables: { gold: '', art: '' },
        cash: { savings: '', cashInHand: '' },
        investments: {
            equity: '',
            mutualFunds: '',
            fixedDeposit: '',
            recurringDeposit: assetCategories.investments?.recurringDeposit || '',
        },
        insurance: {
            savingPlans: assetCategories.insurance?.savingPlans || '',
            ulip: '',
        },
        retirement: { epf: '', ppf: '', nps: '' },
        custom: [],
    };
}

function blankLiabilityDetailFields() {
    return {
        loans: {
            home: '',
            personal: '',
            car: '',
            twoWheeler: '',
            education: '',
            otherEmis: '',
            creditCard: '',
        },
        custom: [],
    };
}

/**
 * Preserve summary recap totals separately and clear breakdown fields
 * so detailed My Wealth Snapshot starts blank (mirrors savings/EMI init).
 */
export function initializeWealthSnapshots(assetCategories = {}, liabilityCategories = {}) {
    let migrated = migrateLegacyOtherAsset(assetCategories);
    const synced = syncSummaryWealthSnapshots(migrated, liabilityCategories);

    const assetDetailEntered = hasWealthDetailEntered(migrated);
    const liabilityDetailEntered = hasLiabilityDetailEntered(liabilityCategories);

    const nextAssets = {
        ...migrated,
        summaryPortfolioValue: synced.summaryPortfolioValue,
        summaryLiquidCash: synced.summaryLiquidCash,
        summaryRealEstateAssets: synced.summaryRealEstateAssets,
        ...(assetDetailEntered ? {} : blankAssetDetailFields(migrated)),
    };

    const nextLiabilities = {
        ...liabilityCategories,
        summaryOutstandingLoans: synced.summaryOutstandingLoans,
        summaryCreditCardDues: synced.summaryCreditCardDues,
        summaryOtherPayables: synced.summaryOtherPayables,
        ...(liabilityDetailEntered ? {} : blankLiabilityDetailFields()),
    };

    return {
        assetCategories: nextAssets,
        liabilityCategories: nextLiabilities,
    };
}

/**
 * Classify assets for reporting: Legacy, Income, Retirement.
 * Summary snapshot fields are excluded — only detailed breakdown counts.
 */
export function classifyWealthSnapshot(assetCategories = {}) {
    if (!hasWealthDetailEntered(assetCategories)) {
        const portfolio = getAssetAmount(assetCategories.summaryPortfolioValue);
        const liquid = getAssetAmount(assetCategories.summaryLiquidCash);
        const realEstate = getAssetAmount(assetCategories.summaryRealEstateAssets);
        const summaryTotal = portfolio + liquid + realEstate;
        if (summaryTotal > 0) {
            return {
                legacyTotal: realEstate,
                incomeTotal: portfolio + liquid,
                retirementTotal: 0,
                grandTotal: summaryTotal,
                legacyPercent: (realEstate / summaryTotal) * 100,
                incomePercent: ((portfolio + liquid) / summaryTotal) * 100,
                retirementPercent: 0,
            };
        }
    }

    let legacy = [
        getAssetAmount(assetCategories.realEstate?.residential),
        getAssetAmount(assetCategories.realEstate?.secondProperty),
        getAssetAmount(assetCategories.vehicles?.idv),
        getAssetAmount(assetCategories.valuables?.gold),
        getAssetAmount(assetCategories.valuables?.art),
        ...(Array.isArray(assetCategories.custom)
            ? assetCategories.custom.map((c) => getAssetAmount(c?.value))
            : []),
    ].reduce((s, v) => s + v, 0);

    let income = [
        getAssetAmount(assetCategories.realEstate?.landPlot),
        getAssetAmount(assetCategories.cash?.savings),
        getAssetAmount(assetCategories.cash?.cashInHand),
        getAssetAmount(assetCategories.investments?.equity),
        getAssetAmount(assetCategories.investments?.mutualFunds),
        sumFixedDeposits(assetCategories.investments?.fixedDeposit),
        getAssetAmount(assetCategories.insurance?.ulip),
    ].reduce((s, v) => s + v, 0);

    let retirement = [
        getAssetAmount(assetCategories.retirement?.epf),
        getAssetAmount(assetCategories.retirement?.ppf),
        getAssetAmount(assetCategories.retirement?.nps),
    ].reduce((s, v) => s + v, 0);

    // Fallback to summary snapshot fields for any bucket that has no detailed values
    if (legacy === 0) {
        legacy = getAssetAmount(assetCategories.summaryRealEstateAssets);
    }
    if (income === 0) {
        income = getAssetAmount(assetCategories.summaryPortfolioValue) + getAssetAmount(assetCategories.summaryLiquidCash);
    }

    const grandTotal = legacy + income + retirement;

    return {
        legacyTotal: legacy,
        incomeTotal: income,
        retirementTotal: retirement,
        grandTotal,
        legacyPercent: grandTotal > 0 ? (legacy / grandTotal) * 100 : 0,
        incomePercent: grandTotal > 0 ? (income / grandTotal) * 100 : 0,
        retirementPercent: grandTotal > 0 ? (retirement / grandTotal) * 100 : 0,
    };
}

/** Emergency fund from detailed cash, summary liquid cash, or legacy contingency field. */
export function getEmergencyFundAmount(assetCategories = {}, contingencyFund = '') {
    const fromDetail = getAssetAmount(assetCategories.cash?.savings);
    if (fromDetail > 0) return fromDetail;
    const fromSummary = getAssetAmount(assetCategories.summaryLiquidCash);
    if (fromSummary > 0) return fromSummary;
    return parseFloat(contingencyFund) || 0;
}

/**
 * Keep summary liquid cash and detailed bank savings aligned.
 * Safety Net prefers cash.savings when set, so summary-only edits (smart edit /
 * summary flow) must also update the detail slot or the report stays stale.
 */
export function syncEmergencyFundAmount(assetCategories = {}, amount) {
    const normalized = amount === null || amount === undefined ? '' : String(amount);
    return {
        ...assetCategories,
        summaryLiquidCash: normalized,
        cash: {
            ...(assetCategories.cash || {}),
            savings: normalized,
        },
    };
}

/** Investment portfolio bucket from detailed fields. */
export function getPortfolioBreakdownTotal(assetCategories = {}) {
    return [
        getAssetAmount(assetCategories.investments?.equity),
        getAssetAmount(assetCategories.investments?.mutualFunds),
        sumFixedDeposits(assetCategories.investments?.fixedDeposit),
        getAssetAmount(assetCategories.insurance?.ulip),
        getAssetAmount(assetCategories.retirement?.epf),
        getAssetAmount(assetCategories.retirement?.ppf),
        getAssetAmount(assetCategories.retirement?.nps),
        getAssetAmount(assetCategories.realEstate?.landPlot),
    ].reduce((sum, val) => sum + val, 0);
}

/** Liquid cash bucket from detailed fields. */
export function getLiquidBreakdownTotal(assetCategories = {}) {
    return getAssetAmount(assetCategories.cash?.savings)
        + getAssetAmount(assetCategories.cash?.cashInHand);
}

/** Real estate / high-value assets bucket from detailed fields. */
export function getLegacyHighValueBreakdownTotal(assetCategories = {}) {
    let total = getAssetAmount(assetCategories.realEstate?.residential)
        + getAssetAmount(assetCategories.realEstate?.secondProperty)
        + getAssetAmount(assetCategories.vehicles?.idv)
        + getAssetAmount(assetCategories.valuables?.gold)
        + getAssetAmount(assetCategories.valuables?.art);
    if (Array.isArray(assetCategories.custom)) {
        total += assetCategories.custom.reduce((sum, c) => sum + getAssetAmount(c?.value), 0);
    }
    return total;
}

export function getTotalAssetBreakdownTotal(assetCategories = {}) {
    return getPortfolioBreakdownTotal(assetCategories)
        + getLiquidBreakdownTotal(assetCategories)
        + getLegacyHighValueBreakdownTotal(assetCategories);
}

/** Outstanding loan balances from detailed liability fields (excl. credit card & other payables). */
export function getOutstandingLoansBreakdownTotal(liabilityCategories = {}) {
    const loans = liabilityCategories.loans || {};
    return ['home', 'car', 'twoWheeler', 'education', 'otherEmis'].reduce(
        (sum, key) => sum + getAssetAmount(loans[key]),
        0,
    );
}

export function getCreditCardBreakdownTotal(liabilityCategories = {}) {
    return getAssetAmount(liabilityCategories.loans?.creditCard);
}

export function getOtherPayablesBreakdownTotal(liabilityCategories = {}) {
    const loans = liabilityCategories.loans || {};
    let total = getAssetAmount(loans.personal);
    if (Array.isArray(liabilityCategories.custom)) {
        total += liabilityCategories.custom.reduce((sum, c) => sum + getAssetAmount(c?.value), 0);
    }
    return total;
}

export function getTotalLiabilityBreakdownTotal(liabilityCategories = {}, hasEMI = false) {
    let total = getCreditCardBreakdownTotal(liabilityCategories)
        + getOtherPayablesBreakdownTotal(liabilityCategories);
    if (hasEMI) {
        total += getOutstandingLoansBreakdownTotal(liabilityCategories);
    }
    return total;
}

export function reconcileWealthBuckets(assetCategories = {}) {
    return {
        portfolio: reconcileAmounts(
            assetCategories.summaryPortfolioValue,
            getPortfolioBreakdownTotal(assetCategories),
        ),
        liquid: reconcileAmounts(
            assetCategories.summaryLiquidCash,
            getLiquidBreakdownTotal(assetCategories),
        ),
        legacy: reconcileAmounts(
            assetCategories.summaryRealEstateAssets,
            getLegacyHighValueBreakdownTotal(assetCategories),
        ),
    };
}

export function reconcileLiabilityBuckets(liabilityCategories = {}, hasEMI = false) {
    return {
        outstandingLoans: hasEMI
            ? reconcileAmounts(
                liabilityCategories.summaryOutstandingLoans,
                getOutstandingLoansBreakdownTotal(liabilityCategories),
            )
            : { summaryTotal: 0, detailTotal: 0, delta: 0, status: 'empty' },
        creditCard: reconcileAmounts(
            liabilityCategories.summaryCreditCardDues,
            getCreditCardBreakdownTotal(liabilityCategories),
        ),
        otherPayables: reconcileAmounts(
            liabilityCategories.summaryOtherPayables,
            getOtherPayablesBreakdownTotal(liabilityCategories),
        ),
    };
}
