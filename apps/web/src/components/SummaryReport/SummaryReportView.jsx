import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MoneyStorySection from './MoneyStorySection';
import SafetyNetSection from './SafetyNetSection';
import FutureSelfSection from './FutureSelfSection';

const SummaryReportView = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('money-story');

    const tabs = [
        { id: 'money-story', label: 'Your Money Story' },
        { id: 'safety-net', label: 'The Safety Net' },
        { id: 'future-self', label: 'Your Future Self' },
        { id: 'executive', label: 'Executive Summary' }
    ];

    return (
        <div className="fade-in" style={{ padding: (activeTab === 'money-story' || activeTab === 'safety-net' || activeTab === 'future-self') ? '0' : '2rem', maxWidth: (activeTab === 'money-story' || activeTab === 'safety-net' || activeTab === 'future-self') ? '100%' : '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '1rem' }}>
                <button 
                    className="btn btn-secondary" 
                    onClick={() => navigate('/summary-flow/goals')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    &larr; Back to Summary Flow
                </button>
            </div>
            
            <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Summary Report</h1>
            
            <div className="tabs-container" style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--border)', marginBottom: '2rem' }}>
                {tabs.map(tab => (
                    <button 
                        key={tab.id}
                        className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '1rem 2rem',
                            border: 'none',
                            background: 'transparent',
                            color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                            borderBottom: activeTab === tab.id ? '3px solid var(--primary)' : '3px solid transparent',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'money-story' ? (
                <MoneyStorySection />
            ) : activeTab === 'safety-net' ? (
                <SafetyNetSection />
            ) : activeTab === 'future-self' ? (
                <FutureSelfSection />
            ) : (
                <div className="card" style={{ minHeight: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <h2 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>{tabs.find(t => t.id === activeTab)?.label}</h2>
                    <p className="text-muted">Report content coming soon...</p>
                </div>
            )}

            <div style={{ marginTop: '3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <button 
                    className="btn btn-primary" 
                    onClick={() => navigate('/detailed-flow/profile')}
                    style={{ padding: '1rem 3rem', fontSize: '1.1rem', borderRadius: '50px' }}
                >
                    Take me to Detailed Report
                </button>
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

export default SummaryReportView;
