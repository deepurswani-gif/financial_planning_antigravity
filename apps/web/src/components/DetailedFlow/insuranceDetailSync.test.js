import { describe, it, expect } from 'vitest';
import {
    reconcileLifeCover,
    reconcileHealthCover,
    reconcileMemberLifePremium,
    reconcileMemberLifePremiumSummary,
    sumPolicySumAssured,
    sumMemberLifeCover,
    sumHealthPolicyCover,
    getEffectiveLifeCover,
    getEffectiveHealthCover,
    deriveSummaryCoverWriteBack,
    deriveLifeMemberTotals,
    applyLifeEntryUpdate,
    getLifeMemberMonthlyTotal,
    getInsuranceMonthlyTotal,
    getEffectiveMonthlyInsurance,
    mapPlanTypeToAllocType,
    policyDetailsToAllocationFields,
    findStudioAllocationForPolicy,
    syncPolicyToStudioAllocations,
    shouldIncludeStudioInsuranceInProjections,
    policyHasProjectionPremium,
} from './insuranceDetailSync';

describe('insuranceDetailSync cover reconciliation', () => {
    it('sumPolicySumAssured totals life policy sum assured', () => {
        expect(sumPolicySumAssured([
            { planType: 'Term Insurance', sumAssured: '5000000', isProposed: false },
            { planType: 'Term Insurance', sumAssured: '3000000', isProposed: false },
        ])).toBe(8000000);
    });

    it('sumMemberLifeCover totals only that insured member life policies', () => {
        expect(sumMemberLifeCover([
            { planType: 'Term Insurance', sumAssured: '5000000', insuredName: 'Alex', isProposed: false },
            { planType: 'Term Insurance', sumAssured: '3000000', insuredName: 'Sam', isProposed: false },
            { planType: 'Health Insurance', sumAssured: '1000000', insuredName: 'Alex', isProposed: false },
            { planType: 'Term Insurance', sumAssured: '2000000', insuredName: 'Alex', isProposed: true },
        ], 'Alex')).toBe(5000000);
    });

    it('reconcileLifeCover reports match when totals align', () => {
        const result = reconcileLifeCover('10000000', [
            { planType: 'Term Insurance', sumAssured: '10000000', isProposed: false },
        ]);
        expect(result.status).toBe('match');
    });

    it('reconcileHealthCover reports under when policy cover is lower', () => {
        const result = reconcileHealthCover('500000', [
            { planType: 'Health Insurance', sumAssured: '300000', isProposed: false },
        ]);
        expect(result.status).toBe('under');
        expect(result.delta).toBe(200000);
    });

    it('sumHealthPolicyCover ignores non-health policies', () => {
        expect(sumHealthPolicyCover([
            { planType: 'Health Insurance', sumAssured: '500000', isProposed: false },
            { planType: 'Term Insurance', sumAssured: '10000000', isProposed: false },
        ])).toBe(500000);
    });

    it('getEffectiveLifeCover prefers detailed sum assured over summary', () => {
        expect(getEffectiveLifeCover('0', [
            { planType: 'Term Insurance', sumAssured: '10000000', isProposed: false },
        ])).toBe(10000000);
    });

    it('getEffectiveLifeCover counts Saving Plan and ULIP sum assured', () => {
        expect(getEffectiveLifeCover('0', [
            { planType: 'Saving Plan', sumAssured: '7500000', isProposed: false },
        ])).toBe(7500000);
        expect(getEffectiveLifeCover('0', [
            { planType: 'ULIP', sumAssured: '2000000', isProposed: false },
        ])).toBe(2000000);
    });

    it('getEffectiveLifeCover ignores health policies when summing life cover', () => {
        expect(getEffectiveLifeCover('0', [
            { planType: 'Health Insurance', sumAssured: '500000', isProposed: false },
            { planType: 'Saving Plan', sumAssured: '7500000', isProposed: false },
        ])).toBe(7500000);
    });

    it('getEffectiveLifeCover falls back to summary when policies have no cover', () => {
        expect(getEffectiveLifeCover('5000000', [
            { planType: 'Term Insurance', sumAssured: '', isProposed: false },
        ])).toBe(5000000);
    });

    it('getEffectiveLifeCover ignores proposed policies', () => {
        expect(getEffectiveLifeCover('0', [
            { planType: 'Term Insurance', sumAssured: '10000000', isProposed: true },
        ])).toBe(0);
    });

    it('getEffectiveHealthCover prefers detailed cover and overrides hasHealthInsurance false', () => {
        expect(getEffectiveHealthCover('', false, [
            { planType: 'Health Insurance', sumAssured: '1500000', isProposed: false },
        ])).toBe(1500000);
    });

    it('getEffectiveHealthCover returns 0 when summary said no and no detailed cover', () => {
        expect(getEffectiveHealthCover('500000', false, [])).toBe(0);
    });

    it('getEffectiveHealthCover uses summary when detail empty and has cover', () => {
        expect(getEffectiveHealthCover('800000', true, [])).toBe(800000);
    });

    it('deriveSummaryCoverWriteBack writes life and health when detailed cover exists', () => {
        expect(deriveSummaryCoverWriteBack([
            { planType: 'Term Insurance', sumAssured: '10000000', isProposed: false },
            { planType: 'Health Insurance', sumAssured: '500000', isProposed: false },
        ])).toEqual({
            summaryLifeCover: '10000000',
            hasLifeInsurance: true,
            summaryHealthCover: '500000',
            hasHealthInsurance: true,
        });
    });

    it('deriveSummaryCoverWriteBack returns empty patch when no detailed cover', () => {
        expect(deriveSummaryCoverWriteBack([
            { planType: 'Term Insurance', sumAssured: '', isProposed: false },
        ])).toEqual({});
    });

    it('reconcileMemberLifePremium compares cash-flow vs policy-details premium per member', () => {
        const result = reconcileMemberLifePremium(
            { policyCount: 1, premiums: [{ amount: '12000', frequency: 'Annual' }] },
            [{ insuredName: 'Self', premium: '6000', frequency: 'Annually', isProposed: false }],
            'Self',
        );
        expect(result.status).toBe('under');
        expect(result.summaryTotal).toBe(1000);
        expect(result.detailTotal).toBe(500);
    });

    it('reconcileMemberLifePremiumSummary compares snapshot vs detailed premium', () => {
        const result = reconcileMemberLifePremiumSummary('2500', {
            policyCount: 1,
            premiums: [{ amount: '30000', frequency: 'Annual' }],
        });
        expect(result.status).toBe('match');
        expect(result.summaryTotal).toBe(2500);
        expect(result.detailTotal).toBe(2500);
    });

    it('reconcileMemberLifePremiumSummary reports under when detail is below snapshot', () => {
        const result = reconcileMemberLifePremiumSummary('3000', {
            policyCount: 1,
            premiums: [{ amount: '24000', frequency: 'Annual' }],
        });
        expect(result.status).toBe('under');
        expect(result.delta).toBe(1000);
    });
});

describe('deriveLifeMemberTotals frequency preservation', () => {
    it('preserves half-yearly amount and frequency for a single policy', () => {
        const result = deriveLifeMemberTotals({
            premiums: [{ amount: '18000', frequency: 'Half Yearly' }],
        });
        expect(result).toEqual({ value: '18000', frequency: 'Half Yearly' });
        expect(getLifeMemberMonthlyTotal({ ...result, premiums: [{ amount: '18000', frequency: 'Half Yearly' }] })).toBe(3000);
    });

    it('preserves annual amount and frequency for a single policy', () => {
        const result = deriveLifeMemberTotals({
            premiums: [{ amount: '30000', frequency: 'Annual' }],
        });
        expect(result).toEqual({ value: '30000', frequency: 'Annual' });
    });

    it('sums amounts when multiple policies share the same frequency', () => {
        const result = deriveLifeMemberTotals({
            premiums: [
                { amount: '12000', frequency: 'Annual' },
                { amount: '6000', frequency: 'Annual' },
            ],
        });
        expect(result).toEqual({ value: '18000', frequency: 'Annual' });
    });

    it('falls back to monthly total when policies have mixed frequencies', () => {
        const result = deriveLifeMemberTotals({
            premiums: [
                { amount: '12000', frequency: 'Annual' },
                { amount: '6000', frequency: 'Half Yearly' },
            ],
        });
        expect(result.frequency).toBe('Monthly');
        expect(result.value).toBe('2000');
    });

    it('applyLifeEntryUpdate preserves half-yearly in legacy scalar fields', () => {
        const updated = applyLifeEntryUpdate(
            { policyCount: 0, premiums: [] },
            {
                policyCount: 1,
                premiums: [{ amount: '18000', frequency: 'Half Yearly' }],
            },
        );
        expect(updated.value).toBe('18000');
        expect(updated.frequency).toBe('Half Yearly');
        expect(updated.premiums[0]).toEqual({ amount: '18000', frequency: 'Half Yearly' });
    });
});

describe('getInsuranceMonthlyTotal', () => {
    it('sums health, vehicle, and life premiums as monthly amounts', () => {
        const total = getInsuranceMonthlyTotal({
            health: { value: '12000', frequency: 'Annual' },
            car: { value: '3000', frequency: 'Quarterly' },
            life: {
                Self: { value: '24000', frequency: 'Annual' },
            },
            policyDocs: { health: 'policy.pdf' },
        });
        expect(total).toBe(4000);
    });
});

describe('getEffectiveMonthlyInsurance', () => {
    it('uses summaryInsuranceTotal when detailed insurance is empty', () => {
        expect(getEffectiveMonthlyInsurance({
            summaryInsuranceTotal: '5000',
            insurance: { health: { value: '', frequency: 'Annual' }, life: {} },
        })).toBe(5000);
    });

    it('prefers detailed insurance over summary snapshot', () => {
        expect(getEffectiveMonthlyInsurance({
            summaryInsuranceTotal: '5000',
            insurance: {
                health: { value: '12000', frequency: 'Annual' },
                life: {},
            },
        })).toBe(1000);
    });
});

describe('studio policy sync helpers', () => {
    const studioTerm = {
        id: 101,
        type: 'Term Insurance',
        amount: 5000,
        frequency: 'Monthly',
        duration: 10,
        startYear: 2026,
        startMonth: 7,
        studioPlanKey: '2026-6',
    };

    const studioLife = {
        id: 202,
        type: 'Life Insurance',
        amount: 3000,
        frequency: 'Monthly',
        duration: 10,
        startYear: 2026,
        startMonth: 7,
        insuredMember: 'Self',
        studioPlanKey: '2026-6',
    };

    it('mapPlanTypeToAllocType maps term, life, and health plan types', () => {
        expect(mapPlanTypeToAllocType('Term Insurance')).toBe('Term Insurance');
        expect(mapPlanTypeToAllocType('Saving Plan')).toBe('Life Insurance');
        expect(mapPlanTypeToAllocType('ULIP')).toBe('Life Insurance');
        expect(mapPlanTypeToAllocType('Health Insurance')).toBe('Health Insurance');
    });

    it('policyDetailsToAllocationFields maps premium term and start date', () => {
        expect(policyDetailsToAllocationFields({
            premium: '4500',
            frequency: 'Annually',
            paymentTerm: '15',
            startDate: '2026-07-01',
            insuredName: 'Self',
        })).toEqual({
            amount: 4500,
            frequency: 'Annual',
            duration: 15,
            startYear: 2026,
            startMonth: 7,
            insuredMember: 'Self',
        });
    });

    it('findStudioAllocationForPolicy prefers sourceAllocationId', () => {
        const policy = {
            planType: 'Term Insurance',
            sourceAllocationId: 101,
            insuredName: 'Self',
        };
        expect(findStudioAllocationForPolicy(policy, [studioLife, studioTerm])).toEqual(studioTerm);
    });

    it('syncPolicyToStudioAllocations writes payment term and premium onto term row', () => {
        const next = syncPolicyToStudioAllocations(
            {
                planType: 'Term Insurance',
                sourceAllocationId: 101,
                premium: '4500',
                frequency: 'Monthly',
                paymentTerm: '15',
                startDate: '2026-07-01',
                insuredName: 'Self',
            },
            [studioTerm, studioLife],
        );
        expect(next[0]).toMatchObject({
            id: 101,
            amount: 4500,
            duration: 15,
            frequency: 'Monthly',
            startYear: 2026,
            startMonth: 7,
        });
        expect(next[1]).toBe(studioLife);
    });

    it('syncPolicyToStudioAllocations writes life policy back by insured member', () => {
        const next = syncPolicyToStudioAllocations(
            {
                planType: 'Saving Plan',
                premium: '8000',
                frequency: 'Annually',
                paymentTerm: '12',
                startDate: '2027-01-15',
                insuredName: 'Self',
            },
            [studioTerm, studioLife],
        );
        expect(next[1]).toMatchObject({
            id: 202,
            amount: 8000,
            frequency: 'Annual',
            duration: 12,
            startYear: 2027,
            startMonth: 1,
            insuredMember: 'Self',
        });
    });

    it('shouldIncludeStudioInsuranceInProjections skips alloc when linked policy has premium', () => {
        const policies = [{
            id: 'p1',
            sourceAllocationId: 101,
            premium: '4500',
            paymentTerm: '15',
            startDate: '2026-07-01',
            frequency: 'Monthly',
        }];
        expect(policyHasProjectionPremium(policies[0])).toBe(true);
        expect(shouldIncludeStudioInsuranceInProjections(studioTerm, policies)).toBe(false);
        expect(shouldIncludeStudioInsuranceInProjections(studioTerm, [])).toBe(true);
    });

    it('shouldIncludeStudioInsuranceInProjections keeps alloc when linked policy is incomplete', () => {
        const policies = [{
            id: 'p1',
            sourceAllocationId: 101,
            premium: '',
            paymentTerm: '',
            startDate: '',
        }];
        expect(shouldIncludeStudioInsuranceInProjections(studioTerm, policies)).toBe(true);
    });
});
