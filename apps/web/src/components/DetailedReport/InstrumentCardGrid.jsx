import React, { useEffect, useState } from 'react';
import {
    TrendingUp, ChevronDown, Shield, Coins, Landmark, PiggyBank, BarChart2,
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
    displayName,
    note,
}) => {
    const def = INSTRUMENT_REGISTRY[instrument.type] || instrument.registry;
    const Icon = ICONS[instrument.type] || TrendingUp;
    const isMonthly = def?.inputMode === 'monthly';
    const amountSuffix = isMonthly ? '/mo' : '';
    const [inputValue, setInputValue] = useState(String(draftAmount || 0));

    useEffect(() => {
        setInputValue(String(draftAmount || 0));
    }, [draftAmount]);

    const commitAmount = (raw) => {
        const parsed = Math.round(parseFloat(String(raw).replace(/,/g, '')) || 0);
        const clamped = Math.max(0, Math.min(parsed, Math.max(0, maxAmount)));
        onDraftChange(instrument.type, clamped);
        setInputValue(String(clamped));
    };

    return (
        <div className="pymtw-instrument-card pymtw-instrument-active">
            <div className="pymtw-instrument-header">
                <div className="pymtw-instrument-title-row">
                    <Icon size={18} />
                    <h4>{displayName || instrument.type}</h4>
                </div>
            </div>

            {note && <p className="pymtw-instrument-note">{note}</p>}

            <div className="pymtw-instrument-tags">
                {category.goalTags.map((tag) => (
                    <span key={tag} className="pymtw-goal-tag">{tag}</span>
                ))}
            </div>

            <div className="pymtw-sip-slider-block">
                <div className="pymtw-sip-slider-head">
                    <span>Allocate this month</span>
                    <div className="pymtw-amount-input-wrap">
                        <span className="pymtw-amount-prefix">₹</span>
                        <input
                            type="number"
                            className="pymtw-amount-input"
                            min={0}
                            max={Math.max(0, maxAmount)}
                            step={1}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onBlur={() => commitAmount(inputValue)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                }
                            }}
                            aria-label={`${displayName || instrument.type} amount`}
                        />
                        {amountSuffix && <span className="pymtw-amount-suffix">{amountSuffix}</span>}
                    </div>
                </div>
                <input
                    type="range"
                    className="pymtw-sip-slider"
                    min={0}
                    max={Math.max(0, maxAmount)}
                    step={def?.step || 500}
                    value={Math.min(draftAmount, Math.max(0, maxAmount))}
                    onChange={(e) => onDraftChange(instrument.type, parseInt(e.target.value, 10))}
                    aria-label={`${displayName || instrument.type} allocation slider`}
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
        </div>
    );
};

const getInstrumentDisplayName = (category, instrument) => (
    category.instrumentLabels?.[instrument.type] || instrument.type
);

/** Natural list: "A", "A and B", or "A, B and C". */
const formatAvenueNames = (names = []) => {
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

const InstrumentCardGrid = ({
    instrumentCategories,
    draftAllocations,
    remainingSurplus,
    getMaxAmountForInstrument,
    onDraftChange,
    onApplyManualAllocations,
    canApplyManual = false,
}) => {
    const [expandedId, setExpandedId] = useState(null);

    const toggleCategory = (id) => {
        setExpandedId((prev) => (prev === id ? null : id));
    };

    return (
        <ReportReveal className="pymtw-zone-c">
            <h3 className="pymtw-zone-title">Allocate your surplus</h3>
            <p className="pymtw-zone-sub">
                Open one category at a time to set amounts with the slider or by typing. Remaining:{' '}
                <strong>{formatCurrency(Math.max(0, remainingSurplus))}</strong>
            </p>

            {instrumentCategories.map((category) => {
                const isOpen = expandedId === category.id;
                const avenueNames = formatAvenueNames(
                    category.instruments.map((instrument) => getInstrumentDisplayName(category, instrument)),
                );
                const allocatedInCategory = category.instruments.reduce(
                    (sum, instrument) => sum + (draftAllocations[instrument.type] || 0),
                    0,
                );

                return (
                    <div key={category.id} className={`pymtw-category-block ${isOpen ? 'pymtw-category-open' : ''}`}>
                        <button
                            type="button"
                            className="pymtw-category-toggle"
                            aria-expanded={isOpen}
                            aria-controls={`pymtw-category-panel-${category.id}`}
                            id={`pymtw-category-trigger-${category.id}`}
                            onClick={() => toggleCategory(category.id)}
                        >
                            <div className="pymtw-category-toggle-main">
                                <h4 className="pymtw-category-label">{category.label}</h4>
                                <span className="pymtw-category-meta">
                                    {avenueNames}
                                    {allocatedInCategory > 0 && (
                                        <> · {formatCurrency(allocatedInCategory)} allocated</>
                                    )}
                                </span>
                            </div>
                            <span className={`pymtw-category-action ${isOpen ? 'pymtw-category-action-open' : ''}`}>
                                <span className="pymtw-category-action-label">
                                    {isOpen ? 'Hide avenues' : 'Show avenues'}
                                </span>
                                <ChevronDown
                                    size={18}
                                    className={`pymtw-category-chevron ${isOpen ? 'pymtw-category-chevron-open' : ''}`}
                                    aria-hidden="true"
                                />
                            </span>
                        </button>
                        {isOpen && (
                            <div
                                className="pymtw-instrument-grid"
                                id={`pymtw-category-panel-${category.id}`}
                                role="region"
                                aria-labelledby={`pymtw-category-trigger-${category.id}`}
                            >
                                {category.instruments.map((instrument) => (
                                    <InstrumentCard
                                        key={instrument.type}
                                        instrument={instrument}
                                        category={category}
                                        displayName={getInstrumentDisplayName(category, instrument)}
                                        note={category.instrumentNotes?.[instrument.type]}
                                        draftAmount={draftAllocations[instrument.type] || 0}
                                        maxAmount={getMaxAmountForInstrument
                                            ? getMaxAmountForInstrument(instrument.type)
                                            : (draftAllocations[instrument.type] || 0) + Math.max(0, remainingSurplus)}
                                        onDraftChange={onDraftChange}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {onApplyManualAllocations && (
                <div className="pymtw-manual-apply-row">
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={onApplyManualAllocations}
                        disabled={!canApplyManual}
                    >
                        Apply my allocations
                    </button>
                </div>
            )}
        </ReportReveal>
    );
};

export default InstrumentCardGrid;
