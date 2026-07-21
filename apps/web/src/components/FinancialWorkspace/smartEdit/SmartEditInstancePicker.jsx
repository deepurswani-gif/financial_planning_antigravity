import React from 'react';
import { X, Plus, ChevronRight } from 'lucide-react';

/**
 * SmartEditInstancePicker — lightweight chooser shown when several instances of
 * a collection exist and Smart Edit must not guess which to open.
 *
 * It does not edit anything itself; selecting an instance hands control back to
 * the existing configure component. Purely presentational + callback-driven.
 */
export default function SmartEditInstancePicker({
  open,
  title = 'Choose one to edit',
  instances = [],
  getLabel,
  getSublabel,
  addLabel = 'Add new',
  onSelect,
  onAdd,
  onClose,
}) {
  if (!open) return null;

  const label = (instance, index) =>
    (getLabel ? getLabel(instance, index) : null) || `Item ${index + 1}`;

  return (
    <div className="smart-edit-picker-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="smart-edit-picker">
        <div className="smart-edit-picker__head">
          <h3 className="smart-edit-picker__title">{title}</h3>
          <button
            type="button"
            className="smart-edit-picker__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <ul className="smart-edit-picker__list">
          {instances.map((instance, index) => (
            <li key={index}>
              <button
                type="button"
                className="smart-edit-picker__item"
                onClick={() => onSelect?.(index, instance)}
              >
                <span className="smart-edit-picker__item-text">
                  <span className="smart-edit-picker__item-label">{label(instance, index)}</span>
                  {getSublabel && getSublabel(instance, index) && (
                    <span className="smart-edit-picker__item-sub">
                      {getSublabel(instance, index)}
                    </span>
                  )}
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        {onAdd && (
          <button type="button" className="smart-edit-picker__add" onClick={onAdd}>
            <Plus size={16} aria-hidden="true" /> {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}
