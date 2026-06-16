import { describe, it, expect } from 'vitest';
import {
    reconcileMemberIncome,
    getMemberDetailMonthlyTotal,
    initializeIncomeSnapshots,
    normalizeIncomeState,
} from './incomeDetailSync';

describe('incomeDetailSync', () => {
    it('initializeIncomeSnapshots migrates legacy self into summarySelfInHand', () => {
        const result = initializeIncomeSnapshots({ self: '80000', spouse: '' });
        expect(result.summarySelfInHand).toBe('80000');
    });

    it('getMemberDetailMonthlyTotal sums primary passive and other income', () => {
        const total = getMemberDetailMonthlyTotal({
            takeHomeProfit: '70000',
            passiveIncome: '10000',
            otherIncome: [{ amount: '5000' }],
        }, 'Business Owner');
        expect(total).toBe(85000);
    });

    it('reconcileMemberIncome reports under when detail is below summary snapshot', () => {
        const result = reconcileMemberIncome('100000', { inHandSalary: '80000' }, 'Private Sector');
        expect(result.status).toBe('under');
        expect(result.delta).toBe(20000);
    });

    it('normalizeIncomeState preserves summary snapshot fields', () => {
        const normalized = normalizeIncomeState({
            self: '90000',
            summarySelfInHand: '85000',
        });
        expect(normalized.summarySelfInHand).toBe('85000');
        expect(normalized.self).toBe('90000');
    });
});
