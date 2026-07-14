import React from 'react';
import {
    TrendingUp, ChevronRight, Shield, Coins, Landmark, PiggyBank, BarChart2,
} from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ReportReveal from './ReportReveal';
import { INSTRUMENT_REGISTRY } from './instrumentAnalysisLogic';

const ICONS = {
    SIP: TrendingUp,
    Lumpsum: Coins,
    'Direct Equity & ETFs': BarChart2,
    PPF: Landmark,
    NPS: PiggyBank,
    'Fixed Deposit': Landmark,
    'Liquid Mutual Fund': Coins,
    'Recurring Deposit': PiggyBank,
    'Life Insurance': Shield,
    'Term Insurance': Shield,
    'Health Insurance': Shield,
    'Life Insurance Saving Plans': PiggyBank,
    Gold: Coins,
    'Other Investment': Coins,
};

const InstrumentCard = ({
    instrument,
    category,
    draftAmount,
    maxAmount,
    onDraftChange,
    onAnalyze,
}) => {
    const def = INSTRUMENT_REGISTRY[instrument.type] || instrument.registry;
    const Icon = ICONS[instrument.type] || TrendingUp;
    const isMonthly = def?.inputMode === 'monthly';
    const amountSuffix = isMonthly ? '/mo' : '';

    return (
        <div className="pymtw-instrument-card pymtw-instrument-active">
            <div className="pymtw-instrument-header">
                <div className="pymtw-instrument-title-row">
                    <Icon size={18} />
                    <h4>{instrument.type}</h4>
                </div>
            </div>

            <div className="pymtw-instrument-tags">
                {category.goalTags.map((tag) => (
                    <span key={tag} className="pymtw-goal-tag">{tag}</span>
                ))}
            </div>

            <div className="pymtw-sip-slider-block">
                <div className="pymtw-sip-slider-head">
                    <span>Allocate this month</span>
                    <strong>{formatCurrency(draftAmount)}{amountSuffix}</strong>
                </div>
                <input
                    type="range"
                    className="pymtw-sip-slider"
                    min={0}
                    max={Math.max(0, maxAmount)}
                    step={def?.step || 500}
                    value={draftAmount}
                    onChange={(e) => onDraftChange(instrument.type, parseInt(e.target.value, 10))}
                    aria-label={`${instrument.type} allocation`}
                />
                <div className="pymtw-sip-slider-labels">
                    <span>₹0</span>
                    <span>{formatCurrency(maxAmount)}</span>
                </div>
                {instrument.hasAllocations && (
                    <div className="pymtw-instrument-stats">
                        <div>
                            <span>Already planned</span>
                            <strong>
                                {instrument.monthlyTotal > 0
                                    ? `${formatCurrency(instrument.monthlyTotal)}/mo`
                                    : formatCurrency(instrument.annualTotal)}
                            </strong>
                        </div>
                        <div>
                            <span>Entries</span>
                            <strong>{instrument.count}</strong>
                        </div>
                    </div>
                )}
            </div>

            <button
                type="button"
                className="pymtw-analyze-btn"
                onClick={() => onAnalyze(instrument.type)}
            >
                View full analysis
                <ChevronRight size={16} />
            </button>
        </div>
    );
};

const InstrumentCardGrid = ({
    instrumentCategories,
    draftAllocations,
    remainingSurplus,
    getMaxAmountForInstrument,
    onDraftChange,
    onAnalyze,
}) => (
    <ReportReveal className="pymtw-zone-c">
        <h3 className="pymtw-zone-title">Investment avenues</h3>
        <p className="pymtw-zone-sub">
            Allocate surplus across all instruments — each slider updates goal impact and growth preview live.
        </p>

        {instrumentCategories.map((category) => (
            <div key={category.id} className="pymtw-category-block">
                <h4 className="pymtw-category-label">{category.label}</h4>
                <div className="pymtw-instrument-grid">
                    {category.instruments.map((instrument) => (
                        <InstrumentCard
                            key={instrument.type}
                            instrument={instrument}
                            category={category}
                            draftAmount={draftAllocations[instrument.type] || 0}
                            maxAmount={getMaxAmountForInstrument
                                ? getMaxAmountForInstrument(instrument.type)
                                : (draftAllocations[instrument.type] || 0) + Math.max(0, remainingSurplus)}
                            onDraftChange={onDraftChange}
                            onAnalyze={onAnalyze}
                        />
                    ))}
                </div>
            </div>
        ))}
    </ReportReveal>
);

export default InstrumentCardGrid;
