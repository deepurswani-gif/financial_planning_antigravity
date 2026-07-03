import React from 'react';
import { CheckCircle2, Save, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';

const ApplyPlanBar = ({
    deployableSurplus,
    totalAllocated,
    remaining,
    monthLabel,
    allocatedCount,
    validation,
    onSaveDraft,
    onApply,
    isApplied,
}) => {
    const isOverAllocated = remaining < 0;
    const canApply = validation?.canApply && !isApplied;
    const blockingErrors = validation?.issues?.filter((i) => i.severity === 'error') || [];

    return (
        <div className="pymtw-apply-bar">
            <div className="pymtw-apply-inner card">
                <div className="pymtw-apply-stats">
                    <div>
                        <span>{monthLabel} surplus</span>
                        <strong>{formatCurrency(deployableSurplus)}</strong>
                    </div>
                    <div>
                        <span>Allocated ({allocatedCount})</span>
                        <strong className="pymtw-apply-sip">{formatCurrency(totalAllocated)}</strong>
                    </div>
                    <div>
                        <span>Remaining</span>
                        <strong className={isOverAllocated ? 'pymtw-apply-over' : ''}>
                            {formatCurrency(remaining)}
                        </strong>
                    </div>
                </div>
                <div className="pymtw-apply-actions">
                    <button
                        type="button"
                        className="btn btn-secondary pymtw-save-btn"
                        onClick={onSaveDraft}
                        disabled={totalAllocated <= 0 || isOverAllocated}
                    >
                        <Save size={16} />
                        Save draft
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary pymtw-apply-btn"
                        onClick={onApply}
                        disabled={!canApply}
                    >
                        {isApplied ? (
                            <>
                                <CheckCircle2 size={16} />
                                Applied
                            </>
                        ) : (
                            'Apply plan'
                        )}
                    </button>
                </div>
                {blockingErrors.length > 0 && (
                    <div className="pymtw-apply-errors">
                        <AlertTriangle size={14} />
                        {blockingErrors[0].message}
                    </div>
                )}
                {isOverAllocated && blockingErrors.length === 0 && (
                    <p className="pymtw-apply-warning">
                        Allocation exceeds deployable surplus — reduce amounts to apply.
                    </p>
                )}
            </div>
        </div>
    );
};

export default ApplyPlanBar;
