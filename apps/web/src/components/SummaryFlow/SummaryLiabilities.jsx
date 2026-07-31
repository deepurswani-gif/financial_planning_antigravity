import React, { useMemo } from 'react';
import ProgressiveQuestionLayout, { useProgressiveAdvance } from './ProgressiveQuestionLayout';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { formatInrInWords } from '../../lib/formatInrInWords';

const CurrentLiabilitiesScreen = ({ hasEMI, liabilityCategories, handleSnapshotChange }) => {
    const { advance } = useProgressiveAdvance();
    return (
        <div className="question-container">
            {hasEMI && (
                <>
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
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') advance();
                                }}
                                enterKeyHint="done"
                            />
                        </div>
                        {liabilityCategories.summaryOutstandingLoans && (
                            <div className="currency-display">
                                {formatInrInWords(liabilityCategories.summaryOutstandingLoans)}
                            </div>
                        )}
                    </div>
                </>
            )}

            <h2 className="question-title" style={{ marginTop: hasEMI ? '2rem' : undefined }}>
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
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') advance();
                        }}
                        enterKeyHint="done"
                    />
                </div>
                {liabilityCategories.summaryCreditCardDues && (
                    <div className="currency-display">
                        {formatInrInWords(liabilityCategories.summaryCreditCardDues)}
                    </div>
                )}
            </div>

            <h2 className="question-title" style={{ marginTop: '2rem' }}>
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
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') advance();
                        }}
                        enterKeyHint="done"
                    />
                </div>
                {liabilityCategories.summaryOtherPayables && (
                    <div className="currency-display">
                        {formatInrInWords(liabilityCategories.summaryOtherPayables)}
                    </div>
                )}
            </div>
        </div>
    );
};

const SummaryLiabilities = () => {
    const { liabilityCategories, setLiabilityCategories, hasEMI } = useFinancialPlan();

    const handleSnapshotChange = (field, value) => {
        setLiabilityCategories(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const narrative = "Perfect! Now let's map the goals you want to achieve.";

    const questions = useMemo(() => [
        {
            id: 'current-liabilities',
            content: (
                <CurrentLiabilitiesScreen
                    hasEMI={hasEMI}
                    liabilityCategories={liabilityCategories}
                    handleSnapshotChange={handleSnapshotChange}
                />
            )
        }
    ], [hasEMI, liabilityCategories]);

    return (
        <ProgressiveQuestionLayout
            currentStepId="liabilities"
            questions={questions}
            narrative={narrative}
        />
    );
};

export default SummaryLiabilities;
