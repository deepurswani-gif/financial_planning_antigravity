import React from 'react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { getInsuredNamesList } from './InsuranceLogic';

const InsuranceOutput = ({ summary, policies }) => {
    if (!summary || summary.length === 0) return null;

    // Calculate Top Metrics using active policies directly
    const totalYearlyPremium = policies.reduce((sum, p) => {
        const premium = parseFloat(p.premium) || 0;
        const freq = p.frequency || 'Annually';
        const multiplier = freq === 'Monthly' ? 12 : freq === 'Quarterly' ? 4 : freq === 'Half-Yearly' ? 2 : 1;
        return sum + (premium * multiplier);
    }, 0);
    
    // Total coverage sum across all policies
    const insuredNames = getInsuredNamesList(policies);
    const totalCoverage = policies.reduce((sum, p) => sum + (parseFloat(p.sumAssured) || 0), 0);

    const firstYearSummary = summary.find(s => s.totalPremium > 0) || summary[0];

    const upcomingMaturities = summary.reduce((count, s) => count + s.maturities.length, 0);

    return (
        <div className="insurance-output fade-in" style={{ marginTop: '2.5rem' }}>
            
            {/* Top Metrics */}
            <div className="grid-3" style={{ marginBottom: '2rem' }}>
                <div className="stat-box">
                    <div className="sb-icon" style={{ background: '#fee2e2', color: 'var(--destructive)' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                    </div>
                    <div>
                        <div className="sb-val" style={{ color: 'var(--destructive)' }}>{formatCurrency(totalYearlyPremium)}</div>
                        <div className="sb-lbl">Total Yearly Premium</div>
                    </div>
                </div>
                <div className="stat-box">
                    <div className="sb-icon" style={{ background: '#e0f2fe', color: 'var(--color-2)' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </div>
                    <div>
                        <div className="sb-val">{formatCurrency(totalCoverage)}</div>
                        <div className="sb-lbl">Total Active Coverage</div>
                    </div>
                </div>
                <div className="stat-box">
                    <div className="sb-icon" style={{ background: '#dcfce7', color: 'var(--success)' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                    </div>
                    <div>
                        <div className="sb-val">{upcomingMaturities}</div>
                        <div className="sb-lbl">Upcoming Maturities</div>
                    </div>
                </div>
            </div>

            {/* Coverage Tracker */}
            <div className="report-section card" style={{ marginBottom: '2rem' }}>
                <h3 className="section-title" style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Coverage Status Overview</h3>
                <div className="coverage-list">
                    {insuredNames.map((name, idx) => {
                        const cov = policies
                            .filter(p => p.insuredName === name)
                            .reduce((sum, p) => sum + (parseFloat(p.sumAssured) || 0), 0);
                        const initials = name.split(' ').map(n=>n[0]).join('').substring(0,2);
                        
                        // Coverage gap evaluation
                        const isOptimal = cov >= 5000000;
                        const pct = Math.min(100, (cov / 10000000) * 100);
                        const displayPct = pct < 5 && cov > 0 ? 5 : pct;
                        
                        const trackBg = isOptimal ? '#d1fae5' : '#fee2e2'; // Light green or light red background (shows gap)
                        const fillBg = isOptimal ? '#10b981' : '#ef4444'; // Solid green or solid red 

                        return (
                            <div key={idx} className="cov-row">
                                <div className="cov-avatar" style={{ background: isOptimal ? 'var(--color-1)' : 'var(--color-3)' }}>{initials.toUpperCase()}</div>
                                <div className="cov-name">{name}</div>
                                <div className="cov-amount" style={{ color: cov > 0 ? 'var(--color-1)' : 'var(--text-muted)' }}>{formatCurrency(cov)}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ width: '100%', height: '8px', background: trackBg, borderRadius: '4px', overflow: 'hidden', marginBottom: '4px' }}>
                                        <div style={{ width: `${displayPct}%`, height: '100%', background: fillBg, transition: 'width 0.3s ease-in-out' }}></div>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                                        {cov === 0 ? 'No Coverage' : (isOptimal ? 'Coverage looks healthy' : 'Potential gap detected')}
                                    </div>
                                </div>
                                <div className={`cov-tag ${cov === 0 ? 'gap' : (isOptimal ? 'sufficient' : 'gap')}`} style={{ marginLeft: '1.5rem' }}>
                                    {cov === 0 ? 'Uninsured' : (isOptimal ? 'Secured' : 'Gap Detected')}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '2rem' }}>
                
                {/* Yearly Premium Outflow */}
                <div className="report-section card" style={{ marginBottom: 0 }}>
                    <h3 className="section-title" style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Year-wise Premium Outflow</h3>
                    <div className="outflow-scroll">
                        {summary.filter(s => s.totalPremium > 0).map((s, idx) => {
                            const activePolicies = policies.filter(p => s.policyPremiums[p.id] > 0);
                            return (
                                <div key={idx} className="outflow-card">
                                    <div className="outflow-year">{s.year}</div>
                                    <div className="outflow-val">{formatCurrency(s.totalPremium)} <span style={{fontSize:'1rem', color:'var(--text-muted)'}}>/yr</span></div>
                                    <div className="outflow-breakdown">
                                        {activePolicies.map(p => {
                                            const policyDisplayName = p.company || p.planName || `${p.insuredName}'s Policy`;
                                            return (
                                                <div key={p.id} className="of-row">
                                                    <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'120px'}} title={policyDisplayName}>{policyDisplayName}</span> 
                                                    <span style={{color:'var(--text-main)', fontWeight:600}}>{formatCurrency(s.policyPremiums[p.id])}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Maturity Timeline */}
                <div className="report-section card" style={{ marginBottom: 0 }}>
                    <h3 className="section-title" style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Upcoming Maturities Timeline</h3>
                    <div className="timeline">
                        {summary.filter(s => s.maturities.length > 0).map(s => (
                            s.maturities.map((m, idx) => (
                                <div key={`${s.year}-${idx}`} className="tl-item">
                                    <div className="tl-card">
                                        <div className="tl-year">{s.year}</div>
                                        <div className="tl-details">
                                            <span className="tl-who">{m.insuredName}</span>
                                            <span className="tl-what">{m.planName || 'Saving Plan'}</span>
                                        </div>
                                        <div className="tl-amount">+{formatCurrency(m.amount)}</div>
                                    </div>
                                </div>
                            ))
                        ))}
                        {upcomingMaturities === 0 && (
                            <p className="text-muted" style={{marginLeft: '1rem'}}>No upcoming maturities found.</p>
                        )}
                    </div>
                </div>

            </div>

            <style>{`
                .report-section { background: var(--bg-card); border-radius: var(--radius-xl); padding: 2rem; border: 1px solid var(--border); }
                .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
                .stat-box { border-radius: 16px; padding: 1.5rem; background: var(--bg-main); border: 1px solid var(--border); display: flex; align-items: center; gap: 1.25rem; }
                .sb-icon { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .sb-val { font-size: 1.5rem; font-weight: 800; color: var(--text-main); }
                .sb-lbl { font-size: 0.85rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; margin-top: 4px; }
                .coverage-list { display: flex; flex-direction: column; gap: 1rem; }
                .cov-row { display: flex; align-items: center; justify-content: space-between; background: var(--bg-main); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.5rem; flex-wrap: wrap; gap: 1rem;}
                .cov-avatar { width: 40px; height: 40px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
                .cov-name { font-size: 1.05rem; font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .cov-amount { font-size: 1.2rem; font-weight: 800; flex-shrink: 0; text-align: right; }
                .cov-tag { padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
                .cov-tag.sufficient { background: #dcfce7; color: var(--success); }
                .cov-tag.gap { background: #fee2e2; color: var(--destructive); }
                .timeline { position: relative; padding-left: 1.5rem;}
                .timeline::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: var(--border); }
                .tl-item { position: relative; margin-bottom: 1.5rem; }
                .tl-item::before { content: ''; position: absolute; left: -1.9rem; top: 0.5rem; width: 14px; height: 14px; border-radius: 50%; background: white; border: 3px solid var(--color-4); box-shadow: 0 0 0 4px rgba(72,190,217,0.1); }
                .tl-card { background: var(--bg-main); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;}
                .tl-year { font-size: 1.25rem; font-weight: 800; color: var(--color-1); background: rgba(23,45,157,0.05); padding: 8px 14px; border-radius: 12px; }
                .tl-details { display: flex; flex-direction: column; flex: 1; min-width: 150px;}
                .tl-who { font-size: 1rem; font-weight: 700; margin-bottom: 2px; }
                .tl-what { font-size: 0.85rem; color: var(--text-muted); }
                .tl-amount { font-size: 1.25rem; font-weight: 800; color: var(--success); text-align: right; }
                .outflow-scroll { display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 1rem; }
                .outflow-scroll::-webkit-scrollbar { height: 6px; }
                .outflow-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
                .outflow-card { min-width: 200px; background: white; border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
                .outflow-year { font-size: 0.95rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.5rem; }
                .outflow-val { font-size: 1.5rem; font-weight: 800; color: var(--destructive); margin-bottom: 1rem; }
                .outflow-breakdown { font-size: 0.8rem; color: var(--text-muted); border-top: 1px dashed var(--border); padding-top: 0.75rem; display: flex; flex-direction: column; gap: 4px; text-align: left; }
                .of-row { display: flex; justify-content: space-between; gap: 0.5rem;}
                @media (max-width: 640px) {
                    .report-section { padding: 1.25rem; }
                    .cov-row { padding: 1rem; }
                    .tl-card { flex-direction: column; align-items: flex-start; }
                    .tl-amount { text-align: left; width: 100%; }
                    .outflow-card { min-width: min(200px, 80vw); }
                }
            `}</style>
        </div>
    );
};

export default InsuranceOutput;
