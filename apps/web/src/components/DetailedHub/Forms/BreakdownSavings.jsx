import React, { useState, useCallback } from 'react';
import { useFinancialPlan } from '../../../contexts/FinancialPlanContext';
import { sumConfiguredSavings } from '../../DetailedFlow/savingsDetailSync';
import CurrencyInput from '../../common/CurrencyInput';
import InvestmentDetailsModal from '../../CashFlowModule/InvestmentDetailsModal';
import { Plus, Trash2, Sparkles } from 'lucide-react';

const toStored = (v) => (v == null ? '' : String(v));

const CurrencyField = ({ label, value, onChange, placeholder = '0', helperText }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        {label && (
            <div style={{ fontSize: '1rem', color: 'var(--text-main)' }}>
                {label}
            </div>
        )}
        <div>
            <CurrencyInput
                className="conversational-input"
                placeholder={placeholder}
                value={value ?? ''}
                onValueChange={(v) => onChange(toStored(v))}
            />
            {helperText && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.45 }}>
                    {helperText}
                </p>
            )}
        </div>
    </div>
);

const BreakdownSavings = () => {
    const { expenseCategories, setExpenseCategories } = useFinancialPlan();
    const [activeInvModal, setActiveInvModal] = useState(null);

    const savings = expenseCategories.savings || {};

    const handleSavingsChange = useCallback((field, value) => {
        setExpenseCategories((prev) => ({
            ...prev,
            savings: {
                ...prev.savings,
                [field]: value,
            },
        }));
    }, [setExpenseCategories]);

    const handleInvSave = useCallback((configuredData) => {
        if (typeof activeInvModal === 'string') {
            setExpenseCategories((prev) => ({
                ...prev,
                savings: {
                    ...prev.savings,
                    [activeInvModal]: configuredData,
                },
            }));
        } else if (activeInvModal) {
            setExpenseCategories((prev) => {
                const rawArray = prev.savings[activeInvModal.key];
                const arr = Array.isArray(rawArray) ? [...rawArray] : (rawArray ? [rawArray] : []);
                arr[activeInvModal.index] = configuredData;
                return {
                    ...prev,
                    savings: {
                        ...prev.savings,
                        [activeInvModal.key]: arr,
                    },
                };
            });
        }
        setActiveInvModal(null);
    }, [activeInvModal, setExpenseCategories]);

    const rawRD = savings.rd;
    const rdArray = Array.isArray(rawRD) ? rawRD : (rawRD ? [rawRD] : []);

    const openRd = useCallback((index) => {
        setActiveInvModal({ key: 'rd', index });
    }, []);

    const addRd = useCallback(() => {
        const nextIndex = rdArray.length;
        handleSavingsChange('rd', [...rdArray, '']);
        setActiveInvModal({ key: 'rd', index: nextIndex });
    }, [rdArray, handleSavingsChange]);

    const renderConfiguredField = (invKey, label) => {
        const rawValue = savings[invKey] || '';
        const isConfigured = rawValue !== null && typeof rawValue === 'object' && rawValue.amount > 0;
        const displayValue = isConfigured ? rawValue.amount : rawValue;

        return (
            <div key={invKey} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '1rem', color: 'var(--text-main)' }}>
                    {label}
                </div>
                <div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '0.4rem' }}>
                        <button
                            type="button"
                            onClick={() => setActiveInvModal(invKey)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: isConfigured ? 'var(--success)' : 'var(--primary)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: 0,
                            }}
                        >
                            {isConfigured ? '✓ Configured' : '⚙ Configure'}
                        </button>
                        {isConfigured && (
                            <button
                                type="button"
                                onClick={() => handleSavingsChange(invKey, null)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--negative)',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: 0,
                                }}
                            >
                                ✕ Clear
                            </button>
                        )}
                    </div>
                    <CurrencyInput
                        className="conversational-input"
                        readOnly
                        value={displayValue || ''}
                        onClick={() => setActiveInvModal(invKey)}
                        placeholder="0"
                        style={{
                            cursor: 'pointer',
                            background: '#f9f9f9',
                            fontWeight: 600,
                            color: isConfigured ? 'var(--primary)' : 'var(--text-muted)',
                        }}
                    />
                </div>
            </div>
        );
    };

    const handleAutoFill = () => {
        const summaryInvestments = parseFloat(expenseCategories.summaryMonthlyInvestments) || 0;
        const summaryOther = parseFloat(expenseCategories.summaryOtherSavings) || 0;
        const summaryTotal = summaryInvestments + summaryOther;
        
        const currentSum = sumConfiguredSavings({ ...savings, otherSaving: 0 }); // Sum everything EXCEPT otherSaving
        const remainder = summaryTotal - currentSum;
        if (remainder > 0) {
            handleSavingsChange('otherSaving', String(remainder));
        }
    };

    return (
        <div className="breakdown-savings-container">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>Item</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>Amount</div>
            </div>
            
            <CurrencyField 
                label="Mutual Fund SIPs" 
                value={savings.sip} 
                onChange={(v) => handleSavingsChange('sip', v)} 
            />

            {renderConfiguredField('ppf', 'PPF')}
            {renderConfiguredField('nps', 'NPS')}

            <div style={{ marginBottom: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #eaeaea' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111' }}>Recurring Deposits (RD)</label>
                    <button 
                        type="button" 
                        onClick={addRd} 
                        style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <Plus size={14} /> Add RD
                    </button>
                </div>
                
                {rdArray.length > 0 ? rdArray.map((rdVal, index) => {
                    const isConfigured = rdVal !== null && typeof rdVal === 'object' && rdVal.amount > 0;
                    const displayValue = isConfigured ? rdVal.amount : rdVal;
                    
                    return (
                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '1rem', color: 'var(--text-main)' }}>RD #{index + 1}</div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <CurrencyInput
                                        className="conversational-input"
                                        readOnly
                                        value={displayValue || ''}
                                        onClick={() => openRd(index)}
                                        placeholder="0"
                                        style={{
                                            cursor: 'pointer',
                                            background: '#f9f9f9',
                                            fontWeight: 600,
                                            color: isConfigured ? 'var(--primary)' : 'var(--text-muted)',
                                        }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => openRd(index)}
                                    style={{ background: 'transparent', border: 'none', color: isConfigured ? 'var(--success)' : 'var(--primary)', cursor: 'pointer', padding: '0.5rem' }}
                                    title="Configure"
                                >
                                    ⚙
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const next = [...rdArray];
                                        next.splice(index, 1);
                                        handleSavingsChange('rd', next.length ? next : null);
                                    }}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--negative)', cursor: 'pointer', padding: '0.5rem' }}
                                    title="Remove"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    );
                }) : (
                    <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>No active RDs added.</p>
                )}
            </div>

            <div style={{ paddingTop: '1rem', borderTop: '1px solid #eaeaea' }}>
                <CurrencyField 
                    label="Any other Saving" 
                    value={savings.otherSaving} 
                    onChange={(v) => handleSavingsChange('otherSaving', v)} 
                />
            </div>
            
            <div style={{ marginTop: '0.5rem', display: 'flex' }}>
                <button 
                    onClick={handleAutoFill}
                    style={{ 
                        background: 'transparent', border: 'none', color: '#555', 
                        display: 'flex', alignItems: 'center', gap: '0.5rem', 
                        cursor: 'pointer', fontSize: '0.9rem', padding: '0.5rem 0' 
                    }}
                >
                    <Sparkles size={16} /> Auto-fill remainder as "Any other Saving"
                </button>
            </div>

            {activeInvModal && (
                <InvestmentDetailsModal
                    isOpen={!!activeInvModal}
                    onClose={() => setActiveInvModal(null)}
                    onSave={handleInvSave}
                    initialData={
                        typeof activeInvModal === 'string'
                            ? savings[activeInvModal]
                            : savings[activeInvModal.key]?.[activeInvModal.index]
                    }
                    invType={typeof activeInvModal === 'string' ? activeInvModal : activeInvModal.key}
                />
            )}
        </div>
    );
};

export default BreakdownSavings;
