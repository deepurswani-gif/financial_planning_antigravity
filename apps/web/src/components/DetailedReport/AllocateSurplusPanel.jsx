import React, { useRef, useState } from 'react';
import {
    TrendingUp, Coins, Landmark, PiggyBank, BarChart2, Shield, ChevronDown,
} from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import CurrencyInput from '../common/CurrencyInput';
import YearsInput from '../common/YearsInput';
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
    const [inputValue, setInputValue] = useState(
        draftAmount == null || draftAmount === '' ? '' : String(draftAmount)
    );
    const [syncedDraft, setSyncedDraft] = useState(draftAmount);
    const pendingRef = useRef(undefined);

    // Sync local draft text when the parent amount changes (e.g. slider / reset).
    if (draftAmount !== syncedDraft) {
        setSyncedDraft(draftAmount);
        setInputValue(draftAmount == null || draftAmount === '' ? '' : String(draftAmount));
    }

    const commitAmount = (raw) => {
        const parsed = Math.round(Number(raw ?? 0));
        const clamped = Math.max(0, Math.min(parsed, Math.max(0, maxAmount)));
        if (clamped === Math.round(draftAmount || 0)) {
            setInputValue(String(clamped));
            return;
        }
        onDraftChange(instrumentType, clamped);
        setInputValue(String(clamped));
    };

    const currentVal = Math.min(draftAmount || 0, Math.max(0, maxAmount));
    const pct = maxAmount > 0 ? Math.min(100, Math.max(0, (currentVal / maxAmount) * 100)) : 0;

    const addQuickChip = (val) => {
        const next = Math.max(0, Math.min(maxAmount, (draftAmount || 0) + val));
        onDraftChange(instrumentType, next);
    };

    const priorMonths = (monthHistory || []).filter(
        (h) => h.planKey !== currentPlanKey && Math.round(h.monthlyAmount || 0) > 0,
    );

    return (
        <div className="pymtw-sip-slider-block">
            <div className="pymtw-sip-slider-head">
                <span>Set monthly allocation</span>
                <div className="pymtw-amount-input-wrap">
                    <CurrencyInput
                        className="pymtw-amount-input"
                        min={0}
                        max={Math.max(0, maxAmount)}
                        value={inputValue === '' || inputValue == null ? '' : inputValue}
                        onValueChange={(v) => {
                            pendingRef.current = v;
                            setInputValue(v == null ? '' : String(v));
                        }}
                        onBlur={() => {
                            const raw = pendingRef.current !== undefined
                                ? pendingRef.current
                                : inputValue;
                            pendingRef.current = undefined;
                            commitAmount(raw == null ? '' : String(raw));
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        aria-label={`${displayName || instrumentType} amount`}
                    />
                    {amountSuffix && <span className="pymtw-amount-suffix">{amountSuffix}</span>}
                </div>
            </div>

            <div className="pymtw-slider-track-container" style={{ position: 'relative', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                <div
                    className="pymtw-slider-floating-badge"
                    style={{
                        position: 'absolute',
                        top: '-1.4rem',
                        left: `clamp(1rem, ${pct}%, calc(100% - 2.5rem))`,
                        transform: 'translateX(-50%)',
                        background: 'var(--primary, #0f766e)',
                        color: '#fff',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '999px',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    }}
                >
                    {formatCurrency(currentVal)}
                </div>
                <input
                    type="range"
                    className="pymtw-sip-slider"
                    min={0}
                    max={Math.max(0, maxAmount)}
                    step={def?.step || 500}
                    value={currentVal}
                    onChange={(e) => {
                        const next = parseInt(e.target.value, 10) || 0;
                        if (next === Math.round(draftAmount || 0)) return;
                        onDraftChange(instrumentType, next);
                    }}
                    aria-label={`${displayName || instrumentType} allocation slider`}
                />
            </div>

            <div className="pymtw-sip-slider-labels" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
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

export const LifeInsuranceSavingForm = ({
    draft,
    maxMonthly = 0,
    familyMembers = [],
    onChange,
    monthHistory = [],
    currentPlanKey = null,
    instrumentType = LISP_INSTRUMENT_TYPE,
    validationErrors = {},
    onDone,
}) => {
    const value = isLispDraft(draft) ? draft : createEmptyLispDraft(instrumentType);
    const monthly = getLispDraftMonthly(value);
    const priorMonths = (monthHistory || []).filter(
        (h) => h.planKey !== currentPlanKey && Math.round(h.monthlyAmount || 0) > 0,
    );

    const patch = (field, nextVal) => {
        onChange({ ...value, [field]: nextVal });
    };

    const maxPremium = (() => {
        const freq = String(value.frequency || 'Monthly').toLowerCase();
        if (freq === 'quarterly') return Math.round(maxMonthly * 3);
        if (freq === 'half-yearly' || freq === 'half yearly') return Math.round(maxMonthly * 6);
        if (freq === 'annual' || freq === 'annually') return Math.round(maxMonthly * 12);
        return Math.round(maxMonthly);
    })();

    const typeKey = instrumentType.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const currentVal = Math.min(value.premium || 0, Math.max(0, maxPremium));
    const pct = maxPremium > 0 ? Math.min(100, Math.max(0, (currentVal / maxPremium) * 100)) : 0;

    return (
        <div className="pymtw-lisp-form">
            <p className="pymtw-lisp-question" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-main)' }}>
                How much would you like to set aside for {instrumentType.toLowerCase()} this month?
            </p>

            <div className="pymtw-sip-slider-block">
                <div className="pymtw-sip-slider-head">
                    <span>Monthly premium</span>
                    <div className="pymtw-amount-input-wrap">
                        <CurrencyInput
                            id={`pymtw-${typeKey}-premium`}
                            className="pymtw-amount-input"
                            min={0}
                            max={Math.max(0, maxPremium)}
                            value={value.premium === 0 || value.premium === '0' ? 0 : (value.premium ?? '')}
                            onValueChange={(v) => patch('premium', v)}
                        />
                        <span className="pymtw-amount-suffix">/mo</span>
                    </div>
                </div>

                <div className="pymtw-slider-track-container" style={{ position: 'relative', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                    <div
                        className="pymtw-slider-floating-badge"
                        style={{
                            position: 'absolute',
                            top: '-1.4rem',
                            left: `clamp(1rem, ${pct}%, calc(100% - 2.5rem))`,
                            transform: 'translateX(-50%)',
                            background: 'var(--primary, #0f766e)',
                            color: '#fff',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '999px',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                        }}
                    >
                        {formatCurrency(currentVal)}
                    </div>
                    <input
                        type="range"
                        className="pymtw-sip-slider"
                        min={0}
                        max={Math.max(0, maxPremium)}
                        step={500}
                        value={currentVal}
                        onChange={(e) => {
                            const next = parseInt(e.target.value, 10) || 0;
                            patch('premium', next);
                        }}
                        aria-label={`${instrumentType} allocation slider`}
                    />
                </div>

                <div className="pymtw-sip-slider-labels" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>₹0</span>
                    <span>{formatCurrency(maxPremium)}</span>
                </div>
            </div>

            {/* Mandatory policy fields always visible */}
            <div className="pymtw-lisp-grid" style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px dashed var(--border)' }}>
                <div className="input-group pymtw-lisp-field">
                    <label htmlFor={`pymtw-${typeKey}-member`} style={{ fontWeight: 600 }}>
                        Insured Member <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                        id={`pymtw-${typeKey}-member`}
                        value={value.insuredMember || ''}
                        onChange={(e) => patch('insuredMember', e.target.value)}
                        style={validationErrors?.memberError ? { borderColor: '#ef4444' } : {}}
                    >
                        <option value="">Select Member</option>
                        {(familyMembers || []).map((m) => {
                            const name = m.name || m.relation;
                            return (
                                <option key={m.id || name} value={name}>{name}</option>
                            );
                        })}
                    </select>
                    {validationErrors?.memberError && (
                        <span style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
                            {validationErrors.memberError}
                        </span>
                    )}
                </div>
                <div className="input-group pymtw-lisp-field">
                    <label htmlFor={`pymtw-${typeKey}-freq`} style={{ fontWeight: 600 }}>
                        Frequency <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                        id={`pymtw-${typeKey}-freq`}
                        value={value.frequency || 'Monthly'}
                        onChange={(e) => patch('frequency', e.target.value)}
                    >
                        {LISP_FREQUENCIES.map((f) => (
                            <option key={f} value={f}>{f}</option>
                        ))}
                    </select>
                </div>
                <div className="input-group pymtw-lisp-field">
                    <label htmlFor={`pymtw-${typeKey}-ppt`} style={{ fontWeight: 600 }}>
                        Premium Payment Term (Years) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <YearsInput
                        id={`pymtw-${typeKey}-ppt`}
                        min={1}
                        max={50}
                        value={value.duration ?? ''}
                        onValueChange={(v) => patch('duration', v)}
                        style={validationErrors?.durationError ? { borderColor: '#ef4444' } : {}}
                    />
                    {validationErrors?.durationError && (
                        <span style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
                            {validationErrors.durationError}
                        </span>
                    )}
                </div>
            </div>

            {onDone && (
                <div style={{ textAlign: 'right', marginTop: '1rem' }}>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={onDone}
                        style={{ padding: '0.45rem 1.1rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: '8px' }}
                    >
                        Done ✓
                    </button>
                </div>
            )}

            {priorMonths.length > 0 && (
                <div className="pymtw-instrument-stats pymtw-month-history" style={{ marginTop: '0.75rem' }}>
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
                                        {avenue.type === LISP_INSTRUMENT_TYPE || avenue.type === 'Term Insurance' ? (
                                            <LifeInsuranceSavingForm
                                                instrumentType={avenue.type}
                                                draft={draftAllocations[avenue.type]}
                                                maxMonthly={maxAmount}
                                                familyMembers={familyMembers}
                                                onChange={(next) => onLispDraftChange?.(next, avenue.type)}
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
