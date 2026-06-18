import { reconcileAmounts } from './detailReconcile';

export const createEmptyTaxPlanning = () => ({
    earnings: {
        basicPay: '',
        dearnessAllowance: '',
        houseRentAllowance: '',
        allowances: '',
        leaveEncashment: '',
        bonus: '',
        performanceBonus: '',
        other: { name: '', amount: '' },
    },
    deductions: {
        employeePF: '',
        employeeNPS: '',
        groupInsurance: '',
        healthScheme: '',
        groupPersonalAccident: '',
        groupMedicalCoverage: '',
        other: { name: '', amount: '' },
    },
});

export const createEmptyIncomeDetail = () => ({
    grossSalary: '',
    inHandSalary: '',
    takeHomeProfit: '',
    netPension: '',
    passiveIncome: '',
    otherIncome: [{ name: '', amount: '' }],
    needTaxPlanning: null,
    taxPlanning: createEmptyTaxPlanning(),
});

export const isSalariedEmployment = (employmentType) => (
    employmentType === 'Government Sector' || employmentType === 'Private Sector'
);

export const isBusinessEmployment = (employmentType) => (
    employmentType === 'Business Owner' || employmentType === 'Professional'
);

export const isPensionerEmployment = (employmentType) => employmentType === 'Pensioner';

export const isGovernmentSector = (employmentType) => employmentType === 'Government Sector';

const sumOtherIncome = (otherIncome = []) => (
    otherIncome.reduce((sum, item) => sum + (parseFloat(item?.amount) || 0), 0)
);

/** Map detailed capture to legacy flat keys for CashFlowLogic / ProjectionLogic. */
export function syncLegacyFromDetail(detail, employmentType) {
    const d = { ...createEmptyIncomeDetail(), ...detail };
    const otherTotal = sumOtherIncome(d.otherIncome);

    if (isSalariedEmployment(employmentType)) {
        return {
            primary: d.inHandSalary || '',
            bonus: '',
            passive: '',
            other: otherTotal ? String(otherTotal) : '',
        };
    }
    if (isBusinessEmployment(employmentType)) {
        return {
            primary: d.takeHomeProfit || '',
            bonus: '',
            passive: d.passiveIncome || '',
            other: otherTotal ? String(otherTotal) : '',
        };
    }
    if (isPensionerEmployment(employmentType)) {
        return {
            primary: d.netPension || '',
            bonus: '',
            passive: '',
            other: otherTotal ? String(otherTotal) : '',
        };
    }
    return {
        primary: d.inHandSalary || d.takeHomeProfit || d.netPension || '',
        bonus: '',
        passive: d.passiveIncome || '',
        other: otherTotal ? String(otherTotal) : '',
    };
}

/** Total monthly in-hand from detailed fields (primary + bonus + passive + other). */
export function getMemberDetailMonthlyTotal(detail, employmentType) {
    const legacy = syncLegacyFromDetail(detail, employmentType);
    return (parseFloat(legacy.primary) || 0)
        + (parseFloat(legacy.bonus) || 0)
        + (parseFloat(legacy.passive) || 0)
        + (parseFloat(legacy.other) || 0);
}

export function hasIncomeDetailEntered(detail, employmentType) {
    const d = { ...createEmptyIncomeDetail(), ...detail };
    if (parseFloat(d.grossSalary) > 0) return true;
    if (isSalariedEmployment(employmentType) && parseFloat(d.inHandSalary) > 0) return true;
    if (isBusinessEmployment(employmentType) && (parseFloat(d.takeHomeProfit) > 0 || parseFloat(d.passiveIncome) > 0)) return true;
    if (isPensionerEmployment(employmentType) && parseFloat(d.netPension) > 0) return true;
    return sumOtherIncome(d.otherIncome) > 0;
}

export function reconcileMemberIncome(summaryAmount, detail, employmentType) {
    const summaryTotal = parseFloat(summaryAmount) || 0;
    if (!hasIncomeDetailEntered(detail, employmentType)) {
        return reconcileAmounts(summaryTotal, 0);
    }
    return reconcileAmounts(summaryTotal, getMemberDetailMonthlyTotal(detail, employmentType));
}

/** Summary total anchor for display + reconciliation — not overwritten by detail edits. */
export function getSummaryIncomeTarget(income = {}, memberKey = 'self') {
    if (memberKey === 'self') {
        return income.summarySelfInHand ?? income.self ?? '';
    }
    return income.summarySpouseInHand ?? income.spouse ?? '';
}

/** @deprecated Use getSummaryIncomeTarget */
export function getSummaryInHandDisplay(income = {}, memberKey = 'self') {
    return getSummaryIncomeTarget(income, memberKey);
}

/** True when detail has passive, bonus, or other income beyond the primary field. */
export function hasIncomeBreakdown(detail, employmentType) {
    const legacy = syncLegacyFromDetail(detail, employmentType);
    return (parseFloat(legacy.passive) || 0) > 0
        || (parseFloat(legacy.other) || 0) > 0
        || (parseFloat(legacy.bonus) || 0) > 0;
}

/** Update detail primary field when summary total changes and no breakdown exists yet. */
export function syncSummaryAmountToDetailPrimary(detail, amount, employmentType) {
    const next = { ...createEmptyIncomeDetail(), ...detail };
    if (isSalariedEmployment(employmentType)) {
        next.inHandSalary = amount;
    } else if (isBusinessEmployment(employmentType)) {
        next.takeHomeProfit = amount;
    } else if (isPensionerEmployment(employmentType)) {
        next.netPension = amount;
    } else {
        next.inHandSalary = amount;
    }
    return next;
}

/** Preserve summary total anchors separately from detail-synced flat keys. */
export function initializeIncomeSnapshots(income = {}) {
    const loaded = income || {};
    let summarySelfInHand = loaded.summarySelfInHand ?? '';
    let summarySpouseInHand = loaded.summarySpouseInHand ?? '';

    if (!summarySelfInHand && loaded.self) {
        summarySelfInHand = String(parseFloat(loaded.self) || '');
    }
    if (!summarySpouseInHand && loaded.spouse) {
        summarySpouseInHand = String(parseFloat(loaded.spouse) || '');
    }

    return {
        ...loaded,
        summarySelfInHand,
        summarySpouseInHand,
    };
}

/** Pre-fill detail from summary in-hand amount when detail fields are empty. */
export function prefillDetailFromSummaryAmount(detail, summaryAmount, employmentType) {
    const next = { ...createEmptyIncomeDetail(), ...detail };
    const amount = summaryAmount || '';
    if (!amount) return next;

    if (isSalariedEmployment(employmentType) && !next.inHandSalary) {
        next.inHandSalary = amount;
    } else if (isBusinessEmployment(employmentType)) {
        if (!next.takeHomeProfit) next.takeHomeProfit = amount;
    } else if (isPensionerEmployment(employmentType) && !next.netPension) {
        next.netPension = amount;
    } else if (!next.inHandSalary && !next.takeHomeProfit && !next.netPension) {
        next.inHandSalary = amount;
    }
    return next;
}

export function normalizeIncomeState(income = {}) {
    const loaded = initializeIncomeSnapshots(income || {});
    return {
        self: loaded.self ?? loaded.family ?? '',
        selfBonus: loaded.selfBonus ?? loaded.bonus ?? '',
        selfPassive: loaded.selfPassive ?? loaded.passive ?? '',
        selfOther: loaded.selfOther ?? loaded.other ?? '',
        spouse: loaded.spouse ?? '',
        spouseBonus: loaded.spouseBonus ?? '',
        spousePassive: loaded.spousePassive ?? '',
        spouseOther: loaded.spouseOther ?? '',
        summarySelfInHand: loaded.summarySelfInHand ?? '',
        summarySpouseInHand: loaded.summarySpouseInHand ?? '',
        selfDetail: { ...createEmptyIncomeDetail(), ...(loaded.selfDetail || {}) },
        spouseDetail: { ...createEmptyIncomeDetail(), ...(loaded.spouseDetail || {}) },
    };
}

export function applyDetailSyncToIncome(income, selfEmploymentType, spouseEmploymentType) {
    const selfLegacy = syncLegacyFromDetail(income.selfDetail, selfEmploymentType);
    const spouseLegacy = spouseEmploymentType
        ? syncLegacyFromDetail(income.spouseDetail, spouseEmploymentType)
        : { primary: '', bonus: '', passive: '', other: '' };

    return {
        ...income,
        self: selfLegacy.primary,
        selfBonus: selfLegacy.bonus,
        selfPassive: selfLegacy.passive,
        selfOther: selfLegacy.other,
        spouse: spouseLegacy.primary,
        spouseBonus: spouseLegacy.bonus,
        spousePassive: spouseLegacy.passive,
        spouseOther: spouseLegacy.other,
    };
}

const parseAmount = (value) => parseFloat(value) || 0;

/** Main-screen other income is monthly; annualize for tax. */
export function sumOtherIncomeAnnual(otherIncome = []) {
    return otherIncome.reduce((sum, item) => sum + parseAmount(item?.amount) * 12, 0);
}

const TAX_SLIP_MONTHLY_KEYS = ['basicPay', 'dearnessAllowance', 'houseRentAllowance', 'allowances'];

export function hasTaxSlipEarnings(detail) {
    const earnings = detail?.taxPlanning?.earnings || {};
    if (TAX_SLIP_MONTHLY_KEYS.some((key) => parseAmount(earnings[key]) > 0)) return true;
    if (parseAmount(earnings.other?.amount) > 0) return true;
    if (parseAmount(earnings.performanceBonus) > 0) return true;
    if (parseAmount(earnings.bonus) > 0) return true;
    return parseAmount(earnings.leaveEncashment) > 0;
}

/** Step 1 — annual salary from tax slip (monthly components × 12 + annual extras). */
export function computeAnnualSalaryFromTaxSlip(detail, employmentType) {
    const earnings = detail?.taxPlanning?.earnings || {};
    const monthlyComponents = TAX_SLIP_MONTHLY_KEYS.reduce(
        (sum, key) => sum + parseAmount(earnings[key]),
        0,
    );
    let annualExtras = parseAmount(earnings.other?.amount);
    if (isGovernmentSector(employmentType)) {
        annualExtras += parseAmount(earnings.bonus) + parseAmount(earnings.leaveEncashment);
    } else {
        annualExtras += parseAmount(earnings.performanceBonus);
    }
    return (monthlyComponents * 12) + annualExtras;
}

export const STANDARD_DEDUCTION = 75000;

/**
 * Build taxable-income inputs for FY 2025-26 new-regime tax calculation.
 * Returns null when there is no usable income data.
 */
export function buildTaxInput(detail, employmentType) {
    const d = { ...createEmptyIncomeDetail(), ...detail };
    const otherIncomeAnnual = sumOtherIncomeAnnual(d.otherIncome);

    if (isSalariedEmployment(employmentType)) {
        const usedTaxSlip = d.needTaxPlanning === true && hasTaxSlipEarnings(d);
        const annualSalary = usedTaxSlip
            ? computeAnnualSalaryFromTaxSlip(d, employmentType)
            : parseAmount(d.inHandSalary) * 12;
        const incomeFromSalary = Math.max(0, annualSalary - STANDARD_DEDUCTION);
        const taxableIncome = incomeFromSalary + otherIncomeAnnual;

        return {
            annualSalary,
            incomeFromSalary,
            otherIncomeAnnual,
            standardDeduction: STANDARD_DEDUCTION,
            taxableIncome,
            grossTotalIncome: annualSalary + otherIncomeAnnual,
            usedTaxSlip,
            employmentType,
        };
    }

    if (isBusinessEmployment(employmentType)) {
        const businessAnnual = (parseAmount(d.takeHomeProfit) + parseAmount(d.passiveIncome)) * 12;
        const taxableIncome = businessAnnual + otherIncomeAnnual;

        return {
            annualSalary: businessAnnual,
            incomeFromSalary: businessAnnual,
            otherIncomeAnnual,
            standardDeduction: 0,
            taxableIncome,
            grossTotalIncome: taxableIncome,
            usedTaxSlip: false,
            employmentType,
        };
    }

    if (isPensionerEmployment(employmentType)) {
        const pensionAnnual = parseAmount(d.netPension) * 12;
        const incomeFromSalary = Math.max(0, pensionAnnual - STANDARD_DEDUCTION);
        const taxableIncome = incomeFromSalary + otherIncomeAnnual;

        return {
            annualSalary: pensionAnnual,
            incomeFromSalary,
            otherIncomeAnnual,
            standardDeduction: STANDARD_DEDUCTION,
            taxableIncome,
            grossTotalIncome: pensionAnnual + otherIncomeAnnual,
            usedTaxSlip: false,
            employmentType,
        };
    }

    return null;
}
