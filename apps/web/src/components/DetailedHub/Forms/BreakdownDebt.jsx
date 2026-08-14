import React, { useState, useCallback } from 'react';
import { useFinancialPlan } from '../../../contexts/FinancialPlanContext';
import {
    EMI_LOAN_KEYS,
    inferSelectedEmiLoanTypes,
    toggleEmiLoanTypeSelection,
    clearEmiLoansNotInSelection,
} from '../../DetailedFlow/expenseDetailSync';
import CurrencyInput from '../../common/CurrencyInput';
import LoanDetailsModal from '../../CashFlowModule/LoanDetailsModal';

const BreakdownDebt = () => {
    const { expenseCategories, setExpenseCategories } = useFinancialPlan();
    const [activeLoanModal, setActiveLoanModal] = useState(null);

    const emi = expenseCategories.emi || {};
    const selectedEmiLoanTypes = inferSelectedEmiLoanTypes(expenseCategories);
    const selectedEmiLoans = EMI_LOAN_KEYS.filter(({ key }) => selectedEmiLoanTypes.includes(key));

    const handleEmiLoanTypeToggle = useCallback((loanKey) => {
        setExpenseCategories((prev) => {
            const nextSelected = toggleEmiLoanTypeSelection(
                inferSelectedEmiLoanTypes(prev),
                loanKey,
            );
            return {
                ...prev,
                selectedEmiLoanTypes: nextSelected,
                emi: clearEmiLoansNotInSelection(prev.emi, nextSelected),
            };
        });
    }, [setExpenseCategories]);

    const handleEmiSave = useCallback((loanKey, configuredData) => {
        setExpenseCategories((prev) => {
            const nextSelected = prev.selectedEmiLoanTypes?.includes(loanKey)
                ? prev.selectedEmiLoanTypes
                : toggleEmiLoanTypeSelection(inferSelectedEmiLoanTypes(prev), loanKey);
            return {
                ...prev,
                selectedEmiLoanTypes: nextSelected,
                emi: { ...prev.emi, [loanKey]: configuredData },
            };
        });
        setActiveLoanModal(null);
    }, [setExpenseCategories]);

    return (
        <div className="breakdown-debt-container">
            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.05rem', color: '#111', marginBottom: '1rem' }}>Which EMIs do you have?</h3>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {EMI_LOAN_KEYS.map(({ key, label }) => {
                        const isSelected = selectedEmiLoanTypes.includes(key);
                        return (
                            <label
                                key={key}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.85rem 1rem',
                                    border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                                    borderRadius: '8px',
                                    background: isSelected ? 'rgba(37, 99, 235, 0.04)' : '#fff',
                                    cursor: 'pointer',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleEmiLoanTypeToggle(key)}
                                    style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary)' }}
                                />
                                <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#111' }}>
                                    {label}
                                </span>
                            </label>
                        );
                    })}
                </div>
            </div>

            {selectedEmiLoans.length > 0 && (
                <div>
                    <h3 style={{ fontSize: '1.05rem', color: '#111', marginBottom: '1rem' }}>Configure EMI Details</h3>
                    <div style={{ display: 'grid', gap: '1.25rem' }}>
                        {selectedEmiLoans.map(({ key, label, hasName }) => {
                            const rawValue = emi[key];
                            const isConfigured = rawValue !== null && typeof rawValue === 'object' && rawValue.principal > 0;
                            const displayValue = isConfigured ? rawValue.emi : '';

                            return (
                                <div key={key} style={{ padding: '1rem', border: '1px solid #eaeaea', borderRadius: '8px', backgroundColor: '#fdfdfd' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111' }}>{label}</label>
                                        <button
                                            type="button"
                                            onClick={() => setActiveLoanModal(key)}
                                            style={{ background: 'transparent', border: 'none', color: isConfigured ? 'var(--success)' : 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            {isConfigured ? '✓ Configured' : '⚙ Configure Details'}
                                        </button>
                                    </div>
                                    
                                    {hasName && (
                                        <input
                                            type="text"
                                            className="conversational-input"
                                            placeholder="Loan name (e.g. Gold Loan)"
                                            value={emi.otherEmiName || ''}
                                            onChange={(e) => setExpenseCategories(prev => ({
                                                ...prev,
                                                emi: { ...prev.emi, otherEmiName: e.target.value },
                                            }))}
                                            style={{ marginBottom: '0.75rem' }}
                                        />
                                    )}
                                    
                                    <div style={{ position: 'relative' }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#666', marginBottom: '0.25rem' }}>Monthly EMI Amount</label>
                                        <CurrencyInput
                                            className="conversational-input"
                                            readOnly
                                            value={displayValue || ''}
                                            onClick={() => setActiveLoanModal(key)}
                                            placeholder="0"
                                            style={{ cursor: 'pointer', background: '#fff', fontWeight: 600, color: isConfigured ? 'var(--primary)' : 'var(--text-muted)' }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeLoanModal && (
                <LoanDetailsModal
                    isOpen={!!activeLoanModal}
                    onClose={() => setActiveLoanModal(null)}
                    onSave={(data) => handleEmiSave(activeLoanModal, data)}
                    initialData={typeof emi[activeLoanModal] === 'object' ? emi[activeLoanModal] : null}
                    loanType={EMI_LOAN_KEYS.find(l => l.key === activeLoanModal)?.label}
                />
            )}
        </div>
    );
};

export default BreakdownDebt;
