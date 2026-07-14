import React from 'react';
import ReconciliationStickyPanel from './ReconciliationStickyPanel';

const formatInr = (val) => {
    const num = parseFloat(val);
    if (!val || Number.isNaN(num)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(num);
};

function getRemainingSegment(reconciliation) {
    if (!reconciliation || reconciliation.summaryTotal <= 0 || reconciliation.status === 'empty') {
        return null;
    }

    const { status, delta } = reconciliation;

    if (status === 'match') {
        return { text: 'Fully allocated', className: 'reconciliation-bar__remaining--match' };
    }
    if (status === 'under') {
        return {
            text: `Remaining to allocate ${formatInr(delta)}`,
            className: 'reconciliation-bar__remaining--under',
        };
    }
    if (status === 'over') {
        return {
            text: `Over allocated by ${formatInr(Math.abs(delta))}`,
            className: 'reconciliation-bar__remaining--over',
        };
    }
    return null;
}

/**
 * Inline summary vs detailed bar — docked below step navigation via portal.
 */
export default function ReconciliationBar({
    summaryLabel,
    detailLabel,
    summaryAmount,
    detailAmount,
    reconciliation,
    visible = true,
}) {
    if (!visible || !reconciliation || reconciliation.summaryTotal <= 0) {
        return null;
    }

    const remaining = getRemainingSegment(reconciliation);

    return (
        <ReconciliationStickyPanel visible={visible}>
            <div className="reconciliation-bar">
                <span className="reconciliation-bar__segment">
                    {summaryLabel}{' '}
                    <strong>{formatInr(summaryAmount ?? reconciliation.summaryTotal)}</strong>
                </span>
                <span className="reconciliation-bar__divider" aria-hidden="true">|</span>
                <span className="reconciliation-bar__segment">
                    {detailLabel}{' '}
                    <strong>{formatInr(detailAmount ?? reconciliation.detailTotal)}</strong>
                </span>
                {remaining && (
                    <>
                        <span className="reconciliation-bar__divider" aria-hidden="true">|</span>
                        <span className={`reconciliation-bar__segment ${remaining.className}`}>
                            {remaining.text}
                        </span>
                    </>
                )}
            </div>
        </ReconciliationStickyPanel>
    );
}
