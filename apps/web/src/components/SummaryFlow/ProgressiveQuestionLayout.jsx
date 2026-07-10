import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { useAuth } from '../../contexts/AuthContext';
import { loadSummaryUiDraft, patchSummaryUiDraft } from '../../lib/summaryFlowStorage';
import QuestionProgressBar from './QuestionProgressBar';

const steps = [
    { id: 'profile', label: 'Profile', path: '/summary-flow/profile' },
    { id: 'cashflow', label: 'Cash Flow', path: '/summary-flow/cashflow' },
    { id: 'savings', label: 'Savings', path: '/summary-flow/savings' },
    { id: 'assets', label: 'Assets', path: '/summary-flow/assets' },
    { id: 'liabilities', label: 'Liabilities', path: '/summary-flow/liabilities' },
    { id: 'goals', label: 'Goals', path: '/summary-flow/goals' }
];

// Typewriter effect hook
const useTypewriter = (text, speed = 30) => {
    const [displayed, setDisplayed] = useState('');
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        setDisplayed('');
        setIsComplete(false);
        if (!text) return;

        let i = 0;
        const timer = setInterval(() => {
            setDisplayed(text.slice(0, i + 1));
            i++;
            if (i >= text.length) {
                clearInterval(timer);
                setIsComplete(true);
            }
        }, speed);

        return () => clearInterval(timer);
    }, [text, speed]);

    return { displayed, isComplete };
};

// Narrative transition overlay component
const NarrativeScreen = ({ text, onContinue }) => {
    const { displayed, isComplete } = useTypewriter(text, 25);

    return (
        <div className="narrative-overlay">
            <div className="narrative-card">
                <div className="narrative-icon">
                    <Sparkles size={28} />
                </div>
                <p className="narrative-text">
                    "{displayed}"
                    {!isComplete && <span className="typewriter-cursor" />}
                </p>
                {isComplete && (
                    <motion.button
                        className="narrative-continue-btn"
                        onClick={onContinue}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        Continue <ArrowRight size={18} />
                    </motion.button>
                )}
            </div>
        </div>
    );
};

const ProgressiveQuestionLayout = ({ 
    currentStepId, 
    questions = [], 
    narrative,
    onComplete 
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { savePlanData } = useFinancialPlan();
    const userId = user?.id ?? null;
    const [currentIndex, setCurrentIndex] = useState(() => {
        const savedIndex = loadSummaryUiDraft(userId)?.questionIndexByStep?.[currentStepId];
        if (typeof savedIndex === 'number' && savedIndex >= 0 && savedIndex < questions.length) {
            return savedIndex;
        }
        return 0;
    });
    const [direction, setDirection] = useState(1);
    const [showNarrative, setShowNarrative] = useState(false);

    const currentGlobalIndex = steps.findIndex(s => s.id === currentStepId);

    useEffect(() => {
        const savedIndex = loadSummaryUiDraft(userId)?.questionIndexByStep?.[currentStepId];
        if (typeof savedIndex === 'number' && savedIndex >= 0 && savedIndex < questions.length) {
            setCurrentIndex(savedIndex);
        } else {
            setCurrentIndex(0);
        }
    }, [currentStepId, questions.length, userId]);

    useEffect(() => {
        const existing = loadSummaryUiDraft(userId)?.questionIndexByStep || {};
        patchSummaryUiDraft(userId, {
            questionIndexByStep: {
                ...existing,
                [currentStepId]: currentIndex,
            },
            lastSummaryPath: location.pathname,
        });
    }, [currentIndex, currentStepId, location.pathname, userId]);

    // Handle intra-step navigation (chevron arrows)
    const handleNextQuestion = useCallback(() => {
        if (currentIndex < questions.length - 1) {
            setDirection(1);
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, questions.length]);

    const handlePrevQuestion = useCallback(() => {
        if (currentIndex > 0) {
            setDirection(-1);
            setCurrentIndex(prev => prev - 1);
        }
    }, [currentIndex]);

    // Handle inter-step navigation (Next Section / Previous Section buttons)
    const handleNextStep = () => {
        if (narrative) {
            setShowNarrative(true);
        } else {
            navigateToNextStep();
        }
    };

    const navigateToNextStep = async () => {
        if (savePlanData) {
            try { await savePlanData(); } catch (e) { console.error('Save failed on nav', e); }
        }
        if (onComplete) {
            onComplete();
        } else {
            const nextStep = steps[currentGlobalIndex + 1];
            if (nextStep) {
                navigate(nextStep.path);
            } else {
                navigate('/summary-report/money_story');
            }
        }
    };

    const handlePrevStep = async () => {
        if (savePlanData) {
            try { await savePlanData(); } catch (e) { console.error('Save failed on nav', e); }
        }
        const prevStep = steps[currentGlobalIndex - 1];
        if (prevStep) {
            navigate(prevStep.path);
        }
    };

    const handleNarrativeContinue = () => {
        setShowNarrative(false);
        navigateToNextStep();
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (showNarrative) return;
            if (e.key === 'ArrowRight' && currentIndex < questions.length - 1) {
                handleNextQuestion();
            } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
                handlePrevQuestion();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, questions.length, showNarrative, handleNextQuestion, handlePrevQuestion]);

    // PAN transition effect — PowerPoint-style horizontal slide
    const variants = {
        enter: (direction) => ({
            x: direction > 0 ? '100%' : '-100%',
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (direction) => ({
            x: direction < 0 ? '100%' : '-100%',
            opacity: 0,
        })
    };

    const isFirstQuestion = currentIndex === 0;
    const isLastQuestion = currentIndex === questions.length - 1;
    const isFirstStep = currentGlobalIndex === 0;
    const isLastStep = currentGlobalIndex === steps.length - 1;

    return (
        <>
            {/* Narrative overlay */}
            <AnimatePresence>
                {showNarrative && narrative && (
                    <NarrativeScreen 
                        text={narrative} 
                        onContinue={handleNarrativeContinue} 
                    />
                )}
            </AnimatePresence>

            {/* Floating chevron arrows for intra-step navigation */}
            <button 
                className={`nav-chevron nav-chevron-left ${isFirstQuestion ? 'hidden' : ''}`}
                onClick={handlePrevQuestion}
                aria-label="Previous question"
            >
                <ChevronLeft size={24} />
            </button>

            <button 
                className={`nav-chevron nav-chevron-right ${isLastQuestion ? 'hidden' : ''}`}
                onClick={handleNextQuestion}
                aria-label="Next question"
            >
                <ChevronRight size={24} />
            </button>

            {/* Question content area */}
            <div className="progressive-question-shell">
                <QuestionProgressBar
                    totalQuestions={questions.length}
                    currentIndex={currentIndex}
                />
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={currentStepId + '-' + currentIndex}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ 
                            duration: 0.5, 
                            ease: [0.45, 0, 0.15, 1] // PowerPoint pan-like easing
                        }}
                        style={{ width: '100%' }}
                    >
                        {questions[currentIndex]?.content}
                    </motion.div>
                </AnimatePresence>

                {/* Inter-step navigation buttons */}
                <div className="step-nav-bar">
                    <div>
                        {isFirstQuestion && !isFirstStep && (
                            <button className="step-nav-btn" onClick={handlePrevStep}>
                                <ArrowLeft size={16} /> Previous Section
                            </button>
                        )}
                    </div>
                    <div>
                        {isLastQuestion && (
                            <button className="step-nav-btn primary" onClick={handleNextStep}>
                                {isLastStep ? 'View Summary' : 'Next Section'} <ArrowRight size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ProgressiveQuestionLayout;
