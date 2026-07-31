/**
 * @deprecated Protection + emergency hygiene now runs via runProtectionEngine % policy.
 * Kept as a thin adapter for any legacy imports.
 */

import { runProtectionEngine } from './protectionEngine';

export function applyHardWaterfall(deployableSurplus, gapSnapshot = {}, options = {}) {
    const protection = runProtectionEngine({
        familyMembers: options.familyMembers || gapSnapshot.familyMembers || [],
        expenseCategories: options.expenseCategories || gapSnapshot.expenseCategories || {},
        assetCategories: options.assetCategories || {},
        contingencyFund: options.contingencyFund || '',
        summaryLifeCover: options.summaryLifeCover ?? gapSnapshot.meta?.summaryLifeCover ?? '',
        summaryHealthCover: options.summaryHealthCover ?? gapSnapshot.meta?.summaryHealthCover ?? '',
        hasHealthInsurance: options.hasHealthInsurance ?? gapSnapshot.meta?.hasHealthInsurance,
        policies: options.policies ?? gapSnapshot.meta?.policies ?? [],
        deployableSurplus,
        policyOverrides: options.policyOverrides,
    });

    return {
        mandatoryAllocations: protection.mandatoryAllocations,
        residualSurplus: protection.residualSurplus,
        steps: protection.steps,
        mandatoryTotal: protection.monthlyTotal,
        protection,
    };
}

export const applyHygieneWaterfall = applyHardWaterfall;
