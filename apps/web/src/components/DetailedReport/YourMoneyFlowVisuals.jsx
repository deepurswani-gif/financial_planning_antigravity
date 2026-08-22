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

    const activeItems = rhythmData.filter((d) => d.income !== null);
    const firstActive = activeItems[0];
    const isFlatRhythm = activeItems.length > 0 && activeItems.every(
        (d) => d.income === firstActive?.income
            && d.outflow === firstActive?.outflow
            && d.freeCashFlow === firstActive?.freeCashFlow,
    );

    if (!hasRhythm) return null;

    return (
        <div className="ymf-visuals">
            <ReportReveal className="ymf-visual-card card" delay={80}>
                <h3 className="dr-chart-title">
                    <TrendingUp size={18} />
                    Monthly money rhythm
                </h3>
                <p className="dr-chart-sub">
                    {isFlatRhythm
                        ? `Monthly cash rhythm baseline across ${meta.calendarYear} (${meta.currentMonthLabel} highlighted).`
                        : `Actuals through ${meta.currentMonthLabel}, projected run-rate for upcoming months.`}
                </p>

                {isFlatRhythm ? (
                    <div className="ymf-rhythm-strip-container">
                        <div className="ymf-rhythm-strip">
                            {rhythmData.map((d) => (
                                <div
                                    key={d.label}
                                    className={[
                                        'ymf-strip-cell',
                                        d.isCurrent ? 'is-current' : '',
                                        d.income === null ? 'is-inactive' : '',
                                    ].filter(Boolean).join(' ')}
                                >
                                    <span className="ymf-strip-month">{d.label}</span>
                                    {d.isCurrent ? (
                                        <span className="ymf-strip-badge">Now</span>
                                    ) : d.income !== null ? (
                                        <span className="ymf-strip-dot" />
                                    ) : (
                                        <span className="ymf-strip-dim">—</span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="ymf-strip-meta-line">
                            <span>Income: <strong>{formatCurrency(firstActive?.income || 0)}</strong></span>
                            <span className="ymf-strip-sep">•</span>
                            <span>Outflow: <strong>{formatCurrency(firstActive?.outflow || 0)}</strong></span>
                            <span className="ymf-strip-sep">•</span>
                            <span>Free cash flow: <strong>{formatCurrency(firstActive?.freeCashFlow || 0)}</strong></span>
                        </div>
                    </div>
                ) : (
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
                )}

                {!isFlatRhythm && (
                    <div className="dr-chart-legend">
                        <span><i className="dr-dot dr-dot-income" /> Income</span>
                        <span><i className="dr-dot dr-dot-outflow" /> Total outflow</span>
                        <span><i className="dr-dot dr-dot-surplus" /> Free cash flow (current month highlighted)</span>
                    </div>
                )}

                <style>{`
                    .ymf-rhythm-strip-container { padding: 0.75rem 0 0.25rem; }
                    .ymf-rhythm-strip { display: grid; grid-template-columns: repeat(12, 1fr); gap: 0.35rem; }
                    .ymf-strip-cell {
                        display: flex; flex-direction: column; align-items: center; justify-content: center;
                        padding: 0.65rem 0.25rem; border-radius: 8px; background: rgba(37,99,235,0.04);
                        border: 1px solid var(--border); font-size: 0.78rem; text-align: center; gap: 0.25rem;
                    }
                    .ymf-strip-cell.is-current {
                        background: rgba(37,99,235,0.12); border-color: var(--primary); font-weight: 700;
                        box-shadow: 0 0 0 1px var(--primary);
                    }
                    .ymf-strip-cell.is-inactive { opacity: 0.45; background: transparent; }
                    .ymf-strip-month { font-weight: 600; color: var(--text-main); font-size: 0.78rem; }
                    .ymf-strip-badge {
                        font-size: 0.62rem; font-weight: 700; background: var(--primary); color: white;
                        padding: 0.1rem 0.35rem; border-radius: 4px; text-transform: uppercase;
                    }
                    .ymf-strip-dot { width: 6px; height: 6px; border-radius: 50%; background: #10B981; }
                    .ymf-strip-dim { font-size: 0.75rem; color: var(--text-muted); }
                    .ymf-strip-meta-line {
                        display: flex; justify-content: center; align-items: center; gap: 0.75rem;
                        margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted); flex-wrap: wrap;
                    }
                    .ymf-strip-sep { color: var(--border); }
                    @media (max-width: 640px) {
                        .ymf-rhythm-strip { grid-template-columns: repeat(6, 1fr); }
                    }
                `}</style>
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
