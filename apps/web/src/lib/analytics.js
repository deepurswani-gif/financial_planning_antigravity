/**
 * Public analytics instrumentation entrypoint (Phase 2).
 * Product surfaces should import from here — not from Admin internals.
 */
export {
  AnalyticsEventName,
  clearAnalyticsSessionId,
  flushAnalyticsEvents,
  trackAnalyticsEvent,
} from '../components/Admin/analytics/services/trackAnalyticsEvent';
