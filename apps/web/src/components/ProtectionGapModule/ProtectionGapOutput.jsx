import React, { useEffect, useState } from 'react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { ShieldAlert, ShieldCheck, TrendingDown, Target, User, Users, Info, HelpCircle } from 'lucide-react';
import ContextualHelpPopup from '../common/ContextualHelpPopup';
import { useAuth } from '../../contexts/AuthContext';
import { buildSupportEmailContextFromUser } from '../../services/supportRequestEmailService';

const ProtectionGapOutput = ({ results, familyMembers, moduleName = 'Protection Gap' }) => {
    const { user } = useAuth();
    const [animate, setAnimate] = useState(false);
    const [showHelpPopup, setShowHelpPopup] = useState(false);

    useEffect(() => {
        // Trigger animations after mount
        const timer = setTimeout(() => setAnimate(true), 100);
        return () => clearTimeout(timer);
    }, [results]);

    if (!results) return null;

    const renderIndividualGap = (data, title) => {
        if (!data) return null;

        const isSelf = title === "Self";
        const isCovered = !data.isGap;
        const progressPercentage = Math.min(100, (data.coverage / data.need) * 100) || 0;

        return (
            <div 
                className="card member-gap-card" 
                style={{ 
                    position: 'relative',
                    overflow: 'hidden',
                    border: 'none', 
                    borderRadius: '16px',
                    background: 'var(--bg-card)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
                    transition: 'all 0.3s ease',
                    transform: animate ? 'translateY(0)' : 'translateY(20px)',
                    opacity: animate ? 1 : 0
                }}
            >
                {/* Decorative background accent */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '6px',
                    background: isCovered ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f43f5e, #e11d48)'
                }} />

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', padding: '1.5rem 1.5rem 0' }}>
                    <div>
                        <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '8px', color: isCovered ? 'var(--accent)' : 'var(--destructive)', fontSize: '1.25rem' }}>
                            {isCovered ? <ShieldCheck size={22} fill="currentColor" color="white" /> : <ShieldAlert size={22} fill="currentColor" color="white" />}
                            {title} Protection Analysis
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
                            {isSelf ? <User size={16} /> : <Users size={16} />}
                            {data.name || title}
                        </div>
                    </div>
                    <div style={{ 
                        background: isCovered ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)', 
                        color: isCovered ? '#10b981' : '#f43f5e',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        {isCovered ? 'Covered' : 'Gap Detected'}
                    </div>
                </div>

                <div className="gap-visualization" style={{ padding: '0 1.5rem' }}>
                    <div className="vis-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '0.5rem' }}>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Life Cover</div>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>{formatCurrency(data.coverage)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Target (HLV)</div>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>{formatCurrency(data.need)}</div>
                        </div>
                    </div>

                    <div className="progress-container" style={{ margin: '0.75rem 0 1.5rem', height: '12px', background: 'var(--muted)', borderRadius: '10px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                        <div style={{
                            width: animate ? `${progressPercentage}%` : '0%',
                            height: '100%',
                            background: isCovered ? 'linear-gradient(90deg, #34d399, #10b981)' : 'linear-gradient(90deg, #fb7185, #f43f5e)',
                            transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1) 0.2s',
                            position: 'relative'
                        }}>
                             <div style={{
                                position: 'absolute', top: 0, left: 0, bottom: 0, right: 0,
                                background: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)',
                                backgroundSize: '1rem 1rem'
                            }} />
                        </div>
                    </div>
                </div>

                <div className="result-insight" style={{
                    margin: '0 1.5rem 1.5rem',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    background: isCovered ? 'rgba(16, 185, 129, 0.05)' : 'rgba(244, 63, 94, 0.05)',
                    border: `1px solid ${isCovered ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                }}>
                    {isCovered ? (
                        <>
                            <div style={{ background: '#10b981', borderRadius: '50%', padding: '6px', color: 'white', marginTop: '2px' }}>
                                <Target size={16} />
                            </div>
                            <div>
                                <h4 style={{ margin: '0 0 4px', color: '#059669', fontSize: '0.95rem' }}>Sufficiently Covered!</h4>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Your existing life insurance policies meet or exceed the required human life value target.
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ background: '#f43f5e', borderRadius: '50%', padding: '6px', color: 'white', marginTop: '2px' }}>
                                <TrendingDown size={16} />
                            </div>
                            <div>
                                <h4 style={{ margin: '0 0 4px', color: '#e11d48', fontSize: '0.95rem' }}>Coverage Shortfall</h4>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    You have a protection gap of <strong>{formatCurrency(data.gap)}</strong>. Consider securing additional term life insurance to fully protect your family's future lifestyle.
                                </p>
                                {data.isCapped && (
                                    <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', fontSize: '0.8rem', color: '#b45309' }}>
                                        <strong>Income Eligibility Note:</strong> Your ideal cover requirement is <strong>{formatCurrency(data.idealCover)}</strong>, but based on industry income multiples, your maximum term insurance cap is <strong>{formatCurrency(data.insurabilityCap)}</strong>. 
                                        <br/>This leaves an uninsurable shortfall of <strong>{formatCurrency(data.shortfall)}</strong>. You may need to rely on alternative wealth accumulation to fully bridge this gap.
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="protection-gap-output fade-in" style={{ marginTop: '2.5rem' }}>
            <div 
                className="summary-hero" 
                style={{ 
                    marginBottom: '2.5rem', 
                    background: 'linear-gradient(135deg, var(--primary) 0%, #1e3a8a 100%)', 
                    color: 'white', 
                    borderRadius: '16px',
                    padding: '2rem',
                    boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                <div style={{ position: 'absolute', top: '-10%', right: '-5%', opacity: 0.1 }}>
                    <ShieldCheck size={180} />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', position: 'relative', zIndex: 1 }}>
                    <Info size={24} color="#60a5fa" />
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#60a5fa' }}>Household Protection Target</h2>
                </div>

                <div className="grid" style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '1.25rem', borderRadius: '12px', backdropFilter: 'blur(10px)' }}>
                        <label style={{ color: '#ffffff', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Household Base Need</label>
                        <strong style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(results.monthlyExpenditure * 12)} / yr</strong>
                        <div style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.7 }}>Expenses at risk</div>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '1.25rem', borderRadius: '12px', backdropFilter: 'blur(10px)' }}>
                        <label style={{ color: '#ffffff', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Self Target Need</label>
                        <strong style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(results.self?.need || 0)}</strong>
                        <div style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.7 }}>Recommended SA</div>
                    </div>
                    {results.spouse && (
                        <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '1.25rem', borderRadius: '12px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                            <label style={{ color: '#93c5fd', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px', fontWeight: 600 }}>Spouse Target Need</label>
                            <strong style={{ display: 'block', fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>{formatCurrency(results.spouse.need)}</strong>
                            <div style={{ fontSize: '0.75rem', marginTop: '4px', color: '#93c5fd' }}>Recommended SA</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid" style={{ gap: '2rem' }}>
                {renderIndividualGap(results.self, "Self")}
                {renderIndividualGap(results.spouse, "Spouse")}
            </div>

            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center' }}>
                <button 
                    className="btn btn-secondary fade-in" 
                    onClick={() => setShowHelpPopup(true)}
                    style={{ 
                        padding: '1rem 2rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem',
                        fontSize: '1.05rem',
                        fontWeight: 600,
                        background: 'rgba(37, 99, 235, 0.05)',
                        border: '1px dashed var(--primary)',
                        color: 'var(--primary)',
                        borderRadius: '12px',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(37, 99, 235, 0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(37, 99, 235, 0.05)'; }}
                >
                    <HelpCircle size={20} />
                    View Indicative Term Insurance Premiums & Get Support
                </button>
            </div>

            <ContextualHelpPopup 
                isOpen={showHelpPopup}
                onClose={() => setShowHelpPopup(false)}
                title="Term Insurance Premiums & Support"
                message="Finbrella can help you choose the right term insurance to bridge your protection gap. Below are indicative premiums from top providers—contact us via call or email for competitive quotes."
                imageSrc="/term_quote.png"
                supportContacts={{
                    email: "finbrellafpd@gmail.com",
                    phone: ["+91 9785895737", "+91 7046069999"]
                }}
                supportEmailContext={buildSupportEmailContextFromUser(familyMembers, user, moduleName)}
            />

            <style>{`
                .member-gap-card:hover {
                    box-shadow: 0 20px 40px rgba(0,0,0,0.08) !important;
                    transform: translateY(-4px) !important;
                }
            `}</style>
        </div>
    );
};

export default ProtectionGapOutput;

