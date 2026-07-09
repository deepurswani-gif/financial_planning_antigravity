import { 
  LogOut, User, Users, ArrowRightLeft, Wallet, Target, Shield, 
  Umbrella, LifeBuoy, Map, PieChart, TrendingUp, ListChecks, 
  LayoutDashboard, Calculator, Percent, Landmark, Car, 
  GraduationCap, LineChart, MoveDown, PiggyBank, Home, CheckCircle2,
  Copy, Menu, X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AssetModule from './components/AssetModule/AssetModule';
import RoleBasedRouting from './components/Auth/RoleBasedRouting';
import CashFlowModule from './components/CashFlowModule/CashFlowModule';
import ContingencyModule from './components/ContingencyModule/ContingencyModule';
import GoalModule from './components/GoalModule/GoalModule';
import InsuranceModule from './components/InsuranceModule/InsuranceModule';
import IncomeTaxModule from './components/IncomeTaxModule/IncomeTaxModule';
import JourneyModule from './components/JourneyModule/JourneyModule';
import ProfileModule from './components/ProfileModule/ProfileModule';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectionGapModule from './components/ProtectionGapModule/ProtectionGapModule';
import AllocationModule from './components/AllocationModule/AllocationModule';
import GrowthModule from './components/GrowthModule/GrowthModule';
import FulfillmentModule from './components/FulfillmentModule/FulfillmentModule';
// FLAG_PAYMENT_DISABLED: import CheckoutGate from './components/CheckoutModule/CheckoutGate';
import ReportView from './components/ReportModule/ReportView';
import CalculatorPlaceholder from './components/Calculators/CalculatorPlaceholder';
import SIPCalculator from './components/Calculators/SIPCalculator';
import PersonalLoanCalculator from './components/Calculators/PersonalLoanCalculator';
import HomeLoanCalculator from './components/Calculators/HomeLoanCalculator';
import CarLoanCalculator from './components/Calculators/CarLoanCalculator';
import TwoWheelerCalculator from './components/Calculators/TwoWheelerCalculator';
import EducationLoanCalculator from './components/Calculators/EducationLoanCalculator';
import LumpsumCalculator from './components/Calculators/LumpsumCalculator';
import EquityCalculator from './components/Calculators/EquityCalculator';
import SWPCalculator from './components/Calculators/SWPCalculator';
import PPFCalculator from './components/Calculators/PPFCalculator';
import NPSCalculator from './components/Calculators/NPSCalculator';
import FDCalculator from './components/Calculators/FDCalculator';
import RDCalculator from './components/Calculators/RDCalculator';
import { useBreakpoints } from '@/hooks';
import { useAuth } from './contexts/AuthContext';
import { useFinancialPlan } from './contexts/FinancialPlanContext';
import { signOut } from './services/authService';
import finbrellaLogo from './assets/finbrella_logo.png';
import { SHOW_STAGING_USER_ID_TOOL } from '@/config/environment';

/**
 * Legacy 12-step detailed flow layout.
 * Plan data is read and written through FinancialPlanContext (shared with summary/detailed flows).
 */
function DetailedFlowLayout() {
  const { user } = useAuth();
  const { lg } = useBreakpoints();
  const navigate = useNavigate();
  
  const {
    loading,
    saving,
    lastSaved,
    planSyncError,
    planReloadToken,
    setPlanReloadToken,
    currentStep,
    setCurrentStep,
    maxStep,
    handleStepProgression,
    insuranceMode,
    setCashFlowSubStep,
    familyMembers,
    income,
    savePlanData,
    handleLogoutCleanup,
  } = useFinancialPlan();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState(false);
  const [isMobileLeftMenuOpen, setIsMobileLeftMenuOpen] = useState(false);
  const [isMobileRightMenuOpen, setIsMobileRightMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('modules');
  const [activeCalculator, setActiveCalculator] = useState(null);

  useEffect(() => {
    setIsMobileLeftMenuOpen(false);
    setIsMobileRightMenuOpen(false);
  }, [currentStep, activeSection, activeCalculator, planReloadToken]);

  const handleLogout = async () => {
    await savePlanData();
    await signOut();
    handleLogoutCleanup();
  };

  const copySupabaseUserId = async () => {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setCopiedUserId(true);
      window.setTimeout(() => setCopiedUserId(false), 2000);
    } catch {
      // clipboard API unavailable or denied
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  // Mobile: overlay drawers; tablet/desktop: persistent sidebars (useBreakpoints is layout-only, never blocks access).

  return (
    <RoleBasedRouting>
      <ProtectedRoute>
        <div className="app-shell">
        {(isMobileLeftMenuOpen || isMobileRightMenuOpen) && !lg && (
          <div 
            className="sidebar-overlay"
            onClick={() => {
              setIsMobileLeftMenuOpen(false);
              setIsMobileRightMenuOpen(false);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(4px)',
              zIndex: 999
            }}
          />
        )}
        {planSyncError && (
          <div
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              background: 'rgba(220, 38, 38, 0.12)',
              borderBottom: '1px solid rgba(220, 38, 38, 0.35)',
              fontSize: '0.9rem',
              lineHeight: 1.45,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <strong>Cannot sync your plan ΓÇö edits will not save.</strong>{' '}
            <span>{planSyncError}</span>
            <button
              type="button"
              onClick={() => setPlanReloadToken((t) => t + 1)}
              style={{
                marginLeft: 0,
                padding: '0.25rem 0.6rem',
                cursor: 'pointer',
                borderRadius: '6px',
                border: '1px solid rgba(220, 38, 38, 0.5)',
                background: 'var(--bg-card, #fff)',
                flexShrink: 0,
              }}
            >
              Retry
            </button>
          </div>
        )}
        {/* Left Drawer: Process Navigation */}
        <aside className={`sidebar left-drawer ${isMobileLeftMenuOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem', padding: '1.5rem 1rem 0 1rem', height: 'auto', borderBottom: 'none', position: 'relative' }}>
            {!lg && (
              <button 
                type="button"
                onClick={() => setIsMobileLeftMenuOpen(false)}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px'
                }}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <LayoutDashboard size={24} color="var(--primary)" />
              <span className="nav-label" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Finbrella</span>
            </div>
            <button 
                className="btn btn-secondary nav-label" 
                onClick={() => navigate('/summary-report/money_story')}
                style={{ fontSize: '0.85rem', padding: '0.5rem', width: '100%', textAlign: 'center', borderRadius: '8px', border: '1px solid var(--border)' }}
            >
                &larr; Back to Summary
            </button>
          </div>
          
          <div style={{ flex: 1, padding: '1rem 0' }}>
            {[
              {
                phase: 'Foundation',
                items: [
                  { step: 1, name: 'Profile', icon: Users },
                  { step: 2, name: 'Cash Flow', icon: ArrowRightLeft },
                  { step: 3, name: 'Assets', icon: Wallet },
                  { step: 4, name: 'Goals', icon: Target }
                ]
              },
              {
                phase: 'Protection',
                items: [
                  { step: 5, name: 'Insurance', icon: Shield },
                  { step: 6, name: 'Protection Gap', icon: Umbrella },
                  { step: 7, name: 'Contingency', icon: LifeBuoy }
                ]
              },
              {
                phase: 'Trajectory',
                items: [
                  { step: 8, name: 'Journey', icon: Map },
                  { step: 9, name: 'Allocation', icon: PieChart },
                  { step: 10, name: 'Growth', icon: TrendingUp }
                ]
              },
              {
                phase: 'Execution',
                items: [
                  { step: 11, name: 'Roadmap', icon: ListChecks },
                  { step: 12, name: 'Overview', icon: LayoutDashboard }
                ]
              }
            ].map((phaseGroup, pIdx) => {
              const phaseUnlocked = phaseGroup.items.some(item => maxStep >= item.step);
              
              return (
                <div key={phaseGroup.phase} className={`phase-group ${phaseUnlocked ? 'unlocked' : 'locked'}`} style={{ marginBottom: pIdx < 3 ? '1rem' : '0' }}>
                  <div className="phase-header" style={{ padding: '0.25rem 1.4rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                     <span className="nav-label">Phase {pIdx + 1}: {phaseGroup.phase}</span>
                     {phaseGroup.items.every(item => item.step < maxStep) && (
                       <CheckCircle2 size={14} color="var(--emerald-500)" style={{ marginLeft: 'auto', marginRight: '1rem' }} className="nav-label" />
                     )}
                  </div>
                  {phaseGroup.items.map((mod) => {
                    const isCompleted = mod.step < maxStep;
                    const isActive = activeSection === 'modules' && currentStep === mod.step;
                    const isLocked = mod.step > maxStep || (mod.name === 'Insurance' && insuranceMode === 'anyway');
                    
                    return (
                      <div key={mod.name} style={{ position: 'relative' }}>
                        <button
                          className={`sidebar-btn ${isActive ? 'active' : ''}`}
                          disabled={isLocked}
                          onClick={() => {
                            if (!isLocked) {
                              setCurrentStep(mod.step);
                              setActiveSection('modules');
                              if (mod.name === 'Cash Flow') setCashFlowSubStep(1);
                            }
                          }}
                          style={{ opacity: isLocked ? 0.4 : 1 }}
                        >
                          {isCompleted && !isActive ? (
                            <div style={{ position: 'relative' }}>
                              <mod.icon size={20} />
                              <CheckCircle2 size={10} color="var(--emerald-500)" style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--bg-card)', borderRadius: '50%' }} />
                            </div>
                          ) : (
                            <mod.icon size={20} />
                          )}
                          <span className="nav-label">{mod.step}. {mod.name}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right Drawer: Calculators Navigation */}
        <aside className={`sidebar right-drawer ${isMobileRightMenuOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-header" style={{ color: 'var(--text-main)', position: 'relative' }}>
            <Calculator size={24} />
            <span className="nav-label">Calculators</span>
            {!lg && (
              <button 
                type="button"
                onClick={() => setIsMobileRightMenuOpen(false)}
                style={{
                  position: 'absolute',
                  top: '1.5rem',
                  right: '1rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px'
                }}
                aria-label="Close calculators"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <div style={{ flex: 1, padding: '1rem 0' }}>
            {[
              { id: 'tax', label: 'Income Tax', icon: Landmark },
              { id: 'sip', label: 'SIP', icon: LineChart },
              { id: 'ppf', label: 'PPF', icon: PiggyBank },
              { id: 'nps', label: 'NPS', icon: Umbrella },
              { id: 'fd', label: 'Fixed Deposit', icon: Percent },
              { id: 'rd', label: 'Recurring Dep.', icon: ArrowRightLeft },
              { id: 'per_loan', label: 'Personal Loan', icon: User },
              { id: 'home_loan', label: 'Home Loan', icon: Home },
              { id: 'car_loan', label: 'Car Loan', icon: Car },
              { id: 'two_wheeler_loan', label: 'Two-Wheeler', icon: Car },
              { id: 'edu_loan', label: 'Edu. Loan', icon: GraduationCap },
              { id: 'lumpsum', label: 'Lumpsum', icon: Wallet },
              { id: 'equity', label: 'Equity & ETFs', icon: TrendingUp },
              { id: 'swp', label: 'SWP', icon: MoveDown }
            ].map((calc) => (
              <button
                key={calc.id}
                className={`sidebar-btn ${activeSection === 'calculators' && activeCalculator === calc.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveCalculator(calc.id);
                  setActiveSection('calculators');
                }}
              >
                <calc.icon size={20} />
                <span className="nav-label">{calc.label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="main-content-wrapper fade-in">
          <header style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            marginBottom: '2rem', 
            paddingBottom: '1rem', 
            borderBottom: '1px solid var(--border)',
            position: lg ? 'static' : 'sticky',
            top: lg ? 'auto' : 0,
            background: lg ? 'transparent' : 'var(--bg-card)',
            zIndex: lg ? 'auto' : 100,
            padding: lg ? '0 0 1rem 0' : '0.75rem 1rem',
            margin: lg ? '0 0 2rem 0' : '0 -1rem 2rem -1rem',
            boxShadow: lg ? 'none' : 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: lg ? '4rem' : 0 }}>
              {!lg && (
                <button
                  type="button"
                  onClick={() => setIsMobileLeftMenuOpen(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    borderRadius: '8px'
                  }}
                  aria-label="Toggle menu"
                >
                  <Menu size={24} />
                </button>
              )}
              <img src={finbrellaLogo} alt="Finbrella Logo" style={{ height: lg ? '56px' : '36px', width: 'auto', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginRight: lg ? '3rem' : 0 }}>
              {saving ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  {lg && "Saving..."}
                </span>
              ) : lastSaved ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  {lg && `Saved at ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </span>
              ) : null}
              {!lg && (
                <button
                  type="button"
                  onClick={() => setIsMobileRightMenuOpen(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    borderRadius: '8px'
                  }}
                  aria-label="Toggle calculators"
                >
                  <Calculator size={22} />
                </button>
              )}
              {SHOW_STAGING_USER_ID_TOOL && user?.id && lg ? (
                <button
                  type="button"
                  onClick={() => { void copySupabaseUserId(); }}
                  title="Copy your Supabase user id (staging only)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '0.35rem 0.55rem',
                    borderRadius: '8px',
                    border: '1px dashed var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <Copy size={14} />
                  {copiedUserId ? 'Copied' : 'User id'}
                </button>
              ) : null}
              <div style={{ position: 'relative' }}>
                <button 
                  className="profile-icon-btn" 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  style={{ 
                    background: 'var(--primary-light)', 
                    border: '1px solid var(--primary-light)', 
                    borderRadius: '50%', 
                    width: lg ? '40px' : '32px', 
                    height: lg ? '40px' : '32px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    cursor: 'pointer',
                    color: 'var(--primary)',
                    marginLeft: lg ? '1rem' : '0.25rem'
                  }}
                >
                  <User size={lg ? 20 : 16} />
                </button>
                {showProfileMenu && (
                  <>
                    <div 
                      style={{ position: 'fixed', inset: 0, zIndex: 1040 }} 
                      onClick={() => setShowProfileMenu(false)}
                    />
                    <div className="fade-in" style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '0.5rem',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      boxShadow: 'var(--shadow-md)',
                      padding: '1rem',
                      minWidth: '220px',
                      zIndex: 1050
                    }}>
                      <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <User size={14} /> {user?.email || 'User'}
                        </p>
                      </div>
                      <button className="btn" onClick={handleLogout} style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                        <LogOut size={16} /> Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <main style={{ maxWidth: '64rem', margin: '0 auto', width: '100%' }}>
          {activeSection === 'modules' ? (
            <>
              {currentStep === 1 && (
                <ProfileModule onNext={() => { handleStepProgression(2); }} />
              )}
              {currentStep === 2 && (
                <CashFlowModule
                  onNext={() => { handleStepProgression(3); setCashFlowSubStep(1); }}
                  onBack={() => { setCurrentStep(1); window.scrollTo(0, 0); }}
                  setCurrentStep={setCurrentStep}
                />
              )}
              {currentStep === 3 && (
                <AssetModule
                  onNext={() => { handleStepProgression(4); }}
                  onBack={() => { setCurrentStep(2); window.scrollTo(0, 0); }}
                />
              )}
              {currentStep === 4 && (
                <GoalModule
                  onNext={() => { handleStepProgression(5); }}
                  onBack={() => { setCurrentStep(3); window.scrollTo(0, 0); }}
                />
              )}
              {currentStep === 5 && (
                <InsuranceModule
                  onNext={() => { handleStepProgression(6); }}
                  onBack={() => { setCurrentStep(4); window.scrollTo(0, 0); }}
                  setCurrentStep={setCurrentStep}
                />
              )}
              {currentStep === 6 && (
                <ProtectionGapModule
                  onNext={() => { handleStepProgression(7); }}
                  onBack={() => { setCurrentStep(5); window.scrollTo(0, 0); }}
                />
              )}
              {currentStep === 7 && (
                <ContingencyModule
                  onNext={() => { handleStepProgression(8); }}
                  onBack={() => { setCurrentStep(6); window.scrollTo(0, 0); }}
                />
              )}
              {currentStep === 8 && (
                <>
                {/* FLAG_PAYMENT_DISABLED: <CheckoutGate user={user} onBack={() => { setCurrentStep(7); window.scrollTo(0, 0); }}> */}
                  <JourneyModule
                    onNext={() => { handleStepProgression(9); }}
                    onBack={() => { setCurrentStep(7); window.scrollTo(0, 0); }}
                  />
                {/* FLAG_PAYMENT_DISABLED: </CheckoutGate> */}
                </>
              )}
              {currentStep === 9 && (
                <AllocationModule
                  onNext={() => { handleStepProgression(10); }}
                  onBack={() => { setCurrentStep(8); window.scrollTo(0, 0); }}
                />
              )}
              {currentStep === 10 && (
                <GrowthModule
                  onNext={() => { handleStepProgression(11); }}
                  onBack={() => { setCurrentStep(9); window.scrollTo(0, 0); }}
                />
              )}
              {currentStep === 11 && (
                <FulfillmentModule
                  onNext={() => { handleStepProgression(12); }}
                  onBack={() => { setCurrentStep(10); window.scrollTo(0, 0); }}
                />
              )}
              {currentStep === 12 && (
                <ReportView onBack={() => { setCurrentStep(11); window.scrollTo(0, 0); }} />
              )}
            </>
          ) : (
            <>
              {activeCalculator === 'tax' && (
                <IncomeTaxModule
                  familyMembers={familyMembers}
                  income={income}
                  isCalculatorMode={true}
                />
              )}
              {activeCalculator === 'sip' && <SIPCalculator />}
              {activeCalculator === 'per_loan' && <PersonalLoanCalculator />}
              {activeCalculator === 'home_loan' && <HomeLoanCalculator />}
              {activeCalculator === 'car_loan' && <CarLoanCalculator />}
              {activeCalculator === 'two_wheeler_loan' && <TwoWheelerCalculator />}
              {activeCalculator === 'edu_loan' && <EducationLoanCalculator />}
              {activeCalculator === 'lumpsum' && <LumpsumCalculator />}
              {activeCalculator === 'equity' && (
                <div className="calculator-wrapper slide-up" style={{ padding: '0.5rem', background: '#f8fafc', borderRadius: '12px' }}>
                  <EquityCalculator />
                </div>
              )}
              {activeCalculator === 'ppf' && <PPFCalculator />}
              {activeCalculator === 'nps' && <NPSCalculator />}
              {activeCalculator === 'fd' && <FDCalculator />}
              {activeCalculator === 'rd' && <RDCalculator />}
              {activeCalculator === 'swp' && <SWPCalculator />}
            </>
          )}
        </main>

        <footer style={{
          marginTop: '4rem',
          padding: '2rem 0',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
          borderTop: '1px solid var(--border)'
        }}>
          ┬⌐ 2026 FinPlan - Comprehensive Financial Planning Report
        </footer>
        </div>
      </div>
      </ProtectedRoute>
    </RoleBasedRouting>
  );
}

export default DetailedFlowLayout;
