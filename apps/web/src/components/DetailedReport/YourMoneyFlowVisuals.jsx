import React, { useMemo } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { BarChart3, TrendingUp, PiggyBank } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ReportReveal from './ReportReveal';
import {
    buildCurrentMonthWaterfall,
    buildMonthlyRhythmData,
    buildSavingsRateData,
    formatChartCompact,
} from './reportVisualLogic';
import { MONTH_LABELS_LONG } from './moneyFlowLedgerLogic';

const RhythmTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    if (!data?.income && data?.income !== 0) return null;
    return (
        <div className="dr-chart-tooltip">
            <div className="dr-chart-tooltip-label">{data.label}</div>
            <div>Income: {formatCurrency(data.income)}</div>
            <div>Outflow: {formatCurrency(data.outflow)}</div>
            <div>Free cash: {formatCurrency(data.freeCashFlow)}</div>
        </div>
    );
};

const WaterfallTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const entry = payload.find((p) => p.dataKey === 'value')?.payload;
    if (!entry) return null;
    return (
        <div className="dr-chart-tooltip">
            <div className="dr-chart-tooltip-label">{entry.name}</div>
            <div>{formatCurrency(entry.value)}</div>
        </div>
    );
};

const YourMoneyFlowVisuals = ({ ledger, meta, baseline }) => {
    const rhythmData = useMemo(() => buildMonthlyRhythmData(ledger, meta), [ledger, meta]);
    const waterfallData = useMemo(() => buildCurrentMonthWaterfall(ledger, meta), [ledger, meta]);
    const savingsRate = useMemo(
        () => buildSavingsRateData(baseline, ledger, meta),
        [baseline, ledger, meta],
    );

    const monthLabel = MONTH_LABELS_LONG[
        meta.currentMonth >= meta.planStartMonth ? meta.currentMonth : meta.planStartMonth
    ];

    const hasRhythm = rhythmData.some((d) => d.income !== null);

    if (!hasRhythm) return null;

    return (
        <div className="ymf-visuals">
            <ReportReveal className="ymf-visual-card card" delay={80}>
                <h3 className="dr-chart-title">
                    <TrendingUp size={18} />
                    Monthly money rhythm
                </h3>
                <p className="dr-chart-sub">
                    How income, outflows, and free cash flow move through {meta.calendarYear}.
                </p>
                <div className="dr-chart-wrap">
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={rhythmData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 11, fill: '#64748b' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tickFormatter={formatChartCompact}
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                                width={56}
                            />
                            <Tooltip content={<RhythmTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="income"
                                stroke="#2563EB"
                                fill="rgba(37,99,235,0.12)"
                                strokeWidth={2}
                                connectNulls={false}
                                name="Income"
                            />
                            <Area
                                type="monotone"
                                dataKey="outflow"
                                stroke="#EF4444"
                                fill="rgba(239,68,68,0.08)"
                                strokeWidth={2}
                                connectNulls={false}
                                name="Outflow"
                            />
                            <Line
                                type="monotone"
                                dataKey="freeCashFlow"
                                stroke="#7C3AED"
                                strokeWidth={2.5}
                                dot={(props) => {
                                    const { cx, cy, payload } = props;
                                    if (!payload?.isCurrent) return null;
                                    return (
                                        <circle
                                            key={`dot-${payload.label}`}
                                            cx={cx}
                                            cy={cy}
                                            r={6}
                                            fill="#7C3AED"
                                            stroke="#fff"
                                            strokeWidth={2}
                                        />
                                    );
                                }}
                                connectNulls={false}
                                name="Free cash flow"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <div className="dr-chart-legend">
                    <span><i className="dr-dot dr-dot-income" /> Income</span>
                    <span><i className="dr-dot dr-dot-outflow" /> Total outflow</span>
                    <span><i className="dr-dot dr-dot-surplus" /> Free cash flow (current month highlighted)</span>
                </div>
            </ReportReveal>

            <div className="ymf-visual-row">
                <ReportReveal className="ymf-visual-card card ymf-visual-half" delay={160}>
                    <h3 className="dr-chart-title">
                        <BarChart3 size={18} />
                        {monthLabel} allocation
                    </h3>
                    <p className="dr-chart-sub">Where this month&apos;s income goes.</p>
                    <div className="dr-chart-wrap dr-chart-wrap-sm">
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={waterfallData} margin={{ top: 12, right: 8, left: 8, bottom: 0 }} barCategoryGap="22%">
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tickFormatter={formatChartCompact}
                                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={48}
                                />
                                <Tooltip content={<WaterfallTooltip />} cursor={false} />
                                <Bar dataKey="base" stackId="wf" fill="transparent" />
                                <Bar dataKey="value" stackId="wf" radius={[6, 6, 0, 0]}>
                                    {waterfallData.map((entry) => (
                                        <Cell key={entry.name} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ReportReveal>

                <ReportReveal className="ymf-visual-card card ymf-visual-half" delay={240}>
                    <h3 className="dr-chart-title">
                        <PiggyBank size={18} />
                        Savings rate
                    </h3>
                    <p className="dr-chart-sub">Share of monthly income going to savings &amp; investments.</p>
                    <div className="dr-donut-wrap">
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={savingsRate.chartData}
                                    dataKey="value"
                                    innerRadius={58}
                                    outerRadius={78}
                                    paddingAngle={2}
                                    stroke="none"
                                >
                                    {savingsRate.chartData.map((entry) => (
                                        <Cell key={entry.name} fill={entry.fill} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="dr-donut-center">
                            <strong>{savingsRate.rate}%</strong>
                            <span>saved</span>
                        </div>
                    </div>
                </ReportReveal>
            </div>
        </div>
    );
};

export default YourMoneyFlowVisuals;
