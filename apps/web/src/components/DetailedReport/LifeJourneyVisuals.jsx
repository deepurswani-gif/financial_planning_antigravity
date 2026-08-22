import React, { useMemo } from 'react';
import {
    Area,
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Award, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { getGoalIcon } from '../DetailedFlow/goalIcons';
import ReportReveal from './ReportReveal';
import {
    flattenGoalsForTimeline,
    formatChartCompact,
} from './reportVisualLogic';

const ComboChartTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    return (
        <div className="dr-chart-tooltip">
            <div className="dr-chart-tooltip-label">Year {data?.label}</div>
            <div>Net Inflow: {formatCurrency(data?.netInflow)}</div>
            <div>Total Outflow: {formatCurrency(data?.totalOutflow)}</div>
            <div>Investible Surplus: {formatCurrency(data?.surplus)}</div>
        </div>
    );
};

const LifeJourneyVisuals = ({ report }) => {
    const { meta, projections, goalsByYear } = report;
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

    const comboSeries = useMemo(() => projections.map((row) => ({
        year: row.year,
        label: String(row.year),
        netInflow: row.netInflowAfterTax,
        totalOutflow: row.totalOutflow,
        surplus: row.netInvestibleSurplus,
    })), [projections]);

    if (!meta.hasProfile || !projections.length) return null;

    return (
        <div className="lj-visuals">
            {hasGoals && timelineGoals.length > 0 && (
                <ReportReveal className="lj-visual-card card" delay={60}>
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

            <ReportReveal className="lj-visual-card card" delay={120}>
                <h3 className="dr-chart-title">
                    <TrendingUp size={18} />
                    Income, life costs &amp; investible surplus
                </h3>
                <p className="dr-chart-sub">
                    Yearly projections of net inflow, total outflow, and resulting investible surplus through retirement.
                </p>
                <div className="dr-chart-wrap">
                    <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={comboSeries} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
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
                                width={56}
                            />
                            <Tooltip content={<ComboChartTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="surplus"
                                name="Investible Surplus"
                                stroke="#10B981"
                                fill="rgba(16,185,129,0.18)"
                                strokeWidth={2}
                            />
                            <Line
                                type="monotone"
                                dataKey="netInflow"
                                name="Net Inflow"
                                stroke="#2563EB"
                                strokeWidth={2.5}
                                dot={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="totalOutflow"
                                name="Total Outflow"
                                stroke="#EF4444"
                                strokeWidth={2.5}
                                dot={false}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
                <div className="dr-chart-legend">
                    <span><i className="dr-dot dr-dot-income" /> Net Inflow</span>
                    <span><i className="dr-dot dr-dot-outflow" /> Total Outflow</span>
                    <span><i className="dr-dot" style={{ background: '#10B981' }} /> Investible Surplus (shaded)</span>
                </div>
            </ReportReveal>
        </div>
    );
};

export default LifeJourneyVisuals;
