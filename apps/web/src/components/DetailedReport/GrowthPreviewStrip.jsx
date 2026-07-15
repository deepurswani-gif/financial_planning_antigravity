import React from 'react';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ReportReveal from './ReportReveal';

const GrowthPreviewStrip = ({ growthPreview }) => {
    if (!growthPreview?.hasDraft) return null;

    return (
        <ReportReveal className="pymtw-growth-strip card">
            <h3 className="pymtw-zone-title">
                <TrendingUp size={18} />
                Growth preview
            </h3>
            <p className="pymtw-zone-sub">
                Projected corpus till your retirement by {growthPreview.retirementYear}
            </p>

            <div className="pymtw-growth-totals">
                <div>
                    <span>Current corpus</span>
                    <strong>{formatCurrency(growthPreview.baselineTotal)}</strong>
                </div>
                <div>
                    <span>Corpus after Allocation</span>
                    <strong className="pymtw-growth-scenario">{formatCurrency(growthPreview.scenarioTotal)}</strong>
                </div>
                <div>
                    <span>Net Uplift</span>
                    <strong className={growthPreview.totalDelta > 0 ? 'pymtw-delta-positive' : undefined}>
                        {growthPreview.totalDelta > 0
                            ? `+${formatCurrency(growthPreview.totalDelta)}`
                            : formatCurrency(growthPreview.totalDelta || 0)}
                    </strong>
                </div>
            </div>
        </ReportReveal>
    );
};

export default GrowthPreviewStrip;
