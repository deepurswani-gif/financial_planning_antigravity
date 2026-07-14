import { describe, it, expect } from 'vitest';
import {
    initializeExpenseSnapshots,
    syncSummaryEmiSnapshot,
    getEffectiveMonthlyEmi,
    getEffectiveMonthlyHousehold,
    reconcileHousehold,
    reconcileInsurance,
    reconcileEmi,
    hasAnyEmiCommitment,
    isLikelySummaryEmiInHomeLoan,
    inferSelectedEmiLoanTypes,
    toggleEmiLoanTypeSelection,
    clearEmiLoansNotInSelection,
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

describe('expenseDetailSync EMI loan type selection', () => {
    it('infers selected loan types from configured loans when no explicit selection exists', () => {
        expect(inferSelectedEmiLoanTypes({
            emi: {
                homeLoan: { principal: 1000000, emi: '25000' },
                carLoan: { principal: 500000, emi: '12000' },
            },
        })).toEqual(['homeLoan', 'carLoan']);
    });

    it('prefers stored selectedEmiLoanTypes over configured inference', () => {
        expect(inferSelectedEmiLoanTypes({
            selectedEmiLoanTypes: ['personalLoan'],
            emi: {
                homeLoan: { principal: 1000000, emi: '25000' },
            },
        })).toEqual(['personalLoan']);
    });

    it('toggleEmiLoanTypeSelection supports multi-select and deselect', () => {
        expect(toggleEmiLoanTypeSelection(['homeLoan'], 'carLoan')).toEqual(['homeLoan', 'carLoan']);
        expect(toggleEmiLoanTypeSelection(['homeLoan', 'carLoan'], 'homeLoan')).toEqual(['carLoan']);
    });

    it('clearEmiLoansNotInSelection removes unchecked loan data', () => {
        expect(clearEmiLoansNotInSelection({
            homeLoan: { principal: 1000000, emi: '25000' },
            carLoan: { principal: 500000, emi: '12000' },
            otherEmiName: 'Gold Loan',
        }, ['homeLoan'])).toEqual({
            homeLoan: { principal: 1000000, emi: '25000' },
            personalLoan: '',
            educationLoan: '',
            carLoan: '',
            twoWheelerLoan: '',
            otherEmi: '',
            otherEmiName: '',
        });
    });

    it('initializeExpenseSnapshots preserves selectedEmiLoanTypes from configured loans', () => {
        const result = initializeExpenseSnapshots({
            emi: {
                homeLoan: { principal: 1000000, emi: '25000' },
                personalLoan: '',
            },
            summaryEmiTotal: '25000',
        });

        expect(result.selectedEmiLoanTypes).toEqual(['homeLoan']);
    });

    it('initializeExpenseSnapshots preserves summaryInsuranceTotal', () => {
        const result = initializeExpenseSnapshots({
            summaryInsuranceTotal: '5000',
            household: { grocery: '', rent: '', lifestyle: '', medical: '', travel: '', education: '' },
            emi: {},
        });

        expect(result.summaryInsuranceTotal).toBe('5000');
    });
});

describe('expenseDetailSync household snapshot', () => {
    it('getEffectiveMonthlyHousehold uses summaryHouseholdTotal when breakdown is cleared', () => {
        expect(getEffectiveMonthlyHousehold({
            summaryHouseholdTotal: '45000',
            household: { grocery: '', rent: '', lifestyle: '', medical: '', travel: '', education: '' },
        })).toBe(45000);
    });

    it('getEffectiveMonthlyHousehold prefers detailed breakdown over snapshot', () => {
        expect(getEffectiveMonthlyHousehold({
            summaryHouseholdTotal: '45000',
            household: { grocery: '20000', rent: '15000', lifestyle: '', medical: '', travel: '', education: '' },
        })).toBe(35000);
    });

    it('reconcileHousehold reports under-allocation when detail is below summary', () => {
        const result = reconcileHousehold({
            summaryHouseholdTotal: '50000',
            household: { grocery: '30000', rent: '', lifestyle: '', medical: '', travel: '', education: '' },
        });
        expect(result.status).toBe('under');
        expect(result.delta).toBe(20000);
    });

    it('reconcileHousehold includes education fees in detailed total', () => {
        const result = reconcileHousehold({
            summaryHouseholdTotal: '50000',
            household: { grocery: '30000', rent: '', lifestyle: '', medical: '', travel: '', education: '5000' },
        }, [
            { relation: 'Child', monthlyEducationExpense: '5000' },
        ]);
        expect(result.status).toBe('under');
        expect(result.delta).toBe(15000);
    });

    it('reconcileEmi reports match when configured total equals summary', () => {
        const result = reconcileEmi({
            summaryEmiTotal: '25000',
            emi: {
                homeLoan: { principal: 1000000, emi: '25000', tenure: 120, startYear: 2024, startMonth: 1 },
            },
        });
        expect(result.status).toBe('match');
    });

    it('reconcileInsurance includes all premium types in detail total', () => {
        const result = reconcileInsurance({
            summaryInsuranceTotal: '5000',
            insurance: {
                health: { value: '12000', frequency: 'Annual' },
                life: {},
            },
        });
        expect(result.detailTotal).toBe(1000);
        expect(result.status).toBe('under');
        expect(result.delta).toBe(4000);
    });

    it('reconcileInsurance matches when detailed premiums equal summary', () => {
        const result = reconcileInsurance({
            summaryInsuranceTotal: '5000',
            insurance: {
                health: { value: '60000', frequency: 'Annual' },
                life: {},
            },
        });
        expect(result.status).toBe('match');
    });

    it('reconcileHousehold and reconcileInsurance reconcile independently', () => {
        const householdResult = reconcileHousehold({
            summaryHouseholdTotal: '35000',
            household: { grocery: '30000', rent: '5000', lifestyle: '', medical: '', travel: '', education: '' },
        });
        const insuranceResult = reconcileInsurance({
            summaryInsuranceTotal: '5000',
            insurance: {
                health: { value: '60000', frequency: 'Annual' },
                life: {},
            },
        });
        expect(householdResult.status).toBe('match');
        expect(insuranceResult.status).toBe('match');
    });
});
