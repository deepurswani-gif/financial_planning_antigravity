import { MONTH_LABELS_SHORT } from './moneyFlowLedgerLogic';

export const formatChartCompact = (amount) => {
    const abs = Math.abs(amount || 0);
    if (abs >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
    if (abs >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (abs >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
    return `₹${Math.round(amount || 0)}`;
};

export function buildMonthlyRhythmData(ledger, meta) {
    const { planStartMonth, currentMonth } = meta;
    return MONTH_LABELS_SHORT.map((label, idx) => {
        if (idx < planStartMonth) {
            return {
                label,
                monthIndex: idx,
                income: null,
                outflow: null,
                freeCashFlow: null,
                isCurrent: idx === currentMonth,
            };
        }
        const income = ledger.adjustedIncome[idx] || 0;
        const outflow = (ledger.household[idx] || 0)
            + (ledger.emi[idx] || 0)
            + (ledger.insurance[idx] || 0)
            + (ledger.savings[idx] || 0);
        return {
            label,
            monthIndex: idx,
            income,
            outflow,
            freeCashFlow: ledger.unallocatedSurplus[idx] || 0,
            isCurrent: idx === currentMonth,
        };
    });
}

export function buildCurrentMonthWaterfall(ledger, meta) {
    const monthIdx = meta.currentMonth >= meta.planStartMonth
        ? meta.currentMonth
        : meta.planStartMonth;
    const income = ledger.adjustedIncome[monthIdx] || 0;
    const household = ledger.household[monthIdx] || 0;
    const emi = ledger.emi[monthIdx] || 0;
    const insurance = ledger.insurance[monthIdx] || 0;
    const savings = ledger.savings[monthIdx] || 0;
    const living = household + insurance;

    return [
        { name: 'Income', value: income, fill: '#10B981', base: 0 },
        { name: 'Living', value: living, fill: '#EF4444', base: income - living },
        { name: 'EMIs', value: emi, fill: '#F59E0B', base: income - living - emi },
        { name: 'Savings', value: savings, fill: '#6366F1', base: income - living - emi - savings },
        {
            name: 'Free Cash',
            value: Math.max(0, ledger.unallocatedSurplus[monthIdx] || 0),
            fill: '#7C3AED',
            base: 0,
        },
    ].filter((step) => step.value > 0 || step.name === 'Income');
}

export function buildSavingsRateData(baseline, ledger, meta) {
    const monthIdx = meta.currentMonth >= meta.planStartMonth
        ? meta.currentMonth
        : meta.planStartMonth;
    const income = ledger.adjustedIncome[monthIdx] || 0;
    const savings = ledger.savings[monthIdx] || baseline.monthlySavings || 0;
    if (income <= 0) {
        return { rate: 0, chartData: [{ name: 'Savings', value: 0 }, { name: 'Other', value: 100 }] };
    }
    const rate = Math.round((savings / income) * 100);
    return {
        rate,
        chartData: [
            { name: 'Savings', value: rate, fill: '#6366F1' },
            { name: 'Other', value: 100 - rate, fill: '#E2E8F0' },
        ],
    };
}

export function flattenGoalsForTimeline(goalsByYear, startYear, endYear) {
    if (!endYear || endYear <= startYear) return [];
    const span = endYear - startYear;
    return Object.entries(goalsByYear)
        .flatMap(([year, yearGoals]) => yearGoals.map((goal) => ({
            ...goal,
            targetYear: parseInt(year, 10),
            positionPct: Math.min(98, Math.max(2, ((parseInt(year, 10) - startYear) / span) * 100)),
        })))
        .sort((a, b) => a.targetYear - b.targetYear);
}

export function buildJourneyArcMeta(hero, meta) {
    if (!hero || !meta.retirementYear) return null;
    const progressPct = hero.retirementAge > 0
        ? Math.min(100, Math.max(0, (hero.currentAge / hero.retirementAge) * 100))
        : 0;
    return {
        birthYear: hero.birthYear,
        currentYear: meta.currentYear,
        endYear: meta.retirementYear,
        progressPct,
    };
}

export function buildIncomeVsOutflowSeries(projections) {
    return projections.map((row) => ({
        year: row.year,
        label: String(row.year),
        netInflow: row.netInflowAfterTax,
        totalOutflow: row.totalOutflow,
    }));
}

export function buildSurplusRiverSeries(projections) {
    return projections.map((row) => ({
        year: row.year,
        label: String(row.year),
        surplus: row.netInvestibleSurplus,
    }));
}
