import { describe, it, expect } from 'vitest';
import {
    computeRequiredMonthlySIP,
    buildDreamsHeadline,
    buildIncomeJourney,
    buildCashFlowSnapshot,
    enrichGoal,
    projectFutureSurplusFV,
    buildFutureSelfReport,
    getValidGoals
} from './FutureSelfLogic';

describe('FutureSelfLogic', () => {
    it('computes required monthly SIP for 9.5L in 3 years at 12%', () => {
        const sip = computeRequiredMonthlySIP(950000, 12, 3);
        expect(sip).toBeGreaterThan(21500);
        expect(sip).toBeLessThan(22500);
    });

    it('builds dreams headline with goal names as-is', () => {
        const headline = buildDreamsHeadline([
            enrichGoal({ name: 'My Dream Villa', presentValue: 5000000, yearsToGoal: 15, inflationRate: 6 }, 2026),
            enrichGoal({ name: 'Car Purchase', presentValue: 800000, yearsToGoal: 3, inflationRate: 6 }, 2026)
        ]);
        expect(headline).toContain('Car Purchase in 2029.');
        expect(headline).toContain('My Dream Villa in 2041.');
    });

    it('builds 5-year income ladder at 10% growth', () => {
        const snapshot = buildCashFlowSnapshot(
            { totalIncome: 100000, categorySums: { household: 50000, emi: 15000, insurance: 5000 }, totalSavings: 5000 },
            { savings: { sip: 20000 } }
        );
        const journey = buildIncomeJourney(snapshot, { incomeIncrement: 10, householdInflation: 6 }, 2026);
        expect(journey.points).toHaveLength(6);
        expect(journey.points[0].monthlyIncome).toBe(100000);
        expect(journey.points[1].monthlyIncome).toBe(110000);
        expect(journey.points[5].monthlyIncome).toBe(161051);
    });

    it('splits goals into near and long term', () => {
        const report = buildFutureSelfReport({
            goals: [
                { name: 'Car', presentValue: 800000, yearsToGoal: 3, inflationRate: 6 },
                { name: 'Retirement', presentValue: 10000000, yearsToGoal: 16, inflationRate: 6 }
            ],
            cashFlowResults: {
                totalIncome: 100000,
                categorySums: { household: 40000, emi: 10000, insurance: 5000 },
                totalSavings: 10000
            },
            expenseCategories: { savings: { sip: 15000 } },
            inflationRates: { incomeIncrement: 10, householdInflation: 6 }
        });
        expect(report.nearTermGoals).toHaveLength(1);
        expect(report.longTermGoals).toHaveLength(1);
        expect(report.nearTermGoals[0].name).toBe('Car');
    });

    it('marks goal achievable when projected exceeds future cost', () => {
        const readiness = buildFutureSelfReport({
            goals: [{ name: 'Small', presentValue: 10000, yearsToGoal: 10, inflationRate: 6 }],
            cashFlowResults: {
                totalIncome: 500000,
                categorySums: { household: 20000, emi: 0, insurance: 0 },
                totalSavings: 50000
            },
            expenseCategories: { savings: { sip: 100000 } },
            inflationRates: { incomeIncrement: 10, householdInflation: 6 }
        }).nearTermGoals;
        expect(readiness.length).toBe(0);
    });

    it('filters valid goals', () => {
        expect(getValidGoals([
            { presentValue: 100, yearsToGoal: 5 },
            { presentValue: 0, yearsToGoal: 5 },
            { presentValue: 100, yearsToGoal: 0 }
        ])).toHaveLength(1);
    });

    it('projects future surplus FV with positive balance', () => {
        const fv = projectFutureSurplusFV({
            monthlyIncome: 100000,
            householdMonthly: 40000,
            fixedOutflow: 25000,
            yearsToGoal: 3,
            incomeGrowthPct: 10,
            householdInflationPct: 6
        });
        expect(fv).toBeGreaterThan(0);
    });
});
