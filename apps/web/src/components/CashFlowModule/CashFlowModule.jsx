import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';
import CashFlowInput from './CashFlowInput';
import CashFlowOutput from './CashFlowOutput';
import { calculateCashFlow } from './CashFlowLogic';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';

const CashFlowModule = ({ onNext, onBack, setCurrentStep }) => {
    const { familyMembers, income, setIncome, expenseCategories, setExpenseCategories, currentYearLedger, setCurrentYearLedger, cashFlowSubStep, setCashFlowSubStep, planStartMonth } = useFinancialPlan();
    const [results, setResults] = useState(null);
    const [showWarning, setShowWarning] = useState(false);

    const handleCalculate = () => {
        const calculated = calculateCashFlow(income, expenseCategories, familyMembers);
        if (calculated.totalExpenses + calculated.totalSavings > calculated.totalIncome) {
            setShowWarning(true);
            return;
        }
        setResults(calculated);
    };

    const handleNextSubStep = () => {
        window.scrollTo(0, 0);
        setCashFlowSubStep(2);
    };

    const handleBackSubStep = () => {
        setResults(null);
        window.scrollTo(0, 0);
        setCashFlowSubStep(1);
    };

    return (
        <div className="fade-in" style={{ marginTop: '2rem' }}>
            {showWarning && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        background: 'var(--bg-main)',
                        padding: '2rem',
                        borderRadius: '12px',
                        maxWidth: '450px',
                        width: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1rem',
                        border: '1px solid rgba(239, 68, 68, 0.5)'
                    }}>
                        <div style={{
                            width: '48px', height: '48px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ef4444'
                        }}>
                            <AlertTriangle size={28} />
                        </div>
                        <h3 style={{ margin: 0, color: '#ef4444' }}>Warning</h3>
                        <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                            Amount of expenses and savings entered by you is exceed from total monthly household income. Check the inputs once again to proceed.
                        </p>
                        <button 
                            onClick={() => setShowWarning(false)}
                            style={{
                                background: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                padding: '0.75rem 2rem',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                marginTop: '0.5rem',
                                width: '100%'
                            }}
                        >
                            OK, I understand
                        </button>
                    </div>
                </div>,
                document.body
            )}
            <div className="card">
                <h1>Monthly Cash Flow Analysis (INR)</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    Evaluate your family's savings potential by comparing various income streams and categorized expenses.
                </p>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)' }}>
                    <button 
                        onClick={() => { setCashFlowSubStep(1); setResults(null); window.scrollTo(0, 0); }}
                        style={{ 
                            padding: '0.75rem 1.5rem', 
                            background: 'transparent',
                            border: 'none',
                            borderBottom: cashFlowSubStep === 1 ? '3px solid var(--primary)' : '3px solid transparent',
                            color: cashFlowSubStep === 1 ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Income & Lifestyle
                    </button>
                    <button 
                        onClick={() => { setCashFlowSubStep(2); window.scrollTo(0, 0); }}
                        style={{ 
                            padding: '0.75rem 1.5rem', 
                            background: 'transparent',
                            border: 'none',
                            borderBottom: cashFlowSubStep === 2 ? '3px solid var(--primary)' : '3px solid transparent',
                            color: cashFlowSubStep === 2 ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Commitments & Savings
                    </button>
                </div>

                <CashFlowInput
                    familyMembers={familyMembers}
                    income={income}
                    setIncome={setIncome}
                    expenseCategories={expenseCategories}
                    setExpenseCategories={setExpenseCategories}
                    currentYearLedger={currentYearLedger}
                    setCurrentYearLedger={setCurrentYearLedger}
                    subStep={cashFlowSubStep}
                    planStartMonth={planStartMonth}
                />
            </div>

            {cashFlowSubStep === 1 && (
                <div className="sticky-action-bar">
                    <button className="btn btn-secondary" onClick={onBack} style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ChevronLeft size={20} />
                        Back to Profile
                    </button>
                    <button className="btn btn-primary" onClick={handleNextSubStep} style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-md)' }}>
                        Next: Review Commitments & Savings
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}

            {cashFlowSubStep === 2 && !results && (
                <div className="sticky-action-bar">
                    <button className="btn btn-secondary" onClick={handleBackSubStep} style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ChevronLeft size={20} />
                        Back to Income & Lifestyle
                    </button>
                    <button className="btn btn-primary" onClick={handleCalculate} style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-md)' }}>
                        Calculate Cash Flow & Proceed
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}

            {cashFlowSubStep === 2 && results && (
                <div className="fade-in">
                    <CashFlowOutput results={results} />
                    <div className="sticky-action-bar">
                        <button className="btn btn-secondary" onClick={handleBackSubStep} style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ChevronLeft size={20} />
                            Back to Edits
                        </button>
                        <button className="btn btn-primary" onClick={onNext} style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-md)' }}>
                            Proceed to Assets
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashFlowModule;
