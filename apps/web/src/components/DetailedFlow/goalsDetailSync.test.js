import { describe, it, expect } from 'vitest';
import {
    isConfiguredGoal,
    detectSummaryBundledGoal,
    migrateSummaryGoalIntoCatalog,
    mergeGoalsWithPredefined,
    enrichEducationGoalFromFamily,
    hasEducationFamilyDetails,
    reconcileGoalAmounts,
    goalHasAmountMismatch,
} from './goalsDetailSync';

const familyWithChild = [
    { relation: 'Self', dob: '1985-01-01', retirementAge: 60 },
    {
        relation: 'Child',
        name: 'Rahul',
        occupation: 'School',
        courseName: 'B.Tech',
        courseDuration: '4',
        remainingTime: '8',
        costOfCompleteCourse: '2000000',
    },
];

describe('goalsDetailSync', () => {
    it('detects summary bundled goals by name', () => {
        expect(detectSummaryBundledGoal({ name: 'Child Education' })).toBe('education');
        expect(detectSummaryBundledGoal({ name: 'Vacation' })).toBe('vacation');
        expect(detectSummaryBundledGoal({ name: 'Buying a Home' })).toBe('home');
    });

    it('migrates summary vacation goal into domestic tour slot', () => {
        const predefined = [
            { id: 'domestic_tour', name: 'Domestic Tour', isPredefined: true },
            { id: 'foreign_tour', name: 'Foreign Tour', isPredefined: true },
        ];
        const summaryGoal = {
            id: 'goal_1',
            name: 'Vacation',
            yearsToGoal: '3',
            presentValue: '150000',
            inflationRate: 6,
        };

        const result = migrateSummaryGoalIntoCatalog(summaryGoal, predefined, []);
        const domestic = result.find((g) => g.id === 'domestic_tour');
        expect(domestic.yearsToGoal).toBe('3');
        expect(domestic.presentValue).toBe('150000');
        expect(domestic.summaryPresentValue).toBe('150000');
        expect(domestic.summaryYearsToGoal).toBe('3');
    });

    it('merges predefined goals and migrates summary education goal', () => {
        const existing = [{
            id: 'goal_99',
            name: 'Child Education',
            yearsToGoal: '10',
            presentValue: '1500000',
            inflationRate: 8,
        }];

        const merged = mergeGoalsWithPredefined(familyWithChild, existing);
        const edu = merged.find((g) => g.id === 'edu_0');
        expect(edu).toBeTruthy();
        expect(edu.name).toContain('Rahul');
        expect(isConfiguredGoal(edu)).toBe(true);
        expect(edu.presentValue).toBe('1500000');
        expect(edu.yearsToGoal).toBe('10');
        expect(edu.summaryPresentValue).toBe('1500000');
    });

    it('reconcileGoalAmounts flags present value mismatch', () => {
        const goal = {
            summaryPresentValue: '500000',
            presentValue: '400000',
            summaryYearsToGoal: '5',
            yearsToGoal: '5',
        };
        expect(goalHasAmountMismatch(goal)).toBe(true);
        expect(reconcileGoalAmounts(goal).presentValue.status).toBe('under');
    });

    it('enriches education goal from family child details', () => {
        const goal = { id: 'edu_0', name: 'Higher Education - Rahul', isPredefined: true };
        const enriched = enrichEducationGoalFromFamily(goal, familyWithChild);
        expect(enriched.presentValue).toBe('2000000');
        expect(enriched.courseDuration).toBe('4');
        expect(enriched.profession).toBe('B.Tech');
    });

    it('reports when education details come from family profile', () => {
        const goal = { id: 'edu_0', name: 'Higher Education - Rahul' };
        expect(hasEducationFamilyDetails(goal, familyWithChild)).toBe(true);
    });
});
