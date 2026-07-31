import {
    getMemberInsuranceKey,
    sumMemberLifeCover,
} from '../DetailedFlow/insuranceDetailSync';

/**
 * Spouse life cover is assessed for earning spouses only.
 * Detailed flow asks isSpouseWorking; false means not working (housewife).
 * Falls back to occupation === 'housewife' for summary/legacy profiles.
 */
export function shouldAssessSpouseProtection(spouseMember) {
    if (!spouseMember) return false;
    if (spouseMember.isSpouseWorking === false) return false;
    if (spouseMember.isSpouseWorking === true) return true;
    return spouseMember.occupation?.toLowerCase() !== 'housewife';
}

export const calculateProtectionGap = (expenseCategories, policies, familyMembers) => {
    // A. Monthly Expenditure (Household)
    const householdTotal = Object.values(expenseCategories.household || {}).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

    // B. EMIs & Insurance
    const emiTotal = Object.values(expenseCategories.emi || {}).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

    const monthlyExpenditure = householdTotal + emiTotal;
    const multiplier = 200;
    const protectionNeed = monthlyExpenditure * multiplier;

    // Find names for Self and Spouse
    const selfMember = familyMembers.find(m => m.relation === 'Self');
    const spouseMember = familyMembers.find(m => m.relation === 'Spouse');

    const calculateIndividualGap = (member) => {
        if (!member) return null;
        const memberName = getMemberInsuranceKey(member);

        const individualCoverage = sumMemberLifeCover(policies, memberName);
        const gap = protectionNeed - individualCoverage;

        return {
            name: memberName,
            coverage: individualCoverage,
            need: protectionNeed,
            gap: gap,
            isGap: gap > 0
        };
    };

    return {
        monthlyExpenditure,
        multiplier,
        protectionNeed,
        self: calculateIndividualGap(selfMember || { name: 'Self', relation: 'Self' }),
        spouse: shouldAssessSpouseProtection(spouseMember) ? calculateIndividualGap(spouseMember) : null
    };
};
