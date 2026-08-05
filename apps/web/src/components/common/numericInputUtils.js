/**
 * Shared helpers for NumericInput and presets.
 * Empty / incomplete input → null (blank ≠ zero).
 */

export function normalizePastedNumeric(raw) {
    if (raw == null) return '';
    return String(raw)
        .replace(/₹/g, '')
        .replace(/,/g, '')
        .replace(/\s+/g, '')
        .replace(/[^\d.-]/g, '');
}

/**
 * Keep a typing-friendly numeric string.
 * Allows intermediate values like "12." and "0.5".
 */
export function sanitizeNumericString(raw, { allowDecimal = true, allowNegative = false } = {}) {
    let s = normalizePastedNumeric(raw);

    if (!allowNegative) {
        s = s.replace(/-/g, '');
    } else {
        const neg = s.startsWith('-');
        s = s.replace(/-/g, '');
        if (neg) s = `-${s}`;
    }

    if (!allowDecimal) {
        // Truncate at decimal — "12.5" → "12" (not "125")
        const neg = s.startsWith('-');
        const body = (neg ? s.slice(1) : s).split('.')[0] ?? '';
        return neg ? `-${body}` : body;
    }

    const neg = s.startsWith('-');
    const body = neg ? s.slice(1) : s;
    const firstDot = body.indexOf('.');
    if (firstDot === -1) {
        return neg ? `-${body}` : body;
    }
    const intPart = body.slice(0, firstDot);
    const fracPart = body.slice(firstDot + 1).replace(/\./g, '');
    const joined = `${intPart}.${fracPart}`;
    return neg ? `-${joined}` : joined;
}

/**
 * Convert display string → number | null.
 * Accepts formatted strings ("1,25,000", "₹12,500") and intermediates ("12.").
 * "" / "." / "-" → null
 */
export function displayToNumber(display) {
    if (display == null) return null;
    const s = normalizePastedNumeric(display).trim();
    if (s === '' || s === '.' || s === '-' || s === '-.') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

export function clampNumber(n, min, max) {
    if (n == null || !Number.isFinite(n)) return null;
    let v = n;
    if (min != null && Number.isFinite(min) && v < min) v = min;
    if (max != null && Number.isFinite(max) && v > max) v = max;
    return v;
}

export function formatIntegerInr(n) {
    if (n == null || !Number.isFinite(n)) return '';
    return new Intl.NumberFormat('en-IN').format(Math.trunc(n));
}

/** Value coming from parent may be number | string | null | undefined | '' */
export function coerceExternalValue(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    const n = displayToNumber(sanitizeNumericString(String(value), { allowDecimal: true }));
    return n;
}

export function numberToDisplayString(n, { allowDecimal = true } = {}) {
    if (n == null || !Number.isFinite(n)) return '';
    if (!allowDecimal) return String(Math.trunc(n));
    return String(n);
}
