import React, { useState, useRef, useEffect } from 'react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { getGoalIcon } from '../DetailedFlow/goalIcons';
import { JOURNEY_TABLE_ROWS } from './lifeJourneyTableLogic';

const formatCell = (value) => {
    if (value === null || value === undefined) return '';
    return formatCurrency(Math.round(value));
};

const GoalIcons = ({ goals, size = 16 }) => {
    if (!goals?.length) return null;
    const visible = goals.slice(0, 3);
    const overflow = goals.length - visible.length;

    return (
        <div className="lj-goal-icons">
            {visible.map((goal) => {
                const Icon = getGoalIcon(goal);
                const title = `${goal.name}${goal.futureCost ? ` — ${formatCurrency(goal.futureCost)}` : ''}`;
                return (
                    <span key={goal.id} className="lj-goal-icon" title={title}>
                        <Icon size={size} />
                    </span>
                );
            })}
            {overflow > 0 && (
                <span className="lj-goal-overflow" title={goals.slice(3).map((g) => g.name).join(', ')}>
                    +{overflow}
                </span>
            )}
        </div>
    );
};

const OutflowPopover = ({ row, onClose }) => (
    <div className="lj-popover fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="lj-popover-item">
            <span>Household (Inflation adj.)</span>
            <strong>{formatCurrency(row.householdOutflow)}</strong>
        </div>
        <div className="lj-popover-item">
            <span>EMIs</span>
            <strong>{formatCurrency(row.emiOutflow)}</strong>
        </div>
        <div className="lj-popover-item">
            <span>Education expenses</span>
            <strong>{formatCurrency(row.educationExpenses)}</strong>
        </div>
        {row.journeyAdjustments?.length > 0 && (
            <>
                <div className="lj-popover-divider" />
                <div className="lj-popover-subtitle">Targeted Goals &amp; Adjustments</div>
                {row.journeyAdjustments.map((adj, i) => (
                    <div className="lj-popover-item" key={i}>
                        <span style={{ color: 'var(--primary)' }}>{adj.name}</span>
                        <strong style={{ color: 'var(--primary)' }}>{formatCurrency(adj.amount)}</strong>
                    </div>
                ))}
            </>
        )}
        <div className="lj-popover-divider" />
        <div className="lj-popover-total">
            <span>Total outflow</span>
            <strong>{formatCurrency(row.totalOutflow)}</strong>
        </div>
        <button type="button" className="lj-popover-close" onClick={onClose}>Close</button>
    </div>
);

const SavingsPopover = ({ row, onClose }) => (
    <div className="lj-popover fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="lj-popover-subtitle">Savings &amp; Investments Breakdown</div>
        <div className="lj-popover-item">
            <span>Insurance Premiums</span>
            <strong>{formatCurrency(row.insurancePremium)}</strong>
        </div>
        <div className="lj-popover-item">
            <span>PPF</span>
            <strong>{formatCurrency(row.savingsBreakdown?.ppf)}</strong>
        </div>
        <div className="lj-popover-item">
            <span>NPS</span>
            <strong>{formatCurrency(row.savingsBreakdown?.nps)}</strong>
        </div>
        <div className="lj-popover-item">
            <span>RD</span>
            <strong>{formatCurrency(row.savingsBreakdown?.rdTotal)}</strong>
        </div>
        <div className="lj-popover-item">
            <span>MF-SIP</span>
            <strong>{formatCurrency(row.savingsBreakdown?.sip)}</strong>
        </div>
        <div className="lj-popover-item">
            <span>Any other savings</span>
            <strong>{formatCurrency(row.savingsBreakdown?.otherSaving)}</strong>
        </div>
        <div className="lj-popover-divider" />
        <div className="lj-popover-total">
            <span>Total Savings</span>
            <strong>{formatCurrency(row.savingsAndInvestments)}</strong>
        </div>
        <button type="button" className="lj-popover-close" onClick={onClose}>Close</button>
    </div>
);

const TransposedJourneyTable = ({ projections, goalsByYear, hasGoals }) => {
    const [activePopover, setActivePopover] = useState(null);
    const popoverRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setActivePopover(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!projections?.length) {
        return (
            <div className="lj-empty-table card">
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    No future-year projections available. Check your profile and retirement age.
                </p>
            </div>
        );
    }

    const years = projections.map((p) => p.year);
    const projectionByYear = Object.fromEntries(projections.map((p) => [p.year, p]));

    return (
        <div className="lj-table-scroll" ref={popoverRef}>
            <table className="lj-table">
                <thead>
                    <tr>
                        <th className="lj-sticky-col lj-th-label">Particular (₹)</th>
                        {years.map((year) => (
                            <th key={year} className="lj-year-col">
                                <span className="lj-col-year">{year}</span>
                                <GoalIcons goals={goalsByYear[year]} size={14} />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {JOURNEY_TABLE_ROWS.map((rowDef) => (
                        <tr key={rowDef.key} className={`lj-data-row lj-row-${rowDef.role}`}>
                            <td className={`lj-row-label lj-sticky-col lj-row-${rowDef.role}`}>
                                <span className="lj-sign">{rowDef.sign}</span>
                                <span>{rowDef.label}</span>
                            </td>
                            {years.map((year) => {
                                const row = projectionByYear[year];
                                const val = row?.[rowDef.key];
                                const isNegative = rowDef.role === 'result' && val < 0;
                                const isTaxColored = rowDef.highlightNonZero && val !== 0;
                                const popoverKey = `${rowDef.breakdown}-${year}`;

                                return (
                                    <td
                                        key={`${rowDef.key}-${year}`}
                                        className={[
                                            'lj-cell',
                                            rowDef.breakdown ? 'lj-cell-breakdown' : '',
                                            isNegative ? 'lj-cell-negative' : '',
                                            isTaxColored && val < 0 ? 'lj-cell-tax-refund' : '',
                                            isTaxColored && val > 0 ? 'lj-cell-tax-due' : '',
                                            rowDef.role === 'result' && val >= 0 ? 'lj-cell-surplus-positive' : '',
                                        ].filter(Boolean).join(' ')}
                                    >
                                        {rowDef.breakdown ? (
                                            <button
                                                type="button"
                                                className="lj-breakdown-btn"
                                                onClick={() => setActivePopover(
                                                    activePopover === popoverKey ? null : popoverKey,
                                                )}
                                            >
                                                {formatCell(val)}
                                            </button>
                                        ) : (
                                            formatCell(val)
                                        )}
                                        {activePopover === popoverKey && rowDef.breakdown === 'outflow' && (
                                            <OutflowPopover row={row} onClose={() => setActivePopover(null)} />
                                        )}
                                        {activePopover === popoverKey && rowDef.breakdown === 'savings' && (
                                            <SavingsPopover row={row} onClose={() => setActivePopover(null)} />
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                    {hasGoals && (
                        <tr className="lj-data-row lj-row-goals">
                            <td className="lj-row-label lj-sticky-col lj-row-goals">
                                <span className="lj-sign">★</span>
                                <span>Life Goals</span>
                            </td>
                            {years.map((year) => (
                                <td key={`goals-${year}`} className="lj-cell lj-cell-goals">
                                    <GoalIcons goals={goalsByYear[year]} size={18} />
                                </td>
                            ))}
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default TransposedJourneyTable;
