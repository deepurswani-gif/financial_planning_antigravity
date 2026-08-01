import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  clampISODate,
  daysInMonth,
  displayToIso,
  isoToDisplay,
  maskDateInput,
  normalizeDisplayDate,
  parseISODate,
  todayISO,
  toISODate,
  validateDisplayDate,
} from '../../utils/dateFormat';
import './DateInput.css';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function buildCalendarCells(year, month) {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const total = daysInMonth(month, year);
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= total; d += 1) cells.push(d);
  return cells;
}

/**
 * Reusable Finbrella date field.
 *
 * - Displays / accepts DD-MM-YYYY
 * - Stores via onChange as canonical YYYY-MM-DD (or '')
 * - Optional calendar popup; typing remains primary
 */
const DateInput = ({
  value = '',
  onChange,
  onBlur,
  label,
  placeholder = 'DD-MM-YYYY',
  required = false,
  disabled = false,
  readOnly = false,
  min = '',
  max = '',
  name,
  id,
  className = '',
  error: externalError = '',
  clampOnBlur = false,
  showCalendarButton = true,
  style,
  'aria-label': ariaLabel,
  ...rest
}) => {
  const autoId = useId();
  const inputId = id || autoId;
  const errorId = `${inputId}-error`;
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [display, setDisplay] = useState(() => isoToDisplay(value));
  const [localError, setLocalError] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const selected = parseISODate(value);
  const initialView = selected || parseISODate(todayISO());
  const [viewYear, setViewYear] = useState(initialView?.year ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(initialView?.month ?? new Date().getMonth() + 1);

  useEffect(() => {
    setDisplay(isoToDisplay(value));
    if (value) setLocalError('');
  }, [value]);

  useEffect(() => {
    if (!calendarOpen) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setCalendarOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setCalendarOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [calendarOpen]);

  const emitChange = useCallback(
    (iso) => {
      if (!onChange) return;
      onChange(iso);
    },
    [onChange],
  );

  const applyIso = useCallback(
    (iso) => {
      let next = iso || '';
      if (next && (min || max) && clampOnBlur) {
        next = clampISODate(next, min, max);
      }
      if (next) {
        setDisplay(isoToDisplay(next));
        setLocalError('');
        emitChange(next);
        return;
      }
      setLocalError(required ? 'Date is required' : '');
      emitChange('');
    },
    [clampOnBlur, emitChange, max, min, required],
  );

  const handleChange = (event) => {
    if (disabled || readOnly) return;
    const masked = maskDateInput(event.target.value);
    setDisplay(masked);
    setCalendarOpen(false);

    if (!masked) {
      setLocalError(required ? 'Date is required' : '');
      emitChange('');
      return;
    }

    const digits = masked.replace(/\D/g, '');
    if (digits.length < 8) {
      setLocalError('');
      // Don't push incomplete values upstream — keep last valid or clear only when empty
      return;
    }

    const result = validateDisplayDate(masked, {
      required,
      min: clampOnBlur ? '' : min,
      max: clampOnBlur ? '' : max,
    });
    if (!result.valid) {
      setLocalError(result.error || 'Invalid date');
      return;
    }
    setLocalError('');
    let iso = result.iso;
    if (clampOnBlur && (min || max)) {
      iso = clampISODate(iso, min, max);
      setDisplay(isoToDisplay(iso));
    }
    emitChange(iso);
  };

  const handleBlur = (event) => {
    setCalendarOpen(false);

    if (!display.trim()) {
      setLocalError(required ? 'Date is required' : '');
      if (value) emitChange('');
      onBlur?.(event);
      return;
    }

    const normalized = normalizeDisplayDate(display);
    if (normalized == null) {
      const result = validateDisplayDate(display, { required, min, max });
      setLocalError(result.error || 'Enter a complete date as DD-MM-YYYY');
      onBlur?.(event);
      return;
    }

    let iso = displayToIso(normalized);
    if (clampOnBlur && (min || max)) {
      iso = clampISODate(iso, min, max);
    } else {
      const result = validateDisplayDate(normalized, { required, min, max });
      if (!result.valid) {
        setDisplay(normalized);
        setLocalError(result.error || 'Invalid date');
        onBlur?.(event);
        return;
      }
      iso = result.iso;
    }

    setDisplay(isoToDisplay(iso));
    setLocalError('');
    if (iso !== value) emitChange(iso);
    onBlur?.(event);
  };

  const openCalendar = () => {
    if (disabled || readOnly) return;
    const parts = parseISODate(value) || parseISODate(todayISO());
    if (parts) {
      setViewYear(parts.year);
      setViewMonth(parts.month);
    }
    setCalendarOpen((open) => !open);
    inputRef.current?.focus();
  };

  const selectDay = (day) => {
    const iso = toISODate(day, viewMonth, viewYear);
    if (!iso) return;
    if (min && iso < min && !clampOnBlur) return;
    if (max && iso > max && !clampOnBlur) return;
    let next = iso;
    if (clampOnBlur && (min || max)) {
      next = clampISODate(iso, min, max);
    }
    applyIso(next);
    setCalendarOpen(false);
    inputRef.current?.focus();
  };

  const shiftMonth = (delta) => {
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setViewMonth(nextMonth);
    setViewYear(nextYear);
  };

  const showError = Boolean(externalError || localError);
  const errorMessage = externalError || localError;
  const cells = buildCalendarCells(viewYear, viewMonth);
  const today = todayISO();

  return (
    <div className={`date-input ${showError ? 'date-input--error' : ''}`} ref={rootRef} style={style}>
      {label ? (
        <label className="date-input__label" htmlFor={inputId}>
          {label}
          {required ? <span className="date-input__required" aria-hidden="true"> *</span> : null}
        </label>
      ) : null}

      <div className="date-input__control">
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          className={`date-input__field ${!showCalendarButton || readOnly ? 'date-input__field--no-icon' : ''} ${className}`.trim()}
          value={display}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          aria-label={ariaLabel || (label ? undefined : placeholder)}
          {...rest}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={() => setCalendarOpen(false)}
        />

        {showCalendarButton && !readOnly ? (
          <button
            type="button"
            className="date-input__calendar-btn"
            tabIndex={-1}
            disabled={disabled}
            aria-label="Open calendar"
            aria-expanded={calendarOpen}
            aria-haspopup="dialog"
            onMouseDown={(e) => {
              // Prevent input blur before click toggles calendar
              e.preventDefault();
            }}
            onClick={openCalendar}
          >
            <CalendarIcon size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : null}

        {calendarOpen ? (
          <div className="date-input__popup" role="dialog" aria-label="Choose date">
            <div className="date-input__popup-header">
              <button type="button" className="date-input__nav" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
                <ChevronLeft size={16} />
              </button>
              <span className="date-input__popup-title">
                {MONTH_LABELS[viewMonth - 1]} {viewYear}
              </span>
              <button type="button" className="date-input__nav" aria-label="Next month" onClick={() => shiftMonth(1)}>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="date-input__weekdays">
              {WEEKDAYS.map((d) => (
                <span key={d} className="date-input__weekday">{d}</span>
              ))}
            </div>
            <div className="date-input__grid">
              {cells.map((day, index) => {
                if (day == null) {
                  return <span key={`e-${index}`} className="date-input__day date-input__day--empty" />;
                }
                const iso = toISODate(day, viewMonth, viewYear);
                const isSelected = value === iso;
                const isToday = today === iso;
                const outOfRange = (min && iso < min) || (max && iso > max);
                return (
                  <button
                    key={iso}
                    type="button"
                    className={[
                      'date-input__day',
                      isSelected ? 'date-input__day--selected' : '',
                      isToday ? 'date-input__day--today' : '',
                      outOfRange ? 'date-input__day--disabled' : '',
                    ].filter(Boolean).join(' ')}
                    disabled={outOfRange && !clampOnBlur}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectDay(day)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {showError ? (
        <p className="date-input__error" id={errorId} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
};

export default DateInput;
