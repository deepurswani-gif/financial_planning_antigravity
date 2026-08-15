import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import SubscriptionGate from './SubscriptionGate';
import { isSubscriptionCurrentlyValid } from '../../lib/subscriptionAccess';
import {
  financialWorkspacePath,
  DEFAULT_SUMMARY_REPORT_ID,
} from '../FinancialWorkspace/workspaceNavConfig';

/**
 * Route gate for Detailed Flow / Detailed Report.
 * Summary flow/report stay free — checks calendar-year subscription validity.
 */
const DetailedAccessGate = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (hasAccess && location.state?.returnTo) {
      const target = location.state.returnTo;
      navigate(target, { replace: true, state: {} });
    }
  }, [hasAccess, location.state?.returnTo, navigate]);

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      if (!user?.id) {
        if (!cancelled) {
          setHasAccess(false);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('subscription_active, subscription_valid_until, role')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.warn('Detailed access check failed:', error.message);
        }

        const unlocked = isSubscriptionCurrentlyValid({
          subscription_active: data?.subscription_active,
          subscription_valid_until: data?.subscription_valid_until,
          role: data?.role,
        });

        if (!cancelled) {
          setHasAccess(Boolean(unlocked));
        }
      } catch (err) {
        console.error('Detailed access check error:', err);
        if (!cancelled) setHasAccess(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void checkAccess();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleActivate = useCallback(() => {
    setHasAccess(true);
  }, []);

  const handleBack = useCallback(() => {
    navigate(financialWorkspacePath('summary', { report: DEFAULT_SUMMARY_REPORT_ID }), {
      replace: true,
    });
  }, [navigate]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div>Loading...</div>
      </div>
    );
  }

  if (!hasAccess) {
    return <SubscriptionGate onActivate={handleActivate} onBack={handleBack} />;
  }

  return children;
};

export default DetailedAccessGate;
