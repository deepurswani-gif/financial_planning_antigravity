import React, { useState } from 'react';
import { calculateFamilyProfile } from '../ProfileModule/ProfileLogic';
import { calculateCashFlow, formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { calculateNetWorth } from '../AssetModule/AssetLogic';
import { categorizeGoals } from '../GoalModule/GoalLogic';
import { Download, Printer, CheckCircle, TrendingUp, AlertTriangle, Clock, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { calculateYearlyInsuranceSummary, getInsuredNamesList, getPolicyColumns } from '../InsuranceModule/InsuranceLogic';

import FinancialPyramid from '../ProtectionGapModule/FinancialPyramid';
import ProtectionGapOutput from '../ProtectionGapModule/ProtectionGapOutput';
import { calculateProtectionGap } from '../ProtectionGapModule/ProtectionGapLogic';
import IncomeTaxModule from '../IncomeTaxModule/IncomeTaxModule';
import JourneyTable from '../JourneyModule/JourneyTable';
import GrowthModule from '../GrowthModule/GrowthModule';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';

const ReportView = ({ onBack }) => {
    const { familyMembers, income, setIncome, expenseCategories, assetCategories, liabilityCategories, goals, policies, investmentAllocations: allocations, goalMappings, contingencyFund, journeyAdjustments, journeyProjections: projections, calculatorInputs, hasSpouseIncome } = useFinancialPlan();
    const [isDashboardMode, setIsDashboardMode] = useState(true);
    const [activeGoalTab, setActiveGoalTab] = useState('short'); // For goal tabs

    const profileResults = calculateFamilyProfile(familyMembers);
    const cashFlowResults = calculateCashFlow(income, expenseCategories, familyMembers, hasSpouseIncome);
    const assetResults = calculateNetWorth(assetCategories, liabilityCategories);

    const validGoals = goals.filter(g => parseFloat(g.futureValue || g.presentValue || 0) > 0);
    const goalResults = categorizeGoals(validGoals);
    const insuranceSummary = calculateYearlyInsuranceSummary(policies);
    const policyColumns = getPolicyColumns(policies);
    const insuredNames = getInsuredNamesList(policies);

    const protectionGapResults = calculateProtectionGap(expenseCategories, policies, familyMembers);
    const proposedSIPs = allocations.filter(a => a.type === 'SIP');
    const proposedEquities = allocations.filter(a => a.type === 'Direct Equity & ETFs');

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="report-view max-w-7xl mx-auto" style={{ padding: '0 2rem 2rem 2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem', position: 'sticky', top: 0, zIndex: 9999, background: 'var(--bg-main)', padding: '1.5rem 0 1rem 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-card)', padding: '6px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <button onClick={() => setIsDashboardMode(true)} style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: 'none', background: isDashboardMode ? 'var(--primary)' : 'transparent', color: isDashboardMode ? 'white' : 'var(--text-main)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.9rem' }}>
                        Overview Dashboard
                    </button>
                    <button onClick={() => setIsDashboardMode(false)} style={{ padding: '0.6rem 1.25rem', borderRadius: '6px', border: 'none', background: !isDashboardMode ? 'var(--primary)' : 'transparent', color: !isDashboardMode ? 'white' : 'var(--text-main)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.9rem' }}>
                        Detailed Report
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-secondary" onClick={onBack} style={{ background: '#fff', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '0.6rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                        Back
                    </button>
                    <button className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', background: 'var(--primary)', color: 'white', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                        <Printer size={18} style={{ marginRight: '8px' }} /> Export PDF
                    </button>
                </div>
            </div>

            {isDashboardMode ? (
                <>
                        {/* New Premium Dashboard Header Area (Module 12) */}
            <div className="welcome-hero" style={{ marginBottom: '2rem' }}>
                <div className="hero-top">
                    <h1 className="hero-greeting">Welcome Back, {familyMembers[0]?.name?.split(' ')[0] || 'Client'}!</h1>
                    <p className="hero-date">{new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'})}</p>
                </div>
                
                <div className="top-kpis">
                    <div className="kpi-pill">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{opacity: 0.8}}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        <div className="kpi-pill-col">
                            <span className="kpi-label">Total Net Worth</span>
                            <span className="kpi-val">{formatCurrency(assetResults.netWorth)}</span>
                        </div>
                    </div>
                    <div className="kpi-pill">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{opacity: 0.8}}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                        <div className="kpi-pill-col">
                            <span className="kpi-label">Monthly Surplus</span>
                            <span className="kpi-val">{formatCurrency(cashFlowResults.surplus)}</span>
                        </div>
                    </div>
                    <div className="kpi-pill">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{opacity: 0.8}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                        <div className="kpi-pill-col">
                            <span className="kpi-label">Emergency Fund</span>
                            <span className="kpi-val">{formatCurrency(contingencyFund || 0)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards Grid */}
            <div className="grid-4" style={{ marginBottom: '2rem' }}>
                <div className="card hoverable">
                    <div className="stat-icon" style={{background: '#e0f2fe', color: 'var(--color-2)'}}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
                    </div>
                    <div className="stat-val">{formatCurrency(cashFlowResults.totalIncome)}</div>
                    <div className="stat-label" style={{ marginBottom: 'auto' }}>Total Monthly Income</div>
                    <div className="trend-badge up" style={{ fontSize: '0.8rem', alignSelf: 'flex-start', marginTop: '1rem' }}>On Track</div>
                </div>
                <div className="card hoverable">
                    <div className="stat-icon" style={{background: '#fee2e2', color: 'var(--destructive)'}}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
                    </div>
                    <div className="stat-val" style={{color: 'var(--destructive)'}}>{formatCurrency(cashFlowResults.totalExpenses)}</div>
                    <div className="stat-label" style={{ marginBottom: 'auto' }}>Total Outflows</div>
                    <div className="trend-badge down" style={{ fontSize: '0.8rem', alignSelf: 'flex-start', marginTop: '1rem' }}>Review Recommended</div>
                </div>
                <div className="card hoverable">
                    <div className="stat-icon" style={{background: '#fef3c7', color: 'var(--warning)'}}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3v12"/><path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M15 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>
                    </div>
                    <div className="stat-val">{validGoals.length}</div>
                    <div className="stat-label" style={{ marginBottom: 'auto' }}>Active Goals</div>
                    <div className="trend-badge up" style={{ background: '#f1f5f9', color: 'var(--text-muted)', fontSize: '0.8rem', alignSelf: 'flex-start', marginTop: '1rem' }}>Target Set</div>
                </div>
                <div className="card hoverable">
                    <div className="stat-icon" style={{background: '#fee2e2', color: 'var(--destructive)'}}>
                        <Shield size={24} />
                    </div>
                    <div className="stat-val" style={{ color: (protectionGapResults.self?.gap > 0) ? 'var(--destructive)' : 'var(--success)', fontSize: '1.5rem' }}>
                        {(protectionGapResults.self?.gap > 0) ? formatCurrency(protectionGapResults.self.gap) : '₹0'}
                    </div>
                    <div className="stat-label" style={{ marginBottom: 'auto' }}>Primary Cover Shortfall</div>
                    {(protectionGapResults.self?.gap > 0) ? (
                        <div className="trend-badge down" style={{ background: '#fef2f2', color: 'var(--destructive)', fontSize: '0.8rem', alignSelf: 'flex-start', marginTop: '1rem', display: 'flex', alignItems: 'center' }}><AlertCircle size={12} style={{marginRight:'4px'}}/> Action Required</div>
                    ) : (
                        <div className="trend-badge up" style={{ background: '#dcfce7', color: 'var(--success)', fontSize: '0.8rem', alignSelf: 'flex-start', marginTop: '1rem', display: 'flex', alignItems: 'center' }}><CheckCircle size={12} style={{marginRight:'4px'}}/> Fully Secured</div>
                    )}
                </div>
            </div>

            {/* Financial Summary & Goals Row */}
            <div className="grid-2" style={{ marginBottom: '3rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="card">
                        <h3 className="section-header" style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Income vs Expense</h3>
                        <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>Distribution of your monthly cash inflows.</p>
                        
                        {cashFlowResults.totalIncome > 0 ? (
                            <div className="h-stacked-bar-wrapper">
                                <div className="h-bar-labels">
                                    <span style={{ color: 'var(--success)' }}><span className="leg-dot" style={{ background: 'var(--success)' }}></span>Surplus ({Math.max(0, Math.round((cashFlowResults.surplus / cashFlowResults.totalIncome) * 100))}%)</span>
                                </div>
                                <div className="h-bar-track">
                                    <div className="h-bar-seg" style={{ width: `${Math.max(0, (cashFlowResults.surplus / cashFlowResults.totalIncome) * 100)}%`, background: '#10b981' }}>
                                        {Math.round((cashFlowResults.surplus / cashFlowResults.totalIncome) * 100) > 5 ? `${Math.round((cashFlowResults.surplus / cashFlowResults.totalIncome) * 100)}%` : ''}
                                    </div>
                                    <div className="h-bar-seg" style={{ width: `${(cashFlowResults.emiRatio || 0)}%`, background: '#f59e0b' }}>
                                        {Math.round(cashFlowResults.emiRatio || 0) > 5 ? `${Math.round(cashFlowResults.emiRatio || 0)}%` : ''}
                                    </div>
                                    <div className="h-bar-seg" style={{ width: `${(cashFlowResults.householdRatio || 0)}%`, background: '#ef4444' }}>
                                        {Math.round(cashFlowResults.householdRatio || 0) > 5 ? `${Math.round(cashFlowResults.householdRatio || 0)}%` : ''}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                    <span><span className="leg-dot" style={{ background: '#f59e0b' }}></span> EMI ({Math.round(cashFlowResults.emiRatio || 0)}%)</span>
                                    <span><span className="leg-dot" style={{ background: '#ef4444' }}></span> Household ({Math.round(cashFlowResults.householdRatio || 0)}%)</span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-muted" style={{fontSize: '0.85rem'}}>No income data available to display distribution.</p>
                        )}
                    </div>

                    <div className="grid-2" style={{ gap: '1.5rem', flex: 1 }}>
                        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                            <h3 className="section-header" style={{ fontSize: '1.05rem', marginBottom: '0' }}>Net Worth Growth</h3>
                            <div className="stat-val" style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>{formatCurrency(assetResults.netWorth)}</div>
                            <div className="sparkline-wrapper">
                                <div className="spark-gradient"></div>
                                <div className="spark-point"></div>
                            </div>
                        </div>

                        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                            <h3 className="section-header" style={{ fontSize: '1.05rem', marginBottom: '1.5rem' }}>Asset Allocation</h3>
                            {assetResults.totalAssets > 0 ? (() => {
                                const realEstateTotal = parseFloat(assetCategories.realEstate?.residential||0) + parseFloat(assetCategories.realEstate?.secondProperty||0) + parseFloat(assetCategories.realEstate?.landPlot||0);
                                const equityTotal = (parseFloat(assetCategories.investments?.equity||0) + parseFloat(assetCategories.investments?.mutualFunds||0) + parseFloat(assetCategories.equity?.stocks||0) + parseFloat(assetCategories.equity?.mfEquity||0));
                                const goldTotal = parseFloat(assetCategories.physical?.gold||0) || parseFloat(assetCategories.commodities?.gold||0) || parseFloat(assetCategories.other?.gold||0) || 0;
                                const otherTotal = Math.max(0, assetResults.totalAssets - realEstateTotal - equityTotal - goldTotal);
                                
                                const rePct = Math.round((realEstateTotal / assetResults.totalAssets) * 100);
                                const equityPct = Math.round((equityTotal / assetResults.totalAssets) * 100);
                                const goldPct = Math.round((goldTotal / assetResults.totalAssets) * 100);
                                const otherPct = Math.round((otherTotal / assetResults.totalAssets) * 100);
                                
                                return (
                                    <>
                                        <div className="donut-mini" style={{background: `conic-gradient(#6366f1 0% ${rePct}%, #8b5cf6 ${rePct}% ${rePct + equityPct}%, #f59e0b ${rePct + equityPct}% ${rePct + equityPct + goldPct}%, #94a3b8 ${rePct + equityPct + goldPct}% 100%)`}}>
                                            <div className="donut-hole"><span style={{fontSize:'1.1rem', fontWeight:800, color:'var(--text-main)'}}>{rePct}%</span><span style={{fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase'}}>Real Est</span></div>
                                        </div>
                                        <div className="legend-mini">
                                            <div className="leg-row">
                                                <span className="text-muted"><span className="leg-dot" style={{ background: '#6366f1' }}></span> Real Estate</span>
                                                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{rePct}%</span>
                                            </div>
                                            <div className="leg-row">
                                                <span className="text-muted"><span className="leg-dot" style={{ background: '#8b5cf6' }}></span> Equity</span>
                                                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{equityPct}%</span>
                                            </div>
                                            <div className="leg-row">
                                                <span className="text-muted"><span className="leg-dot" style={{ background: '#f59e0b' }}></span> Gold</span>
                                                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{goldPct}%</span>
                                            </div>
                                            <div className="leg-row">
                                                <span className="text-muted"><span className="leg-dot" style={{ background: '#94a3b8' }}></span> Others</span>
                                                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{otherPct}%</span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })() : <p className="text-muted" style={{fontSize: '0.85rem'}}>No asset data.</p>}
                        </div>
                    </div>
                </div>

                <div className="card" style={{ height: 'max-content' }}>
                    <div className="section-header" style={{ marginBottom: '1.5rem' }}>Goals Progress Tracker</div>
                    <div className="tabs">
                        <div className={`tab ${activeGoalTab === 'short' ? 'active' : ''}`} onClick={() => setActiveGoalTab('short')}>Short Term</div>
                        <div className={`tab ${activeGoalTab === 'medium' ? 'active' : ''}`} onClick={() => setActiveGoalTab('medium')}>Medium Term</div>
                        <div className={`tab ${activeGoalTab === 'long' ? 'active' : ''}`} onClick={() => setActiveGoalTab('long')}>Long Term</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {(goalResults[activeGoalTab] || []).slice(0, 4).map((g, i) => {
                            const mappingDict = goalMappings[g.id] || {};
                            const totalAssigned = Object.values(mappingDict).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                            const percent = Math.min(100, Math.round((totalAssigned / (g.futureCost || 1)) * 100));
                            return (
                                <div key={i} className="goal-flex">
                                    <div className="circ-prog" style={{ background: `conic-gradient(var(--success) 0% ${percent}%, var(--border) ${percent}% 100%)` }}>
                                        <div className="circ-hole">{percent}%</div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{g.name}</h4>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Target Year: {g.targetYear}</p>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                            <span style={{ fontWeight: 600 }}>{formatCurrency(totalAssigned)} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>Assigned</span></span>
                                            <span style={{ fontWeight: 600, color: 'var(--color-1)' }}>{formatCurrency(g.futureCost || g.presentValue || 0)} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>Target</span></span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {(!goalResults[activeGoalTab] || goalResults[activeGoalTab].length === 0) && <p className="text-muted" style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '8px' }}>No active goals in this bucket.</p>}
                    </div>
                </div>
            </div>

                {/* Family Profile Grid */}
                <div>
                    <h2 className="section-header" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>Family Overview</h2>
                    <div className="grid-3" style={{ marginBottom: '3rem' }}>
                        {profileResults.map((m, i) => {
                            const initials = m.name?.split(' ').map(n=>n[0]).join('').substring(0,2) || 'FM';
                            const isSelf = m.relation?.toLowerCase() === 'self';
                            const isChild = m.relation?.toLowerCase() === 'child';
                            
                            const avatarColor = isSelf ? 'var(--color-1)' : (isChild ? 'var(--warning)' : 'var(--color-3)');
                            const roleBg = isSelf ? 'rgba(0,169,242,0.1)' : (isChild ? 'rgba(245, 158, 11,0.1)' : 'rgba(120, 124, 254,0.1)');
                            const roleColor = isSelf ? 'var(--color-2)' : (isChild ? 'var(--warning)' : 'var(--color-3)');
                            
                            const targetAge = isChild ? 22 : (m.retirementAge || 60);
                            const yearsLeft = Math.max(0, targetAge - m.age);
                            const maxAgeText = isChild ? `Yrs to Independence: ${yearsLeft}` : `Working Yrs Left: ${yearsLeft}`;
                            const pct = Math.min(100, (m.age / targetAge) * 100);
                            
                            return (
                                <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div className="family-avatar" style={{ background: avatarColor }}>{initials.toUpperCase()}</div>
                                    <div className="fam-name">{m.name}</div>
                                    <div className="fam-role" style={{ background: roleBg, color: roleColor }}>{m.relation} {isSelf ? '• Primary Earner' : ''}</div>
                                    
                                    <div className="age-bar-wrapper">
                                        <div className="age-lbl"><span>Age: {m.age}</span><span>{maxAgeText}</span></div>
                                        <div className="age-track">
                                            <div className="age-fill" style={{ width: `${pct}%`, background: avatarColor }}></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                </>
            ) : (
                <div className="report-layout" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                    
                    <aside className="quick-nav-sidebar" style={{ position: 'sticky', top: '90px', width: '60px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '30px', padding: '1rem 0', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                        {[
                            {id: 1, title: 'Surplus Analysis'},
                            {id: 2, title: 'Protection Gap'},
                            {id: 3, title: 'Contingency Fund'},
                            {id: 4, title: 'Net Worth'},
                            {id: 5, title: 'Life Goals'},
                            {id: 6, title: 'Insurance Summary', cond: policies.length > 0},
                            {id: 7, title: 'Financial Adjustments', cond: journeyAdjustments && journeyAdjustments.length > 0},
                            {id: 8, title: 'Investment Strategy', cond: allocations.length > 0},
                            {id: 9, title: 'Goal Fulfillment', cond: validGoals.length > 0},
                            {id: 10, title: 'Income Tax'},
                            {id: 11, title: 'Cash Flow Projections', cond: projections && projections.length > 0},
                            {id: 12, title: 'Net Worth Projections'},
                            {id: 13, title: 'Disclaimer'}
                        ].filter(item => item.cond !== false).map(item => (
                            <a key={item.id} href={`#sec-${item.id}`} title={item.title} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-main)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s', border: '1px solid var(--border)' }}
                               onMouseOver={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                               onMouseOut={e => { e.currentTarget.style.background = 'var(--bg-main)'; e.currentTarget.style.color = 'var(--text-main)'; }}>
                                {item.id}
                            </a>
                        ))}
                    </aside>

                <div className="report-sections" style={{ flex: 1, minWidth: 0 }}>
                {/* 1. Cash Flow Summary */}
                <section id="sec-1" className="report-section card" style={{ marginTop: '1.5rem' }}>
                    <h3>1. Income - Expenses - Surplus Analysis</h3>
                    <div className="grid">
                        <div className="summary-box">
                            <label>Total Monthly Income</label>
                            <strong>{formatCurrency(cashFlowResults.totalIncome)}</strong>
                        </div>
                        <div className="summary-box">
                            <label>Household expenses + EMIs + Insurance</label>
                            <strong style={{ color: '#ef4444' }}>{formatCurrency(cashFlowResults.totalExpenses)}</strong>
                        </div>
                        <div className="summary-box">
                            <label>Monthly Surplus</label>
                            <strong style={{ color: cashFlowResults.surplus >= 0 ? 'var(--accent)' : '#ef4444' }}>{formatCurrency(cashFlowResults.surplus)}</strong>
                        </div>
                        <div className="summary-box">
                            <label>Savings and Investments</label>
                            <strong style={{ color: 'var(--primary)' }}>{formatCurrency(cashFlowResults.totalInvestments || Object.values(expenseCategories?.savings || {}).reduce((sum, v) => sum + (v ? (parseFloat(typeof v === 'object' ? v.amount : v) || 0) : 0), 0))}</strong>
                        </div>
                        <div className="summary-box" style={{ background: 'var(--bg-main)' }}>
                            <label>Disposable Income</label>
                            <strong style={{ color: cashFlowResults.disposableIncome >= 0 ? 'var(--accent)' : '#ef4444' }}>
                                {formatCurrency(cashFlowResults.disposableIncome)}
                            </strong>
                        </div>
                    </div>

                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.9rem', margin: 0 }}>
                            <strong>Note:</strong> {cashFlowResults.disposableIncome > 0
                                ? "We suggest allocating these surplus funds in diversified investment avenues to build wealth."
                                : "Your savings exceed your surplus. We suggest controlling lifestyle expenses and saving more to maintain a positive cash flow."}
                        </p>
                    </div>

                    <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                        <div className="ratio-item">
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Household & Lifestyle Ratio</span>
                            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{cashFlowResults.householdRatio.toFixed(1)}%</div>
                        </div>
                        <div className="ratio-item">
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>EMIs & Insurance Ratio</span>
                            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{cashFlowResults.emiRatio.toFixed(1)}%</div>
                        </div>
                        <div className="ratio-item">
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Savings & Investments Ratio</span>
                            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{cashFlowResults.savingsRatio.toFixed(1)}%</div>
                        </div>
                    </div>
                </section>

                {/* 2. Protection Gap Analysis */}
                <section id="sec-2" className="report-section card" style={{ marginTop: '1.5rem', breakBefore: 'page' }}>
                    <h3>2. Protection Gap Analysis</h3>
                    <FinancialPyramid 
                        isReadOnlyMode={true}
                        expenseCategories={expenseCategories}
                        policies={policies}
                        assetCategories={assetCategories}
                        calculatorInputs={calculatorInputs}
                        proposedSIPs={proposedSIPs}
                        proposedEquities={proposedEquities}
                        goals={validGoals}
                        goalMappings={goalMappings}
                        protectionGapResults={protectionGapResults}
                    />
                    <div style={{ marginTop: '2rem' }}>
                        <ProtectionGapOutput results={protectionGapResults} familyMembers={familyMembers} moduleName="Financial Plan Report" />
                    </div>
                </section>

                {/* 3. Contingency Fund Planning */}
                <section id="sec-3" className="report-section card" style={{ marginTop: '1.5rem' }}>
                    <h3>3. Contingency Fund Planning</h3>
                    <div style={{ padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Allocated Contingency Fund</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
                                {formatCurrency(contingencyFund || 0)}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Recommended Basis</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                Min 3 to 6 months of expenses
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. Net Worth Statement */}
                <section id="sec-4" className="report-section card" style={{ marginTop: '1.5rem' }}>
                    <h3>4. Net Worth Statement</h3>
                    <div className="grid">
                        <div>
                            <h4>Liabilities</h4>
                            <div className="stat-row-mini">
                                <span>Personal/Home Loans</span>
                                <span>{formatCurrency(assetResults.totalLiabilities)}</span>
                            </div>
                            <div className="stat-row" style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem' }}>
                                <span>Total Liabilities</span>
                                <strong>{formatCurrency(assetResults.totalLiabilities)}</strong>
                            </div>
                        </div>
                        <div>
                            <h4>Assets</h4>
                            {assetResults.assetBreakdown.map((a, i) => (
                                <div key={i} className="stat-row-mini">
                                    <span>{a.name}</span>
                                    <span>{formatCurrency(a.value)}</span>
                                </div>
                            ))}
                            <div className="stat-row" style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem' }}>
                                <span>Total Assets</span>
                                <strong>{formatCurrency(assetResults.totalAssets)}</strong>
                            </div>
                        </div>
                    </div>
                    <div className="stat-row" style={{ borderTop: '2px solid var(--primary)', marginTop: '1.5rem', paddingTop: '1rem', background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px' }}>
                        <span>Net Worth</span>
                        <strong style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>{formatCurrency(assetResults.netWorth)}</strong>
                    </div>
                </section>

                {/* 5. Life Goals */}
                <section id="sec-5" className="report-section card" style={{ marginTop: '1.5rem', breakBefore: 'page' }}>
                    <h3>5. Life Goals Projections</h3>
                    {['short', 'medium', 'long'].map(key => (
                        <div key={key} style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ textTransform: 'capitalize' }}>{key} Term Goals</h4>
                            {goalResults[key].length === 0 ? <p className="text-muted">None</p> : (
                                <table className="report-table">
                                    <thead>
                                        <tr>
                                            <th>Goal</th>
                                            <th>Target Year</th>
                                            <th>Present Value</th>
                                            <th>Future Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {goalResults[key].map((g, i) => (
                                            <tr key={i}>
                                                <td>{g.name}</td>
                                                <td>{g.targetYear}</td>
                                                <td>{formatCurrency(g.presentValue)}</td>
                                                <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{formatCurrency(g.futureCost)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    ))}
                </section>
                
                {/* 6. Insurance & Protection Summary */}
                {policies.length > 0 && (
                    <section id="sec-6" className="report-section card" style={{ marginTop: '1.5rem', breakBefore: 'page' }}>
                        <h3>6. Insurance & Protection Summary</h3>
                        
                        <div style={{ marginBottom: '2rem' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={18} /> Yearly Premium Outflow
                            </h4>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="report-table">
                                    <thead>
                                        <tr>
                                            <th>Year</th>
                                            {policyColumns.map(pc => (
                                                <th key={pc.id}>{pc.label} (Premium ₹)</th>
                                            ))}
                                            <th>Total Premium</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {insuranceSummary.filter(s => s.totalPremium > 0).map((s, i) => (
                                            <tr key={i}>
                                                <td>{s.year}</td>
                                                {policyColumns.map(pc => (
                                                    <td key={pc.id}>
                                                        {s.policyPremiums[pc.id] ? formatCurrency(s.policyPremiums[pc.id]) : '-'}
                                                    </td>
                                                ))}
                                                <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{formatCurrency(s.totalPremium)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Shield size={18} /> Yearly Coverage per Insured
                            </h4>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="report-table">
                                    <thead>
                                        <tr>
                                            <th>Year</th>
                                            {insuredNames.map(name => (
                                                <th key={name}>{name} (Coverage ₹)</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {insuranceSummary.filter(s => Object.keys(s.coverage).length > 0).map((s, i) => (
                                            <tr key={i}>
                                                <td>{s.year}</td>
                                                {insuredNames.map(name => (
                                                    <td key={name}>
                                                        {s.coverage[name] ? formatCurrency(s.coverage[name]) : '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                )}

                {/* 7. Planned Future Financial Adjustments */}
                {journeyAdjustments && journeyAdjustments.length > 0 && (
                    <section id="sec-7" className="report-section card" style={{ marginTop: '1.5rem', breakBefore: 'page' }}>
                        <h3>7. Planned Future Financial Adjustments</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Name / Category</th>
                                        <th>Type</th>
                                        <th>Start Date</th>
                                        <th>Duration</th>
                                        <th>Annual Impact</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {journeyAdjustments.map((adj, i) => {
                                        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                        const monthName = adj.startMonth ? monthNames[adj.startMonth - 1] : "Jan";
                                        return (
                                            <tr key={i}>
                                                <td>{adj.name || adj.loanCategory || 'Adjustment'}</td>
                                                <td style={{ textTransform: 'capitalize' }}>{adj.type || 'Expense'}</td>
                                                <td>{monthName} {adj.startYear}</td>
                                                <td>{adj.duration || 1} {adj.duration === 1 ? 'Year' : 'Years'}</td>
                                                <td style={{ color: '#ef4444', fontWeight: 600 }}>{formatCurrency(adj.amount || 0)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* 8. Investment Strategy */}
                {allocations.length > 0 && (
                    <section id="sec-8" className="report-section card" style={{ marginTop: '1.5rem' }}>
                        <h3>8. Planned Investment Strategy</h3>
                        <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                            Based on your investible surplus, the following investments are planned to achieve your financial objectives.
                        </p>
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Investment</th>
                                    <th>Type</th>
                                    <th>Annual Amount</th>
                                    <th>Expected CAGR</th>
                                    <th>Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allocations.map((a, i) => (
                                    <tr key={i}>
                                        <td>{a.name || a.type}</td>
                                        <td>{a.type}</td>
                                        <td>{formatCurrency(a.amount)}</td>
                                        <td>{a.expectedReturn}%</td>
                                        <td>{a.duration} Years (from {a.startYear})</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                )}

                {/* 9. Goal Fulfillment Roadmap */}
                {validGoals.length > 0 && (
                    <section id="sec-9" className="report-section card" style={{ marginTop: '1.5rem', breakBefore: 'page' }}>
                        <h3>9. Goal Fulfillment Roadmap</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {[...goalResults.short, ...goalResults.medium, ...goalResults.long].map((g, i) => {
                                const mappingDict = goalMappings[g.id] || {};
                                const selectedSources = Object.keys(mappingDict)
                                    .filter((key) => (parseFloat(mappingDict[key]) || 0) > 0);
                                const totalAssigned = Object.values(mappingDict).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                                const shortfall = (g.futureCost || 0) - totalAssigned;
                                const isFullyFunded = Math.round(shortfall) <= 0;
                                const hasAssignments = totalAssigned > 0;
                                
                                const hasLoan = selectedSources.includes('loan');
                                const hasRealEstate = selectedSources.includes('realEstate');

                                return (
                                    <div key={i} className="goal-fulfillment-card" style={{ 
                                        background: 'var(--bg-main)', 
                                        borderRadius: '16px', 
                                        border: `2px solid ${isFullyFunded ? 'var(--success)' : 'var(--border)'}`,
                                        overflow: 'hidden'
                                    }}>
                                        {/* Header Row */}
                                        <div style={{ 
                                            padding: '1.5rem', 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center',
                                            borderBottom: hasAssignments ? '1px solid var(--border)' : 'none',
                                            background: isFullyFunded ? 'rgba(52, 211, 153, 0.05)' : 'transparent',
                                            flexWrap: 'wrap',
                                            gap: '1rem'
                                        }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    {isFullyFunded ? <CheckCircle2 size={18} className="text-success" /> : <AlertCircle size={18} style={{ color: '#ef4444' }} />}
                                                    <h3 style={{ margin: 0, fontSize: '1.25rem', borderBottom: 'none' }}>{g.name || g.placeholder}</h3>
                                                </div>
                                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                    Target Year: <strong style={{ color: 'var(--text-main)' }}>{g.targetYear}</strong> | 
                                                    Target Cost: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(g.futureCost)}</strong>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', display: 'flex', gap: '1.5rem', background: 'var(--bg-card)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                                        Assigned
                                                    </div>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                                        {formatCurrency(totalAssigned)}
                                                    </div>
                                                </div>
                                                <div style={{ width: '1px', background: 'var(--border)' }}></div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                                        Pending Needed
                                                    </div>
                                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isFullyFunded ? 'var(--success)' : '#ef4444' }}>
                                                        {isFullyFunded ? 'Fully Funded' : formatCurrency(shortfall)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {hasAssignments && (
                                            <div style={{ padding: '1.5rem' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase' }}>
                                                    Maturity Value Allocated from Funding Sources
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                                    {selectedSources.map(sid => {
                                                        const hardcodedSources = [
                                                            { id: 'sip', name: 'SIP' },
                                                            { id: 'lumpsum', name: 'Lumpsum' },
                                                            { id: 'equity', name: 'Direct Equity & ETFs' },
                                                            { id: 'futureSurplus', name: 'Accumulated surplus not yet invested' },
                                                            { id: 'fd', name: 'Fixed Deposit (FD)' },
                                                            { id: 'rd', name: 'Recurring Deposit (RD)' },
                                                            { id: 'realEstate', name: 'Real Estate Investment' },
                                                            { id: 'loan', name: 'Loan' }
                                                        ];
                                                        const source = allocations.find(a => a.id === sid) || hardcodedSources.find(s => s.id === sid);
                                                        const amount = parseFloat(mappingDict[sid]) || 0;
                                                        
                                                        return (
                                                            <div key={sid} style={{
                                                                padding: '1rem',
                                                                borderRadius: '8px',
                                                                background: 'rgba(37, 99, 235, 0.05)',
                                                                border: '1px solid var(--primary)',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center'
                                                            }}>
                                                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{source?.name || sid}</div>
                                                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(amount)}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                
                                                {/* Explicit Roadmap Action Notes */}
                                                {(hasLoan || hasRealEstate) && (
                                                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px' }}>
                                                        <strong style={{ color: '#d97706', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}><AlertTriangle size={14} inline="true" /> ACTIONABLE NOTES:</strong>
                                                        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#b45309', fontSize: '0.8rem' }}>
                                                            {hasLoan && <li>This goal relies on a Loan. Please navigate to the <strong>Standalone Loan Calculators</strong> to verify EMIs fits within your projected Unallocated Surplus for the year {g.targetYear || (new Date().getFullYear() + Math.round(parseFloat(g.yearsToGoal) || 0))}.</li>}
                                                            {hasRealEstate && <li>This goal assumes liquidating Real Estate assets. Ensure the physical property is sold prior to {g.targetYear || (new Date().getFullYear() + Math.round(parseFloat(g.yearsToGoal) || 0))} to meet the funding schedule.</li>}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* 10. Income tax */}
                <section id="sec-10" className="report-section card" style={{ marginTop: '1.5rem', breakBefore: 'page' }}>
                    <IncomeTaxModule 
                        familyMembers={familyMembers}
                        income={income}
                        setIncome={setIncome}
                        isCalculatorMode={true}
                    />
                </section>

                {/* 11. Inflow - Outflow till Retirement */}
                {projections && projections.length > 0 && (
                    <section id="sec-11" className="report-section card" style={{ marginTop: '1.5rem', breakBefore: 'page' }}>
                        <h3>11. Inflow - Outflow till Retirement</h3>
                        <JourneyTable projections={projections} />
                    </section>
                )}

                {/* 12. Net Worth till Retirement */}
                <section id="sec-12" className="report-section card" style={{ marginTop: '1.5rem', breakBefore: 'page' }}>
                    <h3>12. Net Worth till Retirement</h3>
                    <GrowthModule 
                        isReadOnlyMode={true}
                        familyMembers={familyMembers}
                        assetCategories={assetCategories}
                        expenseCategories={expenseCategories}
                        allocations={allocations}
                        goals={validGoals}
                        calculatorInputs={calculatorInputs}
                        journeyProjections={projections}
                        policies={policies}
                        goalMappings={goalMappings}
                    />
                </section>

                {/* 13. Disclaimer */}
                <section id="sec-13" className="report-section card" style={{ marginTop: '1.5rem', breakBefore: 'page', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <h3 style={{ borderBottom: 'none', marginBottom: '1rem', color: 'var(--text-main)' }}>Disclaimer</h3>
                    <p style={{ marginBottom: '0.5rem' }}>This financial plan has been prepared by Finbrella based on the information provided by you. The projections, assumptions, and recommendations are based on current data, historical trends, and standard financial models.</p>
                    <p style={{ marginBottom: '0.5rem' }}>All future projections (including returns, inflation, and goal outcomes) are estimates only and may vary due to market movements, economic changes, policy changes, or other unforeseen factors.</p>
                    <p style={{ marginBottom: '0.5rem' }}>This report should be treated as a guidance document (roadmap) and not as a guarantee of results. It is recommended that the plan be reviewed periodically and updated as circumstances change.</p>
                    <p style={{ marginBottom: '0.5rem' }}>The accuracy of this report is dependent on the completeness and correctness of the information provided by you. Any inaccuracies or changes in inputs may significantly impact the outcomes.</p>
                    <p style={{ marginBottom: '0.5rem' }}>While due care has been taken in preparing this report using automated tools and algorithms, it may be subject to system limitations or errors.</p>
                    <p style={{ marginBottom: '0.5rem' }}>This report does not constitute legal, tax, or investment advice. You are advised to consult relevant professionals before making financial decisions.</p>
                    <p style={{ marginBottom: '0' }}>Finbrella shall not be held liable for any decisions taken based on this report.</p>
                </section>

                </div>
            </div>
            )}

            <style>{`
        .report-view {
          max-width: 1000px;
          margin: 0 auto;
          color: var(--text-main);
        }
        .stat-row {
          display: flex;
          justify-content: space-between;
          padding: 1rem 0;
          font-size: 1.1rem;
        }
        .stat-row-mini {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;
        }
        .report-table tr {
          transition: background-color 0.2s ease;
        }
        .report-table tbody tr:hover {
          background-color: var(--bg-main);
        }
        .report-table th {
          text-align: left;
          padding: 16px 12px;
          color: var(--text-muted);
          font-size: 0.75rem;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.5px;
          border-bottom: 2px solid var(--border);
        }
        .report-table td {
          padding: 16px 12px;
          border-bottom: 1px solid var(--border);
          font-size: 0.95rem;
          color: var(--text-main);
        }
        .summary-box {
          padding: 1.5rem;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--bg-card);
          text-align: center;
          transition: transform 0.2s;
        }
        .summary-box label {
          display: block;
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-bottom: 0.5rem;
        }
        .summary-box strong {
          font-size: 1.4rem;
        }
        .ratio-item {
            padding: 1rem;
            background: var(--bg-main);
            border-radius: 8px;
            border-left: 3px solid var(--primary);
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 1cm;
          }
          .btn, header, nav, .app-container > header, .quick-nav-sidebar, .dossier-tabs, .back-btn, .sidebar, .left-drawer, .admin-header, .admin-tabs {
            display: none !important;
          }
          .main-content-wrapper, .app-shell, .admin-content, .admin-dashboard, .dossier-container {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .card, .report-section {
            border: 1px solid #ddd !important;
            box-shadow: none !important;
            background: white !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .report-view {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .report-layout {
            display: block !important;
          }
          /* Force all containers wrapping tables to expand fully instead of scroll/cut */
          .report-section div[style*="overflow"] {
            overflow: visible !important;
            overflow-x: visible !important;
          }
          /* Optimize Table Layout for A4 */
          .report-table {
            width: 100% !important;
            table-layout: auto !important;
            margin-bottom: 2rem !important;
          }
          .report-table th, .report-table td {
            font-size: 0.75rem !important; /* Scale down so metrics fit horizontally */
            padding: 6px !important;
            word-wrap: break-word;
          }
          /* Strict Page Break Rules */
          .report-section {
            page-break-inside: auto;
          }
          .card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          /* Ensure headers stay with their tables */
          h3, h4 {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          /* Ensure table rows do not split in half */
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      
        .welcome-hero { background: linear-gradient(135deg, var(--color-1) 0%, var(--color-2) 100%); border-radius: 20px; padding: 2.5rem; color: white; box-shadow: 0 4px 20px rgba(0,0,0,0.05); position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 2rem; }
        .welcome-hero::after { content: ''; position: absolute; top: 0; right: 0; width: 100%; height: 100%; background: radial-gradient(circle at top right, rgba(255,255,255,0.15) 0%, transparent 60%); pointer-events: none; }
        .hero-top { position: relative; z-index: 2; }
        .hero-greeting { font-size: 2.25rem; font-weight: 700; margin-bottom: 0.5rem; line-height: 1.2; }
        .hero-date { font-size: 1rem; opacity: 0.9; }
        .top-kpis { display: flex; gap: 1.5rem; position: relative; z-index: 2; flex-wrap: wrap; }
        .kpi-pill { background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); padding: 1rem 1.5rem; border-radius: 12px; flex: 1; min-width: 200px; display: flex; align-items: center; gap: 1rem; }
        .kpi-pill-col { display: flex; flex-direction: column; }
        .kpi-label { font-size: 0.85rem; opacity: 0.9; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
        .kpi-val { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; }
        .section-header { font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; color: var(--text-main); display: flex; align-items: center; justify-content: space-between; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        .grid-3 { display: grid; grid-template-columns: repeat(minmax(250px, 1fr)); gap: 1.5rem; }
        .grid-4 { display: grid; grid-template-columns: repeat(minmax(200px, 1fr)); gap: 1.5rem; }
        @media (min-width: 768px) { .grid-3 { grid-template-columns: repeat(3, 1fr); } .grid-4 { grid-template-columns: repeat(4, 1fr); } }
        .card.hoverable:hover { transform: translateY(-4px); box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
        .stat-icon { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; }
        .stat-val { font-size: 2rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.25rem; }
        .stat-label { font-size: 0.95rem; color: var(--text-muted); font-weight: 500; margin-bottom: 1rem; }
        .h-stacked-bar-wrapper { margin-top: 1rem; }
        .h-bar-labels { display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.9rem; font-weight: 600; }
        .h-bar-track { height: 24px; background: var(--border); border-radius: 12px; display: flex; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); }
        .h-bar-seg { height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: 700; }
        .sparkline-wrapper { height: 80px; background: url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgNDAwIDEwMCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSJub25lIiBzdHJva2U9IiMxNzJEOUQiIHN0cm9rZS13aWR0aD0iMyIgZD0iTTAsODAgUTUwLDQwIDEwMCw1MCBUMjAwLDYwIFQzMDAsMzAgVDQwMCwxMCIgLz48L3N2Zz4=') no-repeat; background-size: 100% 100%; margin-top: auto; position: relative; }
        .spark-gradient { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgNDAwIDEwMCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBmaWxsPSJyZ2JhKDIzLDQ1LDE1NywwLjEpIiBkPSJNMiw4MCBROTAsNDAgMTAwLDUwIFQyMDAsNjAgVDMwMCwzMCBUNDAwLDEwIEw0MDAsMTAwIEwwLDEwMCBaIiAvPjwvc3ZnPg==') no-repeat; background-size: 100% 100%; }
        .spark-point { position: absolute; right: -4px; top: 6px; width: 12px; height: 12px; background: white; border: 3px solid var(--color-1); border-radius: 50%; box-shadow: 0 0 0 4px rgba(23,45,157,0.2); }
        .donut-mini { width: 120px; height: 120px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: auto; }
        .donut-hole { width: 70%; height: 70%; background: var(--bg-card); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column; }
        .legend-mini { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .leg-row { display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 500; }
        .leg-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 6px; }
        .family-avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--color-1); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.25rem; margin-bottom: 1rem; }
        .fam-name { font-size: 1.1rem; font-weight: 700; color: var(--text-main); }
        .fam-role { display: inline-block; padding: 4px 10px; background: rgba(0,169,242,0.1); color: var(--color-2); font-size: 0.75rem; border-radius: 12px; font-weight: 600; margin-top: 0.5rem; margin-bottom: 1.5rem; width: max-content; }
        .age-bar-wrapper { margin-top: auto; }
        .age-lbl { display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; }
        .age-track { width: 100%; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
        .age-fill { height: 100%; background: var(--color-3); }
        .tabs { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
        .tab { padding: 0.5rem 1.25rem; border-radius: 20px; font-size: 0.9rem; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-muted); transition: all 0.2s; }
        .tab.active { background: var(--color-1); color: white; border-color: var(--color-1); }
        .goal-flex { display: flex; align-items: center; gap: 1.5rem; width: 100%; }
        .circ-prog { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .circ-hole { width: 68px; height: 68px; background: var(--bg-card); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--text-main); font-size: 0.95rem; }
        `}</style>
        </div>
    );
};

export default ReportView;
