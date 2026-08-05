import React, { useMemo } from 'react';
import { Calculator, TrendingUp } from 'lucide-react';
import PercentageInput from '../common/PercentageInput';

export const computePPFData = (proposedPPFs, expectedReturns, defaultPPFObj = {}) => {
    let results = [];
    
    const today = new Date();
    let baseStartYear = today.getFullYear();
    let baseStartMonth = today.getMonth() + 1;

    const monthlyBaselineP = parseFloat(defaultPPFObj?.amount !== undefined ? defaultPPFObj.amount : defaultPPFObj) || 0;
    
    // Core PPF Logic: 15 years fixed tenure starting from either Cash flow OR earliest Allocation.
    if (monthlyBaselineP > 0) {
        baseStartYear = parseInt(defaultPPFObj?.startYear) || baseStartYear;
        baseStartMonth = parseInt(defaultPPFObj?.startMonth) || baseStartMonth;
    } else if (proposedPPFs.length > 0) {
        const earliest = proposedPPFs.reduce((min, p) => 
            (p.startYear < min.startYear || (p.startYear === min.startYear && p.startMonth < min.startMonth)) ? p : min
        , proposedPPFs[0]);
        baseStartYear = earliest.startYear;
        baseStartMonth = earliest.startMonth;
    }
    
    const startAbsolute = baseStartYear * 12 + baseStartMonth;
    const maturityAbsolute = startAbsolute + 180 - 1; // PPF duration is strictly 15 years (180 months)
    
    const startString = `${new Date(baseStartYear, baseStartMonth - 1).toLocaleString('default', { month: 'short' })} ${baseStartYear}`;
    const maturityYear = Math.floor((maturityAbsolute - 1) / 12);
    const maturityMonth = (maturityAbsolute - 1) % 12;
    const endString = `${new Date(maturityYear, maturityMonth).toLocaleString('default', { month: 'short' })} ${maturityYear}`;
    
    let currentYearVal = baseStartYear;
    let currentMonthVal = baseStartMonth;
    let currentAbsolute = startAbsolute;
    
    let openingBalance = 0;
    let yearlyInvestment = 0;

    while (currentAbsolute <= maturityAbsolute) {
        let currentMonthInvestment = 0;
        
        // Add Cash Flow Baseline mapping naturally since the loop is clamped
        if (monthlyBaselineP > 0) {
            currentMonthInvestment += monthlyBaselineP;
        }
        
        proposedPPFs.forEach(p => {
            const pStartAbsolute = p.startYear * 12 + p.startMonth;
            const pEndAbsolute = pStartAbsolute + (parseInt(p.duration) * 12) - 1;
            if (currentAbsolute >= pStartAbsolute && currentAbsolute <= pEndAbsolute) {
                currentMonthInvestment += (parseFloat(p.amount) / 12) || 0;
            }
        });
        
        if (yearlyInvestment + currentMonthInvestment > 150000) {
            currentMonthInvestment = 150000 - yearlyInvestment;
        }
        if (currentMonthInvestment < 0) currentMonthInvestment = 0;

        yearlyInvestment += currentMonthInvestment;

        // Rollover logic at the end of the calendar year or absolute end of tenure
        if (currentMonthVal === 12 || currentAbsolute === maturityAbsolute) {
            // Annual compounding: Interest based on Opening Balance + any investments made during the year
            const interest = (openingBalance + yearlyInvestment) * ((parseFloat(expectedReturns) || 0) / 100);
            const endValue = openingBalance + yearlyInvestment + interest;

            results.push({
                year: currentYearVal,
                investment: yearlyInvestment,
                interest: interest,
                endValue: endValue
            });

            // Prep next year
            openingBalance = endValue;
            yearlyInvestment = 0;
            if (currentAbsolute < maturityAbsolute) {
                currentYearVal++;
            }
        }

        // Increment month
        currentAbsolute++;
        currentMonthVal = (currentMonthVal % 12) + 1;
    }

    return { results, startString, endString };
};

import { useFinancialPlan } from '../../contexts/FinancialPlanContext';

const PPFCalculator = ({ calculatorKey = "ppf" }) => {
    const { investmentAllocations: allocations = [], expenseCategories = {}, calculatorInputs, setCalculatorInputs } = useFinancialPlan();
    const data = calculatorInputs[calculatorKey] || {};
    const setData = (newData) => setCalculatorInputs(prev => ({ ...prev, [calculatorKey]: typeof newData === 'function' ? newData(prev[calculatorKey] || {}) : newData }));
    const expectedReturns = data?.rate ?? 7.10;
    const setExpectedReturns = (val) => setData({ ...data, rate: val });

    const defaultPPFObj = expenseCategories?.savings?.ppf || {};

    const proposedPPFs = useMemo(() => {
        return allocations.filter(a => a.type === 'PPF');
    }, [allocations]);

    const rateNum = Number(expectedReturns ?? 0);

    const { results: calculationData, startString, endString } = useMemo(() => {
        return computePPFData(proposedPPFs, rateNum, defaultPPFObj);
    }, [proposedPPFs, rateNum, defaultPPFObj]);

    const finalValue = calculationData.length > 0 ? calculationData[calculationData.length - 1].endValue : 0;
    const totalInvested = calculationData.reduce((sum, row) => sum + row.investment, 0);

    return (
        <div className="fade-in" style={{ padding: '1rem' }}>
            <div className="card" style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                    <Calculator size={32} color="var(--primary)" />
                    <div>
                        <h1 style={{ margin: 0 }}>PPF Calculator</h1>
                        <p className="text-muted" style={{ margin: 0 }}>Public Provident Fund projections based on your proposed allocations.</p>
                    </div>
                </div>

                {proposedPPFs.length === 0 && (parseFloat(defaultPPFObj?.amount !== undefined ? defaultPPFObj.amount : defaultPPFObj) || 0) === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                        <p>No active PPF found in the local Cash Flow Baseline nor proposed in the Allocation Module.</p>
                        <p style={{ fontSize: '0.9rem' }}>Go back to Step 4 or Step 9 to map your baseline or to add a future PPF allocation.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                        {/* SECTION 1: PRIMARY INPUTS */}
                        <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>Primary Parameters</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label><TrendingUp size={16} /> Expected Returns (CAGR %)</label>
                                    <PercentageInput
                                        value={expectedReturns}
                                        min={5}
                                        max={9}
                                        onValueChange={setExpectedReturns}
                                        className="form-input"
                                    />
                                    <small className="text-muted">Range: 5.00% to 9.00%. Default: 7.10%.</small>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: INCREMENTAL ADJUSTMENTS */}
                        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>Fetched PPF Allocations</h3>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                {proposedPPFs.map((p) => (
                                    <div key={p.id} className="card" style={{ padding: '1rem', border: '1px solid #6366f1', background: '#f5f3ff', flex: '1 1 auto', minWidth: '280px', maxWidth: '350px' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#6366f1', marginBottom: '0.75rem' }}>
                                            {p.name || 'PPF Allocation'}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Yearly Amount</span>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>₹{Math.round(p.amount).toLocaleString('en-IN')}</div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Start Date</span>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                                {new Date(0, p.startMonth - 1).toLocaleString('default', { month: 'short' })} {p.startYear}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* SECTION 3: VISUALIZATION (Wide) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {/* Summary Header */}
                            <div style={{ 
                                padding: '2rem', 
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
                                borderRadius: '16px', 
                                color: 'white',
                                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                            }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                    <div>
                                        <p style={{ margin: '0 0 0.5rem 0', opacity: 0.8, fontSize: '0.9rem' }}>Projected Value</p>
                                        <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800 }}>₹{Math.round(finalValue).toLocaleString('en-IN')}</h2>
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 0.5rem 0', opacity: 0.8, fontSize: '0.9rem' }}>Total Invested</p>
                                        <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>₹{Math.round(totalInvested).toLocaleString('en-IN')}</h3>
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 0.5rem 0', opacity: 0.8, fontSize: '0.9rem' }}>Wealth Created</p>
                                        <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>₹{Math.round(finalValue - totalInvested).toLocaleString('en-IN')}</h3>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '1rem' }}>
                                    <div>
                                        <p style={{ margin: '0 0 0.25rem 0', opacity: 0.8, fontSize: '0.8rem', textTransform: 'uppercase' }}>Start Date</p>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{startString}</div>
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 0.25rem 0', opacity: 0.8, fontSize: '0.8rem', textTransform: 'uppercase' }}>Maturity Date</p>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{endString}</div>
                                    </div>
                                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                                        <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Fixed 15 Year Tenure</span>
                                    </div>
                                </div>
                            </div>

                            {/* Amortization Table */}
                            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
                                    <table className="summary-table" style={{ width: '100%', fontSize: '0.95rem', borderCollapse: 'collapse' }}>
                                        <thead style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                            <tr>
                                                <th style={{ padding: '1.25rem', textAlign: 'left' }}>Year</th>
                                                <th style={{ padding: '1.25rem', textAlign: 'right' }}>Investment Amount</th>
                                                <th style={{ padding: '1.25rem', textAlign: 'right' }}>Interest</th>
                                                <th style={{ padding: '1.25rem', textAlign: 'right' }}>End Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {calculationData.map((row, idx) => (
                                                <tr key={row.year} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : '#f8fafc' }}>
                                                    <td style={{ padding: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{row.year}</td>
                                                    <td style={{ padding: '1rem', textAlign: 'right' }}>₹{Math.round(row.investment).toLocaleString('en-IN')}</td>
                                                    <td style={{ padding: '1rem', textAlign: 'right', color: '#059669' }}>₹{Math.round(row.interest).toLocaleString('en-IN')}</td>
                                                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 800, color: 'var(--text-main)' }}>₹{Math.round(row.endValue).toLocaleString('en-IN')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default PPFCalculator;
