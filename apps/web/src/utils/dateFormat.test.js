import { describe, expect, it } from 'vitest';
import {
  clampISODate,
  daysInMonth,
  displayToIso,
  isoToDisplay,
  isValidDateParts,
  maskDateInput,
  normalizeDisplayDate,
  parseISODate,
  validateDisplayDate,
  validateISODate,
} from './dateFormat';

describe('dateFormat', () => {
  it('masks digits into DD-MM-YYYY while typing', () => {
    expect(maskDateInput('25082000')).toBe('25-08-2000');
    expect(maskDateInput('25')).toBe('25');
    expect(maskDateInput('2508')).toBe('25-08');
    expect(maskDateInput('25a08b2000')).toBe('25-08-2000');
    expect(maskDateInput('250820001234')).toBe('25-08-2000');
  });

  it('converts between ISO and display formats', () => {
    expect(isoToDisplay('2000-08-25')).toBe('25-08-2000');
    expect(displayToIso('25-08-2000')).toBe('2000-08-25');
    expect(isoToDisplay('')).toBe('');
    expect(displayToIso('31-02-2026')).toBe('');
  });

  it('rejects impossible calendar dates', () => {
    expect(isValidDateParts(31, 2, 2026)).toBe(false);
    expect(isValidDateParts(29, 2, 2025)).toBe(false);
    expect(isValidDateParts(29, 2, 2024)).toBe(true);
    expect(isValidDateParts(31, 4, 2026)).toBe(false);
    expect(isValidDateParts(31, 1, 2026)).toBe(true);
    expect(daysInMonth(2, 2024)).toBe(29);
    expect(daysInMonth(2, 2025)).toBe(28);
  });

  it('normalizes complete display dates on blur', () => {
    expect(normalizeDisplayDate('25-08-2000')).toBe('25-08-2000');
    expect(normalizeDisplayDate('25082000')).toBe('25-08-2000');
    expect(normalizeDisplayDate('')).toBe('');
    expect(normalizeDisplayDate('25-08')).toBe(null);
    expect(normalizeDisplayDate('31-02-2026')).toBe(null);
  });

  it('validates display dates with helpful errors', () => {
    expect(validateDisplayDate('31-02-2026').valid).toBe(false);
    expect(validateDisplayDate('29-02-2025').error).toMatch(/does not exist/i);
    expect(validateDisplayDate('13-13-2020').error).toMatch(/Month/i);
    expect(validateDisplayDate('25-08-2000').iso).toBe('2000-08-25');
    expect(validateDisplayDate('', { required: true }).valid).toBe(false);
  });

  it('enforces min/max on ISO and display validation', () => {
    expect(validateISODate('2026-07-02', { max: '2026-07-01' }).valid).toBe(false);
    expect(validateDisplayDate('02-07-2026', { max: '2026-07-01' }).valid).toBe(false);
    expect(clampISODate('2026-07-02', '', '2026-07-01')).toBe('2026-07-01');
    expect(parseISODate('1990-05-20')).toEqual({ day: 20, month: 5, year: 1990 });
  });
});
