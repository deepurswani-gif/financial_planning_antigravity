/**
 * MoneyStoryLogic.js
 * Pure calculation module for the "Your Money Story" report section.
 * No React imports — just data transformations.
 */

import { classifyWealthSnapshot, getAssetAmount, hasWealthDetailEntered, hasLiabilityDetailEntered } from '../DetailedFlow/wealthDetailSync';

/**
 * Classify assets into Income Assets vs Legacy Assets.
 * Retirement is tracked separately via classifyWealthSnapshot.
 */
export const classifyAssets = (assetCategories) => {
    const { legacyTotal, incomeTotal, retirementTotal, grandTotal, legacyPercent, incomePercent, retirementPercent } = classifyWealthSnapshot(assetCategories);

    const incomeBreakdown = [];
    const legacyBreakdown = [];

    if (incomeTotal > 0) incomeBreakdown.push({ category: 'Income Assets', value: incomeTotal });
    if (legacyTotal > 0) legacyBreakdown.push({ category: 'Legacy Assets', value: legacyTotal });
    if (retirementTotal > 0) incomeBreakdown.push({ category: 'Retirement Accounts', value: retirementTotal });

    return {
        incomeTotal: incomeTotal + retirementTotal,
        legacyTotal,
        retirementTotal,
        grandTotal,
        incomePercent: grandTotal > 0 ? ((incomeTotal + retirementTotal) / grandTotal) * 100 : 0,
        legacyPercent,
        retirementPercent,
        incomeBreakdown,
        legacyBreakdown,
    };
};

/**
 * Calculate unallocated surplus from cash flow results.
 * Unallocated = Surplus - Existing Savings/Investments
 */
export const calculateUnallocatedSurplus = (cashFlowResults) => {
    const surplus = cashFlowResults.surplus || 0;
    const totalSavings = cashFlowResults.totalSavings || 0;
    const unallocated = surplus - totalSavings;
    return {
        surplus,
        totalSavings,
        unallocated,
        yearlyUnallocated: unallocated * 12
    };
};

/**
 * Calculate owned vs financed percentage.
 */
export const calculateOwnedVsFinanced = (totalAssets, totalLiabilities) => {
    const total = totalAssets + totalLiabilities;
    if (total === 0) return { ownedPercent: 100, financedPercent: 0 };
    const ownedPercent = (totalAssets / (totalAssets + totalLiabilities)) * 100;
    const financedPercent = 100 - ownedPercent;
    return { ownedPercent, financedPercent };
};

/**
 * Compute SIP projection using future value of annuity formula.
 * FV = P × [((1 + r)^n - 1) / r] × (1 + r)
 * @param {number} monthlyAmount - Monthly SIP amount
 * @param {number} annualRate - Annual expected return rate (e.g. 12 for 12%)
 * @param {number} years - Investment duration in years
 */
export const computeSIPProjection = (monthlyAmount, annualRate = 12, years = 10) => {
    if (monthlyAmount <= 0 || years <= 0) return { futureValue: 0, totalInvested: 0, wealthGained: 0 };
    
    const r = (annualRate / 100) / 12; // Monthly rate
    const n = years * 12; // Total months
    const totalInvested = monthlyAmount * n;
    
    // FV of annuity due (invested at beginning of each month)
    const futureValue = monthlyAmount * (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
    const wealthGained = futureValue - totalInvested;

    return {
        futureValue: Math.round(futureValue),
        totalInvested: Math.round(totalInvested),
        wealthGained: Math.round(wealthGained),
        monthlyAmount,
        annualRate,
        years
    };
};

/**
 * Build waterfall chart data from cash flow results.
 * Shows Income → -Expenses → -EMIs → -Savings → = Unallocated Surplus
 */
export const buildWaterfallData = (cashFlowResults) => {
    const income = cashFlowResults.totalIncome || 0;
    const household = cashFlowResults.categorySums?.household || 0;
    const emi = cashFlowResults.categorySums?.emi || 0;
    const insurance = cashFlowResults.categorySums?.insurance || 0;
    const savings = cashFlowResults.totalSavings || 0;
    const expenses = household + insurance; // Household + Insurance = living expenses (EMI separate)
    const unallocated = income - expenses - emi - savings;

    return [
        {
            name: 'Income',
            value: income,
            fill: '#10B981',
            // For waterfall: base is 0, top is income
            base: 0,
            top: income
        },
        {
            name: 'Expenses',
            value: expenses,
            fill: '#EF4444',
            base: income - expenses,
            top: income
        },
        {
            name: 'EMIs',
            value: emi,
            fill: '#F59E0B',
            base: income - expenses - emi,
            top: income - expenses
        },
        {
            name: 'Savings',
            value: savings,
            fill: '#6366F1',
            base: income - expenses - emi - savings,
            top: income - expenses - emi
        },
        {
            name: 'Surplus',
            value: Math.max(0, unallocated),
            fill: '#00A9F2',
            base: 0,
            top: Math.max(0, unallocated)
        }
    ];
};

/**
 * Build asset breakdown data for visualization.
 * Groups by major category with percentage.
 */
const buildDetailAssetBreakdownData = (assetCategories, totalAssets) => {
    const categories = [
        { key: 'realEstate', label: 'Real Estate', color: '#6366F1' },
        { key: 'cash', label: 'Bank Savings', color: '#10B981' },
        { key: 'investments', label: 'Investments', color: '#00A9F2' },
        { key: 'retirement', label: 'Retirement', color: '#F59E0B' },
        { key: 'insurance', label: 'Insurance', color: '#8B5CF6' },
        { key: 'valuables', label: 'Gold & Valuables', color: '#EC4899' },
        { key: 'vehicles', label: 'Vehicles', color: '#64748B' },
        { key: 'others', label: 'Others', color: '#94A3B8' }
    ];

    return categories.map(cat => {
        const items = assetCategories[cat.key];
        if (!items || typeof items !== 'object') return null;
        const total = Array.isArray(items)
            ? items.reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0)
            : Object.values(items).reduce((sum, val) => sum + getAssetAmount(val), 0);
        if (total <= 0) return null;
        return {
            name: cat.label,
            value: total,
            percentage: Math.round((total / totalAssets) * 100),
            color: cat.color
        };
    }).filter(Boolean).sort((a, b) => b.value - a.value);
};

/** Fallback breakdown from summary-flow snapshot fields when detail fields are blank. */
function buildSummaryAssetBreakdownData(assetCategories, totalAssets) {
    const snapshots = [
        { key: 'summaryPortfolioValue', label: 'Investments', color: '#00A9F2' },
        { key: 'summaryLiquidCash', label: 'Bank Savings', color: '#10B981' },
        { key: 'summaryRealEstateAssets', label: 'Real Estate', color: '#6366F1' },
    ];

    return snapshots
        .map((snap) => {
            const value = getAssetAmount(assetCategories[snap.key]);
            if (value <= 0) return null;
            return {
                name: snap.label,
                value,
                percentage: Math.round((value / totalAssets) * 100),
                color: snap.color,
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.value - a.value);
}

export const buildAssetBreakdownData = (assetCategories, totalAssets) => {
    if (totalAssets <= 0) return [];

    const detailBreakdown = buildDetailAssetBreakdownData(assetCategories, totalAssets);
    if (detailBreakdown.length > 0) return detailBreakdown;
    if (!hasWealthDetailEntered(assetCategories)) {
        return buildSummaryAssetBreakdownData(assetCategories, totalAssets);
    }
    return detailBreakdown;
};

/**
 * Build liability breakdown data for visualization.
 */
export const buildLiabilityBreakdownData = (liabilityCategories, totalLiabilities) => {
    if (totalLiabilities <= 0) return [];

    const labels = {
        home: 'Outstanding Loans',
        personal: 'Other Payables',
        car: 'Car Loan',
        education: 'Education Loan',
        otherEmis: 'Other EMIs',
        creditCard: 'Credit Card Dues'
    };

    const result = [];
    const loans = liabilityCategories.loans || {};

    Object.entries(loans).forEach(([key, value]) => {
        const amount = getAssetAmount(value);
        if (amount > 0) {
            result.push({
                name: labels[key] || key,
                value: amount,
                percentage: Math.round((amount / totalLiabilities) * 100)
            });
        }
    });

    // Custom liabilities
    if (Array.isArray(liabilityCategories.custom)) {
        liabilityCategories.custom.forEach(item => {
            const amount = parseFloat(item.value) || 0;
            if (amount > 0) {
                result.push({
                    name: item.label || 'Other',
                    value: amount,
                    percentage: Math.round((amount / totalLiabilities) * 100)
                });
            }
        });
    }

    if (result.length > 0) return result.sort((a, b) => b.value - a.value);

    if (!hasLiabilityDetailEntered(liabilityCategories)) {
        const snapshots = [
            { key: 'summaryOutstandingLoans', label: 'Outstanding Loans' },
            { key: 'summaryCreditCardDues', label: 'Credit Card Dues' },
            { key: 'summaryOtherPayables', label: 'Other Payables' },
        ];
        snapshots.forEach((snap) => {
            const amount = getAssetAmount(liabilityCategories[snap.key]);
            if (amount > 0) {
                result.push({
                    name: snap.label,
                    value: amount,
                    percentage: Math.round((amount / totalLiabilities) * 100),
                });
            }
        });
    }

    return result.sort((a, b) => b.value - a.value);
};

/**
 * Format number in Indian style with lakhs/crores abbreviation.
 */
export const formatCompact = (amount) => {
    if (amount >= 10000000) {
        return `₹${(amount / 10000000).toFixed(2)} Cr`;
    } else if (amount >= 100000) {
        return `₹${(amount / 100000).toFixed(2)} L`;
    }
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};
