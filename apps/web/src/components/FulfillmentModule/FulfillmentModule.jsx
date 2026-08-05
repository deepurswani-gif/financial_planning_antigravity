import React, { useMemo, useState } from 'react';
import { Target, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Zap, Sparkles, HelpCircle } from 'lucide-react';
import ContextualHelpPopup from '../common/ContextualHelpPopup';
import logo from '../../assets/finbrella_logo.png';
import { useAuth } from '../../contexts/AuthContext';
import { buildSupportEmailContextFromUser } from '../../services/supportRequestEmailService';
import { computeSIPData } from '../Calculators/SIPCalculator';
import { computeLumpsumData } from '../Calculators/LumpsumCalculator';
import { computeEquityData } from '../Calculators/EquityCalculator';
import { computeFDData } from '../Calculators/FDCalculator';
import { computeRDData } from '../Calculators/RDCalculator';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import CurrencyInput from '../common/CurrencyInput';

const FulfillmentModule = ({ onNext, onBack }) => {
    const { familyMembers, calculatorInputs, expenseCategories, assetCategories, goals, investmentAllocations: allocations, goalMappings, setGoalMappings } = useFinancialPlan();
    const { user } = useAuth();
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState({});

    const toggleGroup = (groupName) => {
        setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
    };

    // 1. Filter and sort goals to only those with assigned values, arranged chronologically
    const activeGoals = useMemo(() => {
        return goals
            .filter(g => parseFloat(g.futureValue || g.presentValue || 0) > 0)
            .sort((a, b) => {
                const yearsA = parseFloat(a.yearsToGoal) || 0;
                const yearsB = parseFloat(b.yearsToGoal) || 0;
                return yearsA - yearsB;
            });
    }, [goals]);

    // Grouping Logic
    const groupedGoals = useMemo(() => {
        const groups = {};
        activeGoals.forEach(goal => {
            // Attempt to strip out trailing "Year X" or "(Year X)" to find a base group name
            const baseName = (goal.name || goal.placeholder || "Unnamed Goal")
                .replace(/\s*\(?Year\s*\d+\)?/gi, '')
                .replace(/\s*-\s*\d+$/g, '') 
                .trim();

            if (!groups[baseName]) {
                groups[baseName] = [];
            }
            groups[baseName].push(goal);
        });
        return groups;
    }, [activeGoals]);

    // 2. Compute calculator data once
    const currentYear = new Date().getFullYear();
    const sipExpectedReturns = calculatorInputs.sip?.rate ?? 12;
    const sipEvents = calculatorInputs.sip?.events || calculatorInputs.sip?.increments || [];
    const sipProposed = allocations.filter(a => a.type === 'SIP');
    
    const lumpsumDataInput = calculatorInputs.lumpsum ?? {};
    const lsProposed = allocations.filter(a => a.type === 'Lumpsum' || a.type === 'Lump Sum');

    const fdDataInput = calculatorInputs.fd ?? {};
    const fdProposed = allocations.filter(a => a.type === 'Fixed Deposit');

    const rdDataInput = calculatorInputs.rd ?? {};
    const rdProposed = allocations.filter(a => a.type === 'Recurring Deposit');

    const equityDataInput = calculatorInputs.equity ?? {};
    const eqProposed = allocations.filter(a => a.type === 'Direct Equity & ETFs');

    const defaultSIP = parseFloat(expenseCategories?.savings?.sip?.amount !== undefined ? expenseCategories.savings.sip.amount : expenseCategories?.savings?.sip) || 0;
    const defaultCorpus = parseFloat(assetCategories?.investments?.mutualFunds) || parseFloat(assetCategories?.equity?.mfEquity) || parseFloat(assetCategories?.equity?.stocks) || 0;

    const baseSIPAmount = defaultSIP; 
    const baseCurrentVal = defaultCorpus; 

    const baselineSipData = useMemo(() => computeSIPData(
        currentYear, baseSIPAmount, sipExpectedReturns, 50, baseCurrentVal, sipEvents, sipProposed, goalMappings, goals
    ), [currentYear, baseSIPAmount, sipExpectedReturns, baseCurrentVal, sipEvents, sipProposed, goalMappings, goals]);

    const baselineLumpsumData = useMemo(() => computeLumpsumData(
        parseFloat(lumpsumDataInput.amount) || 0, parseFloat(lumpsumDataInput.rate) || 12, 50, new Date().getMonth() + 1, currentYear, lumpsumDataInput.events || [], lsProposed, goalMappings, goals
    ), [currentYear, lumpsumDataInput, lsProposed, goalMappings, goals]);

    const baselineFdData = useMemo(() => computeFDData(
        fdProposed, parseFloat(fdDataInput.rate) || 7, fdDataInput.frequency || 'Quarterly'
    ).schedule || [], [fdDataInput, fdProposed]);

    const baselineRdData = useMemo(() => computeRDData(
        rdProposed, parseFloat(rdDataInput.rate) || 7
    ).schedule || [], [rdDataInput, rdProposed]);

    const baseEquityVal = parseFloat(assetCategories?.investments?.equity) || parseFloat(assetCategories?.equity?.stocks) || 0;
    const baselineEquityData = useMemo(() => computeEquityData(
        baseEquityVal, parseFloat(equityDataInput.rate) || 15, 50, new Date().getMonth() + 1, currentYear, equityDataInput.events || [], eqProposed, goalMappings, goals
    ), [currentYear, baseEquityVal, equityDataInput, eqProposed, goalMappings, goals]);

    const availableSources = useMemo(() => {
        return [
            { id: 'sip', name: 'SIP', type: 'SIP' },
            { id: 'lumpsum', name: 'Lumpsum', type: 'Lumpsum' },
            { id: 'equity', name: 'Direct Equity & ETFs', type: 'Equity' },
            { id: 'fd', name: 'Fixed Deposit (FD)', type: 'FD' },
            { id: 'rd', name: 'Recurring Deposit (RD)', type: 'RD' },
            { id: 'realEstate', name: 'Real Estate Investment', type: 'Real Estate' },
            { id: 'loan', name: 'Loan', type: 'Loan' }
        ];
    }, []);

    const handleAmountChange = (goalId, sourceId, amount) => {
        const currentGoalMap = goalMappings[goalId] || {};
        const val = amount == null ? NaN : Math.round(Number(amount));

        let newGoalMap = { ...currentGoalMap };
        if (isNaN(val) || val <= 0) {
            delete newGoalMap[sourceId];
        } else {
            newGoalMap[sourceId] = val;
        }
        setGoalMappings({ ...goalMappings, [goalId]: newGoalMap });
    };

    const handleQuickAllocate = (goalId, shortfall, availableDataBySource) => {
        if (shortfall <= 0) return;
        
        let remainingNeed = Math.round(shortfall);
        const currentGoalMap = { ...(goalMappings[goalId] || {}) };

        for (const source of availableSources) {
            if (remainingNeed <= 0) break;
            
            const ceiling = availableDataBySource[source.id];
            if (ceiling === 0) continue;

            const maxCanTake = ceiling === null ? remainingNeed : Math.round(ceiling);
            const toTake = Math.min(remainingNeed, maxCanTake);

            if (toTake > 0) {
                const currentAssigned = parseFloat(currentGoalMap[source.id]) || 0;
                currentGoalMap[source.id] = Math.round(currentAssigned + toTake);
                remainingNeed -= toTake;
            }
        }
        setGoalMappings({ ...goalMappings, [goalId]: currentGoalMap });
    };

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

    return (
        <div className="fulfillment-module fade-in">
            <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, var(--primary) 0%, #1e3a8a 100%)', color: 'white', borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '12px' }}>
                            <Target size={28} style={{ color: '#60a5fa' }} />
                        </div>
                        <div>
                            <h2 style={{ margin: '0 0 0.25rem', color: '#ffffff' }}>Step 11: Goal Fulfillment Roadmap</h2>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem' }}>Automate and assign portfolio values to fully fund your targets.</p>
                        </div>
                    </div>
                    <button className="btn btn-outline" onClick={() => setShowHelpModal(true)} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderColor: 'rgba(255,255,255,0.3)', color: '#fff', background: 'rgba(255,255,255,0.1)' }}>
                        <HelpCircle size={16} style={{ marginRight: '6px' }} /> Need Help
                    </button>
                </div>
            </div>

            {Object.keys(groupedGoals).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {Object.entries(groupedGoals).map(([groupName, groupGoals]) => {
                        const isExpanded = expandedGroups[groupName] || Object.keys(groupedGoals).length === 1; // Default open if only 1 group
                        
                        // Calculate aggregate group stats
                        let groupTarget = 0;
                        let groupAssigned = 0;
                        groupGoals.forEach(g => {
                            const fValue = g.futureValue || (parseFloat(g.presentValue) * Math.pow(1 + (parseFloat(g.inflationRate) || 6)/100, parseFloat(g.yearsToGoal)||0));
                            groupTarget += fValue;
                            const map = goalMappings[g.id] || {};
                            groupAssigned += Object.values(map).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                        });
                        const groupProgress = Math.min(100, (groupAssigned / groupTarget) * 100) || 0;
                        const isGroupFullyFunded = groupTarget > 0 && Math.round(groupTarget - groupAssigned) <= 0;

                        return (
                            <div key={groupName} className="goal-group-card" style={{ 
                                background: 'var(--bg-card)', 
                                borderRadius: '16px', 
                                border: `1px solid ${isGroupFullyFunded ? 'var(--success)' : 'var(--border)'}`,
                                boxShadow: isGroupFullyFunded ? '0 0 15px rgba(16, 185, 129, 0.1)' : '0 4px 15px rgba(0,0,0,0.03)',
                                overflow: 'hidden',
                                transition: 'all 0.3s ease'
                            }}>
                                {/* Accordion Header */}
                                <div 
                                    onClick={() => toggleGroup(groupName)}
                                    style={{ 
                                        padding: '1.25rem 1.5rem', 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        background: isGroupFullyFunded ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                                        userSelect: 'none'
                                    }}
                                >
                                    <div style={{ flex: '1 1 auto', marginRight: '2rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                            {isGroupFullyFunded ? <CheckCircle2 size={20} className="text-success" /> : <Target size={20} className="text-primary" />}
                                            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>{groupName}</h3>
                                            <span style={{ fontSize: '0.75rem', background: 'var(--bg-main)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                                {groupGoals.length} {groupGoals.length === 1 ? 'Phase' : 'Phases'}
                                            </span>
                                        </div>
                                        {/* Group Progress Bar */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '10px' }}>
                                            <div style={{ flex: 1, height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ 
                                                    height: '100%', 
                                                    width: `${groupProgress}%`, 
                                                    background: isGroupFullyFunded ? '#10b981' : 'var(--primary)',
                                                    transition: 'width 0.5s ease'
                                                }} />
                                            </div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', minWidth: '60px', textAlign: 'right' }}>
                                                {formatCurrency(groupAssigned)} / {formatCurrency(groupTarget)}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        {isExpanded ? <ChevronUp size={24} color="var(--text-muted)" /> : <ChevronDown size={24} color="var(--text-muted)" />}
                                    </div>
                                </div>

                                {/* Accordion Body */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid var(--border)', padding: '1.5rem', background: 'var(--bg-main)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        {groupGoals.map(goal => {
                                            const goalYear = currentYear + Math.round(parseFloat(goal.yearsToGoal) || 0);
                                            const futureValue = goal.futureValue || (parseFloat(goal.presentValue) * Math.pow(1 + (parseFloat(goal.inflationRate) || 6) / 100, parseFloat(goal.yearsToGoal) || 0));
                                            
                                            const currentGoalMap = goalMappings[goal.id] || {};
                                            const totalAssigned = Object.values(currentGoalMap).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                                            const shortfall = futureValue - totalAssigned;
                                            
                                            const isFullyFunded = Math.round(shortfall) <= 0;
                                            const isOverfunded = Math.round(shortfall) < 0;
                                            const isExactlyFunded = Math.round(shortfall) === 0;

                                            const eRow = baselineEquityData.find(r => r.year === goalYear);
                                            const remainingEquity = eRow ? eRow.valueAfterWithdrawal : 0;

                                            const sRow = baselineSipData.find(r => r.year === goalYear);
                                            const lRow = baselineLumpsumData.find(r => r.year === goalYear);
                                            const fRow = baselineFdData.find(r => r.year === goalYear);
                                            const rRow = baselineRdData.find(r => r.year === goalYear);

                                            const availableData = {
                                                'sip': sRow ? Math.round(sRow.valueAfterWithdrawal) : 0,
                                                'lumpsum': lRow ? Math.round(lRow.valueAfterWithdrawal) : 0,
                                                'equity': Math.round(remainingEquity),
                                                'fd': fRow ? Math.round(fRow.maturityValue || 0) : 0,
                                                'rd': rRow ? Math.round(rRow.maturityValue || 0) : 0,
                                                'realEstate': Math.round(parseFloat(assetCategories?.realEstate?.landPlot) || 0),
                                                'loan': null 
                                            };

                                            return (
                                                <div key={goal.id} style={{ 
                                                    background: 'var(--bg-card)', 
                                                    borderRadius: '12px', 
                                                    border: isFullyFunded ? '1px solid #10b981' : '1px solid var(--border)',
                                                    padding: '1.25rem',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}>
                                                    {isFullyFunded && (
                                                        <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'rgba(16, 185, 129, 0.1)', width: '100px', height: '100px', borderRadius: '50%', zIndex: 0 }} />
                                                    )}
                                                    
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', position: 'relative', zIndex: 1 }}>
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                {goal.name} {isFullyFunded && <Sparkles size={16} color="#10b981" />}
                                                            </div>
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Target Year: {goalYear} | Target: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(futureValue)}</strong></div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{isOverfunded ? 'Overfunded by' : (isExactlyFunded ? 'Status' : 'Shortfall')}</div>
                                                                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: isFullyFunded ? '#10b981' : '#ef4444' }}>
                                                                    {isOverfunded ? formatCurrency(Math.abs(shortfall)) : (isExactlyFunded ? 'Fully Funded' : formatCurrency(shortfall))}
                                                                </div>
                                                            </div>
                                                            {!isFullyFunded && (
                                                                <button 
                                                                    onClick={() => handleQuickAllocate(goal.id, shortfall, availableData)}
                                                                    style={{ 
                                                                        background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' 
                                                                    }}
                                                                >
                                                                    <Zap size={14} /> Auto-Fill
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px', position: 'relative', zIndex: 1 }}>
                                                        {availableSources.map(source => {
                                                            const assignedVal = parseFloat(currentGoalMap[source.id]) || 0;
                                                            const isAssigned = assignedVal > 0;
                                                            
                                                            // Hide FD/RD if nothing is natively available and none is assigned
                                                            if ((source.id === 'fd' || source.id === 'rd') && (availableData[source.id] <= 0 && !isAssigned)) {
                                                                return null;
                                                            }

                                                            const ceiling = availableData[source.id] !== null ? availableData[source.id] : null;
                                                            const maxNeeded = shortfall > 0 ? shortfall + assignedVal : assignedVal;
                                                            const absoluteMax = ceiling !== null ? Math.min(maxNeeded, ceiling) : maxNeeded;
                                                            const roundedMax = Math.round(absoluteMax);

                                                            return (
                                                                <div key={source.id} style={{ 
                                                                    background: isAssigned ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-main)',
                                                                    border: isAssigned ? '1px solid rgba(37, 99, 235, 0.4)' : '1px solid var(--border)',
                                                                    borderRadius: '8px',
                                                                    padding: '12px',
                                                                    transition: 'all 0.2s ease',
                                                                }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem' }}>
                                                                        <span style={{ fontWeight: 600, color: isAssigned ? 'var(--primary)' : 'var(--text-main)' }}>{source.name}</span>
                                                                        {ceiling !== null && <span style={{ color: 'var(--success)' }}>Avail: {formatCurrency(ceiling)}</span>}
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <button 
                                                                            onClick={() => handleAmountChange(goal.id, source.id, roundedMax)}
                                                                            style={{
                                                                                padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                                                                background: isAssigned ? 'var(--primary)' : 'var(--border)',
                                                                                color: isAssigned ? 'white' : 'var(--text-main)',
                                                                                border: 'none'
                                                                            }}
                                                                        >
                                                                            {isAssigned ? 'MAX' : 'Assign'}
                                                                        </button>
                                                                        <div style={{ flex: 1 }}>
                                                                            <CurrencyInput
                                                                                value={currentGoalMap[source.id] || ''}
                                                                                onValueChange={(v) => handleAmountChange(goal.id, source.id, v)}
                                                                                max={Math.max(0, roundedMax)}
                                                                                placeholder="0"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                    <Target size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <h3>No Actionable Goals Available</h3>
                    <p>Assign targets in your Goals module to begin distribution.</p>
                </div>
            )}

            <div className="sticky-action-bar">
                <button className="btn btn-secondary" onClick={onBack} style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ChevronLeft size={20} /> Back to Growth Tracker
                </button>
                <button className="btn btn-primary" onClick={onNext} style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-md)' }}>
                    Proceed to Final Overview <ChevronRight size={20} />
                </button>
            </div>

            <ContextualHelpPopup 
                isOpen={showHelpModal}
                onClose={() => setShowHelpModal(false)}
                title="Need Help with Goal Alignment?"
                message={
                    <>
                        In this module, you can see your goals along with the current value of your investments. To achieve a goal, you can assign funds from the investments available to you. As you allocate an amount, the progress bar will move to show how much of the goal is covered.
                        <br/><br/>
                        On the right side of each goal, you will also see the shortfall — the remaining amount that still needs to be assigned.
                        <br/><br/>
                        You can also contact Finbrella for guidance on how to allocate your funds in the most effective way.
                    </>
                }
                logoSrc={logo}
                supportContacts={{
                    email: "finbrellafpd@gmail.com",
                    phone: ["9785895737", "7046069999"]
                }}
                supportEmailContext={buildSupportEmailContextFromUser(familyMembers, user, 'Roadmap/Fulfillment')}
            />
        </div>
    );
};

export default FulfillmentModule;
