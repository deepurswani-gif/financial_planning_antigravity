import { describe, it, expect } from 'vitest';
import {
    FUTURE_SURPLUS_AVENUE_ID,
    RESIDUAL_POOL_RATE,
    SCENARIO_WEALTH,
    avenueLabel,
    buildApplyPayload,
    buildPlannedMonthsNotice,
    buildResidualBreakdownForGoal,
    buildResidualContributions,
    buildTrackSurplusAllocationReport,
    clampAvenueAmount,
    derivePlannedMonths,
    getGoalFutureValue,
    getGoalTargetYear,
    isRetirementGoal,
    labelForPlanKey,
    mergeGoalMapping,
    runFundingPass,
    scenarioLabel,
    simulateResidualPool,
    sortGoalsNearestFirst,
} from './trackSurplusAllocationLogic';

const AS_OF_YEAR = new Date().getFullYear();

const baseScheduleInputs = (overrides = {}) => ({
    expenseCategories: { savings: { sip: 0 } },
    assetCategories: { investments: {}, retirement: {} },
    calculatorInputs: {
        sip: { rate: 12 },
        equity: { rate: 15 },
        lumpsum: { amount: 0, rate: 12 },
        ppf: { rate: 7.1 },
        nps: { rate: 10 },
        fd: { rate: 7, frequency: 'Quarterly' },
        rd: { rate: 7 },
    },
    investmentAllocations: [],
    familyMembers: [],
    policies: [],
    asOfMonth: 1,
    tenureYears: 20,
    ...overrides,
});

const reportInputs = (overrides = {}) => ({
    asOfDate: new Date(AS_OF_YEAR, 6, 15),
    goals: [],
    expenseCategories: { savings: { sip: 0 } },
    assetCategories: { investments: {}, retirement: {} },
    calculatorInputs: {
        sip: { rate: 12 },
        equity: { rate: 15 },
        lumpsum: { amount: 0, rate: 12 },
        ppf: { rate: 7.1 },
        nps: { rate: 10 },
        fd: { rate: 7, frequency: 'Quarterly' },
        rd: { rate: 7 },
    },
    investmentAllocations: [],
    familyMembers: [],
    policies: [],
    journeyProjections: [],
    monthlyUnallocatedSurplus: Array(12).fill(0),
    planStartMonth: 0,
    ...overrides,
});

describe('planning window helpers', () => {
    it('derives planned months from studioPlanKey in chronological order', () => {
        const months = derivePlannedMonths([
            { studioPlanKey: '2026-7', type: 'SIP', amount: 12000 },
            { studioPlanKey: '2026-6', type: 'Lumpsum', amount: 50000 },
            { studioPlanKey: '2026-6', type: 'SIP', amount: 6000 },
            { startYear: 2026, startMonth: 9, type: 'Fixed Deposit', amount: 100000 },
        ]);

        expect(months.map((m) => m.key)).toEqual(['2026-6', '2026-7', '2026-8']);
        expect(months[0].label).toBe('July 2026');
        expect(months[2].label).toBe('September 2026');
    });

    it('builds inclusion notice for one, two, and many months', () => {
        expect(buildPlannedMonthsNotice([])).toContain('Complete Put Your Money to Work');
        expect(buildPlannedMonthsNotice([{ monthLabel: 'July' }]))
            .toBe('Outcomes of this report include your planning for the month of July.');
        expect(buildPlannedMonthsNotice([{ monthLabel: 'July' }, { monthLabel: 'August' }]))
            .toBe('Outcomes of this report include your planning for the months of July and August.');
        expect(buildPlannedMonthsNotice([
            { monthLabel: 'July' },
            { monthLabel: 'August' },
            { monthLabel: 'September' },
        ])).toBe(
            'Outcomes of this report include your planning for the months of July, August, and September.',
        );
    });

    it('labels plan keys with month names', () => {
        expect(labelForPlanKey('2026-6')).toBe('July 2026');
        expect(labelForPlanKey('2026-9')).toBe('October 2026');
    });
});

describe('goal helpers', () => {
    it('detects retirement goals and computes target year / future value', () => {
        expect(isRetirementGoal({ id: 'retirement', name: 'Retirement Corpus' })).toBe(true);
        expect(isRetirementGoal({ name: 'Buying a Car' })).toBe(false);
        expect(getGoalTargetYear({ yearsToGoal: 2 }, 2026)).toBe(2028);
        expect(getGoalFutureValue({ futureValue: 1058452 })).toBe(1058452);
        expect(getGoalFutureValue({ presentValue: 100000, yearsToGoal: 1, inflationRate: 0 })).toBe(100000);
    });

    it('sorts goals nearest first and drops goals without a target amount', () => {
        const sorted = sortGoalsNearestFirst([
            { id: 'far', yearsToGoal: 8, futureValue: 100 },
            { id: 'empty', yearsToGoal: 1, futureValue: 0 },
            { id: 'near', yearsToGoal: 2, futureValue: 100 },
        ], 2026);
        expect(sorted.map((g) => g.id)).toEqual(['near', 'far']);
    });
});

describe('user-facing naming', () => {
    it('never exposes the internal residual pool name', () => {
        expect(avenueLabel(FUTURE_SURPLUS_AVENUE_ID)).toBe('Accumulated surplus not yet invested');
        const labels = [
            scenarioLabel(SCENARIO_WEALTH, 2032),
            avenueLabel(FUTURE_SURPLUS_AVENUE_ID),
        ].join(' ');
        expect(labels).not.toMatch(/residual/i);
        expect(scenarioLabel(SCENARIO_WEALTH, 2032)).toBe('Your Wealth by 2032');
    });
});

describe('runFundingPass — nearest first with engine withdrawal', () => {
    it('reduces the corpus later goals can draw on after an earlier goal is funded', () => {
        const scheduleInputs = baseScheduleInputs({
            assetCategories: { investments: { mutualFunds: 1000000 }, retirement: {} },
        });

        const nearGoal = { id: 'car', name: 'Car', yearsToGoal: 2, futureValue: 400000 };
        const farGoal = { id: 'house', name: 'House', yearsToGoal: 6, futureValue: 5000000 };

        const together = runFundingPass({
            goals: [nearGoal, farGoal],
            scheduleInputs,
            includeProposedAllocations: false,
            asOfYear: AS_OF_YEAR,
            horizonYear: AS_OF_YEAR + 6,
        });
        const farAlone = runFundingPass({
            goals: [farGoal],
            scheduleInputs,
            includeProposedAllocations: false,
            asOfYear: AS_OF_YEAR,
            horizonYear: AS_OF_YEAR + 6,
        });

        expect(together.byGoalId.car.funded).toBe(400000);
        expect(together.goalMappings.car.sip).toBe(400000);
        // The engine withdrew the car money, so the house sees a smaller SIP corpus.
        expect(together.byGoalId.house.funded).toBeLessThan(farAlone.byGoalId.house.funded);
    });

    it('follows the locked investment order and keeps PPF / NPS for retirement only', () => {
        const scheduleInputs = baseScheduleInputs({
            assetCategories: {
                investments: { mutualFunds: 200000, equity: 300000 },
                retirement: { ppf: 400000, nps: 500000 },
            },
            calculatorInputs: {
                ...baseScheduleInputs().calculatorInputs,
                lumpsum: { amount: 250000, rate: 12 },
            },
            expenseCategories: { savings: { sip: 0, ppf: { amount: 1000, startYear: AS_OF_YEAR, startMonth: 1 } } },
            familyMembers: [{ relation: 'Self', dob: '1990-01-15', retirementAge: 60 }],
        });

        const normal = runFundingPass({
            goals: [{ id: 'car', name: 'Car', yearsToGoal: 3, futureValue: 100000000 }],
            scheduleInputs,
            includeProposedAllocations: false,
            asOfYear: AS_OF_YEAR,
            horizonYear: AS_OF_YEAR + 3,
        });
        expect(normal.byGoalId.car.draws.map((d) => d.id)).toEqual(['sip', 'equity', 'lumpsum']);

        const retirement = runFundingPass({
            goals: [{ id: 'retirement', name: 'Retirement', yearsToGoal: 3, futureValue: 100000000 }],
            scheduleInputs,
            includeProposedAllocations: false,
            asOfYear: AS_OF_YEAR,
            horizonYear: AS_OF_YEAR + 3,
        });
        expect(retirement.byGoalId.retirement.draws.map((d) => d.id))
            .toEqual(['sip', 'equity', 'lumpsum', 'ppf', 'nps']);
    });

    it('consumes only what a goal needs from a maturity and carries the rest as leftover', () => {
        // A January FD matures at the end of startYear + duration - 1.
        const maturityYear = AS_OF_YEAR + 2;
        const scheduleInputs = baseScheduleInputs({
            assetCategories: {
                investments: {
                    fixedDeposit: [{
                        amount: 1000000,
                        startYear: AS_OF_YEAR,
                        startMonth: 1,
                        duration: 3,
                    }],
                },
                retirement: {},
            },
        });

        const pass = runFundingPass({
            goals: [{ id: 'trip', name: 'Trip', yearsToGoal: 2, futureValue: 300000 }],
            scheduleInputs,
            includeProposedAllocations: false,
            asOfYear: AS_OF_YEAR,
            horizonYear: AS_OF_YEAR + 5,
        });

        const fdDraw = pass.byGoalId.trip.draws.find((d) => d.id === 'fd');
        expect(fdDraw.amount).toBe(300000);
        expect(fdDraw.availableAtGoalYear).toBeGreaterThan(300000);
        // Unused maturity is never dropped: it becomes leftover for the residual pool.
        expect(pass.maturityLeftoverByYear[maturityYear])
            .toBe(fdDraw.availableAtGoalYear - 300000);
    });

    it('routes an entirely unused maturity into the leftover stream', () => {
        const scheduleInputs = baseScheduleInputs({
            assetCategories: {
                investments: {
                    fixedDeposit: [{
                        amount: 500000,
                        startYear: AS_OF_YEAR,
                        startMonth: 1,
                        duration: 4,
                    }],
                },
                retirement: {},
            },
        });

        const pass = runFundingPass({
            goals: [],
            scheduleInputs,
            includeProposedAllocations: false,
            asOfYear: AS_OF_YEAR,
            horizonYear: AS_OF_YEAR + 5,
        });

        expect(pass.maturityLeftoverByYear[AS_OF_YEAR + 3]).toBeGreaterThan(500000);
    });
});

describe('buildResidualContributions', () => {
    it('takes the current-year tail after the last planned month and reuses Journey for later years', () => {
        const contributions = buildResidualContributions({
            journeyProjections: [
                { year: AS_OF_YEAR, unallocatedSurplus: 999999 },
                { year: AS_OF_YEAR + 1, unallocatedSurplus: 240000 },
                { year: AS_OF_YEAR + 2, unallocatedSurplus: -50000 },
                { year: AS_OF_YEAR + 9, unallocatedSurplus: 300000 },
            ],
            monthlyUnallocatedSurplus: Array(12).fill(10000),
            investmentAllocations: [],
            plannedMonths: [{ key: `${AS_OF_YEAR}-8` }],
            asOfYear: AS_OF_YEAR,
            asOfMonthIndex: 6,
            planStartMonthIndex: 0,
            horizonYear: AS_OF_YEAR + 3,
        });

        // Planned through September (index 8) → October, November, December remain.
        expect(contributions.tailStartMonthIndex).toBe(9);
        expect(contributions.currentYearTail).toBe(30000);
        expect(contributions.byYear[AS_OF_YEAR]).toBe(30000);
        // Journey's own current-year row is never double counted.
        expect(contributions.byYear[AS_OF_YEAR]).not.toBe(999999);
        expect(contributions.byYear[AS_OF_YEAR + 1]).toBe(240000);
        expect(contributions.byYear[AS_OF_YEAR + 2]).toBeUndefined();
        // Beyond the horizon is ignored.
        expect(contributions.byYear[AS_OF_YEAR + 9]).toBeUndefined();
    });

    it('subtracts already committed PYMTW amounts from the tail without recomputing surplus', () => {
        const contributions = buildResidualContributions({
            monthlyUnallocatedSurplus: Array(12).fill(20000),
            investmentAllocations: [{
                type: 'SIP',
                amount: 120000,
                startYear: AS_OF_YEAR,
                startMonth: 11,
                studioPlanKey: `${AS_OF_YEAR}-10`,
            }],
            plannedMonths: [{ key: `${AS_OF_YEAR}-10` }],
            asOfYear: AS_OF_YEAR,
            asOfMonthIndex: 10,
            horizonYear: AS_OF_YEAR,
        });

        // Only December remains, and the 10,000 monthly SIP is already committed.
        expect(contributions.tailStartMonthIndex).toBe(11);
        expect(contributions.currentYearTail).toBe(10000);
    });

    it('starts from the current month when nothing is planned yet', () => {
        const contributions = buildResidualContributions({
            monthlyUnallocatedSurplus: Array(12).fill(5000),
            plannedMonths: [],
            asOfYear: AS_OF_YEAR,
            asOfMonthIndex: 10,
            horizonYear: AS_OF_YEAR,
        });
        expect(contributions.tailStartMonthIndex).toBe(10);
        expect(contributions.currentYearTail).toBe(10000);
    });
});

describe('simulateResidualPool — locked timing convention', () => {
    it('compounds the opening balance, then adds surplus, then maturities, then funds goals', () => {
        const { timeline, drawByGoalId, closingBalance } = simulateResidualPool({
            contributionsByYear: { 2027: 100000, 2031: 50000 },
            maturityLeftoverByYear: { 2029: 200000 },
            goalQueue: [
                { goalId: 'g1', targetYear: 2030, gap: 150000 },
                { goalId: 'g2', targetYear: 2032, gap: 10000000 },
            ],
            asOfYear: 2027,
            horizonYear: 2032,
        });

        const byYear = Object.fromEntries(timeline.map((row) => [row.year, row]));

        // Contributions do not earn growth in their arrival year.
        expect(byYear[2027].growth).toBe(0);
        expect(byYear[2027].surplusAdded).toBe(100000);
        expect(byYear[2027].closing).toBe(100000);

        expect(byYear[2028].growth).toBe(Math.round(100000 * RESIDUAL_POOL_RATE));
        expect(byYear[2028].closing).toBe(110000);

        // Maturity arrives in 2029 on top of the compounded balance.
        expect(byYear[2029].maturityAdded).toBe(200000);
        expect(byYear[2029].closing).toBe(321000);

        // 2030 goal draws after the opening balance compounds.
        expect(byYear[2030].opening).toBe(321000);
        expect(byYear[2030].growth).toBe(32100);
        expect(drawByGoalId.g1).toBe(150000);
        expect(byYear[2030].closing).toBe(203100);

        // Surplus keeps arriving after an earlier goal was funded.
        expect(byYear[2031].surplusAdded).toBe(50000);
        expect(byYear[2031].closing).toBe(273410);

        // The later goal receives the updated pool, never the original lump sum.
        expect(drawByGoalId.g2).toBe(300751);
        expect(closingBalance).toBe(0);
    });

    it('gives later goals only what earlier goals left behind', () => {
        const greedyFirst = simulateResidualPool({
            contributionsByYear: { 2027: 500000 },
            goalQueue: [
                { goalId: 'first', targetYear: 2028, gap: 500000 },
                { goalId: 'second', targetYear: 2029, gap: 500000 },
            ],
            asOfYear: 2027,
            horizonYear: 2029,
        });
        expect(greedyFirst.drawByGoalId.first).toBe(500000);
        expect(greedyFirst.drawByGoalId.second).toBe(55000);

        const untouched = simulateResidualPool({
            contributionsByYear: { 2027: 500000 },
            goalQueue: [{ goalId: 'second', targetYear: 2029, gap: 500000 }],
            asOfYear: 2027,
            horizonYear: 2029,
        });
        expect(untouched.drawByGoalId.second).toBe(500000);
    });
});

describe('buildTrackSurplusAllocationReport', () => {
    const goals = [
        { id: 'car', name: 'Buying a Car', yearsToGoal: 2, futureValue: 800000 },
        { id: 'house', name: 'Buying a House', yearsToGoal: 6, futureValue: 5000000 },
    ];

    const withPlan = () => reportInputs({
        goals,
        assetCategories: { investments: { mutualFunds: 300000 }, retirement: {} },
        expenseCategories: { savings: { sip: 5000 } },
        investmentAllocations: [{
            id: 1,
            type: 'SIP',
            amount: 240000,
            startMonth: 7,
            startYear: AS_OF_YEAR,
            duration: 10,
            studioPlanKey: `${AS_OF_YEAR}-6`,
        }],
        journeyProjections: [
            { year: AS_OF_YEAR + 1, unallocatedSurplus: 200000 },
            { year: AS_OF_YEAR + 2, unallocatedSurplus: 200000 },
            { year: AS_OF_YEAR + 3, unallocatedSurplus: 200000 },
            { year: AS_OF_YEAR + 4, unallocatedSurplus: 200000 },
            { year: AS_OF_YEAR + 5, unallocatedSurplus: 200000 },
            { year: AS_OF_YEAR + 6, unallocatedSurplus: 200000 },
        ],
        monthlyUnallocatedSurplus: Array(12).fill(30000),
    });

    it('reports a single wealth scenario with goal amount, wealth and shortfall', () => {
        const report = buildTrackSurplusAllocationReport(withPlan());
        const [car, house] = report.goalCards;

        expect(report.goalCards).toHaveLength(2);
        expect(car.scenarioOrder).toEqual([SCENARIO_WEALTH]);
        expect(report.fundingRoute).toBeUndefined();

        [car, house].forEach((card) => {
            const scenario = card.scenario;
            expect(scenario.id).toBe(SCENARIO_WEALTH);
            expect(scenario.label).toBe(`Your Wealth by ${card.targetYear}`);
            expect(scenario.goalAmount).toBe(card.goalAmount);
            expect(scenario.remainingGap)
                .toBe(Math.max(0, card.goalAmount - scenario.projectedWealth));
            const composed = scenario.composition.reduce((sum, item) => sum + item.amount, 0);
            expect(composed).toBe(scenario.projectedWealth);
        });

        expect(house.scenario.projectedWealth).toBeGreaterThan(0);
        expect(report.totals.projectedWealth).toBe(
            car.scenario.projectedWealth + house.scenario.projectedWealth,
        );
    });

    it('includes PYMTW planning in the single wealth scenario', () => {
        const withoutPlan = buildTrackSurplusAllocationReport(
            reportInputs({ ...withPlan(), investmentAllocations: [] }),
        );
        const withAllocations = buildTrackSurplusAllocationReport(withPlan());

        expect(withAllocations.goalCards[1].scenario.projectedWealth)
            .toBeGreaterThan(withoutPlan.goalCards[1].scenario.projectedWealth);
    });

    it('labels accumulated surplus in the wealth composition and never double-funds a goal', () => {
        const report = buildTrackSurplusAllocationReport(withPlan());
        const house = report.goalCards[1];

        const composition = house.scenario.composition;
        const surplusEntry = composition.find((c) => c.id === FUTURE_SURPLUS_AVENUE_ID);
        const investmentTotal = composition
            .filter((c) => c.id !== FUTURE_SURPLUS_AVENUE_ID)
            .reduce((sum, c) => sum + c.amount, 0);

        if (surplusEntry) {
            expect(surplusEntry.label).toBe('Accumulated surplus not yet invested');
            expect(surplusEntry.amount).toBe(house.futureSurplusUsed);
        }
        // Residual only fills the remaining gap after investments — never exceeds goal need.
        expect(investmentTotal + (surplusEntry?.amount || 0)).toBeLessThanOrEqual(house.goalAmount);
        expect(house.scenario.projectedWealth).toBeLessThanOrEqual(house.goalAmount);
        expect(report.futureSurplus.totalDrawn).toBeGreaterThanOrEqual(0);
    });

    it('allocates accumulated surplus before SIP and reduces the SIP withdrawal', () => {
        const input = reportInputs({
            goals: [{
                id: 'goal',
                name: 'Goal',
                yearsToGoal: 2,
                futureValue: 500000,
            }],
            assetCategories: {
                investments: { mutualFunds: 1000000 },
                retirement: {},
            },
            journeyProjections: [{
                year: AS_OF_YEAR + 2,
                unallocatedSurplus: 200000,
            }],
        });

        const report = buildTrackSurplusAllocationReport(input);
        const card = report.goalCards[0];
        const ids = card.scenario.composition.map((item) => item.id);
        const surplus = card.scenario.composition.find(
            (item) => item.id === FUTURE_SURPLUS_AVENUE_ID,
        );
        const sip = card.scenario.composition.find((item) => item.id === 'sip');

        expect(ids.slice(0, 2)).toEqual([FUTURE_SURPLUS_AVENUE_ID, 'sip']);
        expect(surplus.amount).toBe(200000);
        expect(sip.amount).toBe(300000);
        expect(card.editableAvenues[0].id).toBe(FUTURE_SURPLUS_AVENUE_ID);
        expect(card.scenario.projectedWealth).toBe(card.goalAmount);
    });

    it('honours a saved surplus override and reallocates the balance to SIP', () => {
        const report = buildTrackSurplusAllocationReport(reportInputs({
            goals: [{
                id: 'goal',
                name: 'Goal',
                yearsToGoal: 2,
                futureValue: 500000,
            }],
            assetCategories: {
                investments: { mutualFunds: 1000000 },
                retirement: {},
            },
            journeyProjections: [{
                year: AS_OF_YEAR + 2,
                unallocatedSurplus: 200000,
            }],
            goalMappings: {
                goal: { futureSurplus: 100000, sip: 400000 },
            },
            customizedGoalIds: ['goal'],
        }));

        const card = report.goalCards[0];
        const surplus = card.scenario.composition.find(
            (item) => item.id === FUTURE_SURPLUS_AVENUE_ID,
        );
        const sip = card.scenario.composition.find((item) => item.id === 'sip');

        expect(surplus.amount).toBe(100000);
        expect(sip.amount).toBe(400000);
        expect(card.residualBreakdown.lines.at(-1)).toMatchObject({
            id: 'total',
            amount: 200000,
        });
    });

    it('exposes a per-goal residual breakdown with surplus collapsed till goal year', () => {
        const report = buildTrackSurplusAllocationReport(withPlan());
        const house = report.goalCards[1];
        expect(house.residualBreakdown).toBeTruthy();
        expect(house.residualBreakdown.surplusTillLabel).toBe(`Surplus till ${house.targetYear}`);
        expect(house.residualBreakdown.lines.some((l) => l.id === 'surplus' || l.id === 'drawn')).toBe(true);

        const rebuilt = buildResidualBreakdownForGoal({
            goalId: house.goalId,
            targetYear: house.targetYear,
            residualDraw: house.futureSurplusUsed,
            contributionsByYear: report.futureSurplus.contributions.byYear,
            timeline: report.futureSurplus.timeline,
            asOfYear: report.meta.asOfYear,
            residualRatePct: report.meta.residualRatePct,
        });
        expect(rebuilt.residualDraw).toBe(house.futureSurplusUsed);
        expect(rebuilt.surplusTillGoal).toBe(house.residualBreakdown.surplusTillGoal);
    });

    it('shapes calculation-state assignments like the persistent planning state', () => {
        const { assignments } = buildTrackSurplusAllocationReport(withPlan());

        expect(Object.keys(assignments)).toEqual(['currentPlan', 'persisted']);
        expect(assignments.currentPlan.car.sip).toBeGreaterThan(0);
        Object.values(assignments.currentPlan).forEach((mapping) => {
            Object.keys(mapping).forEach((key) => {
                expect(['futureSurplus', 'sip', 'equity', 'lumpsum']).toContain(key);
                expect(typeof mapping[key]).toBe('number');
            });
        });
    });

    it('carries an unused insurance maturity forward to a later goal', () => {
        const report = buildTrackSurplusAllocationReport(reportInputs({
            goals: [{ id: 'house', name: 'House', yearsToGoal: 6, futureValue: 5000000 }],
            policies: [{
                id: 'p1',
                planType: 'Saving Plan',
                planName: 'Endowment',
                startDate: `${AS_OF_YEAR - 8}-01-01`,
                policyTerm: 10,
                paymentTerm: 10,
                premium: 20000,
                frequency: 'Annually',
                maturityAmount: 350000,
                insuredName: 'Self',
            }],
        }));

        const house = report.goalCards[0];
        const maturityYear = AS_OF_YEAR + 2;
        const maturityRow = report.futureSurplus.timeline.find((row) => row.year === maturityYear);

        // The maturity lands four years before the goal, so it can only help via the pool.
        expect(maturityRow.maturityAdded).toBe(350000);
        expect(house.futureSurplusUsed).toBeGreaterThan(350000);
        expect(house.scenario.composition
            .some((c) => c.id === FUTURE_SURPLUS_AVENUE_ID)).toBe(true);
    });

    it('handles empty plans, empty journey and no goals', () => {
        const empty = buildTrackSurplusAllocationReport(reportInputs({
            asOfDate: new Date(AS_OF_YEAR, 7, 1),
        }));

        expect(empty.meta.asOfMonthLabel).toBe('August');
        expect(empty.meta.hasPymtwPlans).toBe(false);
        expect(empty.meta.hasGoals).toBe(false);
        expect(empty.goalCards).toEqual([]);
        expect(empty.meta.plannedMonthsNotice).toContain('Complete Put Your Money to Work');
        expect(empty.totals.goalAmount).toBe(0);
        expect(empty.futureSurplus.totalDrawn).toBe(0);
    });
});

describe('seeded goalMappings and apply helpers', () => {
    it('reduces later-goal SIP availability when Goal 1 is already applied', () => {
        const scheduleInputs = baseScheduleInputs({
            assetCategories: { investments: { mutualFunds: 1000000 }, retirement: {} },
        });
        const nearGoal = { id: 'car', name: 'Car', yearsToGoal: 2, futureValue: 400000 };
        const farGoal = { id: 'house', name: 'House', yearsToGoal: 6, futureValue: 5000000 };

        // House alone sees the full SIP corpus (no earlier withdrawal).
        const houseAlone = runFundingPass({
            goals: [farGoal],
            scheduleInputs,
            includeProposedAllocations: false,
            asOfYear: AS_OF_YEAR,
            horizonYear: AS_OF_YEAR + 6,
        });

        const withSeed = runFundingPass({
            goals: [nearGoal, farGoal],
            scheduleInputs,
            includeProposedAllocations: false,
            asOfYear: AS_OF_YEAR,
            horizonYear: AS_OF_YEAR + 6,
            seededGoalMappings: { car: { sip: 400000 } },
        });

        expect(withSeed.byGoalId.car.isApplied).toBe(true);
        expect(withSeed.byGoalId.car.draws.find((d) => d.id === 'sip').amount).toBe(400000);
        expect(withSeed.byGoalId.house.funded).toBeLessThan(houseAlone.byGoalId.house.funded);

        const houseSip = withSeed.byGoalId.house.editableAvenues.find((a) => a.id === 'sip');
        const houseSipAlone = houseAlone.byGoalId.house.editableAvenues.find((a) => a.id === 'sip');
        expect(houseSip.availableMax).toBeLessThan(houseSipAlone.availableMax);
    });

    it('exposes audit fields availableBefore / allocated / remainingAfter', () => {
        const pass = runFundingPass({
            goals: [{ id: 'car', name: 'Car', yearsToGoal: 2, futureValue: 250000 }],
            scheduleInputs: baseScheduleInputs({
                assetCategories: { investments: { mutualFunds: 800000 }, retirement: {} },
            }),
            includeProposedAllocations: false,
            asOfYear: AS_OF_YEAR,
            horizonYear: AS_OF_YEAR + 2,
        });

        const sip = pass.byGoalId.car.calculationAudit.find((row) => row.id === 'sip');
        expect(sip.allocated).toBe(250000);
        expect(sip.availableBefore).toBeGreaterThanOrEqual(250000);
        expect(sip.remainingAfter).toBe(sip.availableBefore - sip.allocated);
    });

    it('keeps apply payload to editable avenues and preserves an explicit zero surplus', () => {
        const payload = buildApplyPayload('car', {
            sip: 100000,
            equity: 50000,
            lumpsum: 0,
            fd: 999999,
            ppf: 888888,
            futureSurplus: 777777,
        });
        expect(payload).toEqual({
            goalId: 'car',
            mapping: { sip: 100000, equity: 50000, futureSurplus: 777777 },
        });

        const merged = mergeGoalMapping(
            { car: { sip: 10, fd: 99 }, house: { equity: 20, futureSurplus: 0 } },
            'car',
            { sip: 100000, rd: 50, futureSurplus: 0 },
        );
        expect(merged.car).toEqual({ sip: 100000, futureSurplus: 0 });
        expect(merged.house).toEqual({ equity: 20, futureSurplus: 0 });
        expect(merged.car.fd).toBeUndefined();
    });

    it('clamps editable amounts to available max', () => {
        expect(clampAvenueAmount(500000, 120000)).toBe(120000);
        expect(clampAvenueAmount(-10, 120000)).toBe(0);
        expect(clampAvenueAmount(80000, 120000)).toBe(80000);
    });

    it('honours draft overrides without writing maturity keys into assignments', () => {
        const report = buildTrackSurplusAllocationReport(reportInputs({
            goals: [{ id: 'car', name: 'Car', yearsToGoal: 2, futureValue: 500000 }],
            assetCategories: { investments: { mutualFunds: 900000 }, retirement: {} },
            overridesByGoalId: { car: { sip: 100000 } },
        }));

        const car = report.goalCards[0];
        const sip = car.scenario.composition.find((c) => c.id === 'sip');
        expect(sip.amount).toBe(100000);
        expect(Object.keys(report.assignments.currentPlan.car || {})).toEqual(['sip']);
        expect(car.accent).toBeTruthy();
        expect(car.accent.hex).toMatch(/^#/);
    });

    it('seeds persisted mappings into the full report so later goals shrink', () => {
        const houseOnly = {
            goals: [
                { id: 'house', name: 'Buying a House', yearsToGoal: 6, futureValue: 5000000 },
            ],
            assetCategories: { investments: { mutualFunds: 1000000 }, retirement: {} },
            expenseCategories: { savings: { sip: 5000 } },
        };
        const bothGoals = {
            goals: [
                { id: 'car', name: 'Buying a Car', yearsToGoal: 2, futureValue: 400000 },
                { id: 'house', name: 'Buying a House', yearsToGoal: 6, futureValue: 5000000 },
            ],
            assetCategories: { investments: { mutualFunds: 1000000 }, retirement: {} },
            expenseCategories: { savings: { sip: 5000 } },
        };

        const before = buildTrackSurplusAllocationReport(reportInputs(houseOnly));
        const after = buildTrackSurplusAllocationReport(reportInputs({
            ...bothGoals,
            goalMappings: { car: { sip: 400000 } },
        }));

        const houseBefore = before.goalCards.find((g) => g.goalId === 'house');
        const houseAfter = after.goalCards.find((g) => g.goalId === 'house');
        expect(after.goalCards[0].isApplied).toBe(true);
        expect(houseAfter.scenario.projectedWealth)
            .toBeLessThan(houseBefore.scenario.projectedWealth);
        expect(after.assignments.persisted.car.sip).toBe(400000);
    });
});
