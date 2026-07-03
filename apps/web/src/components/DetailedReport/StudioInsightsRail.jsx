import React from 'react';
import {
    Lightbulb, AlertTriangle, CheckCircle2, Sparkles, XCircle,
} from 'lucide-react';
import ReportReveal from './ReportReveal';

const InsightIcon = ({ tone }) => {
    if (tone === 'error') return <XCircle size={16} className="pymtw-insight-icon pymtw-insight-error" />;
    if (tone === 'warning') return <AlertTriangle size={16} className="pymtw-insight-icon pymtw-insight-warning" />;
    if (tone === 'positive') return <CheckCircle2 size={16} className="pymtw-insight-icon pymtw-insight-positive" />;
    if (tone === 'accent') return <Sparkles size={16} className="pymtw-insight-icon pymtw-insight-accent" />;
    return <Lightbulb size={16} className="pymtw-insight-icon" />;
};

const StudioInsightsRail = ({ insights }) => {
    if (!insights?.length) return null;

    return (
        <ReportReveal className="pymtw-insights-rail card">
            <h3 className="pymtw-zone-title">
                <Sparkles size={18} />
                Allocation intelligence
            </h3>
            <ul className="pymtw-insights-list">
                {insights.map((item) => (
                    <li key={item.id} className={`pymtw-insight pymtw-insight-${item.tone}`}>
                        <InsightIcon tone={item.tone} />
                        <span>{item.text}</span>
                    </li>
                ))}
            </ul>
        </ReportReveal>
    );
};

export default StudioInsightsRail;
