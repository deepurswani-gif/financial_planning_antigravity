import React, { useMemo, useState } from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatInr = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

/**
 * Temporary what-if explorer for SIP / Lumpsum / Equity calculators.
 * Local state only — never persists to calculatorInputs or modules.
 *
 * @param {'sip'|'lumpsum'|'equity'} mode
 * @param {(events: Array) => Array<{year:number, valueAfterWithdrawal:number, endValueBeforeWithdrawal?:number}>} runProjection
 * @param {number} minYear - first projection year
 * @param {number} maxYear - last projection year (inclusive)
 * @param {number} [defaultMonth]
 * @param {number} [defaultYear]
 */
const WhatIfExplorer = ({
    mode = 'sip',
    runProjection,
    minYear,
    maxYear,
    defaultMonth = new Date().getMonth() + 1,
    defaultYear = new Date().getFullYear(),
}) => {
    const addAction = mode === 'sip' ? 'increment' : 'addition';
    const addLabel = mode === 'sip' ? 'Increase SIP' : 'Add';

    const clampedDefaultYear = Math.min(Math.max(defaultYear, minYear), maxYear);
    const [action, setAction] = useState(addAction);
    const [amount, setAmount] = useState('');
    const [eventMonth, setEventMonth] = useState(defaultMonth);
    const [eventYear, setEventYear] = useState(clampedDefaultYear);
    const [targetYear, setTargetYear] = useState(maxYear);

    const yearOptions = useMemo(() => {
        const years = [];
        for (let y = minYear; y <= maxYear; y++) years.push(y);
        return years;
    }, [minYear, maxYear]);

    const reset = () => {
        setAction(addAction);
        setAmount('');
        setEventMonth(defaultMonth);
        setEventYear(clampedDefaultYear);
        setTargetYear(maxYear);
    };

    const amountNum = parseFloat(amount) || 0;
    const safeEventYear = Math.min(Math.max(eventYear, minYear), maxYear);
    const safeTargetYear = Math.min(Math.max(targetYear, minYear), maxYear);
    const eventBeforeOrAtTarget =
        safeEventYear < safeTargetYear ||
        (safeEventYear === safeTargetYear);

    const baselineRows = useMemo(() => runProjection([]), [runProjection]);

    const approxAvailable = useMemo(() => {
        const sameYear = baselineRows.find((r) => r.year === safeEventYear);
        if (sameYear?.endValueBeforeWithdrawal != null) return sameYear.endValueBeforeWithdrawal;
        if (sameYear?.valueAfterWithdrawal != null) return sameYear.valueAfterWithdrawal;
        const prior = baselineRows.find((r) => r.year === safeEventYear - 1);
        return prior?.valueAfterWithdrawal ?? 0;
    }, [baselineRows, safeEventYear]);

    const withdrawalTooLarge = action === 'withdrawal' && amountNum > 0 && amountNum > approxAvailable;
    const appliedWithdrawal = withdrawalTooLarge ? Math.max(0, approxAvailable) : amountNum;

    const overlayEvent = useMemo(() => {
        if (amountNum <= 0 || !eventBeforeOrAtTarget) return null;
        const appliedAmount = action === 'withdrawal' ? appliedWithdrawal : amountNum;
        if (appliedAmount <= 0) return null;
        return {
            id: 'what-if-temp',
            type: action,
            amount: appliedAmount,
            month: eventMonth,
            year: safeEventYear,
        };
    }, [amountNum, eventBeforeOrAtTarget, action, appliedWithdrawal, eventMonth, safeEventYear]);

    const scenarioRows = useMemo(() => {
        if (!overlayEvent) return baselineRows;
        return runProjection([overlayEvent]);
    }, [runProjection, overlayEvent, baselineRows]);

    const baselineValue = baselineRows.find((r) => r.year === safeTargetYear)?.valueAfterWithdrawal ?? null;
    const scenarioValue = scenarioRows.find((r) => r.year === safeTargetYear)?.valueAfterWithdrawal ?? null;
    const hasResult = amountNum > 0 && baselineValue != null && scenarioValue != null && eventBeforeOrAtTarget;
    const delta = hasResult ? scenarioValue - baselineValue : 0;

    const sentenceVerb =
        action === 'withdrawal' ? 'withdraw' : mode === 'sip' ? 'increase my monthly SIP by' : 'add';

    const inputStyle = {
        display: 'inline-block',
        padding: '0.35rem 0.5rem',
        fontSize: '0.9rem',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        background: 'var(--bg-main)',
        verticalAlign: 'middle',
        margin: '0 0.25rem',
    };

    const actionBtn = (value, label, activeColor) => {
        const active = action === value;
        return (
            <button
                type="button"
                onClick={() => setAction(value)}
                style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: active ? `1px solid ${activeColor}` : '1px solid var(--border)',
                    background: active ? (value === 'withdrawal' ? '#fff1f2' : '#ecfdf5') : 'var(--bg-main)',
                    color: active ? activeColor : 'var(--text-muted)',
                }}
            >
                {label}
            </button>
        );
    };

    return (
        <div
            style={{
                background: '#f0fdfa',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px dashed #5eead4',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FlaskConical size={18} color="#0f766e" />
                        What-if explorer
                        <span
                            style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color: '#0f766e',
                                background: '#ccfbf1',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                            }}
                        >
                            Temporary · not saved
                        </span>
                    </h3>
                    <p className="text-muted" style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
                        Temporary only — It does not change your SIP, allocations, or any module.
                    </p>
                </div>
                <button
                    type="button"
                    className="btn"
                    onClick={reset}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.8rem',
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border)',
                    }}
                >
                    <RotateCcw size={14} /> Reset
                </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {actionBtn(addAction, addLabel, '#059669')}
                {actionBtn('withdrawal', 'Withdraw', '#e11d48')}
            </div>

            <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.9, color: 'var(--text-main)' }}>
                If I {sentenceVerb}{' '}
                <input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="amount"
                    style={{ ...inputStyle, width: '8rem' }}
                    aria-label="What-if amount"
                />
                {mode === 'sip' && action === 'increment' ? ' from ' : ' in '}
                <select
                    value={eventMonth}
                    onChange={(e) => setEventMonth(parseInt(e.target.value, 10))}
                    style={{ ...inputStyle, width: 'auto' }}
                    aria-label="Event month"
                >
                    {MONTH_NAMES.map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                    ))}
                </select>
                <select
                    value={safeEventYear}
                    onChange={(e) => setEventYear(parseInt(e.target.value, 10))}
                    style={{ ...inputStyle, width: 'auto' }}
                    aria-label="Event year"
                >
                    {yearOptions.map((y) => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
                , what is my {mode === 'sip' ? 'corpus' : 'portfolio value'} at end of{' '}
                <select
                    value={safeTargetYear}
                    onChange={(e) => setTargetYear(parseInt(e.target.value, 10))}
                    style={{ ...inputStyle, width: 'auto' }}
                    aria-label="Target year"
                >
                    {yearOptions.map((y) => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
                ?
            </p>

            {!eventBeforeOrAtTarget && amountNum > 0 && (
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#b45309' }}>
                    Event month/year must be on or before the target year.
                </p>
            )}

            {withdrawalTooLarge && (
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#b45309' }}>
                    Withdrawal exceeds approximate balance (~{formatInr(approxAvailable)}) in {MONTH_NAMES[eventMonth - 1]} {safeEventYear}. Scenario uses {formatInr(appliedWithdrawal)}.
                </p>
            )}

            <div
                style={{
                    marginTop: '1.25rem',
                    padding: '1rem 1.25rem',
                    borderRadius: '10px',
                    background: hasResult ? 'var(--bg-main)' : '#f1f5f9',
                    border: '1px solid var(--border)',
                }}
            >
                {hasResult ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
                            → {formatInr(scenarioValue)}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            vs baseline {formatInr(baselineValue)}, difference{' '}
                            <span style={{ fontWeight: 700, color: delta >= 0 ? '#059669' : '#e11d48' }}>
                                {delta >= 0 ? '+' : '−'}{formatInr(Math.abs(delta))}
                            </span>
                        </div>
                    </div>
                ) : (
                    <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                        Enter an amount to see the projected {mode === 'sip' ? 'corpus' : 'portfolio value'} for the target year.
                    </p>
                )}
            </div>
        </div>
    );
};

export default WhatIfExplorer;
