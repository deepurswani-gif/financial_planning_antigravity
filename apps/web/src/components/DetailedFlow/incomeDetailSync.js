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
        incomeTax: '',
        other: { name: '', amount: '' },
    },
});

export const TDS_ASSUMPTION_NOTE =
    'For months before you started planning with Finbrella, we assume the same TDS was deducted each month.';

export const TDS_ALREADY_DEDUCTED_NOTE =
    'It is assumed that Income tax (TDS) has already been deducted from your salary.';

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
    if (hasTaxSlipEarnings(d)) return true;
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
    let selfDetail = { ...createEmptyIncomeDetail(), ...(income.selfDetail || {}) };
    let spouseDetail = { ...createEmptyIncomeDetail(), ...(income.spouseDetail || {}) };

    if (isSalariedEmployment(selfEmploymentType) && selfDetail.needTaxPlanning === true) {
        selfDetail = applySalarySlipDerivedTotals(selfDetail, selfEmploymentType);
    }
    if (spouseEmploymentType && isSalariedEmployment(spouseEmploymentType) && spouseDetail.needTaxPlanning === true) {
        spouseDetail = applySalarySlipDerivedTotals(spouseDetail, spouseEmploymentType);
    }

    const selfLegacy = syncLegacyFromDetail(selfDetail, selfEmploymentType);
    const spouseLegacy = spouseEmploymentType
        ? syncLegacyFromDetail(spouseDetail, spouseEmploymentType)
        : { primary: '', bonus: '', passive: '', other: '' };

    return {
        ...income,
        selfDetail,
        spouseDetail,
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
        if (d.needTaxPlanning !== true) {
            return null;
        }

        const usedTaxSlip = hasTaxSlipEarnings(d);
        if (!usedTaxSlip) {
            return null;
        }

        const annualSalary = computeAnnualSalaryFromTaxSlip(d, employmentType);
        const incomeFromSalary = Math.max(0, annualSalary - STANDARD_DEDUCTION);
        const taxableIncome = incomeFromSalary + otherIncomeAnnual;

        return {
            annualSalary,
            incomeFromSalary,
            otherIncomeAnnual,
            standardDeduction: STANDARD_DEDUCTION,
            taxableIncome,
            grossTotalIncome: annualSalary + otherIncomeAnnual,
            usedTaxSlip: true,
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

const scaleAmountField = (value, factor) => {
    if (factor === 1) return value ?? '';
    const amount = parseFloat(value);
    if (!amount) return value ?? '';
    return String(Math.round(amount * factor));
};

const TAX_SLIP_EARNINGS_KEYS = [
    'basicPay',
    'dearnessAllowance',
    'houseRentAllowance',
    'allowances',
    'leaveEncashment',
    'bonus',
    'performanceBonus',
];

const TAX_SLIP_DEDUCTION_KEYS = [
    'employeePF',
    'employeeNPS',
    'groupInsurance',
    'healthScheme',
    'groupPersonalAccident',
    'groupMedicalCoverage',
    'incomeTax',
];

/** Monthly gross derived from salary-slip earnings (including annual extras spread monthly). */
export function computeDerivedMonthlyGrossFromEarnings(detail, employmentType) {
    const earnings = detail?.taxPlanning?.earnings || {};
    const monthlyBase = TAX_SLIP_MONTHLY_KEYS.reduce(
        (sum, key) => sum + parseAmount(earnings[key]),
        0,
    );
    let monthlyExtras = parseAmount(earnings.other?.amount) / 12;
    if (isGovernmentSector(employmentType)) {
        monthlyExtras += (parseAmount(earnings.bonus) + parseAmount(earnings.leaveEncashment)) / 12;
    } else {
        monthlyExtras += parseAmount(earnings.performanceBonus) / 12;
    }
    return Math.round(monthlyBase + monthlyExtras);
}

/** Monthly gross for reconciliation helpers — prefers derived earnings, else stored gross salary. */
export function computeMonthlyGrossFromSalarySlip(detail, employmentType) {
    const d = { ...createEmptyIncomeDetail(), ...detail };
    if (hasTaxSlipEarnings(d)) {
        return computeDerivedMonthlyGrossFromEarnings(d, employmentType);
    }
    return parseAmount(d.grossSalary);
}

/** Monthly in-hand derived from salary-slip gross minus all deductions. */
export function computeDerivedMonthlyInHandFromSlip(detail, employmentType) {
    const gross = computeDerivedMonthlyGrossFromEarnings(detail, employmentType);
    const deductions = computeMonthlyDeductionsFromSalarySlip(detail);
    return Math.round(gross - deductions);
}

/** Derive in-hand from salary slip before projections / ledger (does not mutate stored state). */
export function prepareMemberDetailForProjection(detail, employmentType) {
    const base = { ...createEmptyIncomeDetail(), ...(detail || {}) };
    if (isSalariedEmployment(employmentType) && base.needTaxPlanning === true) {
        return applySalarySlipDerivedTotals(base, employmentType);
    }
    return base;
}

/** Auto-fill grossSalary and inHandSalary from salary-slip components when tax planning is enabled. */
export function applySalarySlipDerivedTotals(detail, employmentType) {
    if (detail?.needTaxPlanning !== true || !isSalariedEmployment(employmentType)) {
        return detail;
    }

    const gross = computeDerivedMonthlyGrossFromEarnings(detail, employmentType);
    const inHand = computeDerivedMonthlyInHandFromSlip(detail, employmentType);

    return {
        ...detail,
        grossSalary: gross > 0 ? String(gross) : '',
        inHandSalary: gross > 0 || inHand !== 0 ? String(inHand) : '',
    };
}

/** Sum of all monthly salary-slip deductions, including Income Tax (TDS). */
export function computeMonthlyDeductionsFromSalarySlip(detail) {
    const deductions = detail?.taxPlanning?.deductions || {};
    const fixedTotal = TAX_SLIP_DEDUCTION_KEYS.reduce(
        (sum, key) => sum + parseAmount(deductions[key]),
        0,
    );
    return fixedTotal + parseAmount(deductions.other?.amount);
}

/** True when only TDS is entered — PF/insurance may explain any in-hand gap. */
export function hasPartialSalarySlipDeductions(detail) {
    const deductions = detail?.taxPlanning?.deductions || {};
    const incomeTax = parseAmount(deductions.incomeTax);
    if (incomeTax <= 0) return false;

    const otherDeductions = TAX_SLIP_DEDUCTION_KEYS
        .filter((key) => key !== 'incomeTax')
        .reduce((sum, key) => sum + parseAmount(deductions[key]), 0)
        + parseAmount(deductions.other?.amount);

    return otherDeductions <= 0;
}

/**
 * Compare entered in-hand salary with gross minus salary-slip deductions.
 * Informational only — in-hand is already net of TDS in cash-flow terms.
 */
export function reconcileSalarySlip(detail, employmentType) {
    const gross = computeMonthlyGrossFromSalarySlip(detail, employmentType);
    const deductions = computeMonthlyDeductionsFromSalarySlip(detail);
    const computedInHand = gross - deductions;
    const enteredInHand = parseAmount(detail?.inHandSalary);

    if (gross <= 0 && enteredInHand <= 0) {
        return {
            gross,
            deductions,
            computedInHand,
            enteredInHand,
            isPartial: hasPartialSalarySlipDeductions(detail),
            status: 'empty',
            delta: 0,
        };
    }

    const reconciliation = reconcileAmounts(enteredInHand, computedInHand);

    return {
        gross,
        deductions,
        computedInHand,
        enteredInHand,
        isPartial: hasPartialSalarySlipDeductions(detail),
        ...reconciliation,
    };
}

/** Build a 12-month TDS ledger row from a single monthly amount (same value each month). */
export function buildMonthlyTdsArray(monthlyAmount) {
    const amount = Math.round(parseAmount(monthlyAmount));
    return Array(12).fill(amount);
}

/**
 * Sync self/spouse TDS ledger arrays from salary-slip incomeTax fields.
 * Re-syncs all months when the source incomeTax value changes; preserves manual ledger edits otherwise.
 */
export function syncLedgerTdsFromIncome(
    ledger,
    income,
    familyMembers,
    hasSpouseIncome,
    resolveEmploymentType,
    planStartMonth = 0,
) {
    const prev = ledger || {};
    const selfMember = familyMembers?.find((m) => m.relation?.toLowerCase() === 'self');
    const spouseMember = familyMembers?.find((m) => m.relation?.toLowerCase() === 'spouse');
    if (!selfMember) return prev;

    const selfType = resolveEmploymentType(selfMember);
    const spouseType = spouseMember ? resolveEmploymentType(spouseMember) : '';
    const includeSpouse = shouldIncludeSpouseIncome(spouseMember, hasSpouseIncome, income);

    const selfDetail = { ...createEmptyIncomeDetail(), ...(income.selfDetail || {}) };
    const spouseDetail = { ...createEmptyIncomeDetail(), ...(income.spouseDetail || {}) };

    const selfAmount = isSalariedEmployment(selfType)
        ? parseAmount(selfDetail.taxPlanning?.deductions?.incomeTax)
        : 0;
    const spouseAmount = includeSpouse && isSalariedEmployment(spouseType)
        ? parseAmount(spouseDetail.taxPlanning?.deductions?.incomeTax)
        : 0;

    const anchorMonth = Math.min(Math.max(planStartMonth, 0), 11);
    const prevSelf = prev.selfIncomeTax || Array(12).fill(0);
    const prevSpouse = prev.spouseIncomeTax || Array(12).fill(0);
    const ledgerSelfRef = parseAmount(prevSelf[anchorMonth]);
    const ledgerSpouseRef = parseAmount(prevSpouse[anchorMonth]);

    let next = { ...prev };
    let changed = false;

    const shouldResync = (detailAmount, ledgerRef, prevArr) => {
        if (detailAmount <= 0 && prevArr.every((val) => parseAmount(val) <= 0)) return false;
        if (detailAmount !== ledgerRef) return true;
        return prevArr.every((val) => parseAmount(val) <= 0) && detailAmount > 0;
    };

    if (shouldResync(selfAmount, ledgerSelfRef, prevSelf)) {
        next.selfIncomeTax = buildMonthlyTdsArray(selfAmount);
        changed = true;
    }

    if (includeSpouse) {
        if (shouldResync(spouseAmount, ledgerSpouseRef, prevSpouse)) {
            next.spouseIncomeTax = buildMonthlyTdsArray(spouseAmount);
            changed = true;
        }
    } else if (prev.spouseIncomeTax) {
        next.spouseIncomeTax = Array(12).fill(0);
        changed = true;
    }

    return changed ? next : prev;
}

/** Scale all monetary fields in an income detail for projection years. */
export function scaleIncomeDetail(detail, factor) {
    const base = { ...createEmptyIncomeDetail(), ...detail };
    if (!detail || factor === 1) return base;

    const scaled = {
        ...base,
        grossSalary: scaleAmountField(base.grossSalary, factor),
        inHandSalary: scaleAmountField(base.inHandSalary, factor),
        takeHomeProfit: scaleAmountField(base.takeHomeProfit, factor),
        netPension: scaleAmountField(base.netPension, factor),
        passiveIncome: scaleAmountField(base.passiveIncome, factor),
        otherIncome: (base.otherIncome || []).map((item) => ({
            ...item,
            amount: scaleAmountField(item?.amount, factor),
        })),
    };

    if (base.taxPlanning) {
        const earnings = base.taxPlanning.earnings || {};
        const deductions = base.taxPlanning.deductions || {};
        const scaledEarnings = { ...earnings };

        TAX_SLIP_EARNINGS_KEYS.forEach((key) => {
            if (earnings[key] !== undefined) {
                scaledEarnings[key] = scaleAmountField(earnings[key], factor);
            }
        });
        if (earnings.other) {
            scaledEarnings.other = {
                ...earnings.other,
                amount: scaleAmountField(earnings.other.amount, factor),
            };
        }

        const scaledDeductions = { ...deductions };
        TAX_SLIP_DEDUCTION_KEYS.forEach((key) => {
            if (deductions[key] !== undefined) {
                scaledDeductions[key] = scaleAmountField(deductions[key], factor);
            }
        });
        if (deductions.other) {
            scaledDeductions.other = {
                ...deductions.other,
                amount: scaleAmountField(deductions.other.amount, factor),
            };
        }

        scaled.taxPlanning = {
            ...base.taxPlanning,
            earnings: scaledEarnings,
            deductions: scaledDeductions,
        };
    }

    return scaled;
}

/** Annual gross income used for inflow and tax (matches Step 8 buildTaxInput). */
export function getMemberAnnualGrossFromDetail(detail, employmentType) {
    const taxInput = buildTaxInput(detail, employmentType);
    if (taxInput) return taxInput.grossTotalIncome;
    return getMemberDetailMonthlyTotal(detail, employmentType) * 12;
}

/** Legacy flat monthly household income (self + spouse streams). */
export function getFlatHouseholdMonthlyIncome(income = {}) {
    return (parseFloat(income.self) || 0)
        + (parseFloat(income.selfBonus) || 0)
        + (parseFloat(income.selfPassive) || 0)
        + (parseFloat(income.selfOther) || 0)
        + (parseFloat(income.spouse) || 0)
        + (parseFloat(income.spouseBonus) || 0)
        + (parseFloat(income.spousePassive) || 0)
        + (parseFloat(income.spouseOther) || 0);
}

export function getMemberFlatMonthlyIncome(income = {}, memberKey = 'self') {
    const prefix = memberKey === 'self' ? 'self' : 'spouse';
    return (parseFloat(income[prefix]) || 0)
        + (parseFloat(income[`${prefix}Bonus`]) || 0)
        + (parseFloat(income[`${prefix}Passive`]) || 0)
        + (parseFloat(income[`${prefix}Other`]) || 0);
}

/** Match Detailed Money in & out spouse inclusion rules. */
export function shouldIncludeSpouseIncome(spouseMember, hasSpouseIncome = false, income = {}) {
    if (!spouseMember) return false;
    if (spouseMember.isSpouseWorking === true || hasSpouseIncome === true) return true;
    if (getMemberFlatMonthlyIncome(income, 'spouse') > 0) return true;
    if (parseFloat(income.summarySpouseInHand) > 0) return true;
    return false;
}

/**
 * Combined monthly in-hand inflow for ledger sync — prefers detailed fields, falls back to flat keys.
 * `resolveEmploymentType` must be passed in to avoid a circular import with employmentTypeSync.
 */
export function getHouseholdMonthlyInflow(income, familyMembers, hasSpouseIncome, resolveEmploymentType) {
    const selfMember = familyMembers?.find((m) => m.relation?.toLowerCase() === 'self');
    const spouseMember = familyMembers?.find((m) => m.relation?.toLowerCase() === 'spouse');
    if (!selfMember) return getFlatHouseholdMonthlyIncome(income);

    const selfType = resolveEmploymentType(selfMember);
    const spouseType = spouseMember ? resolveEmploymentType(spouseMember) : '';
    const includeSpouse = shouldIncludeSpouseIncome(spouseMember, hasSpouseIncome, income);

    const selfDetail = getMemberDetailForProjection(income, 'self', selfType);
    let total = getMemberDetailMonthlyTotal(selfDetail, selfType);

    if (includeSpouse && spouseMember) {
        const spouseDetail = getMemberDetailForProjection(income, 'spouse', spouseType);
        total += getMemberDetailMonthlyTotal(spouseDetail, spouseType);
    }

    if (total > 0) return total;
    return getFlatHouseholdMonthlyIncome(income);
}

/** Resolve income detail for projections, falling back to legacy flat income keys. */
export function getMemberDetailForProjection(income = {}, memberKey = 'self', employmentType) {
    const detailKey = memberKey === 'self' ? 'selfDetail' : 'spouseDetail';
    let detail = { ...createEmptyIncomeDetail(), ...(income[detailKey] || {}) };

    if (hasIncomeDetailEntered(detail, employmentType)) {
        return detail;
    }

    const prefix = memberKey === 'self' ? 'self' : 'spouse';
    const summaryAmount = getSummaryIncomeTarget(income, memberKey) || income[prefix] || '';
    detail = prefillDetailFromSummaryAmount(detail, summaryAmount, employmentType);

    const passive = income[`${prefix}Passive`];
    const other = income[`${prefix}Other`];
    if (passive) detail.passiveIncome = passive;
    if (other) detail.otherIncome = [{ name: '', amount: other }];

    return detail;
}
