import React, { useState, useMemo } from 'react';
import { Calculator, Calendar, DollarSign, TrendingUp, Clock, Plus, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import CurrencyInput from '../common/CurrencyInput';
import PercentageInput from '../common/PercentageInput';
import YearsInput from '../common/YearsInput';

const SWPCalculator = ({ calculatorKey = "swp" }) => {
    const { calculatorInputs, setCalculatorInputs } = useFinancialPlan();
    const data = calculatorInputs[calculatorKey] || {};
    const setData = (newData) => setCalculatorInputs(prev => ({ ...prev, [calculatorKey]: typeof newData === 'function' ? newData(prev[calculatorKey] || {}) : newData }));
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Use props if available, otherwise defaults
    const investmentAmount = data?.amount ?? 0;
    const monthlyWithdrawal = data?.withdrawal ?? 0;
    const expectedReturns = data?.rate ?? 10;
    const tenureYears = data?.tenure ?? 15;
    const events = data?.events ?? [];

    // Setters using setData
    const setInvestmentAmount = (val) => setData({ ...data, amount: val });
    const setMonthlyWithdrawal = (val) => setData({ ...data, withdrawal: val });
    const setExpectedReturns = (val) => setData({ ...data, rate: val });
    const setTenureYears = (val) => setData({ ...data, tenure: val });
    const setEvents = (val) => setData({ ...data, events: typeof val === 'function' ? val(events) : val });

    // State for inputs (remaining useState)
    const [startAfterYears, setStartAfterYears] = useState(0);
    const [startMonth, setStartMonth] = useState(currentMonth);
    const [startYear, setStartYear] = useState(currentYear);
    const [annualIncrement, setAnnualIncrement] = useState(0); // Yearly % increase in withdrawal


    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const yearOptions = Array.from({ length: 41 }, (_, i) => currentYear - 5 + i);

    const addEvent = (type) => {
        setEvents([...events, {
            id: Date.now(),
            type, // 'adjustment' or 'lumpsum'
            value: null, // New monthly amount or Lumpsum amount
            month: 1,
            year: currentYear
        }]);
    };

    const removeEvent = (id) => {
        setEvents(events.filter(e => e.id !== id));
    };

    const updateEvent = (id, field, value) => {
        setEvents(events.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const amountNum = Number(investmentAmount ?? 0);
    const withdrawalNum = Number(monthlyWithdrawal ?? 0);
    const rateNum = Number(expectedReturns ?? 0);
    const tenureNum = Number(tenureYears ?? 0);
    const startAfterNum = Number(startAfterYears ?? 0);
    const annualIncNum = Number(annualIncrement ?? 0);

    // Calculation Logic: Simple monthly interest (Nominal/12) to match standard benchmarks
    const calculationData = useMemo(() => {
        let results = [];
        let runningBalance = amountNum;
        let currentMonthlyWithdrawal = withdrawalNum;
        const monthlyGrowth = rateNum / 100 / 12; // Simple monthly rate
        
        let currentMonthVal = startMonth;
        let currentYearVal = startYear;
        const totalMonths = tenureNum * 12;
        const swpStartMonthIndex = startAfterNum * 12;

        let yearlyRecord = {
            year: currentYearVal,
            openingBalance: runningBalance,
            yearlyWithdrawal: 0,
            balanceAfterWithdrawal: 0,
            lumpsumWithdrawal: 0,
            finalValue: 0
        };

        for (let m = 0; m < totalMonths; m++) {
            // Apply Annual Increment at the start of each relative year (except first year or deferred period)
            if (m > 0 && m % 12 === 0 && annualIncNum > 0 && m >= swpStartMonthIndex) {
                currentMonthlyWithdrawal *= (1 + annualIncNum / 100);
            }

            // check for midpoint events
            const monthlyEvents = events.filter(e => parseInt(e.month) === currentMonthVal && parseInt(e.year) === currentYearVal);
            
            monthlyEvents.forEach(e => {
                if (e.type === 'adjustment') {
                    currentMonthlyWithdrawal = Number(e.value ?? 0);
                } else if (e.type === 'lumpsum') {
                    const amount = Number(e.value ?? 0);
                    yearlyRecord.lumpsumWithdrawal += amount;
                    runningBalance -= amount;
                }
            });

            // Apply Monthly Withdrawal (if after deferred period) first
            let actualWithdrawalThisMonth = 0;
            if (m >= swpStartMonthIndex) {
                actualWithdrawalThisMonth = Math.min(runningBalance, currentMonthlyWithdrawal);
                runningBalance -= actualWithdrawalThisMonth;
                yearlyRecord.yearlyWithdrawal += actualWithdrawalThisMonth;
            }

            // Apply Monthly Growth on the remaining balance
            runningBalance *= (1 + monthlyGrowth);

            // Yearly Summary (Calendar Year)
            if (currentMonthVal === 12 || m === totalMonths - 1) {
                yearlyRecord.finalValue = runningBalance;
                yearlyRecord.balanceAfterWithdrawal = runningBalance + yearlyRecord.lumpsumWithdrawal; // Back-calculated for display order
                results.push({ ...yearlyRecord });

                if (m < totalMonths - 1) {
                    currentYearVal++;
                    yearlyRecord = {
                        year: currentYearVal,
                        openingBalance: runningBalance,
                        yearlyWithdrawal: 0,
                        balanceAfterWithdrawal: 0,
                        lumpsumWithdrawal: 0,
                        finalValue: 0
                    };
                }
            }

            currentMonthVal = (currentMonthVal % 12) + 1;
            if (runningBalance <= 0) break;
        }

        return results;
    }, [amountNum, withdrawalNum, rateNum, startAfterNum, tenureNum, startMonth, startYear, annualIncNum, events]);

    const finalValue = calculationData[calculationData.length - 1]?.finalValue || 0;
    const totalWithdrawn = calculationData.reduce((sum, y) => sum + y.yearlyWithdrawal + y.lumpsumWithdrawal, 0);

    return (
        <div className="fade-in" style={{ padding: '1rem' }}>
            <div className="card" style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                    <Calculator size={32} color="var(--primary)" />
                    <div>
                        <h1 style={{ margin: 0 }}>SWP Calculator</h1>
                        <p className="text-muted" style={{ margin: 0 }}>Systematic Withdrawal Plan with CAGR growth and advanced adjustment controls.</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    {/* SECTION 1: PRIMARY INPUTS */}
                    <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>Primary Parameters</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label><DollarSign size={16} /> Initial Investment (₹)</label>
                                <CurrencyInput
                                    value={investmentAmount}
                                    onValueChange={setInvestmentAmount}
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label><ArrowDownRight size={16} /> Initial Monthly Withdrawal (₹)</label>
                                <CurrencyInput
                                    value={monthlyWithdrawal}
                                    onValueChange={setMonthlyWithdrawal}
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label><TrendingUp size={16} /> Exp. CAGR (%)</label>
                                <PercentageInput
                                    value={expectedReturns}
                                    onValueChange={setExpectedReturns}
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label><ArrowUpRight size={16} /> Annual Increase (%)</label>
                                <PercentageInput
                                    value={annualIncrement}
                                    onValueChange={setAnnualIncrement}
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label><Calendar size={16} /> Start After (Years)</label>
                                <YearsInput
                                    value={startAfterYears}
                                    onValueChange={setStartAfterYears}
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label><Clock size={16} /> Tenure (Years)</label>
                                <YearsInput
                                    value={tenureYears}
                                    onValueChange={setTenureYears}
                                    className="form-input"
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Start Month</label>
                                    <select value={startMonth} onChange={(e) => setStartMonth(parseInt(e.target.value))} className="form-input">
                                        {monthNames.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Start Year</label>
                                    <select value={startYear} onChange={(e) => setStartYear(parseInt(e.target.value))} className="form-input">
                                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: INCREMENTAL ADJUSTMENTS */}
                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>Future Adjustments</h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn" onClick={() => addEvent('adjustment')} style={{ padding: '0.4rem 0.8rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #3b82f6', fontSize: '0.85rem' }}>+ Adjust Monthly</button>
                                <button className="btn" onClick={() => addEvent('lumpsum')} style={{ padding: '0.4rem 0.8rem', background: '#fff1f2', color: '#e11d48', border: '1px solid #f43f5e', fontSize: '0.85rem' }}>+ Lumpsum Withdraw</button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                            {events.map(event => (
                                <div key={event.id} className="card" style={{ padding: '1rem', position: 'relative', border: `1px solid ${event.type === 'adjustment' ? '#3b82f6' : '#f43f5e'}`, flex: '1 1 auto', minWidth: '260px', maxWidth: '350px' }}>
                                    <button onClick={() => removeEvent(event.id)} style={{ position: 'absolute', top: '8px', right: '8px', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginRight: '1.5rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: event.type === 'adjustment' ? '#3b82f6' : '#f43f5e', width: '80px' }}>
                                                {event.type}
                                            </span>
                                            <select value={event.month} onChange={(e) => updateEvent(event.id, 'month', e.target.value)} className="form-input" style={{ fontSize: '0.8rem', padding: '0.3rem', width: 'auto' }}>
                                                {monthNames.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                                            </select>
                                            <select value={event.year} onChange={(e) => updateEvent(event.id, 'year', e.target.value)} className="form-input" style={{ fontSize: '0.8rem', padding: '0.3rem', width: 'auto' }}>
                                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                        </div>
                                        <CurrencyInput
                                            placeholder={event.type === 'adjustment' ? 'New Monthly Amt' : 'Lumpsum Amt'}
                                            value={event.value}
                                            onValueChange={(v) => updateEvent(event.id, 'value', v)}
                                            className="form-input"
                                            style={{ width: '100%', padding: '0.4rem', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                </div>
                            ))}
                            {events.length === 0 && <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', width: '100%', border: '1px dashed var(--border)', padding: '1.5rem', borderRadius: '8px' }}>No future adjustments added.</p>}
                        </div>
                    </div>

                    {/* SECTION 3: VISUALIZATION */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Summary Header */}
                        <div style={{ 
                            padding: '2rem', 
                            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
                            borderRadius: '16px', 
                            color: 'white',
                            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                <div>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.8, fontSize: '0.9rem' }}>Remaining Balance</p>
                                    <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800 }}>₹{Math.round(finalValue).toLocaleString('en-IN')}</h2>
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.8, fontSize: '0.9rem' }}>Total Withdrawn</p>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#60a5fa' }}>₹{Math.round(totalWithdrawn).toLocaleString('en-IN')}</h3>
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.8, fontSize: '0.9rem' }}>Profit Generated</p>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#34d399' }}>₹{Math.round(finalValue + totalWithdrawn - amountNum).toLocaleString('en-IN')}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Amortization Table */}
                        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
                                <table className="summary-table" style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                        <tr>
                                            <th style={{ padding: '1rem', textAlign: 'left' }}>Year</th>
                                            <th style={{ padding: '1rem', textAlign: 'right' }}>Opening Balance</th>
                                            <th style={{ padding: '1rem', textAlign: 'right' }}>Yearly Withdrawal</th>
                                            <th style={{ padding: '1rem', textAlign: 'right' }}>Bal after With.</th>
                                            <th style={{ padding: '1rem', textAlign: 'right' }}>Lumpsum With.</th>
                                            <th style={{ padding: '1rem', textAlign: 'right' }}>Final Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {calculationData.map((row, idx) => (
                                            <tr key={row.year} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : '#f8fafc' }}>
                                                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--primary)' }}>{row.year}</td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>₹{Math.round(row.openingBalance).toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>₹{Math.round(row.yearlyWithdrawal).toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', opacity: 0.8 }}>₹{Math.round(row.openingBalance - row.yearlyWithdrawal).toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#e11d48' }}>{row.lumpsumWithdrawal > 0 ? `₹${row.lumpsumWithdrawal.toLocaleString('en-IN')}` : '-'}</td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: '1.05rem' }}>₹{Math.round(row.finalValue).toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SWPCalculator;
