import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Receipt, Percent, Calendar, Calculator } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import {
    buildTaxBreakdownPresentation,
    TAX_BREAKDOWN_COPY,
} from './IncomeTaxLogic';

const formatRate = (rate) => `${Math.round(rate * 100)}%`;

const AccordionSection = ({ title, subtitle, isOpen, onToggle, children }) => (
    <div className="tax-accordion">
        <button type="button" className="tax-accordion-header" onClick={onToggle}>
            <div>
                <h3>{title}</h3>
                {subtitle && <p>{subtitle}</p>}
            </div>
            {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {isOpen && <div className="tax-accordion-body">{children}</div>}
    </div>
);

const StepAmount = ({ step }) => {
    const isNegative = step.amount < 0;
    const color = step.isSaving || isNegative ? 'var(--accent)' : 'var(--text-main)';
    const prefix = isNegative ? '−' : '';
    return (
        <span style={{ color, fontWeight: step.isSubtotal || step.isTotal ? 700 : 600 }}>
            {prefix}{formatCurrency(Math.abs(step.amount))}
        </span>
    );
};

const IncomeTaxOutput = ({ results }) => {
    const breakdown = useMemo(() => buildTaxBreakdownPresentation(results), [results]);
    const activeSlabCount = breakdown.slabBreakdown.filter((s) => s.taxAmount > 0).length;

    const [slabOpen, setSlabOpen] = useState(activeSlabCount <= 3);
    const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);

    if (!results) return null;

    const { insights, calculationSteps, slabBreakdown, adjustments } = breakdown;

    return (
        <div className="income-tax-output" style={{ marginTop: '1rem' }}>
            <div className="tax-hero-card">
                <div className="tax-hero-main">
                    <label>Net Annual Tax Payable</label>
                    <strong style={{ color: results.finalTax > 0 ? '#ef4444' : 'var(--accent)' }}>
                        {formatCurrency(results.finalTax)}
                    </strong>
                </div>
                {insights.summaryNote && (
                    <p className="tax-hero-note">{insights.summaryNote}</p>
                )}
            </div>

            <div className="tax-metrics-row">
                <div className="tax-metric-card">
                    <div className="tax-metric-icon"><Percent size={20} /></div>
                    <div>
                        <span>Effective tax rate</span>
                        <strong>{formatRate(insights.effectiveTaxRate)}</strong>
                        <small>of total income</small>
                    </div>
                </div>
                <div className="tax-metric-card">
                    <div className="tax-metric-icon"><Calendar size={20} /></div>
                    <div>
                        <span>Monthly tax</span>
                        <strong>{formatCurrency(insights.monthlyTax)}</strong>
                        <small>annual tax ÷ 12</small>
                    </div>
                </div>
                <div className="tax-metric-card">
                    <div className="tax-metric-icon"><Calculator size={20} /></div>
                    <div>
                        <span>Taxable income</span>
                        <strong>{formatCurrency(results.taxableIncome)}</strong>
                        <small>after deductions</small>
                    </div>
                </div>
                {insights.marginalRate > 0 && (
                    <div className="tax-metric-card">
                        <div className="tax-metric-icon"><Receipt size={20} /></div>
                        <div>
                            <span>Marginal rate</span>
                            <strong>{formatRate(insights.marginalRate)}</strong>
                            <small>on your top income slice</small>
                        </div>
                    </div>
                )}
            </div>

            <div className="tax-breakdown-card">
                <h2>How your tax was calculated</h2>
                <p className="tax-progressive-note">{TAX_BREAKDOWN_COPY.progressiveTax}</p>

                <div className="tax-steps">
                    {calculationSteps.map((step, idx) => (
                        <div
                            key={`${step.title}-${idx}`}
                            className={`tax-step ${step.isSubtotal ? 'is-subtotal' : ''} ${step.isTotal ? 'is-total' : ''}`}
                        >
                            <div className="tax-step-left">
                                <span className="tax-step-num">{idx + 1}</span>
                                <div>
                                    <div className="tax-step-title">{step.title}</div>
                                    <div className="tax-step-note">{step.note}</div>
                                </div>
                            </div>
                            <StepAmount step={step} />
                        </div>
                    ))}
                </div>
            </div>

            {slabBreakdown.length > 0 && (
                <AccordionSection
                    title="Slab-by-slab calculation"
                    subtitle="See exactly how much income falls in each tax band and how tax is computed"
                    isOpen={slabOpen}
                    onToggle={() => setSlabOpen((v) => !v)}
                >
                    <div className="slab-table-wrap">
                        <table className="slab-table">
                            <thead>
                                <tr>
                                    <th>Income slab</th>
                                    <th>Amount taxed here</th>
                                    <th>Rate</th>
                                    <th>Tax</th>
                                </tr>
                            </thead>
                            <tbody>
                                {slabBreakdown.map((slab) => (
                                    <tr key={slab.key}>
                                        <td>
                                            <div className="slab-range">{slab.rangeLabel}</div>
                                            <div className="slab-plain">{slab.plainExplanation}</div>
                                        </td>
                                        <td>{formatCurrency(slab.incomeInSlab)}</td>
                                        <td>{formatRate(slab.rate)}</td>
                                        <td>{formatCurrency(slab.taxAmount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="slab-formulas">
                        {slabBreakdown.filter((s) => s.formulaText).map((slab) => (
                            <div key={`formula-${slab.key}`} className="slab-formula-row">
                                <span>{slab.rangeLabel}</span>
                                <code>{slab.formulaText}</code>
                            </div>
                        ))}
                    </div>
                </AccordionSection>
            )}

            {adjustments.length > 0 && (
                <AccordionSection
                    title="Adjustments & extras"
                    subtitle="Rebates, surcharge, and cess explained in plain language"
                    isOpen={adjustmentsOpen}
                    onToggle={() => setAdjustmentsOpen((v) => !v)}
                >
                    <div className="adjustments-list">
                        {adjustments.map((item) => (
                            <div key={item.title} className="adjustment-item">
                                <div className="adjustment-header">
                                    <span>{item.title}</span>
                                    <span style={{ color: item.amount < 0 ? 'var(--accent)' : 'var(--text-main)' }}>
                                        {item.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(item.amount))}
                                    </span>
                                </div>
                                <p>{item.note}</p>
                            </div>
                        ))}
                    </div>
                </AccordionSection>
            )}

            <style>{`
                .tax-hero-card {
                    padding: 1.5rem;
                    background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-main) 100%);
                    border-radius: 12px;
                    border: 1px solid var(--border);
                    margin-bottom: 1.5rem;
                }
                .tax-hero-main {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                }
                .tax-hero-main label {
                    color: var(--text-muted);
                    font-size: 0.9rem;
                }
                .tax-hero-main strong {
                    font-size: 1.75rem;
                }
                .tax-hero-note {
                    margin: 1rem 0 0;
                    padding: 0.75rem 1rem;
                    background: rgba(0, 169, 242, 0.08);
                    border-radius: 8px;
                    font-size: 0.85rem;
                    color: var(--text-main);
                    line-height: 1.5;
                }
                .tax-metrics-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                .tax-metric-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 1rem;
                    display: flex;
                    gap: 0.75rem;
                    align-items: flex-start;
                }
                .tax-metric-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    background: rgba(23, 45, 157, 0.08);
                    color: var(--primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .tax-metric-card span {
                    display: block;
                    font-size: 0.8rem;
                    color: var(--text-muted);
                }
                .tax-metric-card strong {
                    display: block;
                    font-size: 1.1rem;
                    margin-top: 0.15rem;
                }
                .tax-metric-card small {
                    display: block;
                    font-size: 0.72rem;
                    color: var(--text-muted);
                    margin-top: 0.1rem;
                }
                .tax-breakdown-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                }
                .tax-breakdown-card h2 {
                    font-size: 1.15rem;
                    margin: 0 0 0.5rem;
                }
                .tax-progressive-note {
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    margin: 0 0 1.25rem;
                    line-height: 1.5;
                    padding: 0.75rem 1rem;
                    background: var(--bg-main);
                    border-radius: 8px;
                    border-left: 3px solid var(--primary);
                }
                .tax-steps {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                }
                .tax-step {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 1rem;
                    padding: 0.85rem 0;
                    border-bottom: 1px dashed var(--border);
                }
                .tax-step.is-subtotal {
                    border-top: 1px solid var(--border);
                    border-bottom: 1px solid var(--border);
                    background: rgba(23, 45, 157, 0.03);
                    padding-left: 0.75rem;
                    padding-right: 0.75rem;
                    margin: 0.25rem 0;
                    border-radius: 8px;
                }
                .tax-step.is-total {
                    border-bottom: none;
                    border-top: 2px solid var(--border);
                    padding-top: 1rem;
                    margin-top: 0.5rem;
                }
                .tax-step-left {
                    display: flex;
                    gap: 0.75rem;
                    align-items: flex-start;
                    flex: 1;
                    min-width: 0;
                }
                .tax-step-num {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: var(--primary);
                    color: white;
                    font-size: 0.75rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .tax-step-title {
                    font-weight: 600;
                    font-size: 0.95rem;
                }
                .tax-step-note {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    margin-top: 0.2rem;
                    line-height: 1.4;
                }
                .tax-accordion {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    margin-bottom: 1rem;
                    overflow: hidden;
                }
                .tax-accordion-header {
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem 1.25rem;
                    background: none;
                    border: none;
                    cursor: pointer;
                    text-align: left;
                    color: var(--text-main);
                }
                .tax-accordion-header h3 {
                    margin: 0;
                    font-size: 1rem;
                }
                .tax-accordion-header p {
                    margin: 0.25rem 0 0;
                    font-size: 0.8rem;
                    color: var(--text-muted);
                }
                .tax-accordion-body {
                    padding: 0 1.25rem 1.25rem;
                    border-top: 1px solid var(--border);
                }
                .slab-table-wrap {
                    overflow-x: auto;
                    margin-top: 1rem;
                }
                .slab-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.9rem;
                    min-width: 480px;
                }
                .slab-table th {
                    text-align: left;
                    padding: 0.6rem 0.5rem;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.4px;
                    color: var(--text-muted);
                    border-bottom: 1px solid var(--border);
                }
                .slab-table th:not(:first-child),
                .slab-table td:not(:first-child) {
                    text-align: right;
                }
                .slab-table td {
                    padding: 0.75rem 0.5rem;
                    border-bottom: 1px dashed var(--border);
                    vertical-align: top;
                }
                .slab-range {
                    font-weight: 600;
                    font-size: 0.9rem;
                }
                .slab-plain {
                    font-size: 0.78rem;
                    color: var(--text-muted);
                    margin-top: 0.2rem;
                    line-height: 1.35;
                }
                .slab-formulas {
                    margin-top: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .slab-formula-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                    padding: 0.6rem 0.75rem;
                    background: var(--bg-main);
                    border-radius: 8px;
                    font-size: 0.85rem;
                }
                .slab-formula-row span {
                    color: var(--text-muted);
                    flex-shrink: 0;
                }
                .slab-formula-row code {
                    font-family: inherit;
                    font-weight: 600;
                    color: var(--text-main);
                    text-align: right;
                }
                .adjustments-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    margin-top: 1rem;
                }
                .adjustment-item {
                    padding: 1rem;
                    background: var(--bg-main);
                    border-radius: 8px;
                }
                .adjustment-header {
                    display: flex;
                    justify-content: space-between;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                }
                .adjustment-item p {
                    margin: 0;
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    line-height: 1.5;
                }
                @media (max-width: 480px) {
                    .tax-hero-main {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    .tax-step {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    .slab-formula-row {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    .slab-formula-row code {
                        text-align: left;
                    }
                }
            `}</style>
        </div>
    );
};

export default IncomeTaxOutput;
