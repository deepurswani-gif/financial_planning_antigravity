import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Lightbulb,
    AlertTriangle,
    CheckCircle2,
    ArrowRight,
    User,
    Award,
    Hourglass,
    Settings2,
} from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { GROWTH_EXPECTATIONS_PATH } from '../DetailedFlow/detailedFlowSteps';
import { DEFAULT_DETAILED_REPORT_PATH } from './detailedReportSteps';
import {
    buildLifeJourneyReport,
    computeLifeJourneyInsights,
} from './lifeJourneyTableLogic';
import TransposedJourneyTable from './TransposedJourneyTable';
import LifeJourneyVisuals from './LifeJourneyVisuals';

const HeroKpi = ({ label, value, icon: Icon, suffix = '' }) => (
    <div className="lj-kpi-pill">
        {Icon && <Icon size={20} style={{ opacity: 0.85 }} />}
        <div>
            <span className="lj-kpi-label">{label}</span>
            <strong className="lj-kpi-value">{value}{suffix}</strong>
        </div>
    </div>
);

const InsightIcon = ({ tone }) => {
    if (tone === 'warning') return <AlertTriangle size={16} className="lj-insight-icon lj-insight-warning" />;
    if (tone === 'positive') return <CheckCircle2 size={16} className="lj-insight-icon lj-insight-positive" />;
    if (tone === 'accent') return <ArrowRight size={16} className="lj-insight-icon lj-insight-accent" />;
    return <Lightbulb size={16} className="lj-insight-icon" />;
};

const LifeJourneySection = () => {
    const navigate = useNavigate();
    const { familyMembers, journeyProjections, goals, inflationRates } = useFinancialPlan();

    const report = useMemo(
        () => buildLifeJourneyReport({
            familyMembers,
            journeyProjections,
            goals,
            inflationRates,
        }),
        [familyMembers, journeyProjections, goals, inflationRates],
    );

    const insights = useMemo(() => computeLifeJourneyInsights(report), [report]);
    const { meta, hero, projections, goalsByYear } = report;
    const hasGoals = Object.keys(goalsByYear).length > 0;

    const growthEditPath = `${GROWTH_EXPECTATIONS_PATH}?returnTo=${encodeURIComponent(DEFAULT_DETAILED_REPORT_PATH)}`;

    return (
        <div className="lj-section">
            <div className="lj-hero card">
                <div className="lj-hero-top">
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Life Journey</h2>
                        <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                            Now let&apos;s look beyond this year and see how today&apos;s decisions may shape your family&apos;s tomorrow.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="lj-edit-rates-btn"
                        onClick={() => navigate(growthEditPath)}
                    >
                        <Settings2 size={16} />
                        Edit growth assumptions
                    </button>
                </div>

                {hero && (
                    <div className="lj-kpi-grid">
                        <HeroKpi label="Current Age" value={hero.currentAge} icon={User} suffix=" yrs" />
                        <HeroKpi label="Retirement Age" value={hero.retirementAge} icon={Award} suffix=" yrs" />
                        <HeroKpi
                            label="Years to Golden Period"
                            value={hero.yearsToGoldenPeriod}
                            icon={Hourglass}
                            suffix=" yrs"
                        />
                    </div>
                )}
            </div>

            <LifeJourneyVisuals report={report} />

            <div className="lj-table-card card">
                <div className="lj-table-header">
                    <h3 style={{ margin: 0 }}>Yearly Money Flow till Retirement</h3>
                    <p className="lj-legend">
                        {meta.hasProfile && meta.retirementYear
                            ? `Projections from ${meta.currentYear + 1} to ${meta.retirementYear} — current year shown in Your Money Flow above.`
                            : 'Complete your profile to see projections through retirement.'}
                    </p>
                </div>

                <TransposedJourneyTable
                    projections={projections}
                    goalsByYear={goalsByYear}
                    hasGoals={hasGoals}
                />
            </div>

            {insights.length > 0 && (
                <div className="card lj-insights-card">
                    <h4 className="lj-insights-title">
                        <Lightbulb size={18} />
                        Life Journey Insights
                    </h4>
                    <ul className="lj-insights-list">
                        {insights.map((item) => (
                            <li key={item.id} className={`lj-insight lj-insight-${item.tone}`}>
                                <InsightIcon tone={item.tone} />
                                <span>{item.text}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <style>{`
                .lj-section { display: flex; flex-direction: column; gap: 1.5rem; padding: 0 1rem; margin-top: 2.5rem; }
                .lj-hero { padding: 1.5rem; background: linear-gradient(135deg, rgba(124,58,237,0.06), rgba(37,99,235,0.04)); }
                .lj-hero-top { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; align-items: flex-start; }
                .lj-edit-rates-btn {
                    display: inline-flex; align-items: center; gap: 0.4rem;
                    padding: 0.5rem 0.85rem; border-radius: 8px;
                    border: 1px solid var(--border); background: var(--bg-card);
                    color: var(--text-main); font-size: 0.82rem; font-weight: 600;
                    cursor: pointer; transition: border-color 0.2s, color 0.2s;
                    white-space: nowrap;
                }
                .lj-edit-rates-btn:hover { border-color: var(--primary); color: var(--primary); }
                .lj-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
                .lj-kpi-pill { display: flex; gap: 0.75rem; align-items: center; padding: 1rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; }
                .lj-kpi-label { display: block; font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.2rem; }
                .lj-kpi-value { font-size: 1.15rem; color: var(--primary); }

                .lj-table-card { padding: 1.25rem; }
                .lj-table-header { margin-bottom: 1rem; }
                .lj-legend { margin: 0.35rem 0 0; color: var(--text-muted); font-size: 0.85rem; line-height: 1.5; }

                .lj-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--border); border-radius: 8px; position: relative; isolation: isolate; }
                .lj-table { width: max-content; min-width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.82rem; }
                .lj-table th, .lj-table td { padding: 0.6rem 0.5rem; border-bottom: 1px solid var(--border); text-align: right; white-space: nowrap; }
                .lj-table thead th { background: var(--bg-main); font-weight: 600; position: sticky; top: 0; z-index: 3; vertical-align: bottom; }
                .lj-sticky-col {
                    position: sticky; left: 0; z-index: 5;
                    text-align: left !important;
                    background: var(--bg-card);
                    min-width: 220px; max-width: 220px;
                    box-shadow: 4px 0 8px -2px rgba(0,0,0,0.08);
                }
                .lj-table thead .lj-sticky-col { z-index: 6; background: var(--bg-main); }
                .lj-th-label { min-width: 220px; max-width: 220px; }
                .lj-col-year { display: block; font-weight: 700; }
                .lj-year-col { min-width: 96px; position: relative; z-index: 1; }

                .lj-sign { color: var(--text-muted); font-weight: 600; font-size: 0.78rem; margin-right: 0.35rem; flex-shrink: 0; }
                .lj-row-label { font-weight: 500; color: var(--text-main); display: flex; align-items: center; padding-left: 0.75rem !important; overflow: hidden; text-overflow: ellipsis; }
                .lj-row-subtotal { background: rgba(37,99,235,0.04); }
                .lj-row-subtotal .lj-sticky-col { background: rgba(37,99,235,0.04) !important; }
                .lj-row-result { background: rgba(16,185,129,0.06); }
                .lj-row-result .lj-sticky-col { background: rgba(16,185,129,0.06) !important; }
                .lj-row-result .lj-cell { font-weight: 700; }
                .lj-row-goals { background: rgba(124,58,237,0.04); }
                .lj-row-goals .lj-sticky-col { background: rgba(124,58,237,0.04) !important; }
                .lj-cell-goals { text-align: center !important; }

                .lj-cell { position: relative; }
                .lj-cell-breakdown { position: relative; }
                .lj-cell-tax-due { color: #ef4444; }
                .lj-cell-negative { color: #ef4444 !important; background: rgba(239,68,68,0.05) !important; }
                .lj-cell-surplus-positive { color: #059669; background: rgba(16,185,129,0.05); }

                .lj-goal-icons { display: flex; align-items: center; justify-content: center; gap: 0.2rem; margin-top: 0.25rem; flex-wrap: wrap; }
                .lj-goal-icon { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; background: rgba(0,169,242,0.1); color: var(--color-2, var(--primary)); cursor: help; }
                .lj-goal-overflow { font-size: 0.65rem; font-weight: 700; color: var(--text-muted); padding: 0 0.2rem; }

                .lj-breakdown-btn {
                    background: transparent; border: 1px dashed var(--border); color: inherit;
                    font: inherit; cursor: pointer; padding: 2px 6px; border-radius: 4px;
                    font-weight: 600; transition: all 0.15s;
                }
                .lj-breakdown-btn:hover { border-color: var(--primary); color: var(--primary); }

                .lj-popover {
                    position: absolute; top: calc(100% + 4px); right: 0; z-index: 100;
                    background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
                    padding: 1rem; box-shadow: 0 8px 24px rgba(0,0,0,0.12); width: 280px;
                    text-align: left; white-space: normal;
                }
                .lj-popover-item { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.4rem; font-size: 0.82rem; }
                .lj-popover-item span { color: var(--text-muted); flex: 1; }
                .lj-popover-subtitle { font-size: 0.72rem; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.5rem; }
                .lj-popover-divider { height: 1px; background: var(--border); margin: 0.65rem 0; }
                .lj-popover-total { display: flex; justify-content: space-between; font-weight: 800; font-size: 0.95rem; }
                .lj-popover-close { margin-top: 0.65rem; width: 100%; padding: 0.35rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-main); cursor: pointer; font-size: 0.78rem; }

                .lj-empty-table { padding: 1.5rem; text-align: center; }

                .lj-insights-card { padding: 1.25rem; }
                .lj-insights-title { margin: 0 0 0.85rem; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--text-main); }
                .lj-insights-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.65rem; }
                .lj-insight { display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.9rem; line-height: 1.5; color: var(--text-main); }
                .lj-insight-icon { flex-shrink: 0; margin-top: 2px; color: var(--text-muted); }
                .lj-insight-warning .lj-insight-icon { color: #d97706; }
                .lj-insight-positive .lj-insight-icon { color: #059669; }
                .lj-insight-accent .lj-insight-icon { color: var(--primary); }
                .lj-insight-accent { color: var(--primary); font-weight: 500; }

                .lj-visuals { display: flex; flex-direction: column; gap: 1.25rem; }
                .lj-visual-card { padding: 1.25rem; }
                .lj-visual-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; }
                .lj-arc-track { position: relative; height: 10px; background: #E2E8F0; border-radius: 999px; margin: 2.5rem 0.5rem 0.75rem; overflow: visible; }
                .lj-arc-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--primary), #7C3AED); transition: width 1s ease; }
                .lj-arc-marker { position: absolute; top: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 0.15rem; font-size: 0.72rem; color: var(--text-muted); white-space: nowrap; }
                .lj-arc-marker strong { font-size: 0.85rem; color: var(--text-main); }
                .lj-arc-today { z-index: 2; }
                .lj-arc-golden { right: 0; left: auto; transform: translate(0, -50%); align-items: flex-end; }
                .lj-arc-axis { display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); padding: 0 0.25rem; }
                .lj-goal-strip { padding: 0.5rem 0; }
                .lj-goal-track { position: relative; height: 4px; background: linear-gradient(90deg, var(--primary), #E2E8F0); border-radius: 2px; margin: 2rem 0.5rem 0.75rem; }
                .lj-goal-node { position: absolute; top: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 0.35rem; }
                .lj-goal-node-dot { width: 34px; height: 34px; border-radius: 50%; background: #fff; border: 2px solid var(--primary); color: var(--primary); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37,99,235,0.15); }
                .lj-goal-node-year { font-size: 0.68rem; font-weight: 700; color: var(--text-muted); }
            `}</style>
        </div>
    );
};

export default LifeJourneySection;
