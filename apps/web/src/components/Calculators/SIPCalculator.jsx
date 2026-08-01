import React, { useEffect, useMemo, useCallback } from 'react';
import { TrendingUp, Wallet, Calculator, Clock } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import WhatIfExplorer from './WhatIfExplorer';

export const computeSIPData = (currentYear, monthlySIP, expectedReturns, tenureYears, currentValue, events, proposedSIPs, goalMappings = {}, goals = []) => {
    let results = [];
    let runningBalance = currentValue;
    let runningSIP = monthlySIP;

    for (let relativeYear = 1; relativeYear <= tenureYears; relativeYear++) {
        let yearlyInvestment = 0;
        let yearlyWithdrawal = 0;
        const actualYear = currentYear + relativeYear - 1;

        // Auto Roadmap Goal Withdrawals (Triggered in Month 1 of that year)
        let totalRoadmapWithdrawalThisYear = 0;
        goals.forEach(g => {
            const goalYear = currentYear + Math.round(parseFloat(g.yearsToGoal) || 0);
            if (goalYear === actualYear) {
                const mappedAmount = (goalMappings[g.id] || {})['sip'] || 0;
                if (mappedAmount > 0) {
                    totalRoadmapWithdrawalThisYear += parseFloat(mappedAmount);
                }
            }
        });

        for (let month = 1; month <= 12; month++) {
            // 1. Manual / what-if increments (permanent monthly SIP step-up)
            const increments = events.filter(e => e.type === 'increment' && parseInt(e.month) === month && parseInt(e.year) === actualYear);
            increments.forEach(inc => {
                runningSIP += parseFloat(inc.amount) || 0;
            });

            // 2. Proposed SIPs from Allocation Module
            const autoSIPs = proposedSIPs.filter(s => parseInt(s.startYear) === actualYear && parseInt(s.startMonth) === month);
            autoSIPs.forEach(s => {
                runningSIP += (parseFloat(s.amount) / 12) || 0;
            });

            // 3. Withdrawals (Manual/what-if + Auto Roadmap mapped in January)
            const withdrawals = events.filter(e => e.type === 'withdrawal' && parseInt(e.month) === month && parseInt(e.year) === actualYear);
            let currentMonthWithdrawal = withdrawals.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
            if (month === 1) {
                currentMonthWithdrawal += totalRoadmapWithdrawalThisYear;
            }

            const monthlyInvestment = runningSIP;
            yearlyInvestment += monthlyInvestment;

            const monthlyRate = expectedReturns / 1200;
            const valueBeforeGrowth = runningBalance + monthlyInvestment;
            const growth = valueBeforeGrowth * monthlyRate;
            const valueBeforeWithdrawal = valueBeforeGrowth + growth;

            runningBalance = valueBeforeWithdrawal - currentMonthWithdrawal;
            yearlyWithdrawal += currentMonthWithdrawal;
        }

        results.push({
            year: actualYear,
            monthlyInvestment: runningSIP,
            annualInvestment: yearlyInvestment,
            endValueBeforeWithdrawal: runningBalance + yearlyWithdrawal,
            withdrawal: yearlyWithdrawal,
            valueAfterWithdrawal: runningBalance
        });
    }
    return results;
};

const SIPCalculator = ({ calculatorKey = "sip" }) => {
    const { expenseCategories, assetCategories, familyMembers = [], investmentAllocations = [], goalMappings = {}, goals = [], calculatorInputs, setCalculatorInputs } = useFinancialPlan();
    const data = calculatorInputs[calculatorKey] || {};
    const setData = (newData) => setCalculatorInputs(prev => ({ ...prev, [calculatorKey]: typeof newData === 'function' ? newData(prev[calculatorKey] || {}) : newData }));
    const proposedSIPs = investmentAllocations.filter(a => a.type === 'SIP');
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const getYearsToRetire = () => {
        const self = familyMembers.find(m => m.relation?.toLowerCase() === 'self');
        if (!self || !self.dob) return 10;

        const birthDate = new Date(self.dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        const retirementAge = parseInt(self.retirementAge) || 60;
        const yearsRemaining = retirementAge - age;
        return yearsRemaining > 0 ? yearsRemaining : 0;
    };

    const defaultSIP = parseFloat(expenseCategories?.savings?.sip?.amount !== undefined ? expenseCategories.savings.sip.amount : expenseCategories?.savings?.sip) || 0;
    const defaultCorpus = parseFloat(assetCategories?.investments?.mutualFunds) || parseFloat(assetCategories?.equity?.mfEquity) || parseFloat(assetCategories?.equity?.stocks) || 0;
    const defaultTenure = getYearsToRetire() || 10;

    const monthlySIP = defaultSIP;
    const expectedReturns = data?.rate ?? 12;
    const tenureYears = data?.tenure ?? defaultTenure;
    const currentValue = defaultCorpus;

    useEffect(() => {
        let updated = false;
        let newData = { ...data };

        if ((!data?.amount) && defaultSIP > 0) {
            newData.amount = defaultSIP;
            updated = true;
        }

        if ((!data?.currentValue) && defaultCorpus > 0) {
            newData.currentValue = defaultCorpus;
            updated = true;
        }

        if (updated && setData) {
            setData(newData);
        }
    }, [defaultSIP, defaultCorpus]);

    const setExpectedReturns = (val) => setData({ ...data, rate: val });
    const setTenureYears = (val) => setData({ ...data, tenure: val });

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Baseline projection: modules + PYMTW only (ignore saved free-form increments)
    const calculationData = useMemo(() => {
        return computeSIPData(currentYear, monthlySIP, expectedReturns, tenureYears, currentValue, [], proposedSIPs, goalMappings, goals);
    }, [monthlySIP, expectedReturns, tenureYears, currentValue, currentYear, proposedSIPs, goalMappings, goals]);

    const runProjection = useCallback((events) => {
        return computeSIPData(currentYear, monthlySIP, expectedReturns, tenureYears, currentValue, events, proposedSIPs, goalMappings, goals);
    }, [currentYear, monthlySIP, expectedReturns, tenureYears, currentValue, proposedSIPs, goalMappings, goals]);

    const maxYear = currentYear + Math.max(tenureYears, 1) - 1;
    const hasLinkedItems = proposedSIPs.length > 0 || goals.some(g => {
        const mappedAmt = (goalMappings[g.id] || {})['sip'] || 0;
        const gYear = currentYear + Math.round(parseFloat(g.yearsToGoal) || 0);
        return mappedAmt > 0 && gYear >= currentYear && gYear <= maxYear;
    });

    return (
        <div className="fade-in" style={{ padding: '1rem' }}>
            <div className="card" style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                    <Calculator size={32} color="var(--primary)" />
                    <div>
                        <h1 style={{ margin: 0 }}>SIP Calculator</h1>
                        <p className="text-muted" style={{ margin: 0 }}>Plan your wealth creation until your retirement year ({currentYear + defaultTenure}).</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

                    {/* SECTION 1: PRIMARY INPUTS */}
                    <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>Primary Parameters</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label><Wallet size={16} /> Monthly Amount of SIP (₹)</label>
                                <input
                                    type="number"
                                    value={monthlySIP}
                                    readOnly
                                    className="form-input bg-muted"
                                    style={{ opacity: 0.7, cursor: 'not-allowed' }}
                                />
                            </div>

                            <div className="form-group">
                                <label><TrendingUp size={16} /> Expected Returns (%)</label>
                                <input
                                    type="number"
                                    value={expectedReturns}
                                    onChange={(e) => setExpectedReturns(parseFloat(e.target.value) || 0)}
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label><Clock size={16} /> Tenure in Years</label>
                                <input
                                    type="number"
                                    value={tenureYears}
                                    onChange={(e) => setTenureYears(parseInt(e.target.value) || 0)}
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label>Current Portfolio Value (₹)</label>
                                <input
                                    type="number"
                                    value={currentValue}
                                    readOnly
                                    className="form-input bg-muted"
                                    style={{ opacity: 0.7, cursor: 'not-allowed' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: LINKED PLAN ITEMS (read-only) */}
                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                        <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem' }}>Linked from your plan</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                            {proposedSIPs.map((s) => (
                                <div key={`proposed-${s.id}`} className="card" style={{ padding: '1rem', border: '1px solid var(--primary)', background: '#f0f9ff', position: 'relative' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                                        ALLOCATION MODULE: {s.type}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>Amount (₹)</label>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>₹{(parseFloat(s.amount) / 12).toLocaleString('en-IN')} / mo</div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>Starts</label>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{monthNames[s.startMonth - 1]} {s.startYear}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {goals.flatMap(g => {
                                const mappedAmt = (goalMappings[g.id] || {})['sip'] || 0;
                                const gYear = currentYear + Math.round(parseFloat(g.yearsToGoal) || 0);
                                if (mappedAmt > 0 && gYear >= currentYear && gYear <= maxYear) {
                                    return [(
                                        <div key={`roadmap-sip-${g.id}`} className="card" style={{ padding: '1rem', border: '1px solid #f59e0b', background: '#fffbeb', position: 'relative' }}>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#d97706', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calculator size={12} /> FULFILLMENT ROADMAP
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>Auto Withdrawal (₹)</label>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>₹{parseFloat(mappedAmt).toLocaleString('en-IN')}</div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>Goal Year</label>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{gYear} ({g.name || 'Goal'})</div>
                                                </div>
                                            </div>
                                        </div>
                                    )];
                                }
                                return [];
                            })}

                            {!hasLinkedItems && (
                                <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', width: '100%', border: '1px dashed var(--border)', padding: '1rem', borderRadius: '8px', margin: 0 }}>
                                    No allocation or roadmap items linked yet.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* SECTION 3: WHAT-IF EXPLORER */}
                    <WhatIfExplorer
                        mode="sip"
                        runProjection={runProjection}
                        minYear={currentYear}
                        maxYear={maxYear}
                        defaultMonth={currentMonth}
                        defaultYear={currentYear}
                    />

                    {/* SECTION 4: OUTPUT */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{
                            padding: '2rem',
                            background: 'linear-gradient(135deg, var(--primary) 0%, #1e40af 100%)',
                            borderRadius: '16px',
                            color: 'white',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                <div>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '1rem' }}>Total Invested Capital</p>
                                    <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800 }}>
                                        ₹{Math.round(calculationData.reduce((sum, r) => sum + r.annualInvestment, 0)).toLocaleString('en-IN')}
                                    </h2>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '1rem' }}>Final Corpus Value ({currentYear + tenureYears - 1})</p>
                                    <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800 }}>
                                        ₹{Math.round(calculationData[calculationData.length - 1]?.valueAfterWithdrawal || 0).toLocaleString('en-IN')}
                                    </h2>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            background: 'var(--bg-card)',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            overflow: 'hidden',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                        }}>
                            <div style={{ overflowX: 'auto', maxHeight: '700px', overflowY: 'auto' }}>
                                <table className="summary-table" style={{ width: '100%', fontSize: '0.95rem', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                        <tr>
                                            <th style={{ padding: '1.25rem', textAlign: 'left', fontWeight: 700 }}>Year</th>
                                            <th style={{ padding: '1.25rem', textAlign: 'right', fontWeight: 700 }}>Monthly SIP (Final)</th>
                                            <th style={{ padding: '1.25rem', textAlign: 'right', fontWeight: 700 }}>Annual Investment</th>
                                            <th style={{ padding: '1.25rem', textAlign: 'right', fontWeight: 700 }}>Val. Pre-Withdrawal</th>
                                            <th style={{ padding: '1.25rem', textAlign: 'right', fontWeight: 700 }}>Withdrawal</th>
                                            <th style={{ padding: '1.25rem', textAlign: 'right', fontWeight: 700 }}>Closing Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {calculationData.map((row, idx) => (
                                            <tr key={row.year} style={{
                                                borderBottom: '1px solid var(--border)',
                                                background: idx % 2 === 0 ? 'transparent' : '#fcfcfc'
                                            }}>
                                                <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>{row.year}</td>
                                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>₹{row.monthlyInvestment.toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>₹{row.annualInvestment.toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontWeight: 600 }}>₹{Math.round(row.endValueBeforeWithdrawal).toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', color: '#e11d48', fontWeight: 500 }}>
                                                    {row.withdrawal > 0 ? `₹${row.withdrawal.toLocaleString('en-IN')}` : '-'}
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right', color: '#059669', fontWeight: 800, fontSize: '1.05rem' }}>
                                                    ₹{Math.round(row.valueAfterWithdrawal).toLocaleString('en-IN')}
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

export default SIPCalculator;
