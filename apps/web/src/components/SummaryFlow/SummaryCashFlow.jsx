import React from 'react';
import ProgressiveQuestionLayout, { useProgressiveAdvance } from './ProgressiveQuestionLayout';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import {
    getSummaryIncomeTarget,
    hasIncomeBreakdown,
    syncSummaryAmountToDetailPrimary,
} from '../DetailedFlow/incomeDetailSync';
import { guessEmploymentTypeFromSummaryOccupation } from '../DetailedFlow/employmentTypeSync';
import { formatInrInWords } from '../../lib/formatInrInWords';
import CurrencyInput from '../common/CurrencyInput';

const toStored = (v) => (v == null ? '' : String(v));

const HouseholdIncomeScreen = ({
    income,
    hasSpouseIncome,
    setHasSpouseIncome,
    handleIncomeChange,
}) => {
    const { advance, scheduleAdvance } = useProgressiveAdvance();
    const selfIncome = getSummaryIncomeTarget(income, 'self');

    return (
        <div className="question-container">
            <p className="question-narrative">
                Let&apos;s understand your household&apos;s monthly income.
            </p>
            <h2 className="question-title">What is your monthly in-hand-salary / Take-home-profit?</h2>

            <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                <CurrencyInput
                    className="conversational-input"
                    placeholder="e.g. 100000"
                    value={selfIncome}
                    onValueChange={(v) => handleIncomeChange('self', toStored(v))}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && selfIncome) advance();
                    }}
                    enterKeyHint="done"
                />
                {selfIncome && (
                    <div className="currency-display">{formatInrInWords(selfIncome)} / month</div>
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
                                scheduleAdvance();
                            }}
                        >
                            No
                        </button>
                    </div>

                    <div className={`conditional-field ${hasSpouseIncome ? 'visible' : ''}`}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                            Spouse&apos;s monthly in-hand-salary / Take-home-profit (₹)
                        </label>
                        <CurrencyInput
                            className="conversational-input"
                            placeholder="e.g. 75000"
                            value={getSummaryIncomeTarget(income, 'spouse')}
                            onValueChange={(v) => handleIncomeChange('spouse', toStored(v))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && getSummaryIncomeTarget(income, 'spouse')) advance();
                            }}
                            enterKeyHint="done"
                        />
                        {getSummaryIncomeTarget(income, 'spouse') && (
                            <div className="currency-display">{formatInrInWords(getSummaryIncomeTarget(income, 'spouse'))} / month</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const MonthlyOutflowsScreen = ({
    expenseCategories,
    setExpenseCategories,
    hasEMI,
    setHasEMI,
}) => {
    const { advance, scheduleAdvance } = useProgressiveAdvance();
    const householdTotal = expenseCategories.summaryHouseholdTotal || expenseCategories.household?.lifestyle || '';

    return (
        <div className="question-container">
            <p className="question-narrative">
                Now let&apos;s understand where your money goes.
            </p>

            <h2 className="question-title">
                Approximately how much does your household spend every month?
            </h2>
            <p className="question-helper">
                Including groceries, utilities, lifestyle, travel, medical, etc. Exclude insurance premiums.
            </p>

            <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                <CurrencyInput
                    className="conversational-input"
                    placeholder="e.g. 50000"
                    value={householdTotal}
                    onValueChange={(v) => {
                        const value = toStored(v);
                        setExpenseCategories(prev => ({
                            ...prev,
                            summaryHouseholdTotal: value,
                            household: {
                                ...prev.household,
                                lifestyle: '',
                            },
                        }));
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && householdTotal) advance();
                    }}
                    enterKeyHint="done"
                />
                {householdTotal && (
                    <div className="currency-display">
                        {formatInrInWords(householdTotal)} / month
                    </div>
                )}
            </div>

            <h2 className="question-title" style={{ marginTop: '2rem' }}>
                How much do you pay in insurance premiums every month?
            </h2>
            <p className="question-helper">
                Total monthly amount for life, health, car, two-wheeler, and other insurance. Enter 0 if none.
            </p>

            <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                <CurrencyInput
                    className="conversational-input"
                    placeholder="e.g. 5000"
                    value={expenseCategories.summaryInsuranceTotal || ''}
                    onValueChange={(v) => setExpenseCategories(prev => ({
                        ...prev,
                        summaryInsuranceTotal: toStored(v),
                    }))}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') advance();
                    }}
                    enterKeyHint="done"
                />
                {expenseCategories.summaryInsuranceTotal && (
                    <div className="currency-display">
                        {formatInrInWords(expenseCategories.summaryInsuranceTotal)} / month
                    </div>
                )}
            </div>

            <h2 className="question-title" style={{ marginTop: '2rem' }}>
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
                        scheduleAdvance();
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
                    <CurrencyInput
                        className="conversational-input"
                        placeholder="e.g. 35000"
                        value={expenseCategories.summaryEmiTotal || ''}
                        onValueChange={(v) => setExpenseCategories(prev => ({
                            ...prev,
                            summaryEmiTotal: toStored(v),
                        }))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && expenseCategories.summaryEmiTotal) advance();
                        }}
                        enterKeyHint="done"
                    />
                    {expenseCategories.summaryEmiTotal && (
                        <div className="currency-display">
                            {formatInrInWords(expenseCategories.summaryEmiTotal)} / month
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

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
                next[detailKey] = syncSummaryAmountToDetailPrimary(detail, value, employmentType);
            }

            return next;
        });
    };

    const narrative = "Great! Now let's see how much you're saving and investing.";

    const questions = [
        {
            id: 'household-income',
            content: (
                <HouseholdIncomeScreen
                    income={income}
                    hasSpouseIncome={hasSpouseIncome}
                    setHasSpouseIncome={setHasSpouseIncome}
                    handleIncomeChange={handleIncomeChange}
                />
            )
        },
        {
            id: 'monthly-outflows',
            content: (
                <MonthlyOutflowsScreen
                    expenseCategories={expenseCategories}
                    setExpenseCategories={setExpenseCategories}
                    hasEMI={hasEMI}
                    setHasEMI={setHasEMI}
                />
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
