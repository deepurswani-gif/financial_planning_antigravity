import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import CurrencyInput from '../common/CurrencyInput';
import PercentageInput from '../common/PercentageInput';
import IntegerInput from '../common/IntegerInput';

const LoanDetailsModal = ({ isOpen, onClose, onSave, initialData, loanTypeTitle }) => {
    const [formData, setFormData] = useState({
        principal: '',
        rate: '',
        tenure: '',
        startMonth: new Date().getMonth() + 1,
        startYear: new Date().getFullYear(),
        emi: ''
    });

    const [showSuccess, setShowSuccess] = useState(false);
    const [dateError, setDateError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setDateError('');
        if (initialData && typeof initialData === 'object' && initialData.principal) {
            setFormData(initialData);
        } else {
            setFormData({
                principal: '',
                rate: '',
                tenure: '',
                startMonth: new Date().getMonth() + 1,
                startYear: new Date().getFullYear(),
                emi: initialData || ''
            });
        }
    }, [initialData, isOpen]);

    // Calculate EMI dynamically
    useEffect(() => {
        const p = Number(formData.principal ?? 0);
        const r = Number(formData.rate ?? 0);
        const n = Number(formData.tenure ?? 0);

        if (p > 0 && r > 0 && n > 0) {
            const monthlyRate = r / 12 / 100;
            const calculatedEmi = Math.round((p * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1));
            setFormData(prev => ({ ...prev, emi: calculatedEmi }));
        } else {
            setFormData(prev => ({ ...prev, emi: '' }));
        }
    }, [formData.principal, formData.rate, formData.tenure]);

    if (!isOpen) return null;

    const handleSave = () => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const startYear = parseInt(formData.startYear, 10);
        const startMonth = parseInt(formData.startMonth, 10);
        if (startYear > currentYear || (startYear === currentYear && startMonth > currentMonth)) {
            setDateError('Loan start date cannot be in the future. Please select a past or current month and year.');
            return;
        }
        setDateError('');
        onSave(formData);
        setShowSuccess(true);
        setTimeout(() => {
            setShowSuccess(false);
            onClose();
        }, 1500);
    };

    const handleClear = () => {
        onSave(''); // Clear back to empty string primitive
        onClose();
    };

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const yearOptions = [];
    for (let y = currentYear - 30; y <= currentYear; y++) {
        yearOptions.push(y);
    }

    const handleStartYearChange = (yearVal) => {
        const y = parseInt(yearVal, 10);
        let month = parseInt(formData.startMonth, 10);
        if (y === currentYear && month > currentMonth) {
            month = currentMonth;
        }
        setDateError('');
        setFormData({ ...formData, startYear: y, startMonth: month });
    };

    const handleStartMonthChange = (monthVal) => {
        const m = parseInt(monthVal, 10);
        setDateError('');
        setFormData({ ...formData, startMonth: m });
    };

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 3000, padding: '1rem'
        }}>
            <div className="card fade-in" style={{
                background: 'var(--bg-main)', width: '100%', maxWidth: '550px',
                padding: '2rem', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                border: '1px solid var(--border)',
                maxHeight: '90vh', overflowY: 'auto',
                position: 'relative'
            }}>
                <h3 style={{ marginTop: 0, color: 'var(--primary)', borderBottom: '2px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
                    Configure {loanTypeTitle} Details
                </h3>

                {/* Section 1: Loan Details */}
                <div style={{ marginBottom: '1.5rem', background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '1rem' }}>Loan Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="principal">Original Loan Amount (₹)</label>
                            <CurrencyInput
                                id="principal"
                                aria-label="Original Loan Amount"
                                value={formData.principal}
                                onValueChange={(v) => setFormData({ ...formData, principal: v == null ? '' : String(v) })}
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>e.g. 5000000</small>
                        </div>

                        <div className="input-group">
                            <label htmlFor="rate">Interest Rate (%)</label>
                            <PercentageInput
                                id="rate"
                                aria-label="Interest Rate Percentage"
                                value={formData.rate}
                                onValueChange={(v) => setFormData({ ...formData, rate: v == null ? '' : String(v) })}
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>e.g. 8.5 (max 2 decimals)</small>
                        </div>

                        <div className="input-group">
                            <label htmlFor="tenure">Total Tenure (Months)</label>
                            <IntegerInput
                                id="tenure"
                                aria-label="Total Tenure in Months"
                                value={formData.tenure}
                                min={1}
                                onValueChange={(v) => setFormData({ ...formData, tenure: v == null ? '' : String(v) })}
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>e.g. 240 for 20 Yrs</small>
                        </div>
                    </div>
                </div>

                {/* Section 2: Timeline */}
                <div style={{ marginBottom: '1.5rem', background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '1rem' }}>Timeline</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                        <div className="input-group">
                            <label htmlFor="startMonth">Start Month</label>
                            <select id="startMonth" aria-label="Start Month" value={formData.startMonth} onChange={(e) => handleStartMonthChange(e.target.value)}
                                style={{ appearance: 'auto', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-main)', color: 'var(--text-main)', width: '100%' }}
                            >
                                {[...Array(12)].map((_, i) => {
                                    const m = i + 1;
                                    if (formData.startYear === currentYear && m > currentMonth) return null;
                                    return (
                                        <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString('default', { month: 'short' })}</option>
                                    );
                                })}
                            </select>
                        </div>

                        <div className="input-group">
                            <label htmlFor="startYear">Start Year</label>
                            <select id="startYear" aria-label="Start Year"
                                value={formData.startYear}
                                onChange={(e) => handleStartYearChange(e.target.value)}
                                style={{ appearance: 'auto', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-main)', color: 'var(--text-main)', width: '100%' }}
                            >
                                {yearOptions.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.75rem', display: 'block' }}>
                        Loan start date cannot be in the future. Used by the Timeline Engine to map exact loan closures.
                    </small>
                    {dateError && (
                        <p role="alert" style={{ color: 'var(--negative, #dc2626)', fontSize: '0.82rem', marginTop: '0.75rem', marginBottom: 0, fontWeight: 600 }}>
                            {dateError}
                        </p>
                    )}
                </div>

                {/* Section 3: Summary (Calculated EMI) */}
                <div style={{ 
                    background: 'var(--indigo-50, #e0f2fe)', 
                    padding: '1.5rem', 
                    borderRadius: '8px', 
                    border: '1px solid var(--indigo-200, #bae6fd)', 
                    marginBottom: '2rem', 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center'
                }}>
                    <span style={{ fontWeight: 600, color: 'var(--slate-700, #0f172a)', marginBottom: '0.5rem' }}>Calculated Monthly EMI</span>
                    <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--indigo-600, #0284c7)', lineHeight: 1 }}>
                        ₹{formData.emi ? Number(formData.emi).toLocaleString('en-IN') : '0'}
                    </span>
                    {formData.emi && (
                        <span style={{ fontSize: '0.9rem', color: 'var(--slate-600, #334155)', marginTop: '0.5rem', fontWeight: 500 }}>
                            (₹{Number(formData.emi).toLocaleString('en-IN')} per month)
                        </span>
                    )}
                </div>

                {showSuccess && (
                    <div style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'var(--emerald-500, #10b981)', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                        Saved Successfully!
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <button className="btn" aria-label="Clear Loan" onClick={handleClear} style={{ color: 'var(--rose-500, #f43f5e)', background: 'transparent', border: 'none', padding: '0.5rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                         <span style={{fontSize: '1.2rem', lineHeight: 1}}>×</span> Clear Default
                    </button>
                    <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
                        <button className="btn" aria-label="Cancel" onClick={onClose} style={{ padding: '0.6rem 1rem', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
                        <button className="btn btn-primary" aria-label="Save Configuration" onClick={handleSave} style={{ padding: '0.6rem 1.5rem', transition: 'background 0.2s', cursor: 'pointer' }} disabled={!formData.emi && formData.principal}>Save Configuration</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default LoanDetailsModal;

