import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Import policies using Vite's ?raw syntax to load as text
import termsOfUse from '../../docs/Terms of Use.txt?raw';
import privacyPolicy from '../../docs/Privacy Policy.txt?raw';
import financialDisclaimer from '../../docs/Financial Disclaimer & Risk Disclosure.txt?raw';
import userContent from '../../docs/User Content, Document Upload & Financial Records Policy.txt?raw';
import dataRetention from '../../docs/Data Retention & Deletion Policy.txt?raw';
import communication from '../../docs/Communication & Notification Policy.txt?raw';
import browserStorage from '../../docs/Browser Storage, Cookies & Offline Technology Policy.txt?raw';

const policyMap = {
  'terms-of-use': { title: 'Terms of Use', content: termsOfUse },
  'privacy-policy': { title: 'Privacy Policy', content: privacyPolicy },
  'financial-disclaimer': { title: 'Financial Disclaimer & Risk Disclosure', content: financialDisclaimer },
  'user-content': { title: 'User Content & Document Upload Policy', content: userContent },
  'data-retention': { title: 'Data Retention & Deletion Policy', content: dataRetention },
  'communication': { title: 'Communication & Notification Policy', content: communication },
  'browser-storage': { title: 'Browser Storage & Cookies Policy', content: browserStorage }
};

const PolicyViewer = () => {
  const { policyId } = useParams();
  const navigate = useNavigate();
  const policy = policyMap[policyId];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [policyId]);

  if (!policy) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Policy Not Found</h2>
            <button 
              onClick={() => navigate('/about_legal_support', { state: { activeTab: 'legal' } })} 
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
            >
              Back to Legal
            </button>
          </div>
        </div>
      </div>
    );
  }

  const lines = policy.content.split('\n');

  const renderLine = (line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Detect metadata
    if (/^(Version|Effective Date|Last Updated):/i.test(trimmed)) {
      return <div key={index} style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.25rem', fontFamily: 'monospace' }}>{trimmed}</div>;
    }

    // Detect numbered headings (e.g., "1. Introduction" or "5.2 Data Sharing")
    if (/^\d+(\.\d+)*\.\s+[A-Z]/i.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      return (
        <h2 key={index} style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginTop: '3rem', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
          {trimmed}
        </h2>
      );
    }

    // Detect subheadings/definitions like "Account means..."
    if (/^[A-Za-z0-9 ]+ means /i.test(trimmed)) {
       const parts = trimmed.split(' means ');
       return (
         <p key={index} style={{ marginBottom: '1rem', color: '#4b5563', lineHeight: '1.7' }}>
           <strong style={{ color: '#111827' }}>{parts[0]}</strong> means {parts.slice(1).join(' means ')}
         </p>
       )
    }

    // Detect bullet points
    if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
      return (
        <div key={index} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', paddingLeft: '1.5rem' }}>
          <span style={{ color: '#3b82f6', fontWeight: 'bold', marginTop: '0.1rem' }}>•</span>
          <span style={{ color: '#4b5563', lineHeight: '1.7' }}>{trimmed.replace(/^[•-]\s*/, '')}</span>
        </div>
      );
    }

    // Skip the first title if it matches policy title
    if (index === 0 && (trimmed.toLowerCase() === policy.title.toLowerCase() || trimmed.includes(policy.title))) {
      return null;
    }

    // Default paragraph
    return <p key={index} style={{ marginBottom: '1.25rem', color: '#4b5563', lineHeight: '1.7' }}>{trimmed}</p>;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
      {/* Header */}
      <header style={{ padding: '1rem 2rem', borderBottom: '1px solid #e5e7eb', position: 'fixed', top: 0, left: 0, right: 0, backgroundColor: '#fff', zIndex: 50, boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          <button 
            onClick={() => {
              if (window.history.length > 2) {
                navigate(-1);
              } else {
                navigate('/about_legal_support', { state: { activeTab: 'legal' }, replace: true });
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#f3f4f6', border: 'none', color: '#374151', cursor: 'pointer', fontWeight: '600', padding: '0.5rem 1rem', borderRadius: '8px', transition: 'background-color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e5e7eb'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          >
            <ArrowLeft size={18} /> Back to Legal
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, padding: '6rem 2rem 3rem 2rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#111827', marginBottom: '2rem' }}>{policy.title}</h1>
          <div style={{ color: '#374151', fontSize: '1.05rem', lineHeight: '1.7' }}>
            {lines.map((line, index) => renderLine(line, index))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PolicyViewer;
