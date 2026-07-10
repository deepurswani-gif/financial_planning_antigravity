/** Canonical monthly education expense for one child (manual entry or derived). */
export function getChildMonthlyEducationExpense(child) {
    const manual = parseFloat(child.monthlyEducationExpense);
    if (manual > 0) return manual;

    if (child.occupation === 'School' && child.annualSchoolFee) {
        return parseFloat(child.annualSchoolFee) / 12;
    }

    if (child.occupation === 'College' && child.costOfCompleteCourse && child.courseDuration) {
        const years = parseFloat(child.courseDuration) || 1;
        return parseFloat(child.costOfCompleteCourse) / (years * 12);
    }

    return 0;
}

/** Sum monthly education across all children. */
export function sumChildrenMonthlyEducation(familyMembers = []) {
    return familyMembers
        .filter((m) => m.relation === 'Child')
        .reduce((sum, c) => sum + getChildMonthlyEducationExpense(c), 0);
}

/** True when current education spend is already in the household baseline. */
export function isEducationInHouseholdBaseline(familyMembers = [], household = {}) {
    return sumChildrenMonthlyEducation(familyMembers) > 0
        || parseFloat(household.education) > 0;
}

/** Rounded monthly total for syncing to household.education. */
export function formatEducationMonthlyTotal(familyMembers = []) {
    const total = sumChildrenMonthlyEducation(familyMembers);
    return total > 0 ? String(Math.round(total)) : '';
}

/** Apply aggregated child education total to expenseCategories.household.education. */
export function applyHouseholdEducationFromChildren(expenseCategories = {}, familyMembers = []) {
    const education = formatEducationMonthlyTotal(familyMembers);
    return {
        ...expenseCategories,
        household: {
            ...expenseCategories.household,
            education,
        },
    };
}

/** Prefill monthlyEducationExpense from derived amount when field is empty. */
export function prefillChildMonthlyEducationExpense(child) {
    if (child.monthlyEducationExpense) return child;
    const derived = getChildMonthlyEducationExpense(child);
    if (derived <= 0) return child;
    if (child.occupation !== 'School' && child.occupation !== 'College') return child;
    return {
        ...child,
        monthlyEducationExpense: String(Math.round(derived)),
    };
}
