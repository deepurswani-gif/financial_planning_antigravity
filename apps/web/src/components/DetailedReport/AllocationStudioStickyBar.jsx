import React from 'react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';

const AllocationStudioStickyBar = ({
    editingMonthLabel = '',
    remainingSurplus = 0,
    totalMonthlyAllocation = 0,
    isDirty = false,
    canSave = false,
    saveLabel = 'Save',
    statusHint = '',
    applyError = '',
    saveSuccessMessage = '',
    onDiscard,
    onSave,
    discardDisabled = false,
    isGaps = false,
}) => {
    if (isGaps) {
        return (
            <div
                className="fyfg-sticky-bar"
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 30,
                    height: '56px',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                    borderBottom: '1px solid #E5E7EB',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 1rem',
                    marginBottom: '1rem',
                }}
            >
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                    Remaining: <span style={{ color: remainingSurplus >= 0 ? '#0f766e' : '#dc2626' }}>{formatCurrency(Math.max(0, remainingSurplus))}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        type="button"
                        onClick={onDiscard}
                        disabled={discardDisabled || !isDirty}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: isDirty ? '#dc2626' : '#94a3b8',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: isDirty ? 'pointer' : 'default',
                            padding: 0,
                        }}
                    >
                        Discard
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={!canSave}
                        style={{
                            height: '36px',
                            padding: '8px 16px',
                            fontSize: '14px',
                            fontWeight: 600,
                            borderRadius: '8px',
                            background: canSave ? '#0f766e' : '#cbd5e1',
                            color: '#ffffff',
                            border: 'none',
                            cursor: canSave ? 'pointer' : 'not-allowed',
                            transition: 'background 0.15s ease',
                        }}
                    >
                        Save
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="pymtw-sticky-action-bar" role="region" aria-label="Allocation draft actions">
        <div className="pymtw-sticky-action-main">
            <div className="pymtw-sticky-meta">
                <strong className="pymtw-sticky-month">{editingMonthLabel}</strong>
                <div className="pymtw-sticky-kpis">
                    <div className="pymtw-sticky-kpi">
                        <span className="pymtw-sticky-kpi-label">Remaining Surplus</span>
                        <strong>{formatCurrency(Math.max(0, remainingSurplus))}</strong>
                    </div>
                    <div className="pymtw-sticky-kpi">
                        <span className="pymtw-sticky-kpi-label">Total Monthly Allocation</span>
                        <strong>{formatCurrency(Math.max(0, totalMonthlyAllocation))}</strong>
                    </div>
                </div>
                <div
                    className={`pymtw-sticky-status ${isDirty ? 'pymtw-sticky-status-dirty' : 'pymtw-sticky-status-saved'}`}
                    aria-live="polite"
                >
                    {isDirty ? '● Unsaved Changes' : '✓ All changes saved'}
                </div>
                {statusHint && (
                    <p className="pymtw-sticky-hint">{statusHint}</p>
                )}
            </div>
            <div className="pymtw-sticky-actions">
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onDiscard}
                    disabled={discardDisabled || !isDirty}
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
        </div>
        {applyError && (
            <div className="pymtw-apply-error" role="alert">{applyError}</div>
        )}
        {saveSuccessMessage && (
            <div className="pymtw-save-success" role="status">{saveSuccessMessage}</div>
        )}
    </div>
    );
};

export default AllocationStudioStickyBar;
