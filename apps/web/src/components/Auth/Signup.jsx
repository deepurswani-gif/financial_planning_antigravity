import { AlertCircle, Briefcase, CheckCircle, Chrome, Lock, Mail, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { signInWithGoogle, signUpWithEmail } from '../../services/authService';
import { getPendingCouponInvite } from '@/lib/couponInviteStorage';

const Signup = ({ onSwitchToLogin }) => {
  const [role, setRole] = useState('user'); // 'agent' or 'user'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const inv = getPendingCouponInvite();
    if (inv?.email) setEmail(inv.email);
  }, []);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (role === 'agent' && !company) {
      setError('Company name is required for agent registration');
      return;
    }

    setLoading(true);

    const { error: signUpError } = await signUpWithEmail(email, password, fullName, role, company);
    
    if (signUpError) {
      setError(signUpError.message || 'Failed to create account. Please try again.');
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      // Optionally redirect to login or show success message
      setTimeout(() => {
        onSwitchToLogin();
      }, 2000);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setLoading(true);
    
    const { error: signInError } = await signInWithGoogle(role);
    
    if (signInError) {
      setError(signInError.message || 'Failed to sign up with Google.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Create Account</h1>
          <p className="text-muted">Start your journey to financial freedom</p>
        </div>

        {error && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="success-banner">
            <CheckCircle size={18} />
            <span>Account created successfully! Please check your email to verify your account.</span>
          </div>
        )}

        {/* Role Selection */}
        <div className="role-selection">
          <label style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', display: 'block' }}>
            I am signing up as:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            <button
              type="button"
              onClick={() => setRole('user')}
              disabled={loading}
              className="role-button"
              style={{
                padding: '1.25rem',
                border: `2px solid ${role === 'user' ? 'var(--primary)' : 'var(--border)'}`,
                background: role === 'user' ? 'var(--primary)10' : 'transparent',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: role === 'user' ? '600' : '500'
              }}
            >
              <User size={24} />
              <span>Regular User</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Create my own report</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('agent')}
              disabled={loading}
              className="role-button"
              style={{
                padding: '1.25rem',
                border: `2px solid ${role === 'agent' ? 'var(--primary)' : 'var(--border)'}`,
                background: role === 'agent' ? 'var(--primary)10' : 'transparent',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: role === 'agent' ? '600' : '500'
              }}
            >
              <Briefcase size={24} />
              <span>Agent</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Create reports for clients</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSignup} className="auth-form">
          <div className="input-group">
            <label>
              <User size={14} /> Full Name
            </label>
            <input
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <label>
              <Mail size={14} /> Email Address
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {role === 'agent' && (
            <div className="input-group">
              <label>
                <Briefcase size={14} /> Company Name
              </label>
              <input
                type="text"
                placeholder="Your Financial Consulting Firm"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="input-group">
            <label>
              <Lock size={14} /> Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <label>
              <Lock size={14} /> Confirm Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block"
            disabled={loading || success}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="divider">
          <span>OR</span>
        </div>

        <button 
          type="button"
          className="btn btn-google btn-block"
          onClick={handleGoogleSignup}
          disabled={loading || success}
        >
          <Chrome size={18} />
          Continue with Google
        </button>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <button 
              className="link-button" 
              onClick={onSwitchToLogin}
              disabled={loading}
            >
              Sign In
            </button>
          </p>
          <p className="legal-disclaimer">
            By signing in or creating an account, you confirm that you have read and agree to the <a href="/legal/terms-of-use" target="_blank" rel="noreferrer" className="legal-policy-link">Terms of Use</a> and acknowledge the <a href="/legal/privacy-policy" target="_blank" rel="noreferrer" className="legal-policy-link">Privacy Policy</a>.
          </p>
        </div>
      </div>

      <style jsx>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
          padding: 2rem;
        }

        .auth-card {
          background: var(--bg-card);
          border-radius: 16px;
          padding: 3rem;
          max-width: 440px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .auth-header h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .error-banner {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid #ef4444;
          color: #ef4444;
          padding: 1rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
        }

        .success-banner {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid var(--accent);
          color: var(--accent);
          padding: 1rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
        }

        .auth-form {
          margin-bottom: 1.5rem;
        }

        .btn-block {
          width: 100%;
        }

        .btn-google {
          background: white;
          border: 1px solid var(--border);
          color: var(--text-main);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
        }

        .btn-google:hover {
          background: var(--bg-main);
        }

        .divider {
          position: relative;
          text-align: center;
          margin: 2rem 0;
        }

        .divider::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--border);
        }

        .divider span {
          background: var(--bg-card);
          padding: 0 1rem;
          position: relative;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .auth-footer {
          text-align: center;
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid var(--border);
        }

        .link-button {
          background: none;
          border: none;
          color: var(--primary);
          cursor: pointer;
          font-weight: 600;
          padding: 0;
        }

        .link-button:hover {
          text-decoration: underline;
        }

        .link-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .legal-disclaimer {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-style: italic;
          margin-top: 1.5rem;
          line-height: 1.6;
        }

        .legal-policy-link {
          color: var(--text-main);
          text-decoration: underline;
          font-weight: 500;
        }
        
        .legal-policy-link:hover {
          color: var(--primary);
        }
      `}</style>
    </div>
  );
};

export default Signup;
