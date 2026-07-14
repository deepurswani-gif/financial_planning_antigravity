/**
 * Gap facade for hygiene inputs (Emergency / Protection / Health coverage).
 * Goal funding deficits are owned by goalFundingEngine — not duplicated here.
 */

import {
    calculateContingencyData,
    calculateProtectionData,
    calculateHealthInsuranceData,
} from '../../SummaryReport/SafetyNetLogic';
import { getEmergencyFundAmount } from '../../DetailedFlow/wealthDetailSync';
import { getSavingsMonthlyAmount, getEffectiveMonthlySavings } from '../../DetailedFlow/savingsDetailSync';
import { calculateAge } from '../../ProfileModule/ProfileLogic';
import { OBJECTIVE_TYPES } from './objectiveVehicleMap';
import { STATUTORY_LIMITS } from './config';

const parseAmount = (value) => parseFloat(value) || 0;

function formatInr(amount) {
    return Math.round(Math.max(0, amount));
}

export function getExistingMonthlyByInstrument(expenseCategories = {}) {
    const savings = expenseCategories.savings || {};
    return {
        SIP: getSavingsMonthlyAmount(savings.sip),
        PPF: getSavingsMonthlyAmount(savings.ppf),
        NPS: getSavingsMonthlyAmount(savings.nps),
        'Recurring Deposit': getSavingsMonthlyAmount(savings.rd),
        'Liquid Mutual Fund': getSavingsMonthlyAmount(savings.liquidMf || savings.liquid),
        'Other Investment': getSavingsMonthlyAmount(savings.otherSaving),
        total: getEffectiveMonthlySavings(expenseCategories),
    };
}

/**
 * Hygiene gap snapshot for Emergency + coverage context.
 * Protection premiums come from protectionEngine (config masters), not from gap size.
 */
export function buildLifeObjectiveGaps({
    familyMembers = [],
    expenseCategories = {},
    assetCategories = {},
    contingencyFund = '',
    summaryLifeCover = '',
    summaryHealthCover = '',
    hasHealthInsurance = null,
} = {}) {
    const emergencyHave = getEmergencyFundAmount(assetCategories, contingencyFund);
    const contingencyData = calculateContingencyData(expenseCategories, emergencyHave, familyMembers);
    const protectionData = calculateProtectionData(expenseCategories, summaryLifeCover, familyMembers);
    const healthData = calculateHealthInsuranceData(summaryHealthCover, hasHealthInsurance, familyMembers);
    const existingMonthly = getExistingMonthlyByInstrument(expenseCategories);

    const self = familyMembers.find((m) => String(m.relation || '').toLowerCase() === 'self');
    const currentAge = self?.dob ? calculateAge(self.dob) : (parseAmount(self?.age) || 30);
    const retirementAge = parseInt(self?.retirementAge, 10) || 60;
    const yearsToRetirement = Math.max(1, retirementAge - currentAge);

    const fillMonths = STATUTORY_LIMITS.emergencyFillMonths;

    const objectives = [
        {
            id: OBJECTIVE_TYPES.EMERGENCY,
            type: OBJECTIVE_TYPES.EMERGENCY,
            label: 'Emergency Fund',
            gap: formatInr(contingencyData.gap),
            yearsLeft: 1,
            requiredMonthly: contingencyData.gap > 0
                ? Math.ceil(contingencyData.gap / fillMonths)
                : 0,
            isWaterfall: true,
            isHygiene: true,
            contingencyData,
        },
        {
            id: OBJECTIVE_TYPES.PROTECTION,
            type: OBJECTIVE_TYPES.PROTECTION,
            label: 'Family Protection (Term)',
            gap: formatInr(protectionData.protectionGap),
            isWaterfall: true,
            isHygiene: true,
            protectionData,
        },
        {
            id: OBJECTIVE_TYPES.HEALTH,
            type: OBJECTIVE_TYPES.HEALTH,
            label: 'Health Insurance',
            gap: formatInr(healthData.healthGap),
            isWaterfall: true,
            isHygiene: true,
            healthData,
        },
    ];

    return {
        objectives,
        contingencyData,
        protectionData,
        healthData,
        existingMonthly,
        yearsToRetirement,
        currentAge,
        familyMembers,
        expenseCategories,
        meta: {
            emergencyHave,
            summaryLifeCover,
            summaryHealthCover,
            hasHealthInsurance,
        },
    };
}
