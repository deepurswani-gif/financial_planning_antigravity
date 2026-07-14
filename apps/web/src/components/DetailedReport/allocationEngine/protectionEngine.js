/**
 * Protection / hygiene rule step.
 *
 * When any gap exists, apply configurable surplus % to Term / Health / Emergency,
 * capped at actual premium or emergency top-up need. Unused budget → goals.
 */

import { calculateAge } from '../../ProfileModule/ProfileLogic';
import {
    calculateProtectionData,
    calculateHealthInsuranceData,
    calculateContingencyData,
} from '../../SummaryReport/SafetyNetLogic';
import { getEmergencyFundAmount } from '../../DetailedFlow/wealthDetailSync';
import {
    estimateTermAnnualPremium,
    getHealthMonthlyPremium,
    STATUTORY_LIMITS,
    resolveAllocationPolicy,
} from './config';

const parseAmount = (value) => parseFloat(value) || 0;

function resolveSelfAge(familyMembers = []) {
    const self = familyMembers.find((m) => String(m.relation || '').toLowerCase() === 'self');
    if (!self) return 30;
    if (self.dob) return calculateAge(self.dob) || 30;
    return parseAmount(self.age) || 30;
}

function splitByWeights(amount, vehicles = []) {
    if (amount <= 0 || !vehicles.length) return {};
    const weightSum = vehicles.reduce((s, v) => s + (v.weight || 0), 0) || vehicles.length;
    const out = {};
    let used = 0;
    vehicles.forEach((v, i) => {
        const w = v.weight || (1 / vehicles.length);
        const part = i === vehicles.length - 1
            ? amount - used
            : Math.floor(amount * (w / weightSum));
        out[v.studioKey] = (out[v.studioKey] || 0) + Math.max(0, part);
        used += Math.max(0, part);
    });
    return out;
}

/**
 * Apply protection policy to monthly surplus.
 */
export function runProtectionEngine({
    familyMembers = [],
    expenseCategories = {},
    assetCategories = {},
    contingencyFund = '',
    summaryLifeCover = '',
    summaryHealthCover = '',
    hasHealthInsurance = null,
    deployableSurplus = 0,
    policyOverrides = {},
} = {}) {
    const policy = resolveAllocationPolicy(policyOverrides);
    const surplus = Math.max(0, Math.round(parseAmount(deployableSurplus)));
    const age = resolveSelfAge(familyMembers);
    const steps = [];
    const mandatoryAllocations = {};

    const protectionData = calculateProtectionData(expenseCategories, summaryLifeCover, familyMembers);
    const healthData = calculateHealthInsuranceData(summaryHealthCover, hasHealthInsurance, familyMembers);
    const emergencyHave = getEmergencyFundAmount(assetCategories, contingencyFund);
    const contingencyData = calculateContingencyData(expenseCategories, emergencyHave, familyMembers);

    const coverGap = Math.max(0, protectionData.protectionGap || 0);
    const termQuote = estimateTermAnnualPremium(age, coverGap);
    const requiredTermPremium = (coverGap > 0 && protectionData.hasGap)
        ? termQuote.monthlyPremium
        : 0;
    const requiredHealthPremium = healthData.hasGap ? getHealthMonthlyPremium(age) : 0;
    const emergencyGap = Math.max(0, contingencyData.gap || 0);
    const requiredEmergencyMonthly = emergencyGap > 0
        ? Math.ceil(emergencyGap / (STATUTORY_LIMITS.emergencyFillMonths || 12))
        : 0;

    const hasAnyGap = requiredTermPremium > 0
        || requiredHealthPremium > 0
        || requiredEmergencyMonthly > 0;

    let remaining = surplus;
    let unusedProtectionBudget = 0;

    const take = (instrumentType, amount, meta) => {
        const amt = Math.max(0, Math.min(remaining, Math.round(amount)));
        if (amt <= 0) {
            steps.push({ ...meta, instrumentType, amount: 0, skipped: true });
            return 0;
        }
        mandatoryAllocations[instrumentType] = (mandatoryAllocations[instrumentType] || 0) + amt;
        remaining -= amt;
        steps.push({ ...meta, instrumentType, amount: amt, skipped: false });
        return amt;
    };

    if (!hasAnyGap) {
        steps.push({
            objectiveId: 'protection_bucket',
            amount: 0,
            skipped: true,
            reason: 'Protection, health and emergency targets are complete — 100% surplus goes to goals.',
            source: 'protection_policy',
        });
        return {
            term: {
                hasGap: false,
                coverGap: 0,
                requiredPremium: 0,
                monthlyAllocation: 0,
                ...termQuote,
                annualPremium: 0,
                monthlyPremium: 0,
            },
            health: {
                hasGap: false,
                requiredPremium: 0,
                monthlyAllocation: 0,
            },
            emergency: {
                hasGap: false,
                gap: 0,
                requiredMonthly: 0,
                monthlyAllocation: 0,
            },
            protectionData,
            healthData,
            contingencyData,
            mandatoryAllocations,
            steps,
            monthlyTotal: 0,
            residualSurplus: surplus,
            unusedProtectionBudget: 0,
            protectionApplied: false,
            age,
            policy,
        };
    }

    // Policy budgets from total surplus (capped by actual need and remaining cash)
    const termBudget = Math.round(surplus * policy.termShareOfSurplus);
    const healthBudget = Math.round(surplus * policy.healthShareOfSurplus);
    const emergencyBudget = Math.round(surplus * policy.emergencyShareOfSurplus);

    const termAlloc = Math.min(termBudget, requiredTermPremium, remaining);
    unusedProtectionBudget += Math.max(0, termBudget - termAlloc);
    take('Term Insurance', termAlloc, {
        objectiveId: 'protection',
        objectiveLabel: 'Family Protection (Term)',
        reason: `Protection policy: ${Math.round(policy.termShareOfSurplus * 100)}% of surplus, capped at ₹${requiredTermPremium}/mo premium.`,
        coverGap,
        requiredPremium: requiredTermPremium,
        budget: termBudget,
        annualPremium: termQuote.annualPremium,
        source: 'protection_policy',
    });

    const healthAlloc = Math.min(healthBudget, requiredHealthPremium, remaining);
    unusedProtectionBudget += Math.max(0, healthBudget - healthAlloc);
    take('Health Insurance', healthAlloc, {
        objectiveId: 'health',
        objectiveLabel: 'Health Insurance',
        reason: `Protection policy: ${Math.round(policy.healthShareOfSurplus * 100)}% of surplus, capped at age-band premium.`,
        requiredPremium: requiredHealthPremium,
        budget: healthBudget,
        source: 'protection_policy',
    });

    const emergencyAlloc = Math.min(emergencyBudget, requiredEmergencyMonthly, remaining);
    unusedProtectionBudget += Math.max(0, emergencyBudget - emergencyAlloc);
    if (emergencyAlloc > 0) {
        const parts = splitByWeights(emergencyAlloc, policy.emergencyVehicles);
        Object.entries(parts).forEach(([studioKey, amt]) => {
            take(studioKey, amt, {
                objectiveId: 'emergency_fund',
                objectiveLabel: 'Emergency Fund',
                reason: `Protection policy: ${Math.round(policy.emergencyShareOfSurplus * 100)}% of surplus toward ${STATUTORY_LIMITS.emergencyMonths}-month buffer (stops when target met).`,
                requiredMonthly: requiredEmergencyMonthly,
                budget: emergencyBudget,
                source: 'protection_policy',
            });
        });
    } else {
        steps.push({
            objectiveId: 'emergency_fund',
            objectiveLabel: 'Emergency Fund',
            instrumentType: policy.emergencyVehicles[0]?.studioKey || 'Liquid Mutual Fund',
            amount: 0,
            skipped: true,
            reason: emergencyGap <= 0
                ? 'Emergency fund target already achieved.'
                : 'No surplus left for emergency after term/health premiums.',
            source: 'protection_policy',
        });
    }

    return {
        term: {
            hasGap: requiredTermPremium > 0,
            coverGap,
            requiredCover: protectionData.coverageRequired,
            existingCover: protectionData.coverageHave,
            requiredPremium: requiredTermPremium,
            ...termQuote,
            monthlyAllocation: mandatoryAllocations['Term Insurance'] || 0,
        },
        health: {
            hasGap: requiredHealthPremium > 0,
            healthGap: healthData.healthGap,
            requiredPremium: requiredHealthPremium,
            monthlyAllocation: mandatoryAllocations['Health Insurance'] || 0,
        },
        emergency: {
            hasGap: requiredEmergencyMonthly > 0,
            gap: emergencyGap,
            requiredMonthly: requiredEmergencyMonthly,
            monthlyAllocation: Object.entries(mandatoryAllocations)
                .filter(([k]) => k !== 'Term Insurance' && k !== 'Health Insurance')
                .reduce((s, [, v]) => s + v, 0),
        },
        protectionData,
        healthData,
        contingencyData,
        mandatoryAllocations,
        steps,
        monthlyTotal: Object.values(mandatoryAllocations).reduce((s, v) => s + v, 0),
        residualSurplus: remaining,
        unusedProtectionBudget,
        protectionApplied: true,
        age,
        policy,
    };
}
