import React from 'react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';

const AllocationStudioStickyBar = ({
    editingMonthLabel = '',
    remainingSurplus = 0,
    totalMonthlyAllocation = 0,
    isDirty = false,
    canSave = false,
    saveLabel = 'Save Plan',
    statusHint = '',
    applyError = '',
    saveSuccessMessage = '',
    onDiscard,
    onSave,
    discardDisabled = false,
}) => (
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

export default AllocationStudioStickyBar;
