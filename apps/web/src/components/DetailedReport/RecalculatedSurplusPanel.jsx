import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ThreeMonthSurplusGrid from './ThreeMonthSurplusGrid';

const RecalculatedSurplusPanel = ({
    outlook = [],
    onProceed,
    proceedLabel = 'Proceed to Investment Avenues to allocate the surplus',
    showProceed = true,
    showFormula = true,
}) => {
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [showComparison, setShowComparison] = useState(false);

    const currentCard = outlook[0] || {};
    const ledger = currentCard.ledgerUnallocated || 0;
    const protection = currentCard.protectionImpact || 0;
    const ffa = currentCard.journeyImpact || 0;
    const remaining = currentCard.deployableSurplus || 0;
    const monthLabel = currentCard.monthLabel || 'this month';

    const formulaCards = outlook.map((card) => ({
        ...card,
        calculationLines: [
            `Surplus before ${formatCurrency(card.ledgerUnallocated || 0)}`,
            `− Protection ${formatCurrency(card.protectionImpact || 0)}`,
            `− Future financial adjustments ${formatCurrency(card.journeyImpact || 0)}`,
            `= Remaining ${formatCurrency(card.deployableSurplus || 0)}`,
        ],
    }));

    return (
        <div className="card pymtw-recalculated-surplus-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--card-bg, #fff)' }}>
            <div className="pymtw-recalculated-body">
                <span className="pymtw-recalculated-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'none' }}>
                    Recalculated unallocated surplus
                </span>
                
                <h3 className="fyfg-outcome-headline" style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.5rem 0 1rem', color: 'var(--text-main)' }}>
                    After setting aside {formatCurrency(protection)} for protection{ffa > 0 ? ` and ${formatCurrency(ffa)} for adjustments` : ''}, you&apos;ll have <span style={{ color: 'var(--primary, #0f766e)' }}>{formatCurrency(remaining)}</span> left in {monthLabel}.
                </h3>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <button
                        type="button"
                        className="btn-link"
                        onClick={() => setShowBreakdown((prev) => !prev)}
                        style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary, #0f766e)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                        <ChevronDown size={14} style={{ transform: showBreakdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        {showBreakdown ? 'Hide calculation breakdown' : 'See how this was calculated'}
                    </button>

                    {outlook.length > 1 && (
                        <button
                            type="button"
                            className="btn-link"
                            onClick={() => setShowComparison((prev) => !prev)}
                            style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                            <ChevronDown size={14} style={{ transform: showComparison ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            {showComparison ? 'Hide month comparison' : 'Compare other months'}
                        </button>
                    )}
                </div>

                {showBreakdown && (
                    <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-main, #f8fafc)', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                            <span>Surplus before plan</span>
                            <strong>{formatCurrency(ledger)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', color: '#dc2626' }}>
                            <span>− Protection allocations</span>
                            <strong>−{formatCurrency(protection)}</strong>
                        </div>
                        {ffa > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', color: '#dc2626' }}>
                                <span>− Future financial adjustments</span>
                                <strong>−{formatCurrency(ffa)}</strong>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0 0', borderTop: '1px solid var(--border)', fontWeight: 700, color: 'var(--primary, #0f766e)' }}>
                            <span>= Remaining for long-term goals</span>
                            <strong>{formatCurrency(remaining)}</strong>
                        </div>
                    </div>
                )}

                {showComparison && (
                    <div style={{ marginTop: '1rem' }}>
                        <ThreeMonthSurplusGrid
                            outlook={formulaCards}
                            variant="recalc"
                            animate={false}
                        />
                    </div>
                )}
            </div>
            {showProceed && onProceed && (
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onProceed}
                    style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', fontWeight: 600, borderRadius: '10px' }}
                >
                    {proceedLabel}
                </button>
            )}
        </div>
    );
};

export default RecalculatedSurplusPanel;
