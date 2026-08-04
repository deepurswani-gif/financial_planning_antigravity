/**
 * Global push delivery policy — quiet hours (IST) + configurable rate limits.
 * Pure functions: pass clock + history; no I/O.
 */

/**
 * @typedef {object} PushRateLimits
 * @property {number} maxPerDay
 * @property {number} maxPerWeek
 * @property {{ maxPerDay?: number, maxPerWeek?: number } | null} [weekendOverrides]
 * @property {{ maxPerDay?: number, maxPerWeek?: number } | null} [campaignOverrides]
 */

/**
 * @typedef {object} PushQuietHours
 * @property {string} timeZone
 * @property {number} startHour - inclusive, 0–23 (e.g. 22 = 10:00 PM)
 * @property {number} endHour - exclusive end of quiet window morning hour (e.g. 7 = 7:00 AM)
 */

/**
 * @typedef {object} PushDeliveryPolicy
 * @property {PushQuietHours} quietHours
 * @property {PushRateLimits} rateLimits
 */

/** @type {PushDeliveryPolicy} */
export const DEFAULT_PUSH_POLICY = Object.freeze({
  quietHours: Object.freeze({
    timeZone: 'Asia/Kolkata',
    startHour: 22,
    endHour: 7,
  }),
  rateLimits: Object.freeze({
    maxPerDay: 2,
    maxPerWeek: 10,
    weekendOverrides: null,
    campaignOverrides: null,
  }),
});

/**
 * Merge policy overrides (weekend / campaign) without mutating defaults.
 * @param {PushDeliveryPolicy} [base]
 * @param {{ weekend?: boolean, campaign?: boolean }} [flags]
 */
export function resolveEffectiveRateLimits(base = DEFAULT_PUSH_POLICY, flags = {}) {
  const limits = { ...base.rateLimits };
  if (flags.weekend && base.rateLimits.weekendOverrides) {
    Object.assign(limits, base.rateLimits.weekendOverrides);
  }
  if (flags.campaign && base.rateLimits.campaignOverrides) {
    Object.assign(limits, base.rateLimits.campaignOverrides);
  }
  return Object.freeze({
    maxPerDay: limits.maxPerDay,
    maxPerWeek: limits.maxPerWeek,
  });
}

function getZonedParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: parts.weekday,
  };
}

/**
 * Quiet hours: 22:00 ≤ t < 24:00 OR 00:00 ≤ t < 07:00 in Asia/Kolkata.
 * @param {Date} [now]
 * @param {PushDeliveryPolicy} [policy]
 */
export function isInQuietHours(now = new Date(), policy = DEFAULT_PUSH_POLICY) {
  const { timeZone, startHour, endHour } = policy.quietHours;
  const { hour } = getZonedParts(now, timeZone);
  if (startHour > endHour) {
    return hour >= startHour || hour < endHour;
  }
  return hour >= startHour && hour < endHour;
}

/**
 * Next instant (approx) when quiet hours end in the policy timezone.
 * @param {Date} [now]
 * @param {PushDeliveryPolicy} [policy]
 * @returns {Date}
 */
export function nextQuietHoursEnd(now = new Date(), policy = DEFAULT_PUSH_POLICY) {
  if (!isInQuietHours(now, policy)) return new Date(now.getTime());

  const { timeZone, endHour } = policy.quietHours;
  // Step forward hour-by-hour in UTC until local hour exits quiet window (simple + robust).
  let cursor = new Date(now.getTime());
  for (let i = 0; i < 24 * 4; i += 1) {
    cursor = new Date(cursor.getTime() + 15 * 60 * 1000);
    const { hour, minute } = getZonedParts(cursor, timeZone);
    if (hour === endHour && minute === 0) return cursor;
    if (!isInQuietHours(cursor, policy) && hour === endHour) {
      // Snap to the start of endHour by subtracting residual minutes/seconds.
      return new Date(cursor.getTime() - minute * 60 * 1000 - getZonedParts(cursor, timeZone).second * 1000);
    }
    if (!isInQuietHours(cursor, policy)) return cursor;
  }
  return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}

function startOfZonedDay(now, timeZone) {
  const p = getZonedParts(now, timeZone);
  // Approximate: find UTC time whose zoned Y-M-D matches and hour=0 by binary-ish walk.
  let cursor = new Date(now.getTime());
  for (let i = 0; i < 48; i += 1) {
    const c = getZonedParts(cursor, timeZone);
    if (c.year === p.year && c.month === p.month && c.day === p.day && c.hour === 0 && c.minute < 15) {
      return new Date(cursor.getTime() - c.minute * 60 * 1000 - c.second * 1000);
    }
    cursor = new Date(cursor.getTime() - 30 * 60 * 1000);
  }
  return new Date(now.getTime() - 24 * 60 * 60 * 1000);
}

function isWeekendInZone(now, timeZone) {
  const { weekday } = getZonedParts(now, timeZone);
  return weekday === 'Sat' || weekday === 'Sun';
}

/**
 * @param {{ sentAt: Date|string|number }[]} history - prior successful sends
 * @param {Date} [now]
 * @param {PushDeliveryPolicy} [policy]
 */
export function evaluateRateLimits(history = [], now = new Date(), policy = DEFAULT_PUSH_POLICY) {
  const timeZone = policy.quietHours.timeZone;
  const limits = resolveEffectiveRateLimits(policy, {
    weekend: isWeekendInZone(now, timeZone),
    campaign: Boolean(policy.rateLimits.campaignOverrides),
  });

  const dayStart = startOfZonedDay(now, timeZone).getTime();
  const weekStart = dayStart - 6 * 24 * 60 * 60 * 1000;
  const times = history
    .map((h) => new Date(h.sentAt).getTime())
    .filter((t) => Number.isFinite(t));

  const sentToday = times.filter((t) => t >= dayStart).length;
  const sentThisWeek = times.filter((t) => t >= weekStart).length;

  const dayOk = sentToday < limits.maxPerDay;
  const weekOk = sentThisWeek < limits.maxPerWeek;

  return {
    ok: dayOk && weekOk,
    limits,
    sentToday,
    sentThisWeek,
    reason: !dayOk
      ? 'rate_limit_day'
      : !weekOk
        ? 'rate_limit_week'
        : null,
  };
}

/**
 * Decide whether to send now or queue until quiet hours end / retry later.
 * Rate-limit exhaustion → drop/defer with reason (caller persists queue).
 *
 * @param {{ sentAt: Date|string|number }[]} [sendHistory]
 * @param {Date} [now]
 * @param {PushDeliveryPolicy} [policy]
 */
export function planDelivery(sendHistory = [], now = new Date(), policy = DEFAULT_PUSH_POLICY) {
  const rate = evaluateRateLimits(sendHistory, now, policy);
  if (!rate.ok) {
    return {
      action: 'defer',
      deliverAt: null,
      reason: rate.reason,
      rate,
    };
  }

  if (isInQuietHours(now, policy)) {
    return {
      action: 'queue',
      deliverAt: nextQuietHoursEnd(now, policy),
      reason: 'quiet_hours',
      rate,
    };
  }

  return {
    action: 'send_now',
    deliverAt: now,
    reason: null,
    rate,
  };
}
