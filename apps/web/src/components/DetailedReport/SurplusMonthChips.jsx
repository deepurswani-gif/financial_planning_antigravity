import React from 'react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';

/**
 * Selectable month chips/cards for Gaps / PYMTW.
 * @param {'ledger'|'deployable'} amountKey - which outlook field to show
 */
const SurplusMonthChips = ({
    months = [],
    outlook = [],
    selectedMonthIndex = null,
    onSelect,
    amountKey = 'ledger',
    className = '',
}) => {
    if (!months?.length) return null;

    const amountFor = (monthIndex) => {
        const card = outlook.find((o) => o.monthIndex === monthIndex);
        if (!card) return 0;
        if (amountKey === 'deployable') return card.deployableSurplus || 0;
        return card.ledgerUnallocated ?? card.deployableSurplus ?? 0;
    };

    return (
        <div className={`surplus-month-chips ${className}`.trim()} role="listbox" aria-label="Select month">
            {months.map((month) => {
                const selected = selectedMonthIndex === month.monthIndex;
                const amount = amountFor(month.monthIndex);
                return (
                    <button
                        key={month.monthIndex}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`surplus-month-chip ${selected ? 'surplus-month-chip-selected' : ''}`}
                        onClick={() => onSelect?.(month.monthIndex)}
                    >
                        <span className="surplus-month-chip-label">{month.shortLabel || month.label}</span>
                        <strong className="surplus-month-chip-amount">{formatCurrency(amount)}</strong>
                    </button>
                );
            })}
            <style>{`
                .surplus-month-chips {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 0.75rem;
                }
                .surplus-month-chip {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 0.35rem;
                    padding: 0.9rem 1rem;
                    border: 1px solid var(--border-color, #e2e8f0);
                    border-radius: 12px;
                    background: var(--card-bg, #fff);
                    cursor: pointer;
                    text-align: left;
                    transition: border-color 0.15s ease, box-shadow 0.15s ease;
                }
                .surplus-month-chip:hover {
                    border-color: var(--primary, #0f766e);
                }
                .surplus-month-chip-selected {
                    border-color: var(--primary, #0f766e);
                    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary, #0f766e) 25%, transparent);
                }
                .surplus-month-chip-label {
                    font-size: 0.85rem;
                    color: var(--text-muted, #64748b);
                    font-weight: 600;
                }
                .surplus-month-chip-amount {
                    font-size: 1.1rem;
                    color: var(--text-main, #0f172a);
                }
            `}</style>
        </div>
    );
};

export default SurplusMonthChips;
