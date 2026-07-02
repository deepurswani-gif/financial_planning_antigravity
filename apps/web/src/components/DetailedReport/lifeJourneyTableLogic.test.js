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
