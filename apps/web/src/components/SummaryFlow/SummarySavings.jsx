import React from 'react';
import ProgressiveQuestionLayout, { useProgressiveAdvance } from './ProgressiveQuestionLayout';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { Shield, Heart } from 'lucide-react';
import { formatInrInWords } from '../../lib/formatInrInWords';

const SavingsInvestmentsScreen = ({ expenseCategories, handleSummaryChange }) => {
    const { advance } = useProgressiveAdvance();
    return (
        <div className="question-container">
            <p className="question-narrative">
                Wealth is built through consistent saving and investing.
            </p>
            <h2 className="question-title">
                How much are you currently investing every month towards your future?
            </h2>
            <p className="question-helper">
                SIPs, Mutual Funds, Stocks, Retirement Investments, etc.
            </p>

            <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                    Monthly Investments
                </label>
                <div className="currency-input-wrapper">
                    <span className="currency-symbol">₹</span>
                    <input
                        type="number"
                        className="conversational-input"
                        placeholder="e.g. 15000"
                        value={expenseCategories.summaryMonthlyInvestments || ''}
                        onChange={(e) => handleSummaryChange('summaryMonthlyInvestments', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') advance();
                        }}
                        enterKeyHint="done"
                    />
                </div>
                {expenseCategories.summaryMonthlyInvestments && (
                    <div className="currency-display">
                        {formatInrInWords(expenseCategories.summaryMonthlyInvestments)} / month
                    </div>
                )}
            </div>

            <h2 className="question-title" style={{ marginTop: '2rem' }}>
                Apart from investments, do you also keep money aside in safer savings instruments?
            </h2>
            <p className="question-helper">
                FDs, RDs, recurring savings, deposits, etc.
            </p>

            <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                    Other Monthly Savings
                </label>
                <div className="currency-input-wrapper">
                    <span className="currency-symbol">₹</span>
                    <input
                        type="number"
                        className="conversational-input"
                        placeholder="e.g. 10000"
                        value={expenseCategories.summaryOtherSavings || ''}
                        onChange={(e) => handleSummaryChange('summaryOtherSavings', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') advance();
                        }}
                        enterKeyHint="done"
                    />
                </div>
                {expenseCategories.summaryOtherSavings && (
                    <div className="currency-display">
                        {formatInrInWords(expenseCategories.summaryOtherSavings)} / month
                    </div>
                )}
            </div>
        </div>
    );
};

const InsuranceProtectionScreen = ({
    hasLifeInsurance, setHasLifeInsurance,
    hasHealthInsurance, setHasHealthInsurance,
    summaryLifeCover, setSummaryLifeCover,
    summaryHealthCover, setSummaryHealthCover,
}) => {
    const { advance, scheduleAdvance } = useProgressiveAdvance();

    const maybeAdvanceAfterHealthNo = () => {
        scheduleAdvance();
    };

    return (
        <div className="question-container">
            <p className="question-narrative">
                Let&apos;s understand how well your family is protected.
            </p>
            <p className="question-helper" style={{ marginBottom: '1.5rem' }}>
                Approximate amount is fine. You can update it later.
            </p>

            <h2 className="question-title">
                Do you currently have any Life Insurance coverage?
            </h2>

            <div className="coverage-chips" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
                <button
                    type="button"
                    className={`coverage-chip ${hasLifeInsurance === true ? 'coverage-chip-active' : ''}`}
                    onClick={() => setHasLifeInsurance(true)}
                >
                    <Shield size={18} />
                    <span>I already have coverage</span>
                </button>
                <button
                    type="button"
                    className={`coverage-chip ${hasLifeInsurance === false ? 'coverage-chip-inactive' : ''}`}
                    onClick={() => {
                        setHasLifeInsurance(false);
                        setSummaryLifeCover('');
                    }}
                >
                    <span className="coverage-chip-circle" />
                    <span>Not yet</span>
                </button>
            </div>

            <div className={`conditional-field ${hasLifeInsurance === true ? 'visible' : ''}`}>
                <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                    <label style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-main)', textAlign: 'center', display: 'block', marginBottom: '0.5rem' }}>
                        What is the total life cover (Sum Assured) available across all your policies?
                    </label>
                    <p className="question-helper" style={{ marginBottom: '1rem' }}>
                        Include Term Insurance, Traditional Policies, Employer Coverage, etc.
                    </p>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                        Total Life Insurance Cover
                    </label>
                    <div className="currency-input-wrapper">
                        <span className="currency-symbol">₹</span>
                        <input
                            type="number"
                            className="conversational-input"
                            placeholder="e.g. 10000000"
                            value={summaryLifeCover || ''}
                            onChange={(e) => setSummaryLifeCover(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && summaryLifeCover) advance();
                            }}
                            enterKeyHint="done"
                        />
                    </div>
                    {summaryLifeCover && (
                        <div className="currency-display">
                            {formatInrInWords(summaryLifeCover)}
                        </div>
                    )}
                </div>
            </div>

            <h2 className="question-title" style={{ marginTop: '2rem' }}>
                Do you currently have Health Insurance coverage for yourself or your family?
            </h2>

            <div className="coverage-chips" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
                <button
                    type="button"
                    className={`coverage-chip ${hasHealthInsurance === true ? 'coverage-chip-active' : ''}`}
                    onClick={() => setHasHealthInsurance(true)}
                >
                    <Heart size={18} />
                    <span>I already have coverage</span>
                </button>
                <button
                    type="button"
                    className={`coverage-chip ${hasHealthInsurance === false ? 'coverage-chip-inactive' : ''}`}
                    onClick={() => {
                        setHasHealthInsurance(false);
                        setSummaryHealthCover('');
                        // Advance only when both life and health are terminal (no pending cover fields)
                        if (hasLifeInsurance !== true) {
                            maybeAdvanceAfterHealthNo();
                        }
                    }}
                >
                    <span className="coverage-chip-circle" />
                    <span>Not yet</span>
                </button>
            </div>

            <div className={`conditional-field ${hasHealthInsurance === true ? 'visible' : ''}`}>
                <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                    <label style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-main)', textAlign: 'center', display: 'block', marginBottom: '0.5rem' }}>
                        What is the total health cover available to your family today?
                    </label>
                    <p className="question-helper" style={{ marginBottom: '1rem' }}>
                        Include personal policies, family floater plans, and employer-provided cover.
                    </p>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                        Total Health Insurance Cover
                    </label>
                    <div className="currency-input-wrapper">
                        <span className="currency-symbol">₹</span>
                        <input
                            type="number"
                            className="conversational-input"
                            placeholder="e.g. 500000"
                            value={summaryHealthCover || ''}
                            onChange={(e) => setSummaryHealthCover(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && summaryHealthCover) advance();
                            }}
                            enterKeyHint="done"
                        />
                    </div>
                    {summaryHealthCover && (
                        <div className="currency-display">
                            {formatInrInWords(summaryHealthCover)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SummarySavings = () => {
    const {
        expenseCategories, setExpenseCategories,
        hasLifeInsurance, setHasLifeInsurance,
        hasHealthInsurance, setHasHealthInsurance,
        summaryLifeCover, setSummaryLifeCover,
        summaryHealthCover, setSummaryHealthCover
    } = useFinancialPlan();

    const handleSummaryChange = (field, value) => {
        setExpenseCategories(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const narrative = "Nice! Let's map the wealth you've already built.";

    const questions = [
        {
            id: 'savings-investments',
            content: (
                <SavingsInvestmentsScreen
                    expenseCategories={expenseCategories}
                    handleSummaryChange={handleSummaryChange}
                />
            )
        },
        {
            id: 'insurance-protection',
            content: (
                <InsuranceProtectionScreen
                    hasLifeInsurance={hasLifeInsurance}
                    setHasLifeInsurance={setHasLifeInsurance}
                    hasHealthInsurance={hasHealthInsurance}
                    setHasHealthInsurance={setHasHealthInsurance}
                    summaryLifeCover={summaryLifeCover}
                    setSummaryLifeCover={setSummaryLifeCover}
                    summaryHealthCover={summaryHealthCover}
                    setSummaryHealthCover={setSummaryHealthCover}
                />
            )
        }
    ];

    return (
        <>
            <ProgressiveQuestionLayout
                currentStepId="savings"
                questions={questions}
                narrative={narrative}
            />
            <style>{`
                .coverage-chips {
                    flex-wrap: wrap;
                }

                .coverage-chip {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    padding: 0.9rem 1.5rem;
                    border-radius: 50px;
                    border: 1.5px solid var(--border);
                    background: var(--bg-card);
                    color: var(--text-muted);
                    font-size: 0.95rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.25s ease;
                    user-select: none;
                }

                .coverage-chip:hover {
                    border-color: var(--primary);
                    color: var(--text-main);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(23, 45, 157, 0.08);
                }

                .coverage-chip-active {
                    border-color: var(--primary);
                    background: var(--primary-light);
                    color: var(--primary);
                    font-weight: 600;
                    box-shadow: 0 0 0 3px rgba(23, 45, 157, 0.1);
                }

                .coverage-chip-active svg {
                    color: var(--primary);
                }

                .coverage-chip-inactive {
                    border-color: var(--text-muted);
                    background: #f8fafc;
                    color: var(--text-main);
                    font-weight: 600;
                }

                .coverage-chip-circle {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    border: 2px solid var(--border);
                    flex-shrink: 0;
                }

                .coverage-chip-inactive .coverage-chip-circle {
                    border-color: var(--text-muted);
                    background: var(--text-muted);
                    position: relative;
                }

                .coverage-chip-inactive .coverage-chip-circle::after {
                    content: '✕';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: white;
                    font-size: 0.6rem;
                    font-weight: 700;
                }
            `}</style>
        </>
    );
};

export default SummarySavings;
