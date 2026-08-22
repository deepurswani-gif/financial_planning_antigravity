import React, { useEffect, useRef, useState } from 'react';
import {
    Banknote, Home, AlertCircle, Info, Plus, Trash2, CheckCircle2, ChevronDown,
} from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import {
    clampLoanStartMonth,
    groupJourneyConstraintsByMonth,
    validateJourneyAdjustmentsAgainstSurplus,
} from './putYourMoneyToWorkLogic';
import ReportReveal from './ReportReveal';
import CurrencyInput from '../common/CurrencyInput';
import PercentageInput from '../common/PercentageInput';
import IntegerInput from '../common/IntegerInput';

const ADJUSTMENT_CATEGORIES = [
    { id: 'standard_expenses', label: 'Standard expenses (one-time)' },
    { id: 'future_loans', label: 'Future Loans' },
];

const parseAmount = (value) => Number(value ?? 0);

const isExpenseDraft = (adj) => (adj.type || 'expense') !== 'loan';

const isDraftConfigured = (adj) => {
    if (!isExpenseDraft(adj)) {
        return Boolean(adj.loanCategory)
            && parseAmount(adj.principal) > 0
            && parseAmount(adj.rate) > 0
            && (parseInt(adj.tenure, 10) || 0) > 0;
    }
    return parseAmount(adj.amount) > 0;
};

const JourneyConstraintsRail = ({
    journeyConstraints,
    journeyAdjustments = [],
    setJourneyAdjustments,
    defaultStartMonthIndex = new Date().getMonth(),
    defaultCalendarYear = new Date().getFullYear(),
    selectableMonths = [],
    unallocatedSurplusByMonth = [],
    investmentAllocations = [],
    planStartMonth = 0,
    onSaveAdjustments,
    onSkipAdjustments,
    adjustmentsSaved = false,
    saveMessage = '',
}) => {
    const [draftAdjustments, setDraftAdjustments] = useState([]);
    const [saveError, setSaveError] = useState('');
    const [saveErrorCategory, setSaveErrorCategory] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [savingCategory, setSavingCategory] = useState(null);
    const savingRef = useRef(false);
    const categoryFooterRefs = useRef({});

    useEffect(() => {
        if (draftAdjustments.length === 0) {
            savingRef.current = false;
            setSavingCategory(null);
        }
    }, [draftAdjustments]);

    const planningMonthIndex = selectableMonths.length > 0
        ? selectableMonths[0].monthIndex
        : defaultStartMonthIndex;
    const defaultStartMonth = Math.min(12, Math.max(1, planningMonthIndex + 1));
    const monthLabel = (month) => new Date(2000, Math.max(0, (month || 1) - 1), 1)
        .toLocaleString('default', { month: 'short' });
    const standardExpenseMonths = selectableMonths.length > 0
        ? selectableMonths
        : [{ monthIndex: planningMonthIndex, label: monthLabel(defaultStartMonth) }];
    // Same PYMTW window as standard expenses (current + 2) — not the Allocate month picker.
    const loanStartMonths = standardExpenseMonths.map((m) => ({
        monthIndex: m.monthIndex,
        value: m.monthIndex + 1,
        label: m.label,
    }));

    // Keep all in-progress drafts visible across the PYMTW month window (current + 2).
    const standardExpenses = draftAdjustments.filter(isExpenseDraft);
    const futureLoans = draftAdjustments.filter((adj) => !isExpenseDraft(adj));
    const configuredExpenses = standardExpenses.filter(isDraftConfigured);
    const configuredLoans = futureLoans.filter(isDraftConfigured);

    const monthGroupedSummary = groupJourneyConstraintsByMonth(
        journeyConstraints?.items || [],
        selectableMonths,
        defaultCalendarYear,
    );

    const createExpenseDraft = () => ({
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
    });

    const createLoanDraft = () => ({
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
    });

    const clearSaveError = () => {
        setSaveError('');
        setSaveErrorCategory(null);
    };

    const ensureFirstDraft = (categoryId) => {
        setDraftAdjustments((prev) => {
            if (categoryId === 'standard_expenses') {
                if (prev.some(isExpenseDraft)) return prev;
                return [...prev, createExpenseDraft()];
            }
            if (prev.some((adj) => !isExpenseDraft(adj))) return prev;
            return [...prev, createLoanDraft()];
        });
    };

    const toggleCategory = (id) => {
        const isClosing = expandedId === id;
        if (isClosing) {
            setExpandedId(null);
            return;
        }
        setExpandedId(id);
        ensureFirstDraft(id);
    };

    const calculateEmi = (principal, rate, tenure) => {
        const p = Number(principal ?? 0);
        const r = Number(rate ?? 0);
        const n = Number(tenure ?? 0);
        if (p > 0 && r > 0 && n > 0) {
            const monthlyRate = r / 12 / 100;
            return Math.round((p * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1));
        }
        return 0;
    };

    const updateStandardExpense = (id, field, value) => {
        setDraftAdjustments((prev) => prev.map((adj) => (
            adj.id === id
                ? { ...adj, [field]: value, startYear: defaultCalendarYear }
                : adj
        )));
        clearSaveError();
    };

    const updateLoanStartMonth = (id, startMonth) => {
        const nextMonth = clampLoanStartMonth(
            startMonth,
            defaultCalendarYear,
            defaultCalendarYear,
            planningMonthIndex,
        );
        setDraftAdjustments((prev) => prev.map((adj) => (
            adj.id === id
                ? { ...adj, startMonth: nextMonth, startYear: defaultCalendarYear }
                : adj
        )));
        clearSaveError();
    };

    const addStandardExpense = () => {
        setExpandedId('standard_expenses');
        setDraftAdjustments((prev) => [...prev, createExpenseDraft()]);
        clearSaveError();
    };

    const addFutureLoan = () => {
        setExpandedId('future_loans');
        setDraftAdjustments((prev) => [...prev, createLoanDraft()]);
        clearSaveError();
    };

    const removeDraft = (id) => {
        setDraftAdjustments((prev) => prev.filter((adj) => adj.id !== id));
        clearSaveError();
    };

    const removeCommitted = (id) => {
        if (!setJourneyAdjustments) return;
        setJourneyAdjustments((prev) => prev.filter((adj) => adj.id !== id));
    };

    const handleSaveCategory = (categoryId) => {
        const toCommit = categoryId === 'standard_expenses' ? configuredExpenses : configuredLoans;
        if (!toCommit.length || savingRef.current) return;

        savingRef.current = true;
        setSavingCategory(categoryId);

        const combined = [...journeyAdjustments, ...toCommit];
        const validation = validateJourneyAdjustmentsAgainstSurplus(
            combined,
            unallocatedSurplusByMonth,
            defaultCalendarYear,
            {
                investmentAllocations,
                planStartMonth,
                selectableMonths: standardExpenseMonths,
            },
        );
        if (!validation.ok) {
            savingRef.current = false;
            setSavingCategory(null);
            setSaveError(validation.message);
            setSaveErrorCategory(categoryId);
            categoryFooterRefs.current[categoryId]?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
            return;
        }

        if (setJourneyAdjustments) {
            setJourneyAdjustments((prev) => [...prev, ...toCommit]);
        }
        setDraftAdjustments((prev) => (
            categoryId === 'standard_expenses'
                ? prev.filter((adj) => !isExpenseDraft(adj))
                : prev.filter(isExpenseDraft)
        ));
        clearSaveError();
        savingRef.current = false;
        setSavingCategory(null);
        onSaveAdjustments?.();
    };

    const handleNoFutureAdjustments = () => {
        setDraftAdjustments([]);
        clearSaveError();
        onSkipAdjustments?.();
    };

    const summaryGridClass = monthGroupedSummary.length === 1
        ? 'pymtw-adjust-summary-grid-1'
        : monthGroupedSummary.length === 2
            ? 'pymtw-adjust-summary-grid-2'
            : 'pymtw-adjust-summary-grid-3';

    const renderCategoryFooter = (categoryId, { onAdd, canSave }) => {
        const isSaving = savingCategory === categoryId;
        return (
            <div
                className="pymtw-adjust-category-footer"
                ref={(el) => {
                    categoryFooterRefs.current[categoryId] = el;
                }}
            >
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleSaveCategory(categoryId)}
                    disabled={!canSave || Boolean(savingCategory)}
                >
                    {isSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                    type="button"
                    className="btn btn-secondary pymtw-adjust-add-btn"
                    onClick={onAdd}
                >
                    <Plus size={16} />
                    Add New
                </button>
                {saveError && saveErrorCategory === categoryId && (
                    <div className="pymtw-adjust-save-error" role="alert">
                        <AlertCircle size={16} />
                        <span>{saveError}</span>
                    </div>
                )}
            </div>
        );
    };

    const renderStandardExpenses = () => (
        <>
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
                            <IntegerInput
                                value={defaultCalendarYear}
                                readOnly
                                disabled
                                aria-label="Occurs in year"
                            />
                        </div>
                        <div className="input-group">
                            <label>One-time amount (INR)</label>
                            <CurrencyInput
                                value={adj.amount || ''}
                                onValueChange={(v) => {
                                    setDraftAdjustments((prev) => prev.map((item) => (
                                        item.id === adj.id
                                            ? {
                                                ...item,
                                                amount: v == null ? '' : String(v),
                                                duration: 1,
                                                startYear: defaultCalendarYear,
                                            }
                                            : item
                                    )));
                                    clearSaveError();
                                }}
                            />
                        </div>
                        <button
                            type="button"
                            className="btn btn-outline pymtw-adjust-remove-btn"
                            onClick={() => removeDraft(adj.id)}
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
            {renderCategoryFooter('standard_expenses', {
                onAdd: addStandardExpense,
                canSave: configuredExpenses.length > 0,
            })}
        </>
    );

    const renderFutureLoans = () => (
        <>
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
                                    setDraftAdjustments((prev) => prev.map((item) => (
                                        item.id === adj.id ? { ...item, loanCategory, name: nextName } : item
                                    )));
                                    clearSaveError();
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
                            <CurrencyInput
                                value={adj.principal || ''}
                                onValueChange={(v) => {
                                    const principal = v == null ? '' : String(v);
                                    const emi = calculateEmi(v, adj.rate, adj.tenure);
                                    setDraftAdjustments((prev) => prev.map((item) => (
                                        item.id === adj.id ? { ...item, principal, emi, amount: emi * 12 } : item
                                    )));
                                    clearSaveError();
                                }}
                            />
                        </div>
                        <div className="input-group">
                            <label>Rate (%)</label>
                            <PercentageInput
                                value={adj.rate || ''}
                                onValueChange={(v) => {
                                    const rate = v == null ? '' : String(v);
                                    const emi = calculateEmi(adj.principal, v, adj.tenure);
                                    setDraftAdjustments((prev) => prev.map((item) => (
                                        item.id === adj.id ? { ...item, rate, emi, amount: emi * 12 } : item
                                    )));
                                    clearSaveError();
                                }}
                            />
                        </div>
                        <div className="input-group">
                            <label>Tenure (months)</label>
                            <IntegerInput
                                value={adj.tenure || ''}
                                min={1}
                                onValueChange={(v) => {
                                    const tenure = v == null ? '' : String(v);
                                    const emi = calculateEmi(adj.principal, adj.rate, v);
                                    setDraftAdjustments((prev) => prev.map((item) => (
                                        item.id === adj.id
                                            ? {
                                                ...item,
                                                tenure,
                                                duration: Math.ceil(Number(v ?? 0) / 12),
                                                emi,
                                                amount: emi * 12,
                                            }
                                            : item
                                    )));
                                    clearSaveError();
                                }}
                            />
                        </div>
                        <div className="input-group">
                            <label>Start month</label>
                            <select
                                value={clampLoanStartMonth(
                                    adj.startMonth || defaultStartMonth,
                                    defaultCalendarYear,
                                    defaultCalendarYear,
                                    planningMonthIndex,
                                )}
                                onChange={(e) => updateLoanStartMonth(adj.id, parseInt(e.target.value, 10))}
                            >
                                {loanStartMonths.map((m) => (
                                    <option key={m.value} value={m.value}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="input-group">
                            <label>Start year</label>
                            <IntegerInput
                                value={defaultCalendarYear}
                                readOnly
                                disabled
                                aria-label="Start year"
                            />
                        </div>
                        <div className="pymtw-adjust-emi">
                            Auto-calculated EMI: <strong>{formatCurrency(adj.emi || 0)}/mo</strong>
                        </div>

                        <button
                            type="button"
                            className="btn btn-outline pymtw-adjust-remove-btn"
                            onClick={() => removeDraft(adj.id)}
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
            {renderCategoryFooter('future_loans', {
                onAdd: addFutureLoan,
                canSave: configuredLoans.length > 0,
            })}
        </>
    );

    const [hasUpcomingAdjustments, setHasUpcomingAdjustments] = useState(
        () => (journeyAdjustments?.length > 0 || draftAdjustments?.length > 0 || false),
    );

    const handleAnswerNo = () => {
        setHasUpcomingAdjustments(false);
        handleNoFutureAdjustments();
    };

    const handleAnswerYes = () => {
        setHasUpcomingAdjustments(true);
        if (!expandedId) setExpandedId('standard_expenses');
    };

    return (
        <ReportReveal className="pymtw-zone-b card">
            <h3 className="pymtw-zone-title" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                <Banknote size={18} />
                Future Financial Adjustments
            </h3>
            <p className="pymtw-zone-sub" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Any big one-time expenses or new loans coming in the next 3 months?
            </p>

            <div className="fyfg-gateway-options" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <button
                    type="button"
                    className={`btn ${hasUpcomingAdjustments ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={handleAnswerYes}
                    style={{ padding: '0.6rem 1.25rem', fontWeight: 600, borderRadius: '10px' }}
                >
                    Yes, add one
                </button>
                <button
                    type="button"
                    className={`btn ${!hasUpcomingAdjustments && adjustmentsSaved ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={handleAnswerNo}
                    style={{ padding: '0.6rem 1.25rem', fontWeight: 600, borderRadius: '10px' }}
                >
                    No, skip this
                </button>
            </div>

            {hasUpcomingAdjustments && setJourneyAdjustments && (
                <>
                    {ADJUSTMENT_CATEGORIES.map((category) => {
                        const isOpen = expandedId === category.id;
                        return (
                            <div
                                key={category.id}
                                className={`pymtw-category-block ${isOpen ? 'pymtw-category-open' : ''}`}
                            >
                                <button
                                    type="button"
                                    className="pymtw-category-toggle"
                                    aria-expanded={isOpen}
                                    onClick={() => toggleCategory(category.id)}
                                >
                                    <div className="pymtw-category-toggle-main">
                                        <h4 className="pymtw-category-label">{category.label}</h4>
                                    </div>
                                    <span className={`pymtw-category-action ${isOpen ? 'pymtw-category-action-open' : ''}`}>
                                        <span className="pymtw-category-action-label">
                                            {isOpen ? 'Hide' : 'Show'}
                                        </span>
                                        <ChevronDown
                                            size={18}
                                            className={`pymtw-category-chevron ${isOpen ? 'pymtw-category-chevron-open' : ''}`}
                                            aria-hidden="true"
                                        />
                                    </span>
                                </button>
                                {isOpen && (
                                    <div className="pymtw-adjust-accordion-panel">
                                        {category.id === 'standard_expenses'
                                            ? renderStandardExpenses()
                                            : renderFutureLoans()}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <div className="pymtw-adjust-save" style={{ marginTop: '1rem' }}>
                        {adjustmentsSaved && !saveError && (
                            <div className="pymtw-adjust-saved-msg" role="status" style={{ color: 'var(--primary, #0f766e)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <CheckCircle2 size={16} />
                                <span>
                                    {saveMessage || 'Future financial adjustments saved.'}
                                </span>
                            </div>
                        )}
                    </div>
                </>
            )}

            {!hasUpcomingAdjustments && adjustmentsSaved && (
                <div style={{ padding: '0.85rem 1rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '10px', color: '#047857', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={16} />
                    <span>No future adjustments planned. Your baseline surplus is ready.</span>
                </div>
            )}

            <div className="pymtw-adjust-summary">
                <h3 className="pymtw-zone-title">
                    <Banknote size={18} />
                    Future Financial Adjustments Summary
                </h3>
                {monthGroupedSummary.length > 0 && (
                    <div className={`pymtw-adjust-summary-grid ${summaryGridClass}`}>
                        {monthGroupedSummary.map((monthGroup) => (
                            <div key={monthGroup.monthIndex} className="pymtw-adjust-summary-month-card">
                                <h4 className="pymtw-adjust-summary-month-title">{monthGroup.title}</h4>
                                <div className="pymtw-constraint-list">
                                    {monthGroup.items.map((item) => (
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
                                            {setJourneyAdjustments && (
                                                <button
                                                    type="button"
                                                    className="btn btn-outline pymtw-constraint-remove-btn"
                                                    onClick={() => removeCommitted(item.id)}
                                                    aria-label={`Remove ${item.name || 'adjustment'}`}
                                                >
                                                    <Trash2 size={16} />
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </ReportReveal>
    );
};

export default JourneyConstraintsRail;
