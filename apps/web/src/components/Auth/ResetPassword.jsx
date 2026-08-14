import { AlertCircle, CheckCircle, Lock, ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { updatePassword } from '../../services/authService';
import { useLocation, useNavigate } from 'react-router-dom';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check for errors in hash
    const hash = location.hash;
    if (hash && hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDesc = params.get('error_description');
      if (errorDesc) {
        setError(errorDesc.replace(/\+/g, ' '));
      } else {
        setError('An error occurred during password reset.');
      }
    }
  }, [location]);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    const { error: updateError } = await updatePassword(password);
    
    if (updateError) {
      setError(updateError.message || 'Failed to update password. Please try again.');
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setTimeout(() => navigate('/'), 3000);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <button className="back-button" onClick={() => navigate('/')} disabled={loading}>
          <ArrowLeft size={18} /> Back to Login
        </button>

        <div className="auth-header">
          <h1>Set New Password</h1>
          <p className="text-muted">Please enter your new password below</p>
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
            <span>Password updated successfully! Redirecting...</span>
          </div>
        )}

        {!success && !error.includes('expired') && !error.includes('invalid') && (
          <form onSubmit={handleUpdatePassword} className="auth-form">
            <div className="input-group">
              <label>
                <Lock size={14} /> New Password
              </label>
              <input
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            
            <div className="input-group">
              <label>
                <Lock size={14} /> Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
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
          position: relative;
        }

        .back-button {
          position: absolute;
          top: 1.5rem;
          left: 1.5rem;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          padding: 0.5rem;
        }

        .back-button:hover {
          color: var(--primary);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 2rem;
          margin-top: 2rem;
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

        .btn-block {
          width: 100%;
        }
      `}</style>
    </div>
  );
};

export default ResetPassword;
