import { describe, it, expect } from 'vitest';
import {
    reconcileLifeCover,
    reconcileHealthCover,
    sumPolicySumAssured,
    sumHealthPolicyCover,
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
});
