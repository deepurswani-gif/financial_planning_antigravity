import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CreditCard, CheckCircle2, Ticket, Lock, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../services/authService';
import finbrellaLogo from '../../assets/finbrella_logo.png';
import { clearPendingCouponInvite, getPendingCouponInvite } from '@/lib/couponInviteStorage';
import { createRazorpayOrder, verifyRazorpaySignature } from '../../services/razorpayEdgeService';
import { createCheckoutTransaction } from '../../services/checkoutService';
import {
  getAnnualPlanPriceInr,
  getPlanYearLabel,
  getSubscriptionValidUntilDate,
  isIntroPricing,
} from '../../lib/subscriptionAccess';
import { saveWorkspaceCapability, WORKSPACE_CAPABILITY_FULL } from '../FinancialWorkspace/workspaceCapabilityStorage';

const RAZORPAY_SCRIPT_ID = 'razorpay-checkout-js';
const ANNUAL_PLAN_INR = getAnnualPlanPriceInr();
const PLAN_YEAR = getPlanYearLabel();
const VALID_UNTIL = getSubscriptionValidUntilDate();
const INTRO_PRICING = isIntroPricing();

const loadRazorpayScript = () => {
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.getElementById(RAZORPAY_SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = RAZORPAY_SCRIPT_ID;
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const activateSubscription = async (userId) => {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_active: true,
      subscription_valid_until: getSubscriptionValidUntilDate(),
    })
    .eq('id', userId);

  if (error) {
    console.warn('Could not update profile subscription status.', error);
    throw new Error('Payment succeeded, but we could not unlock access. Please contact support.');
  }
};

/**
 * Payment / coupon gate shown before Detailed Flow entry.
 * Summary flow and summary reports remain free and are not gated here.
 */
const SubscriptionGate = ({ onActivate, onBack }) => {
  const { user } = useAuth();
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const autoRedeemAttempted = useRef(false);

  const finishActivation = useCallback(() => {
    setSuccess(true);
    setTimeout(() => {
      onActivate?.();
    }, 1200);
  }, [onActivate]);

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

        await activateSubscription(user.id);

        const { error: txnError } = await createCheckoutTransaction({
          amountInr: 0,
          currency: 'INR',
          status: 'SUCCESS',
          paymentProvider: 'COUPON',
          paymentMethod: 'COUPON_BYPASS',
          couponCode: couponData.code,
          metadata: {
            source: 'detailed_flow_gate',
            mode: 'coupon_bypass',
            plan_year: PLAN_YEAR,
            valid_until: VALID_UNTIL,
          },
        });
        if (txnError) {
          console.warn('Checkout transaction record failed after coupon redeem:', txnError);
        }

        saveWorkspaceCapability(user.id, WORKSPACE_CAPABILITY_FULL);
        clearPendingCouponInvite();
        finishActivation();
      } catch (err) {
        console.error(err);
        setError(err.message || 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    },
    [user?.id, user?.email, finishActivation],
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

  const handlePayWithRazorpay = async () => {
    if (!user?.id || paying || success) return;

    setPaying(true);
    setError(null);

    try {
      const sdkReady = await loadRazorpayScript();
      if (!sdkReady || !window.Razorpay) {
        throw new Error('Unable to load Razorpay Checkout. Please try again.');
      }

      const { data: orderData, error: orderError } = await createRazorpayOrder({
        amountInr: ANNUAL_PLAN_INR,
        currency: 'INR',
        notes: {
          userId: user.id,
          flow: 'detailed_flow_unlock',
          plan: 'calendar_year',
          plan_year: PLAN_YEAR,
          intro_price: INTRO_PRICING ? 'true' : 'false',
        },
      });

      if (orderError || !orderData?.keyId || !orderData?.orderId) {
        throw new Error(orderError?.message || 'Unable to create Razorpay order.');
      }

      const userLabel = user.email?.split('@')[0] || 'Client';

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        order_id: orderData.orderId,
        name: 'Finbrella',
        description: `Detailed Planning — Calendar Year ${PLAN_YEAR}`,
        handler: async (response) => {
          try {
            const { data: verifyData, error: verifyError } = await verifyRazorpaySignature({
              razorpay_payment_id: response?.razorpay_payment_id || '',
              razorpay_order_id: response?.razorpay_order_id || '',
              razorpay_signature: response?.razorpay_signature || '',
            });

            if (verifyError || !verifyData?.verified) {
              throw new Error('Payment received, but signature verification failed.');
            }

            await activateSubscription(user.id);

            const { error: txnError } = await createCheckoutTransaction({
              amountInr: ANNUAL_PLAN_INR,
              currency: 'INR',
              status: 'SUCCESS',
              paymentProvider: 'RAZORPAY',
              paymentMethod: 'ONLINE',
              providerPaymentId: response?.razorpay_payment_id || null,
              providerOrderId: response?.razorpay_order_id || null,
              metadata: {
                source: 'detailed_flow_gate',
                mode: INTRO_PRICING ? 'paid_intro_calendar_year' : 'paid_calendar_year',
                plan_year: PLAN_YEAR,
                valid_until: VALID_UNTIL,
              },
            });

            if (txnError) {
              console.warn('Checkout transaction record failed after payment:', txnError);
            }

            saveWorkspaceCapability(user.id, WORKSPACE_CAPABILITY_FULL);
            finishActivation();
          } catch (err) {
            console.error(err);
            setError(err.message || 'Payment verification failed.');
          } finally {
            setPaying(false);
          }
        },
        prefill: {
          name: userLabel,
          email: user.email || '',
        },
        notes: {
          userId: user.id,
          flow: 'detailed_flow_unlock',
        },
        theme: {
          color: '#0073e6',
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
          },
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.on('payment.failed', () => {
        setError('Payment failed. Please retry or use a coupon code.');
        setPaying(false);
      });
      paymentObject.open();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unable to start payment.');
      setPaying(false);
    }
  };

  return (
    <div className="subscription-gate">
      <div className="gate-header">
        <img
          src={finbrellaLogo}
          alt="Finbrella Logo"
          style={{ height: '80px', objectFit: 'contain' }}
          className="gate-icon"
        />
        <h1>Unlock Detailed Planning</h1>
        <p>
          Summary planning stays free. Pay for calendar year {PLAN_YEAR} (or enter a bypass code) to
          unlock the detailed planning flow and advanced tools.
        </p>
      </div>

      <div className="pricing-grid">
        <div className="pricing-card premium">
          <div className="popular-badge">
            {INTRO_PRICING ? 'Introductory' : 'Calendar Year'}
          </div>
          <div className="card-header">
            <h3>Calendar Year {PLAN_YEAR}</h3>
            <div className="price">
              <span className="currency">₹</span>
              {ANNUAL_PLAN_INR.toLocaleString('en-IN')}
              <span className="period"> till Dec {PLAN_YEAR}</span>
            </div>
            <p>
              {INTRO_PRICING
                ? `Introductory price for calendar year ${PLAN_YEAR}. Access through 31 Dec ${PLAN_YEAR}.`
                : `Unlock detailed planning for calendar year ${PLAN_YEAR} (through 31 Dec ${PLAN_YEAR}).`}
            </p>
          </div>
          <div className="card-actions">
            <button
              type="button"
              onClick={handlePayWithRazorpay}
              className="btn-pay primary"
              disabled={paying || success || loading}
            >
              <CreditCard size={18} />
              {paying ? 'Opening Razorpay…' : success ? 'Unlocked!' : 'Pay with Razorpay'}
            </button>
          </div>
          <ul className="features-list">
            <li>
              <CheckCircle2 size={16} /> Detailed planning questionnaire
            </li>
            <li>
              <CheckCircle2 size={16} /> Advanced reports & calculators
            </li>
            <li>
              <CheckCircle2 size={16} /> Access through 31 Dec {PLAN_YEAR}
            </li>
          </ul>
        </div>
      </div>

      <div className="coupon-section">
        <div className="coupon-header">
          <Ticket size={24} color="var(--primary)" />
          <h4>Have a bypass code?</h4>
        </div>
        <p>Enter your coupon code to skip payment and unlock detailed planning</p>

        <form onSubmit={handleApplyCoupon} className="coupon-form">
          <input
            type="text"
            placeholder="Enter Coupon Code (e.g. FIN-XXXXXX)"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            disabled={loading || success || paying}
          />
          <button
            type="submit"
            disabled={loading || success || paying || !couponCode}
            className={`btn-apply ${success ? 'success' : ''}`}
          >
            {loading ? 'Verifying...' : success ? 'Unlocked!' : 'Apply Code'}
          </button>
        </form>

        {error && (
          <div className="error-message">
            <Lock size={14} /> {error}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: '1.5rem',
          fontSize: '0.95rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
          maxWidth: '500px',
        }}
      >
        Don&apos;t have a coupon code? Email us at{' '}
        <a
          href="mailto:finbrellafpd@gmail.com?subject=GET ME COUPON CODE"
          style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
        >
          finbrellafpd@gmail.com
        </a>{' '}
        with the subject &quot;GET ME COUPON CODE.&quot;
      </div>

      <div className="gate-footer-actions">
        {onBack && (
          <button type="button" onClick={onBack} className="back-btn">
            <ArrowLeft size={16} /> Back to Summary
          </button>
        )}
        <button type="button" onClick={() => signOut()} className="logout-btn">
          Log Out
        </button>
      </div>

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
          grid-template-columns: minmax(280px, 420px);
          gap: 2rem;
          max-width: 800px;
          margin-bottom: 2.5rem;
          width: 100%;
          justify-content: center;
        }

        .pricing-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 2.5rem 2rem;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .pricing-card.premium {
          border-color: var(--primary);
          box-shadow: 0 10px 40px rgba(0, 115, 230, 0.12);
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
          white-space: nowrap;
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
          background: #0073e6;
          color: white;
        }

        .btn-pay.primary:hover:not(:disabled) {
          background: #005bb5;
        }

        .btn-pay:disabled {
          opacity: 0.7;
          cursor: not-allowed;
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

        .gate-footer-actions {
          margin-top: 2.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
          padding: 0.65rem 1.1rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }

        .back-btn:hover {
          border-color: var(--primary);
          color: var(--primary);
        }

        .logout-btn {
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
          .gate-header h1 {
            font-size: 1.85rem;
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
