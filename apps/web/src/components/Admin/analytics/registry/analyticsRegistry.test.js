import { describe, expect, it } from 'vitest';
import { emptyFilters, serializeFilters } from './filters';
import { ANALYTICS_MODULES, DEFAULT_ANALYTICS_MODULE, isModuleAvailable } from './modules';
import { getKpisForModule } from './kpis';

describe('analytics registry', () => {
  it('defaults to executive module', () => {
    expect(DEFAULT_ANALYTICS_MODULE).toBe('executive');
    expect(ANALYTICS_MODULES[0].id).toBe('executive');
  });

  it('unlocks engagement/product/ai in phase 2; notifications stays phase 3', () => {
    const engagement = ANALYTICS_MODULES.find((m) => m.id === 'engagement');
    const notifications = ANALYTICS_MODULES.find((m) => m.id === 'notifications');
    expect(engagement).toBeTruthy();
    expect(isModuleAvailable(engagement, 1)).toBe(false);
    expect(isModuleAvailable(engagement, 2)).toBe(true);
    expect(isModuleAvailable(notifications, 2)).toBe(false);
    expect(isModuleAvailable(notifications, 3)).toBe(true);
  });

  it('exposes executive KPIs for cards', () => {
    const kpis = getKpisForModule('executive');
    expect(kpis.some((k) => k.kpiKey === 'totalUsers')).toBe(true);
    expect(kpis.some((k) => k.kpiKey === 'avgWellnessScore')).toBe(true);
  });

  it('serializes hyper filters and drops empties', () => {
    const filters = {
      ...emptyFilters(),
      dateFrom: '2026-01-01T00:00:00.000Z',
      advisorId: '',
      hyper: {
        op: 'OR',
        conditions: [
          { field: 'wealthmap_status', op: 'eq', value: 'completed' },
          { field: '', op: 'eq', value: 'x' },
        ],
      },
    };
    const payload = serializeFilters(filters);
    expect(payload.dateFrom).toBeTruthy();
    expect(payload.advisorId).toBeUndefined();
    expect(payload.hyper.op).toBe('OR');
    expect(payload.hyper.conditions).toHaveLength(1);
  });
});
