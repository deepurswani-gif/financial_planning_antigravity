import { calculateCashFlow } from '../CashFlowModule/CashFlowLogic';
import { calculateProtectionData, calculateContingencyData, calculateHealthInsuranceData } from './SafetyNetLogic';
import { buildFutureSelfReport, buildGoalReadiness } from './FutureSelfLogic';
import { getEmergencyFundAmount } from '../DetailedFlow/wealthDetailSync';

const SCORE_BANDS = {
    overall: [
        { min: 81, label: 'Financially Resilient' },
        { min: 61, label: 'Strong' },
        { min: 41, label: 'Stable' },
        { min: 21, label: 'Developing' },
        { min: 0, label: 'Vulnerable' }
    ],
    pillar: [
        { min: 16, label: 'Strong' },
        { min: 11, label: 'Progressing' },
        { min: 6, label: 'Needs Attention' },
        { min: 0, label: 'Critical' }
    ]
};

const toNum = (value) => parseFloat(value) || 0;
const toLakh = (amount) => toNum(amount) / 100000;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const pickOverallBand = (score) => SCORE_BANDS.overall.find((band) => score >= band.min) || SCORE_BANDS.overall.at(-1);
const pickPillarBand = (score) => SCORE_BANDS.pillar.find((band) => score >= band.min) || SCORE_BANDS.pillar.at(-1);

const scoreSurplusRatio = (ratio) => {
    if (ratio < 0.05) return 0;
    if (ratio < 0.1) return 5;
    if (ratio < 0.2) return 10;
    if (ratio < 0.3) return 15;
    return 20;
};

const scoreEmergencyMonths = (months) => {
    if (months < 1) return 0;
    if (months < 3) return 5;
    if (months < 6) return 10;
    if (months < 9) return 15;
    return 20;
};

const scoreLifeRatio = (ratio) => {
    if (ratio < 0.25) return 0;
    if (ratio < 0.5) return 5;
    if (ratio < 0.75) return 8;
    return 10;
};

const scoreHealthCover = (coverLakh) => {
    if (coverLakh <= 0) return 0;
    if (coverLakh < 5) return 2;
    if (coverLakh < 10) return 5;
    if (coverLakh <= 20) return 8;
    return 10;
};

const scoreInvestmentRatio = (ratio) => {
    if (ratio < 0.05) return 0;
    if (ratio < 0.1) return 5;
    if (ratio < 0.15) return 10;
    if (ratio < 0.2) return 15;
    return 20;
};

const scoreGoalCoverage = (coveragePct) => {
    if (coveragePct < 25) return 0;
    if (coveragePct < 50) return 5;
    if (coveragePct < 75) return 10;
    if (coveragePct <= 100) return 15;
    return 20;
};

const buildDailyInterpretation = (score) => {
    if (score <= 5) return 'Your monthly finances feel stretched, leaving very little room for sudden shocks.';
    if (score <= 10) return 'You have some breathing space, but recurring pressure can still disrupt your plans.';
    if (score <= 15) return 'Your day-to-day cash flow is reasonably healthy and supports better financial control.';
    return 'You have strong monthly flexibility, which gives your family confidence and decision power.';
};

const buildEmergencyInterpretation = (score) => {
    if (score <= 5) return 'A prolonged income interruption could quickly put your household under stress.';
    if (score <= 10) return 'You have a basic cushion, but longer uncertainty can still create financial anxiety.';
    if (score <= 15) return 'Your emergency reserves can absorb short-to-medium shocks with manageable pressure.';
    return 'Your emergency buffer is strong and gives your family meaningful resilience in uncertain times.';
};

const buildFamilyInterpretation = (score) => {
    if (score <= 5) return 'Protection gaps are significant, and your family could face serious financial strain during a crisis.';
    if (score <= 10) return 'Some protection is in place, but key risks still remain uncovered.';
    if (score <= 15) return 'Your family has a fair protection base, though important coverage gaps should be closed.';
    return 'Life and health protection are strong, helping secure your family through major uncertainties.';
};

const buildWealthInterpretation = (score) => {
    if (score <= 5) return 'A small portion of income is currently compounding for your future wealth.';
    if (score <= 10) return 'Your investing habit has started, but scale is still below long-term potential.';
    if (score <= 15) return 'You are steadily converting income into future wealth through disciplined investments.';
    return 'Your wealth-building discipline is strong and creates a powerful compounding runway.';
};

const buildGoalsInterpretation = (score) => {
    if (score <= 5) return 'Most goals are currently underfunded, so timelines may feel uncertain.';
    if (score <= 10) return 'You are making progress, but goal funding still needs stronger momentum.';
    if (score <= 15) return 'Most goals are on track, with only moderate shortfalls to address.';
    return 'Your goals are strongly funded and your future plans are in a confident position.';
};

const buildOverallNarrative = ({ score, category, topPillars, bottomPillars }) => {
    const strongest = topPillars.map((p) => p.shortName).join(', ');
    const weakAreas = bottomPillars.map((p) => p.shortName).join(', ');

    if (score <= 40) {
        return `Your Financial Readiness Score is ${score}/100 (${category}). This is an important moment to pause and protect your family's stability. Start by improving ${weakAreas}, and you can create a much safer foundation over the next few months.`;
    }
    if (score <= 60) {
        return `Your Financial Readiness Score is ${score}/100 (${category}). You already have a base to build on, especially in ${strongest}. Strengthening ${weakAreas} now can meaningfully improve your family's confidence and long-term resilience.`;
    }
    return `Your Financial Readiness Score is ${score}/100 (${category}). Your financial base is strong, with clear strength in ${strongest}. By continuing to improve ${weakAreas}, you can move closer to lasting financial resilience and peace of mind.`;
};

const buildWeightedConfidence = ({ monthlyIncome, monthlyNeed, coverageRequired, goalsCount, healthCover }) => {
    const pillarCompleteness = {
        'daily-stability': monthlyIncome > 0 ? 1 : 0,
        emergency: monthlyNeed > 0 ? 1 : 0,
        'family-protection': (coverageRequired > 0 ? 0.6 : 0) + (healthCover > 0 ? 0.4 : 0),
        'wealth-building': monthlyIncome > 0 ? 1 : 0,
        'goal-readiness': goalsCount > 0 ? 1 : 0
    };

    const weights = {
        'daily-stability': 20,
        emergency: 20,
        'family-protection': 20,
        'wealth-building': 20,
        'goal-readiness': 20
    };

    const weightedScore = Object.entries(weights).reduce((sum, [pillar, weight]) => {
        return sum + ((pillarCompleteness[pillar] || 0) * weight);
    }, 0);

    const confidencePct = Math.round(weightedScore);
    const confidenceBand = confidencePct >= 85
        ? 'High confidence'
        : confidencePct >= 60
            ? 'Moderate confidence'
            : 'Low confidence';

    return {
        confidencePct,
        confidenceBand,
        pillarCompleteness
    };
};

const buildRoadmap = (pillars) => {
    const lowPillars = [...pillars].sort((a, b) => a.score - b.score).slice(0, 3);
    const roadmap = {
        '30-day': [],
        '90-day': [],
        '1-year': []
    };

    lowPillars.forEach((pillar) => {
        if (pillar.id === 'daily-stability') {
            roadmap['30-day'].push('Track discretionary spending weekly and trim high-leak categories.');
            roadmap['90-day'].push('Reduce one high-cost EMI or recurring expense to improve monthly surplus.');
            roadmap['1-year'].push('Maintain a consistent surplus ratio above 20% for sustained flexibility.');
        }
        if (pillar.id === 'emergency') {
            roadmap['30-day'].push('Start a dedicated emergency account with automatic monthly transfers.');
            roadmap['90-day'].push('Build emergency reserves toward at least 3 months of expenses.');
            roadmap['1-year'].push('Reach and maintain a 6+ month emergency buffer.');
        }
        if (pillar.id === 'family-protection') {
            roadmap['30-day'].push('Review life and health coverage gaps for all key family members.');
            roadmap['90-day'].push('Close high-priority protection gaps with suitable term and health cover.');
            roadmap['1-year'].push('Re-evaluate protection needs after major life events and income changes.');
        }
        if (pillar.id === 'wealth-building') {
            roadmap['30-day'].push('Increase SIP allocation from surplus with an automated monthly schedule.');
            roadmap['90-day'].push('Target a stable investing ratio above 10% of monthly income.');
            roadmap['1-year'].push('Progressively increase wealth allocation to 15-20% as income grows.');
        }
        if (pillar.id === 'goal-readiness') {
            roadmap['30-day'].push('Prioritize top goals and review current funding shortfalls.');
            roadmap['90-day'].push('Assign incremental monthly contributions to underfunded goals.');
            roadmap['1-year'].push('Rebalance goal funding plan annually to stay timeline-aligned.');
        }
    });

    return roadmap;
};

const buildUpliftOpportunities = ({
    monthlyIncome,
    emergencyCoverageMonths,
    surplusRatio,
    wealthRatio,
    lifeCoverageRatio,
    healthCoverLakh,
    goalsAvgCoveragePct,
    dailyScore,
    emergencyScore,
    familyScore,
    wealthScore,
    goalScore
}) => {
    const opportunities = [];

    const targetEmergencyMonths = 6;
    const improvedEmergency = scoreEmergencyMonths(targetEmergencyMonths);
    if (improvedEmergency > emergencyScore) {
        opportunities.push({
            key: 'emergency-6m',
            label: 'Build emergency fund to 6 months',
            uplift: improvedEmergency - emergencyScore,
            targetValue: `${targetEmergencyMonths} months`,
            currentValue: `${(Math.round(emergencyCoverageMonths * 10) / 10).toFixed(1)} months`
        });
    }

    const targetWealthRatio = Math.max(0.15, wealthRatio);
    const improvedWealth = scoreInvestmentRatio(targetWealthRatio);
    if (improvedWealth > wealthScore && monthlyIncome > 0) {
        opportunities.push({
            key: 'wealth-15',
            label: 'Increase investment ratio to 15%',
            uplift: improvedWealth - wealthScore,
            targetValue: '15%',
            currentValue: `${Math.round(wealthRatio * 100)}%`
        });
    }

    const targetDailyRatio = Math.max(0.2, surplusRatio);
    const improvedDaily = scoreSurplusRatio(targetDailyRatio);
    if (improvedDaily > dailyScore && monthlyIncome > 0) {
        opportunities.push({
            key: 'daily-20',
            label: 'Improve surplus ratio to 20%',
            uplift: improvedDaily - dailyScore,
            targetValue: '20%',
            currentValue: `${Math.round(surplusRatio * 100)}%`
        });
    }

    const improvedLife = scoreLifeRatio(Math.max(0.75, lifeCoverageRatio));
    const improvedHealth = scoreHealthCover(Math.max(10, healthCoverLakh));
    const improvedFamily = Math.min(20, improvedLife + improvedHealth);
    if (improvedFamily > familyScore) {
        opportunities.push({
            key: 'family-coverage',
            label: 'Lift life coverage to 75% and health cover to 10L',
            uplift: improvedFamily - familyScore,
            targetValue: 'Life 75%, Health 10L',
            currentValue: `Life ${Math.round(lifeCoverageRatio * 100)}%, Health ${Math.round(healthCoverLakh)}L`
        });
    }

    const improvedGoal = scoreGoalCoverage(Math.max(75, goalsAvgCoveragePct));
    if (improvedGoal > goalScore) {
        opportunities.push({
            key: 'goals-75',
            label: 'Raise average goal readiness to 75%',
            uplift: improvedGoal - goalScore,
            targetValue: '75%',
            currentValue: `${Math.round(goalsAvgCoveragePct)}%`
        });
    }

    return opportunities.sort((a, b) => b.uplift - a.uplift).slice(0, 4);
};

export const buildWhatIfScenario = (baseReport, scenarioInput) => {
    const {
        emergencyMonths,
        investmentRatioPct,
        surplusRatioPct,
        lifeCoverageRatioPct,
        healthCoverLakh,
        goalReadinessPct
    } = scenarioInput;

    const nextPillars = baseReport.pillars.map((pillar) => {
        if (pillar.id === 'daily-stability') {
            const nextScore = scoreSurplusRatio(clamp((surplusRatioPct || 0) / 100, 0, 5));
            return { ...pillar, score: nextScore };
        }
        if (pillar.id === 'emergency') {
            const nextScore = scoreEmergencyMonths(clamp(emergencyMonths || 0, 0, 24));
            return { ...pillar, score: nextScore };
        }
        if (pillar.id === 'family-protection') {
            const life = scoreLifeRatio(clamp((lifeCoverageRatioPct || 0) / 100, 0, 5));
            const health = scoreHealthCover(clamp(healthCoverLakh || 0, 0, 100));
            return { ...pillar, score: Math.min(20, life + health) };
        }
        if (pillar.id === 'wealth-building') {
            const nextScore = scoreInvestmentRatio(clamp((investmentRatioPct || 0) / 100, 0, 5));
            return { ...pillar, score: nextScore };
        }
        if (pillar.id === 'goal-readiness') {
            const nextScore = scoreGoalCoverage(clamp(goalReadinessPct || 0, 0, 400));
            return { ...pillar, score: nextScore };
        }
        return pillar;
    });

    const nextTotal = nextPillars.reduce((sum, pillar) => sum + pillar.score, 0);
    const nextCategory = pickOverallBand(nextTotal).label;

    return {
        nextTotal,
        nextCategory,
        uplift: nextTotal - baseReport.totalScore
    };
};

export const buildExecutiveSummaryReport = ({
    income,
    expenseCategories,
    assetCategories,
    summaryLifeCover,
    summaryHealthCover,
    contingencyFund,
    goals,
    inflationRates,
    familyMembers = [],
    hasSpouseIncome,
    policies = [],
    hasHealthInsurance = null,
    liabilityCategories = {},
    calculatorInputs = {}
}) => {
    const cashFlow = calculateCashFlow(income, expenseCategories, familyMembers, hasSpouseIncome);
    const protectionData = calculateProtectionData(
        expenseCategories,
        summaryLifeCover,
        familyMembers,
        policies,
        income,
        inflationRates,
        calculatorInputs,
        goals,
        assetCategories,
        liabilityCategories
    );
    const emergencyCash = getEmergencyFundAmount(assetCategories, contingencyFund);
    const contingencyData = calculateContingencyData(expenseCategories, emergencyCash, familyMembers);
    const healthData = calculateHealthInsuranceData(
        summaryHealthCover,
        hasHealthInsurance,
        familyMembers,
        policies,
    );
    const futureSelfReport = buildFutureSelfReport({
        goals,
        cashFlowResults: cashFlow,
        expenseCategories,
        inflationRates
    });

    const monthlyIncome = cashFlow.totalIncome;
    const monthlyExpenses = cashFlow.categorySums?.household || 0;
    const monthlyEmi = cashFlow.categorySums?.emi || 0;
    const monthlyInvestments = cashFlow.totalSavings || 0;
    const monthlySurplus = cashFlow.surplus;
    const surplusRatio = monthlyIncome > 0 ? monthlySurplus / monthlyIncome : 0;
    const dailyScore = monthlyIncome > 0 ? scoreSurplusRatio(Math.max(0, surplusRatio)) : 0;

    const emergencyCoverageMonths = contingencyData.monthsCoveredByFund || 0;
    const emergencyScore = contingencyData.monthlyNeed > 0 ? scoreEmergencyMonths(emergencyCoverageMonths) : 0;

    const lifeCoverageRatio = protectionData.coverageRequired > 0
        ? protectionData.coverageHave / protectionData.coverageRequired
        : 0;
    const lifeScore = protectionData.coverageRequired > 0 ? scoreLifeRatio(Math.max(0, lifeCoverageRatio)) : 0;
    const healthCoverLakh = toLakh(healthData.coverageHave);
    const healthScore = scoreHealthCover(healthCoverLakh);
    const familyScore = Math.min(20, lifeScore + healthScore);

    const wealthRatio = monthlyIncome > 0 ? monthlyInvestments / monthlyIncome : 0;
    const wealthScore = monthlyIncome > 0 ? scoreInvestmentRatio(Math.max(0, wealthRatio)) : 0;

    const goalReadinessRows = futureSelfReport.enrichedGoals.map((goal) =>
        buildGoalReadiness(goal, futureSelfReport.cashSnapshot, inflationRates)
    );
    const goalScores = goalReadinessRows.map((goal) => scoreGoalCoverage(goal.coveragePercent || 0));
    const averageGoalCoveragePct = goalReadinessRows.length
        ? goalReadinessRows.reduce((sum, goal) => sum + (goal.coveragePercent || 0), 0) / goalReadinessRows.length
        : 0;
    const goalScore = goalScores.length
        ? Math.round(goalScores.reduce((sum, s) => sum + s, 0) / goalScores.length)
        : 0;

    const pillars = [
        {
            id: 'daily-stability',
            name: 'Daily Financial Stability',
            shortName: 'daily stability',
            icon: 'wallet',
            score: dailyScore,
            metricLabel: 'Surplus ratio',
            metricValue: `${Math.round(Math.max(0, surplusRatio) * 100)}%`,
            interpretation: buildDailyInterpretation(dailyScore),
            dataNote: monthlyIncome <= 0 ? 'Scored conservatively due to missing income data.' : ''
        },
        {
            id: 'emergency',
            name: 'Emergency Preparedness',
            shortName: 'emergency readiness',
            icon: 'shield',
            score: emergencyScore,
            metricLabel: 'Coverage',
            metricValue: `${(Math.round(emergencyCoverageMonths * 10) / 10).toFixed(1)} months`,
            interpretation: buildEmergencyInterpretation(emergencyScore),
            dataNote: contingencyData.monthlyNeed <= 0 ? 'Scored conservatively due to missing expense data.' : ''
        },
        {
            id: 'family-protection',
            name: 'Family Protection',
            shortName: 'family protection',
            icon: 'heart',
            score: familyScore,
            metricLabel: 'Life + Health',
            metricValue: `${lifeScore}/10 + ${healthScore}/10`,
            interpretation: buildFamilyInterpretation(familyScore),
            dataNote: protectionData.coverageRequired <= 0 ? 'Life score kept conservative due to limited expense inputs.' : ''
        },
        {
            id: 'wealth-building',
            name: 'Wealth Building Capacity',
            shortName: 'wealth building',
            icon: 'trending-up',
            score: wealthScore,
            metricLabel: 'Investment ratio',
            metricValue: `${Math.round(Math.max(0, wealthRatio) * 100)}%`,
            interpretation: buildWealthInterpretation(wealthScore),
            dataNote: monthlyIncome <= 0 ? 'Scored conservatively due to missing income data.' : ''
        },
        {
            id: 'goal-readiness',
            name: 'Goal Readiness',
            shortName: 'goal readiness',
            icon: 'target',
            score: goalScore,
            metricLabel: 'Average goal score',
            metricValue: goalReadinessRows.length ? `${goalReadinessRows.length} goal(s)` : 'No goals',
            interpretation: buildGoalsInterpretation(goalScore),
            dataNote: goalReadinessRows.length === 0 ? 'Scored conservatively because goal data is unavailable.' : ''
        }
    ].map((pillar) => ({ ...pillar, band: pickPillarBand(pillar.score).label }));

    const totalScore = pillars.reduce((sum, pillar) => sum + pillar.score, 0);
    const overallBand = pickOverallBand(totalScore);
    const ranked = [...pillars].sort((a, b) => b.score - a.score);
    const topPillars = ranked.slice(0, 2);
    const bottomPillars = [...ranked].reverse().slice(0, 3);

    const actionPriorities = [...pillars]
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
        .map((pillar) => {
            if (pillar.id === 'daily-stability') {
                return 'Improve monthly surplus by reducing avoidable expenses or high-cost EMIs.';
            }
            if (pillar.id === 'emergency') {
                return 'Build liquid emergency reserves toward at least 6 months of expenses and EMIs.';
            }
            if (pillar.id === 'family-protection') {
                return 'Close life and health coverage gaps to protect your family against major risks.';
            }
            if (pillar.id === 'wealth-building') {
                return 'Increase monthly SIPs and disciplined investments to improve wealth conversion.';
            }
            return 'Review each goal plan and increase funding pace for underprepared goals.';
        });

    const confidence = buildWeightedConfidence({
        monthlyIncome,
        monthlyNeed: contingencyData.monthlyNeed,
        coverageRequired: protectionData.coverageRequired,
        goalsCount: goalReadinessRows.length,
        healthCover: toNum(healthData.coverageHave)
    });

    const roadmap = buildRoadmap(pillars);
    const upliftOpportunities = buildUpliftOpportunities({
        monthlyIncome,
        emergencyCoverageMonths,
        surplusRatio: Math.max(0, surplusRatio),
        wealthRatio: Math.max(0, wealthRatio),
        lifeCoverageRatio: Math.max(0, lifeCoverageRatio),
        healthCoverLakh,
        goalsAvgCoveragePct: averageGoalCoveragePct,
        dailyScore,
        emergencyScore,
        familyScore,
        wealthScore,
        goalScore
    });

    return {
        totalScore,
        overallCategory: overallBand.label,
        pillars,
        actionPriorities,
        confidence,
        roadmap,
        upliftOpportunities,
        baseMetrics: {
            emergencyMonths: Math.round(emergencyCoverageMonths * 10) / 10,
            investmentRatioPct: Math.round(Math.max(0, wealthRatio) * 100),
            surplusRatioPct: Math.round(Math.max(0, surplusRatio) * 100),
            lifeCoverageRatioPct: Math.round(Math.max(0, lifeCoverageRatio) * 100),
            healthCoverLakh: Math.round(healthCoverLakh),
            goalReadinessPct: Math.round(averageGoalCoveragePct)
        },
        narrative: buildOverallNarrative({
            score: totalScore,
            category: overallBand.label,
            topPillars,
            bottomPillars
        })
    };
};
