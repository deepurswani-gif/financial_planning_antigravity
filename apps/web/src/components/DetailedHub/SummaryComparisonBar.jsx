import React from 'react';
import './SummaryComparisonBar.css';

const SummaryComparisonBar = ({ summaryTotal, breakdownTotal, formatInr }) => {
    const difference = summaryTotal - breakdownTotal;
    const isOver = difference < 0;
    const isBalanced = difference === 0;

    return (
        <div className="summary-comparison-container">
            <div className="summary-comparison-row">
                <span className="summary-comparison-label">Summary total</span>
                <span className="summary-comparison-value">{formatInr(summaryTotal)}</span>
            </div>
            <div className={`summary-comparison-row ${isOver ? 'error' : ''}`}>
                <span className="summary-comparison-label">Breakdown total</span>
                <span className="summary-comparison-value">{formatInr(breakdownTotal)}</span>
            </div>
            
            {!isBalanced && (
                <div className={`summary-comparison-warning ${!isOver ? 'warning-orange' : ''}`}>
                    {isOver ? 
                        `${formatInr(Math.abs(difference))} over summary limit.` : 
                        `${formatInr(difference)} left to account for.`}
                </div>
            )}
        </div>
    );
};

export default SummaryComparisonBar;
