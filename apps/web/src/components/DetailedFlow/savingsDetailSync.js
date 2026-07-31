/** Parse monthly amount from scalar, configured object, or RD array item. */
export function getSavingsMonthlyAmount(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (Array.isArray(val)) {
        return val.reduce((sum, item) => sum + getSavingsMonthlyAmount(item), 0);
    }
    if (typeof val === 'object' && val.amount !== undefined) {
        return parseFloat(val.amount) || 0;
    }
    return parseFloat(val) || 0;
}

export function isConfiguredInvestment(val) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        return parseFloat(val.amount) > 0;
    }
    if (Array.isArray(val)) {
        return val.some((item) => getSavingsMonthlyAmount(item) > 0);
    }
    return false;
}

export function hasConfiguredInvestmentObjects(savings = {}) {
    return isConfiguredInvestment(savings.ppf)
        || isConfiguredInvestment(savings.nps)
        || isConfiguredInvestment(savings.rd);
}

export function sumConfiguredSavings(savings = {}) {
    return ['sip', 'ppf', 'nps', 'otherSaving'].reduce(
        (sum, key) => sum + getSavingsMonthlyAmount(savings[key]),
        getSavingsMonthlyAmount(savings.rd),
    );
}

export function hasConfiguredSavings(savings = {}) {
    return sumConfiguredSavings(savings) > 0;
}

export function hasSavingsBreakdown(savings = {}) {
    return hasConfiguredSavings(savings);
}

export function getSummarySavingsTotal(expenseCategories = {}) {
    return (parseFloat(expenseCategories.summaryMonthlyInvestments) || 0)
        + (parseFloat(expenseCategories.summaryOtherSavings) || 0);
}

/**
 * Growth-oriented monthly investments (SIP + PPF + NPS).
 * Excludes safer buckets such as RD / otherSaving used for emergency-style saving.
 */
export function getGrowthSavingsMonthly(expenseCategories = {}) {
    const savings = expenseCategories.savings || {};
    return getSavingsMonthlyAmount(savings.sip)
        + getSavingsMonthlyAmount(savings.ppf)
        + getSavingsMonthlyAmount(savings.nps);
}

export function getEffectiveMonthlySavings(expenseCategories = {}) {
    const configured = sumConfiguredSavings(expenseCategories.savings);
    if (configured > 0) return configured;
    return getSummarySavingsTotal(expenseCategories);
}

/** Summary flow stored broad monthly investments in savings.sip as a lone scalar. */
export function isLikelySummaryInSip(savings = {}, summaryMonthlyInvestments = '') {
    const sip = savings.sip;
    if (sip !== null && typeof sip === 'object') return false;

    const sipAmount = parseFloat(sip) || 0;
    if (sipAmount <= 0) return false;

    const othersEmpty = ['ppf', 'nps', 'otherSaving'].every(
        (key) => getSavingsMonthlyAmount(savings[key]) <= 0,
    );
    const rdEmpty = getSavingsMonthlyAmount(savings.rd) <= 0;
    if (!othersEmpty || !rdEmpty) return false;

    if (!summaryMonthlyInvestments) return true;

    return String(sipAmount) === String(parseFloat(summaryMonthlyInvestments));
}

/** Summary flow stored safer savings in savings.otherSaving as a lone scalar. */
export function isLikelySummaryInOtherSaving(savings = {}, summaryOtherSavings = '') {
    const other = savings.otherSaving;
    if (other !== null && typeof other === 'object') return false;

    const otherAmount = parseFloat(other) || 0;
    if (otherAmount <= 0) return false;

    if (!summaryOtherSavings) return true;

    return String(otherAmount) === String(parseFloat(summaryOtherSavings));
}

/** Legacy summary step stored totals in savings.sip / otherSaving before snapshot fields existed. */
export function isLegacySummaryOnlyStorage(savings = {}, expenseCategories = {}) {
    if (expenseCategories.summaryMonthlyInvestments || expenseCategories.summaryOtherSavings) {
        return false;
    }
    if (hasConfiguredInvestmentObjects(savings)) {
        return false;
    }
    return getSavingsMonthlyAmount(savings.sip) > 0 || getSavingsMonthlyAmount(savings.otherSaving) > 0;
}

/** Migrate legacy scalars into snapshot fields without double-counting. */
export function syncSummarySavingsSnapshots(expenseCategories = {}) {
    const savings = expenseCategories.savings || {};
    let summaryInvest = expenseCategories.summaryMonthlyInvestments ?? '';
    let summaryOther = expenseCategories.summaryOtherSavings ?? '';

    if (hasConfiguredInvestmentObjects(savings)) {
        return { summaryMonthlyInvestments: summaryInvest, summaryOtherSavings: summaryOther };
    }

    const sipScalar = savings.sip && typeof savings.sip !== 'object'
        ? String(parseFloat(savings.sip) || '')
        : '';
    const otherScalar = savings.otherSaving && typeof savings.otherSaving !== 'object'
        ? String(parseFloat(savings.otherSaving) || '')
        : '';

    if (sipScalar && !getSavingsMonthlyAmount(savings.otherSaving)) {
        if (!summaryInvest || sipScalar !== String(parseFloat(summaryInvest) || '')) {
            summaryInvest = sipScalar;
        }
    }

    if (otherScalar && !getSavingsMonthlyAmount(savings.sip)) {
        if (!summaryOther || otherScalar !== String(parseFloat(summaryOther) || '')) {
            summaryOther = otherScalar;
        }
    }

    return { summaryMonthlyInvestments: summaryInvest, summaryOtherSavings: summaryOther };
}

/**
 * Preserve summary totals separately and clear savings breakdown fields
 * so detailed Money in & Money out starts blank (mirrors EMI/household init).
 */
export function initializeSavingsSnapshots(expenseCategories = {}) {
    const savings = expenseCategories.savings || {};

    if (isLegacySummaryOnlyStorage(savings, expenseCategories)) {
        const synced = syncSummarySavingsSnapshots(expenseCategories);
        return {
            ...expenseCategories,
            ...synced,
            savings: {
                sip: '',
                ppf: '',
                nps: '',
                rd: '',
                otherSaving: '',
            },
        };
    }

    const synced = syncSummarySavingsSnapshots(expenseCategories);
    const detailEntered = hasConfiguredSavings(savings);

    return {
        ...expenseCategories,
        ...synced,
        savings: detailEntered ? savings : {
            sip: '',
            ppf: '',
            nps: '',
            rd: '',
            otherSaving: '',
        },
    };
}

export function buildSavingsBreakdownAnnual(expenseCategories = {}) {
    const savings = expenseCategories.savings || {};
    const monthly = (val) => getSavingsMonthlyAmount(val) * 12;

    if (hasConfiguredSavings(savings)) {
        const rdList = Array.isArray(savings.rd)
            ? savings.rd
            : (savings.rd ? [savings.rd] : []);

        return {
            rdList,
            rdTotal: monthly(savings.rd),
            ppf: monthly(savings.ppf),
            nps: monthly(savings.nps),
            sip: monthly(savings.sip),
            otherSaving: monthly(savings.otherSaving),
        };
    }

    return {
        rdList: [],
        rdTotal: 0,
        ppf: 0,
        nps: 0,
        sip: (parseFloat(expenseCategories.summaryMonthlyInvestments) || 0) * 12,
        otherSaving: (parseFloat(expenseCategories.summaryOtherSavings) || 0) * 12,
    };
}
