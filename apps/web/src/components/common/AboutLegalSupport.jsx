import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import finbrellaLogo from '../../assets/finbrella_logo.png';
import { Building2, Calendar, MapPin, Info, Mail, MessageSquare, ScrollText, ShieldAlert, Tag, Phone, Shield, Clock, CheckCircle, Star, ArrowRight } from 'lucide-react';

const tabs = [
  { id: 'about', label: 'About', icon: Info },
  { id: 'contact', label: 'Contact', icon: Mail },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'legal', label: 'Legal', icon: ScrollText },
  { id: 'grievance', label: 'Grievance', icon: ShieldAlert },
  { id: 'version', label: 'Version', icon: Tag }
];

const legalPolicies = {
  termsPrivacy: [
    { id: 'terms-of-use', title: 'Terms of Use', desc: 'Rules and guidelines for using Finbrella services.' },
    { id: 'privacy-policy', title: 'Privacy Policy', desc: 'How we collect, use, and protect your personal information.' },
    { id: 'financial-disclaimer', title: 'Financial Disclaimer & Risk Disclosure', desc: 'Important information about financial risks and limits of liability.' }
  ],
  dataContent: [
    { id: 'user-content', title: 'User Content & Document Upload Policy', desc: 'Rules regarding the documents and data you upload to WealthMap.' },
    { id: 'data-retention', title: 'Data Retention & Deletion Policy', desc: 'How long we keep your data and your rights to delete it.' },
    { id: 'communication', title: 'Communication & Notification Policy', desc: 'How and when we will contact you regarding your account.' },
    { id: 'browser-storage', title: 'Browser Storage & Cookies Policy', desc: 'How we use local storage and cookies to improve your experience.' }
  ]
};

const AboutLegalSupport = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    if (location.state?.activeTab) return location.state.activeTab;
    return sessionStorage.getItem('finbrella_about_tab') || 'about';
  });

  React.useEffect(() => {
    sessionStorage.setItem('finbrella_about_tab', activeTab);
  }, [activeTab]);

  const [feedbackState, setFeedbackState] = useState({
    name: '',
    email: '',
    type: 'Suggestion',
    subject: '',
    message: '',
    rating: 0,
    isSubmitted: false
  });
  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    setFeedbackState(prev => ({ ...prev, isSubmitted: true }));
  };

  const resetFeedback = () => {
    setFeedbackState({
      name: '', email: '', type: 'Suggestion', subject: '', message: '', rating: 0, isSubmitted: false
    });
  };

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '1.5rem 2rem',
        backgroundColor: '#ffffff',
      }}>
        <img src={finbrellaLogo} alt="Finbrella Logo" style={{ height: '32px', width: 'auto' }} />
        <button 
          onClick={handleBack}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#3b82f6',
            cursor: 'pointer',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
        >
          &larr; Back
        </button>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, paddingBottom: '4rem' }}>
        {/* Page Title & Subtitle */}
        <div style={{ textAlign: 'center', padding: '2rem 1rem 3rem 1rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.75rem' }}>
            About Finbrella
          </h1>
          <p style={{ fontSize: '1.125rem', color: '#4b5563', margin: '0 auto', whiteSpace: 'nowrap' }}>
            Everything you need to know about the app, how to reach us, and our policies.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem' }}>
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            overflowX: 'auto', 
            padding: '0.5rem', 
            maxWidth: '100%',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.6rem 1.5rem',
                  borderRadius: '9999px',
                  border: '1px solid',
                  borderColor: activeTab === tab.id ? '#3b82f6' : '#d1d5db',
                  fontWeight: '500',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  backgroundColor: activeTab === tab.id ? '#3b82f6' : '#ffffff',
                  color: activeTab === tab.id ? '#ffffff' : '#4b5563',
                  transition: 'all 0.2s ease-in-out',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            )})}
          </div>
        </div>

        {/* Content Container */}
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1.5rem' }}>
          {activeTab === 'about' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              
              {/* About Brand Section */}
              <section style={{ paddingBottom: '3rem' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                  Finbrella – WealthMap
                </h2>
                <h3 style={{ fontSize: '1.25rem', color: '#3b82f6', fontWeight: '500', marginBottom: '1.5rem' }}>
                  Personal finance, simplified.
                </h3>
                <p style={{ color: '#4b5563', fontSize: '1.125rem', lineHeight: '1.6' }}>
                  A simple, connected view of your money, goals, and financial future.
                </p>
              </section>

              {/* Vision & Mission Section */}
              <section style={{ paddingTop: '3rem', paddingBottom: '1rem' }}>
                <div style={{ border: '1px solid #d1d5db', borderRadius: '12px', padding: '2rem' }}>
                  <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                      Our Vision
                    </h4>
                    <p style={{ color: '#111827', fontSize: '1.125rem', lineHeight: '1.7' }}>
                      To make every Indian household financially aware, prepared, and confident about its future.
                    </p>
                  </div>

                  <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0 0 2rem 0' }} />

                  <div>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                      Our Mission
                    </h4>
                    <p style={{ color: '#111827', fontSize: '1.125rem', lineHeight: '1.7' }}>
                      To simplify financial planning by bringing income, expenses, savings, investments, protection, and goals into one clear WealthMap — so you can understand where you stand, protect what matters, make better decisions, and build the future you want.
                    </p>
                  </div>
                </div>
              </section>

              {/* Company Info Section */}
              <section style={{ paddingTop: '3rem' }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '1.5rem'
                }}>
                  <div style={{ border: '1px solid #d1d5db', borderRadius: '12px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ color: '#3b82f6' }}><Building2 size={24} /></div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                        Company
                      </div>
                      <div style={{ fontWeight: '500', color: '#111827', fontSize: '1rem' }}>
                        Finbrella – WealthMap
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ border: '1px solid #d1d5db', borderRadius: '12px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ color: '#3b82f6' }}><Calendar size={24} /></div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                        Founded Year
                      </div>
                      <div style={{ fontWeight: '500', color: '#111827', fontSize: '1rem' }}>
                        2024
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ border: '1px solid #d1d5db', borderRadius: '12px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ color: '#3b82f6' }}><MapPin size={24} /></div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                        Headquarters
                      </div>
                      <div style={{ fontWeight: '500', color: '#111827', fontSize: '1rem' }}>
                        Udaipur, Rajasthan (India)
                      </div>
                    </div>
                  </div>
                </div>
              </section>

            </div>
          )}

          {activeTab === 'contact' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', paddingTop: '1rem' }}>
              {/* Email */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '9999px', color: '#3b82f6', flexShrink: 0 }}>
                  <Mail size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500', marginBottom: '0.25rem' }}>Support Email</div>
                  <div style={{ fontSize: '1rem', color: '#111827', fontWeight: '600' }}>support@wealthmap.app</div>
                </div>
              </div>
              
              {/* Phone */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '9999px', color: '#3b82f6', flexShrink: 0 }}>
                  <Phone size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500', marginBottom: '0.25rem' }}>Phone</div>
                  <div style={{ fontSize: '1rem', color: '#111827', fontWeight: '600' }}>9785895737, 7046069999</div>
                </div>
              </div>

              {/* Address */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '9999px', color: '#3b82f6', flexShrink: 0 }}>
                  <MapPin size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500', marginBottom: '0.25rem' }}>Business Address</div>
                  <div style={{ fontSize: '1rem', color: '#111827', fontWeight: '600' }}>New Bhupalpura, Udaipur, Rajasthan (India)</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'grievance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingTop: '1rem' }}>
              <p style={{ color: '#4b5563', fontSize: '1.125rem', lineHeight: '1.6' }}>
                If you have a concern or complaint about our services, you can contact Finbrella through the support channel provided on this page. We will review your concern carefully and make reasonable efforts to address it promptly and fairly. If your concern remains unresolved, you may contact us again with the details of the earlier communication so that the matter can be reviewed further.
              </p>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                  <Shield color="#3b82f6" size={24} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Grievance & Support Contact</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name & Designation</div>
                    <div style={{ fontWeight: '600', color: '#0f172a', marginBottom: '0.25rem' }}>Deepak Purswani</div>
                    <div style={{ color: '#475569' }}>Authorized Representative, WealthMap</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Mail size={16}/> Email</div>
                    <div style={{ fontWeight: '600', color: '#0f172a' }}>support@wealthmap.app</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Clock size={16}/> Response Time</div>
                    <div style={{ color: '#0f172a', marginBottom: '0.5rem' }}><span style={{fontWeight: '600'}}>Acknowledgement:</span> Within 48 hours of receiving your complaint.</div>
                    <div style={{ color: '#0f172a' }}><span style={{fontWeight: '600'}}>Resolution:</span> We aim to resolve complaints within 30 days, where reasonably possible.</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <p style={{ color: '#64748b', fontSize: '0.875rem', fontStyle: 'italic' }}>
                    Complex matters may require additional time. If more time is needed, we will keep you informed of the status.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'version' && (
            <div style={{ paddingTop: '1rem', maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', position: 'relative' }}>
                <div style={{ 
                  position: 'absolute', 
                  left: '11px', 
                  top: '24px', 
                  bottom: '0', 
                  width: '2px', 
                  backgroundColor: '#e5e7eb',
                  zIndex: 0
                }} />
                
                <div style={{ backgroundColor: '#fff', padding: '0.25rem', zIndex: 1 }}>
                  <CheckCircle size={24} color="#3b82f6" fill="#eff6ff" />
                </div>
                
                <div style={{ paddingBottom: '3rem', paddingTop: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: 'bold', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.875rem' }}>
                      v1.0
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: '500' }}>
                      August 2026
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                    Initial Release of Finbrella Policies
                  </h3>
                  <p style={{ color: '#4b5563', lineHeight: '1.6' }}>
                    Publication of the foundational legal framework including Terms of Use, Privacy Policy, Financial Disclaimer & Risk Disclosure, User Content & Document Upload Policy, Data Retention & Deletion Policy, Communication & Notification Policy, and Browser Storage & Cookies Policy.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'feedback' && (
            <div style={{ paddingTop: '1rem', maxWidth: '700px', margin: '0 auto' }}>
              <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                {feedbackState.isSubmitted ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', backgroundColor: '#dcfce7', borderRadius: '50%', marginBottom: '1.5rem', color: '#16a34a' }}>
                      <CheckCircle size={32} />
                    </div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.75rem' }}>Thank You!</h3>
                    <p style={{ color: '#4b5563', fontSize: '1.125rem', marginBottom: '2rem' }}>
                      We appreciate you taking the time to help us improve Finbrella.
                    </p>
                    <button
                      onClick={resetFeedback}
                      style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f3f4f6', color: '#374151', borderRadius: '8px', fontWeight: '500', cursor: 'pointer', border: 'none' }}
                    >
                      Submit another response
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleFeedbackSubmit}>
                    <div style={{ marginBottom: '2rem' }}>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>Suggestions & Feedback</h3>
                      <p style={{ color: '#4b5563' }}>We would love to hear from you. Share a suggestion, report a bug, or just tell us what you think.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Name</label>
                        <input required type="text" value={feedbackState.name} onChange={e => setFeedbackState({...feedbackState, name: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Email</label>
                        <input required type="email" value={feedbackState.email} onChange={e => setFeedbackState({...feedbackState, email: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Feedback Type</label>
                      <select value={feedbackState.type} onChange={e => setFeedbackState({...feedbackState, type: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#fff', boxSizing: 'border-box' }}>
                        <option>Suggestion</option>
                        <option>Bug Report</option>
                        <option>Feature Request</option>
                        <option>General Feedback</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Subject</label>
                      <input required type="text" value={feedbackState.subject} onChange={e => setFeedbackState({...feedbackState, subject: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Message</label>
                      <textarea required rows={4} value={feedbackState.message} onChange={e => setFeedbackState({...feedbackState, message: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.75rem' }}>Rate your experience</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFeedbackState({...feedbackState, rating: feedbackState.rating === star ? 0 : star})}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            <Star size={32} color={star <= feedbackState.rating ? '#eab308' : '#d1d5db'} fill={star <= feedbackState.rating ? '#eab308' : 'none'} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <button type="submit" style={{ width: '100%', padding: '1rem', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
                      Submit Feedback
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {activeTab === 'legal' && (
            <div style={{ paddingTop: '1rem' }}>
              <div style={{ marginBottom: '3rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                  Terms & Privacy
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                  {legalPolicies.termsPrivacy.map(policy => (
                    <button
                      key={policy.id}
                      onClick={() => navigate(`/legal/${policy.id}`)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        textAlign: 'left', padding: '1.5rem', backgroundColor: '#fff',
                        border: '1px solid #e5e7eb', borderRadius: '12px', cursor: 'pointer',
                        transition: 'all 0.2s', width: '100%', outline: 'none'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(59, 130, 246, 0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', color: '#111827', marginBottom: '0.25rem', fontSize: '1.05rem' }}>{policy.title}</div>
                        <div style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: '1.4' }}>{policy.desc}</div>
                      </div>
                      <div style={{ color: '#9ca3af', paddingLeft: '1rem' }}>
                        <ArrowRight size={20} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                  Data & Content
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                  {legalPolicies.dataContent.map(policy => (
                    <button
                      key={policy.id}
                      onClick={() => navigate(`/legal/${policy.id}`)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        textAlign: 'left', padding: '1.5rem', backgroundColor: '#fff',
                        border: '1px solid #e5e7eb', borderRadius: '12px', cursor: 'pointer',
                        transition: 'all 0.2s', width: '100%', outline: 'none'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(59, 130, 246, 0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', color: '#111827', marginBottom: '0.25rem', fontSize: '1.05rem' }}>{policy.title}</div>
                        <div style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: '1.4' }}>{policy.desc}</div>
                      </div>
                      <div style={{ color: '#9ca3af', paddingLeft: '1rem' }}>
                        <ArrowRight size={20} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AboutLegalSupport;
