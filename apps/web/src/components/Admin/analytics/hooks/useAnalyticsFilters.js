import { useCallback, useEffect, useMemo, useState } from 'react';
import { emptyFilters } from '../registry/filters';
import {
  deleteFilterPreset,
  fetchFilterOptions,
  listFilterPresets,
  saveFilterPreset,
} from '../services/analyticsApi';

export function useAnalyticsFilters() {
  const [filters, setFilters] = useState(() => emptyFilters());
  const [options, setOptions] = useState({ advisors: [] });
  const [presets, setPresets] = useState([]);
  const [optionsError, setOptionsError] = useState(null);

  const refreshMeta = useCallback(async () => {
    try {
      const [opts, saved] = await Promise.all([fetchFilterOptions(), listFilterPresets()]);
      setOptions(opts || { advisors: [] });
      setPresets(saved || []);
      setOptionsError(null);
    } catch (err) {
      setOptionsError(err.message);
    }
  }, []);

  useEffect(() => {
    void refreshMeta();
  }, [refreshMeta]);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateHyper = useCallback((hyper) => {
    setFilters((prev) => ({ ...prev, hyper }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(emptyFilters());
  }, []);

  const applyPreset = useCallback((preset) => {
    if (!preset?.filter_tree) return;
    setFilters({ ...emptyFilters(), ...preset.filter_tree });
  }, []);

  const saveCurrentPreset = useCallback(
    async (name, description) => {
      const saved = await saveFilterPreset({
        name,
        description,
        filterTree: filters,
      });
      setPresets((prev) => [saved, ...prev]);
      return saved;
    },
    [filters],
  );

  const removePreset = useCallback(async (id) => {
    await deleteFilterPreset(id);
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const advisorOptions = useMemo(
    () => [
      { value: '', label: 'All advisors' },
      ...(options.advisors || []).map((a) => ({
        value: a.id,
        label: a.name || a.email,
      })),
    ],
    [options.advisors],
  );

  return {
    filters,
    setFilters,
    updateFilter,
    updateHyper,
    resetFilters,
    options,
    advisorOptions,
    presets,
    applyPreset,
    saveCurrentPreset,
    removePreset,
    optionsError,
    refreshMeta,
  };
}
