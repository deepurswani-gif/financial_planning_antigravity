import { describe, it, expect } from 'vitest';
import {
    buildLifeJourneyReport,
    computeLifeJourneyInsights,
    getGoalTargetYear,
    mapGoalsByYear,
} from './lifeJourneyTableLogic';

const CURRENT_YEAR = new Date().getFullYear();

const selfMember = {
    relation: 'Self',
    dob: `${CURRENT_YEAR - 40}-06-15`,
    retirementAge: 60,
};

const makeProjection = (year, netInvestibleSurplus = 100000) => ({
    year,
    annualInflow: 1200000,
    approxTax: 0,
    netInflowAfterTax: 1200000,
    totalOutflow: 900000,
    surplusBeforeSaving: 300000,
    savingsAndInvestments: 200000,
    netInvestibleSurplus,
    yearHasDeficit: netInvestibleSurplus < 0,
});

describe('lifeJourneyTableLogic', () => {
    it('maps goal target years from yearsToGoal', () => {
        expect(getGoalTargetYear({ yearsToGoal: '5' }, CURRENT_YEAR)).toBe(CURRENT_YEAR + 5);
        expect(getGoalTargetYear({ yearsToGoal: '' }, CURRENT_YEAR)).toBeNull();
    });

    it('groups goals by target year', () => {
        const byYear = mapGoalsByYear([
            { id: 'car', name: 'Car', yearsToGoal: '3', presentValue: 500000, inflationRate: 6 },
            { id: 'home', name: 'Home', yearsToGoal: '8', presentValue: 2000000, inflationRate: 6 },
        ]);
        expect(byYear[CURRENT_YEAR + 3]).toHaveLength(1);
        expect(byYear[CURRENT_YEAR + 3][0].name).toBe('Car');
        expect(byYear[CURRENT_YEAR + 8][0].name).toBe('Home');
    });

    it('includes only configured goals and extends constellation to latest goal year', () => {
        const userGoals = [
            { id: 'flat', name: 'Buying a Flat', yearsToGoal: '4', presentValue: 5000000, inflationRate: 6 },
            { id: 'marriage_0', name: 'Marriage - Jay', yearsToGoal: '3', presentValue: 4000000, inflationRate: 6 },
            { id: 'car', name: 'Buying Car', yearsToGoal: '2', presentValue: 800000, inflationRate: 6 },
            { id: 'domestic_tour', name: 'Domestic Tour', yearsToGoal: '2', presentValue: 150000, inflationRate: 6 },
            { id: 'retirement', name: 'Retirement Corpus', yearsToGoal: '31', presentValue: 20000000, inflationRate: 6 },
            // Incomplete / auto-year-only — must not appear
            { id: 'bike', name: 'Buying Bike', yearsToGoal: '5', presentValue: '', inflationRate: 6 },
        ];
        const projections = Array.from({ length: 20 }, (_, i) => makeProjection(CURRENT_YEAR + 1 + i));
        const report = buildLifeJourneyReport({
            familyMembers: [selfMember],
            journeyProjections: projections,
            goals: userGoals,
        });

        const names = Object.values(report.goalsByYear).flat().map((g) => g.name);
        expect(names).toEqual(expect.arrayContaining([
            'Buying a Flat',
            'Marriage - Jay',
            'Buying Car',
            'Domestic Tour',
            'Retirement Corpus',
        ]));
        expect(names).not.toContain('Buying Bike');
        expect(report.goalsByYear[CURRENT_YEAR + 2]).toHaveLength(2);
        expect(report.meta.constellationEndYear).toBe(CURRENT_YEAR + 31);
    });

    it('excludes current year from life journey projections', () => {
        const projections = [
            makeProjection(CURRENT_YEAR),
            makeProjection(CURRENT_YEAR + 1),
            makeProjection(CURRENT_YEAR + 2),
            makeProjection(CURRENT_YEAR + 20),
        ];
        const report = buildLifeJourneyReport({
            familyMembers: [selfMember],
            journeyProjections: projections,
            goals: [],
            inflationRates: { incomeIncrement: 10, householdInflation: 6, educationInflation: 8 },
        });

        expect(report.meta.hasProfile).toBe(true);
        expect(report.hero.currentAge).toBe(40);
        expect(report.hero.yearsToGoldenPeriod).toBe(20);
        expect(report.years).not.toContain(CURRENT_YEAR);
        expect(report.years[0]).toBe(CURRENT_YEAR + 1);
        expect(report.years).toContain(CURRENT_YEAR + 20);
        expect(report.years).not.toContain(CURRENT_YEAR + 21);
    });

    it('returns no profile state when self dob is missing', () => {
        const report = buildLifeJourneyReport({
            familyMembers: [{ relation: 'Self', retirementAge: 60 }],
            journeyProjections: [],
            goals: [],
        });
        expect(report.meta.hasProfile).toBe(false);
        expect(report.projections).toEqual([]);
    });

    it('generates life journey insights including deficit warning', () => {
        const projections = [
            makeProjection(CURRENT_YEAR + 1, 50000),
            makeProjection(CURRENT_YEAR + 2, -10000),
        ];
        const report = buildLifeJourneyReport({
            familyMembers: [selfMember],
            journeyProjections: projections,
            goals: [{ id: 'car', name: 'Car', yearsToGoal: '2', presentValue: 500000, inflationRate: 6 }],
            inflationRates: { incomeIncrement: 10, householdInflation: 6, educationInflation: 8 },
        });
        const insights = computeLifeJourneyInsights(report);
        expect(insights.some((i) => i.id === 'golden-period')).toBe(true);
        expect(insights.some((i) => i.id === 'deficit-years')).toBe(true);
        expect(insights.some((i) => i.id === 'near-term-goals')).toBe(true);
        expect(insights.some((i) => i.id === 'growth-assumptions')).toBe(true);
    });
});
