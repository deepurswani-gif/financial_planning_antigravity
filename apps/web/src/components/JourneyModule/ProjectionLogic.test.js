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
        // household (20k rent + 5k education) * 12 = 300k, emi 10k*12 = 120k. School fee not double-counted.
        expect(results[0].totalOutflow).toBe(420000);
    });

    it('does not double-count studio term when linked policy carries the premium', () => {
        const params = {
            ...mockParams,
            expenseCategories: { ...mockParams.expenseCategories, insurance: { life: {} } },
            investmentAllocations: [
                {
                    id: 101,
                    type: 'Term Insurance',
                    amount: 60000, // Studio stores annual (₹5,000/mo × 12)
                    startMonth: 1,
                    startYear: 2026,
                    duration: 10,
                    frequency: 'Monthly',
                    studioPlanKey: '2026-0',
                },
            ],
            policies: [
                {
                    id: 'p-term',
                    sourceAllocationId: 101,
                    planType: 'Term Insurance',
                    premium: '5000',
                    frequency: 'Monthly',
                    paymentTerm: '15',
                    startDate: '2026-01-01',
                    isProposed: false,
                },
            ],
        };
        const results = generateProjections(params);
        // Policy only: 5000 * 12 = 60k (studio row skipped via exclusivity)
        expect(results[0].insurancePremium).toBe(60000);
        expect(results[0].unallocatedSurplus).toBe(
            generateProjections({
                ...params,
                investmentAllocations: [],
            })[0].unallocatedSurplus,
        );
    });

    it('does not double-count studio life when linked policy carries the premium', () => {
        const params = {
            ...mockParams,
            expenseCategories: { ...mockParams.expenseCategories, insurance: { life: {} } },
            investmentAllocations: [
                {
                    id: 202,
                    type: 'Life Insurance',
                    amount: 3000,
                    startMonth: 1,
                    startYear: 2026,
                    duration: 10,
                    frequency: 'Monthly',
                    insuredMember: 'Self',
                },
            ],
            policies: [
                {
                    id: 'p-life',
                    sourceAllocationId: 202,
                    planType: 'Saving Plan',
                    insuredName: 'Self',
                    premium: '3000',
                    frequency: 'Monthly',
                    paymentTerm: '12',
                    startDate: '2026-01-01',
                    isProposed: true,
                },
            ],
        };
        const results = generateProjections(params);
        expect(results[0].insurancePremium).toBe(36000);
    });

    it('keeps studio term in surplus when linked policy has no premium details yet', () => {
        const params = {
            ...mockParams,
            expenseCategories: { ...mockParams.expenseCategories, insurance: { life: {} } },
            investmentAllocations: [
                {
                    id: 101,
                    type: 'Term Insurance',
                    amount: 60000, // annual storage
                    startMonth: 1,
                    startYear: 2026,
                    duration: 10,
                    frequency: 'Monthly',
                    studioPlanKey: '2026-0',
                },
            ],
            policies: [
                {
                    id: 'p-term',
                    sourceAllocationId: 101,
                    planType: 'Term Insurance',
                    premium: '',
                    paymentTerm: '',
                    startDate: '',
                },
            ],
        };
        const results = generateProjections(params);
        expect(results[0].insurancePremium).toBe(60000);
    });

    it('uses written-back payment term on policy for later projection years', () => {
        const params = {
            ...mockParams,
            expenseCategories: { ...mockParams.expenseCategories, insurance: { life: {} } },
            inflationRates: { incomeIncrement: 0, householdInflation: 0, educationInflation: 0 },
            investmentAllocations: [
                {
                    id: 101,
                    type: 'Term Insurance',
                    amount: 60000,
                    startMonth: 1,
                    startYear: 2026,
                    duration: 15,
                    frequency: 'Monthly',
                    studioPlanKey: '2026-0',
                },
            ],
            policies: [
                {
                    id: 'p-term',
                    sourceAllocationId: 101,
                    planType: 'Term Insurance',
                    premium: '5000',
                    frequency: 'Monthly',
                    paymentTerm: '15',
                    startDate: '2026-01-01',
                },
            ],
        };
        const results = generateProjections(params);
        const year2035 = results.find((p) => p.year === 2035);
        const year2040 = results.find((p) => p.year === 2040);
        const year2041 = results.find((p) => p.year === 2041);
        // paymentTerm 15 from 2026 → active while year < 2026+15 (2041)
        expect(year2035.insurancePremium).toBe(60000);
        expect(year2040.insurancePremium).toBe(60000);
        expect(year2041.insurancePremium).toBe(0);
    });

    it('treats studio Term/Health amounts as annual and prorates from July (no double-count)', () => {
        // Reproduces: CF life ₹174k + non-life ₹6k + Self policy ₹32k offset
        // + Studio Term ₹1,500/mo and Health ₹1,000/mo from July (stored annual).
        const params = {
            familyMembers: [
                { relation: 'Self', name: 'Self', age: 35, retirementAge: 60, dob: '1991-01-01' },
                { relation: 'Spouse', name: 'Spouse', age: 33 },
                { relation: 'Child', name: 'Child', age: 8 },
            ],
            income: { self: 100000 },
            expenseCategories: {
                household: { rent: 60000 },
                insurance: {
                    health: { value: 500, frequency: 'Monthly' },
                    life: {
                        Self: { value: 32000, frequency: 'Annual' },
                        Spouse: { value: 100000, frequency: 'Annual' },
                        Child: { value: 42000, frequency: 'Annual' },
                    },
                },
                emi: {},
                savings: { sip: 12000 },
            },
            goals: [],
            inflationRates: { incomeIncrement: 0, householdInflation: 0, educationInflation: 0 },
            startYear: 2026,
            policies: [
                {
                    id: 'p-self',
                    insuredName: 'Self',
                    premium: '32000',
                    frequency: 'Annually',
                    paymentTerm: '12',
                    startDate: '2022-03-12',
                    isProposed: false,
                },
            ],
            investmentAllocations: [
                {
                    id: 1,
                    type: 'Term Insurance',
                    amount: 18000, // ₹1,500/mo × 12 (studio annual storage)
                    startMonth: 7,
                    startYear: 2026,
                    duration: 10,
                    frequency: 'Monthly',
                    studioPlanKey: '2026-6',
                },
                {
                    id: 2,
                    type: 'Health Insurance',
                    amount: 12000, // ₹1,000/mo × 12
                    startMonth: 7,
                    startYear: 2026,
                    duration: 10,
                    frequency: 'Monthly',
                    studioPlanKey: '2026-6',
                },
            ],
        };
        const results = generateProjections(params);
        // Non-life 6k + Self policy 32k + unallocated CF life (174k-32k)=142k
        // + Term Jul–Dec 9k + Health Jul–Dec 6k = 195k
        expect(results[0].insurancePremium).toBe(195000);
        expect(results[0].savingsBreakdown.sip).toBe(144000);
        expect(results[0].savingsAndInvestments).toBe(339000);
        // Without studio, insurance would be 180k → investments 324k
        const withoutStudio = generateProjections({ ...params, investmentAllocations: [] });
        expect(withoutStudio[0].insurancePremium).toBe(180000);
        expect(withoutStudio[0].savingsAndInvestments).toBe(324000);
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
        // Current calendar year: no tax adjustment on in-hand inflow
        expect(results[0].computedTax).toBe(0);
        expect(results[0].approxTax).toBe(0);
        expect(results[0].netInflowAfterTax).toBe(1200000);
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
        expect(results[0].computedTax).toBe(0);
        expect(results[0].approxTax).toBe(0);
        expect(results[0].netInflowAfterTax).toBe(960000);
    });

    it('accepts planStartMonth for year-1 cumulative deficit window', () => {
        const params = {
            ...mockParams,
            planStartMonth: 3,
            investmentAllocations: [{
                type: 'Lumpsum',
                amount: 500000,
                startMonth: 4,
                startYear: 2026,
                duration: 1,
            }],
        };
        const results = generateProjections(params);
        expect(results[0].year).toBe(2026);
        expect(typeof results[0].yearHasDeficit).toBe('boolean');
        expect(results[0].yearAllocationsTotal).toBe(500000);
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

    it('uses in-hand inflow and defers tax adjustment to future projection years', () => {
        const results = generateProjections(baseParams);

        // Ledger anchor ₹1.5L/mo; detail in-hand self ₹1L + spouse ₹1.22L (₹1.5L − PF − TDS)
        expect(results[0].annualInflow).toBe(1800000);
        expect(results[0].computedTax).toBe(150800);
        expect(results[0].tdsWithheld).toBe(120000);
        expect(results[0].taxReconciliation).toBe(30800);
        // Current year: no adjustment applied (ledger-aligned)
        expect(results[0].approxTax).toBe(0);
        expect(results[0].netInflowAfterTax).toBe(1800000);

        expect(results[1].computedTax).toBe(235040);
        expect(results[1].tdsWithheld).toBe(132000);
        expect(results[1].taxReconciliation).toBe(103040);
        expect(results[1].approxTax).toBe(103040);
        expect(results[1].netInflowAfterTax).toBeCloseTo(1876960, 0);
    });

    it('uses detail in-hand inflow when ledger exists but is all zeros', () => {
        const results = generateProjections({
            ...baseParams,
            currentYearLedger: {
                income: Array(12).fill(0),
                household: Array(12).fill(0),
            },
        });

        // Self ₹1L + spouse ₹1.22L in-hand × 12
        expect(results[0].annualInflow).toBe(2664000);
        expect(results[0].computedTax).toBe(150800);
        expect(results[0].approxTax).toBe(0);
    });

    it('derives in-hand from salary slip before projecting surplus', () => {
        const results = generateProjections({
            ...baseParams,
            currentYearLedger: undefined,
        });

        // Self ₹1L + spouse ₹1.22L in-hand (not ₹1.5L gross) × 12
        expect(results[0].annualInflow).toBe(2664000);
        expect(results[0].annualInflow).not.toBe(3000000);
    });
});
