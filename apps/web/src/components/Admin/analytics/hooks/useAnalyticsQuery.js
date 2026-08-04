import { useCallback, useEffect, useState } from 'react';
import {
  fetchActiveUsersAnalytics,
  fetchAdvisorAnalytics,
  fetchAnalyticsDrilldown,
  fetchEventDrilldown,
  fetchEventsAnalytics,
  fetchExecutiveAnalytics,
  fetchUpcomingMaturities,
} from '../services/analyticsApi';

export function useExecutiveAnalytics(filters) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, active] = await Promise.all([
        fetchExecutiveAnalytics(filters),
        fetchActiveUsersAnalytics(filters),
      ]);
      setData({
        ...result,
        kpis: {
          ...(result?.kpis || {}),
          activeUsersAvailable: Boolean(active?.activeUsersAvailable),
          activeUsers: active?.activeUsers ?? null,
          dau: active?.dau ?? null,
          wau: active?.wau ?? null,
          mau: active?.mau ?? null,
          tau: active?.tau ?? null,
        },
      });
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export function useEventAnalytics(filters, moduleId = 'engagement') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchEventsAnalytics(filters, moduleId);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters, moduleId]);

  return { data, loading, error };
}

export function useAdvisorAnalytics(filters) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchAdvisorAnalytics(filters);
        if (!cancelled) setData(rows);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  return { data, loading, error };
}

export function useUpcomingMaturities(filters) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchUpcomingMaturities(filters);
        if (!cancelled) setData(rows);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  return { data, loading, error };
}

export function useDrilldown(metricId, filters, open) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const pageSize = 50;

  const load = useCallback(
    async (nextOffset = 0) => {
      if (!open || !metricId) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAnalyticsDrilldown(metricId, filters, pageSize, nextOffset);
        setData(result);
        setOffset(nextOffset);
      } catch (err) {
        setError(err.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [open, metricId, filters],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  return {
    data,
    loading,
    error,
    offset,
    pageSize,
    reload: load,
    nextPage: () => load(offset + pageSize),
    prevPage: () => load(Math.max(0, offset - pageSize)),
  };
}

export function useEventDrilldown(eventFilter, filters, open) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const pageSize = 50;
  const filterKey = JSON.stringify(eventFilter || {});

  const load = useCallback(
    async (nextOffset = 0) => {
      if (!open || !eventFilter) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchEventDrilldown(eventFilter, filters, pageSize, nextOffset);
        setData(result);
        setOffset(nextOffset);
      } catch (err) {
        setError(err.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, filterKey, filters],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  return {
    data,
    loading,
    error,
    offset,
    pageSize,
    reload: load,
    nextPage: () => load(offset + pageSize),
    prevPage: () => load(Math.max(0, offset - pageSize)),
  };
}
