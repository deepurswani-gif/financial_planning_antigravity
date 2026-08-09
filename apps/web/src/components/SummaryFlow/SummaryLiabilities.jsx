import React, { useMemo } from 'react';
import ProgressiveQuestionLayout, { useProgressiveAdvance } from './ProgressiveQuestionLayout';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { formatInrInWords } from '../../lib/formatInrInWords';
import CurrencyInput from '../common/CurrencyInput';

const toStored = (v) => (v == null ? '' : String(v));

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
                        Total Outstanding Loans <span className="tooltip-wrapper" data-tooltip="Total balance remaining on Home Loans, Personal Loans, Vehicle Loans, Education Loans, etc." style={{ cursor: 'help', color: 'var(--primary)', fontSize: '0.8em', verticalAlign: 'middle' }}>ⓘ</span>
                    </h2>

                    <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                            Outstanding Loans
                        </label>
                        <CurrencyInput
                            className="conversational-input"
                            placeholder="e.g. 3500000"
                            value={liabilityCategories.summaryOutstandingLoans || ''}
                            onValueChange={(v) => handleSnapshotChange('summaryOutstandingLoans', toStored(v))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') advance();
                            }}
                            enterKeyHint="done"
                        />
                        {liabilityCategories.summaryOutstandingLoans && (
                            <div className="currency-display">
                                {formatInrInWords(liabilityCategories.summaryOutstandingLoans)}
                            </div>
                        )}
                    </div>
                </>
            )}

            <h2 className="question-title" style={{ marginTop: hasEMI ? '2rem' : undefined }}>
                Pending Credit Card Dues <span className="tooltip-wrapper" data-tooltip="Total current outstanding balance on all your credit cards." style={{ cursor: 'help', color: 'var(--primary)', fontSize: '0.8em', verticalAlign: 'middle' }}>ⓘ</span>
            </h2>

            <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                    Credit Card Outstanding
                </label>
                <CurrencyInput
                    className="conversational-input"
                    placeholder="e.g. 45000"
                    value={liabilityCategories.summaryCreditCardDues || ''}
                    onValueChange={(v) => handleSnapshotChange('summaryCreditCardDues', toStored(v))}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') advance();
                    }}
                    enterKeyHint="done"
                />
                {liabilityCategories.summaryCreditCardDues && (
                    <div className="currency-display">
                        {formatInrInWords(liabilityCategories.summaryCreditCardDues)}
                    </div>
                )}
            </div>

            <h2 className="question-title" style={{ marginTop: '2rem' }}>
                Other Payables <span className="tooltip-wrapper" data-tooltip="Borrowed funds from family, friends, business obligations, or any informal loans." style={{ cursor: 'help', color: 'var(--primary)', fontSize: '0.8em', verticalAlign: 'middle' }}>ⓘ</span>
            </h2>

            <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                    Other Payables
                </label>
                <CurrencyInput
                    className="conversational-input"
                    placeholder="e.g. 100000"
                    value={liabilityCategories.summaryOtherPayables || ''}
                    onValueChange={(v) => handleSnapshotChange('summaryOtherPayables', toStored(v))}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') advance();
                    }}
                    enterKeyHint="done"
                />
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
