/**
 * Per-notification frequency enforcement using delivery history.
 * History entries: { notificationId, sentAt, scopeKey?, fingerprint? }
 */

function toTime(value) {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

function zonedYearMonth(date, timeZone = 'Asia/Kolkata') {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}`;
}

/**
 * @param {import('./schema').NotificationDefinition} notification
 * @param {{ notificationId: string, sentAt: Date|string|number, scopeKey?: string|null, fingerprint?: string|null }[]} history
 * @param {{ now?: Date, scopeValue?: string|null, fingerprint?: string|null, timeZone?: string }} [ctx]
 */
export function evaluateNotificationFrequency(notification, history = [], ctx = {}) {
  const now = ctx.now ?? new Date();
  const nowMs = now.getTime();
  const freq = notification.frequency;
  const mine = history.filter((h) => h.notificationId === notification.id);

  if (freq.type === 'cooldown') {
    const windowMs =
      (freq.cooldownHours ?? 0) * 3600 * 1000 + (freq.cooldownDays ?? 0) * 86400 * 1000;

    if (freq.resetOnMeaningfulChange && freq.changeFingerprintKey) {
      const currentFp = ctx.fingerprint ?? null;
      const last = [...mine].sort((a, b) => toTime(b.sentAt) - toTime(a.sentAt))[0];
      if (last && currentFp != null && last.fingerprint != null && last.fingerprint !== currentFp) {
        return { ok: true, reason: null };
      }
    }

    const recent = mine.some((h) => {
      const t = toTime(h.sentAt);
      return t != null && nowMs - t < windowMs;
    });
    return recent
      ? { ok: false, reason: 'cooldown' }
      : { ok: true, reason: null };
  }

  if (freq.type === 'calendar_month') {
    const ym = zonedYearMonth(now, ctx.timeZone ?? 'Asia/Kolkata');
    const max = freq.maxPerMonth ?? 1;
    const count = mine.filter((h) => {
      const t = toTime(h.sentAt);
      if (t == null) return false;
      return zonedYearMonth(new Date(t), ctx.timeZone ?? 'Asia/Kolkata') === ym;
    }).length;
    return count >= max
      ? { ok: false, reason: 'calendar_month_cap' }
      : { ok: true, reason: null };
  }

  if (freq.type === 'per_scope_cooldown') {
    const scopeValue = ctx.scopeValue ?? null;
    if (!scopeValue) {
      return { ok: false, reason: 'missing_scope' };
    }
    const windowMs =
      (freq.cooldownHours ?? 0) * 3600 * 1000 + (freq.cooldownDays ?? 0) * 86400 * 1000;
    const recent = mine.some((h) => {
      if (String(h.scopeKey) !== String(scopeValue)) return false;
      const t = toTime(h.sentAt);
      return t != null && nowMs - t < windowMs;
    });
    return recent
      ? { ok: false, reason: 'per_scope_cooldown' }
      : { ok: true, reason: null };
  }

  return { ok: true, reason: null };
}
