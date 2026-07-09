import React from 'react';
import { Sparkles, Calendar } from 'lucide-react';
import ReportAnimatedCounter from './ReportAnimatedCounter';

const AllocationStudioHero = ({
    hero,
    meta,
    selectableMonths,
    selectedMonthIndex,
    onMonthChange,
}) => {
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
