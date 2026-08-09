import { AlertCircle, Chrome, Lock, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { signInWithEmail, signInWithGoogle } from '../../services/authService';
import { getPendingCouponInvite } from '@/lib/couponInviteStorage';

const Login = ({ onSwitchToSignup, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const inv = getPendingCouponInvite();
    if (inv?.email) setEmail(inv.email);
  }, []);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await signInWithEmail(email, password);
    
    if (signInError) {
      setError(signInError.message || 'Failed to sign in. Please check your credentials.');
      setLoading(false);
    }
    // No need to setLoading(false) on success as component will unmount
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    
    const { error: signInError } = await signInWithGoogle();
    
    if (signInError) {
      setError(signInError.message || 'Failed to sign in with Google.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p className="text-muted">Sign in to continue your financial planning journey</p>
        </div>

        {error && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="auth-form">
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
              disabled={loading}
            />
          </div>

          <div className="auth-actions">
            <button 
              type="button" 
              className="link-button"
              onClick={onForgotPassword}
              disabled={loading}
            >
              Forgot Password?
            </button>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="divider">
          <span>OR</span>
        </div>

        <button 
          type="button"
          className="btn btn-google btn-block"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <Chrome size={18} />
          Continue with Google
        </button>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <button 
              className="link-button" 
              onClick={onSwitchToSignup}
              disabled={loading}
            >
              Sign Up
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

        .auth-form {
          margin-bottom: 1.5rem;
        }

        .auth-actions {
          text-align: right;
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

export default Login;
//changes