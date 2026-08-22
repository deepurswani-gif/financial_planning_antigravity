import React, { useState } from 'react';
import { Sparkles, Shield, Target, ChevronDown } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ReportReveal from './ReportReveal';
import { getTotalDraftAllocated } from './instrumentAnalysisLogic';

const formatAllocLine = (allocations) => Object.entries(allocations || {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ type: k, amount: v }));

// Set HIDE_RECOMMENDED_SURPLUS_ALLOCATION to true to visually hide the section while preserving full code & logic
const HIDE_RECOMMENDED_SURPLUS_ALLOCATION = true;

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

    if (HIDE_RECOMMENDED_SURPLUS_ALLOCATION || !bundles?.length || deployableSurplus <= 0) return null;

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
        <ReportReveal className="pymtw-bundles card pymtw-surplus-allocation" style={{ border: '2px solid var(--primary, #0f766e)', borderRadius: '20px', background: 'linear-gradient(180deg, rgba(15, 118, 110, 0.04) 0%, rgba(255, 255, 255, 1) 100%)', boxShadow: '0 8px 24px rgba(15, 118, 110, 0.08)', padding: '1.75rem' }}>
            <div className="pymtw-bundles-header" style={{ marginBottom: '1rem' }}>
                <h3 className="pymtw-zone-title" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary, #0f766e)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={22} />
                    Recommended Surplus Allocation
                </h3>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    Based on your safety net gaps and financial goals, here is our AI-recommended monthly allocation strategy.
                </p>
            </div>

            <div className="pymtw-surplus-kpi-row" style={{ background: '#fff', borderRadius: '12px', padding: '1rem', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', margin: '1rem 0' }}>
                <div className="pymtw-surplus-kpi" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span className="pymtw-surplus-kpi-label" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Shield size={16} style={{ color: 'var(--primary, #0f766e)' }} />
                        Protection first
                    </span>
                    <strong className="pymtw-surplus-kpi-value" style={{ fontSize: '1.3rem', color: 'var(--text-main)' }}>{formatCurrency(protectionFirst)}</strong>
                </div>
                <span className="pymtw-surplus-kpi-divider" aria-hidden="true" style={{ opacity: 0.3 }}>|</span>
                <div className="pymtw-surplus-kpi" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span className="pymtw-surplus-kpi-label" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Target size={16} style={{ color: '#0284c7' }} />
                        Nearest Goals
                    </span>
                    <strong className="pymtw-surplus-kpi-value" style={{ fontSize: '1.3rem', color: 'var(--text-main)' }}>{formatCurrency(nearestGoals)}</strong>
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
                <div className="pymtw-surplus-actions" style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {showActionButtons && (
                        <>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={onApplyAiRecommendations}
                                disabled={!canApplyAi}
                                style={{ flex: '1 1 220px', padding: '0.85rem 1.25rem', fontSize: '0.95rem', fontWeight: 700, borderRadius: '12px', boxShadow: '0 4px 12px rgba(15, 118, 110, 0.25)' }}
                            >
                                Apply the AI recommendations
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={onStartManualAllocation}
                                style={{ padding: '0.85rem 1.25rem', fontSize: '0.9rem', fontWeight: 600, borderRadius: '12px' }}
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
