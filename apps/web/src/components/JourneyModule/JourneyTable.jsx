import React, { useState, useRef, useEffect, useMemo } from 'react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { Filter, Calendar, TrendingUp, AlertTriangle, HelpCircle } from 'lucide-react';

const JourneyTable = ({ projections }) => {
    const [selectedRow, setSelectedRow] = useState(null);
    const [viewMode, setViewMode] = useState('10'); // '5', '10', 'all'
    const popoverRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setSelectedRow(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const visibleProjections = useMemo(() => {
        if (!projections || projections.length === 0) return [];
        if (viewMode === 'all') return projections;
        return projections.slice(0, parseInt(viewMode, 10));
    }, [projections, viewMode]);

    // Extract Milestones for the visual timeline above the table
    const milestones = useMemo(() => {
        if (!projections) return [];
        const found = [];
        projections.forEach(row => {
            if (row.journeyAdjustments && row.journeyAdjustments.length > 0) {
                row.journeyAdjustments.forEach(adj => {
                    found.push({ year: row.year, name: adj.name });
                });
            }
        });
        return found.slice(0, 5); // Limit to top 5 prominent milestones to avoid crowding
    }, [projections]);

    if (!projections || projections.length === 0) return null;

    const currentYear = new Date().getFullYear();

    return (
        <div className="journey-table-wrapper fade-in" style={{ marginTop: '2.5rem' }}>
            
            {/* Timeline & Controls Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', gap: '1rem' }}>
                <div style={{ flex: '1 1 500px' }}>
                    <h3 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                        <Calendar size={18} className="text-primary" /> Projected Timeline
                    </h3>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                        {milestones.length > 0 ? milestones.map((m, idx) => (
                            <div key={idx} style={{ 
                                background: 'rgba(37, 99, 235, 0.05)', 
                                border: '1px solid rgba(37, 99, 235, 0.2)', 
                                padding: '6px 12px', 
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.75rem',
                                color: 'var(--primary)',
                                fontWeight: 600,
                                whiteSpace: 'nowrap'
                            }}>
                                <span style={{ background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem' }}>{m.year}</span>
                                {m.name}
                            </div>
                        )) : (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No major discrete milestones detected.</div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '8px' }}>
                        <Filter size={14} /> View
                    </span>
                    <button 
                        onClick={() => setViewMode('5')} 
                        style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: viewMode === '5' ? 'var(--primary)' : 'transparent', color: viewMode === '5' ? 'white' : 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        5 Yrs
                    </button>
                    <button 
                        onClick={() => setViewMode('10')} 
                        style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: viewMode === '10' ? 'var(--primary)' : 'transparent', color: viewMode === '10' ? 'white' : 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        10 Yrs
                    </button>
                    <button 
                        onClick={() => setViewMode('all')} 
                        style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: viewMode === 'all' ? 'var(--primary)' : 'transparent', color: viewMode === 'all' ? 'white' : 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        All
                    </button>
                </div>
            </div>

            {/* Table Container */}
            <div className="table-scroll-container card" style={{ padding: 0, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="modern-data-table" style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse', textAlign: 'right' }}>
                        <thead style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border)' }}>
                            <tr>
                                <th style={{ textAlign: 'center', position: 'sticky', left: 0, background: 'var(--bg-main)', zIndex: 10 }}>Year</th>
                                <th>Annual Inflows</th>
                                <th>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                        Tax Adjustment
                                        <div style={{ display: 'inline-flex', cursor: 'help' }} title="Extra tax due or refund vs TDS on salary slip. Current year shows ₹0 (prior ITR assumed filed).">
                                            <HelpCircle size={18} color="var(--primary)" />
                                        </div>
                                    </div>
                                </th>
                                <th>Net Inflow (After Tax)</th>
                                <th>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                        Total Outflow
                                        <div style={{ display: 'inline-flex', cursor: 'help' }} title="Click on the Total Outflow field below to view all outflow details.">
                                            <HelpCircle size={18} color="var(--primary)" />
                                        </div>
                                    </div>
                                </th>
                                <th>Surplus (Pre-Saving)</th>
                                <th>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                        Investments
                                        <div style={{ display: 'inline-flex', cursor: 'help' }} title="Click on the Investment field below to view all investment details.">
                                            <HelpCircle size={18} color="var(--primary)" />
                                        </div>
                                    </div>
                                </th>
                                <th>Net Investible Surplus</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleProjections.map((row, idx) => {
                                const isCurrentYear = row.year === currentYear;
                                const isSurplusNegative = row.netInvestibleSurplus < 0;
                                const isDecadeStart = row.year % 10 === 0 && idx !== 0;
                                
                                return (
                                    <React.Fragment key={idx}>
                                        {/* Decade Separator */}
                                        {isDecadeStart && (
                                            <tr>
                                                <td colSpan="8" style={{ background: 'var(--bg-main)', padding: '6px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '2px' }}>
                                                    --- DECADE {row.year} ---
                                                </td>
                                            </tr>
                                        )}
                                        <tr style={{ 
                                            background: isCurrentYear ? 'var(--bg-card)' : (idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-main)'),
                                            borderLeft: isCurrentYear ? '4px solid var(--primary)' : '4px solid transparent',
                                            borderBottom: '1px solid var(--border)',
                                            transition: 'background 0.2s'
                                        }} className="zebra-row">
                                            <td style={{ 
                                                textAlign: 'center', 
                                                position: 'sticky', 
                                                left: 0, 
                                                background: isCurrentYear ? 'var(--bg-card)' : (idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-main)'),
                                                fontWeight: 700,
                                                color: 'var(--text-main)',
                                                zIndex: 5,
                                                boxShadow: '1px 0 0 var(--border)'
                                            }}>
                                                {row.year}
                                                {isCurrentYear && <span style={{ display: 'block', fontSize: '0.6rem', color: 'var(--primary)', marginTop: '-2px' }}>CURRENT</span>}
                                            </td>
                                            <td style={{ color: 'var(--text-main)' }}>{formatCurrency(row.annualInflow)}</td>
                                            <td style={{ color: row.approxTax < 0 ? '#16a34a' : '#ef4444' }}>
                                                {formatCurrency(row.approxTax)}
                                            </td>
                                            <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatCurrency(row.netInflowAfterTax)}</td>
                                            
                                            <td style={{ position: 'relative' }}>
                                                <button 
                                                    className="outflow-btn"
                                                    onClick={() => setSelectedRow(selectedRow === `outflow-${idx}` ? null : `outflow-${idx}`)}
                                                >
                                                    {formatCurrency(row.totalOutflow)}
                                                </button>
                                                
                                                {selectedRow === `outflow-${idx}` && (
                                                    <div className="breakdown-popover fade-in" ref={popoverRef}>
                                                        <div className="breakdown-item">
                                                            <span>Household (Inflation adj.)</span>
                                                            <strong>{formatCurrency(row.householdOutflow)}</strong>
                                                        </div>
                                                        <div className="breakdown-item">
                                                            <span>EMIs</span>
                                                            <strong>{formatCurrency(row.emiOutflow)}</strong>
                                                        </div>
                                                        <div className="breakdown-item">
                                                            <span>Education expenses</span>
                                                            <strong>{formatCurrency(row.educationExpenses)}</strong>
                                                        </div>
                                                        {row.journeyAdjustments && row.journeyAdjustments.length > 0 && (
                                                            <>
                                                                <div className="breakdown-divider"></div>
                                                                <div className="popover-subtitle">Targeted Goals & Adjustments</div>
                                                                {row.journeyAdjustments.map((adj, i) => (
                                                                    <div className="breakdown-item" key={i}>
                                                                        <span style={{ color: 'var(--primary)' }}>{adj.name}</span>
                                                                        <strong style={{ color: 'var(--primary)' }}>{formatCurrency(adj.amount)}</strong>
                                                                    </div>
                                                                ))}
                                                            </>
                                                        )}
                                                        <div className="breakdown-divider"></div>
                                                        <div className="breakdown-total">
                                                            <span>Total outflow</span>
                                                            <strong>{formatCurrency(row.totalOutflow)}</strong>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            
                                            <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatCurrency(row.surplusBeforeSaving)}</td>
                                            
                                            <td style={{ position: 'relative' }}>
                                                <button 
                                                    className="outflow-btn"
                                                    onClick={() => setSelectedRow(selectedRow === `savings-${idx}` ? null : `savings-${idx}`)}
                                                >
                                                    {formatCurrency(row.savingsAndInvestments)}
                                                </button>

                                                {selectedRow === `savings-${idx}` && (
                                                    <div className="breakdown-popover fade-in" ref={popoverRef}>
                                                        <div className="popover-subtitle">Savings & Investments Breakdown</div>
                                                        <div className="breakdown-item">
                                                            <span>Insurance Premiums</span>
                                                            <strong>{formatCurrency(row.insurancePremium)}</strong>
                                                        </div>
                                                        <div className="breakdown-item">
                                                            <span>PPF</span>
                                                            <strong>{formatCurrency(row.savingsBreakdown.ppf)}</strong>
                                                        </div>
                                                        <div className="breakdown-item">
                                                            <span>NPS</span>
                                                            <strong>{formatCurrency(row.savingsBreakdown.nps)}</strong>
                                                        </div>
                                                        <div className="breakdown-item">
                                                            <span>RD</span>
                                                            <strong>{formatCurrency(row.savingsBreakdown.rdTotal)}</strong>
                                                        </div>
                                                        <div className="breakdown-item">
                                                            <span>MF-SIP</span>
                                                            <strong>{formatCurrency(row.savingsBreakdown.sip)}</strong>
                                                        </div>
                                                        <div className="breakdown-item">
                                                            <span>Any other savings</span>
                                                            <strong>{formatCurrency(row.savingsBreakdown.otherSaving)}</strong>
                                                        </div>
                                                        <div className="breakdown-divider"></div>
                                                        <div className="breakdown-total">
                                                            <span>Total Savings</span>
                                                            <strong>{formatCurrency(row.savingsAndInvestments)}</strong>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            
                                            <td style={{ 
                                                fontWeight: 800, 
                                                background: isSurplusNegative ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                                                color: isSurplusNegative ? '#ef4444' : '#10b981',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'flex-end',
                                                gap: '6px',
                                                paddingRight: '1rem',
                                                height: '100%' // Ensure background stretches
                                            }}>
                                                {isSurplusNegative ? <AlertTriangle size={14} /> : <TrendingUp size={14} />}
                                                {formatCurrency(row.netInvestibleSurplus)}
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <style>{`
                .modern-data-table th, .modern-data-table td {
                    padding: 1rem;
                }
                .modern-data-table th {
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--text-muted);
                    font-weight: 700;
                }
                .zebra-row:hover {
                    background: rgba(37, 99, 235, 0.05) !important;
                }

                .outflow-btn {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid var(--border);
                    color: var(--text-main);
                    font: inherit;
                    cursor: pointer;
                    padding: 4px 10px;
                    border-radius: 6px;
                    transition: all 0.2s;
                    font-weight: 600;
                }

                .outflow-btn:hover {
                    background: var(--primary);
                    color: white;
                    border-color: var(--primary);
                }

                .breakdown-popover {
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 0;
                    z-index: 100;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 1.5rem;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                    width: 320px;
                    pointer-events: auto;
                    cursor: default;
                }

                .popover-subtitle {
                    margin-bottom: 0.75rem;
                    font-size: 0.75rem;
                    color: var(--primary);
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    text-align: left;
                }

                .breakdown-item {
                    display: flex;
                    justify-content: space-between;
                    gap: 1.5rem;
                    margin-bottom: 0.5rem;
                    font-size: 0.85rem;
                    color: var(--text-main);
                    text-align: right;
                }

                .breakdown-item span {
                    color: var(--text-muted);
                    flex: 1;
                    text-align: left;
                }

                .breakdown-divider {
                    height: 1px;
                    background: var(--border);
                    margin: 1rem 0;
                }

                .breakdown-total {
                    display: flex;
                    justify-content: space-between;
                    font-weight: 800;
                    color: var(--text-main);
                    font-size: 1.05rem;
                }

                @media (prefers-color-scheme: dark) {
                    .breakdown-popover {
                        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                    }
                }
            `}</style>
        </div>
    );
};

export default JourneyTable;
