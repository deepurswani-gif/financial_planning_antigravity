import { describe, it, expect } from 'vitest';
import {
  NOTIFICATION_REGISTRY,
  getNotificationById,
  listNotifications,
  getNotificationRegistryDiagnostics,
  resolveNotification,
  resolveApplicableNotifications,
  selectVariant,
  renderNotification,
  interpolate,
  evaluateNotificationEvent,
  evaluateNotificationFrequency,
  isInQuietHours,
  planDelivery,
  DEFAULT_PUSH_POLICY,
  resolveDeepLink,
  DEEP_LINK_REGISTRY,
  NOTIFICATION_LIFECYCLE,
} from './index';

describe('Notification Registry integrity', () => {
  it('loads Phase 1 notifications with zero schema errors', () => {
    expect(NOTIFICATION_REGISTRY.length).toBe(5);
    const diagnostics = getNotificationRegistryDiagnostics();
    expect(diagnostics.errorCount, JSON.stringify(diagnostics.issues, null, 2)).toBe(0);
    expect(diagnostics.ok).toBe(true);
  });

  it('has unique ids and is frozen', () => {
    const ids = NOTIFICATION_REGISTRY.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.isFrozen(NOTIFICATION_REGISTRY)).toBe(true);
  });

  it('keeps entries declarative — no functions on definitions', () => {
    for (const n of NOTIFICATION_REGISTRY) {
      for (const value of Object.values(n)) {
        expect(typeof value).not.toBe('function');
      }
    }
  });

  it('includes version and analyticsKey on every entry', () => {
    for (const n of NOTIFICATION_REGISTRY) {
      expect(n.version).toBeGreaterThanOrEqual(1);
      expect(n.analyticsKey).toBeTruthy();
      expect(n.variants.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('exposes lookup helpers', () => {
    expect(getNotificationById('coach.wealthMapUpdated')?.priority).toBe(1);
    expect(listNotifications({ tag: 'phase1' }).length).toBe(5);
  });
});

describe('templating + variants', () => {
  it('interpolates mustache and brace tokens', () => {
    expect(interpolate('₹{{amount}} / {amount}', { amount: '12,000' })).toBe(
      '₹12,000 / 12,000',
    );
  });

  it('supports A/B variants without picking logic beyond explicit id', () => {
    const n = getNotificationById('coach.surplusAvailable');
    const b = selectVariant(n, { variantId: 'B' });
    expect(b.title).toMatch(/surplus/i);
    const rendered = renderNotification(n, {
      variantId: 'B',
      placeholders: { amount: '25,000' },
    });
    expect(rendered.body).toContain('25,000');
    expect(rendered.deepLink.path).toContain('put_your_money_to_work');
  });
});

describe('deep links', () => {
  it('never resolves to a bare marketing home path', () => {
    for (const d of DEEP_LINK_REGISTRY) {
      const resolved = resolveDeepLink(d.id);
      expect(resolved.path.startsWith('/financial-workspace')).toBe(true);
      expect(resolved.path.includes('mode=')).toBe(true);
    }
  });
});

describe('trigger evaluators', () => {
  it('fires wealth map only after successful recalculation', () => {
    expect(
      evaluateNotificationEvent('WEALTHMAP_RECALCULATED', {
        wealthMapRecalculated: true,
        recalculationSucceeded: true,
      }),
    ).toBe(true);
    expect(
      evaluateNotificationEvent('WEALTHMAP_RECALCULATED', {
        wealthMapRecalculated: true,
        recalculationSucceeded: false,
      }),
    ).toBe(false);
  });

  it('requires positive investable surplus', () => {
    expect(
      evaluateNotificationEvent('SURPLUS_INVESTABLE', {
        hasInvestableSurplus: true,
        monthlySurplusAmount: 5000,
      }),
    ).toBe(true);
    expect(
      evaluateNotificationEvent('SURPLUS_INVESTABLE', {
        hasInvestableSurplus: true,
        monthlySurplusAmount: 0,
      }),
    ).toBe(false);
  });
});

describe('frequency + policy', () => {
  it('enforces 24h cooldown for WealthMap Updated', () => {
    const n = getNotificationById('coach.wealthMapUpdated');
    const now = new Date('2026-08-04T12:00:00+05:30');
    const blocked = evaluateNotificationFrequency(
      n,
      [{ notificationId: n.id, sentAt: '2026-08-04T01:00:00+05:30' }],
      { now },
    );
    expect(blocked.ok).toBe(false);

    const allowed = evaluateNotificationFrequency(
      n,
      [{ notificationId: n.id, sentAt: '2026-08-02T12:00:00+05:30' }],
      { now },
    );
    expect(allowed.ok).toBe(true);
  });

  it('allows protection gap again when fingerprint changes', () => {
    const n = getNotificationById('coach.protectionGapAttention');
    const now = new Date('2026-08-04T12:00:00+05:30');
    const same = evaluateNotificationFrequency(
      n,
      [
        {
          notificationId: n.id,
          sentAt: '2026-08-01T12:00:00+05:30',
          fingerprint: 'gap:100',
        },
      ],
      { now, fingerprint: 'gap:100' },
    );
    expect(same.ok).toBe(false);

    const changed = evaluateNotificationFrequency(
      n,
      [
        {
          notificationId: n.id,
          sentAt: '2026-08-01T12:00:00+05:30',
          fingerprint: 'gap:100',
        },
      ],
      { now, fingerprint: 'gap:250' },
    );
    expect(changed.ok).toBe(true);
  });

  it('queues during IST quiet hours', () => {
    // 11:30 PM IST
    const late = new Date('2026-08-04T23:30:00+05:30');
    expect(isInQuietHours(late, DEFAULT_PUSH_POLICY)).toBe(true);
    const plan = planDelivery([], late, DEFAULT_PUSH_POLICY);
    expect(plan.action).toBe('queue');
    expect(plan.reason).toBe('quiet_hours');
  });

  it('rate-limits to 2/day', () => {
    const now = new Date('2026-08-04T15:00:00+05:30');
    const history = [
      { sentAt: '2026-08-04T10:00:00+05:30' },
      { sentAt: '2026-08-04T12:00:00+05:30' },
    ];
    const plan = planDelivery(history, now, DEFAULT_PUSH_POLICY);
    expect(plan.action).toBe('defer');
    expect(plan.reason).toBe('rate_limit_day');
  });
});

describe('resolveNotificationDelivery', () => {
  it('builds push payload for applicable WealthMap Updated', () => {
    const result = resolveNotification(
      'coach.wealthMapUpdated',
      { wealthMapRecalculated: true, recalculationSucceeded: true },
      {
        optedIn: true,
        now: new Date('2026-08-04T15:00:00+05:30'),
        history: [],
        globalSendHistory: [],
      },
    );
    expect(result.applicable).toBe(true);
    expect(result.push.title).toMatch(/WealthMap/i);
    expect(result.push.data.url).toContain('/financial-workspace');
    expect(result.delivery.action).toBe('send_now');
  });

  it('lists applicable notifications sorted by priority', () => {
    const rows = resolveApplicableNotifications(
      {
        wealthMapRecalculated: true,
        recalculationSucceeded: true,
        hasProtectionGap: true,
        hasInvestableSurplus: true,
        monthlySurplusAmount: 10000,
        amount: '10,000',
      },
      {
        optedIn: true,
        now: new Date('2026-08-04T15:00:00+05:30'),
        history: [],
        globalSendHistory: [],
      },
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0].notification.priority).toBeLessThanOrEqual(rows[1].notification.priority);
  });
});

describe('analytics lifecycle vocab', () => {
  it('exposes generated/sent/delivered/opened/deep_link_opened', () => {
    expect(NOTIFICATION_LIFECYCLE.GENERATED).toBe('notification_generated');
    expect(NOTIFICATION_LIFECYCLE.DEEP_LINK_OPENED).toBe('notification_deep_link_opened');
  });
});
