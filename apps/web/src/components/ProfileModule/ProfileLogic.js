import { determineLifeStage, buildLifeStageContext } from '../DetailedReport/allocationEngine/lifeStageEngine';

export const calculateAge = (dob) => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

export const calculateRetirementYear = (dob, retirementAge) => {
    if (!dob || !retirementAge) return '';
    const birthDate = new Date(dob);
    const birthYear = birthDate.getFullYear();
    return birthYear + parseInt(retirementAge);
};

/**
 * @param {object} member
 * @param {object} [householdContext] - optional { familyMembers, surplusRate, netWorth, emiRatio, hasStableIncome }
 */
export const calculateProfile = (member, householdContext = {}) => {
    const age = member.dob ? calculateAge(member.dob) : (parseFloat(member.age) || 0);
    const retirementAge = parseInt(member.retirementAge, 10) || 60;
    const yearsToRetire = retirementAge - age;
    const retirementYear = member.dob
        ? calculateRetirementYear(member.dob, retirementAge)
        : '';

    const familyMembers = householdContext.familyMembers?.length
        ? householdContext.familyMembers
        : [member];

    const stage = determineLifeStage({
        familyMembers,
        age,
        retirementAge,
        surplusRate: householdContext.surplusRate,
        netWorth: householdContext.netWorth,
        emiRatio: householdContext.emiRatio,
        hasStableIncome: householdContext.hasStableIncome,
    });

    return {
        ...member,
        age,
        yearsToRetire,
        retirementYear,
        lifeStage: stage.lifeStage,
        lifeStageId: stage.lifeStageId,
        stageSignals: stage.stageSignals,
        stageSummary: stage.stageSummary,
        isLateStart: age > 40 && yearsToRetire < 15,
    };
};

export const calculateFamilyProfile = (members, householdContext = {}) => {
    const familyMembers = members || [];
    return familyMembers.map((member) => calculateProfile(member, {
        ...householdContext,
        familyMembers,
    }));
};

export { determineLifeStage, buildLifeStageContext };
