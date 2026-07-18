import { describe, it, expect } from 'vitest';
import {
    assignNearestFirst,
    buildPlannedMonthsNotice,
    buildTrackSurplusAllocationReport,
    derivePlannedMonths,
    getGoalFutureValue,
    getGoalTargetYear,
    isRetirementGoal,
    labelForPlanKey,
} from './trackSurplusAllocationLogic';

describe('trackSurplusAllocationLogic', () => {
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

    it('detects retirement goals and computes target year / future value', () => {
        expect(isRetirementGoal({ id: 'retirement', name: 'Retirement Corpus' })).toBe(true);
        expect(isRetirementGoal({ name: 'Buying a Car' })).toBe(false);
        expect(getGoalTargetYear({ yearsToGoal: 2 }, 2026)).toBe(2028);
        expect(getGoalFutureValue({ futureValue: 1058452 })).toBe(1058452);
        expect(getGoalFutureValue({ presentValue: 100000, yearsToGoal: 1, inflationRate: 0 })).toBe(100000);
    });

    it('assigns growth pools nearest-first without double-counting', () => {
        const schedules = {
            growth: {
                sip: {
                    baseline: [
                        { year: 2028, valueAfterWithdrawal: 400000 },
                        { year: 2032, valueAfterWithdrawal: 900000 },
                    ],
                    enhanced: [
                        { year: 2028, valueAfterWithdrawal: 500000 },
                        { year: 2032, valueAfterWithdrawal: 1100000 },
                    ],
                    field: 'valueAfterWithdrawal',
                },
                equity: {
                    baseline: [
                        { year: 2028, valueAfterWithdrawal: 100000 },
                        { year: 2032, valueAfterWithdrawal: 200000 },
                    ],
                    enhanced: [
                        { year: 2028, valueAfterWithdrawal: 150000 },
                        { year: 2032, valueAfterWithdrawal: 300000 },
                    ],
                    field: 'valueAfterWithdrawal',
                },
                lumpsum: {
                    baseline: [],
                    enhanced: [],
                    field: 'valueAfterWithdrawal',
                },
                ppf: { baseline: [], enhanced: [], field: 'endValue' },
                nps: { baseline: [], enhanced: [], field: 'endValue' },
            },
            maturity: {
                fd: { baseline: [], enhanced: [] },
                rd: { baseline: [], enhanced: [] },
                insurance: { byYear: {} },
            },
        };

        const cards = assignNearestFirst({
            asOfYear: 2026,
            schedules,
            goals: [
                { id: 'car', name: 'Car', yearsToGoal: 2, futureValue: 600000 },
                { id: 'house', name: 'House', yearsToGoal: 6, futureValue: 2000000 },
            ],
        });

        expect(cards).toHaveLength(2);
        expect(cards[0].targetYear).toBe(2028);
        expect(cards[0].afterAllocation).toBe(600000);
        const carSip = cards[0].avenues.find((a) => a.id === 'sip');
        const carEquity = cards[0].avenues.find((a) => a.id === 'equity');
        expect(carSip.afterValue).toBe(500000);
        expect(carSip.currentValue).toBe(500000); // uncapped enhanced projection at 2028
        expect(carEquity.afterValue).toBe(100000);
        // Equity pool at 2028 is 150000; only 100000 allocated (goal need remaining)
        expect(carEquity.currentValue).toBe(150000);

        // Remaining SIP at 2032 = 1,100,000 - 500,000 consumed = 600,000
        const houseSip = cards[1].avenues.find((a) => a.id === 'sip');
        expect(houseSip.afterValue).toBe(600000);
        // Current Value is full uncapped projection at goal year (not remaining pool)
        expect(houseSip.currentValue).toBe(1100000);
        // Remaining equity at 2032 = 300,000 - 100,000 = 200,000
        const houseEquity = cards[1].avenues.find((a) => a.id === 'equity');
        expect(houseEquity.afterValue).toBe(200000);
        expect(houseEquity.currentValue).toBe(300000);
        expect(cards[1].afterAllocation).toBe(800000);
        expect(cards[1].shortfall).toBe(1200000);
    });

    it('includes PPF and NPS only on retirement goals', () => {
        const schedules = {
            growth: {
                sip: {
                    baseline: [{ year: 2045, valueAfterWithdrawal: 100000 }],
                    enhanced: [{ year: 2045, valueAfterWithdrawal: 100000 }],
                    field: 'valueAfterWithdrawal',
                },
                equity: { baseline: [], enhanced: [], field: 'valueAfterWithdrawal' },
                lumpsum: { baseline: [], enhanced: [], field: 'valueAfterWithdrawal' },
                ppf: {
                    baseline: [{ year: 2045, endValue: 250000 }],
                    enhanced: [{ year: 2045, endValue: 400000 }],
                    field: 'endValue',
                },
                nps: {
                    baseline: [{ year: 2045, endValue: 300000 }],
                    enhanced: [{ year: 2045, endValue: 500000 }],
                    field: 'endValue',
                },
            },
            maturity: {
                fd: { baseline: [], enhanced: [] },
                rd: { baseline: [], enhanced: [] },
                insurance: { byYear: {} },
            },
        };

        const car = assignNearestFirst({
            asOfYear: 2026,
            schedules,
            goals: [{ id: 'car', name: 'Car', yearsToGoal: 19, futureValue: 2000000 }],
        })[0];
        expect(car.avenues.some((a) => a.id === 'ppf')).toBe(false);
        expect(car.avenues.some((a) => a.id === 'nps')).toBe(false);

        const retirement = assignNearestFirst({
            asOfYear: 2026,
            schedules,
            goals: [{ id: 'retirement', name: 'Retirement Corpus', yearsToGoal: 19, futureValue: 2000000 }],
        })[0];
        expect(retirement.isRetirement).toBe(true);
        expect(retirement.avenues.find((a) => a.id === 'ppf').afterValue).toBe(400000);
        expect(retirement.avenues.find((a) => a.id === 'nps').afterValue).toBe(500000);
    });

    it('attaches FD / RD / insurance maturity only when maturity year equals goal year', () => {
        const schedules = {
            growth: {
                sip: { baseline: [], enhanced: [], field: 'valueAfterWithdrawal' },
                equity: { baseline: [], enhanced: [], field: 'valueAfterWithdrawal' },
                lumpsum: { baseline: [], enhanced: [], field: 'valueAfterWithdrawal' },
                ppf: { baseline: [], enhanced: [], field: 'endValue' },
                nps: { baseline: [], enhanced: [], field: 'endValue' },
            },
            maturity: {
                fd: {
                    baseline: [{ year: 2028, maturityValue: 200000, endValue: 0 }],
                    enhanced: [{ year: 2028, maturityValue: 250000, endValue: 0 }],
                },
                rd: {
                    baseline: [{ year: 2032, maturityValue: 150000, endValue: 0 }],
                    enhanced: [{ year: 2032, maturityValue: 180000, endValue: 0 }],
                },
                insurance: { byYear: { 2028: 100000 } },
            },
        };

        const cards = assignNearestFirst({
            asOfYear: 2026,
            schedules,
            goals: [
                { id: 'car', name: 'Car', yearsToGoal: 2, futureValue: 1000000 },
                { id: 'house', name: 'House', yearsToGoal: 6, futureValue: 1000000 },
            ],
        });

        const carAvenues = cards[0].avenues.map((a) => a.id);
        expect(carAvenues).toContain('fd');
        expect(carAvenues).toContain('insurance');
        expect(carAvenues).not.toContain('rd');
        expect(cards[0].avenues.find((a) => a.id === 'fd').afterValue).toBe(250000);
        expect(cards[0].avenues.find((a) => a.id === 'fd').currentValue).toBe(250000);
        expect(cards[0].avenues.find((a) => a.id === 'insurance').afterValue).toBe(100000);
        expect(cards[0].avenues.find((a) => a.id === 'insurance').currentValue).toBe(100000);

        const houseAvenues = cards[1].avenues.map((a) => a.id);
        expect(houseAvenues).toContain('rd');
        expect(houseAvenues).not.toContain('fd');
        expect(houseAvenues).not.toContain('insurance');
        expect(cards[1].avenues.find((a) => a.id === 'rd').afterValue).toBe(180000);
        expect(cards[1].avenues.find((a) => a.id === 'rd').currentValue).toBe(180000);
    });

    it('builds full report with rolling as-of date and PYMTW notice', () => {
        const report = buildTrackSurplusAllocationReport({
            asOfDate: new Date(2026, 6, 15), // July 2026
            goals: [
                // Large target so maturity instruments still receive assignment after growth pools
                { id: 'car', name: 'Buying a Car', yearsToGoal: 2, futureValue: 5000000 },
                { id: 'retirement', name: 'Retirement Corpus', yearsToGoal: 19, futureValue: 24852478 },
            ],
            assetCategories: {
                investments: { mutualFunds: 50000, equity: 20000, fixedDeposit: [] },
                retirement: { ppf: 50000, nps: 80000 },
            },
            expenseCategories: {
                savings: { sip: 1000, ppf: { amount: 2000, startYear: 2024, startMonth: 1 }, nps: 3000 },
            },
            calculatorInputs: {
                sip: { rate: 12 },
                equity: { rate: 15 },
                lumpsum: { amount: 0, rate: 12 },
                ppf: { rate: 7.1 },
                nps: { rate: 10 },
                fd: { rate: 7, frequency: 'Quarterly' },
                rd: { rate: 7 },
            },
            investmentAllocations: [
                {
                    id: 1,
                    type: 'SIP',
                    amount: 120000,
                    startMonth: 7,
                    startYear: 2026,
                    duration: 10,
                    studioPlanKey: '2026-6',
                },
                {
                    id: 2,
                    type: 'Fixed Deposit',
                    amount: 100000,
                    startMonth: 8,
                    startYear: 2026,
                    duration: 2,
                    studioPlanKey: '2026-7',
                },
            ],
            familyMembers: [{ relation: 'Self', dob: '1990-01-15', retirementAge: 60 }],
            policies: [
                {
                    id: 'p1',
                    planType: 'Saving Plan',
                    planName: 'Endowment',
                    startDate: '2018-01-01',
                    policyTerm: 10,
                    paymentTerm: 10,
                    premium: 20000,
                    frequency: 'Annually',
                    maturityAmount: 350000,
                    insuredName: 'Self',
                },
            ],
        });

        expect(report.meta.asOfLabel).toBe('July 2026');
        expect(report.meta.hasPymtwPlans).toBe(true);
        expect(report.meta.plannedMonthsNotice).toContain('July');
        expect(report.meta.plannedMonthsNotice).toContain('August');
        expect(report.plannedMonths).toHaveLength(2);
        expect(report.asOfCorpus.sip).toBe(50000);
        expect(report.asOfCorpus.equity).toBe(20000);
        expect(report.goalCards[0].name).toBe('Buying a Car');
        expect(report.goalCards[0].targetYear).toBe(2028);
        expect(report.goalCards[1].isRetirement).toBe(true);
        expect(report.goalCards[1].avenues.some((a) => a.id === 'ppf' || a.id === 'nps')).toBe(true);

        // Insurance matures 2018+10 = 2028 → on car goal
        const carInsurance = report.goalCards[0].avenues.find((a) => a.id === 'insurance');
        expect(carInsurance?.afterValue).toBe(350000);
    });

    it('handles empty PYMTW plans and empty goals', () => {
        const empty = buildTrackSurplusAllocationReport({
            asOfDate: new Date(2026, 7, 1),
            goals: [],
            investmentAllocations: [],
        });
        expect(empty.meta.asOfMonthLabel).toBe('August');
        expect(empty.meta.hasPymtwPlans).toBe(false);
        expect(empty.meta.hasGoals).toBe(false);
        expect(empty.goalCards).toEqual([]);
        expect(empty.meta.plannedMonthsNotice).toContain('Complete Put Your Money to Work');
    });

    it('includes October plans when as-of is August (rolling window allocations)', () => {
        const report = buildTrackSurplusAllocationReport({
            asOfDate: new Date(2026, 7, 10), // August 2026
            goals: [{ id: 'car', name: 'Car', yearsToGoal: 2, futureValue: 500000 }],
            assetCategories: { investments: { mutualFunds: 0, equity: 0 }, retirement: {} },
            expenseCategories: { savings: { sip: 0 } },
            calculatorInputs: { sip: { rate: 12 }, equity: { rate: 15 }, lumpsum: { amount: 0, rate: 12 } },
            investmentAllocations: [
                {
                    id: 1,
                    type: 'Lumpsum',
                    amount: 50000,
                    startMonth: 10,
                    startYear: 2026,
                    duration: 5,
                    studioPlanKey: '2026-9',
                },
            ],
        });

        expect(report.plannedMonths.map((m) => m.key)).toEqual(['2026-9']);
        expect(report.meta.plannedMonthsNotice).toContain('October');
        expect(report.goalCards[0].afterAllocation).toBeGreaterThan(report.goalCards[0].todayCorpus);
    });
});
