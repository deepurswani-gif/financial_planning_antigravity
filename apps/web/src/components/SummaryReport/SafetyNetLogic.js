/**
 * SafetyNetLogic.js
 * Pure calculation module for the "The Safety Net" report section.
 * No React imports — just data transformations.
 */

import { getEffectiveMonthlyEmi, getEffectiveMonthlyHousehold } from '../DetailedFlow/expenseDetailSync';
import {
    getEffectiveHealthCover,
    getMemberInsuranceKey,
    sumMemberLifeCover,
    sumPolicySumAssured,
} from '../DetailedFlow/insuranceDetailSync';
import { shouldAssessSpouseProtection } from '../ProtectionGapModule/ProtectionGapLogic';

export const MIN_HEALTH_COVER = 1_000_000;

function getEffectiveMonthlyNeed(expenseCategories = {}, familyMembers = []) {
    return getEffectiveMonthlyHousehold(expenseCategories, familyMembers) + getEffectiveMonthlyEmi(expenseCategories);
}

function buildMemberProtection(role, name, coverageHave, coverageRequired, monthlyNeed) {
    const annualNeed = monthlyNeed * 12;
    const gap = Math.max(0, coverageRequired - coverageHave);
    const coveredPercent = coverageRequired > 0
        ? Math.min(100, Math.round((coverageHave / coverageRequired) * 100))
        : 0;
    const yearsCovered = annualNeed > 0 ? coverageHave / annualNeed : 0;

    return {
        role,
        name,
        coverage: coverageHave,
        need: coverageRequired,
        gap,
        isGap: gap > 0,
        coveredPercent,
        yearsCovered: Math.round(yearsCovered * 100) / 100,
        monthsCovered: Math.round(yearsCovered * 12),
    };
}

/**
 * Calculate protection (life insurance) gap data.
 *
 * Uses the HLV (Human Life Value) method from ProtectionGapLogic:
 *   Protection Need = Monthly Expenditure × 200 (shared household need per earning member)
 *
 * Life cover pays only on the insured member's death, so self and earning spouse
 * are assessed separately against the same household need. Aggregate household
 * cover is not treated as "fine" when any assessed member is underinsured.
 *
 * Cover have prefers detailed per-member policies[].sumAssured (life, non-proposed).
 * Summary life cover is attributed to self when no detailed life SA exists.
 *
 * @param {object} expenseCategories - Expense categories from context
 * @param {string|number} summaryLifeCover - Total life cover from summary flow
 * @param {Array} familyMembers
 * @param {Array} policies - Detailed insurance policies
 * @returns {object} Protection data
 */
export const calculateProtectionData = (
    expenseCategories,
    summaryLifeCover,
    familyMembers = [],
    policies = [],
) => {
    const monthlyNeed = getEffectiveMonthlyNeed(expenseCategories, familyMembers);
    const annualNeed = monthlyNeed * 12;

    const multiplier = 200;
    const coverageRequired = monthlyNeed * multiplier;

    const selfMember = familyMembers.find((m) => m.relation === 'Self');
    const spouseMember = familyMembers.find((m) => m.relation === 'Spouse');
    const selfName = getMemberInsuranceKey(selfMember || { name: 'Self', relation: 'Self' });
    const detailedLifeTotal = sumPolicySumAssured(policies);

    let selfCoverage;
    if (detailedLifeTotal > 0) {
        selfCoverage = sumMemberLifeCover(policies, selfName);
    } else {
        selfCoverage = parseFloat(summaryLifeCover) || 0;
    }

    const self = buildMemberProtection('self', selfName, selfCoverage, coverageRequired, monthlyNeed);

    let spouse = null;
    if (shouldAssessSpouseProtection(spouseMember)) {
        const spouseName = getMemberInsuranceKey(spouseMember);
        // Spouse cover is always policy-based; summary life cover is treated as self's.
        const spouseCoverage = sumMemberLifeCover(policies, spouseName);
        spouse = buildMemberProtection('spouse', spouseName, spouseCoverage, coverageRequired, monthlyNeed);
    }

    const assessedMembers = [self, spouse].filter(Boolean);
    const weakest = assessedMembers.reduce(
        (worst, member) => (member.coveredPercent < worst.coveredPercent ? member : worst),
        assessedMembers[0],
    );
    const protectionGap = assessedMembers.reduce((sum, member) => sum + member.gap, 0);

    return {
        monthlyNeed,
        annualNeed,
        multiplier,
        coverageRequired,
        // Weakest earning member — payout on their death is what the household receives
        coverageHave: weakest?.coverage ?? 0,
        protectionGap,
        coveredPercent: weakest?.coveredPercent ?? 0,
        yearsCovered: weakest?.yearsCovered ?? 0,
        monthsCovered: weakest?.monthsCovered ?? 0,
        hasGap: protectionGap > 0,
        hasData: monthlyNeed > 0,
        self,
        spouse,
        assessedMembers,
        weakestRole: weakest?.role ?? 'self',
        weakestName: weakest?.name ?? selfName,
    };
};

/**
 * Calculate contingency (emergency fund) data.
 *
 * Ideal buffer = 6 months of (household + EMI) expenses.
 *
 * @param {object} expenseCategories - Expense categories from context
 * @param {string|number} contingencyFund - Available emergency fund amount
 * @returns {object} Contingency data
 */
export const calculateContingencyData = (expenseCategories, contingencyFund, familyMembers = []) => {
    const monthlyNeed = getEffectiveMonthlyNeed(expenseCategories, familyMembers);
    const contingencyPeriod = 6; // months
    const emergencyFundNeeded = monthlyNeed * contingencyPeriod;
    const emergencyFundHave = parseFloat(contingencyFund) || 0;
    const gap = Math.max(0, emergencyFundNeeded - emergencyFundHave);

    // How many months can the fund cover?
    const monthsCoveredByFund = monthlyNeed > 0 ? emergencyFundHave / monthlyNeed : 0;
    // Convert to days for narrative
    const daysCovered = Math.round(monthsCoveredByFund * 30);

    return {
        monthlyNeed,
        contingencyPeriod,
        emergencyFundNeeded,
        emergencyFundHave,
        gap,
        monthsCoveredByFund: Math.round(monthsCoveredByFund * 100) / 100,
        daysCovered,
        isHealthy: emergencyFundHave >= emergencyFundNeeded,
        hasData: monthlyNeed > 0
    };
};

/**
 * Calculate health insurance gap data.
 *
 * Uses a fixed minimum of ₹10 Lakh for family health protection.
 * Cover have prefers detailed health policies over summary fields.
 *
 * @param {string|number} summaryHealthCover - Total health cover from summary flow
 * @param {boolean|null} hasHealthInsurance - Whether user reported having health cover
 * @param {Array} familyMembers - Family members (for copy context)
 * @param {Array} policies - Detailed insurance policies
 * @returns {object} Health insurance data
 */
export const calculateHealthInsuranceData = (
    summaryHealthCover,
    hasHealthInsurance,
    familyMembers = [],
    policies = [],
) => {
    const minimumRequired = MIN_HEALTH_COVER;
    const coverageHave = getEffectiveHealthCover(summaryHealthCover, hasHealthInsurance, policies);
    const healthGap = Math.max(0, minimumRequired - coverageHave);

    const coveredPercent = minimumRequired > 0
        ? Math.min(100, Math.round((coverageHave / minimumRequired) * 100))
        : 0;

    let status = 'adequate';
    if (coverageHave === 0) {
        status = 'none';
    } else if (healthGap > 0) {
        status = 'partial';
    }

    return {
        minimumRequired,
        coverageHave,
        healthGap,
        coveredPercent,
        hasGap: healthGap > 0,
        status,
        familySize: familyMembers.length
    };
};

/**
 * Build the 4-stage crisis timeline.
 *
 * Stage 1: Emergency fund covers expenses
 * Stage 2: After emergency fund exhausted
 * Stage 3: Life insurance proceeds cover expenses
 * Stage 4: All resources exhausted
 *
 * @param {object} contingencyData - From calculateContingencyData
 * @param {object} protectionData - From calculateProtectionData
 * @returns {Array} Crisis timeline stages
 */
export const buildCrisisTimeline = (contingencyData, protectionData) => {
    const emergencyMonths = contingencyData.monthsCoveredByFund;
    const insuranceYears = protectionData.yearsCovered;

    // Format months display
    const fmtMonths = (m) => {
        if (m < 1) return `${Math.round(m * 30)} days`;
        if (m === 1) return '1 month';
        return `${Math.round(m * 10) / 10} months`;
    };

    const fmtYears = (y) => {
        if (y < 1) return `${Math.round(y * 12)} months`;
        return `${Math.round(y * 100) / 100} years`;
    };

    return [
        {
            id: 'stage-1',
            stage: 1,
            duration: `Till ${fmtMonths(emergencyMonths)}`,
            title: 'Emergency Fund Supports Expenses',
            status: 'Financially Comfortable',
            statusColor: '#10B981',
            bgColor: 'rgba(16, 185, 129, 0.08)',
            borderColor: 'rgba(16, 185, 129, 0.3)',
            icon: 'shield-check'
        },
        {
            id: 'stage-2',
            stage: 2,
            duration: `After ${fmtMonths(emergencyMonths)}`,
            title: 'Additional Funds May Be Required',
            status: 'Financial Flexibility Starts Reducing',
            statusColor: '#F59E0B',
            bgColor: 'rgba(245, 158, 11, 0.08)',
            borderColor: 'rgba(245, 158, 11, 0.3)',
            icon: 'alert-triangle'
        },
        {
            id: 'stage-3',
            stage: 3,
            duration: `Up to ${fmtYears(insuranceYears)}`,
            title: 'Life Insurance Proceeds Support Expenses',
            status: 'Basic Financial Needs Remain Supported',
            statusColor: '#00A9F2',
            bgColor: 'rgba(0, 169, 242, 0.08)',
            borderColor: 'rgba(0, 169, 242, 0.3)',
            icon: 'umbrella'
        },
        {
            id: 'stage-4',
            stage: 4,
            duration: `After ${fmtYears(insuranceYears)}`,
            title: 'Existing Resources May Be Exhausted',
            status: 'Long-Term Financial Security May Be At Risk',
            statusColor: '#EF4444',
            bgColor: 'rgba(239, 68, 68, 0.08)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            icon: 'alert-octagon'
        }
    ];
};

/**
 * Build recovery action steps.
 *
 * @param {object} protectionData - From calculateProtectionData
 * @param {object} healthData - From calculateHealthInsuranceData
 * @param {object} contingencyData - From calculateContingencyData
 * @returns {Array} Recovery steps
 */
export const buildRecoverySteps = (protectionData, healthData, contingencyData) => {
    const steps = [];

    const self = protectionData.self;
    const spouse = protectionData.spouse;

    if (self?.isGap) {
        steps.push({
            id: 'step-protection-self',
            step: steps.length + 1,
            urgency: 'Immediate',
            title: `Fill ${self.name}'s Protection Gap`,
            description: `Buy term cover of ${formatCompactSN(self.gap)} on ${self.name}. Life cover pays only on that person's death — underinsurance here leaves the household exposed.`,
            amount: self.gap,
            icon: 'shield',
            color: '#6366F1',
            memberRole: 'self',
        });
    } else if (protectionData.hasGap && !self && !spouse) {
        // Legacy shape without per-member breakdown
        steps.push({
            id: 'step-protection',
            step: steps.length + 1,
            urgency: 'Immediate',
            title: 'Fill Protection Gap',
            description: `Buy term cover of ${formatCompactSN(protectionData.protectionGap)} to secure your family's future.`,
            amount: protectionData.protectionGap,
            icon: 'shield',
            color: '#6366F1',
        });
    }

    if (spouse?.isGap) {
        steps.push({
            id: 'step-protection-spouse',
            step: steps.length + 1,
            urgency: 'Immediate',
            title: `Fill ${spouse.name}'s Protection Gap`,
            description: `Buy term cover of ${formatCompactSN(spouse.gap)} on ${spouse.name}. If they pass away, only their sum insured supports household expenses — not cover held on other members.`,
            amount: spouse.gap,
            icon: 'shield',
            color: '#6366F1',
            memberRole: 'spouse',
        });
    }

    if (healthData.hasGap) {
        const healthAmount = healthData.coverageHave === 0 ? healthData.minimumRequired : healthData.healthGap;
        const healthTitle = healthData.coverageHave === 0 ? 'Get Family Health Cover' : 'Strengthen Health Cover';
        const healthDesc = healthData.coverageHave === 0
            ? `Get family health insurance with at least ${formatCompactSN(healthData.minimumRequired)} sum insured.`
            : `Increase health cover by ${formatCompactSN(healthData.healthGap)} to reach the ${formatCompactSN(healthData.minimumRequired)} minimum.`;

        steps.push({
            id: 'step-health',
            step: steps.length + 1,
            urgency: 'High',
            title: healthTitle,
            description: healthDesc,
            amount: healthAmount,
            icon: 'heart',
            color: '#00A9F2'
        });
    }

    if (contingencyData.gap > 0) {
        steps.push({
            id: 'step-contingency',
            step: steps.length + 1,
            urgency: 'Immediate',
            title: 'Build Emergency Fund',
            description: `Assign remaining funds for emergency reserves of ${formatCompactSN(contingencyData.gap)}.`,
            amount: contingencyData.gap,
            icon: 'wallet',
            color: '#F59E0B'
        });
    }

    return steps;
};

/**
 * Format number in Indian style with lakhs/crores abbreviation.
 */
export const formatCompactSN = (amount) => {
    if (amount === 0) return '₹0';
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    if (absAmount >= 10000000) {
        return `${sign}₹${(absAmount / 10000000).toFixed(2)} Cr`;
    } else if (absAmount >= 100000) {
        return `${sign}₹${(absAmount / 100000).toFixed(2)} L`;
    }
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};
