import React, { useEffect, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { isFirebaseConfigured } from '../../lib/firebase';
import {
  disablePushNotifications,
  enablePushNotifications,
  getNotificationPermission,
  isPushOptedIn,
  setPushOptIn,
} from '../../lib/pushNotifications';
import { ensurePushTokenForUser } from '../../services/ensurePushTokenForUser';
import {
  hasEnabledPushToken,
  removePushToken,
  upsertPushToken,
} from '../../services/pushTokenService';
import { sendTestPushToSelf } from '../../services/pushNotificationEdgeService';

/**
 * Push settings — opt-in is per account; tokens are re-bound on this device.
 */
export default function NotificationSettingsPanel({ open, onClose, userId }) {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState(getNotificationPermission());
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    (async () => {
      setMessage('');
      setError('');
      setPermission(getNotificationPermission());

      if (!userId) {
        setEnabled(false);
        return;
      }

      setSyncing(true);
      try {
        const optedIn = isPushOptedIn(userId);
        const { ok: hasToken } = await hasEnabledPushToken(userId);

        // Browser already allowed notifications, but this account has no token
        // (common after switching login on the same device) — re-bind quietly.
        if (
          getNotificationPermission() === 'granted' &&
          (optedIn || hasToken || localStorage.getItem('finplan_push_opt_in') === '1')
        ) {
          const ensured = await ensurePushTokenForUser(userId, { force: true });
          if (!cancelled) {
            setEnabled(Boolean(ensured.ok));
            setPermission(ensured.permission || getNotificationPermission());
            if (ensured.ok && !hasToken) {
              setMessage('Push linked to this account on this device.');
            }
          }
          return;
        }

        if (!cancelled) {
          setEnabled(optedIn && hasToken);
        }
      } catch (err) {
        if (!cancelled) {
          setEnabled(isPushOptedIn(userId));
          if (import.meta.env.DEV) {
            console.warn('[FCM] settings sync failed:', err);
          }
        }
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  if (!open) return null;

  const supported =
    isFirebaseConfigured &&
    typeof Notification !== 'undefined' &&
    'serviceWorker' in navigator;

  const onToggle = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (enabled) {
        const lastToken = sessionStorage.getItem('finplan_last_fcm_token');
        await disablePushNotifications({ userId });
        if (userId && lastToken) {
          await removePushToken({ userId, token: lastToken });
        }
        sessionStorage.removeItem('finplan_last_fcm_token');
        setEnabled(false);
        setMessage('Push notifications turned off for this account.');
      } else {
        if (!userId) {
          setError('Sign in to enable push notifications.');
          return;
        }
        const { permission: nextPermission, token } = await enablePushNotifications({
          userId,
        });
        setPermission(nextPermission);
        if (nextPermission !== 'granted' || !token) {
          setEnabled(false);
          setError(
            nextPermission === 'denied'
              ? 'Notifications are blocked in the browser. Allow them in site settings, then try again.'
              : 'Could not enable push notifications.',
          );
          return;
        }
        sessionStorage.setItem('finplan_last_fcm_token', token);
        const { error: saveError } = await upsertPushToken({ userId, token });
        if (saveError) {
          console.warn('[FCM] Token save failed:', saveError);
          setPushOptIn(true, userId);
          setEnabled(true);
          setMessage('Enabled on this device, but saving the token to your account failed.');
        } else {
          setPushOptIn(true, userId);
          setEnabled(true);
          setMessage('Push notifications enabled.');
        }
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
      setPermission(getNotificationPermission());
    }
  };

  const onSendTest = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!userId) {
        throw new Error('Sign in to send a test notification.');
      }

      // Always re-bind token for this account before send (fixes account switch).
      const ensured = await ensurePushTokenForUser(userId, { force: true });
      if (!ensured.ok) {
        throw new Error(
          ensured.reason === 'permission_or_token'
            ? 'Allow browser notifications, then try again.'
            : 'Could not register this device for push. Toggle Enable off/on and retry.',
        );
      }
      setEnabled(true);

      const { error: sendError } = await sendTestPushToSelf({
        title: 'Finbrella test',
        body: 'Push notifications are working on this device.',
      });
      if (sendError) throw sendError;
      setMessage('Test notification sent. If the tab is open, check the tray — or minimize Chrome and send again.');
    } catch (err) {
      setError(err?.message || 'Could not send test notification.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fw-settings-overlay" role="presentation" onClick={onClose}>
      <div
        className="fw-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fw-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fw-settings-panel-header">
          <h2 id="fw-settings-title">Settings</h2>
          <button type="button" className="fw-icon-btn" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <section className="fw-settings-section">
          <div className="fw-settings-section-title">
            {enabled ? <Bell size={18} /> : <BellOff size={18} />}
            <span>Push notifications</span>
          </div>
          <p className="fw-settings-hint">
            Get alerts for plan updates and important reminders in this browser. One tap to enable —
            we handle the rest for this account.
          </p>

          {!supported ? (
            <p className="fw-settings-error">
              Push is not available here (needs Firebase config, HTTPS or localhost, and a
              supporting browser).
            </p>
          ) : (
            <>
              <label className="fw-settings-toggle-row">
                <span>Enable push notifications</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={busy || syncing || !userId}
                  onChange={onToggle}
                />
              </label>
              <p className="fw-settings-meta">
                Browser permission: {permission}
                {syncing ? ' · linking device…' : ''}
              </p>
              {enabled ? (
                <button
                  type="button"
                  className="fw-settings-secondary-btn"
                  disabled={busy || syncing || !userId}
                  onClick={onSendTest}
                >
                  Send test notification
                </button>
              ) : null}
            </>
          )}

          {message ? <p className="fw-settings-ok">{message}</p> : null}
          {error ? <p className="fw-settings-error">{error}</p> : null}
        </section>
      </div>
    </div>
  );
}
