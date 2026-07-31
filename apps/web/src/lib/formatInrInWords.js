/**
 * Convert a rupee amount to Indian-scale words (no plurals).
 * Examples: 200000 → "Two Lakh", 250000 → "Two Lakh Fifty Thousand"
 */

const ONES = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

/** Convert 0–99 to words. */
function twoDigits(n) {
    if (n < 20) return ONES[n];
    const ten = Math.floor(n / 10);
    const one = n % 10;
    return one ? `${TENS[ten]} ${ONES[one]}` : TENS[ten];
}

/** Convert 0–999 to words. */
function threeDigits(n) {
    if (n === 0) return '';
    if (n < 100) return twoDigits(n);
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    const head = `${ONES[hundred]} Hundred`;
    return rest ? `${head} ${twoDigits(rest)}` : head;
}

/**
 * @param {string|number|null|undefined} amount
 * @returns {string} Indian amount in words, or '' if invalid/empty
 */
export function formatInrInWords(amount) {
    if (amount === '' || amount == null) return '';
    const n = Math.round(Number(amount));
    if (!Number.isFinite(n) || n < 0) return '';
    if (n === 0) return 'Zero';

    const parts = [];
    let remaining = n;

    const crore = Math.floor(remaining / 10000000);
    if (crore > 0) {
        parts.push(`${threeDigits(crore)} Crore`);
        remaining %= 10000000;
    }

    const lakh = Math.floor(remaining / 100000);
    if (lakh > 0) {
        parts.push(`${twoDigits(lakh)} Lakh`);
        remaining %= 100000;
    }

    const thousand = Math.floor(remaining / 1000);
    if (thousand > 0) {
        parts.push(`${twoDigits(thousand)} Thousand`);
        remaining %= 1000;
    }

    if (remaining > 0) {
        parts.push(threeDigits(remaining));
    }

    return parts.join(' ').trim();
}
