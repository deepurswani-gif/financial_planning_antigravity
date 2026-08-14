import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import CurrencyInput from '../common/CurrencyInput';
import YearsInput from '../common/YearsInput';

const InvestmentDetailsModal = ({ isOpen, onClose, onSave, initialData, investmentTypeTitle }) => {
    const currentYearVal = new Date().getFullYear();
    const currentMonthVal = new Date().getMonth() + 1;

    const [formData, setFormData] = useState({
        amount: '',
        startMonth: currentMonthVal,
        startYear: currentYearVal,
        duration: investmentTypeTitle === 'PPF' ? 15 : 10
    });

    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const clampIfFuture = (year, month) => {
                const y = parseInt(year, 10) || currentYearVal;
                const m = parseInt(month, 10) || currentMonthVal;
                if (y > currentYearVal || (y === currentYearVal && m > currentMonthVal)) {
                    return { startYear: currentYearVal, startMonth: currentMonthVal };
                }
                return { startYear: y, startMonth: m };
            };

            if (initialData && typeof initialData === 'object') {
                const { startYear, startMonth } = clampIfFuture(
                    initialData.startYear || currentYearVal,
                    initialData.startMonth || currentMonthVal,
                );
                setFormData({
                    amount: initialData.amount || '',
                    startMonth,
                    startYear,
                    duration: initialData.duration || (investmentTypeTitle === 'PPF' ? 15 : 10)
                });
            } else {
                setFormData({
                    amount: initialData || '',
                    startMonth: currentMonthVal,
                    startYear: currentYearVal,
                    duration: investmentTypeTitle === 'PPF' ? 15 : 10
                });
            }
        }
    }, [isOpen, initialData, currentMonthVal, currentYearVal, investmentTypeTitle]);

    if (!isOpen) return null;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const clampStartDate = (year, month) => {
        let y = parseInt(year, 10);
        let m = parseInt(month, 10);
        if (y > currentYearVal || (y === currentYearVal && m > currentMonthVal)) {
            y = currentYearVal;
            m = currentMonthVal;
        }
        return { startYear: y, startMonth: m };
    };

    const handleSave = () => {
        const val = parseFloat(formData.amount);
        if (isNaN(val) || val <= 0) {
            onSave(''); // Revert to pure unconfigured mode
        } else {
            const { startYear, startMonth } = clampStartDate(formData.startYear, formData.startMonth);
            onSave({
                amount: val,
                startMonth,
                startYear,
                duration: investmentTypeTitle === 'PPF' ? 15 : (parseInt(formData.duration, 10) || 10)
            });
        }
        setShowSuccess(true);
        setTimeout(() => {
            setShowSuccess(false);
            onClose();
        }, 1500);
    };

    const handleClear = () => {
        onSave('');
        onClose();
    }

    const isPPF = investmentTypeTitle === 'PPF';

    const yearOptions = [];
    for (let y = currentYearVal - 40; y <= currentYearVal; y++) {
        yearOptions.push(y);
    }

    const handleStartYearChange = (yearVal) => {
        const y = parseInt(yearVal, 10);
        let month = parseInt(formData.startMonth, 10);
        if (y === currentYearVal && month > currentMonthVal) {
            month = currentMonthVal;
        }
        setFormData({ ...formData, startYear: y, startMonth: month });
    };

    const handleStartMonthChange = (monthVal) => {
        const m = parseInt(monthVal, 10);
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
                    Configure {investmentTypeTitle} Details
                </h3>
                
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    Configure the exact parameters of your active {investmentTypeTitle} to ensure accurate compounding baseline synchronization.
                </p>

                {/* Section 1: Investment Details */}
                <div style={{ marginBottom: '1.5rem', background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '1rem' }}>Investment Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="amount">Monthly Investment / Contribution Amount (₹)</label>
                            <CurrencyInput
                                id="amount"
                                aria-label="Investment Amount"
                                value={formData.amount}
                                onValueChange={(v) => setFormData({ ...formData, amount: v == null ? '' : String(v) })}
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>e.g. 5000</small>
                        </div>
                        
                        {!isPPF && (
                            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                                <label htmlFor="duration">Tenure / Duration (Years)</label>
                                <YearsInput
                                    id="duration"
                                    min={1}
                                    max={60}
                                    aria-label="Investment Duration"
                                    value={formData.duration}
                                    onValueChange={(v) => setFormData({ ...formData, duration: v == null ? '' : v })}
                                />
                                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>e.g. 10</small>
                            </div>
                        )}
                        
                        {isPPF && (
                            <div style={{ gridColumn: '1 / -1', background: 'var(--indigo-50, #e0f2fe)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--indigo-200, #bae6fd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontWeight: 600, color: 'var(--slate-700, #0f172a)', display: 'block' }}>Mandatory Tenure: 15 Years</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--slate-600, #334155)' }}>Maturity Date: {monthNames[parseInt(formData.startMonth, 10) - 1]} {parseInt(formData.startYear, 10) + 15}</span>
                                </div>
                                <span style={{ padding: '0.25rem 0.6rem', background: 'var(--indigo-600, #0284c7)', color: 'white', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>AUTO-LOCKED</span>
                            </div>
                        )}
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
                                {monthNames.map((m, i) => {
                                    const monthNum = i + 1;
                                    if (parseInt(formData.startYear, 10) === currentYearVal && monthNum > currentMonthVal) {
                                        return null;
                                    }
                                    return <option key={m} value={monthNum}>{m}</option>;
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
                        Start date cannot be in the future. Only past or current month/year can be selected.
                    </small>
                </div>

                {showSuccess && (
                    <div style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'var(--emerald-500, #10b981)', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                        Saved Successfully!
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <button className="btn" aria-label="Clear Configuration" onClick={handleClear} style={{ color: 'var(--rose-500, #f43f5e)', background: 'transparent', border: 'none', padding: '0.5rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                         <span style={{fontSize: '1.2rem', lineHeight: 1}}>×</span> Clear Config
                    </button>
                    <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
                        <button className="btn" aria-label="Cancel" onClick={onClose} style={{ padding: '0.6rem 1rem', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
                        <button className="btn btn-primary" aria-label="Save Configuration" onClick={handleSave} style={{ padding: '0.6rem 1.5rem', transition: 'background 0.2s', cursor: 'pointer' }}>Verify & Save</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default InvestmentDetailsModal;
