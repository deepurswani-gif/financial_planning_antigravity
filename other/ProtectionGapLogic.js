import {
    getMemberInsuranceKey,
    sumMemberLifeCover,
} from '../DetailedFlow/insuranceDetailSync';
import { calculateNetWorth } from '../AssetModule/AssetLogic';

/**
 * Spouse life cover is assessed for earning spouses only.
 */
export function shouldAssessSpouseProtection(spouseMember) {
    if (!spouseMember) return false;
    if (spouseMember.isSpouseWorking === false) return false;
    if (spouseMember.isSpouseWorking === true) return true;
    return spouseMember.occupation?.toLowerCase() !== 'housewife';
}

const INCOME_MULTIPLE_TABLE = [
    { minAge: 18, maxAge: 35, multiple: 25 },
    { minAge: 36, maxAge: 45, multiple: 20 },
    { minAge: 46, maxAge: 50, multiple: 15 },
    { minAge: 51, maxAge: 60, multiple: 10 },
    { minAge: 61, maxAge: 99, multiple: 5 },
];

export function getIncomeMultiple(age) {
    const band = INCOME_MULTIPLE_TABLE.find(b => age >= b.minAge && age <= b.maxAge);
    return band ? band.multiple : 5;
}

export function incomeEligibilityCap(annualIncome, age) {
    return annualIncome * getIncomeMultiple(age);
}

export function presentValueGrowingAnnuity(firstPayment, r, g, n) {
    if (firstPayment <= 0) return 0;
    if (r === g) return firstPayment * n / (1 + r);
    const factor = (1 - Math.pow((1 + g) / (1 + r), n)) / (r - g);
    return firstPayment * factor;
}

export function humanLifeValue(person, discountRate, selfConsumptionRate = 0.25) {
    const netContribution = person.annualIncome * (1 - selfConsumptionRate);
    const yearsToRetirement = Math.max(person.retirementAge - person.age, 1);
    const r = discountRate;
    if (r === 0) return netContribution * yearsToRetirement;
    const pv = netContribution * (1 - Math.pow(1 + r, -yearsToRetirement)) / r;
    return pv;
}

/**
 * FIX (Bug 1): income-replacement leg is now an actual shortfall test —
 * does the surviving spouse's income cover post-death household expenses? —
 * instead of a proportional income-share split of the full household expense.
 *
 * FIX (Bug 2 & 3): liabilities and goals are no longer multiplied by
 * incomeShare. A loan or a child's education cost doesn't shrink because
 * the lower-earning spouse is the one who died — these are full amounts
 * owed/needed regardless of whose income they're compared against.
 */
export function needsBasedCorpus(person, household, goals = []) {
    const yearsToReplace = Math.max(person.retirementAge - person.age, 1);
    const r = household.discountRate;
    const g = household.inflationRate;

    // --- Bug 1 fix: shortfall test, not proportional split ---
    const expenseContinuationFactor = household.expenseContinuationFactor ?? 0.75;
    const incomeContinuityFactor = household.incomeContinuityFactor ?? 0.85;

    const postDeathMonthlyExpenses = household.monthlyExpenses * expenseContinuationFactor;
    const reliableSurvivingIncomeMonthly =
        (household.otherSpouseAnnualIncome / 12) * incomeContinuityFactor;
    const monthlyShortfall = Math.max(postDeathMonthlyExpenses - reliableSurvivingIncomeMonthly, 0);
    const annualExpenseAtRisk = monthlyShortfall * 12;

    const pvExpenseReplacement = presentValueGrowingAnnuity(annualExpenseAtRisk, r, g, yearsToReplace);

    // --- Bug 2 fix: full liability amount, not incomeShare-weighted ---
    const liabilities = person.ownEmiShare || 0; // caller now passes full totalLiabilities, see below

    // --- Bug 3 fix: full goal amount, not incomeShare-weighted ---
    const pvGoals = goals.reduce(
        (sum, goal) => sum + (parseFloat(goal.presentValue || goal.futureCost) || 0),
        0
    );

    const grossNeed = pvExpenseReplacement + liabilities + pvGoals;
    const deductions = (person.existingCover || 0) + (person.liquidAssets || 0);

    return Math.max(grossNeed - deductions, 0);
}

const getAnnualIncome = (incomeObj, prefix) => {
    return ((parseFloat(incomeObj?.[prefix] || 0) +
            parseFloat(incomeObj?.[`${prefix}Bonus`] || 0) +
            parseFloat(incomeObj?.[`${prefix}Passive`] || 0) +
            parseFloat(incomeObj?.[`${prefix}Other`] || 0)) * 12) || 0;
};

export const calculateProtectionGap = (expenseCategories, policies, familyMembers, income, inflationRates, calculatorInputs, goals = [], assetCategories, liabilityCategories) => {
    const householdTotal = Object.values(expenseCategories?.household || {}).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const emiTotal = Object.values(expenseCategories?.emi || {}).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const monthlyExpenditure = householdTotal + emiTotal;

    const netWorthResults = calculateNetWorth(assetCategories, liabilityCategories);
    const totalLiabilities = netWorthResults.totalLiabilities || 0;

    const liquidAssets = Object.values(assetCategories?.investments || {}).reduce((s, v) => s + (parseFloat(v)||0), 0) +
                         Object.values(assetCategories?.bank || {}).reduce((s, v) => s + (parseFloat(v)||0), 0) +
                         Object.values(assetCategories?.physical || {}).reduce((s, v) => s + (parseFloat(v)||0), 0);

    const discountRate = parseFloat(calculatorInputs?.expectedReturn || 7) / 100;
    const inflationRate = parseFloat(inflationRates?.householdInflation || 6) / 100;
    // NOTE: expose these as config too, not just hardcoded defaults in needsBasedCorpus —
    // consider sourcing from calculatorInputs the same way discountRate/inflationRate are.
    const expenseContinuationFactor = parseFloat(calculatorInputs?.expenseContinuationFactor ?? 0.75);
    const incomeContinuityFactor = parseFloat(calculatorInputs?.incomeContinuityFactor ?? 0.85);

    const selfMember = familyMembers?.find(m => m.relation?.toLowerCase() === 'self') || { name: 'Self', relation: 'Self', age: 35, retirementAge: 60 };
    const spouseMember = familyMembers?.find(m => m.relation?.toLowerCase() === 'spouse');

    const selfAnnualIncome = getAnnualIncome(income, 'self');
    const spouseAnnualIncome = spouseMember && shouldAssessSpouseProtection(spouseMember) ? getAnnualIncome(income, 'spouse') : 0;
    const totalHouseholdIncome = selfAnnualIncome + spouseAnnualIncome;

    const calculateIndividualGap = (member, annualIncome, otherSpouseAnnualIncome) => {
        if (!member) return null;

        const memberName = getMemberInsuranceKey(member);
        const individualCoverage = sumMemberLifeCover(policies, memberName);
        const age = parseInt(member.age) || 35;
        const retirementAge = parseInt(member.retirementAge) || 60;

        // incomeShare retained ONLY for splitting shared liquid assets as a
        // deduction (so combined self+spouse deductions don't double-count
        // the same pool of assets) — no longer used for expenses/liabilities/goals.
        const incomeShare = totalHouseholdIncome > 0 ? annualIncome / totalHouseholdIncome : 1;

        const person = {
            annualIncome,
            age,
            retirementAge,
            existingCover: individualCoverage,
            liquidAssets: liquidAssets * incomeShare,
            ownEmiShare: totalLiabilities, // Bug 2 fix: full amount, not totalLiabilities * incomeShare
        };

        const householdInfo = {
            monthlyExpenses: householdTotal,
            otherSpouseAnnualIncome,
            discountRate,
            inflationRate,
            expenseContinuationFactor,
            incomeContinuityFactor,
        };

        const needs = needsBasedCorpus(person, householdInfo, goals);
        const hlv = humanLifeValue(person, discountRate, 0.25);
        const idealCover = Math.max(needs, hlv);
        const cap = incomeEligibilityCap(annualIncome, age);

        const recommendedSA = Math.min(idealCover, cap);
        const shortfall = Math.max(idealCover - cap, 0);

        return {
            name: memberName,
            coverage: individualCoverage,
            need: recommendedSA,
            gap: Math.max(recommendedSA - individualCoverage, 0),
            isGap: (recommendedSA - individualCoverage) > 0,
            idealCover,
            insurabilityCap: cap,
            shortfall,
            isCapped: idealCover > cap,
            needsCorpus: needs,
            hlv
        };
    };

    return {
        monthlyExpenditure,
        // NOTE: multiplier/protectionNeed retained only for reference/back-compat —
        // confirm ProtectionGapOutput.jsx is reading self/spouse.idealCover, not these.
        multiplier: 200,
        protectionNeed: monthlyExpenditure * 200,
        self: calculateIndividualGap(selfMember, selfAnnualIncome, spouseAnnualIncome),
        spouse: shouldAssessSpouseProtection(spouseMember) ? calculateIndividualGap(spouseMember, spouseAnnualIncome, selfAnnualIncome) : null
    };
};
