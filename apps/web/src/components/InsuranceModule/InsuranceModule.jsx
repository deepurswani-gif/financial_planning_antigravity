import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PieChart, Plus, Target, Info, TrendingUp, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import InsuranceInput from './InsuranceInput';
import InsuranceOutput from './InsuranceOutput';
import { calculateYearlyInsuranceSummary, getInsuredNamesList } from './InsuranceLogic';
import { convertToAnnual } from '../CashFlowModule/CashFlowLogic';
import SharedDocumentVault from './SharedDocumentVault';
import ContextualHelpPopup from '../common/ContextualHelpPopup';
import logo from '../../assets/finbrella_logo.png';
import { useAuth } from '../../contexts/AuthContext';
import { buildSupportEmailContextFromUser } from '../../services/supportRequestEmailService';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import IntegerInput from '../common/IntegerInput';

const isLifeAlloc = (a) => (
    a
    && (a.type === 'Life Insurance' || a.type === 'Life Insurance Saving Plans')
    && a.insuredMember
);

const findLifeAllocForMember = (investmentAllocations, memberName) => (
    (investmentAllocations || []).find((a) => isLifeAlloc(a) && a.insuredMember === memberName)
);

const InsuranceModule = ({ onNext, onBack, setCurrentStep }) => {
    const { familyMembers, policies, setPolicies, expenseCategories, setExpenseCategories, investmentAllocations } = useFinancialPlan();
    const { user } = useAuth();
    const [results, setResults] = useState(null);
    const [showMismatchModal, setShowMismatchModal] = useState(false);
    const [amounts, setAmounts] = useState({ here: 0, cashFlow: 0 });
    const [showDetailedPolicies, setShowDetailedPolicies] = useState(false);
    const [showProposedPolicies, setShowProposedPolicies] = useState(false);
    const [policyCounts, setPolicyCounts] = useState({});
    const [showHelpPopup, setShowHelpPopup] = useState(false);

    // Sync frequency from allocation module if it changes
    useEffect(() => {
        if (investmentAllocations && investmentAllocations.length > 0) {
            setPolicies(prev => {
                let updated = false;
                const newPolicies = prev.map(p => {
                    if (p.isProposed) {
                        const alloc = findLifeAllocForMember(investmentAllocations, p.insuredName);
                        if (alloc) {
                            const mappedFrequency = alloc.frequency === 'Annual' ? 'Annually' : (alloc.frequency || 'Monthly');
                            const allocAmount = alloc.amount || '';
                            const allocDuration = alloc.duration || '';
                            
                            const year = parseInt(alloc.startYear) || new Date().getFullYear();
                            const month = parseInt(alloc.startMonth) || 1;
                            const allocStartDate = `${year}-${String(month).padStart(2, '0')}-01`;

                            if (mappedFrequency !== p.frequency || allocAmount !== p.premium || allocDuration !== p.paymentTerm || allocStartDate !== p.startDate) {
                                updated = true;
                                const planType = alloc.type === 'Life Insurance Saving Plans'
                                    ? (p.planType === 'ULIP' ? 'ULIP' : 'Saving Plan')
                                    : p.planType;
                                return {
                                    ...p,
                                    frequency: mappedFrequency,
                                    premium: allocAmount,
                                    paymentTerm: allocDuration,
                                    startDate: allocStartDate,
                                    planType,
                                };
                            }
                        }
                    }
                    return p;
                });
                return updated ? newPolicies : prev;
            });
        }
    }, [investmentAllocations, setPolicies]);

    const getPolicyCount = (memberName, isProposed) => {
        const key = `${memberName}_${isProposed ? 'proposed' : 'existing'}`;
        if (policyCounts[key] !== undefined) return policyCounts[key];
        return policies.filter(p => p.insuredName === memberName && !!p.isProposed === isProposed).length;
    };

    const handlePolicyCountChange = (memberName, count, isProposed) => {
        const key = `${memberName}_${isProposed ? 'proposed' : 'existing'}`;
        
        if (count == null || count === '') {
            setPolicyCounts(prev => ({ ...prev, [key]: '' }));
            return;
        }

        const newCount = Math.max(0, typeof count === 'number' ? count : parseInt(count, 10) || 0);
        setPolicyCounts(prev => ({ ...prev, [key]: newCount }));
        
        const currentMemberPolicies = policies.filter(p => p.insuredName === memberName && !!p.isProposed === isProposed);
        const otherPolicies = policies.filter(p => !(p.insuredName === memberName && !!p.isProposed === isProposed));
        
        if (newCount > currentMemberPolicies.length) {
            const toAdd = newCount - currentMemberPolicies.length;
            const newPolicies = Array(toAdd).fill(null).map((_, i) => {
                let prefill = {};
                if (isProposed && investmentAllocations.length > 0) {
                    const alloc = findLifeAllocForMember(investmentAllocations, memberName);
                    if (alloc) {
                        const year = parseInt(alloc.startYear) || new Date().getFullYear();
                        const month = parseInt(alloc.startMonth) || 1;
                        const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
                        
                        const mappedFrequency = alloc.frequency === 'Annual' ? 'Annually' : (alloc.frequency || 'Monthly');
                        prefill = {
                            premium: alloc.amount || '',
                            frequency: mappedFrequency,
                            paymentTerm: alloc.duration || '',
                            startDate: dateStr,
                            planType: alloc.type === 'Life Insurance Saving Plans' ? 'Saving Plan' : 'Term Insurance',
                        };
                    }
                }
                return {
                    id: Date.now() + i + Math.random(),
                    insuredName: memberName,
                    company: '',
                    planName: '',
                    planType: prefill.planType || 'Term Insurance',
                    isProposed,
                    startDate: prefill.startDate || '',
                    endDate: '',
                    sumAssured: '',
                    paymentTerm: prefill.paymentTerm || '',
                    policyTerm: '',
                    premium: prefill.premium || '',
                    frequency: prefill.frequency || 'Annually',
                    maturityAmount: ''
                };
            });
            setPolicies([...otherPolicies, ...currentMemberPolicies, ...newPolicies]);
        } else if (newCount < currentMemberPolicies.length) {
            const keptPolicies = currentMemberPolicies.slice(0, newCount);
            setPolicies([...otherPolicies, ...keptPolicies]);
        }
    };

    const allocationPremiums = (investmentAllocations || []).filter(isLifeAlloc);

    const allocationAnnual = allocationPremiums.reduce((sum, item) => {
        const freq = item.frequency || 'Monthly';
        const multiplier = freq === 'Monthly' ? 12 : freq === 'Quarterly' ? 4 : freq === 'Half-Yearly' ? 2 : 1;
        return sum + ((parseFloat(item.amount) || 0) * multiplier);
    }, 0);

    const cashFlowAnnual = Object.values(expenseCategories.insurance?.life || {}).reduce((sum, item) => {
        return sum + convertToAnnual(item.value, item.frequency);
    }, 0);

    const totalExpectedPremium = cashFlowAnnual + allocationAnnual;

    const handleCalculate = () => {
        // Filter out proposed policies for members who no longer have allocations
        const validPolicies = policies.filter(p => {
            if (p.isProposed) {
                return (investmentAllocations || []).some(a => isLifeAlloc(a) && a.insuredMember === p.insuredName);
            }
            return true;
        });

        if (validPolicies.length !== policies.length) {
            setPolicies(validPolicies);
        }

        const calculated = calculateYearlyInsuranceSummary(validPolicies);
        setResults(calculated);
    };

    const allowedMembersExisting = familyMembers.filter(member => {
        const data = expenseCategories.insurance?.life?.[member.name || member.relation];
        return data && data.value > 0;
    });

    const allowedMembersProposed = familyMembers.filter(member => {
        return (investmentAllocations || []).some(a => isLifeAlloc(a) && a.insuredMember === (member.name || member.relation));
    });

    const handleProceed = () => {
        // A. Total premium from this module (converted to Annual)
        const totalAnnualHere = policies.reduce((sum, p) => {
            const premium = parseFloat(p.premium) || 0;
            const freq = p.frequency || 'Annually';
            const multiplier = freq === 'Monthly' ? 12 : freq === 'Quarterly' ? 4 : freq === 'Half-Yearly' ? 2 : 1;
            return sum + (premium * multiplier);
        }, 0);

        if (Math.round(totalAnnualHere) !== Math.round(totalExpectedPremium)) {
            setAmounts({ here: Math.round(totalAnnualHere), cashFlow: Math.round(totalExpectedPremium) });
            setShowMismatchModal(true);
        } else {
            onNext();
        }
    };

    return (
        <div style={{ marginTop: '2rem' }}>
            <div className="fade-in">
                <div className="card">
                    <h1>Life Insurance Policies (Module 5)</h1>
                    <p className="text-muted" style={{ marginBottom: '2rem' }}>
                        Record existing life insurance plans for each family member to analyze premium outflows and total coverage.
                    </p>

                    <div className="premium-summary" style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Life Insurance Premium Summary (from Cash Flow)</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                            {familyMembers.map(member => {
                                const data = expenseCategories.insurance?.life?.[member.name || member.relation] || { value: 0, frequency: 'Annual' };
                                if (!data || data.value === 0) return null;
                                const memberName = member.name || member.relation;
                                return (
                                    <div key={memberName} style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem',
                                        padding: '1rem',
                                        background: 'rgba(37, 99, 235, 0.05)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        borderLeft: '4px solid var(--primary)'
                                    }}>
                                        <div className="input-group">
                                            <label>Premium ({memberName})</label>
                                            <div style={{ 
                                                padding: '0.75rem 1rem', 
                                                background: 'var(--bg-card)', 
                                                border: '1px solid var(--border)', 
                                                borderRadius: '8px',
                                                color: 'var(--text-main)',
                                                fontWeight: 600,
                                                fontSize: '1rem'
                                            }}>
                                                ₹{parseFloat(data.value || 0).toLocaleString('en-IN')} ({data.frequency})
                                            </div>
                                        </div>
                                        <div className="input-group">
                                            <label>Number of policies</label>
                                            <IntegerInput
                                                min={0}
                                                className="input-field"
                                                value={getPolicyCount(memberName, false)}
                                                onValueChange={(v) => handlePolicyCountChange(memberName, v, false)}
                                                placeholder="Enter number of policies"
                                                style={{ width: '100%' }}
                                            />
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginTop: '6px' }}>
                                                Enter the number of policies for which you are paying above mentioned premium
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {allocationPremiums.length > 0 && (
                            <>
                                <h3 style={{ marginTop: '2rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>Life Insurance Premium Summary (from Allocation)</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                    {allocationPremiums.map((item, idx) => (
                                        <div key={idx} className="input-group">
                                            <label>{item.name || `Investment ${idx + 1}`} ({item.insuredMember || 'Unspecified'})</label>
                                            <div style={{ 
                                                padding: '0.75rem 1rem', 
                                                background: 'var(--bg-card)', 
                                                border: '1px solid var(--border)', 
                                                borderRadius: '8px',
                                                color: 'var(--primary)',
                                                fontWeight: 600,
                                                fontSize: '1rem'
                                            }}>
                                                ₹{(parseFloat(item.amount) || 0).toLocaleString('en-IN')} ({item.frequency || 'Monthly'})
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                        
                        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Total Life Insurance Premium:</span>
                            <span style={{ 
                                fontSize: '1.5rem', 
                                fontWeight: 800, 
                                color: 'var(--primary)',
                                background: 'rgba(37, 99, 235, 0.1)',
                                padding: '0.5rem 1.5rem',
                                borderRadius: '8px'
                            }}>
                                ₹{totalExpectedPremium.toLocaleString('en-IN')}/year
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2.5rem' }}>
                        <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => setShowDetailedPolicies(!showDetailedPolicies)}
                                style={{ 
                                    flex: 1, 
                                    borderStyle: 'dashed', 
                                    background: 'transparent',
                                    padding: '1.5rem',
                                    fontSize: '1.1rem',
                                    fontWeight: 600,
                                    color: 'var(--primary)',
                                    borderColor: 'var(--primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px'
                                }}
                            >
                                <span style={{ fontSize: '1.5rem' }}>{showDetailedPolicies ? '-' : '+'}</span>
                                For accurate financial planning provide complete details of each policy
                            </button>
                            <button 
                                onClick={() => setShowHelpPopup(true)}
                                title="Need Help?"
                                style={{
                                    background: 'var(--bg-main)',
                                    border: '1px dashed var(--primary)',
                                    color: 'var(--primary)',
                                    padding: '0 1rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(37, 99, 235, 0.1)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-main)'; }}
                            >
                                <HelpCircle size={24} />
                            </button>
                        </div>

                        <button 
                            className="btn btn-secondary" 
                            onClick={() => setShowProposedPolicies(!showProposedPolicies)}
                            style={{ 
                                flex: 1, 
                                borderStyle: 'dashed', 
                                background: 'transparent',
                                padding: '1.5rem',
                                fontSize: '1.1rem',
                                fontWeight: 600,
                                color: 'var(--secondary-dark, var(--accent))',
                                borderColor: 'var(--secondary-dark, var(--accent))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px'
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>{showProposedPolicies ? '-' : '+'}</span>
                            Enter complete details of Proposed Policies
                        </button>
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: '2.5rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        <em>If you find any difficulty in filling out the complete insurance details, upload your policy documents below and we will assist you.</em>
                    </div>

                    {/* Future Proposed Policies from Allocation Module */}
                    {investmentAllocations && investmentAllocations.filter(isLifeAlloc).length > 0 && (
                        <div style={{ marginTop: '2rem', marginBottom: '2.5rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                                <TrendingUp size={18} />
                                Proposed Policies (from Allocation Module)
                            </h4>
                            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                {Object.entries(investmentAllocations.filter(isLifeAlloc).reduce((acc, item) => {
                                    const memberName = item.insuredMember || 'Unspecified';
                                    if (!acc[memberName]) acc[memberName] = [];
                                    acc[memberName].push(item);
                                    return acc;
                                }, {})).map(([memberName, items], idx) => (
                                    <div key={idx} style={{ 
                                        padding: '1rem', 
                                        background: 'rgba(37, 99, 235, 0.05)', 
                                        borderRadius: '8px', 
                                        border: '1px solid var(--border)',
                                        borderLeft: '4px solid var(--secondary-dark, var(--accent))',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem'
                                    }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            Proposed Policies for {memberName}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {items.map((item, iIdx) => (
                                                <div key={iIdx} style={{ 
                                                    padding: '0.75rem', 
                                                    background: 'var(--bg-card)', 
                                                    border: '1px solid var(--border)', 
                                                    borderRadius: '6px',
                                                }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>{item.name || `Policy ${iIdx + 1}`}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>Starts: {new Date(0, (parseInt(item.startMonth) || 1) - 1).toLocaleString('default', { month: 'short' })} {item.startYear}</span>
                                                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>₹{(parseFloat(item.amount) || 0).toLocaleString('en-IN')} ({item.frequency || 'Monthly'})</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="input-group" style={{ marginTop: '0.5rem' }}>
                                            <label>Number of proposed policies</label>
                                            <IntegerInput
                                                min={0}
                                                className="input-field"
                                                value={getPolicyCount(memberName, true)}
                                                onValueChange={(v) => handlePolicyCountChange(memberName, v, true)}
                                                placeholder="Enter number of policies"
                                                style={{ width: '100%', borderColor: 'var(--secondary-dark, var(--accent))' }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {showDetailedPolicies && (
                        <div className="fade-in">
                            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>Existing Policies</h3>
                            {allowedMembersExisting.length > 0 ? (
                                <InsuranceInput
                                    familyMembers={allowedMembersExisting}
                                    policies={policies}
                                    setPolicies={setPolicies}
                                    isProposed={false}
                                />
                            ) : (
                                <p style={{ color: 'var(--text-muted)' }}>No existing life insurance premiums recorded in Cash Flow.</p>
                            )}
                        </div>
                    )}

                    {showProposedPolicies && (
                        <div className="fade-in" style={{ marginTop: '2rem' }}>
                            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>Proposed Policies</h3>
                            {allowedMembersProposed.length > 0 ? (
                                <InsuranceInput
                                    familyMembers={allowedMembersProposed}
                                    policies={policies}
                                    setPolicies={setPolicies}
                                    isProposed={true}
                                    investmentAllocations={investmentAllocations}
                                />
                            ) : (
                                <p style={{ color: 'var(--text-muted)' }}>No proposed life insurance allocations recorded in Step 9.</p>
                            )}
                        </div>
                    )}
                </div>
                
                <SharedDocumentVault />

                {results && (
                    <div className="fade-in">
                        <InsuranceOutput summary={results} policies={policies} />
                    </div>
                )}

                <div className="sticky-action-bar">
                    <button className="btn btn-secondary" onClick={onBack} style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ChevronLeft size={20} />
                        Back to Life Goals
                    </button>
                    {!results ? (
                        <button className="btn btn-primary" onClick={handleCalculate} style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-md)' }}>
                            Generate Insurance Report
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={handleProceed} style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-md)' }}>
                            Proceed to Protection Gap Analysis
                            <ChevronRight size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Premium Mismatch Modal */}
            {showMismatchModal && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999,
                    backdropFilter: 'blur(10px)'
                }} onClick={(e) => e.stopPropagation()}>
                    <div className="card fade-in" style={{
                        width: '90%',
                        maxWidth: '550px',
                        padding: '2.5rem',
                        textAlign: 'center',
                        background: 'var(--bg-main)',
                        border: '2px solid #ef4444',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                        margin: 'auto',
                        borderRadius: '16px',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        <h3 style={{ color: '#ef4444', marginBottom: '1.5rem', fontSize: '1.5rem' }}>Premium Mismatch Detected</h3>
                        <p style={{ marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '1.1rem' }}>
                            The Premium you entered here is <strong>₹{amounts.here.toLocaleString('en-IN')}</strong> and total expected premium (Cash Flow + Allocation) is <strong>₹{amounts.cashFlow.toLocaleString('en-IN')}</strong>.
                        </p>
                        <p style={{ marginBottom: '2.5rem', fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--text-main)' }}>
                            For accurate Financial Plan fill correct & complete details of all insurance policies
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); setShowMismatchModal(false); }} style={{ padding: '1rem', background: 'var(--primary)', border: 'none', color: 'white', fontWeight: 600, width: '100%' }}>
                                Fill all details or Let me match the premium
                            </button>
                            <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); setShowMismatchModal(false); onNext(); }} style={{ padding: '1rem', fontWeight: 600, width: '100%' }}>
                                Continue Anyway
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <ContextualHelpPopup 
                isOpen={showHelpPopup}
                onClose={() => setShowHelpPopup(false)}
                title="Need help in filling policies details?"
                message="Finbrella can assist you with this. Simply upload your policy bond below, or reach out via call or email."
                logoSrc={logo}
                supportContacts={{
                    email: "finbrellafpd@gmail.com",
                    phone: ["+91 9785895737", "+91 7046069999"]
                }}
                supportEmailContext={buildSupportEmailContextFromUser(familyMembers, user, 'Insurance')}
            />
        </div>
    );
};

export default InsuranceModule;
