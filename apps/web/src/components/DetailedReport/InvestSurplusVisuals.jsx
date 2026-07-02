import React, { useMemo } from 'react';
import {
    Area,
    AreaChart,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { PieChart as PieIcon, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ReportReveal from './ReportReveal';
import { buildSipGrowthSeries } from './investSurplusLogic';
import { formatChartCompact } from './reportVisualLogic';

const PieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0];
    return (
        <div className="dr-chart-tooltip">
            <div className="dr-chart-tooltip-label">{entry.name}</div>
            <div>{formatCurrency(entry.value)}/month</div>
        </div>
    );
};

const GrowthTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    return (
        <div className="dr-chart-tooltip">
            <div className="dr-chart-tooltip-label">{data?.label}</div>
            <div>Projected: {formatCurrency(data?.value)}</div>
            <div>Invested: {formatCurrency(data?.invested)}</div>
        </div>
    );
};

const InvestSurplusVisuals = ({ report }) => {
    const { deploymentSlices, hero, meta, sipProjection } = report;

    const wealthMonthly = deploymentSlices.find((s) => s.name === 'Wealth building')?.value
        || hero.deployableMonthly;

    const growthSeries = useMemo(
        () => buildSipGrowthSeries(wealthMonthly, meta.yearsToRetirement),
        [wealthMonthly, meta.yearsToRetirement],
    );

    if (hero.deployableMonthly <= 0 && deploymentSlices.length === 0) return null;

    return (
        <div className="ius-visuals">
            {deploymentSlices.length > 0 && (
                <ReportReveal className="ius-visual-card card" delay={80}>
                    <h3 className="dr-chart-title">
                        <PieIcon size={18} />
                        Suggested monthly deployment
                    </h3>
                    <p className="dr-chart-sub">
                        A balanced way to put ₹{Math.round(hero.deployableMonthly).toLocaleString('en-IN')}/month to work.
                    </p>
                    <div className="ius-pie-row">
                        <div className="ius-pie-chart">
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={deploymentSlices}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={52}
                                        outerRadius={78}
                                        paddingAngle={3}
                                        stroke="none"
                                    >
                                        {deploymentSlices.map((entry) => (
                                            <Cell key={entry.name} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<PieTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <ul className="ius-pie-legend">
                            {deploymentSlices.map((slice) => (
                                <li key={slice.name}>
                                    <span className="ius-legend-dot" style={{ background: slice.fill }} />
                                    <span>{slice.name}</span>
                                    <strong>{formatCurrency(slice.value)}/mo</strong>
                                </li>
                            ))}
                        </ul>
                    </div>
                </ReportReveal>
            )}

            {wealthMonthly > 0 && growthSeries.length > 0 && (
                <ReportReveal className="ius-visual-card card" delay={160}>
                    <h3 className="dr-chart-title">
                        <TrendingUp size={18} />
                        Wealth-building trajectory
                    </h3>
                    <p className="dr-chart-sub">
                        If ₹{Math.round(wealthMonthly).toLocaleString('en-IN')}/month goes to investments at 12% p.a.,
                        it could reach {formatCurrency(sipProjection.futureValue)} by retirement.
                    </p>
                    <div className="dr-chart-wrap">
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={growthSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 10, fill: '#64748b' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tickFormatter={formatChartCompact}
                                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={52}
                                />
                                <Tooltip content={<GrowthTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#10B981"
                                    fill="rgba(16,185,129,0.2)"
                                    strokeWidth={2}
                                    name="Projected value"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </ReportReveal>
            )}
        </div>
    );
};

export default InvestSurplusVisuals;
