import { resolveEmploymentType } from '../DetailedFlow/employmentTypeSync';
import { getEffectiveMonthlyHousehold } from '../DetailedFlow/expenseDetailSync';
import {
    getChildMonthlyEducationExpense,
    isEducationInHouseholdBaseline,
} from '../DetailedFlow/educationExpenseSync';
import {
    getMemberDetailForProjection,
    getMemberFlatMonthlyIncome,
    getFlatHouseholdMonthlyIncome,
    shouldIncludeSpouseIncome,
    prepareMemberDetailForProjection,
} from '../DetailedFlow/incomeDetailSync';
import {
    getMemberNetInflowForLedger,
    computeHouseholdProjectedTaxReconciliation,
} from '../DetailedReport/moneyFlowLedgerLogic';
import { hasConfiguredLoan } from '../DetailedFlow/expenseDetailSync';
import {
    getLifeMemberMonthlyTotal,
    shouldIncludeStudioInsuranceInProjections,
} from '../DetailedFlow/insuranceDetailSync';
import { getEffectiveMonthlySavings, buildSavingsBreakdownAnnual } from '../DetailedFlow/savingsDetailSync';

/** Months between installments for a premium frequency. */
const getInsuranceFrequencyInterval = (freq = 'Monthly') => {
    if (freq === 'Quarterly') return 3;
    if (freq === 'Half-Yearly' || freq === 'Half Yearly') return 6;
    if (freq === 'Annual' || freq === 'Annually') return 12;
    return 1; // Monthly
};

/**
 * Full-year premium for Life Insurance allocation rows that still flow through
 * the Investments / insurance column (legacy installment vs studio annual).
 *
 * Term & Health are NOT included here — they reduce unallocated surplus like SIP
 * (studio stores annual monthly×12) so PYMTW deployable surplus is not double-hit
 * via both netInvestibleSurplus and allocation impact.
 */
export const getProtectionAllocationAnnual = (alloc = {}) => {
    const amount = parseFloat(alloc.amount) || 0;
    const type = alloc.type;

    if ((type === 'Life Insurance' || type === 'Life Insurance Saving Plans') && alloc.studioPlanKey) {
        return amount;
    }

    const interval = getInsuranceFrequencyInterval(alloc.frequency || 'Monthly');
    return amount * (12 / interval);
};

/** Premium impact of a Life Insurance allocation in a given calendar year (start-year prorated). */
export const getProtectionAllocationImpactForYear = (alloc = {}, year) => {
    const allocStartYear = parseInt(alloc.startYear, 10);
    const allocStartMonth = Math.min(12, Math.max(1, parseInt(alloc.startMonth, 10) || 1));
    const allocDuration = parseInt(alloc.duration, 10) || 1;

    if (!Number.isFinite(allocStartYear)) return 0;
    if (!(year >= allocStartYear && year < (allocStartYear + allocDuration))) return 0;

    const yearlyAmount = getProtectionAllocationAnnual(alloc);
    if (year !== allocStartYear) return yearlyAmount;

    const isLegacyInstallmentLife = (
        (alloc.type === 'Life Insurance' || alloc.type === 'Life Insurance Saving Plans')
        && !alloc.studioPlanKey
    );

    if (isLegacyInstallmentLife) {
        const interval = getInsuranceFrequencyInterval(alloc.frequency || 'Monthly');
        const installmentAmount = parseFloat(alloc.amount) || 0;
        let installmentsThisYear = 0;
        for (let m = allocStartMonth; m <= 12; m += interval) {
            installmentsThisYear += 1;
        }
        return installmentAmount * installmentsThisYear;
    }

    // Studio-keyed Life: annual storage — remaining months in the start year
    return (yearlyAmount / 12) * (13 - allocStartMonth);
};

/** True when this row belongs in the Investments insurance bucket (not unallocated surplus). */
const isInsuranceColumnAllocation = (alloc = {}) => alloc.type === 'Life Insurance';

/** Studio Term/Health (annual storage) — deplete unallocated surplus like SIP/PPF. */
const isSurplusAllocationProtection = (alloc = {}) => (
    alloc.type === 'Term Insurance' || alloc.type === 'Health Insurance'
);

const resolveAnnualInflowBases = ({
    income,
    selfDetail,
    spouseDetail,
    selfEmploymentType,
    spouseEmploymentType,
    includeSpouse,
    currentYearLedger,
}) => {
    const activeSpouseDetail = includeSpouse && spouseDetail ? spouseDetail : null;
    const activeSpouseType = includeSpouse ? spouseEmploymentType : '';

    let selfInHandAnnual = getMemberNetInflowForLedger(selfDetail, selfEmploymentType) * 12;
    let spouseInHandAnnual = activeSpouseDetail
        ? getMemberNetInflowForLedger(activeSpouseDetail, activeSpouseType) * 12
        : 0;

    const detailInflowAnnual = selfInHandAnnual + spouseInHandAnnual;
    const fallbackInflowAnnual = getFlatHouseholdMonthlyIncome(income) * 12;

    const ledgerMonthlyIncome = parseFloat(currentYearLedger?.income?.[11]) || 0;
    const hasActiveIncomeLedger = ledgerMonthlyIncome > 0;

    if (hasActiveIncomeLedger) {
        const baselineInflowAnnual = ledgerMonthlyIncome * 12;
        if (detailInflowAnnual > 0) {
            const ledgerScale = baselineInflowAnnual / detailInflowAnnual;
            selfInHandAnnual *= ledgerScale;
            spouseInHandAnnual *= ledgerScale;
        } else if (fallbackInflowAnnual > 0) {
            const selfFlatAnnual = getMemberFlatMonthlyIncome(income, 'self') * 12;
            const selfRatio = selfFlatAnnual / fallbackInflowAnnual;
            selfInHandAnnual = baselineInflowAnnual * selfRatio;
            spouseInHandAnnual = baselineInflowAnnual * (1 - selfRatio);
        } else {
            selfInHandAnnual = baselineInflowAnnual;
            spouseInHandAnnual = 0;
        }
    } else if (detailInflowAnnual <= 0) {
        const selfFlatAnnual = getMemberFlatMonthlyIncome(income, 'self') * 12;
        const selfRatio = fallbackInflowAnnual > 0 ? selfFlatAnnual / fallbackInflowAnnual : 1;
        selfInHandAnnual = fallbackInflowAnnual * selfRatio;
        spouseInHandAnnual = fallbackInflowAnnual * (1 - selfRatio);
    }

    return { selfInHandAnnual, spouseInHandAnnual };
};

export const EDUCATION_STANDARDS = [
    "Play Group",
    "Nursery",
    "LKG",
    "UKG",
    "1st Standard",
    "2nd Standard",
    "3rd Standard",
    "4th Standard",
    "5th Standard",
    "6th Standard",
    "7th Standard",
    "8th Standard",
    "9th Standard",
    "10th Standard",
    "11th Standard",
    "12th Standard"
];

export const generateProjections = ({ 
    familyMembers, 
    income, 
    expenseCategories, 
    goals, 
    inflationRates, 
    startYear = new Date().getFullYear(),
    policies = [], 
    journeyAdjustments = [], 
    investmentAllocations = [],
    loanProposals = [],
    currentYearLedger,
    hasSpouseIncome = false,
    planStartMonth = new Date().getMonth(),
}) => {
    let cumulativeNetInvestibleSurplus = 0; // Tracks running cash flow balance month-by-month across all years
    
    const {
        incomeIncrement = 0,
        householdInflation = 0,
        educationInflation = 0
    } = inflationRates;

    // 1. Determine End Year (Retirement Year of 'Self')
    const selfMember = familyMembers.find(m => m.relation?.toLowerCase() === 'self');
    const spouseMember = familyMembers.find(m => m.relation?.toLowerCase() === 'spouse');
    
    if (!selfMember) return [];
    
    const birthYear = selfMember.dob ? new Date(selfMember.dob).getFullYear() : (startYear - (selfMember.age || 30));
    const retirementYear = birthYear + (parseInt(selfMember.retirementAge) || 60);
    
    const yearsToProject = retirementYear - startYear + 1;
    if (yearsToProject <= 0) return [];

    const selfEmploymentType = resolveEmploymentType(selfMember);
    const spouseEmploymentType = spouseMember ? resolveEmploymentType(spouseMember) : '';
    const includeSpouse = shouldIncludeSpouseIncome(spouseMember, hasSpouseIncome, income);

    const selfDetail = prepareMemberDetailForProjection(
        getMemberDetailForProjection(income, 'self', selfEmploymentType),
        selfEmploymentType,
    );
    const spouseDetail = includeSpouse
        ? prepareMemberDetailForProjection(
            getMemberDetailForProjection(income, 'spouse', spouseEmploymentType),
            spouseEmploymentType,
        )
        : null;

    const { selfInHandAnnual, spouseInHandAnnual } = resolveAnnualInflowBases({
        income,
        selfDetail,
        spouseDetail,
        selfEmploymentType,
        spouseEmploymentType,
        includeSpouse,
        currentYearLedger,
    });

    const fallbackHouseholdMonthly = getEffectiveMonthlyHousehold(expenseCategories, familyMembers);

    const ledgerMonthlyHousehold = parseFloat(currentYearLedger?.household?.[11]) || 0;
    const hasActiveHouseholdLedger = ledgerMonthlyHousehold > 0;
    const householdMonthly = hasActiveHouseholdLedger ? ledgerMonthlyHousehold : fallbackHouseholdMonthly;
    const savingsMonthly = getEffectiveMonthlySavings(expenseCategories);

    // --- Insurance Logic ---
    const getMonthly = (item) => {
    if (!item || !item.value) return 0;
    const val = parseFloat(item.value) || 0;
    const freq = item.frequency || 'Annual';
    switch (freq) {
        case 'Annual':
        case 'Annually': return val / 12;
        case 'Half Yearly':
        case 'Half-Yearly': return val / 6;
        case 'Quarterly': return val / 3;
        case 'Monthly': return val;
        default: return val / 12;
    }
};

    const genInsuranceAnnual = (
        getMonthly(expenseCategories.insurance?.health) +
        getMonthly(expenseCategories.insurance?.car) +
        getMonthly(expenseCategories.insurance?.bike) +
        getMonthly(expenseCategories.insurance?.others)
    ) * 12;

    const cashFlowLifeAnnual = Object.values(expenseCategories.insurance?.life || {}).reduce((sum, item) => {
        return sum + getLifeMemberMonthlyTotal(item);
    }, 0) * 12;

    // Find detailed premiums active in startYear to determine unallocated amount
    let detailedLifeStartYear = 0;
    policies.forEach(p => {
        const startDate = new Date(p.startDate);
        if (isNaN(startDate.getTime())) return;
        const startY = startDate.getFullYear();
        const payTerm = parseInt(p.paymentTerm) || 0;
        const freq = p.frequency || 'Annually';
        const mult = freq === 'Monthly' ? 12 : freq === 'Quarterly' ? 4 : freq === 'Half-Yearly' ? 2 : 1;
        const annual = (parseFloat(p.premium) || 0) * mult;

        if (startY <= startYear && (startY + payTerm) > startYear) {
            detailedLifeStartYear += annual;
        }
    });

    const unallocatedLifeAnnual = Math.max(0, cashFlowLifeAnnual - detailedLifeStartYear);

    const projections = [];

    for (let i = 0; i < yearsToProject; i++) {
        const year = startYear + i;
        const growthFactor = Math.pow(1 + (incomeIncrement / 100), i);
        const annualInflow = (selfInHandAnnual + spouseInHandAnnual) * growthFactor;

        let householdOutflow = (householdMonthly * 12) * Math.pow(1 + (householdInflation / 100), i);

        // --- Tax reconciliation (ledger-aligned: in-hand inflow, TDS already deducted) ---
        const {
            computedTax,
            tdsWithheld,
            taxReconciliation,
            taxImpact,
            applies: taxAdjustmentApplies,
        } = computeHouseholdProjectedTaxReconciliation({
            selfDetail,
            selfEmploymentType,
            spouseDetail,
            spouseEmploymentType,
            includeSpouse,
            yearIndex: i,
            incomeIncrementPercent: incomeIncrement,
            projectionYear: year,
        });

        /** Amount applied to the waterfall (0 in current calendar year; reconciliation thereafter). */
        const approxTax = taxImpact;
        const netInflowAfterTax = annualInflow - taxImpact;

        // Outflows logic
        // Extract Cash Flow EMIs accurately resolving Active object parameters vs primitive infinite legacy
        let activeCashFlowEMIThisYear = 0;
        Object.entries(expenseCategories.emi || {}).forEach(([key, val]) => {
            if (typeof val === 'object' && parseFloat(val.principal) > 0) {
                const adjStartYear = parseInt(val.startYear);
                const adjStartMonth = parseInt(val.startMonth) || 1;
                const tenureMonths = parseInt(val.tenure) || 12;
                const emi = parseFloat(val.emi) || 0;

                const loanStartAbsoluteMonth = (adjStartYear * 12) + adjStartMonth;
                const loanEndAbsoluteMonth = loanStartAbsoluteMonth + tenureMonths - 1;
                const yearStartAbsoluteMonth = (year * 12) + 1;
                const yearEndAbsoluteMonth = (year * 12) + 12;

                const overlapStart = Math.max(loanStartAbsoluteMonth, yearStartAbsoluteMonth);
                const overlapEnd = Math.min(loanEndAbsoluteMonth, yearEndAbsoluteMonth);
                const activeMonths = Math.max(0, overlapEnd - overlapStart + 1);

                if (activeMonths > 0) {
                    activeCashFlowEMIThisYear += activeMonths * emi;
                }
            } else if (typeof val !== 'object') {
                const primEMI = parseFloat(val) || 0;
                activeCashFlowEMIThisYear += primEMI * 12; // Legacy assumption defaults to infinite
            }
        });

        if (!hasConfiguredLoan(expenseCategories.emi) && activeCashFlowEMIThisYear === 0) {
            const summaryMonthly = parseFloat(expenseCategories.summaryEmiTotal) || 0;
            if (summaryMonthly > 0) {
                activeCashFlowEMIThisYear = summaryMonthly * 12;
            }
        }
        
        const fixedOutflow = activeCashFlowEMIThisYear; 
        // Dynamic Insurance Calculation for this year
        let detailedLifeThisYear = 0;
        policies.forEach(p => {
            const startDate = new Date(p.startDate);
            if (isNaN(startDate.getTime())) return;
            const startY = startDate.getFullYear();
            const payTerm = parseInt(p.paymentTerm) || 0;
            const freq = p.frequency || 'Annually';
            const mult = freq === 'Monthly' ? 12 : freq === 'Quarterly' ? 4 : freq === 'Half-Yearly' ? 2 : 1;
            const annual = (parseFloat(p.premium) || 0) * mult;

            if (startY <= year && (startY + payTerm) > year) {
                detailedLifeThisYear += annual;
            }
        });

        // Life Insurance from Allocation / Studio only — Term/Health reduce unallocated
        // surplus like SIP (avoids double-counting against PYMTW deployable surplus).
        // Skip when a linked policy already carries the premium.
        let futureLifeAllocationsThisYear = 0;
        investmentAllocations.forEach(alloc => {
            if (!isInsuranceColumnAllocation(alloc)) return;
            if (!shouldIncludeStudioInsuranceInProjections(alloc, policies)) return;
            futureLifeAllocationsThisYear += getProtectionAllocationImpactForYear(alloc, year);
        });

        const totalInsuranceOutflow = genInsuranceAnnual + detailedLifeThisYear + unallocatedLifeAnnual + futureLifeAllocationsThisYear;
        const annualOutflow = householdOutflow + fixedOutflow;
        
        let totalEducationExpenses = 0;
        const householdEducationBaseline = isEducationInHouseholdBaseline(
            familyMembers,
            expenseCategories.household,
        );

        // 1. School Education
        familyMembers.forEach(member => {
            if (member.relation === 'Child') {
                if (member.occupation === 'School' || !member.occupation) {
                    if (getChildMonthlyEducationExpense(member) > 0 || householdEducationBaseline) return;
                    const currentStandard = member.standard || '';
                    const baseFee = parseFloat(member.annualSchoolFee)
                        || (parseFloat(member.monthlyEducationExpense) || 0) * 12;
                    const currentIndex = EDUCATION_STANDARDS.findIndex(s => 
                        s.toLowerCase().includes(currentStandard.toLowerCase()) || 
                        currentStandard.toLowerCase().includes(s.toLowerCase())
                    );
                    
                    if (currentIndex !== -1) {
                        const futureIndex = currentIndex + i;
                        if (futureIndex < EDUCATION_STANDARDS.length) {
                            totalEducationExpenses += baseFee * Math.pow(1 + (educationInflation / 100), i);
                        }
                    }
                } else if (member.occupation === 'College') {
                    if (getChildMonthlyEducationExpense(member) > 0 || householdEducationBaseline) return;

                    const duration = parseFloat(member.courseDuration) || 1;
                    const remainingTime = parseFloat(member.remainingTime) || 0;
                    const totalCost = parseFloat(member.costOfCompleteCourse) || 0;
                    const isPaid = member.isFeePaid === 'YES';
                    const annualCost = totalCost / duration;

                    if (i === 0) {
                        if (!isPaid) totalEducationExpenses += annualCost;
                    } else if (i <= remainingTime) {
                        totalEducationExpenses += annualCost;
                    }
                }
            }
        });

        // 2. Higher Education
        goals.forEach(goal => {
            const isEducation = goal.name?.toLowerCase().includes('higher education');
            if (isEducation) {
                const yearsToGoal = parseFloat(goal.yearsToGoal) || 0;
                const duration = parseInt(goal.courseDuration) || 0;
                const totalCost = parseFloat(goal.totalCourseCost) || 0;
                const inflation = (parseFloat(goal.inflationRate) || educationInflation) / 100;
                
                const goalStartYear = startYear + Math.round(yearsToGoal);
                if (year >= goalStartYear && year < goalStartYear + duration) {
                    const futureTotalCost = totalCost * Math.pow(1 + inflation, yearsToGoal);
                    totalEducationExpenses += (futureTotalCost / duration);
                }
            }
        });

        // 3. Journey Adjustments & Fulfillment Loan Proposals
        let yearAdjustmentsTotal = 0;
        const activeAdjustments = [];
        
        const combinedAdjustments = [
            ...journeyAdjustments,
            ...loanProposals.map(lp => ({ ...lp, type: 'loan' }))
        ];

        combinedAdjustments.forEach(adj => {
            if (adj.type === 'loan') {
                const adjStartYear = parseInt(adj.startYear);
                const adjStartMonth = parseInt(adj.startMonth) || 1;
                const tenureMonths = parseInt(adj.tenure) || 12;
                const emi = parseFloat(adj.emi) || 0;

                const loanStartAbsoluteMonth = (adjStartYear * 12) + adjStartMonth;
                const loanEndAbsoluteMonth = loanStartAbsoluteMonth + tenureMonths - 1;
                const yearStartAbsoluteMonth = (year * 12) + 1;
                const yearEndAbsoluteMonth = (year * 12) + 12;

                const overlapStart = Math.max(loanStartAbsoluteMonth, yearStartAbsoluteMonth);
                const overlapEnd = Math.min(loanEndAbsoluteMonth, yearEndAbsoluteMonth);
                const activeMonths = Math.max(0, overlapEnd - overlapStart + 1);

                if (activeMonths > 0) {
                    const yearEMI = activeMonths * emi;
                    yearAdjustmentsTotal += yearEMI;
                    activeAdjustments.push({ name: `EMI: ${adj.name}`, amount: yearEMI });
                }
            } else {
                // Standard expenses are one-time (month-year specific) lump-sum deductions.
                const adjStartYear = parseInt(adj.startYear);
                const adjAmount = parseFloat(adj.amount) || 0;

                if (year === adjStartYear) {
                    yearAdjustmentsTotal += adjAmount;
                    activeAdjustments.push({ name: adj.name, amount: adjAmount });
                }
            }
        });

        const totalOutflow = annualOutflow + totalEducationExpenses + yearAdjustmentsTotal;
        const surplusBeforeSaving = netInflowAfterTax - totalOutflow;
        const savingsAndInvestments = (savingsMonthly * 12) + totalInsuranceOutflow; 
        const netInvestibleSurplus = surplusBeforeSaving - savingsAndInvestments;

        // --- NEW: Cumulative Month-by-Month Validation ---
        // Calculate the base surplus of the year BEFORE any Journey adjustments or Allocations
        const baselineTotalOutflow = annualOutflow + totalEducationExpenses;
        const baselineSurplusBeforeSaving = netInflowAfterTax - baselineTotalOutflow;
        const baseNetInvestibleSurplusAnnual = baselineSurplusBeforeSaving - savingsAndInvestments;
        const monthlyBaselineInflow = baseNetInvestibleSurplusAnnual / 12;

        let yearHasDeficit = false;
        let yearDeficitMonth = null;
        let lowestCumulativeSurplus = null;

        // Year 1 cumulative deficit check aligns with Allocation proration window (plan start → Dec).
        const planStartMonthAbsolute = Math.min(Math.max(planStartMonth, 0), 11) + 1;
        const startMonthLimit = (i === 0) ? planStartMonthAbsolute : 1;

        for (let m = startMonthLimit; m <= 12; m++) {
            let monthlyJourneyDeduction = 0;
            let monthlyAllocationDeduction = 0;
            const currentAbsoluteMonth = (year * 12) + m;

            // 1. Calculate Monthly Journey Deductions
            combinedAdjustments.forEach(adj => {
                if (adj.type === 'loan') {
                    const adjStartYear = parseInt(adj.startYear);
                    const adjStartMonth = parseInt(adj.startMonth) || 1;
                    const tenureMonths = parseInt(adj.tenure) || 12;
                    const emi = parseFloat(adj.emi) || 0;

                    const loanStartAbsoluteMonth = (adjStartYear * 12) + adjStartMonth;
                    const loanEndAbsoluteMonth = loanStartAbsoluteMonth + tenureMonths - 1;

                    if (currentAbsoluteMonth >= loanStartAbsoluteMonth && currentAbsoluteMonth <= loanEndAbsoluteMonth) {
                        monthlyJourneyDeduction += emi;
                    }
                } else {
                    const adjStartYear = parseInt(adj.startYear);
                    const adjStartMonth = parseInt(adj.startMonth) || 1;
                    const adjAmount = parseFloat(adj.amount) || 0;

                    if (year === adjStartYear && m === adjStartMonth) {
                        monthlyJourneyDeduction += adjAmount;
                    }
                }
            });

            // 2. Calculate Monthly Allocation Deductions
            investmentAllocations.forEach(alloc => {
                const isRecurring = ['SIP', 'PPF', 'NPS', 'Life Insurance', 'Term Insurance', 'Health Insurance', 'Life Insurance Saving Plans', 'Recurring Deposit'].includes(alloc.type);

                // Life Insurance is in savingsAndInvestments / insurance column already
                if (isInsuranceColumnAllocation(alloc)) return;
                // Term/Health linked to a policy premium — counted under detailedLifeThisYear
                if (isSurplusAllocationProtection(alloc)
                    && !shouldIncludeStudioInsuranceInProjections(alloc, policies)) {
                    return;
                }

                const allocStartYear = parseInt(alloc.startYear);
                const allocStartMonth = parseInt(alloc.startMonth) || 1;
                const allocDuration = parseInt(alloc.duration) || 1;
                const annualAmount = parseFloat(alloc.amount) || 0;

                if (isRecurring) {
                    if (year >= allocStartYear && year < (allocStartYear + allocDuration)) {
                        if (year === allocStartYear) {
                            if (m >= allocStartMonth) {
                                monthlyAllocationDeduction += (annualAmount / 12);
                            }
                        } else {
                            monthlyAllocationDeduction += (annualAmount / 12);
                        }
                    }
                } else {
                    // Lumpsum / Fixed Deposit / Other One-Time
                    // We assume one-time allocations occur strictly on their startMonth.
                    if (year === allocStartYear && m === allocStartMonth) {
                        monthlyAllocationDeduction += annualAmount;
                    }
                }
            });

            // Apply to cumulative
            cumulativeNetInvestibleSurplus += monthlyBaselineInflow;
            cumulativeNetInvestibleSurplus -= monthlyJourneyDeduction;
            cumulativeNetInvestibleSurplus -= monthlyAllocationDeduction;

            if (lowestCumulativeSurplus === null || cumulativeNetInvestibleSurplus < lowestCumulativeSurplus) {
                lowestCumulativeSurplus = cumulativeNetInvestibleSurplus;
            }

            if (cumulativeNetInvestibleSurplus < 0 && !yearHasDeficit) {
                yearHasDeficit = true;
                yearDeficitMonth = m;
            }
        }
        // --- END Cumulative Validation ---

        // 4. Proposed Investment Allocations (Step 9) - These are ADDITIONAL investments proposed from the Allocation Module
        let yearAllocationsTotal = 0;
        const activeAllocations = [];
        
        investmentAllocations.forEach(alloc => {
            const allocStartYear = parseInt(alloc.startYear);
            const allocStartMonth = parseInt(alloc.startMonth) || 1;
            const allocDuration = parseInt(alloc.duration) || 1;
            const type = alloc.type;
            const isRecurring = ['SIP', 'PPF', 'NPS', 'Life Insurance', 'Term Insurance', 'Health Insurance', 'Life Insurance Saving Plans', 'Recurring Deposit'].includes(type);

            // Life Insurance stays on the Investments/insurance column — show in activeAllocations
            // but do not subtract again from unallocatedSurplus.
            // Term/Health deplete unallocated surplus (annual studio amounts), unless a linked
            // policy already carries the premium.
            const inInsuranceColumn = isInsuranceColumnAllocation(alloc);
            const skipSurplusProtection = isSurplusAllocationProtection(alloc)
                && !shouldIncludeStudioInsuranceInProjections(alloc, policies);

            let yearlyAmount = 0;
            let monthlyAmount = 0;

            if (inInsuranceColumn) {
                yearlyAmount = getProtectionAllocationAnnual(alloc);
                monthlyAmount = yearlyAmount / 12;
            } else {
                // Recurring (incl. Term/Health): alloc.amount is ANNUAL (Monthly × 12)
                // One-time: alloc.amount is the TOTAL amount
                yearlyAmount = parseFloat(alloc.amount) || 0;
                monthlyAmount = isRecurring ? (yearlyAmount / 12) : 0;
            }

            if (isRecurring) {
                if (year >= allocStartYear && year < (allocStartYear + allocDuration)) {
                    let impactThisYear = yearlyAmount;

                    if (year === allocStartYear) {
                        if (inInsuranceColumn) {
                            impactThisYear = getProtectionAllocationImpactForYear(alloc, year);
                        } else {
                            impactThisYear = monthlyAmount * (13 - allocStartMonth);
                        }
                    }

                    if (!inInsuranceColumn && !skipSurplusProtection) {
                        yearAllocationsTotal += impactThisYear;
                    }
                    if (!skipSurplusProtection || inInsuranceColumn) {
                        activeAllocations.push({ ...alloc, impactThisYear });
                    }
                }
            } else {
                // One-time investments only impact the starting year
                if (year === allocStartYear) {
                    yearAllocationsTotal += yearlyAmount;
                    activeAllocations.push({ ...alloc, impactThisYear: yearlyAmount });
                }
            }
        });

        const unallocatedSurplus = netInvestibleSurplus - yearAllocationsTotal;

        projections.push({
            year,
            annualInflow,
            computedTax,
            tdsWithheld,
            taxReconciliation,
            taxAdjustmentApplies,
            approxTax,
            netInflowAfterTax,
            householdOutflow,
            emiOutflow: fixedOutflow,
            insurancePremium: totalInsuranceOutflow,
            educationExpenses: totalEducationExpenses,
            journeyAdjustments: activeAdjustments,
            journeyAdjustmentsTotal: yearAdjustmentsTotal,
            totalOutflow,
            surplusBeforeSaving,
            savingsAndInvestments,
            savingsBreakdown: buildSavingsBreakdownAnnual(expenseCategories),
            netInvestibleSurplus,
            yearAllocationsTotal,
            activeAllocations,
            unallocatedSurplus,
            lowestCumulativeSurplus,
            yearHasDeficit,
            yearDeficitMonth
        });
    }

    return projections;
};
