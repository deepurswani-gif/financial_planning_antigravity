import React, { useState, useMemo } from 'react';
import { Calculator, Calendar, DollarSign, TrendingDown, Clock, Info, Car } from 'lucide-react';
import CurrencyInput from '../common/CurrencyInput';
import PercentageInput from '../common/PercentageInput';
import YearsInput from '../common/YearsInput';

const TwoWheelerLoanEngine = ({
    loanKey, title, loanAmount, interestRate, tenureYears, startMonth, startYear, 
    isReadOnly,
    setLoanAmount, setInterestRate, setTenureYears, setStartMonth, setStartYear
}) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Derived values
    const amountNum = Number(loanAmount ?? 0);
    const rateNum = Number(interestRate ?? 0);
    const tenureNum = Number(tenureYears ?? 0);
    const tenureMonths = tenureNum * 12;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const yearOptions = Array.from({ length: 31 }, (_, i) => currentYear - 5 + i);

    // Calculate Loan End Date
    const endDateData = useMemo(() => {
        let endM = startMonth + tenureMonths - 1;
        let endY = startYear + Math.floor((endM - 1) / 12);
        endM = ((endM - 1) % 12) + 1;
        return { month: endM, year: endY };
    }, [startMonth, startYear, tenureMonths]);

    // EMI Calculation (Reducing Balance)
    const emiData = useMemo(() => {
        const P = amountNum;
        const r = rateNum / 12 / 100;
        const n = tenureMonths;

        if (r === 0) return { emi: P / n, totalPayment: P, totalInterest: 0 };

        const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        const totalPayment = emi * n;
        const totalInterest = totalPayment - P;

        return { emi, totalPayment, totalInterest };
    }, [amountNum, rateNum, tenureMonths]);

    // Table Schedule Generation
    const schedule = useMemo(() => {
        let results = [];
        let runningBalance = amountNum;
        const r = rateNum / 12 / 100;
        const monthlyEMI = emiData.emi;

        let currentM = startMonth;
        let currentY = startYear;

        let yearlyData = {
            year: currentY,
            openingBalance: amountNum,
            principalPaid: 0,
            interestPaid: 0,
            closingBalance: 0
        };

        for (let m = 1; m <= tenureMonths; m++) {
            const interestForMonth = runningBalance * r;
            const principalForMonth = monthlyEMI - interestForMonth;
            
            yearlyData.principalPaid += principalForMonth;
            yearlyData.interestPaid += interestForMonth;
            runningBalance -= principalForMonth;

            // If it's December or the last month of the loan, push the year
            if (currentM === 12 || m === tenureMonths) {
                yearlyData.closingBalance = Math.max(0, runningBalance);
                results.push({ ...yearlyData });
                
                if (m < tenureMonths) {
                    currentY++;
                    yearlyData = {
                        year: currentY,
                        openingBalance: runningBalance,
                        principalPaid: 0,
                        interestPaid: 0,
                        closingBalance: 0
                    };
                }
            }

            currentM = (currentM % 12) + 1;
        }

        return results;
    }, [amountNum, rateNum, tenureMonths, startMonth, startYear, emiData.emi]);

    return (
        <div className="fade-in" style={{ padding: '1rem' }}>
            <div className="card" style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                    <Car size={32} color={isReadOnly ? "var(--success)" : "var(--primary)"} />
                    <div>
                        <h1 style={{ margin: 0 }}>{title}</h1>
                        <p className="text-muted" style={{ margin: 0 }}>
                            {isReadOnly ? "Timeline mapping for your synchronized loan vehicle financing." : "Plan your two-wheeler financing with easy reducing balance logic."}
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
                                <label><TrendingDown size={16} /> Interest Rate (% p.a.)</label>
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
                                <small className="text-muted">Tenure in Months: {tenureMonths}</small>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Start Month</label>
                                    <select 
                                        value={startMonth} 
                                        onChange={(e) => !isReadOnly && setStartMonth(parseInt(e.target.value))}
                                        className="form-input"
                                        disabled={isReadOnly}
                                        style={isReadOnly ? { background: 'var(--bg-main)', cursor: 'not-allowed' } : {}}
                                    >
                                        {monthNames.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Start Year</label>
                                    <select 
                                        value={startYear} 
                                        onChange={(e) => !isReadOnly && setStartYear(parseInt(e.target.value))}
                                        className="form-input"
                                        disabled={isReadOnly}
                                        style={isReadOnly ? { background: 'var(--bg-main)', cursor: 'not-allowed' } : {}}
                                    >
                                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                                <Calendar size={16} />
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Loan Timeline:</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.9rem' }}>
                                Ends in: <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{monthNames[endDateData.month-1]} {endDateData.year}</span>
                            </p>
                        </div>
                    </div>

                    {/* SECTION 2: VISUALIZATION */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Summary Cards */}
                        <div style={{ 
                            padding: '2rem', 
                            background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)', 
                            borderRadius: '16px', 
                            color: 'white',
                            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                <div>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.9rem' }}>Monthly EMI</p>
                                    <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800 }}>
                                        ₹{Math.round(emiData.emi).toLocaleString('en-IN')}
                                    </h2>
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.9rem' }}>Principal Amount</p>
                                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
                                        ₹{amountNum.toLocaleString('en-IN')}
                                    </h2>
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.9rem' }}>Total Interest</p>
                                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
                                        ₹{Math.round(emiData.totalInterest).toLocaleString('en-IN')}
                                    </h2>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div style={{ 
                            background: 'var(--bg-card)', 
                            borderRadius: '12px', 
                            border: '1px solid var(--border)', 
                            overflow: 'hidden'
                        }}>
                            <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
                                <table className="summary-table" style={{ width: '100%', fontSize: '0.95rem', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                        <tr>
                                            <th style={{ padding: '1.25rem', textAlign: 'left', fontWeight: 700 }}>Year</th>
                                            <th style={{ padding: '1.25rem', textAlign: 'right', fontWeight: 700 }}>Opening Balance</th>
                                            <th style={{ padding: '1.25rem', textAlign: 'right', fontWeight: 700 }}>Principal Paid</th>
                                            <th style={{ padding: '1.25rem', textAlign: 'right', fontWeight: 700 }}>Interest Paid</th>
                                            <th style={{ padding: '1.25rem', textAlign: 'right', fontWeight: 700 }}>Closing Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {schedule.map((row, idx) => (
                                            <tr key={row.year} style={{ 
                                                borderBottom: '1px solid var(--border)',
                                                background: idx % 2 === 0 ? 'transparent' : '#fcfcfc'
                                            }}>
                                                <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{row.year}</td>
                                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>₹{Math.round(row.openingBalance).toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>₹{Math.round(row.principalPaid).toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>₹{Math.round(row.interestPaid).toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                                                    ₹{Math.round(row.closingBalance).toLocaleString('en-IN')}
                                                </td>
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

const TwoWheelerCalculator = ({ calculatorKey = "two_wheeler_loan" }) => {
    const { expenseCategories, journeyAdjustments = [], calculatorInputs, setCalculatorInputs } = useFinancialPlan();
    const data = calculatorInputs[calculatorKey] || {};
    const setData = (newData) => setCalculatorInputs(prev => ({ ...prev, [calculatorKey]: typeof newData === 'function' ? newData(prev[calculatorKey] || {}) : newData }));
    const loansToRender = [];

    // 1. Check for Active Cash Flow Loan
    const activeRaw = expenseCategories?.emi?.twoWheelerLoan;
    if (activeRaw && typeof activeRaw === 'object' && parseFloat(activeRaw.principal) > 0) {
        loansToRender.push({
            loanKey: 'active',
            title: 'Active Two-Wheeler Loan (Cash Flow synchronized)',
            loanAmount: parseFloat(activeRaw.principal) || 0,
            interestRate: parseFloat(activeRaw.rate) || 0,
            tenureYears: (parseFloat(activeRaw.tenure) || 0) / 12, // convert months to years
            startMonth: parseInt(activeRaw.startMonth) || 1,
            startYear: parseInt(activeRaw.startYear) || new Date().getFullYear(),
            isReadOnly: true
        });
    }

    // 2. Check for Future Journey Loans
    const futureLoans = (journeyAdjustments || []).filter(a => a.type === 'loan' && a.loanCategory === 'twoWheelerLoan');
    futureLoans.forEach((fl, i) => {
        loansToRender.push({
            loanKey: `future_${fl.id}`,
            title: `Future Adjustment: ${fl.name}`,
            loanAmount: parseFloat(fl.principal) || 0,
            interestRate: parseFloat(fl.rate) || 0,
            tenureYears: (parseFloat(fl.tenure) || 0) / 12,
            startMonth: parseInt(fl.startMonth) || 1,
            startYear: parseInt(fl.startYear) || new Date().getFullYear(),
            isReadOnly: true
        });
    });

    // 3. Standalone Manual Calculator
    if (loansToRender.length === 0) {
        loansToRender.push({
            loanKey: 'manual',
            title: 'Standalone Two-Wheeler Loan Calculator',
            loanAmount: data?.amount ?? 0,
            interestRate: data?.rate ?? 11.5,
            tenureYears: data?.tenure ?? 3,
            startMonth: data?.startMonth ?? (new Date().getMonth() + 1),
            startYear: data?.startYear ?? new Date().getFullYear(),
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
                <TwoWheelerLoanEngine key={loanConfig.loanKey} {...loanConfig} />
            ))}
        </div>
    );
};

export default TwoWheelerCalculator;
