import { convertToMonthly } from './CashFlowUtils';
import {
    getEffectiveMonthlyEmi,
    getEffectiveMonthlyHousehold,
    hasHouseholdDetailEntered,
    sumConfiguredEmis,
} from '../DetailedFlow/expenseDetailSync';
import { resolveEmploymentType } from '../DetailedFlow/employmentTypeSync';
import { shouldIncludeSpouseIncome } from '../DetailedFlow/incomeDetailSync';
import { getEffectiveMonthlyInsurance, getLifeMemberMonthlyTotal, getInsuranceMonthlyTotal } from '../DetailedFlow/insuranceDetailSync';
import {
    getEffectiveMonthlySavings,
    getSavingsMonthlyAmount,
    hasConfiguredSavings,
} from '../DetailedFlow/savingsDetailSync';
import { getLedgerNetIncomeMonthly, syncLedgerFromMonthlyTotals } from '../DetailedReport/moneyFlowLedgerLogic';
export { syncLedgerFromMonthlyTotals } from '../DetailedReport/moneyFlowLedgerLogic';

export const calculateCashFlow = (income, expenseCategories, familyMembers = [], hasSpouseIncome) => {
    const spouseMember = familyMembers?.find((m) => m.relation?.toLowerCase() === 'spouse');
    const resolvedHasSpouseIncome = typeof hasSpouseIncome === 'boolean'
        ? hasSpouseIncome
        : shouldIncludeSpouseIncome(spouseMember, false, income);

    const totalIncome = getLedgerNetIncomeMonthly(
        income,
        familyMembers,
        resolvedHasSpouseIncome,
        resolveEmploymentType,
    ) + (parseFloat(income.family) || 0);

    const householdSum = getEffectiveMonthlyHousehold(expenseCategories, familyMembers);
    const emiSum = getEffectiveMonthlyEmi(expenseCategories);
    const insuranceSum = getEffectiveMonthlyInsurance(expenseCategories);

    const savingsSum = getEffectiveMonthlySavings(expenseCategories);

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
    const householdUsesSnapshot = householdSum > 0
        && !hasHouseholdDetailEntered(expenseCategories, familyMembers)
        && parseFloat(expenseCategories.summaryHouseholdTotal) > 0;

    if (householdUsesSnapshot) {
        expenseBreakdown.push({
            name: 'Household & Lifestyle (Summary)',
            category: getCategoryLabel('household'),
            value: parseFloat(expenseCategories.summaryHouseholdTotal),
        });
    }

    // Regular categories
    ['household', 'emi'].forEach(cat => {
        if (cat === 'household' && householdUsesSnapshot) return;
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

    const savings = expenseCategories.savings || {};
    if (hasConfiguredSavings(savings)) {
        Object.entries(savings).forEach(([itemKey, value]) => {
            if (Array.isArray(value)) {
                value.forEach((v, idx) => {
                    const amount = getSavingsMonthlyAmount(v);
                    if (amount > 0) {
                        expenseBreakdown.push({
                            name: `${getItemLabel(itemKey)} #${idx + 1}`,
                            category: getCategoryLabel('savings'),
                            value: amount,
                        });
                    }
                });
            } else {
                const amount = getSavingsMonthlyAmount(value);
                if (amount > 0) {
                    expenseBreakdown.push({
                        name: getItemLabel(itemKey),
                        category: getCategoryLabel('savings'),
                        value: amount,
                    });
                }
            }
        });
    } else {
        const summaryInvest = parseFloat(expenseCategories.summaryMonthlyInvestments) || 0;
        const summaryOther = parseFloat(expenseCategories.summaryOtherSavings) || 0;
        if (summaryInvest > 0) {
            expenseBreakdown.push({
                name: 'Monthly Investments (Summary)',
                category: getCategoryLabel('savings'),
                value: summaryInvest,
            });
        }
        if (summaryOther > 0) {
            expenseBreakdown.push({
                name: 'Other Savings (Summary)',
                category: getCategoryLabel('savings'),
                value: summaryOther,
            });
        }
    }
    if (emiSum > 0 && sumConfiguredEmis(expenseCategories.emi) === 0 && parseFloat(expenseCategories.summaryEmiTotal) > 0) {
        expenseBreakdown.push({
            name: 'Monthly EMI (Summary)',
            category: getCategoryLabel('emi'),
            value: parseFloat(expenseCategories.summaryEmiTotal),
        });
    }
    const insuranceUsesSnapshot = insuranceSum > 0
        && getInsuranceMonthlyTotal(expenseCategories.insurance || {}) === 0
        && parseFloat(expenseCategories.summaryInsuranceTotal) > 0;
    if (insuranceUsesSnapshot) {
        expenseBreakdown.push({
            name: 'Insurance Premiums (Summary)',
            category: getCategoryLabel('insurance'),
            value: parseFloat(expenseCategories.summaryInsuranceTotal),
        });
    } else {
        // Insurance specialized handling
        Object.entries(expenseCategories.insurance || {}).forEach(([itemKey, item]) => {
            if (itemKey === 'life') {
                Object.entries(item || {}).forEach(([memberName, lItem]) => {
                    const monthlyAmount = getLifeMemberMonthlyTotal(lItem);
                    if (monthlyAmount > 0) {
                        expenseBreakdown.push({
                            name: `Life Insurance Premium (${memberName})`,
                            category: getCategoryLabel('insurance'),
                            value: monthlyAmount
                        });
                    }
                });
            } else if (itemKey !== 'policyDocs' && item?.value !== undefined) {
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
    }

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
        nps: 'NPS',
        mfSip: 'MFs – SIP',
        sip: 'Mutual Fund SIPs',
        otherSaving: 'Other Saving',
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
