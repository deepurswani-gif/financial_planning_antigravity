import React from 'react';
import ForgotPassword from '../components/Auth/ForgotPassword';
import Login from '../components/Auth/Login';
import Signup from '../components/Auth/Signup';
import WelcomeScreen from '../components/Welcome/WelcomeScreen';
import { useAuth } from '../contexts/AuthContext';
import {
  consumeInviteParamsFromUrl,
  getPendingCouponInvite,
} from '@/lib/couponInviteStorage';
import { hasSeenWelcome } from '@/lib/welcomeStorage';

function resolveInitialAuthView() {
  consumeInviteParamsFromUrl();
  if (getPendingCouponInvite()) return 'login';
  if (hasSeenWelcome()) return 'login';
  return 'welcome';
}

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = React.useState(resolveInitialAuthView);

  React.useEffect(() => {
    consumeInviteParamsFromUrl();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your financial plan...</p>

        <style jsx>{`
          .loading-container {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: var(--bg-main);
          }

          .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid var(--border);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 1rem;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          p {
            color: var(--text-muted);
            font-size: 0.875rem;
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    switch (authView) {
      case 'welcome':
        return <WelcomeScreen onNavigate={setAuthView} />;
      case 'signup':
        return <Signup onSwitchToLogin={() => setAuthView('login')} />;
      case 'forgot-password':
        return <ForgotPassword onBack={() => setAuthView('login')} />;
      default:
        return (
          <Login
            onSwitchToSignup={() => setAuthView('signup')}
            onForgotPassword={() => setAuthView('forgot-password')}
          />
        );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
