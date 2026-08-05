import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { PieChart, Plus, Trash2, ArrowRight, Wallet, Target, TrendingUp, ChevronDown, ChevronUp, AlertTriangle, ChevronLeft, ChevronRight, Filter, HelpCircle } from 'lucide-react';
import CurrencyInput from '../common/CurrencyInput';
import IntegerInput from '../common/IntegerInput';
import YearsInput from '../common/YearsInput';
import ContextualHelpPopup from '../common/ContextualHelpPopup';
import logo from '../../assets/finbrella_logo.png';
import { useAuth } from '../../contexts/AuthContext';
import { buildSupportEmailContextFromUser } from '../../services/supportRequestEmailService';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';

const AllocationModule = ({ onNext, onBack }) => {
    const { familyMembers, expenseCategories, investmentAllocations: allocations, setInvestmentAllocations: setAllocations, journeyProjections: projections, planStartMonth } = useFinancialPlan();
    const netInvestibleSurplus = (projections?.find(p => p.year === new Date().getFullYear()))?.netInvestibleSurplus || 0;
    const { user } = useAuth();
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const [collapsedIds, setCollapsedIds] = useState(new Set());
    const [hasAcknowledgedDeficit, setHasAcknowledgedDeficit] = useState(false);
    const [viewMode, setViewMode] = useState('10');
    const [showHelpModal, setShowHelpModal] = useState(false);

    const adjustedProjections = useMemo(() => {
        return projections.map((p, idx) => {
            if (idx === 0) {
                const remainingMonths = Math.max(1, 12 - planStartMonth);
                const proratedSurplus = (p.netInvestibleSurplus / 12) * remainingMonths;
                const proratedUnallocated = proratedSurplus - (p.yearAllocationsTotal || 0);
                return {
                    ...p,
                    netInvestibleSurplus: proratedSurplus,
                    unallocatedSurplus: proratedUnallocated,
                    yearHasDeficit: proratedUnallocated < 0 ? true : p.yearHasDeficit
                };
            }
            return p;
        });
    }, [projections, planStartMonth]);

    const proratedYear1Surplus = adjustedProjections[0]?.netInvestibleSurplus || 0;
    const remainingMonths = Math.max(1, 12 - planStartMonth);

    useEffect(() => {
        if (!adjustedProjections.some(p => p.yearHasDeficit)) {
            setHasAcknowledgedDeficit(false);
        }
    }, [adjustedProjections]);

    const toggleCollapse = (id) => {
        const newCollapsed = new Set(collapsedIds);
        if (newCollapsed.has(id)) {
            newCollapsed.delete(id);
        } else {
            newCollapsed.add(id);
        }
        setCollapsedIds(newCollapsed);
    };

    const addAllocation = (type) => {
        setAllocations([
            ...allocations,
            { 
                id: Date.now(), 
                type: type, 
                name: '', 
                amount: '', // This will be monthly for SIP, PPF, NPS, Life Insurance and total for others
                startMonth: new Date().getMonth() + 1,
                startYear: currentYear,
                duration: 10,
                expectedReturn: 12,
                frequency: 'Monthly'
            }
        ]);
    };

    const updateAllocation = (id, field, value) => {
        setAllocations(allocations.map(item => 
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const removeAllocation = (id) => {
        setAllocations(allocations.filter(item => item.id !== id));
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(val || 0);
    };

    // Global PPF constraints auto-correction
    useEffect(() => {
        const ppfAllocations = allocations.filter(a => a.type === 'PPF');
        const existingPpf = expenseCategories?.savings?.ppf;
        const hasExistingPpf = existingPpf && parseFloat(existingPpf.amount) > 0;

        if (ppfAllocations.length === 0 && !hasExistingPpf) return;

        let earliestStartYear = currentYear;
        let earliestStartMonth = currentMonth;

        if (hasExistingPpf) {
            earliestStartYear = parseInt(existingPpf.startYear) || currentYear;
            earliestStartMonth = parseInt(existingPpf.startMonth) || currentMonth;
        } else if (ppfAllocations.length > 0) {
            const earliest = ppfAllocations.reduce((min, p) => 
                (p.startYear < min.startYear || (p.startYear === min.startYear && p.startMonth < min.startMonth)) ? p : min
            , ppfAllocations[0]);
            earliestStartYear = earliest.startYear;
            earliestStartMonth = earliest.startMonth;
        }

        const globalPpfEndAbsolute = (earliestStartYear + 15) * 12 + earliestStartMonth - 1;
        
        const existingAnnualAmount = hasExistingPpf ? (parseFloat(existingPpf.amount) * 12) : 0;
        const maxAnnualLimitForProposed = Math.max(0, 150000 - existingAnnualAmount);

        let totalPpfAnnualAmount = 0;
        let needsCorrection = false;
        
        const correctedAllocations = allocations.map(item => {
            if (item.type !== 'PPF') return item;
            
            let correctedItem = { ...item };
            
            // Amount Constraint
            totalPpfAnnualAmount += parseFloat(correctedItem.amount || 0);
            if (totalPpfAnnualAmount > maxAnnualLimitForProposed) {
                const excess = totalPpfAnnualAmount - maxAnnualLimitForProposed;
                correctedItem.amount -= excess;
                totalPpfAnnualAmount = maxAnnualLimitForProposed;
                if (correctedItem.amount < 0) correctedItem.amount = 0;
                needsCorrection = true;
            }
            
            // Start Date Constraint
            let itemStartAbsolute = correctedItem.startYear * 12 + correctedItem.startMonth;
            if (itemStartAbsolute > globalPpfEndAbsolute) {
                correctedItem.startYear = Math.floor((globalPpfEndAbsolute - 1) / 12);
                correctedItem.startMonth = (globalPpfEndAbsolute - 1) % 12 + 1;
                itemStartAbsolute = globalPpfEndAbsolute;
                needsCorrection = true;
            }
            
            // Duration Constraint
            const diffMonths = globalPpfEndAbsolute - itemStartAbsolute + 1;
            const maxAllowedDuration = Math.max(0, Math.min(15, Math.floor(diffMonths / 12)));
            
            if (correctedItem.duration !== maxAllowedDuration && correctedItem.duration > maxAllowedDuration) {
                correctedItem.duration = maxAllowedDuration;
                needsCorrection = true;
            }
            
            return correctedItem;
        });

        if (needsCorrection) {
            setAllocations(correctedAllocations);
        }
    }, [allocations, setAllocations, expenseCategories, currentYear, currentMonth]);

    // Derived data for the dynamic table
    const dynamicColumns = useMemo(() => {
        const types = new Set();
        allocations.forEach(a => types.add(a.type));
        return Array.from(types).sort();
    }, [allocations]);

    const isRecurring = (type) => ['SIP', 'PPF', 'NPS', 'Life Insurance', 'Recurring Deposit'].includes(type);
    const hasDuration = (type) => isRecurring(type) || type === 'Fixed Deposit';

    const deficitInfo = useMemo(() => {
        const deficitYear = adjustedProjections.find(p => p.yearHasDeficit);
        if (deficitYear) {
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return {
                year: deficitYear.year,
                month: deficitYear.yearDeficitMonth ? months[deficitYear.yearDeficitMonth - 1] : null
            };
        }
        return null;
    }, [adjustedProjections]);

    return (
        <div className="allocation-module fade-in">
            {deficitInfo && !hasAcknowledgedDeficit && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        background: 'var(--bg-main)',
                        padding: '2rem',
                        borderRadius: '12px',
                        maxWidth: '450px',
                        width: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1rem',
                        border: '1px solid rgba(239, 68, 68, 0.5)'
                    }}>
                        <div style={{
                            width: '48px', height: '48px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ef4444'
                        }}>
                            <AlertTriangle size={28} />
                        </div>
                        <h3 style={{ margin: 0, color: '#ef4444' }}>Warning: Over-allocated!</h3>
                        <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                            Your proposed investments exceed your accumulated cash flow <strong>{deficitInfo.month ? ` starting around ${deficitInfo.month} ${deficitInfo.year}` : ` in ${deficitInfo.year}`}</strong>. 
                            <br/><br/>
                            Please ensure you generate enough surplus before committing to these allocations.
                        </p>
                        <button 
                            onClick={() => setHasAcknowledgedDeficit(true)}
                            style={{
                                background: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                padding: '0.75rem 2rem',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                marginTop: '0.5rem',
                                width: '100%'
                            }}
                        >
                            OK, I understand
                        </button>
                    </div>
                </div>,
                document.body
            )}
            
            <div className="card" style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <PieChart size={24} className="text-primary" />
                        <h2 style={{ margin: 0 }}>Step 9: Investment Allocation</h2>
                    </div>
                    <button className="btn btn-outline" onClick={() => setShowHelpModal(true)} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
                        <HelpCircle size={16} style={{ marginRight: '6px' }} /> Need Help
                    </button>
                </div>

                <p className="text-muted" style={{ marginBottom: '2rem' }}>
                    Allocate your Adjusted Net Investible Surplus for Year 1 into various investment avenues.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0 }}>Proposed Investments</h3>
                </div>

                {allocations.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '3rem' }}>
                        {allocations.map((item, index) => {
                            const recurring = isRecurring(item.type);
                            const isCollapsed = collapsedIds.has(item.id);
                            return (
                                <div key={item.id} style={{ 
                                    background: 'var(--bg-main)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border)',
                                    overflow: 'hidden',
                                    marginBottom: '0.5rem'
                                }}>
                                    {/* Form Header */}
                                    <div style={{ 
                                        padding: '0.75rem 1.25rem',
                                        background: isCollapsed ? 'transparent' : 'rgba(37, 99, 235, 0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        borderBottom: isCollapsed ? 'none' : '1px solid var(--border)',
                                        cursor: 'pointer'
                                    }} onClick={() => toggleCollapse(item.id)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ 
                                                width: '24px', 
                                                height: '24px', 
                                                borderRadius: '50%', 
                                                background: 'var(--primary)', 
                                                color: 'white', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold'
                                            }}>
                                                {index + 1}
                                            </div>
                                            <span style={{ fontWeight: 600 }}>
                                                {item.name || `Investment ${index + 1}`}
                                                {item.type && <span style={{ marginLeft: '8px', opacity: 0.6, fontWeight: 400, fontSize: '0.85rem' }}>({item.type})</span>}
                                            </span>
                                            {isCollapsed && item.amount > 0 && (
                                                <span style={{ marginLeft: '12px', color: 'var(--primary)', fontWeight: 600 }}>
                                                    {formatCurrency(Math.round(recurring ? (item.type === 'Life Insurance' ? item.amount : item.amount / 12) : item.amount))}
                                                    {item.type === 'Life Insurance' ? ` /${item.frequency || 'Monthly'}` : (recurring ? ' /mo' : '')}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); removeAllocation(item.id); }}
                                                style={{ 
                                                    background: 'none', 
                                                    border: 'none', 
                                                    color: '#ef4444', 
                                                    cursor: 'pointer',
                                                    padding: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    opacity: 0.8
                                                }}
                                                title="Remove"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); toggleCollapse(item.id); }}
                                                style={{ 
                                                    background: 'none', 
                                                    border: 'none', 
                                                    color: 'var(--text-muted)', 
                                                    cursor: 'pointer',
                                                    padding: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Form Body */}
                                    {!isCollapsed && (
                                        <div className="grid" style={{ 
                                            gridTemplateColumns: item.type === 'Life Insurance' ? '1.5fr 1.5fr 1fr 1fr 0.8fr 0.8fr 0.8fr' : '2fr 1.5fr 1fr 1fr 1fr', 
                                            gap: '1rem', 
                                            alignItems: 'end',
                                            padding: '1.25rem'
                                        }}>
                                            <div className="input-group" style={{ marginBottom: 0 }}>
                                                <label>Label</label>
                                                <input 
                                                    type="text" 
                                                    value={item.name} 
                                                    onChange={(e) => updateAllocation(item.id, 'name', e.target.value)}
                                                    placeholder="e.g. Retirement SIP"
                                                />
                                            </div>
                                            {item.type === 'Life Insurance' && (
                                                <div className="input-group" style={{ marginBottom: 0 }}>
                                                    <label>Insured Member</label>
                                                    <select 
                                                        value={item.insuredMember} 
                                                        onChange={(e) => updateAllocation(item.id, 'insuredMember', e.target.value)}
                                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                                                    >
                                                        <option value="">Select Member</option>
                                                        {familyMembers.map((m, idx) => (
                                                            <option key={idx} value={m.name || m.relation}>{m.name || m.relation}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            <div className="input-group" style={{ marginBottom: 0 }}>
                                                <label>{item.type === 'Life Insurance' ? 'Premium Amount' : (recurring ? 'Monthly Amount' : 'Amount')}</label>
                                                <CurrencyInput 
                                                    name="allocationAmount"
                                                    value={item.type === 'Life Insurance' ? (Math.round(item.amount) || '') : (recurring ? (Math.round(item.amount / 12) || '') : Math.round(item.amount))} 
                                                    onChange={(e) => {
                                                        let val = Math.round(parseFloat(e.target.value)) || 0;
                                                        if (item.type === 'PPF') {
                                                            const existingPpfAmt = parseFloat(expenseCategories?.savings?.ppf?.amount || 0) * 12;
                                                            const otherPpfsAnnualSum = allocations
                                                                .filter(a => a.type === 'PPF' && a.id !== item.id)
                                                                .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
                                                            const totalAvailableYearly = Math.max(0, 150000 - existingPpfAmt - otherPpfsAnnualSum);
                                                            const maxMonthly = Math.max(0, Math.floor(totalAvailableYearly / 12));
                                                            if (val > maxMonthly) {
                                                                val = maxMonthly;
                                                            }
                                                        }
                                                        if (item.type === 'Life Insurance') {
                                                            updateAllocation(item.id, 'amount', val);
                                                        } else {
                                                            updateAllocation(item.id, 'amount', recurring ? val * 12 : val);
                                                        }
                                                    }}
                                                    placeholder="0"
                                                />
                                                {recurring && (
                                                    <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                                        {item.type === 'Life Insurance' ? `Mode: ${item.frequency || 'Monthly'}` : `Yearly: ${formatCurrency(item.amount)}`}
                                                    </small>
                                                )}
                                            </div>
                                            {item.type === 'Life Insurance' && (
                                                <div className="input-group" style={{ marginBottom: 0 }}>
                                                    <label>Frequency</label>
                                                    <select 
                                                        value={item.frequency || 'Monthly'} 
                                                        onChange={(e) => updateAllocation(item.id, 'frequency', e.target.value)}
                                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                                                    >
                                                        <option value="Monthly">Monthly</option>
                                                        <option value="Quarterly">Quarterly</option>
                                                        <option value="Half-Yearly">Half-Yearly</option>
                                                        <option value="Annual">Annual</option>
                                                    </select>
                                                </div>
                                            )}
                                            <div className="input-group" style={{ marginBottom: 0 }}>
                                                <label>Start Month</label>
                                                <select 
                                                    value={item.startMonth} 
                                                    onChange={(e) => {
                                                        let val = parseInt(e.target.value);
                                                        if (item.startYear === currentYear && val < currentMonth) {
                                                            val = currentMonth;
                                                        }
                                                        updateAllocation(item.id, 'startMonth', val);
                                                    }}
                                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                                                >
                                                    {Array.from({ length: 12 }, (_, i) => (
                                                        <option key={i + 1} value={i + 1}>
                                                            {new Date(0, i).toLocaleString('default', { month: 'short' })}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="input-group" style={{ marginBottom: 0 }}>
                                                <label>Start Year</label>
                                                <IntegerInput
                                                    value={item.startYear}
                                                    min={currentYear}
                                                    onValueChange={(v) => {
                                                        updateAllocation(item.id, 'startYear', v);
                                                        if (v === currentYear && item.startMonth < currentMonth) {
                                                            updateAllocation(item.id, 'startMonth', currentMonth);
                                                        }
                                                    }}
                                                />
                                            </div>
                                            {hasDuration(item.type) ? (
                                                <div className="input-group" style={{ marginBottom: 0 }}>
                                                    <label>{item.type === 'Life Insurance' ? 'Premium Payment Term (Years)' : (item.type === 'Fixed Deposit' ? 'Tenure (Yrs)' : 'Duration (Yrs)')}</label>
                                                    <YearsInput
                                                        value={item.duration}
                                                        max={item.type === 'PPF' ? (() => {
                                                            const existingPpf = expenseCategories?.savings?.ppf;
                                                            const hasExistingPpf = existingPpf && parseFloat(existingPpf.amount) > 0;
                                                            let earliestStartYear = currentYear;
                                                            let earliestStartMonth = currentMonth;

                                                            if (hasExistingPpf) {
                                                                earliestStartYear = parseInt(existingPpf.startYear) || currentYear;
                                                                earliestStartMonth = parseInt(existingPpf.startMonth) || currentMonth;
                                                            } else {
                                                                const ppfAllocations = allocations.filter(a => a.type === 'PPF');
                                                                const earliest = ppfAllocations.reduce((min, p) =>
                                                                    (p.startYear < min.startYear || (p.startYear === min.startYear && p.startMonth < min.startMonth)) ? p : min
                                                                , ppfAllocations[0]);
                                                                earliestStartYear = earliest ? earliest.startYear : currentYear;
                                                                earliestStartMonth = earliest ? earliest.startMonth : currentMonth;
                                                            }

                                                            const globalPpfEndAbsolute = (earliestStartYear + 15) * 12 + earliestStartMonth - 1;
                                                            const itemStartAbsolute = item.startYear * 12 + item.startMonth;
                                                            const diffMonths = globalPpfEndAbsolute - itemStartAbsolute + 1;
                                                            return Math.max(0, Math.min(15, Math.floor(diffMonths / 12)));
                                                        })() : undefined}
                                                        onValueChange={(v) => updateAllocation(item.id, 'duration', v == null ? '' : v)}
                                                    />
                                                </div>
                                            ) : (
                                                <div style={{ minWidth: '80px' }}></div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginTop: '1.5rem', marginBottom: '1rem' }}>
                            {['SIP', 'Lumpsum', 'Life Insurance', 'Gold', 'PPF', 'NPS', 'Direct Equity & ETFs', 'FD', 'RD', 'Other Investment'].map(type => (
                                <button key={type} className="btn btn-secondary" onClick={() => addAllocation(type === 'FD' ? 'Fixed Deposit' : (type === 'RD' ? 'Recurring Deposit' : type))} style={{ borderStyle: 'solid', background: 'var(--bg-card)', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                    <Plus size={14} style={{ marginRight: '4px' }} /> {type}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ 
                        textAlign: 'center', 
                        padding: '3rem', 
                        border: '2px dashed var(--border)', 
                        borderRadius: '12px',
                        color: 'var(--text-muted)',
                        marginBottom: '3rem'
                    }}>
                        <Wallet size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                        <p>No investments planned yet. Start allocating your {formatCurrency(proratedYear1Surplus)} surplus.</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
                            {['SIP', 'Lumpsum', 'Life Insurance', 'Gold', 'PPF', 'NPS', 'Direct Equity & ETFs', 'FD', 'RD', 'Other Investment'].map(type => (
                                <button key={type} className="btn btn-secondary" onClick={() => addAllocation(type === 'FD' ? 'Fixed Deposit' : (type === 'RD' ? 'Recurring Deposit' : type))} style={{ borderStyle: 'solid', background: 'var(--bg-main)', padding: '0.5rem 1rem' }}>
                                    <Plus size={16} /> {type}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Timeline Table */}
            <div style={{ marginBottom: '2.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>Yearly Allocation Timeline</h3>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', display: 'inline-block' }}>
                                <strong>Note:</strong> Net Investible Surplus for the current year is taken for <strong>{remainingMonths}</strong> months as you start planning with Finbrella from <strong>{['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][planStartMonth]}</strong>.
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '8px' }}>
                                <Filter size={14} /> View
                            </span>
                            <button onClick={() => setViewMode('5')} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: viewMode === '5' ? 'var(--primary)' : 'transparent', color: viewMode === '5' ? 'white' : 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>5 Yrs</button>
                            <button onClick={() => setViewMode('10')} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: viewMode === '10' ? 'var(--primary)' : 'transparent', color: viewMode === '10' ? 'white' : 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>10 Yrs</button>
                            <button onClick={() => setViewMode('all')} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: viewMode === 'all' ? 'var(--primary)' : 'transparent', color: viewMode === 'all' ? 'white' : 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>All</button>
                        </div>
                    </div>
                    
                    <div className="table-scroll-container card" style={{ padding: 0, overflowX: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                        <table className="modern-data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border)' }}>
                                <tr>
                                    <th rowSpan="2" style={{ padding: '0.75rem', position: 'sticky', left: 0, background: 'var(--bg-main)', zIndex: 10, textAlign: 'center' }}>Year</th>
                                    <th colSpan="2" style={{ borderLeft: '1px solid var(--border)', padding: '0.75rem', textAlign: 'center', color: 'var(--text-main)' }}>Investible Surplus</th>
                                    {dynamicColumns.length > 0 && <th colSpan={dynamicColumns.length} style={{ borderLeft: '1px solid var(--border)', padding: '0.75rem', textAlign: 'center', color: 'var(--text-main)' }}>Allocations</th>}
                                    <th colSpan="2" style={{ borderLeft: '1px solid var(--border)', padding: '0.75rem', textAlign: 'center', color: 'var(--text-main)' }}>Unallocated Surplus</th>
                                </tr>
                                <tr>
                                    <th style={{ borderLeft: '1px solid var(--border)', padding: '0.5rem', textAlign: 'right' }}>Yearly</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Monthly</th>
                                    {dynamicColumns.map(col => (
                                        <th key={col} style={{ borderLeft: '1px solid var(--border)', padding: '0.5rem', textAlign: 'right' }}>{col}</th>
                                    ))}
                                    <th style={{ borderLeft: '1px solid var(--border)', padding: '0.5rem', textAlign: 'right' }}>Yearly</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Monthly</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(viewMode === 'all' ? adjustedProjections : adjustedProjections.slice(0, parseInt(viewMode, 10))).map((row, idx) => {
                                    const allocationsByType = {};
                                    dynamicColumns.forEach(type => {
                                        allocationsByType[type] = row.activeAllocations
                                            ?.filter(a => a.type === type)
                                            .reduce((sum, a) => sum + (a.impactThisYear || 0), 0) || 0;
                                    });
                                    const monthlyDivisor = idx === 0 ? remainingMonths : 12;

                                    return (
                                        <tr key={row.year} style={{ background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-main)', borderBottom: '1px solid var(--border)' }} className="zebra-row">
                                            <td style={{ position: 'sticky', left: 0, background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-main)', fontWeight: 700, padding: '0.75rem', textAlign: 'center', boxShadow: '1px 0 0 var(--border)', zIndex: 5 }}>
                                                {row.year}
                                            </td>
                                            <td style={{ borderLeft: '1px dashed var(--border)', padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(row.netInvestibleSurplus)}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(row.netInvestibleSurplus / monthlyDivisor)}</td>
                                            
                                            {dynamicColumns.map(type => (
                                                <td key={type} style={{ borderLeft: '1px dashed var(--border)', padding: '0.75rem', textAlign: 'right', color: allocationsByType[type] > 0 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: allocationsByType[type] > 0 ? 600 : 400 }}>
                                                    {allocationsByType[type] > 0 ? formatCurrency(allocationsByType[type]) : '-'}
                                                </td>
                                            ))}
                                            
                                            <td style={{ borderLeft: '1px solid var(--border)', padding: '0.75rem', textAlign: 'right', fontWeight: 800, color: row.unallocatedSurplus < 0 ? '#ef4444' : 'var(--success)', background: row.unallocatedSurplus < 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)' }}>
                                                {formatCurrency(row.unallocatedSurplus)}
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', color: row.unallocatedSurplus < 0 ? '#ef4444' : 'var(--success)', background: row.unallocatedSurplus < 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)' }}>
                                                {formatCurrency(row.unallocatedSurplus / monthlyDivisor)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            {deficitInfo && hasAcknowledgedDeficit && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    padding: '1rem',
                    borderRadius: '8px',
                    marginTop: '2rem',
                    marginBottom: '-1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    animation: 'fadeIn 0.3s'
                }}>
                    <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                    <div>
                        <strong style={{ display: 'block', marginBottom: '4px' }}>Warning: Over-allocated!</strong>
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>
                            Your proposed investments exceed your accumulated cash flow{deficitInfo.month ? ` starting around ${deficitInfo.month} ${deficitInfo.year}` : ` in ${deficitInfo.year}`}. 
                            Please ensure you generate enough surplus before committing to these allocations.
                        </p>
                    </div>
                </div>
            )}

            <div className="sticky-action-bar">
                <button className="btn btn-secondary" onClick={onBack} style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ChevronLeft size={20} />
                    Back to Journey
                </button>
                <button 
                    className="btn btn-primary" 
                    onClick={onNext} 
                    disabled={!!deficitInfo}
                    style={{ 
                        opacity: deficitInfo ? 0.5 : 1, 
                        cursor: deficitInfo ? 'not-allowed' : 'pointer',
                        padding: '0.75rem 2rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        boxShadow: 'var(--shadow-md)'
                    }}
                >
                    Proceed to Portfolio Growth
                    <ChevronRight size={20} />
                </button>
            </div>

            <ContextualHelpPopup 
                isOpen={showHelpModal}
                onClose={() => setShowHelpModal(false)}
                title="Need Help in Allocating Surplus?"
                message="This section of the planning report is very important and strategic. Here, you can allocate your unassigned surplus into different investment options. Since these decisions can impact your returns, choosing the wrong allocation may lead to missed opportunities. It is recommended to consult a financial planner before making any changes. You can also reach out to Finbrella for guidance on how to best allocate your surplus."
                logoSrc={logo}
                supportContacts={{
                    email: "finbrellafpd@gmail.com",
                    phone: ["9785895737", "7046069999"]
                }}
                supportEmailContext={buildSupportEmailContextFromUser(familyMembers, user, 'Allocation')}
            />
        </div>
    );
};

export default AllocationModule;
