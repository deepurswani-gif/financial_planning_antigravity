import { describe, it, expect } from 'vitest';
import {
    buildCurrentMonthWaterfall,
    buildMonthlyRhythmData,
    buildSavingsRateData,
    flattenGoalsForTimeline,
    buildIncomeVsOutflowSeries,
} from './reportVisualLogic';

describe('reportVisualLogic', () => {
    const meta = {
        planStartMonth: 3,
        currentMonth: 5,
        calendarYear: 2026,
    };

    const ledger = {
        adjustedIncome: Array(12).fill(100000),
        household: Array(12).fill(40000),
        emi: Array(12).fill(15000),
        insurance: Array(12).fill(5000),
        savings: Array(12).fill(20000),
        unallocatedSurplus: Array(12).fill(20000),
    };

    it('builds monthly rhythm with nulls before plan start', () => {
        const data = buildMonthlyRhythmData(ledger, meta);
        expect(data[2].income).toBeNull();
        expect(data[3].income).toBe(100000);
        expect(data[5].isCurrent).toBe(true);
        expect(data[5].outflow).toBe(80000);
    });

    it('builds waterfall steps for current month', () => {
        const steps = buildCurrentMonthWaterfall(ledger, meta);
        expect(steps[0].name).toBe('Income');
        expect(steps.some((s) => s.name === 'Free Cash')).toBe(true);
    });

    it('computes savings rate donut data', () => {
        const result = buildSavingsRateData({ monthlySavings: 20000 }, ledger, meta);
        expect(result.rate).toBe(20);
        expect(result.chartData[0].value).toBe(20);
    });

    it('positions goals on timeline strip', () => {
        const nodes = flattenGoalsForTimeline(
            { 2030: [{ id: 'car', name: 'Car', futureCost: 800000 }] },
            2026,
            2046,
        );
        expect(nodes).toHaveLength(1);
        expect(nodes[0].targetYear).toBe(2030);
        expect(nodes[0].positionPct).toBeGreaterThan(0);
    });

    it('builds income vs outflow series from projections', () => {
        const series = buildIncomeVsOutflowSeries([
            { year: 2027, netInflowAfterTax: 1200000, totalOutflow: 900000 },
        ]);
        expect(series[0].netInflow).toBe(1200000);
        expect(series[0].totalOutflow).toBe(900000);
    });
});
