import { describe, it, expect, beforeEach, vi } from 'vitest';

function installMemoryLocalStorage() {
  const map = new Map();
  const memory = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      map.set(String(k), String(v));
    },
    removeItem: (k) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
  vi.stubGlobal('localStorage', memory);
  return memory;
}

describe('localDeliveryHistory', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it('records and reads send history per user', async () => {
    const {
      getNotificationSendHistory,
      recordNotificationSent,
    } = await import('./localDeliveryHistory');

    recordNotificationSent('user-1', {
      notificationId: 'coach.wealthMapUpdated',
      sentAt: '2026-08-04T10:00:00.000Z',
    });
    const history = getNotificationSendHistory('user-1');
    expect(history).toHaveLength(1);
    expect(history[0].notificationId).toBe('coach.wealthMapUpdated');
    expect(getNotificationSendHistory('user-2')).toHaveLength(0);
  });

  it('queues and lists due pending items', async () => {
    const {
      enqueuePendingNotification,
      listDuePendingNotifications,
      removePendingNotification,
    } = await import('./localDeliveryHistory');

    enqueuePendingNotification('user-1', {
      notificationId: 'coach.wealthMapUpdated',
      deliverAt: '2026-08-01T01:00:00.000Z',
      push: { title: 't', body: 'b', data: {} },
      rendered: { notificationId: 'coach.wealthMapUpdated' },
    });
    const due = listDuePendingNotifications('user-1', new Date('2026-08-04T12:00:00.000Z'));
    expect(due).toHaveLength(1);
    removePendingNotification('user-1', 'coach.wealthMapUpdated');
    expect(listDuePendingNotifications('user-1', new Date('2026-08-04T12:00:00.000Z'))).toHaveLength(
      0,
    );
  });
});

describe('dispatch gating', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    vi.resetModules();
  });

  it('wealthMapUpdated respects opt-in', async () => {
    const { dispatchWealthMapUpdated } = await import('./dispatchNotification');
    const result = await dispatchWealthMapUpdated({ userId: 'user-1' });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_opted_in');
  });

  it('protection / surplus / goals / monthly respect opt-in', async () => {
    const {
      dispatchProtectionGapAttention,
      dispatchSurplusAvailable,
      dispatchGoalFallingBehind,
      dispatchMonthlyWealthSummary,
    } = await import('./dispatchNotification');

    const plan = {
      familyMembers: [{ relation: 'Self', name: 'Alex', dob: '1990-01-01' }],
      expenseCategories: {},
      income: {},
      goals: [],
      summaryReportGeneratedAt: new Date().toISOString(),
    };

    expect((await dispatchProtectionGapAttention(plan, { userId: 'u1' })).reason).toBe(
      'not_opted_in',
    );
    expect((await dispatchSurplusAvailable(plan, { userId: 'u1' })).reason).toBe('not_opted_in');
    expect((await dispatchGoalFallingBehind(plan, { userId: 'u1' })).reason).toBe('not_opted_in');
    expect((await dispatchMonthlyWealthSummary(plan, { userId: 'u1' })).reason).toBe(
      'not_opted_in',
    );
  });
});

describe('buildCoachSignals', () => {
  it('builds protection fingerprint and surplus amount fields', async () => {
    const {
      buildProtectionGapSignals,
      buildSurplusAvailableSignals,
      buildMonthlyWealthSummarySignals,
    } = await import('./buildCoachSignals');

    const plan = {
      familyMembers: [{ relation: 'Self', name: 'Alex', age: 35 }],
      expenseCategories: {
        household: { rent: 20000 },
      },
      summaryLifeCover: 0,
      policies: [],
      income: { self: { monthly: 100000 } },
      hasSpouseIncome: false,
      summaryReportGeneratedAt: '2026-08-01T00:00:00.000Z',
    };

    const protection = buildProtectionGapSignals(plan);
    expect(protection).toHaveProperty('hasProtectionGap');
    expect(protection.protectionGapFingerprint).toMatch(/^gap:/);

    const surplus = buildSurplusAvailableSignals(plan);
    expect(surplus).toHaveProperty('hasInvestableSurplus');
    expect(surplus).toHaveProperty('monthlySurplusAmount');

    const monthly = buildMonthlyWealthSummarySignals(plan);
    expect(monthly.monthlyWealthSummaryReady).toBe(true);
  });
});
