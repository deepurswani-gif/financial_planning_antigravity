import { useState } from 'react';
import { Filter, Save, Trash2 } from 'lucide-react';
import {
  FUTURE_FILTERS,
  HYPER_FIELD_OPTIONS,
  HYPER_OPERATORS,
  PHASE1_FILTERS,
} from '../registry/filters';
import CurrencyInput from '../../../common/CurrencyInput';
import IntegerInput from '../../../common/IntegerInput';

const CURRENCY_RANGE_IDS = new Set([
  'investmentRange',
  'sipRange',
  'insuranceRange',
  'netWorthRange',
]);

export default function AnalyticsFilterBar({
  filters,
  updateFilter,
  updateHyper,
  resetFilters,
  advisorOptions,
  presets,
  applyPreset,
  saveCurrentPreset,
  removePreset,
}) {
  const [showHyper, setShowHyper] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [saving, setSaving] = useState(false);

  const hyper = filters.hyper || { op: 'AND', conditions: [] };

  const setCondition = (index, patch) => {
    const conditions = [...(hyper.conditions || [])];
    conditions[index] = { ...conditions[index], ...patch };
    updateHyper({ ...hyper, conditions });
  };

  const addCondition = () => {
    updateHyper({
      ...hyper,
      conditions: [...(hyper.conditions || []), { field: 'wealthmap_status', op: 'eq', value: '' }],
    });
  };

  const removeCondition = (index) => {
    updateHyper({
      ...hyper,
      conditions: (hyper.conditions || []).filter((_, i) => i !== index),
    });
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    setSaving(true);
    try {
      await saveCurrentPreset(presetName.trim());
      setPresetName('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ba-filters">
      <div className="ba-filters__header">
        <Filter size={16} />
        <strong>Filters</strong>
        <button type="button" className="ba-link-btn" onClick={resetFilters}>
          Reset
        </button>
        <button type="button" className="ba-link-btn" onClick={() => setShowHyper((v) => !v)}>
          {showHyper ? 'Hide hyper filters' : 'Hyper filters'}
        </button>
      </div>

      <div className="ba-filters__grid">
        <label>
          Date from
          <input
            type="date"
            value={filters.dateFrom?.slice?.(0, 10) || filters.dateFrom || ''}
            onChange={(e) => updateFilter('dateFrom', e.target.value ? `${e.target.value}T00:00:00.000Z` : '')}
          />
        </label>
        <label>
          Date to
          <input
            type="date"
            value={filters.dateTo?.slice?.(0, 10) || filters.dateTo || ''}
            onChange={(e) => updateFilter('dateTo', e.target.value ? `${e.target.value}T23:59:59.999Z` : '')}
          />
        </label>
        <label>
          Advisor
          <select value={filters.advisorId || ''} onChange={(e) => updateFilter('advisorId', e.target.value)}>
            {advisorOptions.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {PHASE1_FILTERS.filter((f) => f.type === 'select' && f.id !== 'advisorId').map((field) => (
          <label key={field.id}>
            {field.label}
            <select
              value={filters[field.id] || ''}
              onChange={(e) => updateFilter(field.id, e.target.value)}
            >
              {(field.options || []).map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        {PHASE1_FILTERS.filter((f) => f.type === 'range').map((field) => {
          const isCurrency = CURRENCY_RANGE_IDS.has(field.id);
          const InputComp = isCurrency ? CurrencyInput : IntegerInput;
          const toFilter = (v) => (v == null ? '' : String(v));
          return (
            <label key={field.id} className="ba-filters__range">
              {field.label}
              <div>
                <InputComp
                  placeholder="Min"
                  value={filters[field.keys[0]] || ''}
                  onValueChange={(v) => updateFilter(field.keys[0], toFilter(v))}
                />
                <InputComp
                  placeholder="Max"
                  value={filters[field.keys[1]] || ''}
                  onValueChange={(v) => updateFilter(field.keys[1], toFilter(v))}
                />
              </div>
            </label>
          );
        })}
      </div>

      {showHyper && (
        <div className="ba-hyper">
          <div className="ba-hyper__row">
            <span>Match</span>
            <select
              value={hyper.op || 'AND'}
              onChange={(e) => updateHyper({ ...hyper, op: e.target.value })}
            >
              <option value="AND">ALL conditions (AND)</option>
              <option value="OR">ANY condition (OR)</option>
            </select>
            <button type="button" className="ba-secondary-btn" onClick={addCondition}>
              Add condition
            </button>
          </div>
          {(hyper.conditions || []).map((cond, index) => (
            <div key={index} className="ba-hyper__row">
              <select value={cond.field || ''} onChange={(e) => setCondition(index, { field: e.target.value })}>
                {HYPER_FIELD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select value={cond.op || 'eq'} onChange={(e) => setCondition(index, { op: e.target.value })}>
                {HYPER_OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                value={cond.value || ''}
                placeholder="Value"
                disabled={cond.op === 'is_null' || cond.op === 'not_null'}
                onChange={(e) => setCondition(index, { value: e.target.value })}
              />
              <button type="button" className="ba-icon-btn" onClick={() => removeCondition(index)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="ba-presets">
        <div className="ba-presets__save">
          <input
            placeholder="Save filter preset name"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <button type="button" className="ba-secondary-btn" disabled={saving || !presetName.trim()} onClick={handleSavePreset}>
            <Save size={14} /> Save preset
          </button>
        </div>
        {presets.length > 0 && (
          <div className="ba-presets__list">
            {presets.map((p) => (
              <div key={p.id} className="ba-presets__item">
                <button type="button" className="ba-link-btn" onClick={() => applyPreset(p)}>
                  {p.name}
                </button>
                <button type="button" className="ba-icon-btn" onClick={() => removePreset(p.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="ba-filters__future">
        Coming later: {FUTURE_FILTERS.map((f) => f.label).join(', ')}
      </p>
    </div>
  );
}
