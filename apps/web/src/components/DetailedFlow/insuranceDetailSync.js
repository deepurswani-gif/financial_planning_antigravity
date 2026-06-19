import { convertToMonthly, convertToAnnual } from '../CashFlowModule/CashFlowLogic';
import { reconcileAmounts } from './detailReconcile';

export const FREQUENCY_OPTIONS = [
    { value: 'Monthly', label: 'Monthly' },
    { value: 'Quarterly', label: 'Quarterly' },
    { value: 'Half Yearly', label: 'Half Yearly' },
    { value: 'Annual', label: 'Annual' },
];

export const INSURANCE_DOC_KEYS = ['health', 'car', 'bike', 'others', 'life'];

export function getMemberInsuranceKey(member) {
    return member?.name || member?.relation || 'Member';
}

export function normalizeToCashFlowFrequency(freq) {
    if (freq === 'Annually') return 'Annual';
    if (freq === 'Half-Yearly') return 'Half Yearly';
    return freq || 'Annual';
}

export function normalizeToPolicyFrequency(freq) {
    if (freq === 'Annual') return 'Annually';
    if (freq === 'Half Yearly') return 'Half-Yearly';
    return freq || 'Annually';
}

export function emptyLifeEntry() {
    return { policyCount: 0, premiums: [], value: '', frequency: 'Annual' };
}

export function getLifeMemberMonthlyTotal(entry) {
    if (!entry) return 0;
    if (Array.isArray(entry.premiums) && entry.premiums.length > 0) {
        return entry.premiums.reduce(
            (sum, p) => sum + convertToMonthly(p.amount, p.frequency),
            0,
        );
    }
    return convertToMonthly(entry.value, entry.frequency);
}

/**
 * Derive legacy cash-flow scalar fields (value + frequency) from detailed premiums.
 * Preserves the user's entered amount and frequency when all active policies share
 * the same frequency; falls back to a monthly total only when frequencies differ.
 */
export function deriveLifeMemberTotals(entry) {
    const premiums = entry?.premiums;
    if (Array.isArray(premiums) && premiums.length > 0) {
        const active = premiums.filter((p) => parseFloat(p.amount) > 0);
        if (active.length === 0) {
            return { value: '', frequency: 'Annual' };
        }
        const frequencies = [...new Set(
            active.map((p) => normalizeToCashFlowFrequency(p.frequency)),
        )];
        if (frequencies.length === 1) {
            const total = active.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
            return {
                value: String(Math.round(total)),
                frequency: frequencies[0],
            };
        }
        const monthly = getLifeMemberMonthlyTotal(entry);
        return { value: String(Math.round(monthly)), frequency: 'Monthly' };
    }

    const val = parseFloat(entry?.value) || 0;
    if (val <= 0) {
        return { value: '', frequency: 'Annual' };
    }
    return {
        value: entry.value,
        frequency: normalizeToCashFlowFrequency(entry.frequency),
    };
}

export function migrateLifeEntry(entry) {
    if (!entry || typeof entry !== 'object') return emptyLifeEntry();

    if (Array.isArray(entry.premiums)) {
        const premiums = entry.premiums.map((p) => ({
            amount: p.amount ?? '',
            frequency: normalizeToCashFlowFrequency(p.frequency),
        }));
        const policyCount = entry.policyCount ?? premiums.length;
        const derived = deriveLifeMemberTotals({ premiums });
        return { policyCount, premiums, ...derived };
    }

    const val = parseFloat(entry.value) || 0;
    if (val > 0) {
        const premiums = [{
            amount: entry.value,
            frequency: normalizeToCashFlowFrequency(entry.frequency),
        }];
        const policyCount = entry.policyCount || 1;
        const sizedPremiums = resizePremiums(premiums, policyCount);
        const derived = deriveLifeMemberTotals({ premiums: sizedPremiums });
        return { policyCount, premiums: sizedPremiums, ...derived };
    }

    const policyCount = entry.policyCount || 0;
    return {
        policyCount,
        premiums: resizePremiums([], policyCount),
        value: '',
        frequency: 'Annual',
    };
}

export function resizePremiums(premiums, count) {
    const n = Math.max(0, parseInt(count, 10) || 0);
    const next = premiums.slice(0, n);
    while (next.length < n) {
        next.push({ amount: '', frequency: 'Annual' });
    }
    return next;
}

export function memberHasLifeActivity(entry, memberName, policies = []) {
    const migrated = migrateLifeEntry(entry);
    if (migrated.policyCount > 0) return true;
    if (getLifeMemberMonthlyTotal(migrated) > 0) return true;
    if (migrated.premiums.some((p) => parseFloat(p.amount) > 0)) return true;
    return policies.some(
        (p) => p.insuredName === memberName && !p.isProposed && parseFloat(p.premium) > 0,
    );
}

export function applyLifeEntryUpdate(entry, patch) {
    const base = migrateLifeEntry(entry);
    const merged = { ...base, ...patch };
    if (patch.policyCount !== undefined) {
        merged.premiums = resizePremiums(merged.premiums || [], patch.policyCount);
        merged.policyCount = Math.max(0, parseInt(patch.policyCount, 10) || 0);
    }
    if (patch.premiums) {
        merged.premiums = patch.premiums.map((p) => ({
            amount: p.amount ?? '',
            frequency: normalizeToCashFlowFrequency(p.frequency),
        }));
        merged.policyCount = merged.premiums.length;
    }
    const derived = deriveLifeMemberTotals(merged);
    return { ...merged, ...derived };
}

export function migrateInsuranceBlock(insurance = {}) {
    const life = {};
    Object.entries(insurance.life || {}).forEach(([key, entry]) => {
        life[key] = migrateLifeEntry(entry);
    });

    return {
        health: insurance.health || { value: '', frequency: 'Annual' },
        car: insurance.car || { value: '', frequency: 'Annual' },
        bike: insurance.bike || { value: '', frequency: 'Annual' },
        others: insurance.others || { value: '', frequency: 'Annual' },
        life,
        policyDocs: insurance.policyDocs || {},
    };
}

export function initializeInsuranceSnapshots(expenseCategories = {}) {
    const insurance = migrateInsuranceBlock(expenseCategories.insurance || {});
    const existingSummaries = expenseCategories.summaryLifePremiums || {};
    const summaryLifePremiums = { ...existingSummaries };

    Object.entries(insurance.life || {}).forEach(([key, entry]) => {
        if (summaryLifePremiums[key] !== undefined && summaryLifePremiums[key] !== '') return;
        const monthly = getLifeMemberMonthlyTotal(migrateLifeEntry(entry));
        if (monthly > 0) {
            summaryLifePremiums[key] = String(Math.round(monthly));
        }
    });

    return {
        ...expenseCategories,
        summaryLifePremiums,
        insurance,
    };
}

export function createPolicySlot(memberName, premiumRow = {}, isProposed = false) {
    return {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        insuredName: memberName,
        company: '',
        planName: '',
        planType: 'Term Insurance',
        isProposed,
        startDate: '',
        endDate: '',
        sumAssured: '',
        paymentTerm: '',
        policyTerm: '',
        premium: premiumRow.amount || '',
        frequency: normalizeToPolicyFrequency(premiumRow.frequency),
        maturityAmount: '',
    };
}

export function syncPolicySlots(memberName, newCount, policies = [], premiumRows = [], isProposed = false) {
    const count = Math.max(0, parseInt(newCount, 10) || 0);
    const current = policies.filter(
        (p) => p.insuredName === memberName && !!p.isProposed === isProposed,
    );
    const other = policies.filter(
        (p) => !(p.insuredName === memberName && !!p.isProposed === isProposed),
    );

    if (count > current.length) {
        const toAdd = count - current.length;
        const newPolicies = Array.from({ length: toAdd }, (_, i) => {
            const row = premiumRows[current.length + i] || {};
            return createPolicySlot(memberName, row, isProposed);
        });
        const updatedCurrent = [...current];
        premiumRows.slice(0, count).forEach((row, i) => {
            if (updatedCurrent[i] && row.amount) {
                updatedCurrent[i] = {
                    ...updatedCurrent[i],
                    premium: row.amount,
                    frequency: normalizeToPolicyFrequency(row.frequency),
                };
            }
        });
        return [...other, ...updatedCurrent, ...newPolicies];
    }

    const kept = current.slice(0, count).map((p, i) => {
        const row = premiumRows[i];
        if (!row) return p;
        return {
            ...p,
            premium: row.amount || p.premium,
            frequency: row.amount
                ? normalizeToPolicyFrequency(row.frequency)
                : p.frequency,
        };
    });
    return [...other, ...kept];
}

export function sumPolicyPremiumsAnnual(policies = [], memberName, isProposed = false) {
    return policies
        .filter((p) => p.insuredName === memberName && !!p.isProposed === isProposed)
        .reduce((sum, p) => {
            const premium = parseFloat(p.premium) || 0;
            return sum + convertToAnnual(premium, normalizeToCashFlowFrequency(p.frequency));
        }, 0);
}

export function sumMemberLifeAnnual(entry) {
    return getLifeMemberMonthlyTotal(migrateLifeEntry(entry)) * 12;
}

export function sumAllLifeAnnual(lifeMap = {}) {
    return Object.values(lifeMap).reduce((sum, entry) => sum + sumMemberLifeAnnual(entry), 0);
}

export function sumExistingPoliciesAnnual(policies = []) {
    return policies
        .filter((p) => !p.isProposed)
        .reduce((sum, p) => {
            const premium = parseFloat(p.premium) || 0;
            return sum + convertToAnnual(premium, normalizeToCashFlowFrequency(p.frequency));
        }, 0);
}

export function membersWithLifeDetails(policies = [], familyMembers = []) {
    const names = new Set();
    policies
        .filter((p) => !p.isProposed && (parseFloat(p.premium) > 0 || p.company || p.planName))
        .forEach((p) => names.add(p.insuredName));
    familyMembers.forEach((m) => {
        const key = getMemberInsuranceKey(m);
        if (m.relation === 'Self' || m.relation === 'Spouse') {
            names.add(key);
        }
    });
    return names;
}

export function sumPolicySumAssured(policies = [], { lifeOnly = true } = {}) {
    return policies
        .filter((p) => !p.isProposed)
        .filter((p) => {
            if (!lifeOnly) return true;
            const type = (p.planType || '').toLowerCase();
            return type.includes('life') || type.includes('term') || !p.planType;
        })
        .reduce((sum, p) => sum + (parseFloat(p.sumAssured) || 0), 0);
}

export function sumHealthPolicyCover(policies = []) {
    return policies
        .filter((p) => !p.isProposed)
        .filter((p) => {
            const type = (p.planType || '').toLowerCase();
            return type.includes('health') || type.includes('medical');
        })
        .reduce((sum, p) => sum + (parseFloat(p.sumAssured) || 0), 0);
}

export function reconcileLifeCover(summaryLifeCover, policies = []) {
    return reconcileAmounts(summaryLifeCover, sumPolicySumAssured(policies));
}

export function reconcileHealthCover(summaryHealthCover, policies = []) {
    return reconcileAmounts(summaryHealthCover, sumHealthPolicyCover(policies));
}

/** Compare cash-flow life premium entry vs policy-details premium for one member (monthly). */
export function reconcileMemberLifePremium(memberEntry, policies = [], memberName) {
    const cashFlowMonthly = getLifeMemberMonthlyTotal(migrateLifeEntry(memberEntry));
    const policyMonthly = sumPolicyPremiumsAnnual(policies, memberName, false) / 12;
    return reconcileAmounts(cashFlowMonthly, policyMonthly);
}

/** Compare preserved summary premium snapshot vs detailed premium entry for one member (monthly). */
export function reconcileMemberLifePremiumSummary(summaryMonthly, memberEntry) {
    const summary = parseFloat(summaryMonthly) || 0;
    const detail = getLifeMemberMonthlyTotal(migrateLifeEntry(memberEntry));
    return reconcileAmounts(summary, detail);
}
