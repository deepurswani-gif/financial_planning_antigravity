import { describe, it, expect } from 'vitest';
import {
    getChildMonthlyEducationExpense,
    sumChildrenMonthlyEducation,
    isEducationInHouseholdBaseline,
    formatEducationMonthlyTotal,
    prefillChildMonthlyEducationExpense,
    applyHouseholdEducationFromChildren,
} from './educationExpenseSync';
import { applyChildOccupationFields } from './employmentTypeSync';
import { generateProjections } from '../JourneyModule/ProjectionLogic';

describe('educationExpenseSync', () => {
    it('derives school monthly from annualSchoolFee when manual entry is absent', () => {
        expect(getChildMonthlyEducationExpense({
            occupation: 'School',
            annualSchoolFee: '60000',
        })).toBe(5000);
    });

    it('derives college monthly from course cost and duration', () => {
        expect(getChildMonthlyEducationExpense({
            occupation: 'College',
            costOfCompleteCourse: '480000',
            courseDuration: '4',
        })).toBe(10000);
    });

    it('prefers manual monthlyEducationExpense over derived values', () => {
        expect(getChildMonthlyEducationExpense({
            occupation: 'School',
            annualSchoolFee: '60000',
            monthlyEducationExpense: '7000',
        })).toBe(7000);
    });

    it('prefills monthlyEducationExpense for college children', () => {
        const child = {
            relation: 'Child',
            occupation: 'College',
            costOfCompleteCourse: '240000',
            courseDuration: '4',
            monthlyEducationExpense: '',
        };
        expect(prefillChildMonthlyEducationExpense(child).monthlyEducationExpense).toBe('5000');
    });

    it('detects education in household baseline from child fees without household.education', () => {
        expect(isEducationInHouseholdBaseline([
            { relation: 'Child', monthlyEducationExpense: '5000' },
        ], {})).toBe(true);
    });

    it('applyHouseholdEducationFromChildren syncs aggregated total', () => {
        const result = applyHouseholdEducationFromChildren(
            { household: { grocery: '10000' } },
            [
                { relation: 'Child', monthlyEducationExpense: '5000' },
                { relation: 'Child', occupation: 'School', annualSchoolFee: '60000' },
            ],
        );
        expect(result.household.education).toBe('10000');
    });

    it('formatEducationMonthlyTotal returns empty string when no fees', () => {
        expect(formatEducationMonthlyTotal([{ relation: 'Child', occupation: 'School' }])).toBe('');
    });

    it('sumChildrenMonthlyEducation aggregates all children', () => {
        expect(sumChildrenMonthlyEducation([
            { relation: 'Child', monthlyEducationExpense: '3000' },
            { relation: 'Child', occupation: 'School', annualSchoolFee: '12000' },
        ])).toBe(4000);
    });
});

describe('applyChildOccupationFields fee clearing', () => {
    it('clears fee fields when switching from School to College', () => {
        const next = applyChildOccupationFields({
            standard: '5th Standard',
            annualSchoolFee: '50000',
            monthlyEducationExpense: '4167',
        }, 'College');

        expect(next.standard).toBe('');
        expect(next.annualSchoolFee).toBe('');
        expect(next.monthlyEducationExpense).toBe('');
    });

    it('clears fee fields when switching from College to School', () => {
        const next = applyChildOccupationFields({
            courseName: 'B.Tech',
            costOfCompleteCourse: '400000',
            monthlyEducationExpense: '10000',
        }, 'School');

        expect(next.courseName).toBe('');
        expect(next.costOfCompleteCourse).toBe('');
        expect(next.monthlyEducationExpense).toBe('');
    });
});

describe('ProjectionLogic education double-count prevention', () => {
    const baseParams = {
        familyMembers: [
            { relation: 'Self', age: 35, retirementAge: 60, dob: '1991-01-01' },
        ],
        income: { self: 100000 },
        goals: [],
        inflationRates: {
            incomeIncrement: 0,
            householdInflation: 0,
            educationInflation: 0,
        },
        startYear: 2026,
    };

    it('does not double-count school fees when monthlyEducationExpense set but household.education is empty', () => {
        const params = {
            ...baseParams,
            familyMembers: [
                ...baseParams.familyMembers,
                {
                    relation: 'Child',
                    occupation: 'School',
                    standard: '5th Standard',
                    annualSchoolFee: 60000,
                    monthlyEducationExpense: '5000',
                },
            ],
            expenseCategories: {
                household: { rent: 20000, education: '' },
                emi: {},
                insurance: { life: {} },
                savings: {},
            },
        };
        const results = generateProjections(params);
        // rent 20k + education 5k = 25k monthly * 12 = 300k; no extra educationExpenses
        expect(results[0].totalOutflow).toBe(300000);
        expect(results[0].educationExpenses).toBe(0);
    });

    it('does not double-count college fees when monthly spend and course metadata both exist', () => {
        const params = {
            ...baseParams,
            familyMembers: [
                ...baseParams.familyMembers,
                {
                    relation: 'Child',
                    occupation: 'College',
                    costOfCompleteCourse: '400000',
                    courseDuration: '4',
                    remainingTime: '3',
                    isFeePaid: 'NO',
                    monthlyEducationExpense: '10000',
                },
            ],
            expenseCategories: {
                household: { rent: 15000, education: '10000' },
                emi: {},
                insurance: { life: {} },
                savings: {},
            },
        };
        const results = generateProjections(params);
        // rent 15k + education 10k = 25k * 12 = 300k; college projection skipped
        expect(results[0].totalOutflow).toBe(300000);
        expect(results[0].educationExpenses).toBe(0);
    });

    it('projects college course cost when course metadata cannot derive a monthly baseline', () => {
        const params = {
            ...baseParams,
            familyMembers: [
                ...baseParams.familyMembers,
                {
                    relation: 'Child',
                    occupation: 'College',
                    costOfCompleteCourse: '400000',
                    courseDuration: '',
                    remainingTime: '3',
                    isFeePaid: 'NO',
                },
            ],
            expenseCategories: {
                household: { rent: 15000 },
                emi: {},
                insurance: { life: {} },
                savings: {},
            },
        };
        const results = generateProjections(params);
        // rent 15k * 12 = 180k + college annual 400k (duration defaults to 1)
        expect(results[0].householdOutflow).toBe(180000);
        expect(results[0].educationExpenses).toBe(400000);
        expect(results[0].totalOutflow).toBe(580000);
    });

    it('uses derived college monthly in household when course metadata is complete', () => {
        const params = {
            ...baseParams,
            familyMembers: [
                ...baseParams.familyMembers,
                {
                    relation: 'Child',
                    occupation: 'College',
                    costOfCompleteCourse: '400000',
                    courseDuration: '4',
                    remainingTime: '3',
                    isFeePaid: 'NO',
                },
            ],
            expenseCategories: {
                household: { rent: 15000 },
                emi: {},
                insurance: { life: {} },
                savings: {},
            },
        };
        const results = generateProjections(params);
        // rent 15k + derived college ~8.33k = ~23.33k * 12 ≈ 280k; projection skipped
        expect(results[0].householdOutflow).toBe(280000);
        expect(results[0].educationExpenses).toBe(0);
        expect(results[0].totalOutflow).toBe(280000);
    });

    it('skips school projection when household.education is set (regression)', () => {
        const params = {
            ...baseParams,
            familyMembers: [
                ...baseParams.familyMembers,
                {
                    relation: 'Child',
                    name: 'Junior',
                    standard: '5th standard',
                    annualSchoolFee: 50000,
                },
            ],
            expenseCategories: {
                household: { rent: 20000, education: 5000 },
                emi: { car: 10000 },
                insurance: { life: {} },
                savings: { sip: 10000 },
            },
        };
        const results = generateProjections(params);
        expect(results[0].educationExpenses).toBe(0);
        expect(results[0].totalOutflow).toBe(420000);
    });
});
