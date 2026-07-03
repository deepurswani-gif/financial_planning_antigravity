import React from 'react';
import { Target, TrendingUp, BarChart3, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ReportReveal from './ReportReveal';

const OutcomeTheater = ({
    growthPreview,
    hero,
    meta,
    totalAllocated,
}) => {
    const hasDraft = growthPreview?.hasDraft;
    const topRows = growthPreview?.rows?.slice(0, 4) || [];

    return (
        <ReportReveal className="pymtw-zone-d card">
            <h3 className="pymtw-zone-title">
                <BarChart3 size={18} />
                Outcome preview
            </h3>
            <p className="pymtw-zone-sub">
                {hasDraft
                    ? 'Combined instrument projections through retirement — adjust sliders to compare outcomes.'
                    : 'Allocate surplus across instruments to see combined growth impact.'}
            </p>

            <div className="pymtw-outcome-grid">
                <div className="pymtw-outcome-stat">
                    <TrendingUp size={20} />
                    <div>
                        <span>Projected total ({growthPreview?.retirementYear || '—'})</span>
                        <strong>
                            {formatCurrency(
                                hasDraft ? growthPreview.scenarioTotal : growthPreview?.baselineTotal || 0,
                            )}
                        </strong>
                        {hasDraft && growthPreview.totalDelta > 0 && (
                            <em className="pymtw-outcome-delta">
                                <ArrowUpRight size={12} />
                                +{formatCurrency(growthPreview.totalDelta)}
                            </em>
                        )}
                    </div>
                </div>
                <div className="pymtw-outcome-stat">
                    <Target size={20} />
                    <div>
                        <span>Instruments in plan</span>
                        <strong>{topRows.length}</strong>
                    </div>
                </div>
                <div className="pymtw-outcome-stat">
                    <span className="pymtw-outcome-icon">₹</span>
                    <div>
                        <span>{meta.monthLabel} remaining</span>
                        <strong>{formatCurrency(hero.deployableSurplus - totalAllocated)}</strong>
                    </div>
                </div>
            </div>

            {topRows.length > 0 ? (
                <div className="pymtw-outcome-goals">
                    <h4>Instrument uplift snapshot</h4>
                    {topRows.map((row) => (
                        <div key={row.type} className="pymtw-outcome-goal-row">
                            <div className="pymtw-outcome-goal-label">
                                <strong>{row.type}</strong>
                                <span>+{formatCurrency(row.draftAmount)} allocated</span>
                            </div>
                            <div className="pymtw-outcome-goal-bar">
                                <div style={{ width: `${Math.min(100, (row.scenario / Math.max(row.scenario, 1)) * 100)}%` }} />
                            </div>
                            <span className="pymtw-outcome-goal-pct">
                                {row.delta > 0 ? `+${formatCurrency(row.delta)}` : '—'}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="pymtw-outcome-empty">
                    Use the sliders or pick a recommended bundle to preview combined growth.
                </p>
            )}
        </ReportReveal>
    );
};

export default OutcomeTheater;
