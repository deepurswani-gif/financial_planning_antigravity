import React from 'react';
import {
    Banknote, Home, AlertCircle, Info, Plus, Trash2, CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { clampLoanStartMonth, getLoanStartMonths } from './putYourMoneyToWorkLogic';
import ReportReveal from './ReportReveal';

const JourneyConstraintsRail = ({
    journeyConstraints,
    journeyAdjustments = [],
    setJourneyAdjustments,
    defaultStartMonthIndex = new Date().getMonth(),
    defaultCalendarYear = new Date().getFullYear(),
    selectableMonths = [],
    onSaveAdjustments,
    adjustmentsSaved = false,
    saveMessage = '',
}) => {
    const defaultStartMonth = Math.min(12, Math.max(1, defaultStartMonthIndex + 1));
    const monthLabel = (month) => new Date(2000, Math.max(0, (month || 1) - 1), 1)
        .toLocaleString('default', { month: 'short' });
    const standardExpenseMonths = selectableMonths.length > 0
        ? selectableMonths
        : [{ monthIndex: defaultStartMonthIndex, label: monthLabel(defaultStartMonth) }];
    const standardExpenses = journeyAdjustments.filter((adj) => (adj.type || 'expense') !== 'loan');
    const futureLoans = journeyAdjustments.filter((adj) => (adj.type || 'expense') === 'loan');

    const calculateEmi = (principal, rate, tenure) => {
        const p = parseFloat(principal) || 0;
        const r = parseFloat(rate) || 0;
        const n = parseFloat(tenure) || 0;
        if (p > 0 && r > 0 && n > 0) {
            const monthlyRate = r / 12 / 100;
            return Math.round((p * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1));
        }
        return 0;
    };

    const updateAdjustment = (id, field, value) => {
        if (!setJourneyAdjustments) return;
        setJourneyAdjustments((prev) => prev.map((adj) => (
            adj.id === id ? { ...adj, [field]: value } : adj
        )));
    };

    const updateLoanStartYear = (id, startYear) => {
        if (!setJourneyAdjustments) return;
        setJourneyAdjustments((prev) => prev.map((adj) => {
            if (adj.id !== id) return adj;
            const nextYear = parseInt(startYear, 10) || defaultCalendarYear;
            const startMonth = clampLoanStartMonth(
                adj.startMonth || defaultStartMonth,
                nextYear,
                defaultCalendarYear,
                defaultStartMonthIndex,
            );
            return { ...adj, startYear: nextYear, startMonth };
        }));
    };

    const updateStandardExpense = (id, field, value) => {
        if (!setJourneyAdjustments) return;
        setJourneyAdjustments((prev) => prev.map((adj) => (
            adj.id === id
                ? { ...adj, [field]: value, startYear: defaultCalendarYear }
                : adj
        )));
    };

    const addStandardExpense = () => {
        if (!setJourneyAdjustments) return;
        setJourneyAdjustments((prev) => [
            ...prev,
            {
                id: Date.now(),
                type: 'expense',
                name: '',
                startMonth: defaultStartMonth,
                startYear: defaultCalendarYear,
                duration: 1,
                amount: '',
                principal: '',
                rate: '',
                tenure: '',
                loanCategory: '',
                emi: 0,
            },
        ]);
    };

    const addFutureLoan = () => {
        if (!setJourneyAdjustments) return;
        setJourneyAdjustments((prev) => [
            ...prev,
            {
                id: Date.now() + 1,
                type: 'loan',
                name: '',
                startMonth: defaultStartMonth,
                startYear: defaultCalendarYear,
                duration: 1,
                amount: '',
                principal: '',
                rate: '',
                tenure: '',
                loanCategory: '',
                emi: 0,
            },
        ]);
    };

    const removeAdjustment = (id) => {
        if (!setJourneyAdjustments) return;
        setJourneyAdjustments((prev) => prev.filter((adj) => adj.id !== id));
    };

    return (
        <ReportReveal className="pymtw-zone-b card">
            <h3 className="pymtw-zone-title">
                <Banknote size={18} />
                Edit future financial adjustments
            </h3>
            <p className="pymtw-zone-sub">
                Capture one-time standard expenses and future loans before surplus allocation.
            </p>

            {setJourneyAdjustments && (
                <>
                    <div className="pymtw-adjust-head">
                        <h4 className="pymtw-zone-title">Standard expenses (one-time)</h4>
                        <button type="button" className="btn btn-secondary pymtw-adjust-add-btn" onClick={addStandardExpense}>
                            <Plus size={16} />
                            Add standard expense
                        </button>
                    </div>
                    <div className="pymtw-adjust-list">
                        {standardExpenses.map((adj) => (
                            <div key={adj.id} className="pymtw-adjust-card">
                                <div className="input-group">
                                    <label>Expense name</label>
                                    <input
                                        type="text"
                                        value={adj.name || ''}
                                        onChange={(e) => updateStandardExpense(adj.id, 'name', e.target.value)}
                                        placeholder="e.g. Vacation or laptop purchase"
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Occurs in month</label>
                                    <select
                                        value={adj.startMonth || defaultStartMonth}
                                        onChange={(e) => updateStandardExpense(adj.id, 'startMonth', parseInt(e.target.value, 10))}
                                    >
                                        {standardExpenseMonths.map((m) => (
                                            <option key={m.monthIndex} value={m.monthIndex + 1}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label>Occurs in year</label>
                                    <input
                                        type="number"
                                        value={defaultCalendarYear}
                                        readOnly
                                        disabled
                                        aria-label="Occurs in year"
                                    />
                                </div>
                                <div className="input-group">
                                    <label>One-time amount (INR)</label>
                                    <input
                                        type="number"
                                        value={adj.amount || ''}
                                        onChange={(e) => {
                                            if (!setJourneyAdjustments) return;
                                            setJourneyAdjustments((prev) => prev.map((item) => (
                                                item.id === adj.id
                                                    ? {
                                                        ...item,
                                                        amount: e.target.value,
                                                        duration: 1,
                                                        startYear: defaultCalendarYear,
                                                    }
                                                    : item
                                            )));
                                        }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-outline pymtw-adjust-remove-btn"
                                    onClick={() => removeAdjustment(adj.id)}
                                >
                                    <Trash2 size={16} />
                                    Remove
                                </button>
                            </div>
                        ))}
                        {standardExpenses.length === 0 && (
                            <div className="pymtw-empty-rail">
                                <Info size={18} />
                                <p>No standard one-time expenses added yet.</p>
                            </div>
                        )}
                    </div>

                    <div className="pymtw-adjust-head">
                        <h4 className="pymtw-zone-title">Future loans</h4>
                        <button type="button" className="btn btn-secondary pymtw-adjust-add-btn" onClick={addFutureLoan}>
                            <Plus size={16} />
                            Add future loan
                        </button>
                    </div>
                    <div className="pymtw-adjust-list">
                        {futureLoans.map((adj) => (
                            <div key={adj.id} className="pymtw-adjust-card">
                                <div className="input-group">
                                    <label>Loan category</label>
                                    <select
                                        value={adj.loanCategory || ''}
                                        onChange={(e) => {
                                            const loanCategory = e.target.value;
                                            const name = e.target.options[e.target.selectedIndex].text;
                                            const nextName = loanCategory ? name : '';
                                            setJourneyAdjustments((prev) => prev.map((item) => (
                                                item.id === adj.id ? { ...item, loanCategory, name: nextName } : item
                                            )));
                                        }}
                                    >
                                        <option value="">Select loan type</option>
                                        <option value="personalLoan">Personal Loan</option>
                                        <option value="homeLoan">Home Loan</option>
                                        <option value="educationLoan">Education Loan</option>
                                        <option value="carLoan">Car Loan</option>
                                        <option value="twoWheelerLoan">Two-Wheeler Loan</option>
                                        <option value="otherEmi">Other Loan</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label>Principal (INR)</label>
                                    <input
                                        type="number"
                                        value={adj.principal || ''}
                                        onChange={(e) => {
                                            const principal = e.target.value;
                                            const emi = calculateEmi(principal, adj.rate, adj.tenure);
                                            setJourneyAdjustments((prev) => prev.map((item) => (
                                                item.id === adj.id ? { ...item, principal, emi, amount: emi * 12 } : item
                                            )));
                                        }}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Rate (%)</label>
                                    <input
                                        type="number"
                                        value={adj.rate || ''}
                                        onChange={(e) => {
                                            const rate = e.target.value;
                                            const emi = calculateEmi(adj.principal, rate, adj.tenure);
                                            setJourneyAdjustments((prev) => prev.map((item) => (
                                                item.id === adj.id ? { ...item, rate, emi, amount: emi * 12 } : item
                                            )));
                                        }}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Tenure (months)</label>
                                    <input
                                        type="number"
                                        value={adj.tenure || ''}
                                        onChange={(e) => {
                                            const tenure = e.target.value;
                                            const emi = calculateEmi(adj.principal, adj.rate, tenure);
                                            setJourneyAdjustments((prev) => prev.map((item) => (
                                                item.id === adj.id
                                                    ? {
                                                        ...item,
                                                        tenure,
                                                        duration: Math.ceil((parseInt(tenure, 10) || 0) / 12),
                                                        emi,
                                                        amount: emi * 12,
                                                    }
                                                    : item
                                            )));
                                        }}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Start month</label>
                                    <select
                                        value={clampLoanStartMonth(
                                            adj.startMonth || defaultStartMonth,
                                            adj.startYear || defaultCalendarYear,
                                            defaultCalendarYear,
                                            defaultStartMonthIndex,
                                        )}
                                        onChange={(e) => updateAdjustment(adj.id, 'startMonth', parseInt(e.target.value, 10))}
                                    >
                                        {getLoanStartMonths(
                                            adj.startYear || defaultCalendarYear,
                                            defaultCalendarYear,
                                            defaultStartMonthIndex,
                                        ).map((m) => (
                                            <option key={m.value} value={m.value}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label>Start year</label>
                                    <input
                                        type="number"
                                        value={adj.startYear || defaultCalendarYear}
                                        min={defaultCalendarYear}
                                        onChange={(e) => updateLoanStartYear(adj.id, e.target.value)}
                                    />
                                </div>
                                <div className="pymtw-adjust-emi">
                                    Auto-calculated EMI: <strong>{formatCurrency(adj.emi || 0)}/mo</strong>
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-outline pymtw-adjust-remove-btn"
                                    onClick={() => removeAdjustment(adj.id)}
                                >
                                    <Trash2 size={16} />
                                    Remove
                                </button>
                            </div>
                        ))}
                        {futureLoans.length === 0 && (
                            <div className="pymtw-empty-rail">
                                <Info size={18} />
                                <p>No future loans added yet.</p>
                            </div>
                        )}
                    </div>

                    <div className="pymtw-adjust-save">
                        <button type="button" className="btn btn-primary" onClick={onSaveAdjustments}>
                            Save
                        </button>
                        {adjustmentsSaved && (
                            <div className="pymtw-adjust-saved-msg" role="status">
                                <CheckCircle2 size={16} />
                                <span>
                                    {saveMessage || 'Future financial adjustments saved. You can now proceed.'}
                                </span>
                            </div>
                        )}
                    </div>
                </>
            )}

            <div className="pymtw-adjust-summary">
                <h3 className="pymtw-zone-title">
                    <Banknote size={18} />
                    Future financial adjustments
                </h3>
                <p className="pymtw-zone-sub">
                    From Journey — these shape your surplus envelope in upcoming years.
                </p>
                {journeyConstraints?.hasItems ? (
                    <>
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
                                            {item.isLoan ? `from ${item.startYear}` : `${item.monthLabel} ${item.startYear}`}
                                        </span>
                                        <span className="pymtw-constraint-impact">
                                            {item.isLoan
                                                ? `${formatCurrency(item.monthlyImpact)}/mo (${formatCurrency(item.annualImpact)}/yr)`
                                                : `One-time ${formatCurrency(item.annualImpact)}`}
                                        </span>
                                        <span className="pymtw-constraint-note">{item.projectionNote}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="pymtw-empty-rail">
                        <Info size={18} />
                        <p>No future expenses or loans added yet. Your full surplus is available for allocation.</p>
                    </div>
                )}
            </div>
        </ReportReveal>
    );
};

export default JourneyConstraintsRail;
