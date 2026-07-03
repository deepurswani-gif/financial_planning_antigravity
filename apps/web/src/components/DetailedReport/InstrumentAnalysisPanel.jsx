import React, { useMemo } from 'react';
import { X, TrendingUp } from 'lucide-react';
import {
    Area,
    AreaChart,
    Line,
    ComposedChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { formatChartCompact } from './reportVisualLogic';
import { buildCombinedGrowthSeries } from './putYourMoneyToWorkLogic';
import { buildInstrumentAnalysisNarrative, INSTRUMENT_REGISTRY } from './instrumentAnalysisLogic';

const GrowthTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    return (
        <div className="dr-chart-tooltip">
            <div className="dr-chart-tooltip-label">{data?.label}</div>
            {data?.baselineCorpus != null && (
                <div>Current path: {formatCurrency(data.baselineCorpus)}</div>
            )}
            {data?.scenarioCorpus != null && (
                <div>With addition: {formatCurrency(data.scenarioCorpus)}</div>
            )}
            {!data?.baselineCorpus && data?.corpus != null && (
                <div>Corpus: {formatCurrency(data.corpus)}</div>
            )}
        </div>
    );
};

const InstrumentAnalysisPanel = ({
    instrumentType,
    baselineAnalysis,
    scenarioAnalysis,
    goalDeltas,
    draftAmount,
    maxAmount,
    onAmountChange,
    onClose,
    isOpen,
}) => {
    const isScenario = draftAmount > 0;
    const displayAnalysis = isScenario ? scenarioAnalysis : baselineAnalysis;
    const def = INSTRUMENT_REGISTRY[instrumentType];
    const amountLabel = def?.inputMode === 'monthly' ? '/mo' : '';

    const combinedSeries = useMemo(() => {
        if (!baselineAnalysis?.growthSeries || !scenarioAnalysis?.growthSeries) {
            return displayAnalysis?.growthSeries || [];
        }
        return buildCombinedGrowthSeries(baselineAnalysis.growthSeries, scenarioAnalysis.growthSeries);
    }, [baselineAnalysis, scenarioAnalysis, displayAnalysis]);

    if (!isOpen || !instrumentType || !baselineAnalysis) return null;

    const narrative = buildInstrumentAnalysisNarrative(displayAnalysis, isScenario);
    const headlineDelta = (scenarioAnalysis?.headlineValue || 0) - (baselineAnalysis?.headlineValue || 0);

    return (
        <div className="pymtw-panel-overlay" onClick={onClose} role="presentation">
            <div
                className="pymtw-panel"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-labelledby="instrument-analysis-title"
            >
                <div className="pymtw-panel-header">
                    <div>
                        <div className="pymtw-panel-badge">
                            <TrendingUp size={14} />
                            {isScenario ? 'Scenario analysis' : 'Baseline analysis'}
                        </div>
                        <h3 id="instrument-analysis-title">{instrumentType} — Full Analysis</h3>
                    </div>
                    <button type="button" className="pymtw-panel-close" onClick={onClose} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                <div className="pymtw-panel-slider-block">
                    <div className="pymtw-sip-slider-head">
                        <span>Additional {instrumentType} this month</span>
                        <strong>{formatCurrency(draftAmount)}{amountLabel}</strong>
                    </div>
                    <input
                        type="range"
                        className="pymtw-sip-slider"
                        min={0}
                        max={Math.max(0, maxAmount)}
                        step={def?.step || 500}
                        value={draftAmount}
                        onChange={(e) => onAmountChange(parseInt(e.target.value, 10))}
                        aria-label={`Additional ${instrumentType} amount`}
                    />
                </div>

                <p className="pymtw-panel-narrative">{narrative}</p>

                <div className="pymtw-panel-kpi pymtw-panel-kpi-highlight">
                    <span>Projected value ({displayAnalysis.retirementYear})</span>
                    <strong>
                        {formatCurrency(displayAnalysis.headlineValue)}
                        {isScenario && headlineDelta > 0 && (
                            <em className="pymtw-delta-positive"> +{formatCurrency(headlineDelta)}</em>
                        )}
                    </strong>
                </div>

                {combinedSeries.length > 0 && (
                    <div className="pymtw-panel-chart card">
                        <h4>{isScenario ? 'Current vs planned path' : 'Growth trajectory'}</h4>
                        <ResponsiveContainer width="100%" height={220}>
                            {isScenario && combinedSeries[0]?.baselineCorpus != null ? (
                                <ComposedChart data={combinedSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                                    <YAxis tickFormatter={formatChartCompact} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={48} />
                                    <Tooltip content={<GrowthTooltip />} />
                                    <Line type="monotone" dataKey="baselineCorpus" stroke="#94A3B8" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                                    <Area type="monotone" dataKey="scenarioCorpus" stroke="#10B981" strokeWidth={2} fill="rgba(16,185,129,0.12)" />
                                </ComposedChart>
                            ) : (
                                <AreaChart data={combinedSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                                    <YAxis tickFormatter={formatChartCompact} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={48} />
                                    <Tooltip content={<GrowthTooltip />} />
                                    <Area type="monotone" dataKey="corpus" stroke="#10B981" strokeWidth={2} fill="rgba(16,185,129,0.12)" />
                                </AreaChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                )}

                {goalDeltas?.length > 0 && def?.goalKey && (
                    <div className="pymtw-panel-goals">
                        <h4>Goal impact delta</h4>
                        <div className="pymtw-goal-impact-list">
                            {goalDeltas.map((goal) => (
                                <div key={goal.goalId} className="pymtw-goal-impact-row">
                                    <div className="pymtw-goal-impact-head">
                                        <strong>{goal.name}</strong>
                                        <span>{goal.targetYear}</span>
                                    </div>
                                    {isScenario ? (
                                        <div className="pymtw-goal-delta-bars">
                                            <div className="pymtw-goal-delta-row">
                                                <span>Current</span>
                                                <div className="pymtw-goal-impact-bar">
                                                    <div className="pymtw-goal-impact-fill pymtw-fill-muted" style={{ width: `${goal.projectedFundedPct}%` }} />
                                                </div>
                                                <span>{goal.projectedFundedPct}%</span>
                                            </div>
                                            <div className="pymtw-goal-delta-row">
                                                <span>Planned</span>
                                                <div className="pymtw-goal-impact-bar">
                                                    <div className="pymtw-goal-impact-fill" style={{ width: `${goal.scenarioProjectedFundedPct}%` }} />
                                                </div>
                                                <span className={goal.projectedFundedDelta > 0 ? 'pymtw-delta-positive' : ''}>
                                                    {goal.scenarioProjectedFundedPct}%
                                                    {goal.projectedFundedDelta > 0 && ` (+${goal.projectedFundedDelta})`}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pymtw-goal-impact-bar-wrap">
                                            <div className="pymtw-goal-impact-bar">
                                                <div className="pymtw-goal-impact-fill" style={{ width: `${goal.projectedFundedPct}%` }} />
                                            </div>
                                            <span className="pymtw-goal-impact-pct">{goal.projectedFundedPct}% on track</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InstrumentAnalysisPanel;
