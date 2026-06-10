import { describe, it, expect } from 'vitest';
import {
    initializeExpenseSnapshots,
    syncSummaryEmiSnapshot,
    getEffectiveMonthlyEmi,
    hasAnyEmiCommitment,
    isLikelySummaryEmiInHomeLoan,
} from './expenseDetailSync';

describe('expenseDetailSync EMI snapshot', () => {
    it('migrates legacy emi.homeLoan scalar to summaryEmiTotal when no snapshot exists', () => {
        const result = initializeExpenseSnapshots({
            emi: { homeLoan: '25000' },
            summaryEmiTotal: '',
        });

        expect(result.summaryEmiTotal).toBe('25000');
        expect(result.emi.homeLoan).toBe('');
    });

    it('replaces stale snapshot when legacy homeLoan scalar is re-edited (not 75000)', () => {
        const result = initializeExpenseSnapshots({
            emi: { homeLoan: '50000' },
            summaryEmiTotal: '25000',
        });

        expect(result.summaryEmiTotal).toBe('50000');
        expect(result.summaryEmiTotal).not.toBe('75000');
        expect(result.emi.homeLoan).toBe('');
    });

    it('preserves configured loan objects and does not overwrite snapshot from scalar', () => {
        const configuredHomeLoan = {
            principal: 1000000,
            emi: '25000',
            tenure: 120,
            startYear: 2024,
            startMonth: 1,
        };
        const result = initializeExpenseSnapshots({
            emi: { homeLoan: configuredHomeLoan },
            summaryEmiTotal: '25000',
        });

        expect(result.emi.homeLoan).toEqual(configuredHomeLoan);
        expect(result.summaryEmiTotal).toBe('25000');
    });

    it('keeps summaryEmiTotal when summary writes directly without emi.homeLoan', () => {
        const result = initializeExpenseSnapshots({
            emi: { homeLoan: '', personalLoan: '' },
            summaryEmiTotal: '50000',
        });

        expect(result.summaryEmiTotal).toBe('50000');
        expect(result.emi.homeLoan).toBe('');
    });

    it('syncSummaryEmiSnapshot replaces rather than accumulates', () => {
        expect(syncSummaryEmiSnapshot({
            summaryEmiTotal: '25000',
            emi: { homeLoan: '50000' },
        })).toBe('50000');
    });

    it('getEffectiveMonthlyEmi uses summaryEmiTotal when emi fields are cleared', () => {
        expect(getEffectiveMonthlyEmi({
            summaryEmiTotal: '50000',
            emi: { homeLoan: '', personalLoan: '' },
        })).toBe(50000);
    });

    it('getEffectiveMonthlyEmi prefers configured loans over summary snapshot', () => {
        expect(getEffectiveMonthlyEmi({
            summaryEmiTotal: '50000',
            emi: {
                homeLoan: { principal: 1000000, emi: '30000', tenure: 120, startYear: 2024, startMonth: 1 },
            },
        })).toBe(30000);
    });

    it('hasAnyEmiCommitment detects summaryEmiTotal and configured loans', () => {
        expect(hasAnyEmiCommitment({ summaryEmiTotal: '25000', emi: {} })).toBe(true);
        expect(hasAnyEmiCommitment({
            emi: { homeLoan: { principal: 1000000, emi: '25000' } },
        })).toBe(true);
        expect(hasAnyEmiCommitment({ summaryEmiTotal: '', emi: {} })).toBe(false);
    });

    it('isLikelySummaryEmiInHomeLoan detects lone scalar homeLoan', () => {
        expect(isLikelySummaryEmiInHomeLoan({ homeLoan: '50000' })).toBe(true);
        expect(isLikelySummaryEmiInHomeLoan({
            homeLoan: { principal: 1000000, emi: '25000' },
        })).toBe(false);
        expect(isLikelySummaryEmiInHomeLoan({
            homeLoan: '50000',
            personalLoan: '10000',
        })).toBe(false);
    });
});
