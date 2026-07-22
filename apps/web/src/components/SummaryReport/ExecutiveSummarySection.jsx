import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Wallet, Shield, Heart, TrendingUp, Target, Download, CalendarClock, BadgeInfo } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { useAuth } from '../../contexts/AuthContext';
import { buildExecutiveSummaryReport, buildWhatIfScenario } from './ExecutiveSummaryLogic';
import { getReadinessSnapshotsByPlan, upsertMonthlyReadinessSnapshot } from '../../services/financialPlanService';
import { buildExecutiveSummarySignals, PILLAR_TO_RECOMMENDATION_ID } from '../../recommendationRegistry/adapters/executiveSummaryAdapter';
import { useRecommendationStore } from '../../recommendationOrchestration';
import { RecommendationList } from '../../recommendationPresentation';
import { useLaunchRecommendationAction } from '../FinancialWorkspace/FinancialWorkspaceContext';

const ICON_MAP = {
    wallet: Wallet,
    shield: Shield,
    heart: Heart,
    'trending-up': TrendingUp,
    target: Target
};

const SCORE_COLORS = ['#ef4444', '#f59e0b', '#00a9f2', '#6366f1', '#10b981'];
const FALLBACK_LOGO = '/finbrella_logo.png';
const USEFUL_INSIGHTS_REPORTS = ['useful_insights'];
const DISCLAIMER_TEXT = [
    'This financial plan has been prepared by Finbrella based on the information provided by you. The projections, assumptions, and recommendations are based on current data, historical trends, and standard financial models.',
    'All future projections (including returns, inflation, and goal outcomes) are estimates only and may vary due to market movements, economic changes, policy changes, or other unforeseen factors.',
    'This report should be treated as a guidance document (roadmap) and not as a guarantee of results. It is recommended that the plan be reviewed periodically and updated as circumstances change.',
    'The accuracy of this report is dependent on the completeness and correctness of the information provided by you. Any inaccuracies or changes in inputs may significantly impact the outcomes.',
    'While due care has been taken in preparing this report using automated tools and algorithms, it may be subject to system limitations or errors.',
    'This report does not constitute legal, tax, or investment advice. You are advised to consult relevant professionals before making financial decisions.',
    'Finbrella shall not be held liable for any decisions taken based on this report.'
];

const ExecutiveSummarySection = () => {
    const { user } = useAuth();
    const launchRecommendationAction = useLaunchRecommendationAction();
    const {
        planId,
        income,
        expenseCategories,
        assetCategories,
        summaryLifeCover,
        summaryHealthCover,
        contingencyFund,
        goals,
        inflationRates,
        familyMembers,
        hasSpouseIncome,
    } = useFinancialPlan();

    const report = useMemo(
        () =>
            buildExecutiveSummaryReport({
                income,
                expenseCategories,
                assetCategories,
                summaryLifeCover,
                summaryHealthCover,
                contingencyFund,
                goals,
                inflationRates,
                familyMembers,
                hasSpouseIncome,
            }),
        [income, expenseCategories, assetCategories, summaryLifeCover, summaryHealthCover, contingencyFund, goals, inflationRates, familyMembers, hasSpouseIncome]
    );

    // Priority Next Steps: report selects/orders by weakest pillars; presentation
    // owns card layout, actions, and visual hierarchy.
    const recommendationSignals = useMemo(
        () => buildExecutiveSummarySignals(report),
        [report],
    );
    const recommendationStore = useRecommendationStore(recommendationSignals, {
        reports: USEFUL_INSIGHTS_REPORTS,
    });
    const priorityRecommendations = useMemo(() => {
        const byId = new Map(
            recommendationStore.getByReport('useful_insights').map((rec) => [rec.recommendationId, rec]),
        );
        return (recommendationSignals.weakestPillars ?? [])
            .map((pillarId) => byId.get(PILLAR_TO_RECOMMENDATION_ID[pillarId]))
            .filter(Boolean);
    }, [recommendationStore, recommendationSignals]);

    const [scenario, setScenario] = useState(report.baseMetrics);
    const [trendRows, setTrendRows] = useState([]);

    useEffect(() => {
        if (!planId) return;
        let cancelled = false;

        const run = async () => {
            const monthKey = new Date().toISOString().slice(0, 7);
            const listRes = await getReadinessSnapshotsByPlan(planId, 24);
            const rows = (listRes.data || []).map((item) => {
                const date = new Date(item.snapshot_month);
                return {
                    monthKey: item.snapshot_month?.slice(0, 7),
                    label: date.toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
                    score: item.total_score
                };
            });

            const hasCurrentMonth = rows.some((row) => row.monthKey === monthKey);
            if (!hasCurrentMonth) {
                await upsertMonthlyReadinessSnapshot({
                    planId,
                    totalScore: report.totalScore,
                    overallCategory: report.overallCategory,
                    confidencePct: report.confidence.confidencePct,
                    pillars: report.pillars,
                    meta: {
                        source: 'executive-summary',
                        recorded_at: new Date().toISOString()
                    }
                });

                const refreshed = await getReadinessSnapshotsByPlan(planId, 24);
                const refreshedRows = (refreshed.data || []).map((item) => {
                    const date = new Date(item.snapshot_month);
                    return {
                        monthKey: item.snapshot_month?.slice(0, 7),
                        label: date.toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
                        score: item.total_score
                    };
                });
                if (!cancelled) setTrendRows(refreshedRows);
                return;
            }

            if (!cancelled) setTrendRows(rows);
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [planId, report.totalScore, report.overallCategory, report.confidence.confidencePct, report.pillars]);

    const scenarioResult = useMemo(
        () => buildWhatIfScenario(report, scenario),
        [report, scenario]
    );

    const chartData = report.pillars.map((pillar) => ({
        name: pillar.name.replace('Financial ', '').replace(' Capacity', ''),
        score: pillar.score
    }));

    const scorePercent = Math.max(0, Math.min(100, report.totalScore));
    const confidencePercent = Math.max(0, Math.min(100, report.confidence.confidencePct));
    const upliftClass = scenarioResult.uplift > 0 ? 'es-uplift-pos' : scenarioResult.uplift < 0 ? 'es-uplift-neg' : '';

    const printOnePager = () => {
        window.print();
    };

    const updateScenarioValue = (key, value) => {
        setScenario((prev) => ({
            ...prev,
            [key]: Number.isFinite(value) ? value : 0
        }));
    };

    return (
        <div className="es-container">
            <section className="es-hero">
                <p className="es-eyebrow">USEFUL INSIGHTS</p>
                <h1 className="es-title">Financial Readiness Score</h1>
                <div className="es-score-wrap">
                    <div className="es-score-ring" style={{ '--es-score': `${scorePercent}` }}>
                        <div className="es-score-core">
                            <span className="es-score-value">{report.totalScore}</span>
                            <span className="es-score-max">/100</span>
                        </div>
                    </div>
                    <div className="es-score-info">
                        <span className="es-score-band">{report.overallCategory}</span>
                        <p className="es-score-note">
                            This score reflects your current financial readiness across daily stability, emergency safety,
                            family protection, wealth creation, and goal preparedness.
                        </p>
                    </div>
                </div>
                <p className="es-narrative">{report.narrative}</p>
            </section>

            <section className="es-confidence">
                <h3>Confidence Indicator (Weighted Data Completeness)</h3>
                <div className="es-confidence-grid">
                    <div className="es-confidence-meter">
                        <div className="es-confidence-ring" style={{ '--es-confidence': `${confidencePercent}` }}>
                            <div className="es-confidence-core">
                                <span>{confidencePercent}%</span>
                            </div>
                        </div>
                        <p className="es-confidence-band">{report.confidence.confidenceBand}</p>
                    </div>
                    <div className="es-confidence-pillars">
                        {report.pillars.map((pillar) => {
                            const completeness = Math.round((report.confidence.pillarCompleteness[pillar.id] || 0) * 100);
                            return (
                                <div key={pillar.id} className="es-confidence-row">
                                    <span>{pillar.name}</span>
                                    <span>{completeness}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="es-pillars">
                {report.pillars.map((pillar) => {
                    const Icon = ICON_MAP[pillar.icon] || Wallet;
                    const filledPct = (pillar.score / 20) * 100;
                    return (
                        <article key={pillar.id} className="es-pillar-card">
                            <div className="es-pillar-head">
                                <div className="es-pillar-icon">
                                    <Icon size={18} />
                                </div>
                                <div>
                                    <h3>{pillar.name}</h3>
                                    <span className={`es-pill-band es-band-${pillar.band.toLowerCase().replace(' ', '-')}`}>
                                        {pillar.band}
                                    </span>
                                </div>
                                <div className="es-pillar-score">{pillar.score}/20</div>
                            </div>
                            <div className="es-pillar-meter">
                                <div className="es-pillar-fill" style={{ width: `${filledPct}%` }} />
                            </div>
                            <p className="es-pillar-metric">
                                {pillar.metricLabel}: <strong>{pillar.metricValue}</strong>
                            </p>
                            <p className="es-pillar-text">{pillar.interpretation}</p>
                            {pillar.dataNote ? <p className="es-pillar-note">{pillar.dataNote}</p> : null}
                        </article>
                    );
                })}
            </section>

            <section className="es-chart-panel">
                <h3>Pillar Score Snapshot</h3>
                <div className="es-chart-wrap">
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartData} margin={{ top: 12, right: 12, left: 8, bottom: 24 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} interval={0} angle={-8} textAnchor="end" />
                            <YAxis domain={[0, 20]} tick={{ fill: '#64748b', fontSize: 12 }} />
                            <Tooltip formatter={(v) => [`${v}/20`, 'Score']} />
                            <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`${entry.name}-${index}`} fill={SCORE_COLORS[index % SCORE_COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>

            <section className="es-simulator">
                <h3>If You Improve X, Score Can Become Y</h3>
                <div className="es-simulator-grid">
                    <div className="es-sim-controls">
                        <label>
                            Emergency fund coverage (months)
                            <input type="range" min="0" max="12" step="0.5" value={scenario.emergencyMonths} onChange={(e) => updateScenarioValue('emergencyMonths', parseFloat(e.target.value))} />
                            <span>{scenario.emergencyMonths} months</span>
                        </label>
                        <label>
                            Investment ratio (% of income)
                            <input type="range" min="0" max="40" step="1" value={scenario.investmentRatioPct} onChange={(e) => updateScenarioValue('investmentRatioPct', parseFloat(e.target.value))} />
                            <span>{scenario.investmentRatioPct}%</span>
                        </label>
                        <label>
                            Surplus ratio (% of income)
                            <input type="range" min="0" max="40" step="1" value={scenario.surplusRatioPct} onChange={(e) => updateScenarioValue('surplusRatioPct', parseFloat(e.target.value))} />
                            <span>{scenario.surplusRatioPct}%</span>
                        </label>
                        <label>
                            Life coverage ratio (% of need)
                            <input type="range" min="0" max="150" step="5" value={scenario.lifeCoverageRatioPct} onChange={(e) => updateScenarioValue('lifeCoverageRatioPct', parseFloat(e.target.value))} />
                            <span>{scenario.lifeCoverageRatioPct}%</span>
                        </label>
                        <label>
                            Health cover (lakh)
                            <input type="range" min="0" max="30" step="1" value={scenario.healthCoverLakh} onChange={(e) => updateScenarioValue('healthCoverLakh', parseFloat(e.target.value))} />
                            <span>{scenario.healthCoverLakh}L</span>
                        </label>
                        <label>
                            Goal readiness average (%)
                            <input type="range" min="0" max="150" step="5" value={scenario.goalReadinessPct} onChange={(e) => updateScenarioValue('goalReadinessPct', parseFloat(e.target.value))} />
                            <span>{scenario.goalReadinessPct}%</span>
                        </label>
                    </div>
                    <div className="es-sim-result">
                        <button className="es-reset-btn" onClick={() => setScenario(report.baseMetrics)}>Reset to current values</button>
                        <div className="es-sim-card">
                            <span>Current Score</span>
                            <strong>{report.totalScore}/100</strong>
                        </div>
                        <div className="es-sim-card">
                            <span>Projected Score</span>
                            <strong>{scenarioResult.nextTotal}/100</strong>
                        </div>
                        <div className={`es-sim-uplift ${upliftClass}`}>
                            {scenarioResult.uplift >= 0 ? '+' : ''}{scenarioResult.uplift} points
                        </div>
                        <p className="es-sim-band">
                            Category: <strong>{report.overallCategory}</strong> → <strong>{scenarioResult.nextCategory}</strong>
                        </p>
                    </div>
                </div>
            </section>

            <section className="es-uplift">
                <h3>Score Uplift Opportunities</h3>
                <div className="es-uplift-grid">
                    {report.upliftOpportunities.map((item) => (
                        <div key={item.key} className="es-uplift-card">
                            <p>{item.label}</p>
                            <div className="es-uplift-meta">
                                <span>Current: {item.currentValue}</span>
                                <span>Target: {item.targetValue}</span>
                            </div>
                            <strong>+{item.uplift} points</strong>
                        </div>
                    ))}
                </div>
            </section>

            <section className="es-trend">
                <h3>Monthly Trend Tracking</h3>
                <p className="es-trend-note"><CalendarClock size={14} /> Snapshot is stored once per month from now onward.</p>
                <div className="es-chart-wrap">
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={trendRows} margin={{ top: 12, right: 12, left: 8, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} />
                            <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 12 }} />
                            <Tooltip formatter={(v) => [`${v}/100`, 'Score']} />
                            <Bar dataKey="score" fill="#00a9f2" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>

            <section className="es-actions">
                <h3>Your Priority Next Steps</h3>
                <RecommendationList
                    recommendations={priorityRecommendations}
                    onPrimaryAction={launchRecommendationAction}
                    ctaContext={{
                        familyMembers,
                        user,
                        moduleName: 'Useful Insights — Priority Next Steps',
                    }}
                    density="summary"
                    emptySurface="useful_insights"
                    className="es-rec-list"
                />
            </section>

            <section className="es-roadmap">
                <h3>Dynamic Action Roadmap</h3>
                <div className="es-roadmap-grid">
                    {Object.entries(report.roadmap).map(([horizon, steps]) => (
                        <div key={horizon} className="es-roadmap-card">
                            <h4>{horizon}</h4>
                            <ul>
                                {steps.map((step) => <li key={step}>{step}</li>)}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>

            <section className="es-benchmark">
                <h3>Benchmark View</h3>
                <div className="es-benchmark-card">
                    <BadgeInfo size={18} />
                    <div>
                        <strong>Peer benchmark coming soon</strong>
                        <p>An anonymized percentile benchmark will be shown here once benchmark datasets are activated.</p>
                    </div>
                </div>
            </section>

            <section className="es-export">
                <h3>Downloadable Useful Insights One-Pager</h3>
                <button className="es-export-btn" onClick={printOnePager}>
                    <Download size={16} /> Export PDF One-Pager
                </button>
            </section>

            <section className="es-print-sheet">
                <div className="es-print-header">
                    <img src={FALLBACK_LOGO} alt="Finbrella logo" />
                    <div>
                        <h2>Useful Insights</h2>
                        <p>Advisor: Finbrella</p>
                    </div>
                </div>
                <div className="es-print-kpis">
                    <div><span>Financial Readiness Score</span><strong>{report.totalScore}/100</strong></div>
                    <div><span>Category</span><strong>{report.overallCategory}</strong></div>
                    <div><span>Confidence</span><strong>{report.confidence.confidencePct}%</strong></div>
                </div>
                <p className="es-print-narrative">{report.narrative}</p>
                <table className="es-print-table">
                    <thead>
                        <tr><th>Pillar</th><th>Score</th><th>Interpretation</th></tr>
                    </thead>
                    <tbody>
                        {report.pillars.map((pillar) => (
                            <tr key={pillar.id}>
                                <td>{pillar.name}</td>
                                <td>{pillar.score}/20</td>
                                <td>{pillar.interpretation}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="es-print-footer">
                    <h4>Disclaimer</h4>
                    {DISCLAIMER_TEXT.map((line) => <p key={line}>{line}</p>)}
                    <div className="es-footer-bar">
                        <span>Finbrella Financial Readiness Report</span>
                        <span>{new Date().toLocaleDateString('en-IN')}</span>
                    </div>
                </div>
            </section>

            <style>{`
                .es-container { width: 100%; background: #fff; }
                .es-hero { max-width: 1000px; margin: 0 auto; padding: 3.5rem 2rem 2rem; text-align: center; }
                .es-eyebrow { color: var(--color-2); font-weight: 700; font-size: 0.8rem; letter-spacing: 0.18em; margin-bottom: 1rem; }
                .es-title { font-size: clamp(1.6rem, 3vw, 2.35rem); margin: 0 0 1.5rem; color: var(--text-main); }
                .es-score-wrap { display: flex; gap: 2rem; align-items: center; justify-content: center; flex-wrap: wrap; margin-bottom: 1rem; }
                .es-score-ring {
                    --size: 180px;
                    width: var(--size);
                    height: var(--size);
                    border-radius: 50%;
                    display: grid;
                    place-items: center;
                    background: conic-gradient(#00a9f2 calc(var(--es-score) * 1%), #e2e8f0 0);
                }
                .es-score-core {
                    width: calc(var(--size) - 24px);
                    height: calc(var(--size) - 24px);
                    border-radius: 50%;
                    background: #fff;
                    display: flex;
                    align-items: baseline;
                    justify-content: center;
                    gap: 0.15rem;
                }
                .es-score-value { font-size: 2.8rem; font-weight: 800; color: var(--text-main); line-height: 1; margin-top: 0.7rem; }
                .es-score-max { font-size: 1.05rem; color: var(--text-muted); font-weight: 700; }
                .es-score-info { max-width: 380px; text-align: left; }
                .es-score-band { display: inline-block; padding: 0.35rem 0.85rem; border-radius: 999px; background: #e0f2fe; color: #0369a1; font-weight: 700; margin-bottom: 0.75rem; }
                .es-score-note { margin: 0; color: var(--text-muted); line-height: 1.7; }
                .es-narrative {
                    max-width: 880px;
                    margin: 1rem auto 0;
                    padding: 1rem 1.15rem;
                    background: linear-gradient(135deg, #f8fafc, #fff);
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    font-size: 1rem;
                    line-height: 1.75;
                    color: var(--text-main);
                }

                .es-pillars { max-width: 1080px; margin: 0 auto; padding: 1rem 2rem 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; }
                .es-pillar-card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 1rem; background: #fff; }
                .es-pillar-head { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.8rem; }
                .es-pillar-icon { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: #f0f9ff; color: #0369a1; }
                .es-pillar-head h3 { margin: 0; font-size: 0.95rem; }
                .es-pill-band { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
                .es-band-critical { color: #dc2626; }
                .es-band-needs-attention { color: #d97706; }
                .es-band-progressing { color: #2563eb; }
                .es-band-strong { color: #16a34a; }
                .es-pillar-score { margin-left: auto; font-size: 1.1rem; font-weight: 800; color: var(--text-main); }
                .es-pillar-meter { height: 8px; background: #f1f5f9; border-radius: 999px; overflow: hidden; margin-bottom: 0.65rem; }
                .es-pillar-fill { height: 100%; background: linear-gradient(90deg, #38bdf8, #0ea5e9); }
                .es-pillar-metric { margin: 0 0 0.4rem; color: var(--text-muted); font-size: 0.84rem; }
                .es-pillar-text { margin: 0; color: var(--text-main); line-height: 1.6; font-size: 0.9rem; }
                .es-pillar-note { margin: 0.55rem 0 0; color: #b45309; font-size: 0.76rem; font-weight: 600; }

                .es-chart-panel, .es-actions, .es-roadmap, .es-benchmark, .es-export, .es-trend, .es-uplift, .es-simulator, .es-confidence { max-width: 1080px; margin: 0 auto; padding: 2rem; }
                .es-chart-panel h3, .es-actions h3, .es-roadmap h3, .es-benchmark h3, .es-export h3, .es-trend h3, .es-uplift h3, .es-simulator h3, .es-confidence h3 { margin: 0 0 1rem; font-size: 1.05rem; color: var(--text-main); }
                .es-chart-wrap { border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; padding: 0.8rem; }
                .es-actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
                .es-rec-list { max-width: 1080px; }
                .es-action-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; background: linear-gradient(135deg, #f8fafc, #fff); }
                .es-action-step { display: inline-block; margin-bottom: 0.5rem; font-size: 0.75rem; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 0.05em; }
                .es-action-card p { margin: 0; line-height: 1.65; color: var(--text-main); font-size: 0.9rem; }
                .es-confidence-grid { display: grid; grid-template-columns: 260px 1fr; gap: 1rem; }
                .es-confidence-meter { border: 1px solid #e2e8f0; border-radius: 14px; padding: 1rem; text-align: center; }
                .es-confidence-ring { width: 150px; height: 150px; border-radius: 50%; margin: 0 auto; display: grid; place-items: center; background: conic-gradient(#22c55e calc(var(--es-confidence) * 1%), #e2e8f0 0); }
                .es-confidence-core { width: 126px; height: 126px; border-radius: 50%; background: #fff; display: grid; place-items: center; font-weight: 800; }
                .es-confidence-band { margin: 0.65rem 0 0; font-size: 0.88rem; color: var(--text-muted); font-weight: 700; }
                .es-confidence-pillars { border: 1px solid #e2e8f0; border-radius: 14px; padding: 1rem; display: grid; gap: 0.5rem; }
                .es-confidence-row { display: flex; justify-content: space-between; font-size: 0.9rem; }
                .es-simulator-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 1rem; }
                .es-sim-controls { border: 1px solid #e2e8f0; border-radius: 14px; padding: 1rem; display: grid; gap: 0.8rem; }
                .es-sim-controls label { font-size: 0.82rem; color: var(--text-muted); display: grid; gap: 0.35rem; }
                .es-sim-controls input { width: 100%; }
                .es-sim-controls span { font-weight: 700; color: var(--text-main); font-size: 0.88rem; }
                .es-sim-result { border: 1px solid #e2e8f0; border-radius: 14px; padding: 1rem; display: grid; gap: 0.75rem; align-content: start; }
                .es-sim-card { background: #f8fafc; border-radius: 10px; padding: 0.75rem; display: flex; justify-content: space-between; align-items: center; }
                .es-reset-btn { border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.45rem 0.65rem; background: #fff; color: #0f172a; cursor: pointer; font-size: 0.8rem; font-weight: 600; justify-self: start; }
                .es-sim-card strong { font-size: 1.05rem; }
                .es-sim-uplift { font-size: 1.3rem; font-weight: 800; color: var(--text-main); }
                .es-uplift-pos { color: #16a34a; }
                .es-uplift-neg { color: #dc2626; }
                .es-sim-band { margin: 0; color: var(--text-muted); font-size: 0.9rem; }
                .es-uplift-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
                .es-uplift-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; background: #fff; }
                .es-uplift-card p { margin: 0 0 0.5rem; font-size: 0.9rem; color: var(--text-main); }
                .es-uplift-meta { display: flex; justify-content: space-between; font-size: 0.76rem; color: var(--text-muted); margin-bottom: 0.4rem; }
                .es-uplift-card strong { color: #16a34a; font-size: 1.15rem; }
                .es-trend-note { margin: 0 0 0.8rem; font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.4rem; }
                .es-roadmap-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
                .es-roadmap-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; }
                .es-roadmap-card h4 { margin: 0 0 0.5rem; font-size: 0.95rem; }
                .es-roadmap-card ul { margin: 0; padding-left: 1.1rem; line-height: 1.7; font-size: 0.9rem; color: var(--text-main); }
                .es-benchmark-card { border: 1px dashed #94a3b8; border-radius: 12px; padding: 1rem; display: flex; gap: 0.75rem; background: #f8fafc; }
                .es-benchmark-card strong { display: block; margin-bottom: 0.3rem; }
                .es-benchmark-card p { margin: 0; color: var(--text-muted); font-size: 0.9rem; }
                .es-export-btn { border: none; background: var(--primary); color: #fff; border-radius: 10px; padding: 0.7rem 1rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; }

                .es-print-sheet { display: none; }

                @media (max-width: 768px) {
                    .es-hero, .es-pillars, .es-chart-panel, .es-actions, .es-roadmap, .es-benchmark, .es-export, .es-trend, .es-uplift, .es-simulator, .es-confidence { padding-left: 1.2rem; padding-right: 1.2rem; }
                    .es-score-info { text-align: center; }
                    .es-pillar-head { align-items: flex-start; }
                    .es-confidence-grid, .es-simulator-grid { grid-template-columns: 1fr; }
                }

                @media print {
                    body * { visibility: hidden !important; }
                    .es-print-sheet, .es-print-sheet * { visibility: visible !important; }
                    .es-print-sheet {
                        display: block !important;
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        padding: 18px;
                        background: #fff;
                        color: #111827;
                    }
                    .es-print-header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px; }
                    .es-print-header img { width: 120px; max-height: 50px; object-fit: contain; }
                    .es-print-header h2 { margin: 0; font-size: 22px; }
                    .es-print-header p { margin: 4px 0 0; font-size: 12px; color: #475569; }
                    .es-print-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
                    .es-print-kpis div { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; }
                    .es-print-kpis span { display: block; font-size: 11px; color: #64748b; margin-bottom: 2px; }
                    .es-print-kpis strong { font-size: 15px; }
                    .es-print-narrative { font-size: 12px; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; margin: 0 0 10px; }
                    .es-print-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                    .es-print-table th, .es-print-table td { border: 1px solid #e2e8f0; padding: 6px; font-size: 11px; vertical-align: top; }
                    .es-print-table th { background: #f8fafc; text-align: left; }
                    .es-print-footer h4 { margin: 0 0 6px; font-size: 12px; }
                    .es-print-footer p { margin: 0 0 4px; font-size: 10px; color: #334155; line-height: 1.45; }
                    .es-footer-bar { margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 6px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
                }
            `}</style>
        </div>
    );
};

export default ExecutiveSummarySection;
