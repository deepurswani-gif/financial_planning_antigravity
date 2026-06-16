import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, Sparkles,
    Plus, Trash2, Home, Car, Plane, GraduationCap, Heart, 
    Award, PenLine, Target, Check
} from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { calculateFutureCost } from '../GoalModule/GoalLogic';

/* ─── Screen constants ─── */
const INTRO   = 0;
const SELECT  = 1;
const YEARS   = 2;
const VALUE   = 3;
const SUMMARY = 4;
const SCREEN_COUNT = 5;

/* ─── Goal templates ─── */
const goalTemplates = [
    { id: 'education', label: 'Child Education', icon: GraduationCap, defaultInflation: 8 },
    { id: 'retirement', label: 'Retirement', icon: Award, defaultInflation: 6 },
    { id: 'car', label: 'Car Purchase', icon: Car, defaultInflation: 6 },
    { id: 'vacation', label: 'Vacation', icon: Plane, defaultInflation: 6 },
    { id: 'home', label: 'Buying a Home', icon: Home, defaultInflation: 6 },
    { id: 'marriage', label: 'Marriage Planning', icon: Heart, defaultInflation: 8 },
];

const getGoalIcon = (name) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('educat')) return GraduationCap;
    if (lower.includes('retire')) return Award;
    if (lower.includes('car') || lower.includes('vehic')) return Car;
    if (lower.includes('vacat') || lower.includes('tour') || lower.includes('trip')) return Plane;
    if (lower.includes('home') || lower.includes('flat') || lower.includes('house')) return Home;
    if (lower.includes('marriage') || lower.includes('wed')) return Heart;
    return Target;
};

const formatInr = (val) => {
    if (!val || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
};

/* ─── PAN transition variants ─── */
const panVariants = {
    enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir < 0 ? '100%' : '-100%', opacity: 0 }),
};
const panTransition = { duration: 0.5, ease: [0.45, 0, 0.15, 1] };

/* ─── Typewriter hook ─── */
const useTypewriter = (text, speed = 25) => {
    const [displayed, setDisplayed] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    useEffect(() => {
        setDisplayed(''); setIsComplete(false);
        if (!text) return;
        let i = 0;
        const t = setInterval(() => { setDisplayed(text.slice(0, ++i)); if (i >= text.length) { clearInterval(t); setIsComplete(true); } }, speed);
        return () => clearInterval(t);
    }, [text, speed]);
    return { displayed, isComplete };
};

/* ─── Narrative overlay ─── */
const NarrativeOverlay = ({ text, onContinue }) => {
    const { displayed, isComplete } = useTypewriter(text);
    return (
        <div className="narrative-overlay">
            <div className="narrative-card">
                <div className="narrative-icon"><Sparkles size={28} /></div>
                <p className="narrative-text">
                    "{displayed}"
                    {!isComplete && <span className="typewriter-cursor" />}
                </p>
                {isComplete && (
                    <motion.button className="narrative-continue-btn" onClick={onContinue}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        Continue <ArrowRight size={18} />
                    </motion.button>
                )}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
const SummaryGoals = () => {
    const { goals, setGoals, savePlanData, summaryReportGeneratedAt, markReportGenerated } = useFinancialPlan();
    const navigate = useNavigate();

    // Only count goals that have actual user-entered values (years and present cost)
    const validGoals = goals.filter(g => g.presentValue && g.yearsToGoal);

    // Start at SUMMARY if they already have valid goals (from legacy flow or previous edits), otherwise start at INTRO
    const [screen, setScreen] = useState(validGoals.length > 0 ? SUMMARY : INTRO);
    const [direction, setDirection] = useState(1);
    const [editingGoalIndex, setEditingGoalIndex] = useState(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [customGoalName, setCustomGoalName] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [showNarrative, setShowNarrative] = useState(false);

    /* ── Navigation helpers ── */
    const goTo = useCallback((target, dir = 1) => {
        setDirection(dir);
        setScreen(target);
    }, []);

    /* ── Goal CRUD ── */
    const addGoalFromTemplate = (tmpl) => {
        setSelectedTemplateId(tmpl.id);

        // If user already selected a template on this screen, replace it instead of adding another
        if (editingGoalIndex !== null && screen === SELECT) {
            const updated = [...goals];
            updated[editingGoalIndex] = { ...updated[editingGoalIndex], name: tmpl.label, templateId: tmpl.id, inflationRate: tmpl.defaultInflation };
            setGoals(updated);
            return;
        }

        const id = `goal_${Date.now()}`;
        const newGoal = { id, name: tmpl.label, templateId: tmpl.id, presentValue: '', yearsToGoal: '', inflationRate: tmpl.defaultInflation, courseDuration: 1 };
        const updated = [...goals, newGoal];
        setGoals(updated);
        setEditingGoalIndex(updated.length - 1);
        // Stay on SELECT — user advances via right chevron
    };

    const addCustomGoal = () => {
        if (!customGoalName.trim()) return;
        const id = `goal_${Date.now()}`;
        const newGoal = { id, name: customGoalName.trim(), presentValue: '', yearsToGoal: '', inflationRate: 6, courseDuration: 1 };
        const updated = [...goals, newGoal];
        setGoals(updated);
        setEditingGoalIndex(updated.length - 1);
        setShowCustomInput(false);
        setCustomGoalName('');
        goTo(YEARS);
    };

    const handleGoalChange = (field, value) => {
        if (editingGoalIndex === null || !goals[editingGoalIndex]) return;
        const updated = [...goals];
        updated[editingGoalIndex] = { ...updated[editingGoalIndex], [field]: value };
        setGoals(updated);
    };

    const removeGoal = (goalId) => {
        setGoals(goals.filter(g => g.id !== goalId));
    };

    const handleSaveGoal = () => {
        setEditingGoalIndex(null);
        goTo(SUMMARY);
    };

    const handleAddAnother = () => {
        setEditingGoalIndex(null);
        setShowCustomInput(false);
        setCustomGoalName('');
        setSelectedTemplateId(null);
        goTo(SELECT);
    };

    const hasGeneratedReport = Boolean(summaryReportGeneratedAt);

    const handleViewSummary = () => {
        if (hasGeneratedReport) {
            handleOpenReport(false);
            return;
        }
        setShowNarrative(true);
    };

    const handleOpenReport = async (markGenerated = true) => {
        if (savePlanData) {
            try { await savePlanData(); } catch (e) { console.error('Save failed on nav', e); }
        }
        if (markGenerated) {
            await markReportGenerated();
        }
        setShowNarrative(false);
        navigate('/summary-report/money_story');
    };

    const handleNarrativeDone = () => handleOpenReport(true);

    /* ── Chevron logic ── */
    const editingGoal = editingGoalIndex !== null ? goals[editingGoalIndex] : null;

    const canGoLeft  = screen > INTRO;
    const canGoRight = screen < SUMMARY;

    const handleLeft = () => {
        if (!canGoLeft) return;
        if (screen === SUMMARY && editingGoalIndex !== null && goals[editingGoalIndex]) {
            goTo(VALUE, -1);
        } else if (screen === SUMMARY) {
            // If no goal is being edited, go back to select
            goTo(SELECT, -1);
        } else {
            goTo(screen - 1, -1);
        }
    };

    const handleRight = () => {
        if (!canGoRight) return;
        if (screen === INTRO) goTo(SELECT);
        if (screen === SELECT) {
            if (editingGoalIndex !== null) {
                setSelectedTemplateId(null);
                goTo(YEARS);
            } else {
                goTo(SUMMARY);
            }
        }
        if (screen === YEARS) goTo(VALUE);
        if (screen === VALUE) {
            handleSaveGoal();
        }
    };

    /* ── Keyboard nav ── */
    useEffect(() => {
        const onKey = (e) => {
            if (showNarrative) return;
            if (e.key === 'ArrowRight' && canGoRight) handleRight();
            if (e.key === 'ArrowLeft'  && canGoLeft)  handleLeft();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [screen, canGoLeft, canGoRight, showNarrative]);

    /* ── Determine which dots to show ── */
    // Only show dots when user is in the add-goal flow (SELECT → YEARS → VALUE)
    const showDots = screen >= SELECT && screen <= SUMMARY;
    const totalDots = validGoals.length > 0 ? SCREEN_COUNT : 4; // hide SUMMARY dot until a goal exists

    /* ── Narrative text ── */
    const narrativeText = "Perfect. I now have enough clarity to build your complete financial reality map and identify opportunities to improve your future financial outcomes.";

    /* ═══════════ RENDER ═══════════ */
    return (
        <>
            {/* Narrative overlay */}
            <AnimatePresence>
                {showNarrative && <NarrativeOverlay text={narrativeText} onContinue={handleNarrativeDone} />}
            </AnimatePresence>

            {/* ── Chevron Arrows ── */}
            <button
                className={`nav-chevron nav-chevron-left ${!canGoLeft ? 'hidden' : ''}`}
                onClick={handleLeft}
                aria-label="Previous"
            >
                <ChevronLeft size={24} />
            </button>
            <button
                className={`nav-chevron nav-chevron-right ${!canGoRight ? 'hidden' : ''}`}
                onClick={handleRight}
                aria-label="Next"
            >
                <ChevronRight size={24} />
            </button>

            {/* ── Main Content ── */}
            <div style={{ width: '100%', maxWidth: '650px', position: 'relative', minHeight: '400px',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={screen}
                        custom={direction}
                        variants={panVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={panTransition}
                        style={{ width: '100%' }}
                    >
                        {/* ──────── SCREEN 0: INTRO ──────── */}
                        {screen === INTRO && (
                            <div className="question-container">
                                <p className="question-narrative">
                                    Every financial decision becomes meaningful when connected to a life goal.
                                    Now let's map the dreams and milestones you want your money to support.
                                </p>
                            </div>
                        )}

                        {/* ──────── SCREEN 1: SELECT GOAL ──────── */}
                        {screen === SELECT && (
                            <div className="question-container">
                                <h2 className="question-title">
                                    What is the financial goal you want to achieve?
                                </h2>
                                <p className="question-helper" style={{ marginBottom: '1.5rem' }}>
                                    Select from popular goals or add your own custom goal.
                                </p>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', maxWidth: '520px', margin: '0 auto 1.5rem' }}>
                                    {goalTemplates.map((tmpl) => {
                                        const Icon = tmpl.icon;
                                        const isSelected = selectedTemplateId === tmpl.id;
                                        return (
                                            <div
                                                key={tmpl.id}
                                                className={`option-card ${isSelected ? 'selected' : ''}`}
                                                style={{ padding: '1.15rem 0.75rem', minWidth: 'auto', maxWidth: 'none', position: 'relative' }}
                                                onClick={() => addGoalFromTemplate(tmpl)}
                                            >
                                                {isSelected && (
                                                    <div style={{
                                                        position: 'absolute', top: 8, right: 8,
                                                        width: 22, height: 22, borderRadius: '50%',
                                                        background: 'var(--positive)', color: 'white',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        <Check size={14} />
                                                    </div>
                                                )}
                                                <div style={{ color: isSelected ? 'var(--positive)' : 'var(--primary)' }}>
                                                    <Icon size={22} />
                                                </div>
                                                <div className="option-card-title" style={{ fontSize: '0.82rem' }}>
                                                    {tmpl.label}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Any Other Goal */}
                                    <div
                                        className={`option-card ${showCustomInput ? 'selected' : ''}`}
                                        style={{ padding: '1.15rem 0.75rem', minWidth: 'auto', maxWidth: 'none' }}
                                        onClick={() => setShowCustomInput(true)}
                                    >
                                        <div style={{ color: 'var(--color-3, #787CFE)' }}><PenLine size={22} /></div>
                                        <div className="option-card-title" style={{ fontSize: '0.82rem' }}>Any Other Goal</div>
                                    </div>
                                </div>

                                {showCustomInput && (
                                    <div style={{ maxWidth: '420px', margin: '0 auto', display: 'flex', gap: '0.75rem' }}>
                                        <input
                                            type="text"
                                            className="conversational-input"
                                            placeholder="Enter your goal name..."
                                            value={customGoalName}
                                            onChange={(e) => setCustomGoalName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addCustomGoal()}
                                            autoFocus
                                        />
                                        <button
                                            className="step-nav-btn primary"
                                            onClick={addCustomGoal}
                                            disabled={!customGoalName.trim()}
                                            style={{ whiteSpace: 'nowrap', opacity: customGoalName.trim() ? 1 : 0.5 }}
                                        >
                                            Add <Plus size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ──────── SCREEN 2: YEARS ──────── */}
                        {screen === YEARS && editingGoal && (
                            <div className="question-container">
                                <p className="question-narrative" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    {React.createElement(getGoalIcon(editingGoal.name), { size: 20 })}
                                    {editingGoal.name}
                                </p>
                                <h2 className="question-title">
                                    After how many years would you like to achieve this goal?
                                </h2>

                                <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                                        Years Remaining
                                    </label>
                                    <input
                                        type="number"
                                        className="conversational-input"
                                        placeholder="e.g. 10"
                                        value={editingGoal.yearsToGoal || ''}
                                        onChange={(e) => handleGoalChange('yearsToGoal', e.target.value)}
                                        style={{ textAlign: 'center', fontSize: '1.3rem', fontWeight: 700 }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ──────── SCREEN 3: PRESENT VALUE ──────── */}
                        {screen === VALUE && editingGoal && (() => {
                            const futureCost = calculateFutureCost(editingGoal.presentValue, editingGoal.yearsToGoal, editingGoal.inflationRate);
                            return (
                                <div className="question-container">
                                    <p className="question-narrative" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                        {React.createElement(getGoalIcon(editingGoal.name), { size: 20 })}
                                        {editingGoal.name} • {editingGoal.yearsToGoal} years
                                    </p>
                                    <h2 className="question-title">
                                        If you were to achieve this goal today, how much would it cost approximately?
                                    </h2>

                                    <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                                            Present Value of Goal
                                        </label>
                                        <div className="currency-input-wrapper">
                                            <span className="currency-symbol">₹</span>
                                            <input
                                                type="number"
                                                className="conversational-input"
                                                placeholder="e.g. 500000"
                                                value={editingGoal.presentValue || ''}
                                                onChange={(e) => handleGoalChange('presentValue', e.target.value)}
                                            />
                                        </div>

                                        {/* Inflation rate */}
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                            Assumed Inflation Rate: <strong style={{ color: 'var(--primary)' }}>{editingGoal.inflationRate || 6}%</strong>
                                        </div>

                                        {/* Future cost — white background, green text */}
                                        {editingGoal.presentValue && (
                                            <div style={{
                                                marginTop: '1rem', padding: '0.85rem 1rem',
                                                background: '#ffffff', borderRadius: '10px',
                                                border: '1px solid var(--border)',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                                            }}>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Estimated Future Cost:</span>
                                                <strong style={{ color: 'var(--positive)', fontSize: '1rem' }}>{formatInr(futureCost)}</strong>
                                            </div>
                                        )}
                                    </div>

                                    {editingGoal.presentValue && (
                                        <button
                                            className="step-nav-btn primary"
                                            onClick={handleSaveGoal}
                                            style={{ margin: '1.5rem auto 0', display: 'flex' }}
                                        >
                                            Save Goal <ArrowRight size={16} />
                                        </button>
                                    )}
                                </div>
                            );
                        })()}

                        {/* ──────── SCREEN 4: SUMMARY (always last) ──────── */}
                        {screen === SUMMARY && (
                            <div className="question-container">
                                <h2 className="question-title" style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>
                                    Your Financial Goals
                                </h2>

                                {validGoals.length === 0 ? (
                                    <div style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                                        No goals added yet. Add your first goal to continue.
                                    </div>
                                ) : (
                                    <div style={{ maxWidth: '500px', margin: '0 auto 1.5rem', textAlign: 'left' }}>
                                        {validGoals.map((goal) => {
                                            const Icon = getGoalIcon(goal.name);
                                            return (
                                                <div key={goal.id} className="goal-summary-card">
                                                    <div className="goal-summary-info">
                                                        <div className="goal-summary-icon"><Icon size={18} /></div>
                                                        <div>
                                                            <div className="goal-summary-name">{goal.name}</div>
                                                            <div className="goal-summary-meta">
                                                                {goal.yearsToGoal ? `${goal.yearsToGoal} years` : ''}
                                                                {goal.presentValue ? ` • ${formatInr(goal.presentValue)}` : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button className="goal-remove-btn" onClick={() => removeGoal(goal.id)} title="Remove goal">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <button className="add-goal-btn" onClick={handleAddAnother}>
                                    <Plus size={18} /> Add Another Goal
                                </button>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* ── Progress dots ── */}
                {screen >= INTRO && (
                    <div className="question-dots">
                        {Array.from({ length: SCREEN_COUNT }).map((_, i) => (
                            <div
                                key={i}
                                className={`question-dot ${i === screen ? 'active' : ''} ${i < screen ? 'completed' : ''}`}
                            />
                        ))}
                    </div>
                )}

                {/* ── Inter-step navigation ── */}
                <div className="step-nav-bar">
                    <div>
                        {(screen === INTRO || screen === SUMMARY) && (
                            <button className="step-nav-btn" onClick={async () => {
                                if (savePlanData) {
                                    try { await savePlanData(); } catch (e) { console.error('Save failed on nav', e); }
                                }
                                navigate('/summary-flow/liabilities');
                            }}>
                                <ArrowLeft size={16} /> Previous Section
                            </button>
                        )}
                    </div>
                    <div>
                        {screen === SUMMARY && (
                            <button className="step-nav-btn primary" onClick={handleViewSummary}>
                                {hasGeneratedReport ? 'View Summary Report' : 'Generate Summary Report'}
                                <ArrowRight size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default SummaryGoals;
