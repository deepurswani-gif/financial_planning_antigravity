import React from 'react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ReportAnimatedCounter from './ReportAnimatedCounter';

const SurplusCard = ({ card, variant = 'hero', animate = true }) => {
    const value = card.deployableSurplus || 0;
    const ValueTag = animate ? ReportAnimatedCounter : ({ value: v }) => (
        <span>{formatCurrency(v)}</span>
    );

    return (
        <div className={`pymtw-surplus-month-card pymtw-surplus-month-${variant}`}>
            <span className="pymtw-surplus-month-title">{card.title}</span>
            <strong className="pymtw-surplus-month-value">
                <ValueTag value={value} />
            </strong>
            {card.allocationsInMonth?.length > 0 && (
                <ul className="pymtw-surplus-alloc-list">
                    {card.allocationsInMonth.map((item) => (
                        <li key={`${card.monthIndex}-${item.type}`}>
                            <span className="pymtw-surplus-alloc-chip">{item.label}</span>
                            <span>{formatCurrency(item.amount)}</span>
                        </li>
                    ))}
                </ul>
            )}
            {card.calculationLines?.length > 0 && (
                <div className="pymtw-surplus-calc-lines">
                    {card.calculationLines.map((line) => (
                        <p key={line} className="pymtw-surplus-calc-line">{line}</p>
                    ))}
                </div>
            )}
        </div>
    );
};

const ThreeMonthSurplusGrid = ({
    outlook = [],
    variant = 'hero',
    animate = true,
    className = '',
}) => {
    if (!outlook?.length) return null;

    const columnClass = outlook.length === 1
        ? 'pymtw-surplus-grid-1'
        : outlook.length === 2
            ? 'pymtw-surplus-grid-2'
            : 'pymtw-surplus-grid-3';

    return (
        <div className={`pymtw-surplus-month-grid ${columnClass} ${className}`.trim()}>
            {outlook.map((card) => (
                <SurplusCard
                    key={card.monthIndex}
                    card={card}
                    variant={variant}
                    animate={animate}
                />
            ))}
        </div>
    );
};

export default ThreeMonthSurplusGrid;
