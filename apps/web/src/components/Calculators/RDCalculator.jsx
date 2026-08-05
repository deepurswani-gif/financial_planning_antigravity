import React, { useMemo } from 'react';
import { Calculator, TrendingUp, RefreshCcw, ShieldCheck } from 'lucide-react';
import CurrencyInput from '../common/CurrencyInput';
import PercentageInput from '../common/PercentageInput';

export const computeRDData = (allRDStreams = [], expectedReturns = 7.00) => {
    // Standard Indian RDs compound quarterly mathematically
    const freqMonths = 3;

    if (!allRDStreams || allRDStreams.length === 0) {
        return { schedule: [], totals: { globalDeposit: 0, globalInterest: 0, finalMaturity: 0 } };
    }

    let startAbsolute = Math.min(...allRDStreams.map(s => s.startYear * 12 + s.startMonth));
    let latestEndAbsolute = Math.max(...allRDStreams.map(s => (s.startYear * 12 + s.startMonth) + (parseInt(s.duration) * 12) - 1));

    let baseStartYear = Math.floor((startAbsolute - 1) / 12);
    let baseStartMonth = ((startAbsolute - 1) % 12) + 1;

    let rds = allRDStreams.map(p => ({
        id: p.id,
        name: p.name,
        startAbsolute: p.startYear * 12 + p.startMonth,
        endAbsolute: (p.startYear * 12 + p.startMonth) + (parseInt(p.duration) * 12) - 1,
        monthlyAmount: p.isBaseline ? (parseFloat(p.amount) || 0) : (parseFloat(p.amount) || 0) / 12, // Baseline amount is monthly, Allocation amount is annual
        compoundingBase: 0,
        uncompoundedInterest: 0,
        active: false,
        matured: false
    }));

    const periodicRate = ((parseFloat(expectedReturns) || 0) / 100) / 12;

    let schedule = [];
    let currentAbsolute = startAbsolute;
    let currentYearVal = baseStartYear;
    let currentMonthVal = baseStartMonth;

    let yearlyOpening = 0;
    
    let yearlyDeposit = 0;
    let yearlyInterest = 0;
    let yearlyMaturity = 0;

    let globalInterest = 0;
    let globalDeposit = 0;

    while (currentAbsolute <= latestEndAbsolute) {
        let monthInterest = 0;
        
        rds.forEach(rd => {
            if (currentAbsolute === rd.startAbsolute) {
                rd.active = true;
            }

            if (rd.active && !rd.matured) {
                // Start of month: Add monthly P if still within paying duration
                let monthlyP = 0;
                if (currentAbsolute <= rd.endAbsolute) {
                    monthlyP = rd.monthlyAmount;
                    rd.compoundingBase += monthlyP;
                    yearlyDeposit += monthlyP;
                    globalDeposit += monthlyP;
                }

                // Earn interest on the entire compounded base for this single month
                const interest = rd.compoundingBase * periodicRate;
                rd.uncompoundedInterest += interest;
                monthInterest += interest;
                globalInterest += interest;

                // End of compounding cycle (Quarterly): flush uncompounded interest into the main base
                const monthsActive = currentAbsolute - rd.startAbsolute + 1;
                if (monthsActive > 0 && monthsActive % freqMonths === 0) {
                    rd.compoundingBase += rd.uncompoundedInterest;
                    rd.uncompoundedInterest = 0;
                }
            }

            if (currentAbsolute === rd.endAbsolute && rd.active) {
                rd.active = false;
                rd.matured = true;
                // Final compound push on maturity date regardless of quarter alignments
                rd.compoundingBase += rd.uncompoundedInterest;
                rd.uncompoundedInterest = 0;
                yearlyMaturity += rd.compoundingBase;
            }
        });

        yearlyInterest += monthInterest;

        if (currentMonthVal === 12 || currentAbsolute === latestEndAbsolute) {
            // Calculate closing balance as sum of all active RDs
            let closingBalance = rds.filter(rd => rd.active && !rd.matured)
                                    .reduce((sum, rd) => sum + rd.compoundingBase + rd.uncompoundedInterest, 0);

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
        finalMaturity: rds.filter(rd => rd.matured).reduce((sum, rd) => sum + rd.compoundingBase, 0)
    };

    return { schedule, totals };
};

const RDEngine = ({
    rdKey,
    title,
    isReadOnly,
    amount,
    isMonthlyAmount,
    duration,
    startMonth,
    startYear,
    rate,
    setRate,
    noActiveMessage
}) => {
    const [localAmount, setLocalAmount] = React.useState(amount);
    React.useEffect(() => { setLocalAmount(amount); }, [amount]);

    const activeRDObj = useMemo(() => {
        return [{
            id: rdKey,
            name: title,
            startYear,
            startMonth,
            duration,
            amount: Number(localAmount ?? 0), 
            isBaseline: isMonthlyAmount 
        }];
    }, [rdKey, title, startYear, startMonth, duration, localAmount, isMonthlyAmount]);

    const rateNum = Number(rate ?? 0);

    const calculationData = useMemo(() => {
        return computeRDData(activeRDObj, rateNum);
    }, [activeRDObj, rateNum]);

    const { schedule, totals } = calculationData;

    return (
        <div className="fade-in" style={{ padding: '1rem', marginBottom: '3rem' }}>
            <div className="card" style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                    <RefreshCcw size={32} color={isReadOnly ? "var(--success)" : "var(--primary)"} />
                    <div>
                        <h1 style={{ margin: 0 }}>{title}</h1>
                        <p className="text-muted" style={{ margin: 0 }}>
                            {isReadOnly ? "Timeline mapping for your proposed or synchronized Cash Flow RD." : "Project guaranteed returns with strict Indian Quarterly Compounding rules."}
                        </p>
                    </div>
                </div>

                {((localAmount ?? 0) === 0 && !isReadOnly) ? (
                    <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                        <p>{noActiveMessage || "No active RD mapped."}</p>
                        <p style={{ fontSize: '0.9rem' }}>Go back to Step 4 or Step 9 to inject your baseline or allocate future installments.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                        {/* SECTION 1: PRIMARY INPUTS */}
                        <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>Recurring Deposit Parameters</h3>
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
                                    <small className="text-muted">Prevailing RD rates range from 5% to 9%.</small>
                                </div>

                                <div className="form-group">
                                    <label><ShieldCheck size={16} /> {isMonthlyAmount ? 'Monthly Deposit (₹)' : 'Yearly Deposit (₹)'}</label>
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
                                    <div style={{ 
                                        padding: '0.75rem', 
                                        background: 'var(--bg-main)', 
                                        border: '1px solid var(--border)', 
                                        borderRadius: '8px',
                                        color: 'var(--text-muted)'
                                    }}>
                                        Quarterly (Fixed)
                                    </div>
                                    <small className="text-muted">Indian RD banking regulations strictly default to quarterly interest accrual.</small>
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
                                                <th style={{ padding: '1.25rem', textAlign: 'right' }}>Annual Deposits</th>
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
                                                    <td style={{ padding: '1rem', textAlign: 'right', opacity: row.deposit > 0 ? 1 : 0.3 }}>+ ₹{Math.round(row.deposit).toLocaleString('en-IN')}</td>
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

const RDCalculator = ({ calculatorKey = "rd" }) => {
    const { investmentAllocations: allocations = [], expenseCategories = {}, calculatorInputs, setCalculatorInputs } = useFinancialPlan();
    const data = calculatorInputs[calculatorKey] || {};
    const setData = (newData) => setCalculatorInputs(prev => ({ ...prev, [calculatorKey]: typeof newData === 'function' ? newData(prev[calculatorKey] || {}) : newData }));
    const rdsToRender = [];

    // 1. Check for Active Baseline RD
    const rawRD = expenseCategories?.savings?.rd;
    const rdArray = Array.isArray(rawRD) ? rawRD : (rawRD ? [rawRD] : []);

    rdArray.forEach((rdObj, index) => {
        const monthlyBaselineP = parseFloat(rdObj?.amount !== undefined ? rdObj.amount : rdObj) || 0;
        if (monthlyBaselineP > 0) {
            rdsToRender.push({
                rdKey: `active_${index}`,
                title: rdArray.length > 1 ? `Active Recurring Deposit #${index + 1} (Cash Flow Synchronized)` : 'Active Recurring Deposit (Cash Flow Synchronized)',
                amount: monthlyBaselineP,
                isMonthlyAmount: true,
                rate: data?.rate ?? 7.00,
                duration: parseInt(rdObj?.duration) || 10,
                startMonth: parseInt(rdObj?.startMonth) || new Date().getMonth() + 1,
                startYear: parseInt(rdObj?.startYear) || new Date().getFullYear(),
                isReadOnly: true,
                setRate: (val) => setData({ ...data, rate: val })
            });
        }
    });

    // 2. Check for Future Proposed RDs
    const proposedRDs = useMemo(() => allocations.filter(a => a.type === 'Recurring Deposit'), [allocations]);
    proposedRDs.forEach((rd) => {
        rdsToRender.push({
            rdKey: `future_${rd.id}`,
            title: `Future Adjustment RD: ${rd.name || 'Allocation'}`,
            amount: parseFloat(rd.amount) || 0,
            isMonthlyAmount: false,
            rate: data?.rate ?? 7.00,
            duration: parseInt(rd.duration) || 10,
            startMonth: parseInt(rd.startMonth) || 1,
            startYear: parseInt(rd.startYear) || new Date().getFullYear(),
            isReadOnly: true,
            setRate: (val) => setData({ ...data, rate: val })
        });
    });

    // 3. Standalone Manual Calculator if empty
    if (rdsToRender.length === 0) {
        rdsToRender.push({
            rdKey: 'manual',
            title: 'Standalone Recurring Deposit Calculator',
            amount: 0,
            isMonthlyAmount: true,
            rate: data?.rate ?? 7.00,
            duration: 10,
            startMonth: new Date().getMonth() + 1,
            startYear: new Date().getFullYear(),
            setRate: (val) => setData({ ...data, rate: val }),
            isReadOnly: false,
            noActiveMessage: "No active RD found in the global Cash Flow Baseline nor proposed natively."
        });
    }

    return (
        <div>
            {rdsToRender.map(rdConfig => (
                <RDEngine key={rdConfig.rdKey} {...rdConfig} />
            ))}
        </div>
    );
};
export default RDCalculator;
