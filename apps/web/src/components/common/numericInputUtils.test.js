import { describe, expect, it } from 'vitest';
import {
    clampNumber,
    coerceExternalValue,
    displayToNumber,
    formatIntegerInr,
    normalizePastedNumeric,
    sanitizeNumericString,
} from './numericInputUtils';

describe('normalizePastedNumeric', () => {
    it('strips rupee, commas, and spaces', () => {
        expect(normalizePastedNumeric('₹1,25,000')).toBe('125000');
        expect(normalizePastedNumeric('1 25 000')).toBe('125000');
        expect(normalizePastedNumeric('1,250,000')).toBe('1250000');
    });
});

describe('sanitizeNumericString', () => {
    it('allows intermediate decimal strings', () => {
        expect(sanitizeNumericString('12.', { allowDecimal: true })).toBe('12.');
        expect(sanitizeNumericString('12.5', { allowDecimal: true })).toBe('12.5');
        expect(sanitizeNumericString('12.5.6', { allowDecimal: true })).toBe('12.56');
    });

    it('truncates decimals when not allowed', () => {
        expect(sanitizeNumericString('12.5', { allowDecimal: false })).toBe('12');
    });
});

describe('displayToNumber', () => {
    it('maps empty and incomplete to null', () => {
        expect(displayToNumber('')).toBeNull();
        expect(displayToNumber('.')).toBeNull();
        expect(displayToNumber('-')).toBeNull();
    });

    it('parses trailing-dot intermediates', () => {
        expect(displayToNumber('12.')).toBe(12);
        expect(displayToNumber('12.5')).toBe(12.5);
    });

    it('parses Indian-formatted currency strings (blur must not wipe)', () => {
        expect(displayToNumber('1,25,000')).toBe(125000);
        expect(displayToNumber('₹12,50,000')).toBe(1250000);
        expect(displayToNumber('0')).toBe(0);
    });
});

describe('clampNumber', () => {
    it('clamps only when numeric', () => {
        expect(clampNumber(null, 0, 100)).toBeNull();
        expect(clampNumber(150, 0, 100)).toBe(100);
        expect(clampNumber(-5, 0, 100)).toBe(0);
    });
});

describe('formatIntegerInr', () => {
    it('formats Indian grouping', () => {
        expect(formatIntegerInr(1250000)).toBe('12,50,000');
        expect(formatIntegerInr(null)).toBe('');
    });
});

describe('coerceExternalValue', () => {
    it('accepts number, digit string, and empty', () => {
        expect(coerceExternalValue(0)).toBe(0);
        expect(coerceExternalValue('50000')).toBe(50000);
        expect(coerceExternalValue('')).toBeNull();
        expect(coerceExternalValue(null)).toBeNull();
    });
});
