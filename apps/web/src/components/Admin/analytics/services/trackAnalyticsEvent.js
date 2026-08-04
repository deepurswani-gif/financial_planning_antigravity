/**
 * Phase 2 instrumentation scaffold.
 * Emits into analytics_events when available; never blocks UX.
 */

import { supabase, isSupabaseEnabled } from '../../../../lib/supabase';

const EVENT_QUEUE = [];
let flushTimer = null;

export const AnalyticsEventName = {
  SCREEN_VIEW: 'screen_view',
  SCREEN_EXIT: 'screen_exit',
  FEATURE_CLICK: 'feature_click',
  COMPONENT_CLICK: 'component_click',
  SMART_EDIT_OPEN: 'smart_edit_open',
  SMART_EDIT_SAVE: 'smart_edit_save',
  AI_PROMPT: 'ai_prompt',
  RECOMMENDATION_VIEW: 'recommendation_view',
  RECOMMENDATION_ACCEPT: 'recommendation_accept',
  RECOMMENDATION_IGNORE: 'recommendation_ignore',
  CTA_CLICK: 'cta_click',
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  REPORT_VIEW: 'report_view',
  REPORT_EXIT: 'report_exit',
  QUESTION_SKIP: 'question_skip',
  NOTIFICATION_GENERATED: 'notification_generated',
  NOTIFICATION_SENT: 'notification_sent',
  NOTIFICATION_DELIVERED: 'notification_delivered',
  NOTIFICATION_OPENED: 'notification_opened',
  NOTIFICATION_DEEP_LINK_OPENED: 'notification_deep_link_opened',
};

function detectDevice() {
  try {
    return {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      language: typeof navigator !== 'undefined' ? navigator.language : null,
      viewport:
        typeof window !== 'undefined'
          ? { w: window.innerWidth, h: window.innerHeight }
          : null,
    };
  } catch {
    return {};
  }
}

/**
 * @param {object} params
 * @param {string} params.eventName
 * @param {string} [params.eventCategory]
 * @param {string} [params.screen]
 * @param {string} [params.component]
 * @param {string} [params.feature]
 * @param {string} [params.sessionId]
 * @param {string} [params.userId]
 * @param {string} [params.planId]
 * @param {object} [params.properties]
 * @param {object} [params.device]
 */
export function trackAnalyticsEvent(params) {
  if (!params?.eventName) return;
  EVENT_QUEUE.push({
    occurred_at: new Date().toISOString(),
    event_name: params.eventName,
    event_category: params.eventCategory || inferCategory(params.eventName),
    screen: params.screen || (typeof window !== 'undefined' ? window.location?.pathname : null),
    component: params.component || null,
    feature: params.feature || null,
    session_id: params.sessionId || getOrCreateSessionId(),
    user_id: params.userId || null,
    plan_id: params.planId || null,
    properties: params.properties || {},
    device: params.device || detectDevice(),
  });
  scheduleFlush();
}

function inferCategory(eventName) {
  if (eventName.startsWith('session_')) return 'session';
  if (eventName.startsWith('screen_') || eventName === 'report_view') return 'screen';
  if (eventName.startsWith('recommendation_')) return 'recommendation';
  if (eventName.startsWith('smart_edit_') || eventName === 'ai_prompt') return 'ai';
  if (eventName === 'cta_click' || eventName.includes('feature') || eventName.includes('component')) {
    return 'feature';
  }
  return 'product';
}

function getOrCreateSessionId() {
  try {
    const key = 'wm_analytics_session_id';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function clearAnalyticsSessionId() {
  try {
    sessionStorage.removeItem('wm_analytics_session_id');
  } catch {
    /* ignore */
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAnalyticsEvents();
  }, 1200);
}

export async function flushAnalyticsEvents() {
  if (!isSupabaseEnabled || EVENT_QUEUE.length === 0) {
    EVENT_QUEUE.length = 0;
    return;
  }
  const batch = EVENT_QUEUE.splice(0, EVENT_QUEUE.length);
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id || null;
    const rows = batch.map((row) => ({
      ...row,
      user_id: row.user_id || userId,
    }));
    const { error } = await supabase.from('analytics_events').insert(rows);
    if (error && import.meta.env.DEV) {
      console.debug('[analytics] flush skipped:', error.message);
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.debug('[analytics] flush error:', err);
    }
  }
}

/** Flush pending events on page hide (best-effort). */
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flushAnalyticsEvents();
    }
  });
}
