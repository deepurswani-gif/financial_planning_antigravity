import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerReportNavigationHost,
  getDetailReportPath,
} from './reportNavigation';

describe('reportNavigation host adapter', () => {
  beforeEach(() => {
    registerReportNavigationHost(null);
  });

  it('falls back to standalone detail report paths', () => {
    expect(getDetailReportPath('put_your_money_to_work')).toBe(
      '/detailed-report/put_your_money_to_work'
    );
    expect(getDetailReportPath('your_money_flow')).toBe(
      '/detailed-report/your_money_flow'
    );
  });

  it('uses workspace host path when registered', () => {
    const unregister = registerReportNavigationHost({
      getDetailReportPath: (reportId, { section } = {}) =>
        section
          ? `/financial-workspace?mode=full&report=${reportId}&section=${section}`
          : `/financial-workspace?mode=full&report=${reportId}`,
      navigateToDetailReport: () => {},
    });
    expect(getDetailReportPath('your_money_flow')).toBe(
      '/financial-workspace?mode=full&report=your_money_flow'
    );
    expect(getDetailReportPath('your_money_flow', { section: 'life-journey' })).toBe(
      '/financial-workspace?mode=full&report=your_money_flow&section=life-journey'
    );
    unregister();
    expect(getDetailReportPath('your_money_flow')).toBe(
      '/detailed-report/your_money_flow'
    );
    expect(getDetailReportPath('your_money_flow', { section: 'life-journey' })).toBe(
      '/detailed-report/your_money_flow#life-journey'
    );
  });
});
