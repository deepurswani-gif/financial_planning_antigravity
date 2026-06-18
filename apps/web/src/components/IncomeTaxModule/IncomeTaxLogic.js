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
    const cess = (taxAfterRebate + surcharge) * 0.04;
    const finalTax = taxAfterRebate + surcharge + cess;

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
