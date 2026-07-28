import React from 'react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ThreeMonthSurplusGrid from './ThreeMonthSurplusGrid';

const RecalculatedSurplusPanel = ({
    outlook = [],
    onProceed,
    proceedLabel = 'Proceed to Investment Avenues to allocate the surplus',
    showProceed = true,
    showFormula = true,
}) => {
    const formulaCards = showFormula
        ? outlook.map((card) => ({
            ...card,
            calculationLines: [
                `Surplus before ${formatCurrency(card.ledgerUnallocated || 0)}`,
                `− Protection ${formatCurrency(card.protectionImpact || 0)}`,
                `− Future financial adjustments ${formatCurrency(card.journeyImpact || 0)}`,
                `= Remaining ${formatCurrency(card.deployableSurplus || 0)}`,
            ],
        }))
        : outlook;

    return (
        <div className="card pymtw-recalculated-surplus-card">
            <div className="pymtw-recalculated-body">
                <span className="pymtw-recalculated-label">Recalculated unallocated surplus</span>
                <p className="pymtw-recalculated-sub">
                    Surplus before − Protection − Future financial adjustments = Remaining for long-term goals.
                </p>
                <ThreeMonthSurplusGrid
                    outlook={formulaCards}
                    variant="recalc"
                    animate={false}
                />
            </div>
            {showProceed && onProceed && (
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onProceed}
                >
                    {proceedLabel}
                </button>
            )}
        </div>
    );
};

export default RecalculatedSurplusPanel;
