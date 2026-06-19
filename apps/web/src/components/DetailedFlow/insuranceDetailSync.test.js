import { describe, it, expect } from 'vitest';
import {
    reconcileLifeCover,
    reconcileHealthCover,
    reconcileMemberLifePremium,
    reconcileMemberLifePremiumSummary,
    sumPolicySumAssured,
    sumHealthPolicyCover,
    deriveLifeMemberTotals,
    applyLifeEntryUpdate,
    getLifeMemberMonthlyTotal,
} from './insuranceDetailSync';

describe('insuranceDetailSync cover reconciliation', () => {
    it('sumPolicySumAssured totals life policy sum assured', () => {
        expect(sumPolicySumAssured([
            { planType: 'Term Insurance', sumAssured: '5000000', isProposed: false },
            { planType: 'Term Insurance', sumAssured: '3000000', isProposed: false },
        ])).toBe(8000000);
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
