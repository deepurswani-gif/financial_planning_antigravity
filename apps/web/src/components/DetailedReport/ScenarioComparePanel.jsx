import React from 'react';
import { GitCompare, Sparkles, User, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ReportReveal from './ReportReveal';

const formatAllocSummary = (allocations) => Object.entries(allocations || {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}: ${formatCurrency(v)}`)
    .join(' · ');

const ScenarioComparePanel = ({
    comparison,
    onUseAiPlan,
    activeBundleId,
}) => {
    if (!comparison?.hasComparison) return null;

    const { draft, ai, growthDelta, recommendation } = comparison;
    const draftWins = recommendation === 'draft' && draft.total > 0;
    const aiWins = recommendation === 'ai';

    return (
        <ReportReveal className="pymtw-scenario-compare card">
            <h3 className="pymtw-zone-title">
                <GitCompare size={18} />
                Your draft vs AI recommendation
            </h3>
            <p className="pymtw-zone-sub">
                Side-by-side comparison — every figure is computed from your plan data.
            </p>

            <div className="pymtw-compare-grid">
                <div className={`pymtw-compare-col ${draftWins ? 'pymtw-compare-winner' : ''}`}>
                    <div className="pymtw-compare-col-head">
                        <User size={18} />
                        <h4>{draft.label}</h4>
                        {draftWins && <span className="pymtw-compare-badge">Stronger</span>}
                    </div>
                    <div className="pymtw-compare-stat">
                        <span>Allocated</span>
                        <strong>{formatCurrency(draft.total)}</strong>
                        <em>{draft.utilPct}% of surplus</em>
                    </div>
                    <div className="pymtw-compare-stat">
                        <span>Projected total</span>
                        <strong>{formatCurrency(draft.projectedTotal)}</strong>
                        {draft.growthDelta > 0 && (
                            <em className="pymtw-delta-positive">+{formatCurrency(draft.growthDelta)} uplift</em>
                        )}
                    </div>
                    <p className="pymtw-compare-alloc">{formatAllocSummary(draft.allocations) || 'No allocations yet'}</p>
                </div>

                <div className="pymtw-compare-vs">vs</div>

                <div className={`pymtw-compare-col ${aiWins ? 'pymtw-compare-winner' : ''}`}>
                    <div className="pymtw-compare-col-head">
                        <Sparkles size={18} />
                        <h4>{ai.label}</h4>
                        {aiWins && <span className="pymtw-compare-badge">Stronger</span>}
                    </div>
                    <div className="pymtw-compare-stat">
                        <span>Allocated</span>
                        <strong>{formatCurrency(ai.total)}</strong>
                        <em>{ai.utilPct}% of surplus</em>
                    </div>
                    <div className="pymtw-compare-stat">
                        <span>Projected total</span>
                        <strong>{formatCurrency(ai.projectedTotal)}</strong>
                        {ai.growthDelta > 0 && (
                            <em className="pymtw-delta-positive">+{formatCurrency(ai.growthDelta)} uplift</em>
                        )}
                    </div>
                    <p className="pymtw-compare-alloc">{formatAllocSummary(ai.allocations)}</p>
                    <p className="pymtw-compare-narrative">{ai.narrative}</p>
                    {aiWins && activeBundleId !== ai.bundleId && (
                        <button type="button" className="pymtw-use-ai-btn" onClick={() => onUseAiPlan(ai)}>
                            Use AI plan
                            <ArrowRight size={14} />
                        </button>
                    )}
                </div>
            </div>

            {growthDelta !== 0 && (
                <p className="pymtw-compare-foot">
                    {growthDelta > 0
                        ? `AI bundle projects ₹${Math.round(growthDelta).toLocaleString('en-IN')} more combined growth than your draft.`
                        : `Your draft projects ₹${Math.round(Math.abs(growthDelta)).toLocaleString('en-IN')} more combined growth than the AI bundle.`}
                </p>
            )}
        </ReportReveal>
    );
};

export default ScenarioComparePanel;
