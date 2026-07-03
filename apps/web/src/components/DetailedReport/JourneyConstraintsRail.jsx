import React from 'react';
import { Banknote, Home, AlertCircle, Info } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ReportReveal from './ReportReveal';

const JourneyConstraintsRail = ({ journeyConstraints }) => {
    if (!journeyConstraints?.hasItems) {
        return (
            <ReportReveal className="pymtw-zone-b card">
                <h3 className="pymtw-zone-title">
                    <Banknote size={18} />
                    Future financial adjustments
                </h3>
                <div className="pymtw-empty-rail">
                    <Info size={18} />
                    <p>No future expenses or loans added yet. Your full surplus is available for allocation.</p>
                </div>
            </ReportReveal>
        );
    }

    return (
        <ReportReveal className="pymtw-zone-b card">
            <h3 className="pymtw-zone-title">
                <Banknote size={18} />
                Future financial adjustments
            </h3>
            <p className="pymtw-zone-sub">
                From Journey — these shape your surplus envelope in upcoming years.
            </p>
            <div className="pymtw-constraint-list">
                {journeyConstraints.items.map((item) => (
                    <div
                        key={item.id}
                        className={`pymtw-constraint-chip ${item.isLoan ? 'pymtw-constraint-loan' : 'pymtw-constraint-expense'}`}
                    >
                        <div className="pymtw-constraint-icon">
                            {item.isLoan ? <Home size={16} /> : <AlertCircle size={16} />}
                        </div>
                        <div className="pymtw-constraint-body">
                            <strong>{item.name}</strong>
                            <span className="pymtw-constraint-meta">
                                {item.isLoan ? 'Future loan' : 'Standard expense'}
                                {' · '}
                                from {item.startYear}
                                {item.duration > 1 ? ` · ${item.duration} yrs` : ''}
                            </span>
                            <span className="pymtw-constraint-impact">
                                {formatCurrency(item.monthlyImpact)}/mo
                                {' '}
                                ({formatCurrency(item.annualImpact)}/yr)
                            </span>
                            <span className="pymtw-constraint-note">{item.projectionNote}</span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="pymtw-constraint-total">
                Combined annual impact when active:{' '}
                <strong>{formatCurrency(journeyConstraints.totalAnnualImpact)}</strong>
            </div>
        </ReportReveal>
    );
};

export default JourneyConstraintsRail;
