import React, { useMemo } from 'react';
import { TrendingUp, Shield, Coins, Landmark, PiggyBank, BarChart2 } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ReportReveal from './ReportReveal';

const ICONS = {
    SIP: TrendingUp,
    Lumpsum: Coins,
    'Direct Equity & ETFs': BarChart2,
    PPF: Landmark,
    NPS: PiggyBank,
    'Fixed Deposit': Landmark,
    'Recurring Deposit': PiggyBank,
    'Life Insurance': Shield,
    Gold: Coins,
    'Other Investment': Coins,
};

const GrowthPreviewStrip = ({ growthPreview }) => {
    if (!growthPreview?.hasDraft) return null;

    return (
        <ReportReveal className="pymtw-growth-strip card">
            <h3 className="pymtw-zone-title">
                <TrendingUp size={18} />
                Growth preview
            </h3>
            <p className="pymtw-zone-sub">
                Projected instrument values by {growthPreview.retirementYear} — before vs with your draft plan.
            </p>

            <div className="pymtw-growth-totals">
                <div>
                    <span>Current path</span>
                    <strong>{formatCurrency(growthPreview.baselineTotal)}</strong>
                </div>
                <div>
                    <span>With draft plan</span>
                    <strong className="pymtw-growth-scenario">{formatCurrency(growthPreview.scenarioTotal)}</strong>
                </div>
                {growthPreview.totalDelta > 0 && (
                    <div>
                        <span>Net uplift</span>
                        <strong className="pymtw-delta-positive">+{formatCurrency(growthPreview.totalDelta)}</strong>
                    </div>
                )}
            </div>

            <div className="pymtw-growth-rows">
                {growthPreview.rows.map((row) => {
                    const Icon = ICONS[row.type] || TrendingUp;
                    return (
                        <div key={row.type} className="pymtw-growth-row">
                            <Icon size={16} />
                            <span className="pymtw-growth-type">{row.type}</span>
                            <span className="pymtw-growth-draft">
                                +{formatCurrency(row.draftAmount)}
                                {row.type !== 'Lumpsum' && row.type !== 'Fixed Deposit' && row.type !== 'Gold' && row.type !== 'Other Investment' && row.type !== 'Direct Equity & ETFs' ? '/mo' : ''}
                            </span>
                            <span className="pymtw-growth-delta">
                                {row.delta > 0 ? `+${formatCurrency(row.delta)}` : '—'}
                            </span>
                        </div>
                    );
                })}
            </div>
        </ReportReveal>
    );
};

export default GrowthPreviewStrip;
