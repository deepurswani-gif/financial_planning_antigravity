/* FLAG_PAYMENT_DISABLED:
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CreditCard, CheckCircle2, Ticket, Lock, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../services/authService';
import finbrellaLogo from '../../assets/finbrella_logo.png';
import { clearPendingCouponInvite, getPendingCouponInvite } from '@/lib/couponInviteStorage';

const SubscriptionGate = ({ onActivate }) => {
  const { user } = useAuth();
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const autoRedeemAttempted = useRef(false);

  const redeemCoupon = useCallback(
    async (rawCode) => {
      const code = rawCode.trim();
      if (!code || !user?.id) return;

      setLoading(true);
      setError(null);

      try {
        const { data: couponData, error: couponError } = await supabase
          .from('coupon_codes')
          .select('*')
          .eq('code', code)
          .eq('is_used', false)
          .maybeSingle();

        if (couponError || !couponData) {
          throw new Error('Invalid or already used coupon code.');
        }

        if (
          !couponData.target_email ||
          !user?.email ||
          couponData.target_email.toLowerCase() !== user.email.toLowerCase()
        ) {
          throw new Error('This coupon is not valid for your account.');
        }

        const usedAt = new Date().toISOString();
        const { error: updateCouponError } = await supabase
          .from('coupon_codes')
          .update({ is_used: true, used_at: usedAt })
          .eq('id', couponData.id);

        if (updateCouponError) {
          throw new Error('Failed to redeem coupon. Please contact support.');
        }

        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({ subscription_active: true })
          .eq('id', user.id);

        if (profileError) {
          console.warn(
            'Could not update profile subscription status. It may not exist in the DB schema yet.',
            profileError,
          );
        }

        clearPendingCouponInvite();
        setSuccess(true);
        setTimeout(() => {
          onActivate();
        }, 1500);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    },
    [user?.id, user?.email, onActivate],
  );

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    await redeemCoupon(couponCode);
  };

  useEffect(() => {
    if (autoRedeemAttempted.current || success || !user?.email) return;
    const inv = getPendingCouponInvite();
    if (!inv?.code) return;
    if (inv.email.toLowerCase() !== user.email.toLowerCase()) {
      setError('Use the same email address this invitation was sent to, then we can apply your coupon.');
      autoRedeemAttempted.current = true;
      return;
    }
    autoRedeemAttempted.current = true;
    setCouponCode(inv.code.toUpperCase());
    void redeemCoupon(inv.code);
  }, [user?.email, success, redeemCoupon]);

  const handleMockPayment = (plan) => {
    alert(`Redirecting to RazorPay for the ${plan} plan...\n\n(Mock Payment Gateway Integration)`);
  };

  return (
    <div className="subscription-gate">
      <div className="gate-header">
        <img src={finbrellaLogo} alt="Finbrella Logo" style={{ height: '80px', objectFit: 'contain' }} className="gate-icon" />
        <h1>Activate Your Account</h1>
        <p>Choose a subscription plan to unlock full access to the Finbrella Financial Planning Suite.</p>
      </div>

      <div className="pricing-grid">
        // Annual Plan Card
        <div className="pricing-card premium">
          <div className="popular-badge">Most Popular</div>
          <div className="card-header">
            <h3>Annual Plan</h3>
            <div className="price">
              <span className="currency">₹</span>2,000<span className="period">/yr</span>
            </div>
            <p>Full suite access for 12 months.</p>
          </div>
          <div className="card-actions">
            <button onClick={() => handleMockPayment('Annual')} className="btn-pay primary">
              <CreditCard size={18} /> Pay with Razorpay
            </button>
          </div>
          <ul className="features-list">
            <li><CheckCircle2 size={16} /> Complete Diagnostic Suite</li>
            <li><CheckCircle2 size={16} /> Data Export & Reports</li>
            <li><CheckCircle2 size={16} /> Free Priority Support</li>
          </ul>
        </div>

        // Renewal Plan Card
        <div className="pricing-card standard">
          <div className="card-header">
            <h3>Renewal Plan</h3>
            <div className="price">
              <span className="currency">₹</span>1,000<span className="period">/yr</span>
            </div>
            <p>For existing members renewing access.</p>
          </div>
          <div className="card-actions">
            <button onClick={() => handleMockPayment('Renewal')} className="btn-pay secondary">
              <Zap size={18} /> Renew Access
            </button>
          </div>
          <ul className="features-list">
            <li><CheckCircle2 size={16} /> Continuous Account Access</li>
            <li><CheckCircle2 size={16} /> Preserve Legacy Data</li>
          </ul>
        </div>
      </div>

      // Coupon Bypass Section
      <div className="coupon-section">
        <div className="coupon-header">
          <Ticket size={24} color="var(--primary)" />
          <h4>Have a Coupon code?</h4>
        </div>
        <p>Enter your coupon code to bypass the payment gateway</p>
        
        <form onSubmit={handleApplyCoupon} className="coupon-form">
          <input 
            type="text" 
            placeholder="Enter Coupon Code (e.g. FIN-XXXXXX)"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            disabled={loading || success}
          />
          <button type="submit" disabled={loading || success || !couponCode} className={`btn-apply ${success ? 'success' : ''}`}>
            {loading ? 'Verifying...' : success ? 'Activated!' : 'Apply Code'}
          </button>
        </form>

        {error && <div className="error-message"><Lock size={14} /> {error}</div>}
      </div>

      <div style={{ marginTop: '1.5rem', fontSize: '0.95rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '500px' }}>
        Don't have a coupon code? Email us at <a href="mailto:finbrellafpd@gmail.com?subject=GET ME COUPON CODE" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>finbrellafpd@gmail.com</a> with the subject "GET ME COUPON CODE."
      </div>

      <button onClick={() => signOut()} className="logout-btn">
        Log Out
      </button>

      <style jsx>{`
        .subscription-gate {
          min-height: 100vh;
          background: var(--bg-main);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          color: var(--text);
          font-family: inherit;
        }

        .gate-header {
          text-align: center;
          margin-bottom: 3rem;
          max-width: 600px;
        }

        .gate-icon {
          color: var(--primary);
          margin-bottom: 1rem;
        }

        .gate-header h1 {
          font-size: 2.5rem;
          margin: 0 0 1rem 0;
          background: linear-gradient(135deg, var(--text) 0%, var(--text-muted) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .gate-header p {
          color: var(--text-muted);
          font-size: 1.1rem;
          line-height: 1.6;
        }

        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          max-width: 800px;
          margin-bottom: 4rem;
          width: 100%;
        }

        .pricing-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 2.5rem 2rem;
          position: relative;
          display: flex;
          flex-direction: column;
          transition: all 0.3s ease;
        }

        .pricing-card.premium {
          border-color: var(--primary);
          box-shadow: 0 10px 40px rgba(var(--primary-rgb), 0.1);
          transform: translateY(-10px);
        }

        .pricing-card:hover {
          transform: translateY(-10px);
          border-color: var(--primary);
        }

        .popular-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--primary);
          color: white;
          padding: 0.25rem 1rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .card-header h3 {
          margin: 0 0 1rem 0;
          color: var(--text-muted);
          font-weight: 500;
        }

        .price {
          font-size: 3.5rem;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 1rem;
          line-height: 1;
        }

        .price .currency {
          font-size: 1.5rem;
          vertical-align: super;
          margin-right: 0.25rem;
        }

        .price .period {
          font-size: 1rem;
          color: var(--text-muted);
          font-weight: 400;
        }

        .card-header p {
          color: var(--text-muted);
          font-size: 0.9rem;
          margin-bottom: 2rem;
        }

        .btn-pay {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          border: none;
        }

        .btn-pay.primary {
          background: #0073e6; // Razorpay Blue
          color: white;
        }

        .btn-pay.primary:hover {
          background: #005bb5;
        }

        .btn-pay.secondary {
          background: var(--bg-main);
          color: var(--text);
          border: 1px solid var(--border);
        }

        .btn-pay.secondary:hover {
          border-color: var(--text);
        }

        .features-list {
          list-style: none;
          padding: 0;
          margin: 2rem 0 0 0;
        }

        .features-list li {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .features-list li svg {
          color: var(--primary);
        }

        .coupon-section {
          background: var(--bg-card);
          border: 1px dashed var(--border);
          border-radius: 12px;
          padding: 2rem;
          max-width: 500px;
          width: 100%;
          text-align: center;
        }

        .coupon-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .coupon-header h4 {
          margin: 0;
          font-size: 1.25rem;
        }

        .coupon-section p {
          color: var(--text-muted);
          font-size: 0.9rem;
          margin-bottom: 1.5rem;
        }

        .coupon-form {
          display: flex;
          gap: 0.5rem;
        }

        .coupon-form input {
          flex: 1;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg-main);
          color: var(--text);
          font-size: 1rem;
          font-family: monospace;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .coupon-form input:focus {
          outline: none;
          border-color: var(--primary);
        }

        .btn-apply {
          padding: 0 1.5rem;
          border-radius: 8px;
          border: none;
          background: var(--primary);
          color: #ffffff;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-apply:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(255,255,255,0.1);
        }

        .btn-apply:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-apply.success {
          background: #10b981;
          color: white;
        }

        .error-message {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          padding: 0.75rem;
          border-radius: 8px;
          margin-top: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-size: 0.9rem;
        }

        .logout-btn {
          margin-top: 3rem;
          background: transparent;
          border: none;
          color: var(--text-muted);
          text-decoration: underline;
          cursor: pointer;
        }
        
        .logout-btn:hover {
          color: var(--text);
        }
        
        @media (max-width: 768px) {
          .pricing-grid {
            grid-template-columns: 1fr;
          }
          .pricing-card.premium {
            transform: none;
          }
          .pricing-card:hover {
            transform: none;
          }
          .coupon-form {
            flex-direction: column;
          }
          .btn-apply {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default SubscriptionGate;
*/
const SubscriptionGate = () => null;
export default SubscriptionGate;
