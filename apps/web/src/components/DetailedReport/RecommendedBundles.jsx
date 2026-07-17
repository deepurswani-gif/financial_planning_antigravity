import React, { useState } from 'react';
import { Sparkles, Shield, Target, ChevronDown } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ReportReveal from './ReportReveal';
import { getTotalDraftAllocated } from './instrumentAnalysisLogic';

const formatAllocLine = (allocations) => Object.entries(allocations || {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ type: k, amount: v }));

const RecommendedBundles = ({
    bundles,
    deployableSurplus,
    engineResult = null,
    avenuesMode = 'choose',
    onApplyAiRecommendations,
    onStartManualAllocation,
    onBackToAiRecommendations,
    canApplyAi = true,
}) => {
    const [detailsOpen, setDetailsOpen] = useState(false);

    if (!bundles?.length || deployableSurplus <= 0) return null;

    const topBundle = bundles[0];
    const goalCards = engineResult?.goalCards || engineResult?.objectiveCards || topBundle?.goalCards || [];
    const protectionFirst = Math.round(
        engineResult?.diagnostics?.protectionTotal
        ?? engineResult?.protection?.monthlyTotal
        ?? ((topBundle?.reserves?.emergency || 0) + (topBundle?.reserves?.protection || 0)),
    );
    const grandTotal = Math.round(
        engineResult?.diagnostics?.grandTotal
        ?? getTotalDraftAllocated(topBundle?.allocations),
    );
    const nearestGoals = Math.max(0, grandTotal - protectionFirst);
    const avenueItems = formatAllocLine(topBundle?.allocations);
    const showActionButtons = avenuesMode === 'choose';
    const showBackButton = avenuesMode === 'ai_applied'
        || avenuesMode === 'manual_applied'
        || avenuesMode === 'manual_edit';
    const hasExpandableContent = avenueItems.length > 0 || goalCards.length > 0;

    return (
        <ReportReveal className="pymtw-bundles card pymtw-surplus-allocation">
            <div className="pymtw-bundles-header">
                <h3 className="pymtw-zone-title">
                    <Sparkles size={18} />
                    Recommended Surplus Allocation
                </h3>
            </div>

            <div className="pymtw-surplus-kpi-row">
                <div className="pymtw-surplus-kpi">
                    <span className="pymtw-surplus-kpi-label">
                        <Shield size={14} />
                        Protection first
                    </span>
                    <strong className="pymtw-surplus-kpi-value">{formatCurrency(protectionFirst)}</strong>
                </div>
                <span className="pymtw-surplus-kpi-divider" aria-hidden="true">|</span>
                <div className="pymtw-surplus-kpi">
                    <span className="pymtw-surplus-kpi-label">
                        <Target size={14} />
                        Nearest Goals
                    </span>
                    <strong className="pymtw-surplus-kpi-value">{formatCurrency(nearestGoals)}</strong>
                </div>
            </div>

            {hasExpandableContent && (
                <button
                    type="button"
                    className="pymtw-bundles-details-toggle"
                    aria-expanded={detailsOpen}
                    onClick={() => setDetailsOpen((prev) => !prev)}
                >
                    <span>{detailsOpen ? 'Hide details' : 'Show details'}</span>
                    <ChevronDown
                        size={18}
                        className={`pymtw-category-chevron ${detailsOpen ? 'pymtw-category-chevron-open' : ''}`}
                        aria-hidden="true"
                    />
                </button>
            )}

            {detailsOpen && (
                <div className="pymtw-bundles-details">
                    {avenueItems.length > 0 && (
                        <p className="pymtw-avenue-line" aria-label="Recommended avenues">
                            {avenueItems.map((item, idx) => (
                                <React.Fragment key={item.type}>
                                    {idx > 0 && <span className="pymtw-avenue-sep"> · </span>}
                                    <span className="pymtw-avenue-item">
                                        {item.type}{' '}
                                        <strong className="pymtw-avenue-amount">{formatCurrency(item.amount)}</strong>
                                    </span>
                                </React.Fragment>
                            ))}
                        </p>
                    )}

                    {goalCards.length > 0 && (
                        <div className="pymtw-fpi-stack">
                            <h4 className="pymtw-fpi-title">Goals funded this month</h4>
                            <ol className="pymtw-fpi-list">
                                {goalCards.map((card) => (
                                    <li key={card.id} className="pymtw-fpi-item">
                                        <div className="pymtw-fpi-item-head">
                                            <span className="pymtw-fpi-rank">#{card.rank}</span>
                                            <strong>{card.label}</strong>
                                            {card.horizonLabel && (
                                                <span className="pymtw-fpi-score">{card.horizonLabel}</span>
                                            )}
                                        </div>
                                        <p>{card.summary}</p>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                </div>
            )}

            {(showActionButtons || showBackButton) && (
                <div className="pymtw-surplus-actions">
                    {showActionButtons && (
                        <>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={onApplyAiRecommendations}
                                disabled={!canApplyAi}
                            >
                                Apply the AI recommendations
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={onStartManualAllocation}
                            >
                                Let me make the allocation myself
                            </button>
                        </>
                    )}
                    {showBackButton && onBackToAiRecommendations && (
                        <button
                            type="button"
                            className="btn btn-secondary pymtw-clear-plan-btn"
                            onClick={onBackToAiRecommendations}
                        >
                            Back to AI Recommendations
                        </button>
                    )}
                </div>
            )}
        </ReportReveal>
    );
};

export default RecommendedBundles;
