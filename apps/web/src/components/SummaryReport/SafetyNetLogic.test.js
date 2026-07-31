import { describe, it, expect } from 'vitest';
import {
    MIN_HEALTH_COVER,
    calculateProtectionData,
    calculateHealthInsuranceData,
    buildRecoverySteps,
} from './SafetyNetLogic';

const baseProtection = {
    hasGap: false,
    protectionGap: 0,
};

const baseContingency = {
    gap: 0,
};

describe('calculateProtectionData', () => {
    const expenses = { summaryHouseholdTotal: '50000', summaryEmiTotal: '10000' };

    it('uses summary life cover when policies are empty', () => {
        const result = calculateProtectionData(expenses, '1000000', [], []);
        expect(result.coverageHave).toBe(1000000);
        expect(result.coverageRequired).toBe(60000 * 200);
    });

    it('prefers detailed policy sum assured over summary 0', () => {
        const result = calculateProtectionData(expenses, '0', [], [
            { planType: 'Term Insurance', sumAssured: '5000000', isProposed: false },
        ]);
        expect(result.coverageHave).toBe(5000000);
        expect(result.coveredPercent).toBeGreaterThan(0);
    });
});

describe('calculateHealthInsuranceData', () => {
    it('reports none when user has no health insurance', () => {
        const result = calculateHealthInsuranceData('', false, [{ name: 'Self' }]);

        expect(result.minimumRequired).toBe(MIN_HEALTH_COVER);
        expect(result.coverageHave).toBe(0);
        expect(result.healthGap).toBe(MIN_HEALTH_COVER);
        expect(result.coveredPercent).toBe(0);
        expect(result.hasGap).toBe(true);
        expect(result.status).toBe('none');
    });

    it('reports partial when cover is below minimum', () => {
        const result = calculateHealthInsuranceData('500000', true, []);

        expect(result.coverageHave).toBe(500000);
        expect(result.healthGap).toBe(500000);
        expect(result.coveredPercent).toBe(50);
        expect(result.hasGap).toBe(true);
        expect(result.status).toBe('partial');
    });

    it('reports adequate when cover meets minimum', () => {
        const result = calculateHealthInsuranceData('1000000', true, []);

        expect(result.coverageHave).toBe(1000000);
        expect(result.healthGap).toBe(0);
        expect(result.coveredPercent).toBe(100);
        expect(result.hasGap).toBe(false);
        expect(result.status).toBe('adequate');
    });

    it('reports adequate when cover exceeds minimum', () => {
        const result = calculateHealthInsuranceData('1500000', true, []);

        expect(result.coveredPercent).toBe(100);
        expect(result.hasGap).toBe(false);
        expect(result.status).toBe('adequate');
    });

    it('prefers detailed health policies even when summary said no cover', () => {
        const result = calculateHealthInsuranceData('', false, [], [
            { planType: 'Health Insurance', sumAssured: '1000000', isProposed: false },
        ]);
        expect(result.coverageHave).toBe(1000000);
        expect(result.status).toBe('adequate');
        expect(result.hasGap).toBe(false);
    });
});

describe('buildRecoverySteps', () => {
    it('orders steps as life, health, then emergency fund', () => {
        const protection = { hasGap: true, protectionGap: 2000000 };
        const health = calculateHealthInsuranceData('500000', true, []);
        const contingency = { gap: 300000 };

        const steps = buildRecoverySteps(protection, health, contingency);

        expect(steps).toHaveLength(3);
        expect(steps[0].id).toBe('step-protection');
        expect(steps[1].id).toBe('step-health');
        expect(steps[2].id).toBe('step-contingency');
    });

    it('suggests full minimum when no health cover exists', () => {
        const health = calculateHealthInsuranceData('', false, []);
        const steps = buildRecoverySteps(baseProtection, health, baseContingency);

        expect(steps).toHaveLength(1);
        expect(steps[0].title).toBe('Get Family Health Cover');
        expect(steps[0].amount).toBe(MIN_HEALTH_COVER);
        expect(steps[0].icon).toBe('heart');
    });

    it('suggests gap amount when cover is partial', () => {
        const health = calculateHealthInsuranceData('400000', true, []);
        const steps = buildRecoverySteps(baseProtection, health, baseContingency);

        expect(steps).toHaveLength(1);
        expect(steps[0].title).toBe('Strengthen Health Cover');
        expect(steps[0].amount).toBe(600000);
    });

    it('omits health step when cover is adequate', () => {
        const health = calculateHealthInsuranceData('1200000', true, []);
        const steps = buildRecoverySteps(baseProtection, health, baseContingency);

        expect(steps).toHaveLength(0);
    });
});
