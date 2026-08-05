import React, { useState, useMemo } from 'react';
import { Calculator, Calendar, DollarSign, TrendingDown, Clock, Plus, Trash2, Info } from 'lucide-react';
import CurrencyInput from '../common/CurrencyInput';
import PercentageInput from '../common/PercentageInput';
import YearsInput from '../common/YearsInput';

const isLeapYear = (year) => {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

const getDaysInMonth = (month, year) => {
    return new Date(year, month, 0).getDate();
};

const HomeLoanEngine = ({ 
    loanKey, title, loanAmount, interestRate, tenureYears, startMonth, startYear, 
    events = [], setEvents, isReadOnly, 
    setLoanAmount, setInterestRate, setTenureYears, setStartMonth, setStartYear 
}) => {
    const currentYear = new Date().getFullYear();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const yearOptions = Array.from({ length: 51 }, (_, i) => currentYear - 5 + i);

    const addEvent = (type) => {
        setEvents([...events, {
            id: Date.now(),
            type,
            value: null,
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

    const amountNum = Number(loanAmount ?? 0);
    const rateNum = Number(interestRate ?? 0);
    const tenureNum = Number(tenureYears ?? 0);

    // Main Calculation Logic: Daily Rest
    const calculationData = useMemo(() => {
        let runningPrincipal = amountNum;
        let currentRate = rateNum;
        let results = [];
        
        const startD = new Date(startYear, startMonth - 1, 1);
        let currentD = new Date(startD);

        // Calculate base EMI (Standard formula for initial reference)
        const P = amountNum;
        const r_initial = rateNum / 12 / 100;
        const n = tenureNum * 12;
        const baseEMI = (P * r_initial * Math.pow(1 + r_initial, n)) / (Math.pow(1 + r_initial, n) - 1);

        let yearlySummary = {
            year: startYear,
            openingBalance: amountNum,
            principalPaid: 0,
            interestPaid: 0,
            prepayments: 0,
            closingBalance: 0
        };

        // We run the loop month by month, but calculate interest daily within each month
        // to handle "Daily Rest" logic.
        // We limit to 50 years max or until principal is 0
        const maxMonths = 600; 
        let monthCount = 0;

        while (runningPrincipal > 0 && monthCount < maxMonths) {
            const m = currentD.getMonth() + 1;
            const y = currentD.getFullYear();
            const daysInMonth = getDaysInMonth(m, y);
            const daysInYear = isLeapYear(y) ? 366 : 365;

            // 1. Check for Rate Change events at the start of this month
            const rateChange = events.find(e => e.type === 'rate_change' && parseInt(e.month) === m && parseInt(e.year) === y);
            if (rateChange) {
                currentRate = Number(rateChange.value ?? currentRate);
            }

            // 2. Daily rest interest calculation for the month
            // Interest = Principal * (Rate/DaysInYear) * DaysInMonth
            // In a true daily rest, principal could change mid-month due to prepayment
            // But usually banks apply prepayments on a specific day or EOM.
            // We'll calculate interest on the daily principal.
            
            // Check for prepayments in this month
            const monthlyPrepayments = events.filter(e => e.type === 'prepayment' && parseInt(e.month) === m && parseInt(e.year) === y);
            const totalPrepaymentThisMonth = monthlyPrepayments.reduce((sum, p) => sum + Number(p.value ?? 0), 0);

            let monthlyInterestAccumulated = 0;
            // Simplification: Interest calculate on monthly opening principal * days
            // If prepayment happens, we'll assume it happens on the 1st for the calculation logic 
            // OR reflect it in next month. Banks vary. We'll do daily on end-of-day balance.
            
            // For this UI, calculating daily within loop:
            const dailyRate = (currentRate / 100) / daysInYear;
            
            // Apply prepayment first (assuming 1st of month for simplicity of math vs complexity of UI)
            runningPrincipal -= totalPrepaymentThisMonth;
            yearlySummary.prepayments += totalPrepaymentThisMonth;

            // Calculate monthly interest based on principal
            monthlyInterestAccumulated = runningPrincipal * dailyRate * daysInMonth;

            // 3. EMI Payment
            // EMI is applied at the end of month
            let principalRepayment = baseEMI - monthlyInterestAccumulated;
            
            // If principal is less than principal repayment, pay only remaining principal
            if (runningPrincipal < principalRepayment) {
                principalRepayment = runningPrincipal;
            }

            yearlySummary.interestPaid += monthlyInterestAccumulated;
            yearlySummary.principalPaid += principalRepayment;
            runningPrincipal -= principalRepayment;

            // 4. Yearly Rollup
            if (m === 12 || runningPrincipal <= 0) {
                yearlySummary.closingBalance = Math.max(0, runningPrincipal);
                results.push({ ...yearlySummary });
                
                if (runningPrincipal > 0) {
                    yearlySummary = {
                        year: y + 1,
                        openingBalance: runningPrincipal,
                        principalPaid: 0,
                        interestPaid: 0,
                        prepayments: 0,
                        closingBalance: 0
                    };
                }
            }

            // Move to next month
            currentD.setMonth(currentD.getMonth() + 1);
            monthCount++;
        }

        return { schedule: results, baseEMI, totalPrincipal: amountNum };
    }, [amountNum, rateNum, tenureNum, startMonth, startYear, events]);

    const totalInterest = useMemo(() => {
        return calculationData.schedule.reduce((sum, y) => sum + y.interestPaid, 0);
    }, [calculationData]);

    const totalPaid = calculationData.totalPrincipal + totalInterest;

    return (
        <div className="fade-in" style={{ padding: '1rem', marginBottom: '3rem' }}>
            <div className="card" style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                    <Calculator size={32} color={isReadOnly ? "var(--success)" : "var(--primary)"} />
                    <div>
                        <h1 style={{ margin: 0 }}>{title}</h1>
                        <p className="text-muted" style={{ margin: 0 }}>
                            {isReadOnly ? "Timeline & Prepayments for your configured synchronized loan." : "Advanced Daily Rest calculation with prepayment & rate change support."}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    {/* SECTION 1: PRIMARY INPUTS */}
                    <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>Primary Parameters</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label><DollarSign size={16} /> Loan Amount (₹)</label>
                                <CurrencyInput
                                    value={loanAmount}
                                    readOnly={isReadOnly}
                                    onValueChange={(v) => !isReadOnly && setLoanAmount(v)}
                                    className="form-input"
                                    style={isReadOnly ? { background: 'var(--bg-main)', cursor: 'not-allowed' } : {}}
                                />
                            </div>

                            <div className="form-group">
                                <label><TrendingDown size={16} /> Annual Interest Rate (%)</label>
                                <PercentageInput
                                    value={interestRate}
                                    readOnly={isReadOnly}
                                    onValueChange={(v) => !isReadOnly && setInterestRate(v)}
                                    className="form-input"
                                    style={isReadOnly ? { background: 'var(--bg-main)', cursor: 'not-allowed' } : {}}
                                />
                            </div>

                            <div className="form-group">
                                <label><Clock size={16} /> Tenure (Years)</label>
                                <YearsInput
                                    value={tenureYears}
                                    readOnly={isReadOnly}
                                    onValueChange={(v) => !isReadOnly && setTenureYears(v)}
                                    className="form-input"
                                    style={isReadOnly ? { background: 'var(--bg-main)', cursor: 'not-allowed' } : {}}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Start Month</label>
                                    <select value={startMonth} onChange={(e) => !isReadOnly && setStartMonth(parseInt(e.target.value))} className="form-input" disabled={isReadOnly} style={isReadOnly ? { background: 'var(--bg-main)', cursor: 'not-allowed' } : {}}>
                                        {monthNames.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Start Year</label>
                                    <select value={startYear} onChange={(e) => !isReadOnly && setStartYear(parseInt(e.target.value))} className="form-input" disabled={isReadOnly} style={isReadOnly ? { background: 'var(--bg-main)', cursor: 'not-allowed' } : {}}>
                                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: INCREMENTAL ADJUSTMENTS */}
                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>Adjustments & Events</h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn" onClick={() => addEvent('prepayment')} title="Add Prepayment" style={{ padding: '0.4rem 0.8rem', background: '#ecfdf5', color: '#059669', border: '1px solid #10b981', fontSize: '0.85rem' }}>+ Prepay</button>
                                <button className="btn" onClick={() => addEvent('rate_change')} title="Add Rate Change" style={{ padding: '0.4rem 0.8rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #3b82f6', fontSize: '0.85rem' }}>+ Rate %</button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                            {events.map(event => (
                                <div key={event.id} className="card" style={{ padding: '1rem', position: 'relative', border: `1px solid ${event.type === 'prepayment' ? '#10b981' : '#3b82f6'}`, flex: '1 1 auto', minWidth: '260px', maxWidth: '350px' }}>
                                    <button onClick={() => removeEvent(event.id)} style={{ position: 'absolute', top: '8px', right: '8px', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginRight: '1.5rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: event.type === 'prepayment' ? '#10b981' : '#3b82f6', width: '80px' }}>
                                                {event.type.replace('_', ' ')}
                                            </span>
                                            <select value={event.month} onChange={(e) => updateEvent(event.id, 'month', e.target.value)} className="form-input" style={{ fontSize: '0.8rem', padding: '0.3rem', width: 'auto' }}>
                                                {monthNames.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                                            </select>
                                            <select value={event.year} onChange={(e) => updateEvent(event.id, 'year', e.target.value)} className="form-input" style={{ fontSize: '0.8rem', padding: '0.3rem', width: 'auto' }}>
                                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                        </div>
                                        {event.type === 'prepayment' ? (
                                            <CurrencyInput
                                                placeholder="Amount"
                                                value={event.value}
                                                onValueChange={(v) => updateEvent(event.id, 'value', v)}
                                                className="form-input"
                                                style={{ width: '100%', padding: '0.4rem', fontSize: '0.85rem' }}
                                            />
                                        ) : (
                                            <PercentageInput
                                                placeholder="New Rate %"
                                                value={event.value}
                                                onValueChange={(v) => updateEvent(event.id, 'value', v)}
                                                className="form-input"
                                                style={{ width: '100%', padding: '0.4rem', fontSize: '0.85rem' }}
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                            {events.length === 0 && <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', width: '100%', border: '1px dashed var(--border)', padding: '1.5rem', borderRadius: '8px' }}>No adjustments added.</p>}
                        </div>
                    </div>

                    {/* SECTION 3: VISUALIZATION */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Summary Header */}
                        <div style={{ 
                            padding: '2rem', 
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                            borderRadius: '16px', 
                            color: 'white',
                            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                <div>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.9rem', color: 'white' }}>Monthly EMI</p>
                                    <h3 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800, color: 'white' }}>₹{Math.round(calculationData.baseEMI).toLocaleString('en-IN')}</h3>
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.9rem', color: 'white' }}>Total Principal</p>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>₹{amountNum.toLocaleString('en-IN')}</h3>
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.9rem', color: 'white' }}>Total Interest</p>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>₹{Math.round(totalInterest).toLocaleString('en-IN')}</h3>
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.9rem', color: 'white' }}>Total Payable</p>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>₹{Math.round(totalPaid).toLocaleString('en-IN')}</h3>
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
                                            <th style={{ padding: '1rem', textAlign: 'right' }}>Principal Paid</th>
                                            <th style={{ padding: '1rem', textAlign: 'right' }}>Interest Paid</th>
                                            <th style={{ padding: '1rem', textAlign: 'right' }}>Prepayments</th>
                                            <th style={{ padding: '1rem', textAlign: 'right' }}>Closing Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {calculationData.schedule.map((row, idx) => (
                                            <tr key={row.year} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : '#f8fbfc' }}>
                                                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--primary)' }}>{row.year}</td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>₹{Math.round(row.openingBalance).toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>₹{Math.round(row.principalPaid).toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>₹{Math.round(row.interestPaid).toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#059669' }}>{row.prepayments > 0 ? `₹${row.prepayments.toLocaleString('en-IN')}` : '-'}</td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#1e40af' }}>₹{Math.round(row.closingBalance).toLocaleString('en-IN')}</td>
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

import { useFinancialPlan } from '../../contexts/FinancialPlanContext';

const HomeLoanCalculator = ({ calculatorKey = "home_loan" }) => {
    const { expenseCategories, journeyAdjustments = [], calculatorInputs, setCalculatorInputs } = useFinancialPlan();
    const data = calculatorInputs[calculatorKey] || {};
    const setData = (newData) => setCalculatorInputs(prev => ({ ...prev, [calculatorKey]: typeof newData === 'function' ? newData(prev[calculatorKey] || {}) : newData }));
    const loansToRender = [];
    const eventMaps = data?.eventMaps || {};
    
    // Helper to safely update events for specific dynamic keys
    const setEventsForKey = (key) => (newEvents) => {
        setData({
            ...data,
            eventMaps: {
                ...eventMaps,
                [key]: typeof newEvents === 'function' ? newEvents(eventMaps[key] || []) : newEvents
            }
        });
    };

    // 1. Check for Active Cash Flow Loan
    const activeRaw = expenseCategories?.emi?.homeLoan;
    if (activeRaw && typeof activeRaw === 'object' && parseFloat(activeRaw.principal) > 0) {
        loansToRender.push({
            loanKey: 'active',
            title: 'Active Home Loan (Cash Flow synchronized)',
            loanAmount: parseFloat(activeRaw.principal) || 0,
            interestRate: parseFloat(activeRaw.rate) || 0,
            tenureYears: (parseFloat(activeRaw.tenure) || 0) / 12, // convert months to years
            startMonth: parseInt(activeRaw.startMonth) || 1,
            startYear: parseInt(activeRaw.startYear) || new Date().getFullYear(),
            events: eventMaps['active'] || [],
            setEvents: setEventsForKey('active'),
            isReadOnly: true
        });
    }

    // 2. Check for Future Journey Loans
    const futureLoans = (journeyAdjustments || []).filter(a => a.type === 'loan' && a.loanCategory === 'homeLoan');
    futureLoans.forEach((fl, i) => {
        loansToRender.push({
            loanKey: `future_${fl.id}`,
            title: `Future Adjustment: ${fl.name}`,
            loanAmount: parseFloat(fl.principal) || 0,
            interestRate: parseFloat(fl.rate) || 0,
            tenureYears: (parseFloat(fl.tenure) || 0) / 12,
            startMonth: parseInt(fl.startMonth) || 1,
            startYear: parseInt(fl.startYear) || new Date().getFullYear(),
            events: eventMaps[`future_${fl.id}`] || [],
            setEvents: setEventsForKey(`future_${fl.id}`),
            isReadOnly: true
        });
    });

    // 3. Standalone Manual Calculator (Always appended if no loans exist, or added explicitly if needed)
    if (loansToRender.length === 0) {
        loansToRender.push({
            loanKey: 'manual',
            title: 'Standalone Home Loan Calculator',
            loanAmount: data?.amount ?? 0,
            interestRate: data?.rate ?? 8.5,
            tenureYears: data?.tenure ?? 20,
            startMonth: data?.startMonth ?? (new Date().getMonth() + 1),
            startYear: data?.startYear ?? new Date().getFullYear(),
            events: data?.events ?? [],
            setEvents: (newEvents) => setData({ ...data, events: typeof newEvents === 'function' ? newEvents(data.events || []) : newEvents }),
            setLoanAmount: (val) => setData({ ...data, amount: val }),
            setInterestRate: (val) => setData({ ...data, rate: val }),
            setTenureYears: (val) => setData({ ...data, tenure: val }),
            setStartMonth: (val) => setData({ ...data, startMonth: val }),
            setStartYear: (val) => setData({ ...data, startYear: val }),
            isReadOnly: false
        });
    }

    return (
        <div>
            {loansToRender.map(loanConfig => (
                <HomeLoanEngine key={loanConfig.loanKey} {...loanConfig} />
            ))}
        </div>
    );
};

export default HomeLoanCalculator;
