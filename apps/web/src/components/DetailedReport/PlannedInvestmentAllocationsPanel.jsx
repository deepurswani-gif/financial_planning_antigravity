import React, { useMemo } from 'react';
import { PieChart, Trash2 } from 'lucide-react';
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

const PlannedInvestmentAllocationsPanel = ({
    allocationsSummary,
    onRemove,
    onClearMonthPlan,
    delay = 200,
    className = '',
}) => {
    const studioPlanKeys = useMemo(() => {
        const keys = new Set();
        (allocationsSummary?.items || []).forEach((item) => {
            if (item.studioPlanKey) keys.add(item.studioPlanKey);
        });
        return [...keys];
    }, [allocationsSummary]);

    if (!allocationsSummary?.count) return null;

    return (
        <ReportReveal className={`card ius-alloc-card ${className}`.trim()} delay={delay}>
            <h3 className="ius-section-title">
                <PieChart size={18} />
                Planned investment allocations
            </h3>
            <p className="ius-alloc-sub">
                ₹{Math.round(allocationsSummary.monthlyCommitted).toLocaleString('en-IN')}/month committed across {allocationsSummary.count} plan{allocationsSummary.count > 1 ? 's' : ''}.
            </p>

            {studioPlanKeys.length > 0 && onClearMonthPlan && (
                <div className="ius-alloc-clear-row">
                    {studioPlanKeys.map((planKey) => (
                        <button
                            key={planKey}
                            type="button"
                            className="btn btn-secondary ius-alloc-clear-btn"
                            onClick={() => onClearMonthPlan(planKey)}
                        >
                            Clear {labelForPlanKey(planKey)} plan
                        </button>
                    ))}
                </div>
            )}

            <div className="ius-alloc-table-wrap">
                <table className="ius-alloc-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Name</th>
                            <th>Amount</th>
                            <th>Frequency</th>
                            {onRemove && <th className="ius-alloc-actions-col">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {allocationsSummary.items.map((item) => (
                            <tr key={item.id}>
                                <td>{item.type}</td>
                                <td>{item.name}</td>
                                <td>{formatCurrency(item.amount)}</td>
                                <td>{item.isMonthly ? 'Monthly' : 'One-time (annual impact)'}</td>
                                {onRemove && (
                                    <td>
                                        <button
                                            type="button"
                                            className="ius-alloc-remove-btn"
                                            onClick={() => onRemove(item.id)}
                                            aria-label={`Remove ${item.name}`}
                                        >
                                            <Trash2 size={14} />
                                            Remove
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <style>{`
                .ius-alloc-card { padding: 1.25rem; }
                .ius-alloc-sub { margin: -0.5rem 0 1rem; font-size: 0.88rem; color: var(--text-muted); }
                .ius-section-title { margin: 0 0 1rem; font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem; }
                .ius-alloc-clear-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-bottom: 0.85rem;
                }
                .ius-alloc-clear-btn {
                    font-size: 0.82rem;
                    padding: 0.4rem 0.75rem;
                }
                .ius-alloc-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
                .ius-alloc-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
                .ius-alloc-table th, .ius-alloc-table td { padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--border); text-align: left; }
                .ius-alloc-table th { background: var(--bg-main); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
                .ius-alloc-table tr:last-child td { border-bottom: none; }
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
