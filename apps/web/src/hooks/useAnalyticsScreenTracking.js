import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AnalyticsEventName, trackAnalyticsEvent } from '../lib/analytics';

function featureFromPath(pathname) {
  if (pathname.startsWith('/summary-flow')) return 'summary_flow';
  if (pathname.startsWith('/summary-report')) return 'summary_report';
  if (pathname.startsWith('/detailed-flow')) return 'detailed_flow';
  if (pathname.startsWith('/detailed-report')) return 'detailed_report';
  if (pathname.startsWith('/financial-workspace')) return 'financial_workspace';
  if (pathname.startsWith('/admin') || pathname === '/') return 'app';
  return 'app';
}

/**
 * Central screen_view / screen_exit tracker. Mount once under routed layout.
 */
export function useAnalyticsScreenTracking({ planId } = {}) {
  const location = useLocation();
  const prevRef = useRef(null);

  useEffect(() => {
    const screen = `${location.pathname}${location.search || ''}`;
    const enteredAt = Date.now();
    const feature = featureFromPath(location.pathname);

    trackAnalyticsEvent({
      eventName: AnalyticsEventName.SCREEN_VIEW,
      eventCategory: 'screen',
      screen,
      feature,
      planId: planId || null,
    });

    prevRef.current = { screen, enteredAt, feature, planId: planId || null };

    return () => {
      const prev = prevRef.current;
      if (!prev) return;
      trackAnalyticsEvent({
        eventName: AnalyticsEventName.SCREEN_EXIT,
        eventCategory: 'screen',
        screen: prev.screen,
        feature: prev.feature,
        planId: prev.planId,
        properties: { durationMs: Date.now() - prev.enteredAt },
      });
    };
  }, [location.pathname, location.search, planId]);
}
