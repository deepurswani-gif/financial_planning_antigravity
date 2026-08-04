import { useEffect, useRef } from 'react';
import { AnalyticsEventName, trackAnalyticsEvent } from '../lib/analytics';

/**
 * Tracks time spent on a report section. Emits report_exit with durationMs
 * when the section changes or the component unmounts.
 */
export function useReportDwellTracking({
  section,
  surface,
  feature,
  enabled = true,
}) {
  const stateRef = useRef(null);

  useEffect(() => {
    if (!enabled || !section) return undefined;

    const enteredAt = Date.now();
    stateRef.current = { section, surface, feature, enteredAt };

    trackAnalyticsEvent({
      eventName: AnalyticsEventName.REPORT_VIEW,
      eventCategory: 'screen',
      feature: feature || `${surface || 'report'}`,
      properties: { section, surface: surface || null },
    });

    return () => {
      const prev = stateRef.current;
      if (!prev?.section) return;
      const durationMs = Date.now() - prev.enteredAt;
      if (durationMs < 250) return; // ignore instant flips
      trackAnalyticsEvent({
        eventName: AnalyticsEventName.REPORT_EXIT,
        eventCategory: 'screen',
        feature: prev.feature || `${prev.surface || 'report'}`,
        properties: {
          section: prev.section,
          surface: prev.surface || null,
          durationMs,
        },
      });
      stateRef.current = null;
    };
  }, [section, surface, feature, enabled]);
}
