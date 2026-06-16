import React, { useMemo } from 'react';
import ProgressiveQuestionLayout from './ProgressiveQuestionLayout';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';

const SummaryLiabilities = () => {
    const { liabilityCategories, setLiabilityCategories, hasEMI } = useFinancialPlan();

    const handleSnapshotChange = (field, value) => {
        setLiabilityCategories(prev => ({
            ...prev,
            [field]: value,
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

    const narrative = "Great. Your financial reality is now understood. Let's move toward the future you want to build.";

    // Build questions array conditionally based on EMI status
    const questions = useMemo(() => {
        const qList = [];

        // Q1: Outstanding Loans — ONLY if user said Yes to EMI in Cash Flow
        if (hasEMI) {
            qList.push({
                id: 'outstanding-loans',
                content: (
                    <div className="question-container">
                        <p className="question-narrative">
                            To understand your financial commitments better,
                        </p>
                        <h2 className="question-title">
                            What is your total outstanding loan amount today?
                        </h2>
                        <p className="question-helper">
                            Home Loan, Personal Loan, Vehicle Loan, Education Loan, etc.
                        </p>

                        <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                                Outstanding Loans
                            </label>
                            <div className="currency-input-wrapper">
                                <span className="currency-symbol">₹</span>
                                <input
                                    type="number"
                                    className="conversational-input"
                                    placeholder="e.g. 3500000"
                                    value={liabilityCategories.summaryOutstandingLoans || ''}
                                    onChange={(e) => handleSnapshotChange('summaryOutstandingLoans', e.target.value)}
                                />
                            </div>
                            {liabilityCategories.summaryOutstandingLoans && (
                                <div className="currency-display">
                                    {formatInr(liabilityCategories.summaryOutstandingLoans)}
                                </div>
                            )}
                        </div>
                    </div>
                )
            });
        }

        // Q2: Credit Card Outstanding
        qList.push({
            id: 'credit-card',
            content: (
                <div className="question-container">
                    <h2 className="question-title">
                        Do you currently have any pending credit card dues?
                    </h2>

                    <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                            Credit Card Outstanding
                        </label>
                        <div className="currency-input-wrapper">
                            <span className="currency-symbol">₹</span>
                            <input
                                type="number"
                                className="conversational-input"
                                placeholder="e.g. 45000"
                                value={liabilityCategories.summaryCreditCardDues || ''}
                                onChange={(e) => handleSnapshotChange('summaryCreditCardDues', e.target.value)}
                            />
                        </div>
                        {liabilityCategories.summaryCreditCardDues && (
                            <div className="currency-display">
                                {formatInr(liabilityCategories.summaryCreditCardDues)}
                            </div>
                        )}
                    </div>
                </div>
            )
        });

        // Q3: Other Payables
        qList.push({
            id: 'other-payables',
            content: (
                <div className="question-container">
                    <h2 className="question-title">
                        Apart from formal loans, is there any other amount that you may need to repay to someone?
                    </h2>
                    <p className="question-helper">
                        Borrowed funds from family, friends, business obligations, etc.
                    </p>

                    <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                            Other Payables
                        </label>
                        <div className="currency-input-wrapper">
                            <span className="currency-symbol">₹</span>
                            <input
                                type="number"
                                className="conversational-input"
                                placeholder="e.g. 100000"
                                value={liabilityCategories.summaryOtherPayables || ''}
                                onChange={(e) => handleSnapshotChange('summaryOtherPayables', e.target.value)}
                            />
                        </div>
                        {liabilityCategories.summaryOtherPayables && (
                            <div className="currency-display">
                                {formatInr(liabilityCategories.summaryOtherPayables)}
                            </div>
                        )}
                    </div>
                </div>
            )
        });

        return qList;
    }, [hasEMI, liabilityCategories, handleSnapshotChange, formatInr]);

    return (
        <ProgressiveQuestionLayout
            currentStepId="liabilities"
            questions={questions}
            narrative={narrative}
        />
    );
};

export default SummaryLiabilities;
