import React, { useEffect, useState } from 'react';
import {
    TrendingUp, Coins, Landmark, PiggyBank, BarChart2, Shield, ChevronDown,
} from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import {
    INSTRUMENT_REGISTRY,
    LISP_INSTRUMENT_TYPE,
    LISP_FREQUENCIES,
    createEmptyLispDraft,
    isLispDraft,
    getDraftTypeAmount,
    getLispDraftMonthly,
} from './instrumentAnalysisLogic';

export const AVENUE_ICONS = {
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
    'Life Insurance Saving Plans': Shield,
    Gold: Coins,
    'Other Investment': Coins,
};

/** Amount slider + month history (shared by Gaps InstrumentCard and PYMTW chips). */
export const InstrumentAmountSlider = ({
    instrumentType,
    displayName,
    draftAmount = 0,
    maxAmount = 0,
    onDraftChange,
    monthHistory = [],
    currentPlanKey = null,
}) => {
    const def = INSTRUMENT_REGISTRY[instrumentType];
    const isMonthly = def?.inputMode === 'monthly';
    const amountSuffix = isMonthly ? '/mo' : '';
    const [inputValue, setInputValue] = useState(String(draftAmount || 0));

    useEffect(() => {
        setInputValue(String(draftAmount || 0));
    }, [draftAmount]);

    const commitAmount = (raw) => {
        const parsed = Math.round(parseFloat(String(raw).replace(/,/g, '')) || 0);
        const clamped = Math.max(0, Math.min(parsed, Math.max(0, maxAmount)));
        if (clamped === Math.round(draftAmount || 0)) {
            setInputValue(String(clamped));
            return;
        }
        onDraftChange(instrumentType, clamped);
        setInputValue(String(clamped));
    };

    const priorMonths = (monthHistory || []).filter(
        (h) => h.planKey !== currentPlanKey && Math.round(h.monthlyAmount || 0) > 0,
    );

    return (
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
                            if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        aria-label={`${displayName || instrumentType} amount`}
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
                value={Math.min(draftAmount || 0, Math.max(0, maxAmount))}
                onChange={(e) => {
                    const next = parseInt(e.target.value, 10) || 0;
                    if (next === Math.round(draftAmount || 0)) return;
                    onDraftChange(instrumentType, next);
                }}
                aria-label={`${displayName || instrumentType} allocation slider`}
            />
            <div className="pymtw-sip-slider-labels">
                <span>₹0</span>
                <span>{formatCurrency(maxAmount)}</span>
            </div>
            {priorMonths.length > 0 && (
                <div className="pymtw-instrument-stats pymtw-month-history">
                    {priorMonths.map((h) => (
                        <div key={h.planKey} className="pymtw-month-history-row">
                            <span>Already planned</span>
                            <strong>
                                {h.isMonthly !== false
                                    ? `${formatCurrency(Math.round(h.monthlyAmount))}/mo`
                                    : formatCurrency(Math.round(h.monthlyAmount))}
                            </strong>
                            <span className="pymtw-month-history-label">Month {h.monthLabel}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const LifeInsuranceSavingForm = ({
    draft,
    maxMonthly = 0,
    familyMembers = [],
    onChange,
    monthHistory = [],
    currentPlanKey = null,
}) => {
    const value = isLispDraft(draft) ? draft : createEmptyLispDraft();
    const monthly = getLispDraftMonthly(value);
    const priorMonths = (monthHistory || []).filter(
        (h) => h.planKey !== currentPlanKey && Math.round(h.monthlyAmount || 0) > 0,
    );

    const patch = (field, nextVal) => {
        onChange({ ...value, [field]: nextVal });
    };

    const commitPremium = (raw) => {
        const parsed = Math.round(parseFloat(String(raw).replace(/,/g, '')) || 0);
        // Cap by monthly-equivalent remaining capacity
        const freq = value.frequency || 'Monthly';
        const maxPremium = (() => {
            const f = String(freq).toLowerCase();
            if (f === 'quarterly') return Math.round(maxMonthly * 3);
            if (f === 'half-yearly' || f === 'half yearly') return Math.round(maxMonthly * 6);
            if (f === 'annual' || f === 'annually') return Math.round(maxMonthly * 12);
            return Math.round(maxMonthly);
        })();
        const clamped = Math.max(0, Math.min(parsed, Math.max(0, maxPremium)));
        patch('premium', clamped);
    };

    return (
        <div className="pymtw-lisp-form">
            <div className="pymtw-lisp-grid">
                <div className="input-group pymtw-lisp-field">
                    <label htmlFor="pymtw-lisp-member">Insured Member</label>
                    <select
                        id="pymtw-lisp-member"
                        value={value.insuredMember || ''}
                        onChange={(e) => patch('insuredMember', e.target.value)}
                    >
                        <option value="">Select Member</option>
                        {(familyMembers || []).map((m) => {
                            const name = m.name || m.relation;
                            return (
                                <option key={m.id || name} value={name}>{name}</option>
                            );
                        })}
                    </select>
                </div>
                <div className="input-group pymtw-lisp-field">
                    <label htmlFor="pymtw-lisp-premium">Premium Amount</label>
                    <div className="pymtw-amount-input-wrap">
                        <span className="pymtw-amount-prefix">₹</span>
                        <input
                            id="pymtw-lisp-premium"
                            type="number"
                            className="pymtw-amount-input"
                            min={0}
                            step={1}
                            value={value.premium || ''}
                            onChange={(e) => patch('premium', e.target.value === '' ? 0 : e.target.value)}
                            onBlur={(e) => commitPremium(e.target.value)}
                        />
                    </div>
                    <small className="pymtw-lisp-hint">
                        ≈ {formatCurrency(Math.round(monthly))}/mo · Mode: {value.frequency || 'Monthly'}
                    </small>
                </div>
                <div className="input-group pymtw-lisp-field">
                    <label htmlFor="pymtw-lisp-freq">Frequency</label>
                    <select
                        id="pymtw-lisp-freq"
                        value={value.frequency || 'Monthly'}
                        onChange={(e) => patch('frequency', e.target.value)}
                    >
                        {LISP_FREQUENCIES.map((f) => (
                            <option key={f} value={f}>{f}</option>
                        ))}
                    </select>
                </div>
                <div className="input-group pymtw-lisp-field">
                    <label htmlFor="pymtw-lisp-ppt">Premium Payment Term (Years)</label>
                    <input
                        id="pymtw-lisp-ppt"
                        type="number"
                        min={1}
                        max={50}
                        value={value.duration || 10}
                        onChange={(e) => patch('duration', parseInt(e.target.value, 10) || 1)}
                    />
                </div>
            </div>
            {priorMonths.length > 0 && (
                <div className="pymtw-instrument-stats pymtw-month-history">
                    {priorMonths.map((h) => (
                        <div key={h.planKey} className="pymtw-month-history-row">
                            <span>Already planned</span>
                            <strong>{formatCurrency(Math.round(h.monthlyAmount))}/mo</strong>
                            <span className="pymtw-month-history-label">Month {h.monthLabel}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * PYMTW Allocate-your-surplus shell: surplus header, progress bar, Save/Discard, expandable chips.
 */
const AllocateSurplusPanel = ({
    editingMonthLabel = '',
    totalSurplus = 0,
    allocatedAmount = 0,
    remainingSurplus = 0,
    isDirty = false,
    canSave = false,
    saveLabel = 'Save Plan',
    statusHint = '',
    applyError = '',
    saveSuccessMessage = '',
    onDiscard,
    onSave,
    avenues = [],
    expandedType = null,
    onExpandType,
    draftAllocations = {},
    getMaxAmountForInstrument,
    onDraftChange,
    onLispDraftChange,
    familyMembers = [],
    currentPlanKey = null,
    monthSwitchConfirm = null,
    replaceConfirm = null,
    surplusMonthChips = null,
}) => {
    const safeTotal = Math.max(0, totalSurplus);
    const allocated = Math.max(0, allocatedAmount);
    const remaining = Math.max(0, remainingSurplus);
    const pct = safeTotal > 0 ? Math.min(100, Math.round((allocated / safeTotal) * 100)) : 0;

    return (
        <div className="card pymtw-allocate-panel">
            <div className="pymtw-allocate-panel-header">
                <div>
                    <h3 className="pymtw-zone-title">Allocate your surplus</h3>
                    {editingMonthLabel && (
                        <p className="pymtw-editing-month">{editingMonthLabel}</p>
                    )}
                </div>
                <div className="pymtw-total-surplus">
                    <span className="pymtw-total-surplus-label">Total Surplus</span>
                    <strong className="pymtw-total-surplus-value">{formatCurrency(safeTotal)}</strong>
                </div>
            </div>

            {surplusMonthChips}

            <div className="pymtw-surplus-progress" role="group" aria-label="Surplus allocation progress">
                <div className="pymtw-surplus-progress-row">
                    <span>Allocated</span>
                    <strong>{formatCurrency(allocated)}</strong>
                </div>
                <div
                    className="pymtw-surplus-progress-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    aria-label={`${pct}% of surplus allocated`}
                >
                    <div className="pymtw-surplus-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="pymtw-surplus-progress-row">
                    <span>Remaining</span>
                    <strong>{formatCurrency(remaining)}</strong>
                </div>
            </div>

            <div className="pymtw-allocate-actions">
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onDiscard}
                    disabled={!isDirty}
                >
                    Discard Changes
                </button>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onSave}
                    disabled={!canSave}
                >
                    {saveLabel}
                </button>
            </div>
            {statusHint && <p className="pymtw-sticky-hint">{statusHint}</p>}
            {applyError && (
                <div className="pymtw-apply-error" role="alert">{applyError}</div>
            )}
            {saveSuccessMessage && (
                <div className="pymtw-save-success" role="status">{saveSuccessMessage}</div>
            )}
            {isDirty && (
                <div className="pymtw-unsaved-banner" role="status">
                    You have unsaved changes. Save Plan to update your monthly allocation.
                </div>
            )}

            {monthSwitchConfirm}
            {replaceConfirm}

            <div className="pymtw-avenues-block">
                <h4 className="pymtw-avenues-title">Investment Avenues</h4>
                <p className="pymtw-zone-sub">
                    Select an avenue to allocate part of your surplus.
                </p>
                <div className="pymtw-avenue-grid" role="list">
                    {avenues.map((avenue) => {
                        const Icon = AVENUE_ICONS[avenue.type] || TrendingUp;
                        const expanded = expandedType === avenue.type;
                        const amount = getDraftTypeAmount(draftAllocations, avenue.type);
                        const showBadge = Math.round(amount) > 0;
                        const panelId = `pymtw-avenue-panel-${avenue.type.replace(/\s+/g, '-')}`;
                        const maxAmount = getMaxAmountForInstrument
                            ? getMaxAmountForInstrument(avenue.type)
                            : Math.max(0, remaining) + amount;

                        return (
                            <div
                                key={avenue.type}
                                role="listitem"
                                className={`pymtw-avenue-chip-card ${expanded ? 'pymtw-avenue-chip-card-expanded' : ''}`}
                            >
                                <button
                                    type="button"
                                    className="pymtw-avenue-chip-header"
                                    aria-expanded={expanded}
                                    aria-controls={panelId}
                                    onClick={() => onExpandType(avenue.type)}
                                >
                                    <span className="pymtw-avenue-chip-header-main">
                                        <Icon size={18} aria-hidden="true" className="pymtw-avenue-chip-icon" />
                                        <span className="pymtw-expand-chip-label">
                                            {avenue.displayName || avenue.type}
                                        </span>
                                        {showBadge && (
                                            <span className="pymtw-expand-chip-badge">
                                                {formatCurrency(Math.round(amount))}
                                            </span>
                                        )}
                                    </span>
                                    <ChevronDown
                                        size={18}
                                        aria-hidden="true"
                                        className={`pymtw-avenue-chip-chevron ${expanded ? 'pymtw-avenue-chip-chevron-open' : ''}`}
                                    />
                                </button>

                                {expanded && (
                                    <div
                                        id={panelId}
                                        className="pymtw-avenue-chip-body"
                                        role="region"
                                        aria-label={`${avenue.displayName || avenue.type} allocation`}
                                    >
                                        {avenue.note && (
                                            <p className="pymtw-avenue-chip-note">{avenue.note}</p>
                                        )}
                                        {avenue.type === LISP_INSTRUMENT_TYPE ? (
                                            <LifeInsuranceSavingForm
                                                draft={draftAllocations[avenue.type]}
                                                maxMonthly={maxAmount}
                                                familyMembers={familyMembers}
                                                onChange={(next) => onLispDraftChange?.(next)}
                                                monthHistory={avenue.monthHistory}
                                                currentPlanKey={currentPlanKey}
                                            />
                                        ) : (
                                            <InstrumentAmountSlider
                                                instrumentType={avenue.type}
                                                displayName={avenue.displayName || avenue.type}
                                                draftAmount={draftAllocations[avenue.type] || 0}
                                                maxAmount={maxAmount}
                                                onDraftChange={onDraftChange}
                                                monthHistory={avenue.monthHistory}
                                                currentPlanKey={currentPlanKey}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AllocateSurplusPanel;
