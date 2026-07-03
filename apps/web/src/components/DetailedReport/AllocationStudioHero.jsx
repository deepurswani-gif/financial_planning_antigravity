import React, { useEffect, useState } from 'react';
import { Sparkles, Calendar } from 'lucide-react';
import ReportAnimatedCounter from './ReportAnimatedCounter';

const ANALYSIS_STEPS = [
    'Analyzing active goals…',
    'Checking future financial adjustments…',
    'Mapping investment avenues…',
    'Ranking allocation bundles…',
    'Validating surplus envelope…',
    'Preparing your allocation brief…',
];

const AllocationStudioHero = ({
    briefing,
    hero,
    meta,
    selectableMonths,
    selectedMonthIndex,
    onMonthChange,
}) => {
    const [analysisStep, setAnalysisStep] = useState(0);
    const [analysisDone, setAnalysisDone] = useState(false);

    useEffect(() => {
        setAnalysisDone(false);
        setAnalysisStep(0);
        const timers = ANALYSIS_STEPS.map((_, idx) =>
            setTimeout(() => {
                setAnalysisStep(idx);
                if (idx === ANALYSIS_STEPS.length - 1) {
                    setTimeout(() => setAnalysisDone(true), 400);
                }
            }, idx * 300),
        );
        return () => timers.forEach(clearTimeout);
    }, [selectedMonthIndex]);

    return (
        <div className="pymtw-zone-a card">
            <div className="pymtw-zone-a-top">
                <div className="pymtw-ai-badge">
                    <Sparkles size={14} />
                    Finbrella Allocation Studio
                </div>
                <div className="pymtw-month-picker">
                    <Calendar size={16} />
                    <select
                        value={selectedMonthIndex}
                        onChange={(e) => onMonthChange(parseInt(e.target.value, 10))}
                        aria-label="Select month"
                    >
                        {selectableMonths.map((m) => (
                            <option key={m.monthIndex} value={m.monthIndex}>
                                {m.label} {meta.calendarYear}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <h2 className="pymtw-hero-title">{briefing.headline}</h2>
            <p className="pymtw-hero-greeting">{briefing.greeting}</p>

            {!analysisDone ? (
                <div className="pymtw-analysis-sequence" aria-live="polite">
                    {ANALYSIS_STEPS.map((step, idx) => (
                        <div
                            key={step}
                            className={`pymtw-analysis-step ${idx <= analysisStep ? 'pymtw-analysis-active' : ''}`}
                        >
                            <span className="pymtw-analysis-dot" />
                            {step}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="pymtw-briefing-lines">
                    {briefing.lines.map((line) => (
                        <p key={line} className="pymtw-briefing-line">{line}</p>
                    ))}
                </div>
            )}

            <div className="pymtw-hero-kpis">
                <div className="pymtw-kpi">
                    <span>Deployable surplus</span>
                    <strong className="pymtw-kpi-accent">
                        <ReportAnimatedCounter value={hero.deployableSurplus} />
                    </strong>
                </div>
                <div className="pymtw-kpi">
                    <span>Free cash (month)</span>
                    <strong>
                        <ReportAnimatedCounter value={hero.monthlyFreeCash} />
                    </strong>
                </div>
                <div className="pymtw-kpi">
                    <span>Already committed</span>
                    <strong>
                        <ReportAnimatedCounter value={hero.monthlyCommitted} />
                    </strong>
                </div>
                <div className="pymtw-kpi">
                    <span>Journey surplus (year)</span>
                    <strong>
                        <ReportAnimatedCounter value={hero.journeyYearSurplus} />
                    </strong>
                </div>
            </div>
        </div>
    );
};

export default AllocationStudioHero;
