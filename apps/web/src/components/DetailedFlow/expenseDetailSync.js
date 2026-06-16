/** Sum user-entered monthly education per child. */
export function sumUserEducationFromChildren(familyMembers = []) {
    return familyMembers
        .filter((m) => m.relation === 'Child')
        .reduce((sum, m) => sum + (parseFloat(m.monthlyEducationExpense) || 0), 0);
}

export function sumHouseholdExceptEducation(household = {}) {
    return ['grocery', 'rent', 'lifestyle', 'medical', 'travel'].reduce(
        (sum, key) => sum + (parseFloat(household[key]) || 0),
        0,
    );
}

export function sumHouseholdIncludingEducation(household = {}, educationMonthly = 0) {
    const education = educationMonthly || parseFloat(household.education) || 0;
    return sumHouseholdExceptEducation(household) + education;
}

export function getEmiMonthlyAmount(val) {
    if (val !== null && typeof val === 'object' && val.emi) {
        return parseFloat(val.emi) || 0;
    }
    return parseFloat(val) || 0;
}

export function sumConfiguredEmis(emi = {}) {
    const keys = ['personalLoan', 'homeLoan', 'educationLoan', 'carLoan', 'twoWheelerLoan', 'otherEmi'];
    return keys.reduce((sum, key) => sum + getEmiMonthlyAmount(emi[key]), 0);
}

export function hasConfiguredLoan(emi = {}) {
    return ['personalLoan', 'homeLoan', 'educationLoan', 'carLoan', 'twoWheelerLoan', 'otherEmi'].some(
        (key) => emi[key] !== null && typeof emi[key] === 'object' && emi[key].principal > 0,
    );
}

/** Summary flow stores total household spend in lifestyle when no breakdown exists yet. */
export function isLikelySummaryInLifestyle(household = {}, summaryHouseholdTotal = '') {
    const lifestyle = parseFloat(household.lifestyle) || 0;
    if (lifestyle <= 0) return false;

    const othersEmpty = ['grocery', 'rent', 'medical', 'travel'].every(
        (k) => !household[k] || parseFloat(household[k]) <= 0,
    );
    if (!othersEmpty) return false;

    if (!summaryHouseholdTotal) return true;

    return String(lifestyle) === String(parseFloat(summaryHouseholdTotal));
}

export function hasHouseholdBreakdown(household = {}, summaryHouseholdTotal = '') {
    if (['grocery', 'rent', 'medical', 'travel'].some(
        (k) => household[k] && parseFloat(household[k]) > 0,
    )) {
        return true;
    }

    const lifestyle = parseFloat(household.lifestyle) || 0;
    if (lifestyle <= 0) return false;

    return !isLikelySummaryInLifestyle(household, summaryHouseholdTotal);
}

/** Legacy summary flow stored total EMI in emi.homeLoan as a scalar. */
export function isLikelySummaryEmiInHomeLoan(emi = {}) {
    const homeLoan = emi.homeLoan;
    if (!homeLoan || typeof homeLoan === 'object') return false;

    const homeLoanAmount = parseFloat(homeLoan) || 0;
    if (homeLoanAmount <= 0) return false;

    return ['personalLoan', 'educationLoan', 'carLoan', 'twoWheelerLoan', 'otherEmi'].every((key) => {
        const val = emi[key];
        if (val !== null && typeof val === 'object') {
            return !(parseFloat(val.principal) > 0);
        }
        return !val || parseFloat(val) <= 0;
    });
}

/** Replace summaryEmiTotal from legacy scalar homeLoan when detected (never accumulate). */
export function syncSummaryEmiSnapshot(expenseCategories = {}) {
    const emi = expenseCategories.emi || {};
    let summaryEmi = expenseCategories.summaryEmiTotal ?? '';

    if (hasConfiguredLoan(emi)) {
        return summaryEmi;
    }

    if (isLikelySummaryEmiInHomeLoan(emi)) {
        summaryEmi = String(emi.homeLoan);
    }

    return summaryEmi;
}

export function getEffectiveMonthlyEmi(expenseCategories = {}) {
    const configured = sumConfiguredEmis(expenseCategories.emi);
    if (configured > 0) return configured;
    return parseFloat(expenseCategories.summaryEmiTotal) || 0;
}

/** Sum of detailed household fields including per-child education. */
export function getHouseholdBreakdownTotal(expenseCategories = {}, familyMembers = []) {
    const household = expenseCategories.household || {};
    const educationMonthly = sumUserEducationFromChildren(familyMembers);
    return sumHouseholdIncludingEducation(household, educationMonthly);
}

/** True when the user has started a detailed household split (not summary-only storage). */
export function hasHouseholdDetailEntered(expenseCategories = {}, familyMembers = []) {
    const household = expenseCategories.household || {};
    const summaryHouseholdTotal = expenseCategories.summaryHouseholdTotal ?? '';
    const educationMonthly = sumUserEducationFromChildren(familyMembers);
    if (educationMonthly > 0) return true;
    return hasHouseholdBreakdown(household, summaryHouseholdTotal);
}

/**
 * Prefer detailed household breakdown when entered; otherwise use summary snapshot.
 * Mirrors getEffectiveMonthlyEmi / getEffectiveMonthlySavings.
 */
export function getEffectiveMonthlyHousehold(expenseCategories = {}, familyMembers = []) {
    if (hasHouseholdDetailEntered(expenseCategories, familyMembers)) {
        return getHouseholdBreakdownTotal(expenseCategories, familyMembers);
    }
    return parseFloat(expenseCategories.summaryHouseholdTotal) || 0;
}

import { reconcileAmounts, RECONCILE_TOLERANCE } from './detailReconcile';

export { reconcileAmounts, RECONCILE_TOLERANCE };
export function reconcileHousehold(expenseCategories = {}, familyMembers = []) {
    const household = expenseCategories.household || {};
    const summaryTotal = parseFloat(expenseCategories.summaryHouseholdTotal) || 0;
    const detailTotal = sumHouseholdExceptEducation(household);
    return reconcileAmounts(summaryTotal, detailTotal);
}

export function reconcileEmi(expenseCategories = {}) {
    const summaryTotal = parseFloat(expenseCategories.summaryEmiTotal) || 0;
    const detailTotal = sumConfiguredEmis(expenseCategories.emi);
    return reconcileAmounts(summaryTotal, detailTotal);
}

export function hasAnyEmiCommitment(expenseCategories = {}) {
    if (parseFloat(expenseCategories.summaryEmiTotal) > 0) return true;
    if (hasConfiguredLoan(expenseCategories.emi)) return true;
    return ['personalLoan', 'homeLoan', 'educationLoan', 'carLoan', 'twoWheelerLoan', 'otherEmi'].some(
        (key) => getEmiMonthlyAmount(expenseCategories.emi?.[key]) > 0,
    );
}

/**
 * Preserve summary totals separately and clear breakdown / unallocated EMI scalars
 * so detailed fields start blank.
 */
export function initializeExpenseSnapshots(expenseCategories = {}) {
    const h = expenseCategories.household || {};
    const emi = expenseCategories.emi || {};
    const loansConfigured = hasConfiguredLoan(emi);

    let summaryHousehold = expenseCategories.summaryHouseholdTotal ?? '';
    let summaryEmi = syncSummaryEmiSnapshot(expenseCategories);

    if (!summaryHousehold && h.lifestyle && isLikelySummaryInLifestyle(h, summaryHousehold)) {
        summaryHousehold = String(h.lifestyle);
    }

    const breakdownStarted = hasHouseholdBreakdown(h, summaryHousehold);

    return {
        ...expenseCategories,
        summaryHouseholdTotal: summaryHousehold,
        summaryEmiTotal: summaryEmi,
        household: breakdownStarted ? h : {
            ...h,
            grocery: '',
            rent: '',
            lifestyle: '',
            medical: '',
            travel: '',
            education: h.education || '',
        },
        emi: loansConfigured ? emi : {
            personalLoan: '',
            homeLoan: '',
            educationLoan: '',
            carLoan: '',
            twoWheelerLoan: '',
            otherEmi: '',
            otherEmiName: emi.otherEmiName || '',
        },
    };
}

export const EMI_LOAN_KEYS = [
    { key: 'personalLoan', label: 'Personal Loan' },
    { key: 'homeLoan', label: 'Home Loan' },
    { key: 'educationLoan', label: 'Education Loan' },
    { key: 'carLoan', label: 'Car Loan' },
    { key: 'twoWheelerLoan', label: 'Two Wheeler Loan' },
    { key: 'otherEmi', label: 'Any other EMIs', hasName: true },
];
