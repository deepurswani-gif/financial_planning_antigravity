import { getEffectiveMonthlyEmi, sumConfiguredEmis } from '../DetailedFlow/expenseDetailSync';

export const convertToMonthly = (value, frequency) => {
    const val = parseFloat(value) || 0;
    switch (frequency) {
        case 'Annual':
        case 'Annually': return val / 12;
        case 'Half Yearly':
        case 'Half-Yearly': return val / 6;
        case 'Quarterly': return val / 3;
        case 'Monthly': return val;
        default: return val;
    }
};

export const convertToAnnual = (value, frequency) => {
    const val = parseFloat(value) || 0;
    switch (frequency) {
        case 'Annual':
        case 'Annually': return val;
        case 'Half Yearly':
        case 'Half-Yearly': return val * 2;
        case 'Quarterly': return val * 4;
        case 'Monthly': return val * 12;
        default: return val;
    }
};

export const calculateCashFlow = (income, expenseCategories) => {
    const totalIncome = (parseFloat(income.self) || 0) + 
                       (parseFloat(income.selfBonus) || 0) + 
                       (parseFloat(income.selfPassive) || 0) + 
                       (parseFloat(income.selfOther) || 0) +
                       (parseFloat(income.spouse) || 0) + 
                       (parseFloat(income.spouseBonus) || 0) + 
                       (parseFloat(income.spousePassive) || 0) + 
                       (parseFloat(income.spouseOther) || 0) +
                       (parseFloat(income.family) || 0);

    const householdSum = Object.values(expenseCategories.household || {}).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const emiSum = getEffectiveMonthlyEmi(expenseCategories);
    
    // Insurance specialized handling for nested life insurance
    const insuranceSum = Object.entries(expenseCategories.insurance || {}).reduce((sum, [key, item]) => {
        if (key === 'life') {
            const lifeTotalMonthly = Object.values(item || {}).reduce((lSum, lItem) => lSum + convertToMonthly(lItem.value, lItem.frequency), 0);
            return sum + lifeTotalMonthly;
        }
        return sum + convertToMonthly(item.value, item.frequency);
    }, 0);

    const savingsSum = Object.values(expenseCategories.savings || {}).reduce((sum, val) => {
        if (Array.isArray(val)) {
            return sum + val.reduce((arrSum, item) => arrSum + (parseFloat(item?.amount !== undefined ? item.amount : item) || 0), 0);
        }
        return sum + (parseFloat(val?.amount !== undefined ? val.amount : val) || 0);
    }, 0);

    const categorySums = {
        household: householdSum,
        emi: emiSum,
        insurance: insuranceSum,
        savings: savingsSum
    };

    // Total expenses = A (Household) + B1 (EMIs) + B2 (Insurance)
    const totalExpenses = householdSum + emiSum + insuranceSum;
    const surplus = totalIncome - totalExpenses;
    const surplusRate = totalIncome > 0 ? (surplus / totalIncome) * 100 : 0;

    // Ratios
    const householdRatio = totalIncome > 0 ? (householdSum / totalIncome) * 100 : 0;
    const emiRatio = totalIncome > 0 ? (emiSum / totalIncome) * 100 : 0;
    const insuranceRatio = totalIncome > 0 ? (insuranceSum / totalIncome) * 100 : 0;
    const savingsRatio = totalIncome > 0 ? (savingsSum / totalIncome) * 100 : 0;

    const expenseBreakdown = [];
    // Regular categories
    ['household', 'emi', 'savings'].forEach(cat => {
        Object.entries(expenseCategories[cat] || {}).forEach(([itemKey, value]) => {
            if (Array.isArray(value)) {
                value.forEach((v, idx) => {
                    let amount = parseFloat(v?.amount !== undefined ? v.amount : v) || 0;
                    if (amount > 0) {
                        expenseBreakdown.push({
                            name: `${getItemLabel(itemKey)} #${idx + 1}`,
                            category: getCategoryLabel(cat),
                            value: amount
                        });
                    }
                });
            } else {
                let amount = 0;
                if (cat === 'emi' && value !== null && typeof value === 'object') {
                    amount = parseFloat(value.emi) || 0;
                } else if (value !== null && typeof value === 'object' && value.amount !== undefined) {
                    amount = parseFloat(value.amount) || 0;
                } else {
                    amount = parseFloat(value) || 0;
                }
                if (amount > 0) {
                    expenseBreakdown.push({
                        name: getItemLabel(itemKey),
                        category: getCategoryLabel(cat),
                        value: amount
                    });
                }
            }
        });
    });
    if (emiSum > 0 && sumConfiguredEmis(expenseCategories.emi) === 0 && parseFloat(expenseCategories.summaryEmiTotal) > 0) {
        expenseBreakdown.push({
            name: 'Monthly EMI (Summary)',
            category: getCategoryLabel('emi'),
            value: parseFloat(expenseCategories.summaryEmiTotal),
        });
    }
    // Insurance specialized handling
    Object.entries(expenseCategories.insurance || {}).forEach(([itemKey, item]) => {
        if (itemKey === 'life') {
            Object.entries(item || {}).forEach(([memberName, lItem]) => {
                const monthlyAmount = convertToMonthly(lItem.value, lItem.frequency);
                if (monthlyAmount > 0) {
                    expenseBreakdown.push({
                        name: `Life Insurance Premium (${memberName})`,
                        category: getCategoryLabel('insurance'),
                        value: monthlyAmount
                    });
                }
            });
        } else {
            const monthlyAmount = convertToMonthly(item.value, item.frequency);
            if (monthlyAmount > 0) {
                expenseBreakdown.push({
                    name: getItemLabel(itemKey),
                    category: getCategoryLabel('insurance'),
                    value: monthlyAmount
                });
            }
        }
    });

    const totalSavings = savingsSum;
    const disposableIncome = surplus - totalSavings;
    const disposableIncomeRate = totalIncome > 0 ? (disposableIncome / totalIncome) * 100 : 0;

    return {
        totalIncome,
        categorySums,
        totalExpenses,
        totalSavings,
        surplus,
        disposableIncome,
        surplusRate,
        disposableIncomeRate,
        householdRatio,
        emiRatio,
        insuranceRatio,
        savingsRatio,
        expenseBreakdown,
        isHealthy: surplusRate >= 20,
        isCritical: surplusRate < 0 || disposableIncome < 0
    };
};

const getCategoryLabel = (key) => {
    const labels = {
        household: 'Household & Lifestyle',
        emi: 'EMIs',
        insurance: 'Insurance Premiums',
        savings: 'Savings & Investments'
    };
    return labels[key] || key;
};

const getItemLabel = (key) => {
    const labels = {
        // Household & Lifestyle
        grocery: 'Household (Grocery, LPG, Fuel etc.)',
        rent: 'House Rent',
        education: 'Children Education',
        lifestyle: 'Lifestyle (Shopping, Movies, Dinner etc.)',
        medical: 'Medical Expenses',
        travel: 'Travel',

        // EMIs
        personalLoan: 'Personal Loan EMI',
        homeLoan: 'Home Loan EMI',
        educationLoan: 'Education Loan EMI',
        carLoan: 'Car Loan EMI',
        twoWheelerLoan: 'Two Wheeler Loan EMI',
        otherEmi: 'Other EMIs',

        // Insurance
        health: 'Health Insurance Premium',
        car: 'Car Insurance Premium',
        bike: 'Two-wheeler Insurance Premium',
        life: 'Life Insurance Premium',
        others: 'Other Insurance Premiums',

        // Savings & Investments
        rd: 'RD',
        fd: 'FD',
        lifeInsurance: 'Life Insurance',
        ppf: 'PPF',
        savingSchemes: 'Saving Schemes',
        mfSip: 'MFs – SIP',
        otherSaving: 'Other Saving'
    };
    return labels[key] || key;
};

export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};
