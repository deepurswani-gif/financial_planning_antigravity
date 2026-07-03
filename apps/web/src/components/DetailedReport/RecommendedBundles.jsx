import React from 'react';
import { Sparkles, Shield, PiggyBank, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ReportReveal from './ReportReveal';
import { getTotalDraftAllocated } from './instrumentAnalysisLogic';

const BundleIcon = ({ id }) => {
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
}) => {
    if (!bundles?.length || deployableSurplus <= 0) return null;

    return (
        <ReportReveal className="pymtw-bundles card">
            <div className="pymtw-bundles-header">
                <h3 className="pymtw-zone-title">
                    <Sparkles size={18} />
                    AI-recommended allocations
                </h3>
                <p className="pymtw-zone-sub pymtw-bundles-sub">
                    Multi-instrument bundles ranked for this month — select to pre-fill all sliders.
                </p>
            </div>
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
                                {(bundle.reserves.emergency > 0 || bundle.reserves.protection > 0) && (
                                    <div>
                                        <span>Reserves</span>
                                        <strong>
                                            {formatCurrency(bundle.reserves.emergency + bundle.reserves.protection)}
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
