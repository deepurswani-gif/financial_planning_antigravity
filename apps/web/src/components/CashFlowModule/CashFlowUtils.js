export const convertToMonthly = (value, frequency) => {
    const val = parseFloat(value) || 0;
    switch (frequency) {
        case 'Annual':
        case 'Annually': return val / 12;
        case 'Half Yearly':
        case 'Half-Yearly': return val / 6;
        case 'Quarterly': return val / 3;
        case 'Monthly': return val;
        default: return val;
    }
};

export const convertToAnnual = (value, frequency) => {
    const val = parseFloat(value) || 0;
    switch (frequency) {
        case 'Annual':
        case 'Annually': return val;
        case 'Half Yearly':
        case 'Half-Yearly': return val * 2;
        case 'Quarterly': return val * 4;
        case 'Monthly': return val * 12;
        default: return val;
    }
};
