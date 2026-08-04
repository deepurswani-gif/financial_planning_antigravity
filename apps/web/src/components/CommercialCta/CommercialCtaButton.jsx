import React, { useEffect, useMemo, useState } from 'react';
import { Send, Check } from 'lucide-react';
import {
    submitSupportRequestViaWeb3forms,
    buildSupportEmailContextFromUser,
    getSupportWeb3StorageKey,
    isSupportWeb3CooldownActive,
    markSupportWeb3Sent,
} from '../../services/supportRequestEmailService';
import { AnalyticsEventName, trackAnalyticsEvent } from '../../lib/analytics';

const ERROR_COOLDOWN_SEC = 20;

/**
 * Renders a CTA object produced by the Commercial CTA Resolver and executes its
 * strategy. Reports pass the resolved CTA and a context; this component owns no
 * label, visibility or behaviour decisions of its own.
 *
 * Only the `email` execution strategy is implemented in this phase, and it
 * reuses the existing support email service (no new communication
 * infrastructure). Any other strategy renders a disabled, labelled button
 * (inactive metadata) until a future phase wires it.
 */
const CommercialCtaButton = ({ cta, context = {}, accentColor = '#00A9F2', className = '' }) => {
    if (!cta) return null;

    if (cta.executionStrategy === 'email') {
        return (
            <EmailCtaButton
                cta={cta}
                context={context}
                accentColor={accentColor}
                className={className}
            />
        );
    }

    // Inactive strategies (view/buy/sip/…) exist as metadata only for now.
    return (
        <button type="button" className={className} disabled style={{ '--cta-color': accentColor }}>
            {cta.label}
        </button>
    );
};

const EmailCtaButton = ({ cta, context, accentColor, className }) => {
    const { familyMembers, user, moduleName } = context;
    const [sendState, setSendState] = useState('idle');
    const [retrySeconds, setRetrySeconds] = useState(null);

    const emailContext = useMemo(
        () => buildSupportEmailContextFromUser(familyMembers, user, moduleName),
        [familyMembers, user, moduleName],
    );

    const storageKey = useMemo(() => {
        const email = emailContext?.userEmail;
        if (!email || !moduleName) return null;
        return getSupportWeb3StorageKey(email, moduleName);
    }, [emailContext?.userEmail, moduleName]);

    useEffect(() => {
        if (!storageKey) return;
        setSendState(isSupportWeb3CooldownActive(storageKey) ? 'success' : 'idle');
        setRetrySeconds(null);
    }, [storageKey]);

    useEffect(() => {
        if (retrySeconds === null || retrySeconds <= 0) return undefined;
        const t = setTimeout(() => {
            setRetrySeconds((prev) => {
                if (prev === null || prev <= 1) {
                    setSendState('idle');
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearTimeout(t);
    }, [retrySeconds]);

    const handleClick = async () => {
        if (!storageKey || sendState === 'loading' || sendState === 'success') return;
        if (isSupportWeb3CooldownActive(storageKey)) {
            setSendState('success');
            return;
        }
        trackAnalyticsEvent({
            eventName: AnalyticsEventName.CTA_CLICK,
            eventCategory: 'feature',
            component: 'CommercialCtaButton',
            feature: 'commercial_cta',
            properties: {
                ctaId: cta.ctaId,
                analyticsEvent: cta.analytics?.analyticsEvent ?? null,
                recommendationId: cta.analytics?.recommendationId ?? null,
                originatingReport: cta.analytics?.originatingReport ?? null,
                moduleName: moduleName ?? null,
            },
        });
        setSendState('loading');
        try {
            const { ok } = await submitSupportRequestViaWeb3forms(emailContext);
            if (ok) {
                markSupportWeb3Sent(storageKey);
                setSendState('success');
                setRetrySeconds(null);
            } else {
                setSendState('error');
                setRetrySeconds(ERROR_COOLDOWN_SEC);
            }
        } catch {
            setSendState('error');
            setRetrySeconds(ERROR_COOLDOWN_SEC);
        }
    };

    const disabled =
        sendState === 'loading' ||
        sendState === 'success' ||
        (sendState === 'error' && retrySeconds !== null && retrySeconds > 0);

    return (
        <button
            type="button"
            className={className}
            onClick={handleClick}
            disabled={disabled}
            data-cta-id={cta.ctaId}
            data-analytics-event={cta.analytics?.analyticsEvent}
            style={{
                '--cta-color': accentColor,
                background:
                    sendState === 'success' ? '#16a34a' : sendState === 'error' ? '#dc2626' : accentColor,
            }}
        >
            {sendState === 'loading' && (
                <>
                    <Send size={16} />
                    Sending…
                </>
            )}
            {sendState === 'success' && (
                <>
                    <Check size={16} strokeWidth={2.5} />
                    Request sent
                </>
            )}
            {sendState === 'error' && (
                <span>Try again in <strong>{retrySeconds ?? 0}s</strong></span>
            )}
            {sendState === 'idle' && (
                <>
                    <Send size={16} />
                    {cta.label}
                </>
            )}
        </button>
    );
};

export default CommercialCtaButton;
