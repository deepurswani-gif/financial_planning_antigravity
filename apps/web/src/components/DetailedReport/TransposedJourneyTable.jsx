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
    const [selectedYear, setSelectedYear] = useState(null);
    const [mobileView, setMobileView] = useState('card'); // 'card' | 'table'
    const popoverRef = useRef(null);

    useEffect(() => {
        if (projections?.length && !selectedYear) {
            setSelectedYear(projections[0].year);
        }
    }, [projections, selectedYear]);

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
    const currentSelectedRow = projectionByYear[selectedYear] || projections[0];

    return (
        <div ref={popoverRef}>
            <div className="lj-mobile-controls">
                <div className="lj-mobile-toggle">
                    <button
                        type="button"
                        className={`lj-mob-btn ${mobileView === 'card' ? 'active' : ''}`}
                        onClick={() => setMobileView('card')}
                    >
                        Card View
                    </button>
                    <button
                        type="button"
                        className={`lj-mob-btn ${mobileView === 'table' ? 'active' : ''}`}
                        onClick={() => setMobileView('table')}
                    >
                        Full Table
                    </button>
                </div>

                {mobileView === 'card' && (
                    <div className="lj-year-select-wrap">
                        <label htmlFor="lj-year-select" className="lj-year-select-label">Select Year:</label>
                        <select
                            id="lj-year-select"
                            className="lj-year-select"
                            value={selectedYear || years[0]}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                        >
                            {years.map((y) => (
                                <option key={y} value={y}>
                                    {y} {goalsByYear[y]?.length ? `(${goalsByYear[y].length} goal${goalsByYear[y].length > 1 ? 's' : ''})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {mobileView === 'card' && currentSelectedRow && (
                <div className="lj-mobile-card-view card">
                    <div className="lj-mob-card-header">
                        <div>
                            <span className="lj-mob-year-badge">Year {currentSelectedRow.year}</span>
                            <h4 style={{ margin: '0.25rem 0 0', fontSize: '1.1rem' }}>Projections &amp; Cash Flow</h4>
                        </div>
                        {hasGoals && <GoalIcons goals={goalsByYear[currentSelectedRow.year]} size={20} />}
                    </div>

                    <div className="lj-mob-card-body">
                        {JOURNEY_TABLE_ROWS.map((rowDef) => {
                            const val = currentSelectedRow[rowDef.key];
                            const isNegative = rowDef.role === 'result' && val < 0;
                            const isTaxColored = rowDef.highlightNonZero && val !== 0;
                            const popoverKey = `${rowDef.breakdown}-${currentSelectedRow.year}`;

                            return (
                                <div
                                    key={rowDef.key}
                                    className={[
                                        'lj-mob-row',
                                        `lj-mob-row-${rowDef.role}`,
                                        isNegative ? 'is-negative' : '',
                                    ].filter(Boolean).join(' ')}
                                >
                                    <span className="lj-mob-row-label">{rowDef.label}</span>
                                    <div className="lj-mob-row-value">
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
                                            <strong className={[
                                                isNegative ? 'lj-cell-negative' : '',
                                                isTaxColored && val < 0 ? 'lj-cell-tax-refund' : '',
                                                isTaxColored && val > 0 ? 'lj-cell-tax-due' : '',
                                                rowDef.role === 'result' && val >= 0 ? 'lj-cell-surplus-positive' : '',
                                            ].filter(Boolean).join(' ')}>
                                                {formatCell(val)}
                                            </strong>
                                        )}
                                        {activePopover === popoverKey && rowDef.breakdown === 'outflow' && (
                                            <OutflowPopover row={currentSelectedRow} onClose={() => setActivePopover(null)} />
                                        )}
                                        {activePopover === popoverKey && rowDef.breakdown === 'savings' && (
                                            <SavingsPopover row={currentSelectedRow} onClose={() => setActivePopover(null)} />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className={`lj-table-scroll ${mobileView === 'card' ? 'lj-hide-desktop-only' : ''}`}>
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

            <style>{`
                .lj-mobile-controls { display: none; margin-bottom: 1rem; flex-direction: column; gap: 0.75rem; }
                .lj-mobile-toggle { display: flex; gap: 0; background: var(--bg-main); padding: 4px; border-radius: 8px; border: 1px solid var(--border); width: fit-content; }
                .lj-mob-btn { padding: 0.4rem 0.85rem; border: none; border-radius: 6px; background: transparent; color: var(--text-muted); font-weight: 600; font-size: 0.8rem; cursor: pointer; }
                .lj-mob-btn.active { background: var(--primary); color: white; }
                .lj-year-select-wrap { display: flex; align-items: center; gap: 0.5rem; }
                .lj-year-select-label { font-size: 0.82rem; font-weight: 600; color: var(--text-muted); }
                .lj-year-select { padding: 0.45rem 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-main); font-size: 0.88rem; font-weight: 600; flex: 1; }

                .lj-mobile-card-view { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
                .lj-mob-card-header { display: flex; justify-content: space-between; align-items: flex-start; }
                .lj-mob-year-badge { font-size: 0.72rem; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.04em; }
                .lj-mob-card-body { display: flex; flex-direction: column; gap: 0.6rem; }
                .lj-mob-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.85rem; border-bottom: 1px solid var(--border); }
                .lj-mob-row-subtotal { background: rgba(37,99,235,0.06); font-weight: 700; }
                .lj-mob-row-result { background: rgba(16,185,129,0.08); font-weight: 700; }
                .lj-mob-row-label { color: var(--text-main); }
                .lj-mob-row-value { position: relative; }

                @media (max-width: 640px) {
                    .lj-mobile-controls { display: flex; }
                    .lj-hide-desktop-only { display: none; }
                }
            `}</style>
        </div>
    );
};

export default TransposedJourneyTable;
