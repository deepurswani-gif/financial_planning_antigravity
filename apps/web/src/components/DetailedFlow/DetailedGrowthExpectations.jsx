import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, TrendingUp, GraduationCap } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { DEFAULT_DETAILED_REPORT_PATH } from '../DetailedReport/detailedReportSteps';
import { GROWTH_EXPECTATIONS_PATH } from './detailedFlowSteps';

const RATE_FIELDS = [
    {
        key: 'incomeIncrement',
        label: 'Income Growth (%)',
        placeholder: 'e.g. 10',
        icon: TrendingUp,
    },
    {
        key: 'householdInflation',
        label: 'Household Expense Growth (%)',
        placeholder: 'e.g. 6',
        icon: TrendingUp,
    },
    {
        key: 'educationInflation',
        label: 'Education Cost Growth (%)',
        placeholder: 'e.g. 8',
        icon: GraduationCap,
    },
];

const DetailedGrowthExpectations = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const returnTo = searchParams.get('returnTo') || DEFAULT_DETAILED_REPORT_PATH;
    const { inflationRates, setInflationRates, savePlanData } = useFinancialPlan();

    const handleRateChange = (name, value) => {
        setInflationRates({
            ...inflationRates,
            [name]: parseFloat(value) || 0,
        });
    };

    const handleBack = async () => {
        if (savePlanData) {
            try {
                await savePlanData();
            } catch (e) {
                console.error('Save failed on nav', e);
            }
        }
        navigate('/detailed-flow/dreams_goals');
    };

    const handleContinue = async () => {
        if (savePlanData) {
            try {
                await savePlanData();
            } catch (e) {
                console.error('Save failed on nav', e);
            }
        }
        navigate(returnTo);
    };

    return (
        <div
            style={{
                width: '100%',
                maxWidth: '650px',
                margin: '3rem auto',
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}
        >
            <div className="question-container">
                <h2 className="question-title">Let&apos;s look ahead together</h2>
                <p className="question-helper" style={{ marginBottom: '0.75rem' }}>
                    Based on your expectations, what annual growth do you anticipate in your income,
                    household expenses, and children&apos;s education costs?
                </p>
                <p className="question-helper">
                    This will help us build a financial journey that reflects your family&apos;s future.
                </p>

                <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                    {RATE_FIELDS.map(({ key, label, placeholder, icon: Icon }) => (
                        <div key={key}>
                            <label
                                style={{
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    marginBottom: '0.4rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                }}
                            >
                                <Icon size={14} />
                                {label}
                            </label>
                            <input
                                type="number"
                                className="conversational-input"
                                value={inflationRates[key] ?? ''}
                                onChange={(e) => handleRateChange(key, e.target.value)}
                                placeholder={placeholder}
                                min="0"
                                step="0.1"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="step-nav-bar" style={{ width: '100%', maxWidth: '650px' }}>
                <div>
                    <button className="step-nav-btn" onClick={handleBack} type="button">
                        <ArrowLeft size={16} /> Back to Goals
                    </button>
                </div>
                <div>
                    <button className="step-nav-btn primary" onClick={handleContinue} type="button">
                        Continue to report <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DetailedGrowthExpectations;
