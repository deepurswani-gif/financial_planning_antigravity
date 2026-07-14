import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { getActiveGoals } from '../DetailedFlow/goalsDetailSync';
import { calculateFutureCost } from '../GoalModule/GoalLogic';
import { calculateAge, calculateRetirementYear } from '../ProfileModule/ProfileLogic';

export const JOURNEY_TABLE_ROWS = [
    { key: 'annualInflow', label: 'Annual Inflows', sign: '(+)', role: 'detail' },
    { key: 'approxTax', label: 'Tax Adjustment', sign: '(±)', role: 'detail', highlightNonZero: true },
    { key: 'netInflowAfterTax', label: 'Net Inflow (After Tax)', sign: '(=)', role: 'subtotal' },
    { key: 'totalOutflow', label: 'Total Outflow', sign: '(−)', role: 'detail', breakdown: 'outflow' },
    { key: 'surplusBeforeSaving', label: 'Surplus (Pre-Saving)', sign: '(=)', role: 'subtotal' },
    { key: 'savingsAndInvestments', label: 'Savings & Investments', sign: '(−)', role: 'detail', breakdown: 'savings' },
    { key: 'netInvestibleSurplus', label: 'Net Investible Surplus', sign: '(=)', role: 'result' },
];

const formatInsightCurrency = (value) => formatCurrency(Math.round(value || 0));

export function getGoalTargetYear(goal, currentYear = new Date().getFullYear()) {
    const years = parseFloat(goal?.yearsToGoal);
    if (!years || years <= 0) return null;
    return currentYear + Math.round(years);
}

export function mapGoalsByYear(goals = [], currentYear = new Date().getFullYear()) {
    const byYear = {};
    goals.forEach((goal) => {
        const targetYear = getGoalTargetYear(goal, currentYear);
        if (!targetYear) return;

        const futureCost = goal.totalCourseCost
            ? Math.round(parseFloat(goal.totalCourseCost) || 0)
            : calculateFutureCost(goal.presentValue, goal.yearsToGoal, goal.inflationRate);

        if (!byYear[targetYear]) byYear[targetYear] = [];
        byYear[targetYear].push({
            id: goal.id,
            name: goal.name,
            targetYear,
            futureCost,
        });
    });
    return byYear;
}

export function buildLifeJourneyReport({
    familyMembers = [],
    journeyProjections = [],
    goals = [],
    inflationRates = {},
}) {
    const currentYear = new Date().getFullYear();
    const selfMember = familyMembers.find((m) => m.relation?.toLowerCase() === 'self');

    if (!selfMember?.dob) {
        return {
            meta: { hasProfile: false, currentYear },
            hero: null,
            projections: [],
            years: [],
            goalsByYear: {},
        };
    }

    const currentAge = calculateAge(selfMember.dob);
    const birthYear = new Date(selfMember.dob).getFullYear();
    const retirementAge = parseInt(selfMember.retirementAge, 10) || 60;
    const retirementYear = calculateRetirementYear(selfMember.dob, retirementAge);
    const yearsToGoldenPeriod = Math.max(0, retirementAge - currentAge);

    const projections = journeyProjections.filter(
        (p) => p.year > currentYear && retirementYear && p.year <= retirementYear,
    );

    // Only configured goals (years + amount) — matches Dreams & Goals review.
    const goalsByYear = mapGoalsByYear(getActiveGoals(goals), currentYear);
    const latestGoalYear = Object.keys(goalsByYear).reduce(
        (max, year) => Math.max(max, parseInt(year, 10) || 0),
        0,
    );
    const constellationEndYear = Math.max(retirementYear || 0, latestGoalYear);

    return {
        meta: {
            hasProfile: true,
            currentYear,
            retirementYear,
            constellationEndYear: constellationEndYear || retirementYear,
            inflationRates,
        },
        hero: {
            currentAge,
            birthYear,
            retirementAge,
            yearsToGoldenPeriod,
            retirementYear,
        },
        projections,
        years: projections.map((p) => p.year),
        goalsByYear,
    };
}

export function computeLifeJourneyInsights(report) {
    const { meta, hero, projections, goalsByYear } = report;
    const insights = [];

    if (!meta.hasProfile) {
        insights.push({
            id: 'no-profile',
            text: 'Complete your profile to see your life journey projection.',
            tone: 'warning',
        });
        return insights;
    }

    if (!projections.length) {
        insights.push({
            id: 'no-projections',
            text: 'Unable to build yearly projections — check your retirement age and profile details.',
            tone: 'warning',
        });
        return insights;
    }

    insights.push({
        id: 'golden-period',
        text: `${hero.yearsToGoldenPeriod} years remain until your Golden Period at age ${hero.retirementAge}.`,
        tone: 'neutral',
    });

    const deficitYears = projections.filter(
        (p) => p.yearHasDeficit || p.netInvestibleSurplus < 0,
    );
    if (deficitYears.length > 0) {
        insights.push({
            id: 'deficit-years',
            text: `${deficitYears.length} year${deficitYears.length > 1 ? 's' : ''} show a negative investible surplus — review planned expenses in those years.`,
            tone: 'warning',
        });
    } else {
        insights.push({
            id: 'surplus-positive',
            text: 'All projected years through retirement show a non-negative investible surplus.',
            tone: 'positive',
        });
    }

    const peak = projections.reduce(
        (best, p) => (p.netInvestibleSurplus > (best?.netInvestibleSurplus ?? -Infinity) ? p : best),
        null,
    );
    if (peak && peak.netInvestibleSurplus > 0) {
        insights.push({
            id: 'peak-surplus',
            text: `Peak investible surplus of ${formatInsightCurrency(peak.netInvestibleSurplus)} projected in ${peak.year}.`,
            tone: 'positive',
        });
    }

    const nextFiveEnd = meta.currentYear + 5;
    let nearTermGoalCount = 0;
    Object.entries(goalsByYear).forEach(([year, yearGoals]) => {
        const y = parseInt(year, 10);
        if (y > meta.currentYear && y <= nextFiveEnd) {
            nearTermGoalCount += yearGoals.length;
        }
    });
    if (nearTermGoalCount > 0) {
        insights.push({
            id: 'near-term-goals',
            text: `${nearTermGoalCount} life goal${nearTermGoalCount > 1 ? 's' : ''} planned in the next 5 years.`,
            tone: 'accent',
        });
    }

    const ir = meta.inflationRates || {};
    insights.push({
        id: 'growth-assumptions',
        text: `Projections assume ${ir.incomeIncrement ?? 10}% income growth, ${ir.householdInflation ?? 6}% household expense growth, and ${ir.educationInflation ?? 8}% education cost growth.`,
        tone: 'neutral',
    });

    return insights;
}
