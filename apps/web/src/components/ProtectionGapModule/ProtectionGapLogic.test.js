import { describe, it, expect } from 'vitest';
import { calculateProtectionGap, shouldAssessSpouseProtection, getIncomeMultiple } from './ProtectionGapLogic';

describe('shouldAssessSpouseProtection', () => {
    it('skips spouse when isSpouseWorking is false (detailed not-working)', () => {
        expect(shouldAssessSpouseProtection({ relation: 'Spouse', isSpouseWorking: false })).toBe(false);
    });

    it('assesses spouse when isSpouseWorking is true', () => {
        expect(shouldAssessSpouseProtection({ relation: 'Spouse', isSpouseWorking: true })).toBe(true);
    });

    it('falls back to occupation housewife when isSpouseWorking is unset', () => {
        expect(shouldAssessSpouseProtection({ relation: 'Spouse', occupation: 'Housewife' })).toBe(false);
        expect(shouldAssessSpouseProtection({ relation: 'Spouse', occupation: 'Salaried' })).toBe(true);
    });
});

describe('ProtectionGapLogic', () => {
    const mockExpenseCategories = {
        household: { grocery: 100000, rent: 30000 },
        emi: { personalLoan: 0, healthInsurance: 0 },
        savings: {}
    }; // Total household = 130k

    const mockFamilyMembers = [
        { name: 'John', relation: 'Self', age: 35, retirementAge: 60 },
        { name: 'Jane', relation: 'Spouse', age: 33, retirementAge: 60, isSpouseWorking: true },
        { name: 'Aarav', relation: 'Child' }
    ];

    const mockPolicies = [];
    const mockInflationRates = { householdInflation: 6 };
    const mockCalculatorInputs = { expectedReturn: 7 };
    const mockGoals = [];
    const mockAssetCategories = {};
    const mockLiabilityCategories = {};

    it('calculates protection need and uses income cap correctly', () => {
        const mockIncome = {
            self: '200000', // 2.4 Cr/yr
            spouse: '50000' // 6L/yr
        };

        const results = calculateProtectionGap(
            mockExpenseCategories, 
            mockPolicies, 
            mockFamilyMembers, 
            mockIncome, 
            mockInflationRates, 
            mockCalculatorInputs, 
            mockGoals, 
            mockAssetCategories, 
            mockLiabilityCategories
        );

        // Self (John)
        expect(results.self.name).toBe('John');
        expect(results.self.insurabilityCap).toBe(2400000 * 25); // 6 Cr
        expect(results.self.isCapped).toBe(false); // His need is 2.4Cr which is < 6Cr
        expect(results.self.need).toBe(24000000); // 2.4 Cr

        // Spouse (Jane)
        expect(results.spouse.name).toBe('Jane');
        expect(results.spouse.insurabilityCap).toBe(600000 * 25); // 1.5 Cr
        expect(results.spouse.isCapped).toBe(false); 
        expect(results.spouse.need).toBe(0); // 0 shortfall
    });

    it('caps recommended SA when ideal cover exceeds eligibility cap', () => {
        const mockIncome = {
            self: '200000', // 2.4 Cr/yr (200k/m)
            spouse: '20000' // 2.4L/yr (20k/m)
        };
        const testFamily = [
            { name: 'John', relation: 'Self', age: 35, retirementAge: 60 },
            { name: 'Jane', relation: 'Spouse', age: 36, retirementAge: 60, isSpouseWorking: true },
            { name: 'Aarav', relation: 'Child' }
        ];
        const zeroExpenses = {
            household: { grocery: 0 },
            emi: { personalLoan: 0, healthInsurance: 0 },
            savings: {}
        };
        const liabilityCategories = {
            loans: { home: 60000000 }
        };

        const results = calculateProtectionGap(
            zeroExpenses, 
            mockPolicies, 
            testFamily, 
            mockIncome, 
            mockInflationRates, 
            mockCalculatorInputs, 
            mockGoals, 
            mockAssetCategories, 
            liabilityCategories
        );

        // Self (John)
        expect(results.self.insurabilityCap).toBe(60000000); // 6 Cr cap
        expect(results.self.isCapped).toBe(false);

        // Spouse (Jane)
        expect(results.spouse.insurabilityCap).toBe(4800000); // 48L cap (multiplier 20)
        expect(results.spouse.isCapped).toBe(true);
        expect(results.spouse.need).toBe(60000000); // Need is uncapped (6 Cr)
        expect(results.spouse.shortfall).toBe(60000000 - 4800000);
    });

    it('handles cases where Spouse is not present', () => {
        const singleFamily = [{ name: 'John', relation: 'Self', age: 35, retirementAge: 60 }];
        const results = calculateProtectionGap(
            mockExpenseCategories, mockPolicies, singleFamily, { self: '200000' }, 
            mockInflationRates, mockCalculatorInputs, mockGoals, mockAssetCategories, mockLiabilityCategories
        );

        expect(results.self.name).toBe('John');
        expect(results.spouse).toBe(null);
    });

    it('skips spouse gap when isSpouseWorking is false', () => {
        const family = [
            { name: 'John', relation: 'Self' },
            { name: 'Jane', relation: 'Spouse', isSpouseWorking: false },
        ];
        const results = calculateProtectionGap(
            mockExpenseCategories, mockPolicies, family, { self: '200000' }, 
            mockInflationRates, mockCalculatorInputs, mockGoals, mockAssetCategories, mockLiabilityCategories
        );
        expect(results.spouse).toBe(null);
    });
});
