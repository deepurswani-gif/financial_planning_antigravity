import React, { useMemo } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Award, Map, TrendingUp, Waves } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { getGoalIcon } from '../DetailedFlow/goalIcons';
import ReportReveal from './ReportReveal';
import {
    buildIncomeVsOutflowSeries,
    buildJourneyArcMeta,
    buildSurplusRiverSeries,
    flattenGoalsForTimeline,
    formatChartCompact,
} from './reportVisualLogic';

const ChartTooltip = ({ active, payload, labelKey = 'label' }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    return (
        <div className="dr-chart-tooltip">
            <div className="dr-chart-tooltip-label">{data?.[labelKey]}</div>
            {payload.map((entry) => (
                <div key={entry.name}>
                    {entry.name}: {formatCurrency(entry.value)}
                </div>
            ))}
        </div>
    );
};

const LifeJourneyVisuals = ({ report }) => {
    const { meta, hero, projections, goalsByYear } = report;
    const hasGoals = Object.keys(goalsByYear).length > 0;

    const constellationEndYear = meta.constellationEndYear
        || meta.retirementYear
        || meta.currentYear + 20;

    const timelineGoals = useMemo(
        () => flattenGoalsForTimeline(
            goalsByYear,
            meta.currentYear,
            constellationEndYear,
        ),
        [goalsByYear, meta.currentYear, constellationEndYear],
    );

    const arcMeta = useMemo(() => buildJourneyArcMeta(hero, meta), [hero, meta]);
    const incomeSeries = useMemo(() => buildIncomeVsOutflowSeries(projections), [projections]);
    const surplusSeries = useMemo(() => buildSurplusRiverSeries(projections), [projections]);

    if (!meta.hasProfile || !projections.length) return null;

    return (
        <div className="lj-visuals">
            {arcMeta && (
                <ReportReveal className="lj-visual-card card" delay={60}>
                    <h3 className="dr-chart-title">
                        <Map size={18} />
                        Your journey arc
                    </h3>
                    <p className="dr-chart-sub">
                        From today to your Golden Period at age {hero.retirementAge}.
                    </p>
                    <div className="lj-arc-track">
                        <div
                            className="lj-arc-fill"
                            style={{ width: `${arcMeta.progressPct}%` }}
                        />
                        <div
                            className="lj-arc-marker lj-arc-today"
                            style={{ left: `${Math.min(arcMeta.progressPct, 96)}%` }}
                        >
                            <span>Today · {hero.currentAge} yrs</span>
                            <strong>{arcMeta.currentYear}</strong>
                        </div>
                        <div className="lj-arc-marker lj-arc-golden">
                            <span>Golden Period</span>
                            <strong>{hero.retirementAge} yrs</strong>
                        </div>
                    </div>
                    <div className="lj-arc-axis">
                        <span>{arcMeta.birthYear}</span>
                        <span>{meta.retirementYear}</span>
                    </div>
                </ReportReveal>
            )}

            {hasGoals && timelineGoals.length > 0 && (
                <ReportReveal className="lj-visual-card card" delay={120}>
                    <h3 className="dr-chart-title">
                        <Award size={18} />
                        Goal constellation
                    </h3>
                    <p className="dr-chart-sub">
                        {timelineGoals.length} life goal{timelineGoals.length === 1 ? '' : 's'} in order — soonest first.
                    </p>
                    <ol className="lj-goal-timeline">
                        {timelineGoals.map((goal, index) => {
                            const Icon = getGoalIcon(goal);
                            const yearsAway = goal.targetYear - meta.currentYear;
                            const showYear = index === 0 || timelineGoals[index - 1].targetYear !== goal.targetYear;
                            return (
                                <li key={goal.id} className="lj-goal-row">
                                    <div className="lj-goal-year-col">
                                        {showYear ? (
                                            <span className="lj-goal-year">{goal.targetYear}</span>
                                        ) : (
                                            <span className="lj-goal-year lj-goal-year-same" aria-hidden="true" />
                                        )}
                                    </div>
                                    <div className="lj-goal-rail" aria-hidden="true">
                                        <span className="lj-goal-rail-dot" />
                                    </div>
                                    <div className="lj-goal-body">
                                        <div className="lj-goal-body-top">
                                            <span className="lj-goal-icon-wrap">
                                                <Icon size={16} />
                                            </span>
                                            <div className="lj-goal-copy">
                                                <strong className="lj-goal-name">{goal.name}</strong>
                                                <span className="lj-goal-meta">
                                                    {yearsAway === 1 ? 'in 1 year' : `in ${yearsAway} years`}
                                                </span>
                                            </div>
                                            <span className="lj-goal-cost">{formatCurrency(goal.futureCost)}</span>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                    <div className="lj-goal-range">
                        <span>From {meta.currentYear + 1}</span>
                        <span>Through {constellationEndYear}</span>
                    </div>
                </ReportReveal>
            )}

            <div className="lj-visual-row">
                <ReportReveal className="lj-visual-card card lj-visual-half" delay={180}>
                    <h3 className="dr-chart-title">
                        <TrendingUp size={18} />
                        Income vs life costs
                    </h3>
                    <p className="dr-chart-sub">Net inflow compared with total outflow by year.</p>
                    <div className="dr-chart-wrap">
                        <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={incomeSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 10, fill: '#64748b' }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    tickFormatter={formatChartCompact}
                                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={52}
                                />
                                <Tooltip content={<ChartTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="netInflow"
                                    name="Net inflow"
                                    stroke="#2563EB"
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="totalOutflow"
                                    name="Total outflow"
                                    stroke="#EF4444"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </ReportReveal>

                <ReportReveal className="lj-visual-card card lj-visual-half" delay={240}>
                    <h3 className="dr-chart-title">
                        <Waves size={18} />
                        Surplus river
                    </h3>
                    <p className="dr-chart-sub">Net investible surplus flowing year by year.</p>
                    <div className="dr-chart-wrap">
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={surplusSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 10, fill: '#64748b' }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    tickFormatter={formatChartCompact}
                                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={52}
                                />
                                <Tooltip content={<ChartTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="surplus"
                                    name="Net investible surplus"
                                    stroke="#10B981"
                                    fill="rgba(16,185,129,0.22)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </ReportReveal>
            </div>
        </div>
    );
};

export default LifeJourneyVisuals;
