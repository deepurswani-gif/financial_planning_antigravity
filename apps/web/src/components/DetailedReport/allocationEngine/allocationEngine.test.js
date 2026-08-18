import { describe, it, expect } from 'vitest';
import { determineLifeStage, LIFE_STAGE_IDS } from './lifeStageEngine';
import { applyHardWaterfall } from './hardWaterfall';
import { mapVehiclesForObjective, OBJECTIVE_TYPES, classifyGoalObjective } from './objectiveVehicleMap';
import { runLifeJourneyAllocationEngine } from './runLifeJourneyAllocationEngine';
import { runProtectionEngine } from './protectionEngine';
import { selectGoalsToFund } from './goalPriorityEngine';
import { buildGoalFundingPlan } from './goalFundingEngine';
import {
    estimateTermAnnualPremium,
    interpolateCoverPremium,
    getHealthMonthlyPremium,
    ALLOCATION_POLICY,
} from './config';

describe('lifeStageEngine', () => {
    it('gives different stages for same age with different family context', () => {
        const single = determineLifeStage({
            age: 35,
            retirementAge: 60,
            familyMembers: [{ relation: 'Self', age: 35, retirementAge: 60 }],
        });
        const family = determineLifeStage({
            age: 35,
            retirementAge: 60,
            familyMembers: [
                { relation: 'Self', age: 35, retirementAge: 60 },
                { relation: 'Spouse', age: 33 },
                { relation: 'Child', age: 5 },
                { relation: 'Child', age: 3 },
            ],
        });
        expect(single.lifeStageId).not.toBe(family.lifeStageId);
        expect(family.lifeStageId).toBe(LIFE_STAGE_IDS.GROWING_FAMILY);
    });
});

describe('premium masters', () => {
    it('estimates term premium via interpolation', () => {
        const quote = estimateTermAnnualPremium(30, 8_000_000);
        expect(quote.annualPremium).toBeGreaterThan(10000);
        expect(quote.annualPremium).toBeLessThan(14100);
    });

    it('extrapolates term premium above ₹1Cr', () => {
        const at1Cr = estimateTermAnnualPremium(35, 10_000_000);
        const at2Cr = estimateTermAnnualPremium(35, 20_000_000);
        expect(at2Cr.annualPremium).toBeGreaterThan(at1Cr.annualPremium);
    });

    it('supports generic multi-slab interpolation', () => {
        const premium = interpolateCoverPremium(15_000_000, [
            [5_000_000, 10000],
            [10_000_000, 20000],
            [20_000_000, 35000],
        ]);
        expect(premium).toBe(27500);
    });

    it('returns age-band health monthly premium', () => {
        expect(getHealthMonthlyPremium(32)).toBe(Math.round(19000 / 12));
    });
});

describe('protection policy', () => {
    it('caps term allocation at premium even when % of surplus is higher', () => {
        const result = runProtectionEngine({
            familyMembers: [{ relation: 'Self', dob: '1990-01-01', retirementAge: 60 }],
            expenseCategories: { summaryHouseholdTotal: '50000' },
            summaryLifeCover: '0',
            summaryHealthCover: '0',
            hasHealthInsurance: false,
            assetCategories: { cash: { savings: 0 } },
            contingencyFund: '0',
            deployableSurplus: 100000,
            income: { self: 1200000 }
        });
        // 20% of 100000 = 20000, but premium is much smaller
        expect(result.term.requiredPremium).toBeGreaterThan(0);
        expect(result.term.monthlyAllocation).toBe(result.term.requiredPremium);
        expect(result.term.monthlyAllocation).toBeLessThan(20000);
        expect(result.residualSurplus).toBeGreaterThan(0);
    });

    it('sends 100% to goals when hygiene is complete', () => {
        const result = runProtectionEngine({
            familyMembers: [{ relation: 'Self', age: 35, retirementAge: 60 }],
            expenseCategories: { summaryHouseholdTotal: '10000' },
            summaryLifeCover: '50000000',
            summaryHealthCover: '2000000',
            hasHealthInsurance: true,
            assetCategories: { cash: { savings: '5000000' } },
            contingencyFund: '5000000',
            deployableSurplus: 20000,
        });
        expect(result.protectionApplied).toBe(false);
        expect(result.residualSurplus).toBe(20000);
        expect(result.monthlyTotal).toBe(0);
    });

    it('uses configurable policy shares', () => {
        expect(ALLOCATION_POLICY.protectionShareOfSurplus).toBe(0.5);
        expect(
            ALLOCATION_POLICY.termShareOfSurplus
            + ALLOCATION_POLICY.healthShareOfSurplus
            + ALLOCATION_POLICY.emergencyShareOfSurplus,
        ).toBeCloseTo(0.5);
    });
});

describe('goalHorizonMatrix mapping', () => {
    it('maps 0–1 year to Liquid Mutual Fund', () => {
        expect(mapVehiclesForObjective(OBJECTIVE_TYPES.CHILD_EDUCATION, 0.5))
            .toEqual(['Liquid Mutual Fund']);
    });

    it('maps 7+ years to SIP + Equity', () => {
        const vehicles = mapVehiclesForObjective(OBJECTIVE_TYPES.HOME, 8);
        expect(vehicles).toContain('SIP');
        expect(vehicles).toContain('Direct Equity & ETFs');
        expect(vehicles).not.toContain('Gold');
    });

    it('classifies business goals', () => {
        expect(classifyGoalObjective({ id: 'biz', name: 'Start Business' }))
            .toBe(OBJECTIVE_TYPES.BUSINESS);
    });
});

describe('goal priority', () => {
    it('funds only the nearest high-priority goal by default', () => {
        const { selected } = selectGoalsToFund([
            {
                id: 'far',
                type: 'retirement',
                label: 'Retirement',
                yearsLeft: 25,
                priority: 90,
                monthlyFundingDeficit: 20000,
                existingMonthlyContribution: 1000,
            },
            {
                id: 'near',
                type: 'child_education',
                label: 'Education',
                yearsLeft: 4,
                priority: 70,
                monthlyFundingDeficit: 15000,
                existingMonthlyContribution: 2000,
            },
        ], 12000);

        expect(selected).toHaveLength(1);
        expect(selected[0].id).toBe('near');
    });

    it('can fund two goals when surplus is large', () => {
        const { selected } = selectGoalsToFund([
            {
                id: 'a',
                type: 'child_education',
                label: 'Education',
                yearsLeft: 3,
                priority: 80,
                monthlyFundingDeficit: 8000,
                existingMonthlyContribution: 0,
            },
            {
                id: 'b',
                type: 'home',
                label: 'Home',
                yearsLeft: 6,
                priority: 70,
                monthlyFundingDeficit: 10000,
                existingMonthlyContribution: 0,
            },
        ], 40000);

        expect(selected).toHaveLength(2);
        expect(selected[0].id).toBe('a');
        expect(selected[1].id).toBe('b');
    });

    it('deprioritizes retirement when contribution is already adequate', () => {
        const { selected } = selectGoalsToFund([
            {
                id: 'ret',
                type: 'retirement',
                label: 'Retirement',
                yearsLeft: 20,
                priority: 95,
                monthlyFundingDeficit: 1000,
                existingMonthlyContribution: 8000,
            },
            {
                id: 'edu',
                type: 'child_education',
                label: 'Education',
                yearsLeft: 5,
                priority: 60,
                monthlyFundingDeficit: 12000,
                existingMonthlyContribution: 0,
            },
        ], 15000);

        expect(selected[0].id).toBe('edu');
    });
});

describe('hardWaterfall adapter', () => {
    it('delegates to protection policy engine', () => {
        const result = applyHardWaterfall(30000, {
            meta: {},
            familyMembers: [{ relation: 'Self', age: 35, retirementAge: 60 }],
            expenseCategories: { summaryHouseholdTotal: '20000' },
        }, {
            familyMembers: [{ relation: 'Self', age: 35, retirementAge: 60 }],
            expenseCategories: { summaryHouseholdTotal: '20000' },
            summaryLifeCover: '0',
            summaryHealthCover: '0',
            hasHealthInsurance: false,
            assetCategories: { cash: { savings: 0 } },
            contingencyFund: '0',
        });
        expect(result.mandatoryTotal).toBeGreaterThanOrEqual(0);
        expect(result.residualSurplus).toBe(30000 - result.mandatoryTotal);
        expect(result.mandatoryAllocations.PPF || 0).toBe(0);
    });
});

describe('goalFundingEngine', () => {
    it('computes monthly funding deficit', () => {
        const plan = buildGoalFundingPlan({
            goals: [{
                id: 'edu_0',
                name: 'Higher Education - Aanya',
                presentValue: 1500000,
                yearsToGoal: 8,
                inflationRate: 8,
            }],
            existingMonthly: { SIP: 2000, PPF: 0, NPS: 0, total: 2000 },
            expenseCategories: { savings: { sip: 2000 } },
        });
        expect(plan.fundedGoals.length).toBe(1);
        expect(plan.fundedGoals[0].monthlyFundingDeficit).toBeGreaterThanOrEqual(0);
    });
});

describe('runLifeJourneyAllocationEngine', () => {
    it('runs protection-then-goals rule engine without Gold/FPI/explanations', () => {
        const result = runLifeJourneyAllocationEngine({
            deployableSurplus: 40000,
            familyMembers: [
                { relation: 'Self', dob: '1988-01-01', retirementAge: 60, name: 'Raj' },
                { relation: 'Spouse', age: 35 },
                { relation: 'Child', age: 7, name: 'Aanya' },
            ],
            expenseCategories: {
                summaryHouseholdTotal: '20000',
                household: { grocery: { value: 20000, frequency: 'Monthly' } },
                savings: { sip: 5000, ppf: 0, nps: 0 },
            },
            assetCategories: { cash: { savings: 50000 } },
            contingencyFund: '50000',
            summaryLifeCover: '1000000',
            summaryHealthCover: '0',
            hasHealthInsurance: false,
            goals: [
                {
                    id: 'edu_0',
                    name: 'Higher Education - Aanya',
                    presentValue: 1500000,
                    yearsToGoal: 8,
                    inflationRate: 8,
                },
                {
                    id: 'retirement',
                    name: 'Retirement Corpus',
                    presentValue: 20000000,
                    yearsToGoal: 25,
                    inflationRate: 6,
                },
            ],
        });

        expect(result.draftAllocations.Gold || 0).toBe(0);
        expect(result.explanations).toEqual([]);
        expect(result.diagnostics.sequence[0]).toBe('protection_policy');
        expect(result.selectedGoals.length).toBeGreaterThanOrEqual(0);
        expect(result.selectedGoals.length).toBeLessThanOrEqual(2);
        const total = Object.values(result.draftAllocations).reduce((s, v) => s + v, 0);
        expect(total).toBeLessThanOrEqual(40000);
        expect(result.bundles[0].id).toBe('life_journey');
        expect(result.policy.protectionShareOfSurplus).toBe(0.5);
    });
});
