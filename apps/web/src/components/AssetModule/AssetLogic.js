import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import {
    getAssetAmount,
    hasWealthDetailEntered,
    hasLiabilityDetailEntered,
    getSummaryAssetTotal,
    getSummaryLiabilityTotal,
} from '../DetailedFlow/wealthDetailSync';

export const calculateNetWorth = (assetCategories, liabilityCategories) => {
    const assetBreakdown = [];

    // Helper to process categories safely
    const processItems = (categories, isAsset = true) => {
        let total = 0;
        if (!categories) return total;

        // Define valid categories to prevent summing ghost/old keys
        const validCategories = [
            'realEstate', 'vehicles', 'valuables', 'cash', 'investments', 
            'insurance', 'retirement', 'others', 'loans', 'custom'
        ];

        Object.entries(categories).forEach(([catKey, items]) => {
            // Only process if it's a known category
            if (!validCategories.includes(catKey)) return;

            if (catKey === 'custom' && Array.isArray(items)) {
                items.forEach(item => {
                    const amount = parseFloat(item.value) || 0;
                    total += amount;
                    if (isAsset && amount > 0) {
                        assetBreakdown.push({
                            name: item.label || 'Other Asset',
                            category: 'Custom Assets',
                            value: amount
                        });
                    }
                });
            } else if (typeof items === 'object' && items !== null) {
                Object.entries(items).forEach(([itemKey, value]) => {
                    const amount = getAssetAmount(value);
                    total += amount;
                    if (isAsset && amount > 0) {
                        assetBreakdown.push({
                            name: getItemLabel(itemKey),
                            category: getCategoryLabel(catKey),
                            value: amount
                        });
                    }
                });
            }
        });
        return total;
    };

    let totalAssets = processItems(assetCategories, true);
    let totalLiabilities = processItems(liabilityCategories, false);

    if (!hasWealthDetailEntered(assetCategories)) {
        totalAssets += getSummaryAssetTotal(assetCategories);
    }
    if (!hasLiabilityDetailEntered(liabilityCategories)) {
        const includeLoans = getAssetAmount(liabilityCategories.summaryOutstandingLoans) > 0;
        totalLiabilities += getSummaryLiabilityTotal(liabilityCategories, includeLoans);
    }

    const netWorth = totalAssets - totalLiabilities;

    return {
        totalAssets,
        totalLiabilities,
        netWorth,
        assetBreakdown,
        allocation: calculateAllocation(assetBreakdown, totalAssets)
    };
};

const calculateAllocation = (breakdown, total) => {
    if (total === 0) return [];
    // Group by category for high-level allocation
    const grouped = breakdown.reduce((acc, item) => {
        const category = item.category || 'Others';
        acc[category] = (acc[category] || 0) + item.value;
        return acc;
    }, {});

    return Object.entries(grouped).map(([name, value]) => ({
        name,
        value,
        percentage: (value / total) * 100
    }));
};

export const getCategoryLabel = (key) => {
    const labels = {
        realEstate: 'Real Estate',
        vehicles: 'Vehicles',
        valuables: 'Valuables & Art',
        cash: 'Liquid Assets',
        investments: 'Investments',
        insurance: 'Insurance (Cash Value)',
        retirement: 'Retirement Accounts',
        others: 'Other Assets',
        loans: 'Liabilities / Loans',
        custom: 'Custom Items'
    };
    return labels[key] || key;
};

export const getItemLabel = (key) => {
    const labels = {
        // Assets
        residential: 'Residential House',
        secondProperty: 'Second Property',
        landPlot: 'Land / Plot (Investment Purpose)',
        idv: 'Vehicles (IDV)',
        gold: 'Gold Jewellery',
        art: 'Art / Collectibles',
        savings: 'Bank Savings',
        cashInHand: 'Cash-in-hand',
        equity: 'Equity Investments',
        mutualFunds: 'Mutual Funds Portfolio',
        fixedDeposit: 'Fixed Deposit',
        recurringDeposit: 'Recurring Deposit',
        savingPlans: 'Saving Plans',
        ulip: 'ULIP',
        epf: 'EPF',
        ppf: 'PPF',
        nps: 'NPS',
        other: 'Other Assets',

        // Liabilities
        home: 'Home Loan',
        personal: 'Personal Loan',
        car: 'Car Loan',
        education: 'Education Loan',
        otherEmis: 'Other EMIs',
        creditCard: 'Credit Card'
    };
    return labels[key] || key;
};
