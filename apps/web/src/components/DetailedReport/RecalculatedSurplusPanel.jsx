import React from 'react';
import ThreeMonthSurplusGrid from './ThreeMonthSurplusGrid';

const RecalculatedSurplusPanel = ({
    outlook = [],
    onProceed,
}) => (
    <div className="card pymtw-recalculated-surplus-card">
        <div className="pymtw-recalculated-body">
            <span className="pymtw-recalculated-label">Recalculated unallocated surplus</span>
            <p className="pymtw-recalculated-sub">
                After future financial adjustments — investible surplus for the next three months.
            </p>
            <ThreeMonthSurplusGrid
                outlook={outlook}
                variant="recalc"
                animate={false}
            />
        </div>
        <button
            type="button"
            className="btn btn-primary"
            onClick={onProceed}
        >
            Proceed to Investment Avenues to allocate the surplus
        </button>
    </div>
);

export default RecalculatedSurplusPanel;
