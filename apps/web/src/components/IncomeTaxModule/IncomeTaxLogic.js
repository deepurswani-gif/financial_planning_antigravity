/**
 * Income Tax Calculation Logic (FY 2025-26 New Regime)
 */

import {
    buildTaxInput,
    createEmptyIncomeDetail,
    isPensionerEmployment,
    isSalariedEmployment,
} from '../DetailedFlow/incomeDetailSync';

export const REBATE_87A_MAX = 60000;
export const REBATE_87A_INCOME_LIMIT = 1200000;
export const SURCHARGE_THRESHOLDS = [5000000, 10000000, 20000000];

export const SLAB_DEFINITIONS = [
    {
        key: 't1',
        min: 0,
        max: 400000,
        rate: 0,
        rangeLabel: 'Up to ₹4 lakh',
        plainExplanation: 'The first ₹4 lakh of taxable income is tax-free under the new regime.',
    },
    {
        key: 't2',
        min: 400000,
        max: 800000,
        rate: 0.05,
        rangeLabel: '₹4 lakh – ₹8 lakh',
        plainExplanation: 'Income in this band is taxed at 5%.',
    },
    {
        key: 't3',
        min: 800000,
        max: 1200000,
        rate: 0.10,
        rangeLabel: '₹8 lakh – ₹12 lakh',
        plainExplanation: 'Income in this band is taxed at 10%.',
    },
    {
        key: 't4',
        min: 1200000,
        max: 1600000,
        rate: 0.15,
        rangeLabel: '₹12 lakh – ₹16 lakh',
        plainExplanation: 'Income in this band is taxed at 15%.',
    },
    {
        key: 't5',
        min: 1600000,
        max: 2000000,
        rate: 0.20,
        rangeLabel: '₹16 lakh – ₹20 lakh',
        plainExplanation: 'Income in this band is taxed at 20%.',
    },
    {
        key: 't6',
        min: 2000000,
        max: 2400000,
        rate: 0.25,
        rangeLabel: '₹20 lakh – ₹24 lakh',
        plainExplanation: 'Income in this band is taxed at 25%.',
    },
    {
        key: 't7',
        min: 2400000,
        max: Infinity,
        rate: 0.30,
        rangeLabel: 'Above ₹24 lakh',
        plainExplanation: 'Income above ₹24 lakh is taxed at 30%.',
    },
];

export const TAX_BREAKDOWN_COPY = {
    progressiveTax:
        'India taxes income in slices. Only the income above each limit is taxed at the higher rate—not your entire salary.',
    rebate87A:
        'If taxable income is up to ₹12 lakh, the government reduces your tax by up to ₹60,000—often bringing it to zero.',
    marginalRelief:
        'When income is slightly above ₹12 lakh, tax cannot exceed the extra income above ₹12 lakh. This avoids a sudden tax spike.',
    surcharge:
        'An extra charge on high incomes: 10%, 15%, or 25% of tax depending on your income level (above ₹50 lakh).',
    surchargeMarginalRelief:
        'When income is just above a surcharge threshold, this relief caps the extra tax so it does not exceed the income above that threshold.',
    cess: '4% Health & Education Cess is added on tax (after rebate and surcharge) to fund public health and education programs.',
    standardDeduction:
        'A fixed amount subtracted from salary or pension before tax is calculated (₹75,000 for salaried employees and pensioners).',
    zeroTaxRebate:
        'Your taxable income qualifies for the Section 87A rebate, so your slab tax is fully offset and you pay no income tax.',
    zeroTaxNoIncome: 'No taxable income was calculated from your inputs, so no tax is due.',
};

function getIncomeInSlab(taxableIncome, min, max) {
    if (taxableIncome <= min) return 0;
    const capped = max === Infinity ? taxableIncome : Math.min(taxableIncome, max);
    return capped - min;
}

function formatBreakdownAmount(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(Math.round(amount));
}

function buildSlabFormula(incomeInSlab, rate, taxAmount) {
    if (incomeInSlab <= 0) return '';
    if (rate === 0) return `${formatBreakdownAmount(incomeInSlab)} × 0% = ${formatBreakdownAmount(taxAmount)}`;
    const ratePct = `${Math.round(rate * 100)}%`;
    return `${formatBreakdownAmount(incomeInSlab)} × ${ratePct} = ${formatBreakdownAmount(taxAmount)}`;
}

export function buildTaxBreakdownPresentation(results) {
    if (!results) {
        return {
            slabBreakdown: [],
            calculationSteps: [],
            adjustments: [],
            insights: {
                effectiveTaxRate: 0,
                marginalRate: 0,
                monthlyTax: 0,
                summaryNote: '',
            },
        };
    }

    const { taxableIncome = 0, slabs = {}, grossTotalIncome = 0, finalTax = 0 } = results;
    const incomeLabel = getIncomeLabelForEmployment(results.employmentType);

    const slabBreakdown = SLAB_DEFINITIONS.map((def) => {
        const incomeInSlab = getIncomeInSlab(taxableIncome, def.min, def.max);
        const taxAmount = slabs[def.key] || 0;
        return {
            ...def,
            incomeInSlab,
            taxAmount,
            formulaText: buildSlabFormula(incomeInSlab, def.rate, taxAmount),
        };
    }).filter((row) => row.incomeInSlab > 0 || row.taxAmount > 0);

    let marginalRate = 0;
    for (let i = slabBreakdown.length - 1; i >= 0; i -= 1) {
        if (slabBreakdown[i].incomeInSlab > 0 && slabBreakdown[i].rate > 0) {
            marginalRate = slabBreakdown[i].rate;
            break;
        }
    }

    const effectiveTaxRate = grossTotalIncome > 0 ? finalTax / grossTotalIncome : 0;
    const monthlyTax = finalTax / 12;

    const calculationSteps = [];

    if (results.annualSalary > 0) {
        calculationSteps.push({
            title: incomeLabel,
            amount: results.annualSalary,
            note: 'Your main annual income from salary, pension, or business.',
        });
    }

    if (results.otherIncomeAnnual > 0) {
        calculationSteps.push({
            title: 'Other income',
            amount: results.otherIncomeAnnual,
            note: 'Additional annual income such as rent, interest, or freelance earnings.',
        });
    }

    if (results.standardDeduction > 0) {
        calculationSteps.push({
            title: 'Standard deduction',
            amount: -results.standardDeduction,
            note: TAX_BREAKDOWN_COPY.standardDeduction,
        });
    }

    if (taxableIncome > 0 || grossTotalIncome > 0) {
        calculationSteps.push({
            title: 'Taxable income',
            amount: taxableIncome,
            note: 'The amount on which income tax slabs are applied.',
            isSubtotal: true,
        });
    }

    if (taxableIncome > 0) {
        calculationSteps.push({
            title: 'Tax from income slabs',
            amount: results.totalTaxBeforeRebate,
            note: 'Tax calculated step-by-step across each income band below.',
        });
    }

    if (results.rebate87A > 0) {
        calculationSteps.push({
            title: 'Section 87A rebate',
            amount: -results.rebate87A,
            note: TAX_BREAKDOWN_COPY.rebate87A,
            isSaving: true,
        });
    }

    if (results.marginalRelief > 0) {
        calculationSteps.push({
            title: 'Marginal relief',
            amount: -results.marginalRelief,
            note: TAX_BREAKDOWN_COPY.marginalRelief,
            isSaving: true,
        });
    }

    if (results.rebate87A > 0 || results.marginalRelief > 0) {
        calculationSteps.push({
            title: 'Tax after rebate / relief',
            amount: results.taxAfterRebate,
            note: 'Tax remaining after government rebate or marginal relief.',
            isSubtotal: true,
        });
    }

    if (results.surcharge > 0) {
        calculationSteps.push({
            title: 'Surcharge',
            amount: results.surcharge,
            note: TAX_BREAKDOWN_COPY.surcharge,
        });
    }

    if (results.surchargeMarginalRelief > 0) {
        calculationSteps.push({
            title: 'Marginal relief on surcharge',
            amount: -results.surchargeMarginalRelief,
            note: TAX_BREAKDOWN_COPY.surchargeMarginalRelief,
            isSaving: true,
        });
    }

    if (results.cess > 0) {
        calculationSteps.push({
            title: 'Health & Education Cess (4%)',
            amount: results.cess,
            note: TAX_BREAKDOWN_COPY.cess,
        });
    }

    calculationSteps.push({
        title: 'Final tax payable',
        amount: finalTax,
        note: 'Your estimated annual income tax for FY 2025-26 (new regime).',
        isTotal: true,
    });

    const adjustments = [];

    if (results.rebate87A > 0) {
        adjustments.push({
            title: 'Section 87A rebate',
            amount: -results.rebate87A,
            note: TAX_BREAKDOWN_COPY.rebate87A,
        });
    }
    if (results.marginalRelief > 0) {
        adjustments.push({
            title: 'Marginal relief (above ₹12 lakh)',
            amount: -results.marginalRelief,
            note: TAX_BREAKDOWN_COPY.marginalRelief,
        });
    }
    if (results.surcharge > 0) {
        adjustments.push({
            title: 'Surcharge',
            amount: results.surcharge,
            note: TAX_BREAKDOWN_COPY.surcharge,
        });
    }
    if (results.surchargeMarginalRelief > 0) {
        adjustments.push({
            title: 'Marginal relief on surcharge',
            amount: -results.surchargeMarginalRelief,
            note: TAX_BREAKDOWN_COPY.surchargeMarginalRelief,
        });
    }
    if (results.cess > 0) {
        adjustments.push({
            title: 'Health & Education Cess (4%)',
            amount: results.cess,
            note: TAX_BREAKDOWN_COPY.cess,
        });
    }

    let summaryNote = '';
    if (taxableIncome <= 0 && grossTotalIncome <= 0) {
        summaryNote = TAX_BREAKDOWN_COPY.zeroTaxNoIncome;
    } else if (finalTax === 0 && results.rebate87A > 0) {
        summaryNote = TAX_BREAKDOWN_COPY.zeroTaxRebate;
    } else if (finalTax === 0) {
        summaryNote = 'Based on your inputs, no income tax is payable under the new regime.';
    } else if (results.marginalRelief > 0) {
        summaryNote = 'Marginal relief limited your tax because your income is just above ₹12 lakh.';
    } else if (effectiveTaxRate < 0.05) {
        summaryNote = `You pay about ${(effectiveTaxRate * 100).toFixed(1)}% of your total income as tax—your effective rate is low because of slab-based taxation and rebates.`;
    }

    return {
        slabBreakdown,
        calculationSteps,
        adjustments,
        insights: {
            effectiveTaxRate,
            marginalRate,
            monthlyTax,
            summaryNote,
        },
    };
}

export function calculateSlabTax(taxableIncome) {
    let taxBase = taxableIncome;
    let t1 = 0;
    let t2 = 0;
    let t3 = 0;
    let t4 = 0;
    let t5 = 0;
    let t6 = 0;
    let t7 = 0;

    if (taxBase > 2400000) {
        t7 = (taxBase - 2400000) * 0.30;
        taxBase = 2400000;
    }
    if (taxBase > 2000000) {
        t6 = (taxBase - 2000000) * 0.25;
        taxBase = 2000000;
    }
    if (taxBase > 1600000) {
        t5 = (taxBase - 1600000) * 0.20;
        taxBase = 1600000;
    }
    if (taxBase > 1200000) {
        t4 = (taxBase - 1200000) * 0.15;
        taxBase = 1200000;
    }
    if (taxBase > 800000) {
        t3 = (taxBase - 800000) * 0.10;
        taxBase = 800000;
    }
    if (taxBase > 400000) {
        t2 = (taxBase - 400000) * 0.05;
        taxBase = 400000;
    }

    const totalTax = t1 + t2 + t3 + t4 + t5 + t6 + t7;
    return {
        totalTax,
        slabs: { t1, t2, t3, t4, t5, t6, t7 },
    };
}

export function applyRebateAndMarginalRelief(normalTax, taxableIncome) {
    if (taxableIncome <= REBATE_87A_INCOME_LIMIT) {
        const rebate87A = Math.min(normalTax, REBATE_87A_MAX);
        return {
            rebate87A,
            marginalRelief: 0,
            taxAfterRebate: Math.max(0, normalTax - rebate87A),
        };
    }

    const excessIncome = taxableIncome - REBATE_87A_INCOME_LIMIT;
    if (normalTax > excessIncome) {
        return {
            rebate87A: 0,
            marginalRelief: normalTax - excessIncome,
            taxAfterRebate: excessIncome,
        };
    }

    return {
        rebate87A: 0,
        marginalRelief: 0,
        taxAfterRebate: normalTax,
    };
}

export function calculateSurcharge(taxAfterRebate, taxableIncome) {
    if (taxableIncome <= 5000000) return 0;
    if (taxableIncome <= 10000000) return taxAfterRebate * 0.10;
    if (taxableIncome <= 20000000) return taxAfterRebate * 0.15;
    return taxAfterRebate * 0.25;
}

export function getSurchargeThreshold(taxableIncome) {
    if (taxableIncome <= SURCHARGE_THRESHOLDS[0]) return null;
    if (taxableIncome <= SURCHARGE_THRESHOLDS[1]) return SURCHARGE_THRESHOLDS[0];
    if (taxableIncome <= SURCHARGE_THRESHOLDS[2]) return SURCHARGE_THRESHOLDS[1];
    return SURCHARGE_THRESHOLDS[2];
}

export function computeTaxPlusSurchargeBeforeCess(taxableIncome) {
    const { totalTax } = calculateSlabTax(taxableIncome);
    const { taxAfterRebate } = applyRebateAndMarginalRelief(totalTax, taxableIncome);
    const surcharge = calculateSurcharge(taxAfterRebate, taxableIncome);
    return taxAfterRebate + surcharge;
}

export function applySurchargeMarginalRelief(taxAfterRebate, taxableIncome, nominalSurcharge) {
    const threshold = getSurchargeThreshold(taxableIncome);
    if (!threshold) {
        return { surchargeMarginalRelief: 0 };
    }

    const taxAtActual = taxAfterRebate + nominalSurcharge;
    const taxAtThreshold = computeTaxPlusSurchargeBeforeCess(threshold);
    const excessIncome = taxableIncome - threshold;
    const additionalTax = taxAtActual - taxAtThreshold;

    const surchargeMarginalRelief = additionalTax > excessIncome
        ? additionalTax - excessIncome
        : 0;

    return { surchargeMarginalRelief };
}

export function calculateIncomeTaxFromInput(taxInput) {
    if (!taxInput || taxInput.taxableIncome <= 0) {
        return {
            grossTotalIncome: taxInput?.grossTotalIncome || 0,
            annualSalary: taxInput?.annualSalary || 0,
            otherIncomeAnnual: taxInput?.otherIncomeAnnual || 0,
            standardDeduction: taxInput?.standardDeduction || 0,
            taxableIncome: 0,
            totalTaxBeforeRebate: 0,
            rebate87A: 0,
            marginalRelief: 0,
            taxAfterRebate: 0,
            surcharge: 0,
            surchargeMarginalRelief: 0,
            cess: 0,
            finalTax: 0,
            slabs: { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0, t6: 0, t7: 0 },
            usedTaxSlip: taxInput?.usedTaxSlip || false,
            employmentType: taxInput?.employmentType || '',
        };
    }

    const { totalTax, slabs } = calculateSlabTax(taxInput.taxableIncome);
    const { rebate87A, marginalRelief, taxAfterRebate } = applyRebateAndMarginalRelief(
        totalTax,
        taxInput.taxableIncome,
    );
    const surcharge = calculateSurcharge(taxAfterRebate, taxInput.taxableIncome);
    const { surchargeMarginalRelief } = applySurchargeMarginalRelief(
        taxAfterRebate,
        taxInput.taxableIncome,
        surcharge,
    );
    const taxPlusSurcharge = taxAfterRebate + surcharge - surchargeMarginalRelief;
    const cess = taxPlusSurcharge * 0.04;
    const finalTax = taxPlusSurcharge + cess;

    return {
        grossTotalIncome: taxInput.grossTotalIncome,
        annualSalary: taxInput.annualSalary,
        otherIncomeAnnual: taxInput.otherIncomeAnnual,
        standardDeduction: taxInput.standardDeduction,
        taxableIncome: taxInput.taxableIncome,
        totalTaxBeforeRebate: totalTax,
        rebate87A,
        marginalRelief,
        taxAfterRebate,
        surcharge,
        surchargeMarginalRelief,
        cess,
        finalTax,
        slabs,
        usedTaxSlip: taxInput.usedTaxSlip,
        employmentType: taxInput.employmentType,
    };
}

export function calculateIncomeTaxFromDetail(detail, employmentType) {
    const taxInput = buildTaxInput(detail, employmentType);
    return calculateIncomeTaxFromInput(taxInput);
}

/** Legacy entry point for cash-flow / projection callers using flat monthly keys. */
export function calculateIncomeTax(monthlyIncomeObj, occupation) {
    const isSalaried = occupation?.toLowerCase() === 'salaried';
    const employmentType = isSalaried ? 'Private Sector' : 'Business Owner';
    const detail = {
        ...createEmptyIncomeDetail(),
        inHandSalary: isSalaried ? monthlyIncomeObj.salary : '',
        takeHomeProfit: isSalaried ? '' : monthlyIncomeObj.salary,
        passiveIncome: monthlyIncomeObj.passive || '',
        otherIncome: [{ amount: monthlyIncomeObj.other || '' }],
        needTaxPlanning: false,
    };
    return calculateIncomeTaxFromDetail(detail, employmentType);
}

export const PENSIONER_STANDARD_DEDUCTION_NOTE =
    'We assume your pension is from a former employer (Central/State Government, PSU, or private sector), taxed under Salaries, and eligible for the ₹75,000 standard deduction.';

export const IN_HAND_SALARY_ESTIMATE_NOTE =
    'Estimated from in-hand salary only. Enable tax planning in Income Details and fill your salary slip for a gross-based calculation.';

export function showPensionerTaxNote(employmentType) {
    return isPensionerEmployment(employmentType);
}

export function showInHandSalaryEstimateNote(detail, employmentType) {
    return isSalariedEmployment(employmentType) && detail?.needTaxPlanning !== true;
}

export function getIncomeLabelForEmployment(employmentType) {
    if (isSalariedEmployment(employmentType)) return 'Annual Salary';
    if (isPensionerEmployment(employmentType)) return 'Annual Pension';
    return 'Gross Annual Income';
}
