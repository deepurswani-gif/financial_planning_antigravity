import React, { useMemo, useRef, useEffect, useState } from 'react';
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
import LifeJourneySection from './LifeJourneySection';
import YourMoneyFlowVisuals from './YourMoneyFlowVisuals';
import InvestSurplusReportContent from './InvestSurplusReportContent';
import ReportAnimatedCounter from './ReportAnimatedCounter';

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
            { key: 'income', label: 'Net Income', role: 'detail', field: 'income' },
            { key: 'taxAdjustment', label: 'Tax Adjustment', role: 'detail', field: 'taxAdjustment', highlightNonZero: true },
            { key: 'adjustedIncome', label: 'Adjusted Net Income', role: 'subtotal', field: 'adjustedIncome' },
        ],
    },
    {
        id: 'expenses',
        label: 'EXPENSES',
        rows: [
            { key: 'household', label: 'Household & Lifestyle', role: 'detail', field: 'household' },
            { key: 'emi', label: 'EMIs', role: 'detail', field: 'emi' },
            { key: 'insurance', label: 'Insurance Premiums', role: 'detail', field: 'insurance' },
        ],
    },
    {
        id: 'savings',
        label: 'SAVINGS',
        rows: [
            { key: 'savings', label: 'Savings & Investments', role: 'detail', field: 'savings' },
        ],
    },
    {
        id: 'result',
        label: 'RESULT',
        rows: [
            { key: 'unallocatedSurplus', label: 'Unallocated Surplus (Free Cash Flow)', role: 'result', field: 'unallocatedSurplus' },
        ],
    },
];

const KpiPill = ({ label, value, tone = 'primary', icon: Icon, animate = false }) => (
    <div className="ymf-kpi-pill">
        {Icon && <Icon size={20} style={{ opacity: 0.85 }} />}
        <div>
            <span className="ymf-kpi-label">{label}</span>
            <strong className={`ymf-kpi-value ymf-tone-${tone}`}>
                {animate ? <ReportAnimatedCounter value={value} /> : formatCell(value)}
            </strong>
        </div>
    </div>
);

const GroupHeaderRow = ({ label, colSpan }) => (
    <tr className="ymf-group-row">
        <td className="ymf-group-label ymf-sticky-col">{label}</td>
        <td colSpan={colSpan} className="ymf-group-spacer" />
    </tr>
);

const LedgerRow = ({
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
            <span>{label}</span>
        </td>
        {values.map((val, idx) => {
            const col = columns[idx];
            const isNow = col?.isCurrent;
            const isPlanStartCol = viewMode === VIEW_MODES.MONTHLY && col?.idx === planStartMonth;
            const isNegative = role === 'result' && val !== null && val < 0;
            const isTaxColored = highlightNonZero && val !== null && val !== 0;
            const taxNegative = isTaxColored && val < 0;
            const taxPositive = isTaxColored && val > 0;
            return (
                <td
                    key={`${label}-${col?.label ?? idx}`}
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
    const scrollRef = useRef(null);
    const [viewMode, setViewMode] = useState(VIEW_MODES.MONTHLY);
    const [showAllMonthlyCols, setShowAllMonthlyCols] = useState(false);
    const [ledgerMobileView, setLedgerMobileView] = useState('card'); // 'card' | 'table'

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

    const rawColumns = useMemo(
        () => getViewColumns(viewMode, meta.currentMonth),
        [viewMode, meta.currentMonth],
    );

    const columns = useMemo(() => {
        if (viewMode !== VIEW_MODES.MONTHLY || showAllMonthlyCols) {
            return rawColumns;
        }
        return rawColumns.filter(
            (col) => col.isCurrent || col.idx === meta.planStartMonth,
        );
    }, [viewMode, showAllMonthlyCols, rawColumns, meta.planStartMonth]);

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

    const handleInsightClick = (target) => {
        if (!target) return;
        const elem = document.querySelector(target);
        if (elem) {
            elem.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="ymf-section">
            <div className="ymf-hero card">
                <div className="ymf-hero-top">
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Your Money Flow</h2>
                        <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                            Let&apos;s understand how money supports your family&apos;s life throughout this year.
                        </p>
                    </div>
                </div>

                <div className="ymf-kpi-grid">
                    <KpiPill label="Monthly Net Income" value={baseline.monthlyNetIncome} icon={TrendingUp} animate />
                    <KpiPill label="Total Outflow" value={totalOutflow} tone="danger" icon={Wallet} />
                    <KpiPill label="Free Cash Flow (Now)" value={currentUnallocated} tone="accent" icon={ArrowDownRight} animate />
                </div>
            </div>

            <YourMoneyFlowVisuals ledger={ledger} meta={meta} baseline={baseline} />

            <div className="ymf-table-card card">
                <div className="ymf-table-header">
                    <div className="ymf-table-header-row">
                        <div>
                            <h3 style={{ margin: 0 }}>Current Year Tracking Ledger</h3>
                            <p className="ymf-legend">
                                Comprehensive accounting detail for your annual cash flow.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div className="ymf-mobile-toggle-btn">
                                <button
                                    type="button"
                                    className={`ymf-view-btn ${ledgerMobileView === 'card' ? 'active' : ''}`}
                                    onClick={() => setLedgerMobileView('card')}
                                >
                                    Cards
                                </button>
                                <button
                                    type="button"
                                    className={`ymf-view-btn ${ledgerMobileView === 'table' ? 'active' : ''}`}
                                    onClick={() => setLedgerMobileView('table')}
                                >
                                    Table
                                </button>
                            </div>
                            {viewMode === VIEW_MODES.MONTHLY && ledgerMobileView === 'table' && (
                                <button
                                    type="button"
                                    className="ymf-view-btn"
                                    style={{ border: '1px solid var(--border)', background: showAllMonthlyCols ? 'var(--bg-card)' : 'transparent' }}
                                    onClick={() => setShowAllMonthlyCols((v) => !v)}
                                >
                                    {showAllMonthlyCols ? 'Focus current month' : 'Show all 12 months'}
                                </button>
                            )}
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
                </div>

                {ledgerMobileView === 'card' && (
                    <div className="ymf-mobile-card-grid">
                        {ROW_GROUPS.map((group) => (
                            <div key={group.id} className="ymf-mob-group-card">
                                <div className="ymf-mob-group-header">
                                    <span>{group.label}</span>
                                </div>
                                <div className="ymf-mob-group-body">
                                    {group.rows.map((row) => {
                                        const rawValues = ledger[row.field];
                                        const currentVal = rawValues[meta.currentMonth];
                                        const ytdValue = computeYtdTotal(
                                            rawValues,
                                            meta.planStartMonth,
                                            meta.currentMonth,
                                        );
                                        const isResult = row.role === 'result';
                                        const isSubtotal = row.role === 'subtotal';

                                        return (
                                            <div
                                                key={row.key}
                                                className={[
                                                    'ymf-mob-ledger-row',
                                                    isSubtotal ? 'ymf-mob-subtotal' : '',
                                                    isResult ? 'ymf-mob-result' : '',
                                                ].filter(Boolean).join(' ')}
                                            >
                                                <div className="ymf-mob-row-title-wrap">
                                                    <span className="ymf-mob-row-title">{row.label}</span>
                                                </div>
                                                <div className="ymf-mob-row-metrics">
                                                    <div>
                                                        <span className="ymf-mob-metric-lbl">Now ({meta.currentMonthLabel.slice(0, 3)})</span>
                                                        <strong className={currentVal < 0 ? 'ymf-cell-negative' : ''}>
                                                            {formatCell(currentVal)}
                                                        </strong>
                                                    </div>
                                                    <div>
                                                        <span className="ymf-mob-metric-lbl">YTD ({ytdStartLabel}–{ytdEndLabel})</span>
                                                        <strong className={ytdValue < 0 ? 'ymf-cell-negative' : ''}>
                                                            {formatCell(ytdValue)}
                                                        </strong>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className={`ymf-table-scroll ${ledgerMobileView === 'card' ? 'ymf-hide-mobile-card' : ''}`} ref={scrollRef}>
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
                                        const filteredDisplayValues = viewMode === VIEW_MODES.MONTHLY && !showAllMonthlyCols
                                            ? columns.map((c) => displayValues[c.idx])
                                            : displayValues;
                                        const ytdValue = computeYtdTotal(
                                            rawValues,
                                            meta.planStartMonth,
                                            meta.currentMonth,
                                        );
                                        return (
                                            <LedgerRow
                                                key={row.key}
                                                label={row.label}
                                                values={filteredDisplayValues}
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

            <div className="ymf-section-divider" aria-hidden="true">
                <span className="ymf-section-divider-line" />
            </div>

            <LifeJourneySection />

            <InvestSurplusReportContent />

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
                .ymf-row-subtotal .ymf-sticky-col { background: linear-gradient(rgba(37,99,235,0.04), rgba(37,99,235,0.04)), var(--bg-card, #ffffff) !important; }
                .ymf-row-result { background: rgba(16,185,129,0.06); }
                .ymf-row-result .ymf-sticky-col { background: linear-gradient(rgba(16,185,129,0.06), rgba(16,185,129,0.06)), var(--bg-card, #ffffff) !important; }
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
                .ymf-insight-action-btn {
                    display: inline-flex; align-items: center; gap: 0.4rem;
                    background: transparent; border: none; padding: 0;
                    color: var(--primary); font-size: inherit; font-weight: 600;
                    cursor: pointer; text-decoration: underline; text-underline-offset: 3px;
                }
                .ymf-insight-action-btn:hover { color: var(--accent, #7c3aed); }

                .dr-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.65s cubic-bezier(0.16,1,0.3,1), transform 0.65s cubic-bezier(0.16,1,0.3,1); }
                .dr-reveal.dr-visible { opacity: 1; transform: translateY(0); }
                .dr-chart-title { margin: 0 0 0.35rem; font-size: 1rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem; color: var(--text-main); }
                .dr-chart-sub { margin: 0 0 1rem; font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; }
                .dr-chart-wrap { width: 100%; min-height: 200px; }
                .dr-chart-wrap-sm { min-height: 240px; }
                /* Scope under .ymf-section so keep-alive sibling report styles cannot override tooltip colors */
                .ymf-section .dr-chart-tooltip { background: var(--text-main); color: #fff; padding: 0.55rem 0.85rem; border-radius: 8px; font-size: 0.82rem; line-height: 1.5; }
                .ymf-section .dr-chart-tooltip-label { font-weight: 700; margin-bottom: 0.25rem; }
                .dr-chart-legend { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.75rem; font-size: 0.78rem; color: var(--text-muted); }
                .dr-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.35rem; vertical-align: middle; }
                .dr-dot-income { background: #2563EB; }
                .dr-dot-outflow { background: #EF4444; }
                .dr-dot-surplus { background: #7C3AED; }
                .dr-animated-counter { font-size: inherit; }
                .ymf-visuals { display: flex; flex-direction: column; gap: 1.25rem; }
                .ymf-visual-card { padding: 1.25rem; }
                .ymf-visual-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; }
                .ymf-section-divider { padding: 0.5rem 1rem; margin-top: 1rem; }
                .ymf-section-divider-line { display: block; height: 1px; background: linear-gradient(90deg, transparent, var(--border), transparent); }
                .dr-donut-wrap { position: relative; max-width: 220px; margin: 0 auto; }
                .dr-donut-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
                .dr-donut-center strong { font-size: 1.75rem; color: var(--primary); line-height: 1; }
                .dr-donut-center span { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem; }
                .ymf-mobile-toggle-btn { display: none; gap: 0; background: var(--bg-main); padding: 4px; border-radius: 8px; border: 1px solid var(--border); flex-shrink: 0; }
                .ymf-mobile-card-grid { display: flex; flex-direction: column; gap: 1rem; margin-top: 0.5rem; }
                .ymf-mob-group-card { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--bg-card); }
                .ymf-mob-group-header { padding: 0.5rem 0.85rem; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); letter-spacing: 0.05em; background: rgba(0,0,0,0.03); border-bottom: 1px solid var(--border); }
                .ymf-mob-group-body { display: flex; flex-direction: column; }
                .ymf-mob-ledger-row { display: flex; flex-direction: column; padding: 0.65rem 0.85rem; border-bottom: 1px solid var(--border); gap: 0.35rem; }
                .ymf-mob-ledger-row:last-child { border-bottom: none; }
                .ymf-mob-subtotal { background: rgba(37,99,235,0.04); }
                .ymf-mob-result { background: rgba(16,185,129,0.06); }
                .ymf-mob-row-title { font-size: 0.88rem; font-weight: 600; color: var(--text-main); }
                .ymf-mob-row-metrics { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.82rem; }
                .ymf-mob-metric-lbl { display: block; font-size: 0.7rem; color: var(--text-muted); }

                @media (max-width: 640px) {
                    .ymf-mobile-toggle-btn { display: flex; }
                    .ymf-hide-mobile-card { display: none; }
                    .ymf-sticky-col, .ymf-th-label { min-width: 140px; max-width: 140px; }
                }
            `}</style>
        </div>
    );
};

export default YourMoneyFlowSection;
