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
    isSummaryOriginGoal,
    getSummaryFlowGoals,
    getBlockedCatalogGoalIds,
    getAvailableCatalogGroups,
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

    it('migrates summary vacation goal into domestic tour slot (legacy helper)', () => {
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

    it('keeps summary goals distinct and blocks matching catalog slots', () => {
        const existing = [{
            id: 'goal_99',
            name: 'Child Education',
            templateId: 'education',
            yearsToGoal: '10',
            presentValue: '1500000',
            inflationRate: 8,
        }];

        const merged = mergeGoalsWithPredefined(familyWithChild, existing);
        const summary = merged.find((g) => g.id === 'goal_99');
        const edu = merged.find((g) => g.id === 'edu_0');

        expect(summary).toBeTruthy();
        expect(isSummaryOriginGoal(summary)).toBe(true);
        expect(isConfiguredGoal(summary)).toBe(true);
        expect(edu).toBeTruthy();
        expect(isConfiguredGoal(edu)).toBe(false);

        const blocked = getBlockedCatalogGoalIds(merged);
        expect(blocked.has('edu_0')).toBe(true);

        const groups = getAvailableCatalogGroups(
            merged.filter((g) => g.isPredefined),
            merged,
        );
        const familyGroup = groups.find((g) => g.key === 'family');
        expect(familyGroup?.goals.some((g) => g.id === 'edu_0')).toBeFalsy();
    });

    it('treats legacy migrated predefined goals as summary origin', () => {
        const existing = [{
            id: 'car',
            name: 'Buying Car',
            isPredefined: true,
            yearsToGoal: '5',
            presentValue: '800000',
            inflationRate: 6,
            summaryPresentValue: '800000',
            summaryYearsToGoal: '5',
        }];

        const merged = mergeGoalsWithPredefined([], existing);
        const car = merged.find((g) => g.id === 'car');
        expect(isSummaryOriginGoal(car)).toBe(true);
        expect(getSummaryFlowGoals(merged).map((g) => g.id)).toContain('car');
        expect(getBlockedCatalogGoalIds(merged).has('car')).toBe(true);
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
