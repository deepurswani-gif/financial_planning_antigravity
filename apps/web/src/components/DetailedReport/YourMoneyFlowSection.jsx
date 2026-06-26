import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowDownRight,
    Calendar,
    Info,
    TrendingUp,
    Wallet,
    ArrowRight,
    Lightbulb,
    AlertTriangle,
    CheckCircle2,
} from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { resolveEmploymentType } from '../DetailedFlow/employmentTypeSync';
import {
    buildYourMoneyFlowReport,
    computeMoneyFlowInsights,
    computeYtdTotal,
    getDisplayValues,
    getViewColumns,
    VIEW_MODES,
} from './moneyFlowLedgerLogic';
import { INVEST_UNALLOCATED_SURPLUS_PATH } from './detailedReportSteps';

const TAX_ADJUSTMENT_NOTE =
    "Your previous year's tax return is assumed to be filed this year. Any tax adjustment will be applied from the next assessment year.";

const VIEW_OPTIONS = [
    { id: VIEW_MODES.MONTHLY, label: 'Monthly' },
    { id: VIEW_MODES.QUARTERLY, label: 'Quarterly' },
    { id: VIEW_MODES.ANNUAL, label: 'Annual' },
];

const formatCell = (value) => {
    if (value === null || value === undefined) return '';
    return formatCurrency(Math.round(value));
};

const ROW_GROUPS = [
    {
        id: 'income',
        label: 'INCOME',
        rows: [
            { key: 'income', label: 'Net Income', sign: '(+)', role: 'detail', field: 'income' },
            { key: 'taxAdjustment', label: 'Tax Adjustment', sign: '(±)', role: 'detail', field: 'taxAdjustment', highlightNonZero: true },
            { key: 'adjustedIncome', label: 'Adjusted Net Income', sign: '(=)', role: 'subtotal', field: 'adjustedIncome' },
        ],
    },
    {
        id: 'expenses',
        label: 'EXPENSES',
        rows: [
            { key: 'household', label: 'Household & Lifestyle', sign: '(−)', role: 'detail', field: 'household' },
            { key: 'emi', label: 'EMIs', sign: '(−)', role: 'detail', field: 'emi' },
            { key: 'insurance', label: 'Insurance Premiums', sign: '(−)', role: 'detail', field: 'insurance' },
        ],
    },
    {
        id: 'savings',
        label: 'SAVINGS',
        rows: [
            { key: 'savings', label: 'Savings & Investments', sign: '(−)', role: 'detail', field: 'savings' },
        ],
    },
    {
        id: 'result',
        label: 'RESULT',
        rows: [
            { key: 'unallocatedSurplus', label: 'Unallocated Surplus (Free Cash Flow)', sign: '(=)', role: 'result', field: 'unallocatedSurplus' },
        ],
    },
];

const KpiPill = ({ label, value, tone = 'primary', icon: Icon }) => (
    <div className="ymf-kpi-pill">
        {Icon && <Icon size={20} style={{ opacity: 0.85 }} />}
        <div>
            <span className="ymf-kpi-label">{label}</span>
            <strong className={`ymf-kpi-value ymf-tone-${tone}`}>{formatCell(value)}</strong>
        </div>
    </div>
);

const InvestSurplusCard = ({ onClick }) => (
    <button type="button" className="ymf-kpi-pill ymf-invest-card" onClick={onClick}>
        <ArrowRight size={20} style={{ opacity: 0.85, color: 'var(--primary)' }} />
        <div>
            <span className="ymf-kpi-label">Ready to deploy?</span>
            <strong className="ymf-invest-label">Invest free cash flow</strong>
        </div>
    </button>
);

const GroupHeaderRow = ({ label, colSpan }) => (
    <tr className="ymf-group-row">
        <td className="ymf-group-label ymf-sticky-col">{label}</td>
        <td colSpan={colSpan} className="ymf-group-spacer" />
    </tr>
);

const LedgerRow = ({
    sign,
    label,
    values,
    ytdValue,
    role,
    highlightNonZero,
    columns,
    planStartMonth,
    viewMode,
}) => (
    <tr className={`ymf-data-row ymf-row-${role}`}>
        <td className={`ymf-row-label ymf-sticky-col ymf-row-${role}`}>
            <span className="ymf-sign">{sign}</span>
            <span>{label}</span>
        </td>
        {values.map((val, idx) => {
            const col = columns[idx];
            const isNow = col?.isCurrent;
            const isPlanStartCol = viewMode === VIEW_MODES.MONTHLY && idx === planStartMonth;
            const isNegative = role === 'result' && val !== null && val < 0;
            const isTaxColored = highlightNonZero && val !== null && val !== 0;
            const taxNegative = isTaxColored && val < 0;
            const taxPositive = isTaxColored && val > 0;
            return (
                <td
                    key={`${label}-${idx}`}
                    className={[
                        'ymf-cell',
                        isNow ? 'ymf-cell-now' : '',
                        isPlanStartCol && !isNow ? 'ymf-cell-plan-start' : '',
                        isNegative ? 'ymf-cell-result-negative' : '',
                        taxNegative ? 'ymf-cell-negative' : '',
                        taxPositive ? 'ymf-cell-positive' : '',
                    ].filter(Boolean).join(' ')}
                >
                    {formatCell(val)}
                </td>
            );
        })}
        <td
            className={[
                'ymf-cell ymf-cell-ytd',
                role === 'subtotal' ? 'ymf-row-subtotal' : '',
                role === 'result' ? 'ymf-row-result' : '',
                role === 'result' && ytdValue !== null && ytdValue < 0 ? 'ymf-cell-result-negative' : '',
            ].filter(Boolean).join(' ')}
        >
            {formatCell(ytdValue)}
        </td>
    </tr>
);

const InsightIcon = ({ tone }) => {
    if (tone === 'warning') return <AlertTriangle size={16} className="ymf-insight-icon ymf-insight-warning" />;
    if (tone === 'positive') return <CheckCircle2 size={16} className="ymf-insight-icon ymf-insight-positive" />;
    if (tone === 'accent') return <ArrowRight size={16} className="ymf-insight-icon ymf-insight-accent" />;
    return <Lightbulb size={16} className="ymf-insight-icon" />;
};

const YourMoneyFlowSection = () => {
    const navigate = useNavigate();
    const scrollRef = useRef(null);
    const [viewMode, setViewMode] = useState(VIEW_MODES.MONTHLY);

    const {
        currentYearLedger,
        planStartMonth,
        familyMembers,
        income,
        expenseCategories,
        hasSpouseIncome,
        journeyProjections,
    } = useFinancialPlan();

    const report = useMemo(
        () => buildYourMoneyFlowReport({
            currentYearLedger,
            planStartMonth,
            familyMembers,
            income,
            expenseCategories,
            hasSpouseIncome,
            resolveEmploymentType,
            journeyProjections,
        }),
        [
            currentYearLedger,
            planStartMonth,
            familyMembers,
            income,
            expenseCategories,
            hasSpouseIncome,
            journeyProjections,
        ],
    );

    const { meta, baseline, ledger } = report;
    const insights = useMemo(() => computeMoneyFlowInsights(report), [report]);

    const columns = useMemo(
        () => getViewColumns(viewMode, meta.currentMonth),
        [viewMode, meta.currentMonth],
    );

    const totalDataCols = columns.length + 1;

    const currentUnallocated = meta.currentMonth >= meta.planStartMonth
        ? (ledger.unallocatedSurplus[meta.currentMonth] || 0)
        : 0;
    const totalOutflow = baseline.monthlyHousehold
        + baseline.monthlyEmi
        + baseline.monthlyInsurance
        + baseline.monthlySavings;

    const ytdStartLabel = meta.planStartMonth > 0
        ? meta.planStartMonthLabel.slice(0, 3)
        : 'Jan';
    const ytdEndLabel = meta.currentMonthLabel.slice(0, 3);

    useEffect(() => {
        if (viewMode !== VIEW_MODES.MONTHLY || !scrollRef.current) return;
        const nowCol = scrollRef.current.querySelector('.ymf-col-now');
        if (nowCol) {
            nowCol.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, [viewMode, meta.currentMonth]);

    return (
        <div className="ymf-section">
            <div className="ymf-hero card">
                <div className="ymf-hero-top">
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Your Money Flow</h2>
                        <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>
                            Monthly tracking for calendar year {meta.calendarYear}
                        </p>
                    </div>
                    <div className="ymf-badges">
                        <span className="ymf-badge ymf-badge-plan">
                            <Calendar size={14} />
                            Plan Start: {meta.planStartMonthLabel.slice(0, 3)}
                        </span>
                        <span className="ymf-badge ymf-badge-now">
                            Now: {meta.currentMonthLabel.slice(0, 3)}
                        </span>
                    </div>
                </div>

                <div className="ymf-kpi-grid">
                    <KpiPill label="Monthly Net Income" value={baseline.monthlyNetIncome} icon={TrendingUp} />
                    <KpiPill label="Total Outflow" value={totalOutflow} tone="danger" icon={Wallet} />
                    <KpiPill label="Free Cash Flow (Now)" value={currentUnallocated} tone="accent" icon={ArrowDownRight} />
                    <InvestSurplusCard onClick={() => navigate(INVEST_UNALLOCATED_SURPLUS_PATH)} />
                </div>
            </div>

            <div className="ymf-table-card card">
                <div className="ymf-table-header">
                    <div className="ymf-table-header-row">
                        <div>
                            <h3 style={{ margin: 0 }}>Current Year Tracking Ledger</h3>
                            <p className="ymf-legend">
                                <span className="ymf-legend-item"><span className="ymf-sign">(+)</span> inflow</span>
                                <span className="ymf-legend-item"><span className="ymf-sign">(−)</span> outflow</span>
                                <span className="ymf-legend-item"><span className="ymf-sign">(=)</span> subtotal / result</span>
                            </p>
                        </div>
                        <div className="ymf-view-toggle" role="group" aria-label="Ledger view">
                            {VIEW_OPTIONS.map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    className={`ymf-view-btn ${viewMode === opt.id ? 'active' : ''}`}
                                    onClick={() => setViewMode(opt.id)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="ymf-table-scroll" ref={scrollRef}>
                    <table className="ymf-table">
                        <thead>
                            <tr>
                                <th className="ymf-sticky-col ymf-th-label">Category (₹)</th>
                                {columns.map((col) => (
                                    <th
                                        key={col.label}
                                        className={[
                                            col.isCurrent ? 'ymf-col-now' : '',
                                            viewMode === VIEW_MODES.MONTHLY
                                                && col.idx === meta.planStartMonth
                                                && !col.isCurrent
                                                ? 'ymf-col-plan-start'
                                                : '',
                                        ].filter(Boolean).join(' ')}
                                    >
                                        <span className="ymf-col-label">{col.label}</span>
                                        {col.isCurrent && (
                                            <span className="ymf-now-badge">
                                                <Calendar size={10} />
                                                Current
                                            </span>
                                        )}
                                        {viewMode === VIEW_MODES.MONTHLY
                                            && col.idx === meta.planStartMonth
                                            && !col.isCurrent && (
                                            <span className="ymf-start-badge">Start</span>
                                        )}
                                    </th>
                                ))}
                                <th className="ymf-col-ytd">
                                    <span className="ymf-col-label">YTD</span>
                                    <span className="ymf-ytd-sub">{ytdStartLabel}–{ytdEndLabel}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {ROW_GROUPS.map((group) => (
                                <React.Fragment key={group.id}>
                                    <GroupHeaderRow label={group.label} colSpan={totalDataCols} />
                                    {group.rows.map((row) => {
                                        const rawValues = ledger[row.field];
                                        const displayValues = getDisplayValues(
                                            rawValues,
                                            viewMode,
                                            meta.planStartMonth,
                                        );
                                        const ytdValue = computeYtdTotal(
                                            rawValues,
                                            meta.planStartMonth,
                                            meta.currentMonth,
                                        );
                                        return (
                                            <LedgerRow
                                                key={row.key}
                                                sign={row.sign}
                                                label={row.label}
                                                values={displayValues}
                                                ytdValue={ytdValue}
                                                role={row.role}
                                                highlightNonZero={row.highlightNonZero}
                                                columns={columns}
                                                planStartMonth={meta.planStartMonth}
                                                viewMode={viewMode}
                                            />
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="card ymf-note-card">
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
                        <strong>Tax adjustment:</strong> {TAX_ADJUSTMENT_NOTE}
                    </p>
                </div>
            </div>

            {insights.length > 0 && (
                <div className="card ymf-insights-card">
                    <h4 className="ymf-insights-title">
                        <Lightbulb size={18} />
                        Insights
                    </h4>
                    <ul className="ymf-insights-list">
                        {insights.map((item) => (
                            <li key={item.id} className={`ymf-insight ymf-insight-${item.tone}`}>
                                <InsightIcon tone={item.tone} />
                                <span>{item.text}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <style>{`
                .ymf-section { display: flex; flex-direction: column; gap: 1.5rem; padding: 0 1rem; }
                .ymf-hero { padding: 1.5rem; background: linear-gradient(135deg, rgba(37,99,235,0.06), rgba(16,185,129,0.04)); }
                .ymf-hero-top { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
                .ymf-badges { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
                .ymf-badge { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.65rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; }
                .ymf-badge-plan { background: var(--primary); color: white; }
                .ymf-badge-now { background: rgba(16,185,129,0.15); color: #059669; }
                .ymf-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
                .ymf-kpi-pill { display: flex; gap: 0.75rem; align-items: center; padding: 1rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; }
                .ymf-invest-card { cursor: pointer; text-align: left; width: 100%; transition: border-color 0.2s, box-shadow 0.2s; }
                .ymf-invest-card:hover { border-color: var(--primary); box-shadow: 0 4px 12px rgba(37,99,235,0.12); }
                .ymf-kpi-label { display: block; font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.2rem; }
                .ymf-kpi-value { font-size: 1.15rem; }
                .ymf-invest-label { font-size: 1rem; color: var(--primary); }
                .ymf-tone-primary { color: var(--primary); }
                .ymf-tone-danger { color: #ef4444; }
                .ymf-tone-accent { color: var(--accent, #7c3aed); }

                .ymf-table-card { padding: 1.25rem; }
                .ymf-table-header { margin-bottom: 1rem; }
                .ymf-table-header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
                .ymf-legend { margin: 0.35rem 0 0; color: var(--text-muted); font-size: 0.85rem; display: flex; gap: 1rem; flex-wrap: wrap; }
                .ymf-legend-item { display: inline-flex; align-items: center; gap: 0.25rem; }
                .ymf-sign { color: var(--text-muted); font-weight: 600; font-size: 0.78rem; margin-right: 0.35rem; flex-shrink: 0; }

                .ymf-view-toggle { display: flex; gap: 0; background: var(--bg-main); padding: 4px; border-radius: 8px; border: 1px solid var(--border); flex-shrink: 0; }
                .ymf-view-btn { padding: 0.45rem 0.85rem; border: none; border-radius: 6px; background: transparent; color: var(--text-muted); font-weight: 600; font-size: 0.82rem; cursor: pointer; transition: all 0.15s; }
                .ymf-view-btn.active { background: var(--primary); color: white; }
                .ymf-view-btn:hover:not(.active) { color: var(--text-main); }

                .ymf-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--border); border-radius: 8px; }
                .ymf-table { width: 100%; min-width: 960px; border-collapse: separate; border-spacing: 0; font-size: 0.82rem; }
                .ymf-table th, .ymf-table td { padding: 0.6rem 0.5rem; border-bottom: 1px solid var(--border); text-align: right; white-space: nowrap; }
                .ymf-table thead th { background: var(--bg-main); font-weight: 600; position: sticky; top: 0; z-index: 3; }

                .ymf-sticky-col { position: sticky; left: 0; z-index: 2; text-align: left !important; box-shadow: 1px 0 0 var(--border); background: var(--bg-card); min-width: 220px; }
                .ymf-table thead .ymf-sticky-col { z-index: 4; background: var(--bg-main); }
                .ymf-th-label { min-width: 240px; }

                .ymf-group-row td { padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--border); }
                .ymf-group-label { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; color: var(--text-muted); text-transform: uppercase; background: rgba(0,0,0,0.02) !important; }
                .ymf-group-spacer { background: rgba(0,0,0,0.02); }

                .ymf-row-label { font-weight: 500; color: var(--text-main); display: flex; align-items: center; padding-left: 0.75rem !important; }
                .ymf-row-subtotal .ymf-row-label { font-weight: 700; }
                .ymf-row-result .ymf-row-label { font-weight: 700; }
                .ymf-row-subtotal { background: rgba(37,99,235,0.04); }
                .ymf-row-subtotal .ymf-sticky-col { background: rgba(37,99,235,0.04) !important; }
                .ymf-row-result { background: rgba(16,185,129,0.06); }
                .ymf-row-result .ymf-sticky-col { background: rgba(16,185,129,0.06) !important; }
                .ymf-row-result .ymf-cell { font-weight: 700; }

                .ymf-col-label { display: block; }
                .ymf-now-badge { display: inline-flex; align-items: center; gap: 0.2rem; margin-top: 0.15rem; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.65rem; font-weight: 700; background: var(--primary); color: white; text-transform: uppercase; letter-spacing: 0.03em; }
                .ymf-start-badge { display: inline-block; margin-top: 0.15rem; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.65rem; font-weight: 600; background: rgba(16,185,129,0.15); color: #059669; }
                .ymf-ytd-sub { display: block; font-size: 0.65rem; font-weight: 500; color: var(--text-muted); margin-top: 0.1rem; }
                .ymf-col-ytd { background: rgba(0,0,0,0.03); border-left: 2px solid var(--border); font-weight: 600; }
                .ymf-cell-ytd { background: rgba(0,0,0,0.02); border-left: 2px solid var(--border); font-weight: 600; }

                .ymf-col-now, .ymf-cell-now { background: rgba(37,99,235,0.1) !important; box-shadow: inset 2px 0 0 var(--primary), inset -2px 0 0 var(--primary); }
                .ymf-col-plan-start:not(.ymf-col-now), .ymf-cell-plan-start { box-shadow: inset 0 -2px 0 rgba(16,185,129,0.55); }

                .ymf-cell-negative { color: #ef4444; }
                .ymf-cell-positive { color: #059669; }
                .ymf-cell-result-negative { color: #ef4444 !important; }

                .ymf-note-card { padding: 1.25rem; background: rgba(37,99,235,0.04); border-left: 4px solid var(--primary); }
                .ymf-insights-card { padding: 1.25rem; }
                .ymf-insights-title { margin: 0 0 0.85rem; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--text-main); }
                .ymf-insights-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.65rem; }
                .ymf-insight { display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.9rem; line-height: 1.5; color: var(--text-main); }
                .ymf-insight-icon { flex-shrink: 0; margin-top: 2px; color: var(--text-muted); }
                .ymf-insight-warning .ymf-insight-icon { color: #d97706; }
                .ymf-insight-positive .ymf-insight-icon { color: #059669; }
                .ymf-insight-accent .ymf-insight-icon { color: var(--primary); }
                .ymf-insight-accent { color: var(--primary); font-weight: 500; }
            `}</style>
        </div>
    );
};

export default YourMoneyFlowSection;
