import React, { useMemo } from 'react';
import { Calculator, TrendingUp, Wallet, ArrowRight, ShieldCheck } from 'lucide-react';
import CurrencyInput from '../common/CurrencyInput';
import PercentageInput from '../common/PercentageInput';

export const computeFDData = (proposedFDs, expectedReturns, frequency, rawBaselineFDs = []) => {
    let freqMonths = 3;
    if (frequency === 'Monthly') freqMonths = 1;
    if (frequency === 'Half-Yearly') freqMonths = 6;
    if (frequency === 'Annually') freqMonths = 12;

    const today = new Date();
    let baseStartYear = today.getFullYear();
    let baseStartMonth = today.getMonth() + 1;
    
    let startAbsolute = baseStartYear * 12 + baseStartMonth;
    let latestEndAbsolute = startAbsolute + 12; // default 1 year projection if no active proposal

    const baselineFDs = Array.isArray(rawBaselineFDs) ? rawBaselineFDs : (rawBaselineFDs ? [rawBaselineFDs] : []);
    
    baselineFDs.forEach(fd => {
        const p = parseFloat(fd?.amount !== undefined ? fd.amount : fd) || 0;
        if (p > 0) {
            baseStartYear = Math.min(baseStartYear, parseInt(fd?.startYear) || baseStartYear);
            baseStartMonth = Math.min(baseStartMonth, parseInt(fd?.startMonth) || baseStartMonth);
            startAbsolute = baseStartYear * 12 + baseStartMonth;
            const endAbsolute = startAbsolute + (parseInt(fd?.duration || 10) * 12) - 1;
            if (endAbsolute > latestEndAbsolute) latestEndAbsolute = endAbsolute;
        }
    });

    if (proposedFDs.length > 0) {
        let earliestProposedYear = Math.min(...proposedFDs.map(p => p.startYear));
        if (earliestProposedYear <= baseStartYear) {
            baseStartYear = earliestProposedYear;
            let earliestFDs = proposedFDs.filter(p => p.startYear === baseStartYear);
            baseStartMonth = Math.min(baseStartMonth, ...earliestFDs.map(p => p.startMonth));
            startAbsolute = baseStartYear * 12 + baseStartMonth;
        }
        const proposedMaxMap = Math.max(...proposedFDs.map(p => (p.startYear * 12 + p.startMonth) + (parseInt(p.duration) * 12) - 1));
        if (proposedMaxMap > latestEndAbsolute) latestEndAbsolute = proposedMaxMap;
    }

    let fds = proposedFDs.map(p => ({
        id: p.id,
        startAbsolute: p.startYear * 12 + p.startMonth,
        endAbsolute: (p.startYear * 12 + p.startMonth) + (parseInt(p.duration) * 12) - 1,
        principal: parseFloat(p.amount) || 0,
        compoundingBase: parseFloat(p.amount) || 0,
        uncompoundedInterest: 0,
        totalInterest: 0,
        active: false,
        matured: false
    }));

    baselineFDs.forEach((fd, idx) => {
        const p = parseFloat(fd?.amount !== undefined ? fd.amount : fd) || 0;
        if (p > 0) {
            const blStart = (parseInt(fd?.startYear || baseStartYear) * 12) + parseInt(fd?.startMonth || baseStartMonth);
            fds.push({
                id: `baseline-fd-${idx}`,
                startAbsolute: blStart,
                endAbsolute: blStart + (parseInt(fd?.duration || 1) * 12) - 1, // Fix: default FD duration is generally 1 year
                principal: p,
                compoundingBase: p,
                uncompoundedInterest: 0,
                totalInterest: 0,
                active: false,
                matured: false
            });
        }
    });

    const periodicRate = ((parseFloat(expectedReturns) || 0) / 100) / 12;

    let schedule = [];
    let currentAbsolute = startAbsolute;
    let currentYearVal = baseStartYear;
    let currentMonthVal = baseStartMonth;

    let yearlyDeposit = 0;
    let yearlyInterest = 0;
    let yearlyMaturity = 0;

    let globalInterest = 0;
    let globalDeposit = 0;

    // Calculate initial opening sum for the very first year
    let yearlyOpening = fds.filter(f => f.startAbsolute === currentAbsolute).reduce((sum, f) => sum + f.principal, 0);

    while (currentAbsolute <= latestEndAbsolute) {
        let monthInterest = 0;
        
        fds.forEach(fd => {
            if (currentAbsolute === fd.startAbsolute) {
                fd.active = true;
                // Dont add to yearlyOpening here except if we re-evaluate opening strictly at Jan 1st.
                // We handle deposits explicitly.
                if (currentAbsolute !== startAbsolute) {
                    yearlyDeposit += fd.principal;
                }
                globalDeposit += fd.principal;
            }

            if (fd.active && !fd.matured) {
                // Earn interest on the compounded base
                const interest = fd.compoundingBase * periodicRate;
                fd.uncompoundedInterest += interest;
                fd.totalInterest += interest;
                monthInterest += interest;
                globalInterest += interest;

                // Compounding event
                const monthsActive = currentAbsolute - fd.startAbsolute + 1;
                if (monthsActive % freqMonths === 0) {
                    fd.compoundingBase += fd.uncompoundedInterest;
                    fd.uncompoundedInterest = 0;
                }
            }

            if (currentAbsolute === fd.endAbsolute && fd.active) {
                fd.active = false;
                fd.matured = true;
                // Final compound push
                fd.compoundingBase += fd.uncompoundedInterest;
                fd.uncompoundedInterest = 0;
                yearlyMaturity += fd.compoundingBase;
            }
        });
        
        yearlyInterest += monthInterest;

        if (currentMonthVal === 12 || currentAbsolute === latestEndAbsolute) {
            // Calculate closing balance as sum of all active FDs (compoundingBase + uncompounded)
            let closingBalance = fds.filter(f => f.active && !f.matured)
                                    .reduce((sum, f) => sum + f.compoundingBase + f.uncompoundedInterest, 0);

            schedule.push({
                year: currentYearVal,
                openingValue: yearlyOpening,
                deposit: yearlyDeposit,
                interest: yearlyInterest,
                maturityValue: yearlyMaturity,
                endValue: closingBalance
            });

            yearlyOpening = closingBalance;
            yearlyDeposit = 0;
            yearlyInterest = 0;
            yearlyMaturity = 0;

            if (currentAbsolute < latestEndAbsolute) {
                currentYearVal++;
            }
        }

        currentAbsolute++;
        currentMonthVal = (currentMonthVal % 12) + 1;
    }

    const totals = {
        globalDeposit,
        globalInterest,
        finalMaturity: fds.filter(f => f.matured).reduce((sum, f) => sum + f.compoundingBase, 0) || fds.reduce((sum, f) => sum + f.compoundingBase + f.uncompoundedInterest, 0)
    };

    return { schedule, totals };
};

const FDEngine = ({
    fdKey,
    title,
    isReadOnly,
    amount,
    rate,
    frequency,
    duration,
    startMonth,
    startYear,
    setRate,
    setFrequency,
    noActiveMessage
}) => {
    const [localAmount, setLocalAmount] = React.useState(amount);
    React.useEffect(() => { setLocalAmount(amount); }, [amount]);

    const activeFDObj = useMemo(() => {
        return { amount: localAmount, startMonth, startYear, duration };
    }, [localAmount, startMonth, startYear, duration]);

    const rateNum = Number(rate ?? 0);
    const amountSafe = Number(localAmount ?? 0);

    const calculationData = useMemo(() => {
        return computeFDData([], rateNum, frequency, { ...activeFDObj, amount: amountSafe });
    }, [rateNum, frequency, activeFDObj, amountSafe]);

    const { schedule, totals } = calculationData;

    return (
        <div className="fade-in" style={{ padding: '1rem', marginBottom: '3rem' }}>
            <div className="card" style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                    <ShieldCheck size={32} color={isReadOnly ? "var(--success)" : "var(--primary)"} />
                    <div>
                        <h1 style={{ margin: 0 }}>{title}</h1>
                        <p className="text-muted" style={{ margin: 0 }}>
                            {isReadOnly ? "Timeline mapping for your proposed or synchronized Asset FD." : "Project guaranteed returns with adjustable compounding frequencies."}
                        </p>
                    </div>
                </div>

                {((localAmount ?? 0) === 0 && !isReadOnly) ? (
                    <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                        <p>{noActiveMessage || "No active FD mapped."}</p>
                        <p style={{ fontSize: '0.9rem' }}>Go back to Step 8 or Step 9 to inject your baseline or allocate future installments.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                        {/* SECTION 1: PRIMARY INPUTS */}
                        <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>Fixed Deposit Parameters</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label><TrendingUp size={16} /> Expected Interest Rate (% p.a)</label>
                                    <PercentageInput
                                        value={rate}
                                        min={5}
                                        max={9}
                                        onValueChange={(v) => setRate && setRate(v)}
                                        className="form-input"
                                    />
                                    <small className="text-muted">Prevailing FD rates range from 5% to 9%.</small>
                                </div>

                                <div className="form-group">
                                    <label><ShieldCheck size={16} /> Deposit Amount (₹)</label>
                                    <CurrencyInput
                                        value={localAmount}
                                        readOnly={isReadOnly}
                                        onValueChange={(v) => !isReadOnly && setLocalAmount(v)}
                                        className="form-input"
                                        style={isReadOnly ? { background: 'var(--bg-main)', cursor: 'not-allowed' } : undefined}
                                    />
                                    <small className="text-muted">{isReadOnly ? "Locked to your synchronized configuration." : "Manual Standalone Testing Mode."}</small>
                                </div>

                                <div className="form-group">
                                    <label><Calculator size={16} /> Compounding Frequency</label>
                                    <select 
                                        value={frequency} 
                                        onChange={(e) => setFrequency && setFrequency(e.target.value)}
                                        className="form-input"
                                    >
                                        <option value="Monthly">Monthly</option>
                                        <option value="Quarterly">Quarterly</option>
                                        <option value="Half-Yearly">Half-Yearly</option>
                                        <option value="Annually">Annually</option>
                                    </select>
                                    <small className="text-muted">Indian banks strictly default to Quarterly compounding.</small>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: VISUALIZATION */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {/* Summary Ribbon */}
                            <div style={{ 
                                padding: '2rem', 
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                                borderRadius: '16px', 
                                color: 'white',
                                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                            }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                    <div>
                                        <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.9rem' }}>Total Principal Invested</p>
                                        <h3 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>₹{Math.round(totals.globalDeposit).toLocaleString('en-IN')}</h3>
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.9rem' }}>Total Interest Earned</p>
                                        <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#a7f3d0' }}>+ ₹{Math.round(totals.globalInterest).toLocaleString('en-IN')}</h3>
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.9rem' }}>Total Matured Value</p>
                                        <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>₹{Math.round(totals.finalMaturity).toLocaleString('en-IN')}</h3>
                                    </div>
                                </div>
                            </div>

                            {/* Amortization Table */}
                            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                                    <table className="summary-table" style={{ width: '100%', fontSize: '0.95rem', borderCollapse: 'collapse' }}>
                                        <thead style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                            <tr>
                                                <th style={{ padding: '1.25rem', textAlign: 'left' }}>Year</th>
                                                <th style={{ padding: '1.25rem', textAlign: 'right' }}>Opening Balance</th>
                                                <th style={{ padding: '1.25rem', textAlign: 'right' }}>New Deposits</th>
                                                <th style={{ padding: '1.25rem', textAlign: 'right' }}>Interest Earned</th>
                                                <th style={{ padding: '1.25rem', textAlign: 'right', color: '#ef4444' }}>Maturity Payouts</th>
                                                <th style={{ padding: '1.25rem', textAlign: 'right' }}>Closing Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {schedule.map((row, idx) => (
                                                <tr key={row.year} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : '#f8fafc' }}>
                                                    <td style={{ padding: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{row.year}</td>
                                                    <td style={{ padding: '1rem', textAlign: 'right' }}>₹{Math.round(row.openingValue).toLocaleString('en-IN')}</td>
                                                    <td style={{ padding: '1rem', textAlign: 'right', opacity: row.deposit > 0 ? 1 : 0.3 }}>₹{Math.round(row.deposit).toLocaleString('en-IN')}</td>
                                                    <td style={{ padding: '1rem', textAlign: 'right', color: '#059669' }}>+ ₹{Math.round(row.interest).toLocaleString('en-IN')}</td>
                                                    <td style={{ padding: '1rem', textAlign: 'right', color: row.maturityValue > 0 ? '#ef4444' : 'inherit', opacity: row.maturityValue > 0 ? 1 : 0.3 }}>
                                                        {row.maturityValue > 0 ? `- ₹${Math.round(row.maturityValue).toLocaleString('en-IN')}` : '₹0'}
                                                    </td>
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

import { useFinancialPlan } from '../../contexts/FinancialPlanContext';

const FDCalculator = ({ calculatorKey = "fd" }) => {
    const { investmentAllocations: allocations = [], assetCategories = {}, calculatorInputs, setCalculatorInputs } = useFinancialPlan();
    const data = calculatorInputs[calculatorKey] || {};
    const setData = (newData) => setCalculatorInputs(prev => ({ ...prev, [calculatorKey]: typeof newData === 'function' ? newData(prev[calculatorKey] || {}) : newData }));
    const fdsToRender = [];

    // 1. Check for Active Baseline FD
    const rawFD = assetCategories?.investments?.fixedDeposit;
    const fdArray = Array.isArray(rawFD) ? rawFD : (rawFD ? [rawFD] : []);

    fdArray.forEach((fdObj, index) => {
        const defaultCorpusValue = parseFloat(fdObj?.amount !== undefined ? fdObj.amount : fdObj) || 0;
        if (defaultCorpusValue > 0) {
            fdsToRender.push({
                fdKey: `active_${index}`,
                title: fdArray.length > 1 ? `Active Fixed Deposit #${index + 1} (Asset Synchronized)` : 'Active Fixed Deposit (Asset Synchronized)',
                amount: defaultCorpusValue,
                rate: data?.rate ?? 7.00,
                frequency: data?.frequency ?? 'Quarterly',
                duration: parseInt(fdObj?.duration) || 1, // fallback to 1 year
                startMonth: parseInt(fdObj?.startMonth) || new Date().getMonth() + 1,
                startYear: parseInt(fdObj?.startYear) || new Date().getFullYear(),
                isReadOnly: true,
                setRate: (val) => setData({ ...data, rate: val }),
                setFrequency: (val) => setData({ ...data, frequency: val })
            });
        }
    });

    // 2. Check for Future Proposed FDs
    const proposedFDs = useMemo(() => allocations.filter(a => a.type === 'Fixed Deposit'), [allocations]);
    proposedFDs.forEach((fd) => {
        fdsToRender.push({
            fdKey: `future_${fd.id}`,
            title: `Future Adjustment FD: ${fd.name || 'Allocation'}`,
            amount: parseFloat(fd.amount) || 0,
            rate: data?.rate ?? 7.00,
            frequency: data?.frequency ?? 'Quarterly',
            duration: parseInt(fd.duration) || 1,
            startMonth: parseInt(fd.startMonth) || 1,
            startYear: parseInt(fd.startYear) || new Date().getFullYear(),
            isReadOnly: true,
            setRate: (val) => setData({ ...data, rate: val }),
            setFrequency: (val) => setData({ ...data, frequency: val })
        });
    });

    // 3. Standalone Manual Calculator if empty
    if (fdsToRender.length === 0) {
        fdsToRender.push({
            fdKey: 'manual',
            title: 'Standalone Fixed Deposit Calculator',
            amount: 0,
            rate: data?.rate ?? 7.00,
            frequency: data?.frequency ?? 'Quarterly',
            duration: 1,
            startMonth: new Date().getMonth() + 1,
            startYear: new Date().getFullYear(),
            setRate: (val) => setData({ ...data, rate: val }),
            setFrequency: (val) => setData({ ...data, frequency: val }),
            isReadOnly: false,
            noActiveMessage: "No active FD found in the global Asset Baseline nor proposed natively."
        });
    }

    return (
        <div>
            {fdsToRender.map(fdConfig => (
                <FDEngine key={fdConfig.fdKey} {...fdConfig} />
            ))}
        </div>
    );
};

export default FDCalculator;
