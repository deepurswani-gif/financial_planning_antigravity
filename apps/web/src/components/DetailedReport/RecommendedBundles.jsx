import React from 'react';
import { Sparkles, Shield, PiggyBank, TrendingUp, Heart } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ReportReveal from './ReportReveal';
import { getTotalDraftAllocated } from './instrumentAnalysisLogic';

const BundleIcon = ({ id }) => {
    if (id === 'life_journey') return <Heart size={20} />;
    if (id === 'safety_first') return <Shield size={20} />;
    if (id === 'aggressive') return <TrendingUp size={20} />;
    return <PiggyBank size={20} />;
};

const formatAllocLine = (allocations) => Object.entries(allocations || {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k} ${formatCurrency(v)}`)
    .join(' · ');

const RecommendedBundles = ({
    bundles,
    activeBundleId,
    onSelectBundle,
    deployableSurplus,
    engineResult = null,
}) => {
    if (!bundles?.length || deployableSurplus <= 0) return null;

    const goalCards = engineResult?.goalCards || engineResult?.objectiveCards || bundles[0]?.goalCards || [];
    const headline = engineResult?.headline || bundles[0]?.narrative;

    return (
        <ReportReveal className="pymtw-bundles card">
            <div className="pymtw-bundles-header">
                <h3 className="pymtw-zone-title">
                    <Sparkles size={18} />
                    Life Journey plan
                </h3>
                <p className="pymtw-zone-sub pymtw-bundles-sub">
                    Protection first, then the nearest goals — select to pre-fill all sliders.
                </p>
                {headline && (
                    <p className="pymtw-bundles-headline">{headline}</p>
                )}
            </div>

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

            <div className="pymtw-bundle-grid">
                {bundles.map((bundle, idx) => {
                    const isActive = activeBundleId === bundle.id;
                    const allocTotal = getTotalDraftAllocated(bundle.allocations);
                    return (
                        <button
                            key={bundle.id}
                            type="button"
                            className={`pymtw-bundle-card pymtw-bundle-${bundle.tone} ${isActive ? 'pymtw-bundle-active' : ''}`}
                            onClick={() => onSelectBundle(bundle)}
                        >
                            {idx === 0 && <span className="pymtw-bundle-rank">Top pick</span>}
                            <div className="pymtw-bundle-icon">
                                <BundleIcon id={bundle.id} />
                            </div>
                            <h4>{bundle.label}</h4>
                            <p className="pymtw-bundle-narrative">{bundle.narrative}</p>
                            <p className="pymtw-bundle-alloc-line">{formatAllocLine(bundle.allocations)}</p>
                            <div className="pymtw-bundle-amounts">
                                <div>
                                    <span>Total</span>
                                    <strong>{formatCurrency(allocTotal)}</strong>
                                </div>
                                {((bundle.reserves?.emergency || 0) > 0 || (bundle.reserves?.protection || 0) > 0) && (
                                    <div>
                                        <span>Protection &amp; emergency</span>
                                        <strong>
                                            {formatCurrency(
                                                (bundle.reserves?.emergency || 0) + (bundle.reserves?.protection || 0),
                                            )}
                                        </strong>
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </ReportReveal>
    );
};

export default RecommendedBundles;
