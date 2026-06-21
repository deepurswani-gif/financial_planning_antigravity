import { describe, it, expect } from 'vitest';
import { generateProjections, EDUCATION_STANDARDS } from './ProjectionLogic';

describe('ProjectionLogic', () => {
    const mockParams = {
        familyMembers: [
            { relation: 'Self', age: 30, retirementAge: 60, dob: '1996-01-01' },
            { 
                relation: 'Child', 
                name: 'Junior', 
                standard: '5th standard', 
                annualSchoolFee: 50000 
            }
        ],
        income: { self: 100000 },
        expenseCategories: {
            household: { rent: 20000, education: 5000 },
            insurance: {
                life: { 'Self': { value: 1000, frequency: 'Monthly' } }
            },
            emi: { car: 10000 },
            savings: { sip: 10000 }
        },
        goals: [],
        inflationRates: {
            incomeIncrement: 10,
            householdInflation: 5,
            educationInflation: 8
        },
        startYear: 2026
    };

    it('calculates the correct retirement year for Self', () => {
        const projections = generateProjections(mockParams);
        expect(projections[projections.length - 1].year).toBe(2056);
    });

    it('calculates first year impact correctly for Monthly frequency starting in Dec', () => {
        const params = {
            ...mockParams,
            expenseCategories: { ...mockParams.expenseCategories, insurance: { life: {} } },
            investmentAllocations: [
                {
                    type: 'Life Insurance',
                    amount: 10000, // Monthly premium
                    startMonth: 12,
                    startYear: 2026,
                    duration: 1,
                    frequency: 'Monthly'
                }
            ]
        };
        const results = generateProjections(params);
        expect(results[0].insurancePremium).toBe(10000);
    });

    it('calculates first year impact correctly for Annual frequency starting in Dec', () => {
        const params = {
            ...mockParams,
            expenseCategories: { ...mockParams.expenseCategories, insurance: { life: {} } },
            investmentAllocations: [
                {
                    type: 'Life Insurance',
                    amount: 120000, // Annual premium
                    startMonth: 12,
                    startYear: 2026,
                    duration: 1,
                    frequency: 'Annual'
                }
            ]
        };
        const results = generateProjections(params);
        expect(results[0].insurancePremium).toBe(120000);
    });

    it('includes future life insurance allocations in savingsAndInvestments', () => {
        const params = {
            ...mockParams,
            investmentAllocations: [
                {
                    type: 'Life Insurance',
                    amount: 10000,
                    startMonth: 1,
                    startYear: 2026,
                    duration: 10,
                    frequency: 'Monthly'
                }
            ]
        };
        const results = generateProjections(params);
        // 12k base + 120k future (12 months * 10k) = 132k
        expect(results[0].insurancePremium).toBe(132000);
        // 120k savings (10k sip * 12) + 132k insurance = 252k
        expect(results[0].savingsAndInvestments).toBe(252000);
        // Total outflow no longer involves insurance premium.
        // household 20k*12 = 240k, emi 10k*12 = 120k, education 50k = 410k. total = 410k.
        expect(results[0].totalOutflow).toBe(410000);
    });

    it('uses Step 8 tax logic with selfDetail and standard deduction', () => {
        const params = {
            ...mockParams,
            familyMembers: [
                { relation: 'Self', age: 30, retirementAge: 62, dob: '1996-01-01', employmentType: 'Private Sector' },
            ],
            income: {
                self: '100000',
                selfDetail: {
                    inHandSalary: '100000',
                    needTaxPlanning: false,
                    otherIncome: [{ amount: '' }],
                },
            },
            inflationRates: { incomeIncrement: 0, householdInflation: 0, educationInflation: 0 },
            startYear: 2026,
        };
        const results = generateProjections(params);
        // Taxable = 12L - 75k = 11.25L => rebate zeros tax
        expect(results[0].approxTax).toBe(0);
        expect(results[0].annualInflow).toBe(1200000);
    });

    it('applies pensioner standard deduction in projections', () => {
        const params = {
            ...mockParams,
            familyMembers: [
                { relation: 'Self', age: 60, retirementAge: 65, dob: '1966-01-01', employmentType: 'Pensioner' },
            ],
            income: {
                selfDetail: {
                    netPension: '80000',
                    otherIncome: [{ amount: '' }],
                },
            },
            inflationRates: { incomeIncrement: 0, householdInflation: 0, educationInflation: 0 },
            startYear: 2026,
        };
        const results = generateProjections(params);
        expect(results[0].annualInflow).toBe(960000);
        expect(results[0].approxTax).toBe(0);
    });
});

describe('ProjectionLogic tax with cash-flow ledger', () => {
    const baseParams = {
        familyMembers: [
            { relation: 'Self', age: 35, retirementAge: 60, dob: '1991-01-01', employmentType: 'Private Sector', occupation: 'Salaried' },
            { relation: 'Spouse', age: 33, retirementAge: 60, dob: '1993-01-01', employmentType: 'Private Sector', occupation: 'Salaried' },
        ],
        income: {
            self: '',
            spouse: '150000',
            selfDetail: {
                needTaxPlanning: true,
                inHandSalary: '',
                otherIncome: [{ amount: '' }],
                taxPlanning: {
                    earnings: {
                        basicPay: '70000',
                        dearnessAllowance: '20000',
                        houseRentAllowance: '5000',
                        allowances: '5000',
                        performanceBonus: '0',
                    },
                },
            },
            spouseDetail: {
                needTaxPlanning: true,
                inHandSalary: '',
                otherIncome: [{ amount: '' }],
                taxPlanning: {
                    earnings: { basicPay: '150000' },
                    deductions: { incomeTax: '10000', employeePF: '18000' },
                },
            },
        },
        expenseCategories: {
            household: { rent: 20000 },
            insurance: { life: {} },
            emi: {},
            savings: {},
        },
        goals: [],
        inflationRates: { incomeIncrement: 10, householdInflation: 6, educationInflation: 8 },
        startYear: 2026,
        currentYearLedger: {
            income: [...Array(11).fill(0), 150000],
            household: [...Array(12).fill(20000)],
        },
    };

    it('does not shrink tax base when ledger inflow is lower than gross detail income', () => {
        const results = generateProjections(baseParams);

        expect(results[0].annualInflow).toBe(1800000);
        expect(results[0].approxTax).toBe(150800);
        expect(results[1].approxTax).toBe(235040);
    });

    it('uses detail in-hand inflow when ledger exists but is all zeros', () => {
        const results = generateProjections({
            ...baseParams,
            currentYearLedger: {
                income: Array(12).fill(0),
                household: Array(12).fill(0),
            },
        });

        expect(results[0].annualInflow).toBe(1800000);
        expect(results[0].approxTax).toBe(150800);
    });
});
