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

/** Sum all detailed insurance premiums (life per member + health/car/bike/others) as monthly INR. */
export function getInsuranceMonthlyTotal(insurance = {}) {
    return Object.entries(insurance).reduce((sum, [key, item]) => {
        if (key === 'life') {
            return sum + Object.values(item || {}).reduce(
                (lifeSum, lifeItem) => lifeSum + getLifeMemberMonthlyTotal(migrateLifeEntry(lifeItem)),
                0,
            );
        }
        if (key === 'policyDocs') return sum;
        if (!item || typeof item !== 'object' || item.value === undefined) return sum;
        return sum + convertToMonthly(item.value, item.frequency);
    }, 0);
}

/**
 * Prefer detailed insurance breakdown when entered; otherwise use summary snapshot.
 * Mirrors getEffectiveMonthlyEmi / getEffectiveMonthlySavings.
 */
export function getEffectiveMonthlyInsurance(expenseCategories = {}) {
    const detailed = getInsuranceMonthlyTotal(expenseCategories.insurance || {});
    if (detailed > 0) return detailed;
    return parseFloat(expenseCategories.summaryInsuranceTotal) || 0;
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
        .filter((p) => (lifeOnly ? isLifeCoverPolicy(p) : true))
        .reduce((sum, p) => sum + (parseFloat(p.sumAssured) || 0), 0);
}

/** Existing life sum assured for one insured member (excludes proposed + health). */
export function sumMemberLifeCover(policies = [], memberName = '') {
    if (!memberName) return 0;
    return policies
        .filter((p) => !p.isProposed)
        .filter((p) => isLifeCoverPolicy(p))
        .filter((p) => p.insuredName === memberName)
        .reduce((sum, p) => sum + (parseFloat(p.sumAssured) || 0), 0);
}

export function sumHealthPolicyCover(policies = []) {
    return policies
        .filter((p) => !p.isProposed)
        .filter((p) => isHealthCoverPolicy(p))
        .reduce((sum, p) => sum + (parseFloat(p.sumAssured) || 0), 0);
}

/**
 * Life cover products in this app: Term, Saving Plan, ULIP, and untitled slots.
 * Health/medical policies are excluded.
 */
export function isLifeCoverPolicy(policy = {}) {
    const type = (policy.planType || '').toLowerCase();
    if (!type) return true;
    if (type.includes('health') || type.includes('medical')) return false;
    return true;
}

export function isHealthCoverPolicy(policy = {}) {
    const type = (policy.planType || '').toLowerCase();
    return type.includes('health') || type.includes('medical');
}

export function reconcileLifeCover(summaryLifeCover, policies = []) {
    return reconcileAmounts(summaryLifeCover, sumPolicySumAssured(policies));
}

export function reconcileHealthCover(summaryHealthCover, policies = []) {
    return reconcileAmounts(summaryHealthCover, sumHealthPolicyCover(policies));
}

/**
 * Prefer detailed life sum assured when entered; otherwise use summary snapshot.
 * Mirrors getEffectiveMonthlyEmi / getEffectiveMonthlyInsurance.
 */
export function getEffectiveLifeCover(summaryLifeCover, policies = []) {
    const detailed = sumPolicySumAssured(policies);
    if (detailed > 0) return detailed;
    return parseFloat(summaryLifeCover) || 0;
}

/**
 * Prefer detailed health policy cover when entered; otherwise use summary snapshot.
 * Detailed cover overrides a summary "no health insurance" answer.
 */
export function getEffectiveHealthCover(summaryHealthCover, hasHealthInsurance = null, policies = []) {
    const detailed = sumHealthPolicyCover(policies);
    if (detailed > 0) return detailed;
    if (hasHealthInsurance === false) return 0;
    return parseFloat(summaryHealthCover) || 0;
}

/**
 * Write-back patch for summary cover fields when detailed policies carry sum assured.
 * Does not clear summary fields when detailed cover is empty (summary-only users).
 */
export function deriveSummaryCoverWriteBack(policies = []) {
    const patch = {};
    const life = sumPolicySumAssured(policies);
    if (life > 0) {
        patch.summaryLifeCover = String(Math.round(life));
        patch.hasLifeInsurance = true;
    }
    const health = sumHealthPolicyCover(policies);
    if (health > 0) {
        patch.summaryHealthCover = String(Math.round(health));
        patch.hasHealthInsurance = true;
    }
    return patch;
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

/** Studio / allocation types that mirror life-cover policy premiums in projections. */
export const STUDIO_PROTECTION_ALLOC_TYPES = [
    'Term Insurance',
    'Life Insurance',
    'Life Insurance Saving Plans',
    'Health Insurance',
];

export function mapPlanTypeToAllocType(planType = '') {
    const type = String(planType).toLowerCase();
    if (type.includes('health') || type.includes('medical')) return 'Health Insurance';
    if (type.includes('term')) return 'Term Insurance';
    if (type.includes('saving') || type.includes('ulip')) return 'Life Insurance Saving Plans';
    if (type.includes('life') || !planType) {
        return 'Life Insurance';
    }
    return 'Life Insurance';
}

export function mapPolicyFrequencyToAlloc(freq) {
    const normalized = normalizeToCashFlowFrequency(freq);
    if (normalized === 'Annual') return 'Annual';
    if (normalized === 'Half Yearly') return 'Half-Yearly';
    if (normalized === 'Quarterly') return 'Quarterly';
    return 'Monthly';
}

export function policyHasProjectionPremium(policy = {}) {
    const startDate = new Date(policy.startDate);
    if (Number.isNaN(startDate.getTime())) return false;
    const payTerm = parseInt(policy.paymentTerm, 10) || 0;
    const premium = parseFloat(policy.premium) || 0;
    return payTerm > 0 && premium > 0;
}

export function findStudioAllocationForPolicy(policy = {}, investmentAllocations = []) {
    if (policy == null) return null;
    const list = investmentAllocations || [];

    if (policy.sourceAllocationId != null && policy.sourceAllocationId !== '') {
        const byId = list.find((a) => String(a.id) === String(policy.sourceAllocationId));
        if (byId) return byId;
    }

    if (policy.absorbedAllocationId != null && policy.absorbedAllocationId !== '') {
        const byAbsorbed = list.find((a) => String(a.id) === String(policy.absorbedAllocationId));
        if (byAbsorbed) return byAbsorbed;
    }

    const allocType = mapPlanTypeToAllocType(policy.planType);
    const memberName = policy.insuredName || '';
    const candidates = list.filter((a) => {
        if (!STUDIO_PROTECTION_ALLOC_TYPES.includes(a.type)) return false;
        if (a.type !== allocType) return false;
        if (
            (allocType === 'Life Insurance' || allocType === 'Life Insurance Saving Plans')
            && memberName
        ) {
            return (a.insuredMember || '') === memberName;
        }
        return true;
    });

    if (candidates.length === 1) return candidates[0];
    if (policy.studioPlanKey) {
        return candidates.find((a) => a.studioPlanKey === policy.studioPlanKey) || null;
    }
    return candidates[0] || null;
}

/**
 * Map Detailed Flow / Insurance policy fields onto studio allocation shape.
 * Amount follows ProjectionLogic insurance convention: installment + frequency
 * (not annualized), matching Allocation Module Life Insurance rows.
 */
export function policyDetailsToAllocationFields(policy = {}) {
    const startDate = new Date(policy.startDate);
    const hasStart = !Number.isNaN(startDate.getTime());
    const startYear = hasStart
        ? startDate.getFullYear()
        : (parseInt(policy.startYear, 10) || undefined);
    const startMonth = hasStart
        ? startDate.getMonth() + 1
        : (parseInt(policy.startMonth, 10) || undefined);

    const fields = {
        amount: parseFloat(policy.premium) || 0,
        frequency: mapPolicyFrequencyToAlloc(policy.frequency),
        duration: Math.max(1, parseInt(policy.paymentTerm, 10) || 1),
    };

    if (Number.isFinite(startYear)) fields.startYear = startYear;
    if (Number.isFinite(startMonth)) fields.startMonth = startMonth;
    if (policy.insuredName) fields.insuredMember = policy.insuredName;

    return fields;
}

/**
 * Write policy premium / term / start back onto the linked studio Term or Life row.
 * Returns a new allocations array (unchanged reference if no match / no changes).
 */
export function syncPolicyToStudioAllocations(policy, investmentAllocations = []) {
    const match = findStudioAllocationForPolicy(policy, investmentAllocations);
    if (!match) return investmentAllocations;

    const patch = policyDetailsToAllocationFields(policy);
    let changed = false;
    const next = investmentAllocations.map((alloc) => {
        if (String(alloc.id) !== String(match.id)) return alloc;
        const updated = { ...alloc, ...patch };
        if (
            updated.amount !== alloc.amount
            || updated.frequency !== alloc.frequency
            || updated.duration !== alloc.duration
            || updated.startYear !== alloc.startYear
            || updated.startMonth !== alloc.startMonth
            || updated.insuredMember !== alloc.insuredMember
        ) {
            changed = true;
            return updated;
        }
        return alloc;
    });
    return changed ? next : investmentAllocations;
}

/** True when a policy is linked to this studio allocation id. */
export function isAllocationLinkedToPolicy(alloc = {}, policies = []) {
    if (alloc?.id == null) return false;
    const allocId = String(alloc.id);
    if (alloc.absorbedByPolicyId != null && alloc.absorbedByPolicyId !== '') return true;
    return (policies || []).some((p) => (
        String(p.sourceAllocationId) === allocId
        || String(p.absorbedAllocationId) === allocId
    ));
}

/**
 * Studio Term / Life / Health rows should contribute to projections only while no
 * linked policy already carries the premium (avoids double-counting surplus).
 */
export function shouldIncludeStudioInsuranceInProjections(alloc = {}, policies = []) {
    if (!STUDIO_PROTECTION_ALLOC_TYPES.includes(alloc.type)) return false;

    const allocId = alloc.id != null ? String(alloc.id) : null;
    const linked = (policies || []).filter((p) => {
        if (allocId == null) return false;
        return String(p.sourceAllocationId) === allocId
            || String(p.absorbedAllocationId) === allocId;
    });

    if (alloc.absorbedByPolicyId != null && alloc.absorbedByPolicyId !== '') {
        const absorbed = (policies || []).find(
            (p) => String(p.id) === String(alloc.absorbedByPolicyId),
        );
        if (absorbed && policyHasProjectionPremium(absorbed)) return false;
        if (!absorbed && linked.some(policyHasProjectionPremium)) return false;
        if (absorbed) return false;
    }

    if (linked.length === 0) return true;
    return !linked.some(policyHasProjectionPremium);
}
