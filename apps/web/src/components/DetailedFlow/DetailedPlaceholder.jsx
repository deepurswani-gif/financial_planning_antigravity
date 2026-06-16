import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const DetailedPlaceholder = () => {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="card fade-in" style={{ padding: '3rem', maxWidth: '800px', margin: '4rem auto', textAlign: 'center' }}>
            <h1 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Detailed Flow</h1>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>Current Route: <code style={{ background: 'var(--bg-main)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{location.pathname}</code></p>
            <p className="text-muted" style={{ marginTop: '1rem' }}>
                As requested, this deep-dive flow is currently a blank placeholder. The full UI with all detailed bifurcated fields will be built in upcoming chats.
            </p>
            <div style={{ marginTop: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-secondary" onClick={() => navigate('/summary-report/money_story')}>Back to Summary Report</button>
                    <button className="btn btn-primary" onClick={() => navigate('/detailed-flow/next-step')}>Next Step</button>
                </div>
                <button 
                    className="btn btn-secondary" 
                    onClick={() => navigate('/detailed-flow/existing-app')}
                    style={{ padding: '0.8rem 2rem', fontSize: '1rem', borderRadius: '50px', background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)' }}
                >
                    Legacy Existing App Flow (Temporary)
                </button>
            </div>
        </div>
    );
};

export default DetailedPlaceholder;
