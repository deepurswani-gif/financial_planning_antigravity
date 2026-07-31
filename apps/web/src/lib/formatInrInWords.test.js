import { describe, expect, it } from 'vitest';
import { formatInrInWords } from './formatInrInWords';

describe('formatInrInWords', () => {
    it('returns empty for blank or invalid values', () => {
        expect(formatInrInWords('')).toBe('');
        expect(formatInrInWords(null)).toBe('');
        expect(formatInrInWords(undefined)).toBe('');
        expect(formatInrInWords('abc')).toBe('');
        expect(formatInrInWords(-5)).toBe('');
    });

    it('handles zero', () => {
        expect(formatInrInWords(0)).toBe('Zero');
        expect(formatInrInWords('0')).toBe('Zero');
    });

    it('converts small amounts', () => {
        expect(formatInrInWords(7)).toBe('Seven');
        expect(formatInrInWords(15)).toBe('Fifteen');
        expect(formatInrInWords(42)).toBe('Forty Two');
        expect(formatInrInWords(100)).toBe('One Hundred');
        expect(formatInrInWords(105)).toBe('One Hundred Five');
    });

    it('uses Indian scale without plurals', () => {
        expect(formatInrInWords(1000)).toBe('One Thousand');
        expect(formatInrInWords(200000)).toBe('Two Lakh');
        expect(formatInrInWords(250000)).toBe('Two Lakh Fifty Thousand');
        expect(formatInrInWords(10000000)).toBe('One Crore');
        expect(formatInrInWords(12500000)).toBe('One Crore Twenty Five Lakh');
        expect(formatInrInWords(101000)).toBe('One Lakh One Thousand');
    });

    it('rounds fractional input', () => {
        expect(formatInrInWords(1999.6)).toBe('Two Thousand');
    });
});
