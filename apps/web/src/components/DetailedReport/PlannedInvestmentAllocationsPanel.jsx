import React, { useEffect, useMemo, useState } from 'react';
import { PieChart, Trash2, Pencil } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { MONTH_LABELS_LONG } from './moneyFlowLedgerLogic';
import ReportReveal from './ReportReveal';

function labelForPlanKey(planKey) {
    if (!planKey || typeof planKey !== 'string') return 'This month';
    const [yearStr, monthStr] = planKey.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10);
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return planKey;
    const monthLabel = MONTH_LABELS_LONG[monthIndex] || 'Month';
    return `${monthLabel} ${year}`;
}

function monthKeyForItem(item) {
    if (item.studioPlanKey) return item.studioPlanKey;
    const startYear = parseInt(item.startYear, 10);
    const startMonth = parseInt(item.startMonth, 10);
    if (Number.isFinite(startYear) && Number.isFinite(startMonth) && startMonth >= 1 && startMonth <= 12) {
        return `${startYear}-${startMonth - 1}`;
    }
    return 'other';
}

function monthLabelForItem(item) {
    const key = monthKeyForItem(item);
    if (key === 'other') return 'Other';
    return labelForPlanKey(key);
}

const PlannedInvestmentAllocationsPanel = ({
    allocationsSummary,
    onRemove,
    onClearMonthPlan,
    onEditMonthPlan,
    clearDisabled = false,
    clearDisabledReason = '',
    delay = 200,
    className = '',
    title = 'Planned investment allocations',
    editLabel = 'Edit – Show Investment Avenues',
    monthChipsAriaLabel = 'Allocation months',
    plainSummary = false,
}) => {
    const monthChips = useMemo(() => {
        const order = [];
        const seen = new Set();
        (allocationsSummary?.items || []).forEach((item) => {
            const key = monthKeyForItem(item);
            if (seen.has(key)) return;
            seen.add(key);
            order.push({
                key,
                label: key === 'other' ? 'Other' : labelForPlanKey(key),
                planKey: item.studioPlanKey || (key !== 'other' ? key : null),
            });
        });
        return order;
    }, [allocationsSummary]);

    const [selectedMonthKey, setSelectedMonthKey] = useState(null);

    useEffect(() => {
        if (!monthChips.length) {
            setSelectedMonthKey(null);
            return;
        }
        setSelectedMonthKey((prev) => (
            monthChips.some((chip) => chip.key === prev) ? prev : monthChips[0].key
        ));
    }, [monthChips]);

    const selectedChip = monthChips.find((chip) => chip.key === selectedMonthKey) || monthChips[0] || null;

    const filteredItems = useMemo(() => {
        if (!selectedChip) return [];
        return (allocationsSummary?.items || []).filter(
            (item) => monthKeyForItem(item) === selectedChip.key
                && Math.round(item.amount || 0) > 0,
        );
    }, [allocationsSummary, selectedChip]);

    const selectedMonthCommitted = useMemo(
        () => filteredItems.reduce((sum, item) => sum + (item.amount || 0), 0),
        [filteredItems],
    );

    const hasPending = filteredItems.some((item) => item.pending);

    if (!allocationsSummary?.count) return null;

    const displayType = (item) => (
        item.type === 'Liquid Mutual Fund' ? 'Emergency Fund' : item.type
    );

    const isPlain = plainSummary || title.includes('Protection');

    return (
        <ReportReveal className={`${isPlain ? 'ius-alloc-plain-container' : 'card ius-alloc-card'} ${className}`.trim()} delay={delay} style={isPlain ? { background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, marginTop: '2.5rem' } : {}}>
            <div className="ius-alloc-header">
                <h3 className="ius-section-title">
                    <PieChart size={18} />
                    {title}
                </h3>
                {monthChips.length > 0 && (
                    <div className="ius-alloc-month-chips" role="tablist" aria-label={monthChipsAriaLabel}>
                        {monthChips.map((chip) => (
                            <button
                                key={chip.key}
                                type="button"
                                role="tab"
                                aria-selected={selectedChip?.key === chip.key}
                                className={`ius-alloc-month-chip ${selectedChip?.key === chip.key ? 'ius-alloc-month-chip-active' : ''}`}
                                onClick={() => setSelectedMonthKey(chip.key)}
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <p className="ius-alloc-sub">
                ₹{Math.round(allocationsSummary.monthlyCommitted).toLocaleString('en-IN')}/month committed
                across {allocationsSummary.count} plan{allocationsSummary.count > 1 ? 's' : ''}.
                {selectedChip && selectedChip.key !== 'other' && (
                    <>
                        {' '}
                        ₹{Math.round(selectedMonthCommitted).toLocaleString('en-IN')}/month
                        {hasPending ? ' pending' : ' committed'} for{' '}
                        {selectedChip.label}.
                    </>
                )}
            </p>

            {(plainSummary || title.includes('Protection')) ? (
                <div className="ius-alloc-plain-summary" style={{ marginTop: '0.75rem' }}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {filteredItems.map((item) => (
                            <li key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'var(--bg-main, #f8fafc)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.88rem' }}>
                                    <span style={{ color: 'var(--primary, #0f766e)' }}>✅</span>
                                    <span>{displayType(item)}</span>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>
                                    <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(item.amount)}/{item.isMonthly ? 'month' : 'one-time'}</strong>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {onEditMonthPlan && selectedChip?.planKey && (
                                        <button
                                            type="button"
                                            onClick={() => onEditMonthPlan(selectedChip.planKey)}
                                            style={{ fontSize: '0.78rem', color: 'var(--primary, #0f766e)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            Edit
                                        </button>
                                    )}
                                    {onRemove && (
                                        <button
                                            type="button"
                                            className="ius-alloc-remove-btn"
                                            onClick={() => onRemove(item)}
                                            style={{ fontSize: '0.78rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                        {filteredItems.length === 0 && (
                            <li style={{ padding: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                No protection allocations planned for this month yet.
                            </li>
                        )}
                    </ul>
                    {selectedChip?.planKey && onClearMonthPlan && (
                        <div style={{ textAlign: 'right' }}>
                            <button
                                type="button"
                                className="btn-link"
                                onClick={() => onClearMonthPlan(selectedChip.planKey)}
                                disabled={clearDisabled}
                                style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                Clear {selectedChip.label} plan
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {selectedChip?.planKey && (onClearMonthPlan || onEditMonthPlan) && (
                        <div className="ius-alloc-clear-row">
                            {onClearMonthPlan && (
                                <button
                                    type="button"
                                    className="btn ius-alloc-plan-btn ius-alloc-clear-btn"
                                    onClick={() => onClearMonthPlan(selectedChip.planKey)}
                                    disabled={clearDisabled}
                                    title={clearDisabled ? clearDisabledReason : undefined}
                                >
                                    <Trash2 size={14} />
                                    Clear {selectedChip.label} plan
                                </button>
                            )}
                            {onEditMonthPlan && (
                                <button
                                    type="button"
                                    className="btn btn-primary ius-alloc-plan-btn ius-alloc-edit-btn"
                                    onClick={() => onEditMonthPlan(selectedChip.planKey)}
                                >
                                    <Pencil size={14} />
                                    {editLabel}
                                </button>
                            )}
                        </div>
                    )}

                    <div className="ius-alloc-table-wrap">
                        <table className="ius-alloc-table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Month</th>
                                    <th>Amount</th>
                                    <th>Frequency</th>
                                    {onRemove && <th className="ius-alloc-actions-col">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item) => (
                                    <tr key={item.id} className={item.pending ? 'ius-alloc-row-pending' : undefined}>
                                        <td>
                                            <span className="ius-alloc-type-cell">
                                                {displayType(item)}
                                                {item.pending && (
                                                    <span className="ius-alloc-pending-badge">Pending</span>
                                                )}
                                            </span>
                                        </td>
                                        <td>{monthLabelForItem(item)}</td>
                                        <td>{formatCurrency(item.amount)}</td>
                                        <td>{item.isMonthly ? 'Monthly' : 'One-time (annual impact)'}</td>
                                        {onRemove && (
                                            <td>
                                                <button
                                                    type="button"
                                                    className="ius-alloc-remove-btn"
                                                    onClick={() => onRemove(item)}
                                                    aria-label={`Remove ${displayType(item)} for ${monthLabelForItem(item)}`}
                                                >
                                                    <Trash2 size={14} />
                                                    Remove
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {filteredItems.length === 0 && (
                                    <tr>
                                        <td colSpan={onRemove ? 5 : 4} className="ius-alloc-empty">
                                            No allocations for this month.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            <style>{`
                .ius-alloc-card { padding: 1.25rem; }
                .ius-alloc-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                    margin-bottom: 0.35rem;
                }
                .ius-alloc-header .ius-section-title { margin-bottom: 0; }
                .ius-alloc-month-chips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.4rem;
                    justify-content: flex-end;
                }
                .ius-alloc-month-chip {
                    border: 1px solid var(--border);
                    background: var(--bg-main);
                    color: var(--text-muted);
                    border-radius: 999px;
                    padding: 0.3rem 0.7rem;
                    font-size: 0.78rem;
                    font-weight: 600;
                    cursor: pointer;
                }
                .ius-alloc-month-chip-active {
                    border-color: rgba(5, 150, 105, 0.45);
                    background: rgba(16, 185, 129, 0.12);
                    color: #047857;
                }
                .ius-alloc-sub { margin: 0 0 1rem; font-size: 0.88rem; color: var(--text-muted); }
                .ius-section-title { margin: 0 0 1rem; font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem; }
                .ius-alloc-clear-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-bottom: 0.85rem;
                }
                .ius-alloc-plan-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    font-size: 0.82rem;
                    padding: 0.45rem 0.85rem;
                    font-weight: 600;
                }
                .ius-alloc-plan-btn:disabled {
                    opacity: 0.55;
                    cursor: not-allowed;
                }
                .ius-alloc-edit-btn {
                    box-shadow: 0 1px 2px rgba(16, 185, 129, 0.25);
                }
                .ius-alloc-clear-btn {
                    border: 1px solid rgba(185, 28, 28, 0.35);
                    background: rgba(254, 226, 226, 0.55);
                    color: #b91c1c;
                }
                .ius-alloc-clear-btn:hover:not(:disabled) {
                    background: rgba(254, 202, 202, 0.85);
                    border-color: rgba(185, 28, 28, 0.55);
                    color: #991b1b;
                }
                .ius-alloc-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
                .ius-alloc-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
                .ius-alloc-table th, .ius-alloc-table td { padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--border); text-align: left; }
                .ius-alloc-table th { background: var(--bg-main); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
                .ius-alloc-table tr:last-child td { border-bottom: none; }
                .ius-alloc-row-pending td { background: rgba(245, 158, 11, 0.06); }
                .ius-alloc-type-cell {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.45rem;
                    flex-wrap: wrap;
                }
                .ius-alloc-pending-badge {
                    display: inline-flex;
                    align-items: center;
                    font-size: 0.68rem;
                    font-weight: 700;
                    letter-spacing: 0.03em;
                    text-transform: uppercase;
                    color: #b45309;
                    background: rgba(251, 191, 36, 0.22);
                    border: 1px solid rgba(245, 158, 11, 0.35);
                    border-radius: 999px;
                    padding: 0.12rem 0.45rem;
                }
                .ius-alloc-empty { color: var(--text-muted); font-style: italic; }
                .ius-alloc-actions-col { width: 7rem; }
                .ius-alloc-remove-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    border: none;
                    background: transparent;
                    color: #b91c1c;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    padding: 0.2rem 0;
                }
                .ius-alloc-remove-btn:hover { text-decoration: underline; }
            `}</style>
        </ReportReveal>
    );
};

export default PlannedInvestmentAllocationsPanel;
