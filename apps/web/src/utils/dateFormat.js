/**
 * Canonical storage format: YYYY-MM-DD
 * Display / typing format: DD-MM-YYYY
 */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_RE = /^(\d{2})-(\d{2})-(\d{4})$/;

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(month, year) {
  if (month < 1 || month > 12) return 0;
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1];
}

/**
 * @returns {boolean}
 */
export function isValidDateParts(day, month, year) {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (year < 1000 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(month, year)) return false;
  return true;
}

/**
 * @param {string} iso YYYY-MM-DD
 * @returns {{ day: number, month: number, year: number } | null}
 */
export function parseISODate(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const m = ISO_RE.exec(iso.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!isValidDateParts(day, month, year)) return null;
  return { day, month, year };
}

/**
 * @param {string} display DD-MM-YYYY (or partially typed)
 * @returns {{ day: number, month: number, year: number } | null}
 */
export function parseDisplayDate(display) {
  if (!display || typeof display !== 'string') return null;
  const m = DISPLAY_RE.exec(display.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!isValidDateParts(day, month, year)) return null;
  return { day, month, year };
}

export function toISODate(day, month, year) {
  if (!isValidDateParts(day, month, year)) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function toDisplayDate(day, month, year) {
  if (!isValidDateParts(day, month, year)) return '';
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${String(year).padStart(4, '0')}`;
}

/** YYYY-MM-DD → DD-MM-YYYY */
export function isoToDisplay(iso) {
  const parts = parseISODate(iso);
  if (!parts) return '';
  return toDisplayDate(parts.day, parts.month, parts.year);
}

/** DD-MM-YYYY → YYYY-MM-DD */
export function displayToIso(display) {
  const parts = parseDisplayDate(display);
  if (!parts) return '';
  return toISODate(parts.day, parts.month, parts.year);
}

/** Insert hyphens while typing; digits only; max 8 digits. */
export function maskDateInput(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

/**
 * Pad day/month on blur when the user typed a complete-enough value.
 * Returns normalized DD-MM-YYYY or '' if empty/incomplete.
 */
export function normalizeDisplayDate(display) {
  if (!display || !String(display).trim()) return '';
  const digits = String(display).replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length < 8) return null; // incomplete — caller should treat as invalid if non-empty
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (!isValidDateParts(day, month, year)) return null;
  return toDisplayDate(day, month, year);
}

/**
 * Validate a display string. Empty is valid unless required (handled by caller).
 * @returns {{ valid: boolean, error: string | null, iso: string, display: string }}
 */
export function validateDisplayDate(display, { required = false, min = '', max = '' } = {}) {
  const trimmed = (display ?? '').trim();
  if (!trimmed) {
    if (required) {
      return { valid: false, error: 'Date is required', iso: '', display: '' };
    }
    return { valid: true, error: null, iso: '', display: '' };
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8) {
    return { valid: false, error: 'Enter a complete date as DD-MM-YYYY', iso: '', display: trimmed };
  }

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));

  if (month < 1 || month > 12) {
    return { valid: false, error: 'Month must be between 01 and 12', iso: '', display: trimmed };
  }
  if (day < 1 || day > 31) {
    return { valid: false, error: 'Day must be between 01 and 31', iso: '', display: trimmed };
  }
  if (year < 1000 || year > 9999) {
    return { valid: false, error: 'Enter a valid year', iso: '', display: trimmed };
  }
  if (!isValidDateParts(day, month, year)) {
    return { valid: false, error: 'This date does not exist', iso: '', display: trimmed };
  }

  const iso = toISODate(day, month, year);
  const normalized = toDisplayDate(day, month, year);

  if (min && iso < min) {
    return { valid: false, error: `Date must be on or after ${isoToDisplay(min)}`, iso: '', display: normalized };
  }
  if (max && iso > max) {
    return { valid: false, error: `Date must be on or before ${isoToDisplay(max)}`, iso: '', display: normalized };
  }

  return { valid: true, error: null, iso, display: normalized };
}

/** Validate a canonical ISO date string (for registry / smart-edit). */
export function validateISODate(iso, { required = false, min = '', max = '' } = {}) {
  if (iso == null || iso === '') {
    if (required) return { valid: false, error: 'Date is required', iso: '' };
    return { valid: true, error: null, iso: '' };
  }
  const parts = parseISODate(iso);
  if (!parts) {
    return { valid: false, error: 'Enter a valid date', iso: '' };
  }
  const normalized = toISODate(parts.day, parts.month, parts.year);
  if (min && normalized < min) {
    return { valid: false, error: `Date must be on or after ${isoToDisplay(min)}`, iso: '' };
  }
  if (max && normalized > max) {
    return { valid: false, error: `Date must be on or before ${isoToDisplay(max)}`, iso: '' };
  }
  return { valid: true, error: null, iso: normalized };
}

/** Today's date as YYYY-MM-DD in local timezone. */
export function todayISO() {
  const now = new Date();
  return toISODate(now.getDate(), now.getMonth() + 1, now.getFullYear());
}

/** Clamp ISO date into [min, max] when those bounds are provided. */
export function clampISODate(iso, min = '', max = '') {
  if (!iso) return iso;
  let next = iso;
  if (min && next < min) next = min;
  if (max && next > max) next = max;
  return next;
}
