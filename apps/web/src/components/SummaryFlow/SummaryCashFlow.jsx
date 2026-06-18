import React from 'react';
import ProgressiveQuestionLayout from './ProgressiveQuestionLayout';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import {
    getSummaryIncomeTarget,
    hasIncomeBreakdown,
    prefillDetailFromSummaryAmount,
} from '../DetailedFlow/incomeDetailSync';
import { guessEmploymentTypeFromSummaryOccupation } from '../DetailedFlow/employmentTypeSync';

const SummaryCashFlow = () => {
    const { 
        income, setIncome,
        familyMembers,
        expenseCategories, setExpenseCategories,
        hasEMI, setHasEMI,
        hasSpouseIncome, setHasSpouseIncome
    } = useFinancialPlan();

    const handleIncomeChange = (field, value) => {
        setIncome(prev => {
            const selfMember = familyMembers.find(m => m.relation === 'Self') || {};
            const spouseMember = familyMembers.find(m => m.relation === 'Spouse');
            const selfType = selfMember.employmentType
                || guessEmploymentTypeFromSummaryOccupation(selfMember.occupation)
                || 'Private Sector';
            const spouseType = spouseMember?.employmentType
                || guessEmploymentTypeFromSummaryOccupation(spouseMember?.occupation)
                || 'Private Sector';
            const detailKey = field === 'self' ? 'selfDetail' : 'spouseDetail';
            const employmentType = field === 'self' ? selfType : spouseType;
            const detail = prev[detailKey];

            const next = {
                ...prev,
                [field]: value,
                ...(field === 'self' ? { summarySelfInHand: value } : { summarySpouseInHand: value }),
            };

            if (!hasIncomeBreakdown(detail, employmentType)) {
                next[detailKey] = prefillDetailFromSummaryAmount(detail, value, employmentType);
            }

            return next;
        });
    };

    const handleExpenseChange = (category, field, value) => {
        setExpenseCategories(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [field]: value
            }
        }));
    };

    const formatInr = (val) => {
        if (!val || isNaN(val)) return '₹0';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(val);
    };

    const narrative = "Great. I now understand the rhythm of your monthly cash flow. Let's see how much of it is helping you build future wealth.";

    const questions = [
        // Q1: Monthly Household Income
        {
            id: 'household-income',
            content: (
                <div className="question-container">
                    <p className="question-narrative">
                        Let me understand the monthly inflow of your household.
                    </p>
                    <h2 className="question-title">What is your monthly in-hand-salary / Take-home-profit?</h2>

                    <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                        <div className="currency-input-wrapper">
                            <span className="currency-symbol">₹</span>
                            <input
                                type="number"
                                className="conversational-input"
                                placeholder="e.g. 100000"
                                value={getSummaryIncomeTarget(income, 'self')}
                                onChange={(e) => handleIncomeChange('self', e.target.value)}
                            />
                        </div>
                        {getSummaryIncomeTarget(income, 'self') && (
                            <div className="currency-display">{formatInr(getSummaryIncomeTarget(income, 'self'))} / month</div>
                        )}

                        <div style={{ marginTop: '1.5rem' }}>
                            <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 500, marginBottom: '0.75rem' }}>
                                Does your spouse also contribute to the household income?
                            </p>
                            <div className="yes-no-toggle">
                                <button
                                    type="button"
                                    className={`yes-no-btn ${hasSpouseIncome ? 'active-yes' : ''}`}
                                    onClick={() => setHasSpouseIncome(true)}
                                >
                                    Yes
                                </button>
                                <button
                                    type="button"
                                    className={`yes-no-btn ${hasSpouseIncome === false ? 'active-no' : ''}`}
                                    onClick={() => {
                                        setHasSpouseIncome(false);
                                        handleIncomeChange('spouse', '');
                                    }}
                                >
                                    No
                                </button>
                            </div>

                            <div className={`conditional-field ${hasSpouseIncome ? 'visible' : ''}`}>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                                    Spouse&apos;s monthly in-hand-salary / Take-home-profit (₹)
                                </label>
                                <div className="currency-input-wrapper">
                                    <span className="currency-symbol">₹</span>
                                    <input
                                        type="number"
                                        className="conversational-input"
                                        placeholder="e.g. 75000"
                                        value={getSummaryIncomeTarget(income, 'spouse')}
                                        onChange={(e) => handleIncomeChange('spouse', e.target.value)}
                                    />
                                </div>
                                {getSummaryIncomeTarget(income, 'spouse') && (
                                    <div className="currency-display">{formatInr(getSummaryIncomeTarget(income, 'spouse'))} / month</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        // Q2: Monthly Expenses
        {
            id: 'monthly-expenses',
            content: (
                <div className="question-container">
                    <p className="question-narrative">
                        Every lifestyle has its own rhythm of expenses.
                    </p>
                    <h2 className="question-title">
                        Approximately how much does your household spend every month?
                    </h2>
                    <p className="question-helper">
                        Including groceries, utilities, lifestyle, travel, medical, etc.
                    </p>

                    <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                        <div className="currency-input-wrapper">
                            <span className="currency-symbol">₹</span>
                            <input
                                type="number"
                                className="conversational-input"
                                placeholder="e.g. 50000"
                                value={expenseCategories.summaryHouseholdTotal || expenseCategories.household?.lifestyle || ''}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setExpenseCategories(prev => ({
                                        ...prev,
                                        summaryHouseholdTotal: value,
                                        household: {
                                            ...prev.household,
                                            lifestyle: '',
                                        },
                                    }));
                                }}
                            />
                        </div>
                        {(expenseCategories.summaryHouseholdTotal || expenseCategories.household?.lifestyle) && (
                            <div className="currency-display">
                                {formatInr(expenseCategories.summaryHouseholdTotal || expenseCategories.household?.lifestyle)} / month
                            </div>
                        )}
                    </div>
                </div>
            )
        },
        // Q3: EMI Commitments
        {
            id: 'emi-commitments',
            content: (
                <div className="question-container">
                    <h2 className="question-title">
                        Do you currently have any ongoing EMI commitments?
                    </h2>

                    <div className="yes-no-toggle" style={{ marginBottom: '1rem' }}>
                        <button
                            type="button"
                            className={`yes-no-btn ${hasEMI ? 'active-yes' : ''}`}
                            onClick={() => setHasEMI(true)}
                        >
                            Yes
                        </button>
                        <button
                            type="button"
                            className={`yes-no-btn ${hasEMI === false ? 'active-no' : ''}`}
                            onClick={() => {
                                setHasEMI(false);
                                setExpenseCategories(prev => ({
                                    ...prev,
                                    summaryEmiTotal: '',
                                }));
                            }}
                        >
                            No
                        </button>
                    </div>

                    <div className={`conditional-field ${hasEMI ? 'visible' : ''}`}>
                        <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                            <label style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-main)', textAlign: 'center', display: 'block' }}>
                                What is your total monthly EMI burden?
                            </label>
                            <div className="currency-input-wrapper">
                                <span className="currency-symbol">₹</span>
                                <input
                                    type="number"
                                    className="conversational-input"
                                    placeholder="e.g. 35000"
                                    value={expenseCategories.summaryEmiTotal || ''}
                                    onChange={(e) => setExpenseCategories(prev => ({
                                        ...prev,
                                        summaryEmiTotal: e.target.value,
                                    }))}
                                />
                            </div>
                            {expenseCategories.summaryEmiTotal && (
                                <div className="currency-display">
                                    {formatInr(expenseCategories.summaryEmiTotal)} / month
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )
        }
    ];

    return (
        <ProgressiveQuestionLayout
            currentStepId="cashflow"
            questions={questions}
            narrative={narrative}
        />
    );
};

export default SummaryCashFlow;
