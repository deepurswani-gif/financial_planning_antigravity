import React from 'react';

const formatInr = (val) => {
    if (!val || Number.isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(val);
};

/**
 * Shows match / remaining / over-allocated status for summary vs detail totals.
 * @param {{ status: string, delta?: number, summaryTotal?: number }} reconciliation
 */
export default function ReconciliationStatus({
    reconciliation,
    matchLabel = 'Fully allocated',
    underPrefix = 'Remaining to allocate:',
    overPrefix = 'Over allocated by',
}) {
    if (!reconciliation) return null;

    const { summaryTotal, status, delta } = reconciliation;

    if (summaryTotal <= 0 || status === 'empty') return null;

    if (status === 'match') {
        return (
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                {matchLabel}
            </span>
        );
    }

    if (status === 'under') {
        return (
            <span>
                {underPrefix}{' '}
                <strong style={{ color: 'var(--primary)' }}>{formatInr(delta)}</strong>
            </span>
        );
    }

    if (status === 'over') {
        return (
            <span style={{ color: 'var(--negative)' }}>
                {overPrefix} {formatInr(Math.abs(delta))}
            </span>
        );
    }

    return null;
}
