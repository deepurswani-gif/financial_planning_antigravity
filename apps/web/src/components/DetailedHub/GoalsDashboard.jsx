import React, { useState, useEffect } from 'react';
import { Target, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Save, Plus } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { getGoalIcon } from '../DetailedFlow/goalIcons';
import { isConfiguredGoal, initializeGoalsFromFamily } from '../DetailedFlow/goalsDetailSync';
import CurrencyInput from '../common/CurrencyInput';
import YearsInput from '../common/YearsInput';

const GoalsDashboard = ({ hideTitle = false }) => {
    const { familyMembers, goals, setGoals, loading } = useFinancialPlan();
    const [expandedGoalId, setExpandedGoalId] = useState(null);
    const [editYears, setEditYears] = useState('');
    const [editValue, setEditValue] = useState('');
    const [isAddingCustom, setIsAddingCustom] = useState(false);
    const [customGoalName, setCustomGoalName] = useState('');

    useEffect(() => {
        if (loading) return;
        setGoals((prev) => initializeGoalsFromFamily(familyMembers, prev));
    }, [loading, familyMembers, setGoals]);

    const handleExpand = (goal) => {
        if (expandedGoalId === goal.id) {
            setExpandedGoalId(null);
        } else {
            setExpandedGoalId(goal.id);
            setEditYears(goal.yearsToGoal || '');
            setEditValue(goal.presentValue || '');
        }
    };

    const handleSave = (goalId) => {
        setGoals((prev) => prev.map((g) => {
            if (g.id !== goalId) return g;
            const next = { ...g, yearsToGoal: editYears, presentValue: editValue };
            if (g.id.startsWith('edu_')) {
                next.totalCourseCost = editValue;
            }
            return next;
        }));
        setExpandedGoalId(null);
    };

    const handleAddCustomGoal = () => {
        if (!customGoalName.trim()) return;
        const newGoal = {
            id: `custom_${Date.now()}`,
            name: customGoalName.trim(),
            isPredefined: false,
            inflationRate: 6
        };
        setGoals([...goals, newGoal]);
        setIsAddingCustom(false);
        setCustomGoalName('');
        setExpandedGoalId(newGoal.id);
        setEditYears('');
        setEditValue('');
    };

    if (loading) return null;

    // Filter to show predefined goals and any custom goals that exist
    const displayGoals = goals.filter(g => g.isPredefined || isConfiguredGoal(g) || g.name);

    // Sort so configured (planned) goals appear first
    const sortedGoals = [...displayGoals].sort((a, b) => {
        const aConf = isConfiguredGoal(a);
        const bConf = isConfiguredGoal(b);
        if (aConf === bConf) return 0;
        return aConf ? -1 : 1;
    });

    return (
        <div style={{ marginTop: hideTitle ? '0' : '3rem' }}>
            {!hideTitle && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <Target size={24} style={{ color: 'var(--primary)' }} />
                    <h2 style={{ fontSize: '1.25rem', color: '#111', margin: 0 }}>My Dreams & Goals</h2>
                </div>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {sortedGoals.map((goal) => {
                    const Icon = getGoalIcon(goal);
                    const isConfigured = isConfiguredGoal(goal);
                    const isExpanded = expandedGoalId === goal.id;

                    return (
                        <div 
                            key={goal.id} 
                            style={{ 
                                background: '#fff', 
                                borderRadius: '12px', 
                                border: isExpanded ? '2px solid #1e3a8a' : '1px solid #1e3a8a',
                                overflow: 'hidden',
                                transition: 'all 0.2s ease',
                                boxShadow: isExpanded ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                            }}
                        >
                            {/* Card Header (Clickable) */}
                            <div 
                                onClick={() => handleExpand(goal)}
                                style={{ 
                                    padding: '1.25rem', 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    background: isExpanded ? '#f8fafc' : 'transparent'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ 
                                        width: '40px', 
                                        height: '40px', 
                                        borderRadius: '8px', 
                                        background: isConfigured ? '#ecfdf5' : '#f1f5f9', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        color: isConfigured ? '#10b981' : '#64748b'
                                    }}>
                                        <Icon size={20} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111' }}>{goal.name}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                                            {isConfigured ? (
                                                <><CheckCircle2 size={12} color="#10b981" /><span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 500 }}>Planned</span></>
                                            ) : (
                                                <><AlertCircle size={12} color="#94a3b8" /><span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Needs Planning</span></>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ color: '#94a3b8' }}>
                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <div style={{ padding: '0 1.25rem 1.25rem 1.25rem', background: '#f8fafc' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                                                Years to achieve
                                            </label>
                                            <YearsInput
                                                className="conversational-input"
                                                placeholder="e.g. 5"
                                                value={editYears}
                                                onValueChange={(v) => setEditYears(v == null ? '' : String(v))}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                                                Cost in today's value
                                            </label>
                                            <CurrencyInput
                                                className="conversational-input"
                                                placeholder="e.g. 500000"
                                                value={editValue}
                                                onValueChange={(v) => setEditValue(v == null ? '' : String(v))}
                                            />
                                        </div>
                                        <button 
                                            className="btn btn-primary" 
                                            onClick={() => handleSave(goal.id)}
                                            style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                                        >
                                            <Save size={16} /> Save Goal
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Add Custom Goal Card */}
                <div style={{ 
                    background: '#fff', 
                    borderRadius: '12px', 
                    border: '1px dashed #1e3a8a', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    padding: '1.25rem', 
                    justifyContent: 'center',
                    minHeight: '88px'
                }}>
                    {!isAddingCustom ? (
                        <button 
                            onClick={() => setIsAddingCustom(true)}
                            style={{ 
                                width: '100%', 
                                height: '100%', 
                                background: 'transparent', 
                                border: 'none', 
                                color: '#64748b', 
                                fontWeight: 600, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '0.5rem', 
                                cursor: 'pointer' 
                            }}
                        >
                            <Plus size={20} />
                            Add Custom Goal
                        </button>
                    ) : (
                        <div>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block', color: '#111' }}>
                                Goal Name
                            </label>
                            <input 
                                type="text"
                                value={customGoalName}
                                onChange={(e) => setCustomGoalName(e.target.value)}
                                placeholder="e.g. Start a Business"
                                className="conversational-input"
                                style={{ width: '100%', marginBottom: '1rem', border: '1px solid #eaeaea', borderRadius: '8px', padding: '0.5rem' }}
                                autoFocus
                            />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button 
                                    className="btn btn-secondary" 
                                    onClick={() => {
                                        setIsAddingCustom(false);
                                        setCustomGoalName('');
                                    }} 
                                    style={{ flex: 1, padding: '0.5rem', background: '#f1f5f9', border: 'none', borderRadius: '8px', fontWeight: 600 }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    className="btn btn-primary" 
                                    onClick={handleAddCustomGoal} 
                                    disabled={!customGoalName.trim()}
                                    style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', fontWeight: 600 }}
                                >
                                    Add Goal
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GoalsDashboard;
