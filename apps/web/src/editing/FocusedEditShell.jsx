import React from 'react';
import { useEditing } from './EditingProvider';
import { EDIT_STATES } from './editSessionMachine';
import DateInput from '../components/common/DateInput';
import './focusedEdit.css';

/**
 * FocusedEditShell — the clean, single-purpose editing surface.
 *
 * Renders the active Edit Session's field using the registry's `editExperience`
 * and `valueType`, with exactly one Save action and a Cancel. It is fully
 * registry-driven and shared by every entry point. Renders nothing while the
 * session is Idle, so mounting it is inert until a session starts.
 */

const CURRENCY_TYPES = new Set(['number', 'currency', 'percent', 'year']);

function FieldControl({ field, value, onChange, disabled }) {
  const valueType = field?.valueType ?? 'text';

  if (valueType === 'boolean') {
    return (
      <label className="fe-toggle">
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{value ? 'Yes' : 'No'}</span>
      </label>
    );
  }

  if (valueType === 'date') {
    const min = typeof field?.validation?.min === 'string' ? field.validation.min : '';
    const max = typeof field?.validation?.max === 'string' ? field.validation.max : '';
    return (
      <DateInput
        className="fe-input"
        value={value ?? ''}
        disabled={disabled}
        min={min}
        max={max}
        onChange={onChange}
        aria-label={field?.label ?? 'Date'}
      />
    );
  }

  if (CURRENCY_TYPES.has(valueType)) {
    return (
      <div className="fe-number-wrap">
        {valueType === 'currency' ? <span className="fe-affix">₹</span> : null}
        <input
          className="fe-input"
          type="number"
          inputMode="decimal"
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
        {valueType === 'percent' ? <span className="fe-affix fe-affix--suffix">%</span> : null}
      </div>
    );
  }

  // text | tel | enum (no registry option list yet) → free text input.
  return (
    <input
      className="fe-input"
      type={valueType === 'tel' ? 'tel' : 'text'}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function FocusedEditShell() {
  const editing = useEditing();
  const { state, session, field, draft, savePhase, error } = editing;

  if (state === EDIT_STATES.IDLE) return null;

  const busy = state === EDIT_STATES.SAVING || state === EDIT_STATES.RETURNING;
  const isErrorState = state === EDIT_STATES.ERROR;
  const value = field ? draft?.[field.id] : undefined;

  const experienceType = field?.editExperience?.type ?? 'single_value';
  const scalarExperiences = new Set(['single_value', 'question', 'breakdown']);
  const canEditInline = field && field.valueType && scalarExperiences.has(experienceType);

  return (
    <div className="fe-overlay" role="dialog" aria-modal="true" aria-label="Focused edit">
      <div className="fe-panel">
        <header className="fe-header">
          <p className="fe-eyebrow">Edit</p>
          <h2 className="fe-title">{field?.label ?? 'Edit value'}</h2>
          {field?.businessMeaning ? (
            <p className="fe-meaning">{field.businessMeaning}</p>
          ) : null}
        </header>

        <div className="fe-body">
          {state === EDIT_STATES.STARTING ? (
            <p className="fe-status">Preparing…</p>
          ) : canEditInline ? (
            <FieldControl
              field={field}
              value={value}
              disabled={busy}
              onChange={(next) => editing.updateDraft(field.id, next)}
            />
          ) : (
            <div className="fe-fallback">
              <p>
                This field is edited as a <strong>{experienceType}</strong>. A dedicated
                surface for this experience will be wired in a later phase.
              </p>
              <p className="fe-fallback-target">
                Target section: <code>{session?.target?.sectionId ?? '—'}</code>
              </p>
            </div>
          )}

          {isErrorState ? (
            <p className="fe-error" role="alert">
              {error ?? 'Something went wrong.'}
            </p>
          ) : null}

          {busy ? (
            <p className="fe-status" aria-live="polite">
              {savePhase ? `${labelForPhase(savePhase)}…` : 'Saving…'}
            </p>
          ) : null}
        </div>

        <footer className="fe-footer">
          <button
            type="button"
            className="fe-btn fe-btn--ghost"
            onClick={editing.cancel}
            disabled={busy}
          >
            Cancel
          </button>
          {isErrorState ? (
            <button type="button" className="fe-btn fe-btn--primary" onClick={editing.retry}>
              Try again
            </button>
          ) : (
            <button
              type="button"
              className="fe-btn fe-btn--primary"
              onClick={editing.save}
              disabled={busy || state !== EDIT_STATES.EDITING || !canEditInline}
            >
              Save
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function labelForPhase(phase) {
  switch (phase) {
    case 'validate':
      return 'Checking values';
    case 'persist':
      return 'Saving';
    case 'recalculate':
      return 'Updating reports';
    case 'close':
      return 'Wrapping up';
    case 'return':
      return 'Returning to report';
    default:
      return 'Working';
  }
}
