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
    const loaded = income || {};
    return {
        self: loaded.self ?? loaded.family ?? '',
        selfBonus: loaded.selfBonus ?? loaded.bonus ?? '',
        selfPassive: loaded.selfPassive ?? loaded.passive ?? '',
        selfOther: loaded.selfOther ?? loaded.other ?? '',
        spouse: loaded.spouse ?? '',
        spouseBonus: loaded.spouseBonus ?? '',
        spousePassive: loaded.spousePassive ?? '',
        spouseOther: loaded.spouseOther ?? '',
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
