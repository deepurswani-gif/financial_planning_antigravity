import { calculateAge } from '../ProfileModule/ProfileLogic';
import { computeSIPProjection } from '../SummaryReport/MoneyStoryLogic';
import { calculateContingencyData, calculateProtectionData } from '../SummaryReport/SafetyNetLogic';
import { getEmergencyFundAmount } from '../DetailedFlow/wealthDetailSync';

const parseAmount = (value) => parseFloat(value) || 0;

const RECURRING_ALLOC_TYPES = [
    'SIP', 'PPF', 'NPS', 'Life Insurance', 'Term Insurance', 'Health Insurance',
    'Life Insurance Saving Plans', 'Recurring Deposit',
];

export function summarizeInvestmentAllocations(allocations = []) {
    const items = allocations
        .map((a) => {
            const rawAmount = parseAmount(a.amount);
            const isMonthly = RECURRING_ALLOC_TYPES.includes(a.type);
            // Studio / calculator rows store recurring amounts as annual totals.
            const monthlyAmount = isMonthly ? rawAmount / 12 : 0;
            return {
                id: a.id,
                type: a.type,
                name: a.name || a.type,
                amount: isMonthly ? monthlyAmount : rawAmount,
                isMonthly,
                annualImpact: isMonthly ? rawAmount : rawAmount,
                studioPlanKey: a.studioPlanKey || null,
                startMonth: a.startMonth || null,
                startYear: a.startYear || null,
            };
        })
        // Planned table is for committed/pending amounts only — never show ₹0 placeholders
        // (e.g. SIP avenue open-by-default must not appear until the user assigns a value).
        .filter((item) => Math.round(item.amount || 0) > 0);

    const monthlyCommitted = items
        .filter((i) => i.isMonthly)
        .reduce((sum, i) => sum + i.amount, 0);

    return { items, monthlyCommitted, count: items.length };
}

export function buildDeploymentSlices(monthlyFreeCash, protectionData, contingencyData = {}) {
    const monthly = Math.max(0, monthlyFreeCash);
    if (monthly <= 0) return [];

    const slices = [];
    let remaining = monthly;

    const emergencyGapMonthly = contingencyData?.gap > 0
        ? Math.ceil(contingencyData.gap / 12)
        : 0;
    const emergencySlice = Math.min(remaining, emergencyGapMonthly || (contingencyData?.isHealthy ? 0 : Math.round(monthly * 0.2)));
    if (emergencySlice > 0) {
        slices.push({ name: 'Emergency fund', value: Math.round(emergencySlice), fill: '#F59E0B' });
        remaining -= emergencySlice;
    }

    if (protectionData?.hasGap && remaining > 0) {
        // Prefer gap-driven premium estimate when available; else 20% of remaining
        const protectionSlice = Math.min(
            remaining,
            protectionData.suggestedMonthly > 0
                ? protectionData.suggestedMonthly
                : Math.round(remaining * 0.2),
        );
        slices.push({ name: 'Family protection', value: Math.round(protectionSlice), fill: '#6366F1' });
        remaining -= protectionSlice;
    }

    if (remaining > 0) {
        slices.push({ name: 'Wealth building', value: Math.round(remaining), fill: '#10B981' });
    }

    return slices;
}

export function buildInvestSurplusReport({
    moneyFlowReport,
    familyMembers = [],
    expenseCategories = {},
    assetCategories = {},
    contingencyFund = '',
    summaryLifeCover = '',
    investmentAllocations = [],
}) {
    if (!moneyFlowReport) {
        return { meta: { hasData: false } };
    }

    const { meta, ledger, totals, journeyLink, members } = moneyFlowReport;
    const selfMember = familyMembers.find((m) => m.relation?.toLowerCase() === 'self');
    const currentAge = selfMember?.dob ? calculateAge(selfMember.dob) : (selfMember?.age || 30);
    const retirementAge = parseInt(selfMember?.retirementAge, 10) || 60;
    const yearsToRetirement = Math.max(1, retirementAge - currentAge);

    const monthlyFreeCash = meta.currentMonth >= meta.planStartMonth
        ? (ledger.unallocatedSurplus[meta.currentMonth] || 0)
        : 0;

    const protectionData = calculateProtectionData(expenseCategories, summaryLifeCover, familyMembers);
    const contingencyData = calculateContingencyData(
        expenseCategories,
        getEmergencyFundAmount(assetCategories, contingencyFund),
        familyMembers,
    );

    const allocationsSummary = summarizeInvestmentAllocations(investmentAllocations);
    const deployableMonthly = Math.max(0, monthlyFreeCash - allocationsSummary.monthlyCommitted);

    const deploymentSlices = buildDeploymentSlices(deployableMonthly, protectionData, contingencyData);
    const wealthMonthly = deploymentSlices
        .find((s) => s.name === 'Wealth building')?.value || deployableMonthly;

    const sipProjection = computeSIPProjection(Math.max(0, wealthMonthly), 12, yearsToRetirement);

    const suggestions = [];

    if (wealthMonthly > 0) {
        suggestions.push({
            id: 'wealth-sip',
            title: 'Wealth building via SIP',
            description: `Direct ${formatInr(wealthMonthly)}/month into disciplined investments.`,
            highlight: formatInr(sipProjection.futureValue),
            highlightLabel: `could grow to by retirement (${yearsToRetirement} yrs at 12% p.a.)`,
            tone: 'primary',
        });
    }

    if (contingencyData.gap > 0) {
        suggestions.push({
            id: 'emergency-fund',
            title: 'Strengthen your emergency buffer',
            description: `Your fund covers ~${Math.round(contingencyData.monthsCoveredByFund * 10) / 10} months; ideal is ${contingencyData.contingencyPeriod} months.`,
            highlight: formatInr(contingencyData.gap),
            highlightLabel: 'gap to ideal emergency fund',
            tone: 'warning',
        });
    }

    if (protectionData.hasGap) {
        suggestions.push({
            id: 'protection',
            title: 'Close the protection gap',
            description: 'Life cover helps your family maintain lifestyle if income stops unexpectedly.',
            highlight: formatInr(protectionData.protectionGap),
            highlightLabel: 'additional cover suggested (HLV method)',
            tone: 'accent',
        });
    }

    return {
        meta: {
            hasData: true,
            calendarYear: meta.calendarYear,
            userName: members?.selfName?.split(' ')[0] || 'there',
            yearsToRetirement,
        },
        hero: {
            monthlyFreeCash,
            ytdUnallocated: totals.ytdUnallocated,
            proratedUnallocated: totals.proratedUnallocated,
            yearlyPotential: totals.fullYearUnallocated,
            journeyYearSurplus: journeyLink?.proratedNetInvestibleSurplus || 0,
            deployableMonthly,
        },
        allocationsSummary,
        deploymentSlices,
        sipProjection,
        suggestions,
        protectionData,
        contingencyData,
    };
}

function formatInr(value) {
    return `₹${Math.round(value || 0).toLocaleString('en-IN')}`;
}

export function computeInvestSurplusInsights(report) {
    if (!report.meta?.hasData) {
        return [{ id: 'no-data', text: 'Complete Your Money Flow to see surplus deployment options.', tone: 'warning' }];
    }

    const insights = [];
    const { hero, allocationsSummary, meta } = report;

    if (hero.monthlyFreeCash <= 0) {
        insights.push({
            id: 'no-surplus',
            text: 'No free cash flow this month — review expenses or income before allocating new investments.',
            tone: 'warning',
        });
        return insights;
    }

    insights.push({
        id: 'monthly-surplus',
        text: `You have ₹${Math.round(hero.monthlyFreeCash).toLocaleString('en-IN')}/month ready to deploy after savings.`,
        tone: 'positive',
    });

    if (hero.proratedUnallocated > 0) {
        insights.push({
            id: 'year-surplus',
            text: `~₹${Math.round(hero.proratedUnallocated).toLocaleString('en-IN')} unallocated surplus projected through year-end.`,
            tone: 'neutral',
        });
    }

    if (allocationsSummary.count > 0) {
        insights.push({
            id: 'existing-allocations',
            text: `${allocationsSummary.count} investment allocation${allocationsSummary.count > 1 ? 's' : ''} already planned (₹${Math.round(allocationsSummary.monthlyCommitted).toLocaleString('en-IN')}/month committed).`,
            tone: 'accent',
        });
    } else {
        insights.push({
            id: 'no-allocations',
            text: 'No investment allocations planned yet — use suggestions below or open the full allocation planner.',
            tone: 'accent',
        });
    }

    if (hero.deployableMonthly > 0 && meta.yearsToRetirement) {
        insights.push({
            id: 'retirement-horizon',
            text: `${meta.yearsToRetirement} years to retirement — consistent deployment now compounds over your full horizon.`,
            tone: 'neutral',
        });
    }

    return insights;
}

export function buildSipGrowthSeries(monthlyAmount, years, annualRate = 12) {
    if (monthlyAmount <= 0 || years <= 0) return [];
    const r = (annualRate / 100) / 12;
    const series = [];
    for (let y = 1; y <= years; y += Math.max(1, Math.floor(years / 12))) {
        const n = y * 12;
        const fv = monthlyAmount * (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
        series.push({ year: y, label: `Yr ${y}`, value: Math.round(fv), invested: monthlyAmount * n });
    }
    if (series[series.length - 1]?.year !== years) {
        const n = years * 12;
        const fv = monthlyAmount * (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
        series.push({ year: years, label: `Yr ${years}`, value: Math.round(fv), invested: monthlyAmount * n });
    }
    return series;
}
