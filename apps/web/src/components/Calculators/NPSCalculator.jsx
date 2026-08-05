import React, { useMemo } from 'react';
import { Calculator, TrendingUp, HeartHandshake, Briefcase } from 'lucide-react';
import CurrencyInput from '../common/CurrencyInput';
import PercentageInput from '../common/PercentageInput';
import IntegerInput from '../common/IntegerInput';

export const computeNPSData = (proposedNPS, expectedReturns, annuityPercent, annuityRate, selfMember, defaultNPSObj = {}, defaultCorpus = 0) => {
    // Determine user demographics relative to absolute dates
    const today = new Date();
    let birthYear = today.getFullYear() - 30; // default age 30
    let birthMonth = today.getMonth() + 1;

    if (selfMember?.dob) {
        const d = new Date(selfMember.dob);
        if (!isNaN(d.getTime())) {
            birthYear = d.getFullYear();
            birthMonth = d.getMonth() + 1;
        }
    }
    
    const retirementAge = parseInt(selfMember?.retirementAge) || 60;
    const maturityAbsolute = (birthYear + retirementAge) * 12 + birthMonth;
    
    let baseStartYear = today.getFullYear();
    let baseStartMonth = today.getMonth() + 1;
    
    const monthlyBaselineP = parseFloat(defaultNPSObj?.amount !== undefined ? defaultNPSObj.amount : defaultNPSObj) || 0;
    if (monthlyBaselineP > 0) {
        baseStartYear = parseInt(defaultNPSObj?.startYear) || baseStartYear;
        baseStartMonth = parseInt(defaultNPSObj?.startMonth) || baseStartMonth;
    }
    
    if (proposedNPS.length > 0) {
        const earliestProposedYear = Math.min(...proposedNPS.map(p => p.startYear));
        if (earliestProposedYear < baseStartYear) {
            baseStartYear = earliestProposedYear;
            const earliestNPS = proposedNPS.find(p => p.startYear === baseStartYear);
            baseStartMonth = earliestNPS ? Math.min(baseStartMonth, earliestNPS.startMonth) : baseStartMonth;
        }
    }
    
    const startAbsolute = baseStartYear * 12 + baseStartMonth;
    const baselineStartAbsolute = monthlyBaselineP > 0 ? (parseInt(defaultNPSObj?.startYear || baseStartYear) * 12 + parseInt(defaultNPSObj?.startMonth || baseStartMonth)) : startAbsolute;

    let schedule = [];
    let currentAbsolute = startAbsolute;

    let currentYearVal = baseStartYear;
    let currentMonthVal = baseStartMonth;

    let openingBalance = parseFloat(defaultCorpus) || 0;
    let yearlyInvestment = 0;
    let yearlyInterest = 0;
    let globalInvestment = 0;

    const monthlyRate = ((parseFloat(expectedReturns) || 0) / 100) / 12;

    while (currentAbsolute <= maturityAbsolute) {
        let monthlyInvestment = 0;
        
        // Handle Cash Flow Baseline
        if (monthlyBaselineP > 0 && currentAbsolute >= baselineStartAbsolute) {
            const baselineDurationMonths = parseInt(defaultNPSObj?.duration) ? parseInt(defaultNPSObj.duration) * 12 : Infinity;
            if ((currentAbsolute - baselineStartAbsolute) < baselineDurationMonths) {
                monthlyInvestment += monthlyBaselineP;
            }
        }
        
        proposedNPS.forEach(p => {
            const pStartAbsolute = p.startYear * 12 + p.startMonth;
            const pEndAbsolute = pStartAbsolute + (parseInt(p.duration) * 12) - 1;
            if (currentAbsolute >= pStartAbsolute && currentAbsolute <= pEndAbsolute) {
                monthlyInvestment += (parseFloat(p.amount) / 12) || 0;
            }
        });

        // Compound interest on opening + current month investment (start-of-month logic)
        const interest = (openingBalance + monthlyInvestment) * monthlyRate;
        
        yearlyInvestment += monthlyInvestment;
        globalInvestment += monthlyInvestment;
        yearlyInterest += interest;
        openingBalance = openingBalance + monthlyInvestment + interest;

        // Trigger log on calendar year end or absolute plan maturity
        if (currentMonthVal === 12 || currentAbsolute === maturityAbsolute) {
            let ageAtYearEnd = currentYearVal - birthYear;
            if (currentMonthVal < birthMonth) {
                ageAtYearEnd--;
            }

            schedule.push({
                year: currentYearVal,
                age: ageAtYearEnd,
                investment: yearlyInvestment,
                interest: yearlyInterest,
                endValue: openingBalance
            });

            yearlyInvestment = 0;
            yearlyInterest = 0;
            if (currentAbsolute < maturityAbsolute) {
                currentYearVal++;
            }
        }

        currentAbsolute++;
        currentMonthVal = (currentMonthVal % 12) + 1;
    }

    const maturityCorpus = schedule.length > 0 ? schedule[schedule.length - 1].endValue : 0;
    const validAnnuityPercent = parseFloat(annuityPercent) || 40;
    const validAnnuityRate = parseFloat(annuityRate) || 6;

    const annuityAmount = maturityCorpus * (validAnnuityPercent / 100);
    const lumpSumAmount = maturityCorpus - annuityAmount;
    const monthlyPension = (annuityAmount * (validAnnuityRate / 100)) / 12;

    return {
        schedule,
        totals: {
            maturityCorpus,
            globalInvestment,
            annuityAmount,
            lumpSumAmount,
            monthlyPension,
            retirementAge
        }
    };
};

import { useFinancialPlan } from '../../contexts/FinancialPlanContext';

const NPSCalculator = ({ calculatorKey = "nps" }) => {
    const { investmentAllocations: allocations = [], familyMembers = [], expenseCategories = {}, assetCategories = {}, calculatorInputs, setCalculatorInputs } = useFinancialPlan();
    const data = calculatorInputs[calculatorKey] || {};
    const setData = (newData) => setCalculatorInputs(prev => ({ ...prev, [calculatorKey]: typeof newData === 'function' ? newData(prev[calculatorKey] || {}) : newData }));
    const expectedReturns = data?.rate ?? 10.00;
    const annuityPercent = data?.annuity ?? 40;
    const annuityRate = data?.annuityRate ?? 6.00;

    const defaultNPSObj = expenseCategories?.savings?.nps || {};
    const defaultCorpus = parseFloat(assetCategories?.retirement?.nps) || 0;

    const setExpectedReturns = (val) => setData({ ...data, rate: val });
    const setAnnuityPercent = (val) => setData({ ...data, annuity: val });
    const setAnnuityRate = (val) => setData({ ...data, annuityRate: val });

    const proposedNPS = useMemo(() => allocations.filter(a => a.type === 'NPS'), [allocations]);
    const selfMember = useMemo(() => familyMembers.find(m => m.relation === 'Self') || familyMembers[0], [familyMembers]);

    const [localCorpus, setLocalCorpus] = React.useState(defaultCorpus);
    React.useEffect(() => { setLocalCorpus(defaultCorpus); }, [defaultCorpus]);

    const rateNum = Number(expectedReturns ?? 0);
    const annuityPctNum = Number(annuityPercent ?? 0);
    const annuityRateNum = Number(annuityRate ?? 0);
    const corpusNum = Number(localCorpus ?? 0);

    const calculationData = useMemo(() => {
        return computeNPSData(proposedNPS, rateNum, annuityPctNum, annuityRateNum, selfMember, defaultNPSObj, corpusNum);
    }, [proposedNPS, rateNum, annuityPctNum, annuityRateNum, selfMember, defaultNPSObj, corpusNum]);

    const { schedule, totals } = calculationData;

    return (
        <div className="fade-in" style={{ padding: '1rem' }}>
            <div className="card" style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                    <Briefcase size={32} color="var(--primary)" />
                    <div>
                        <h1 style={{ margin: 0 }}>NPS Calculator</h1>
                        <p className="text-muted" style={{ margin: 0 }}>National Pension System compound growth tied organically to your defined Retirement Age.</p>
                    </div>
                </div>

                {proposedNPS.length === 0 && (parseFloat(defaultNPSObj?.amount !== undefined ? defaultNPSObj.amount : defaultNPSObj) || 0) === 0 && defaultCorpus === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                        <p>No active NPS found in the Cash Flow Baseline nor proposed in the Allocation Module.</p>
                        <p style={{ fontSize: '0.9rem' }}>Go back to Step 4 or Step 9 to map your retirement benefits.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* SECTION 1: PRIMARY INPUTS */}
                        <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>Primary Parameters</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label><TrendingUp size={16} /> Expected Returns (CAGR %)</label>
                                    <PercentageInput
                                        value={expectedReturns}
                                        min={8}
                                        max={12}
                                        onValueChange={setExpectedReturns}
                                        className="form-input"
                                    />
                                    <small className="text-muted">Market tracking rate: 8% to 12%.</small>
                                </div>

                                <div className="form-group">
                                    <label><Briefcase size={16} /> Current Corpus (₹)</label>
                                    <CurrencyInput
                                        value={localCorpus}
                                        onValueChange={setLocalCorpus}
                                        className="form-input"
                                    />
                                    <small className="text-muted">Synced from Asset configs.</small>
                                </div>

                                <div className="form-group">
                                    <label><HeartHandshake size={16} /> Required Annuity (%)</label>
                                    <IntegerInput
                                        value={annuityPercent}
                                        min={40}
                                        max={100}
                                        onValueChange={setAnnuityPercent}
                                        className="form-input"
                                    />
                                    <small className="text-muted">Min 40% mandatory.</small>
                                </div>

                                <div className="form-group">
                                    <label><Calculator size={16} /> Expected Annuity Rate (%)</label>
                                    <PercentageInput
                                        value={annuityRate}
                                        min={5}
                                        max={8}
                                        onValueChange={setAnnuityRate}
                                        className="form-input"
                                    />
                                    <small className="text-muted">Yield parameter: 5% to 8%.</small>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: INCREMENTAL ADJUSTMENTS */}
                        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', color: 'var(--text-main)' }}>Fetched NPS Allocations</h3>
                            {proposedNPS.length === 0 ? (
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No future Allocations proposed natively.</div>
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                    {proposedNPS.map((p) => (
                                        <div key={p.id} className="card" style={{ padding: '1rem', border: '1px solid #10b981', background: '#ecfdf5', minWidth: '280px', flex: '1 1 auto', maxWidth: '350px' }}>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#10b981', marginBottom: '0.5rem' }}>
                                                {p.name || 'NPS Allocation'}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Yearly Amount</span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>₹{Math.round(p.amount).toLocaleString('en-IN')}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Start Date</span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                                    {new Date(2000, p.startMonth - 1, 1).toLocaleString('default', { month: 'short' })} {p.startYear}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Duration</span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.duration} Years</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* SECTION 3: VISUALIZATION */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Summary Cards */}
                            <div style={{ 
                                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem',
                                color: 'white'
                            }}>
                                <div style={{ background: '#10b981', padding: '1.25rem', borderRadius: '12px' }}>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.85rem' }}>Maturity Corpus (Age {totals.retirementAge})</p>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>₹{Math.round(totals.maturityCorpus).toLocaleString('en-IN')}</h3>
                                </div>
                                <div style={{ background: '#6366f1', padding: '1.25rem', borderRadius: '12px' }}>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.85rem' }}>Tax-Free Lump Sum</p>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>₹{Math.round(totals.lumpSumAmount).toLocaleString('en-IN')}</h3>
                                </div>
                                <div style={{ background: '#3b82f6', padding: '1.25rem', borderRadius: '12px' }}>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.85rem' }}>Annuity Reinvested</p>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>₹{Math.round(totals.annuityAmount).toLocaleString('en-IN')}</h3>
                                </div>
                                <div style={{ background: '#8b5cf6', padding: '1.25rem', borderRadius: '12px', border: '2px solid rgba(255,255,255,0.4)' }}>
                                    <p style={{ margin: '0 0 0.5rem 0', opacity: 0.9, fontSize: '0.85rem' }}>Expected Pension</p>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>₹{Math.round(totals.monthlyPension).toLocaleString('en-IN')}<span style={{fontSize:'0.8rem', fontWeight: 500}}>/mo</span></h3>
                                </div>
                            </div>

                            {/* Amortization Table */}
                            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                                    <table className="summary-table" style={{ width: '100%', fontSize: '0.95rem', borderCollapse: 'collapse' }}>
                                        <thead style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                            <tr>
                                                <th style={{ padding: '1.25rem', textAlign: 'left' }}>Year</th>
                                                <th style={{ padding: '1.25rem', textAlign: 'center' }}>Age</th>
                                                <th style={{ padding: '1.25rem', textAlign: 'right' }}>Investment Amount</th>
                                                <th style={{ padding: '1.25rem', textAlign: 'right' }}>Interest Earned</th>
                                                <th style={{ padding: '1.25rem', textAlign: 'right' }}>End Year Corpus</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {schedule.map((row, idx) => (
                                                <tr key={row.year} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : '#f8fafc' }}>
                                                    <td style={{ padding: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{row.year}</td>
                                                    <td style={{ padding: '1rem', textAlign: 'center', opacity: 0.8 }}>{row.age}</td>
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
export default NPSCalculator;
