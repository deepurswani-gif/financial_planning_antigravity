import { calculateIncomeTax } from '../IncomeTaxModule/IncomeTaxLogic';
import { hasConfiguredLoan } from '../DetailedFlow/expenseDetailSync';
import { getLifeMemberMonthlyTotal } from '../DetailedFlow/insuranceDetailSync';
import { getEffectiveMonthlySavings, buildSavingsBreakdownAnnual } from '../DetailedFlow/savingsDetailSync';

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
    currentYearLedger
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

    const hasLedger = currentYearLedger && currentYearLedger.income && currentYearLedger.income.length === 12;

    const fallbackIncomeAnnual = (
        (parseFloat(income.self) || 0) + 
        (parseFloat(income.selfBonus) || 0) + 
        (parseFloat(income.selfPassive) || 0) + 
        (parseFloat(income.selfOther) || 0) +
        (parseFloat(income.spouse) || 0) + 
        (parseFloat(income.spouseBonus) || 0) + 
        (parseFloat(income.spousePassive) || 0) + 
        (parseFloat(income.spouseOther) || 0)
    ) * 12;

    const baselineIncomeAnnual = hasLedger ? (currentYearLedger.income[11] * 12) : fallbackIncomeAnnual;

    const selfRatio = fallbackIncomeAnnual > 0 
        ? (((parseFloat(income.self) || 0) + (parseFloat(income.selfBonus) || 0) + (parseFloat(income.selfPassive) || 0) + (parseFloat(income.selfOther) || 0)) * 12) / fallbackIncomeAnnual
        : 1;
    const spouseRatio = 1 - selfRatio;

    const selfAnnualBase = baselineIncomeAnnual * selfRatio;
    const spouseAnnualBase = baselineIncomeAnnual * spouseRatio;

    const fallbackHouseholdMonthly = Object.entries(expenseCategories.household || {})
        .filter(([key]) => key !== 'education')
        .reduce((sum, [_, val]) => sum + (parseFloat(val) || 0), 0);
        
    const householdMonthly = hasLedger ? currentYearLedger.household[11] : fallbackHouseholdMonthly;
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
        // Income with Increment
        let selfInflated = selfAnnualBase * Math.pow(1 + (incomeIncrement / 100), i);
        let spouseInflated = spouseAnnualBase * Math.pow(1 + (incomeIncrement / 100), i);
        let annualInflow = selfInflated + spouseInflated;

        let householdOutflow = (householdMonthly * 12) * Math.pow(1 + (householdInflation / 100), i);

        // Removed exact ledger summation override to ensure pure annual representation

        // --- Income Tax Calculation ---
        const selfTaxRes = calculateIncomeTax({ salary: selfInflated / 12, bonus: 0, passive: 0, other: 0 }, selfMember.occupation);
        
        let spouseTax = 0;
        if (spouseMember && spouseMember.occupation?.toLowerCase() !== 'housewife') {
            const spouseTaxRes = calculateIncomeTax({ salary: spouseInflated / 12, bonus: 0, passive: 0, other: 0 }, spouseMember.occupation);
            spouseTax = spouseTaxRes.finalTax;
        }

        const approxTax = selfTaxRes.finalTax + spouseTax;

        const netInflowAfterTax = annualInflow - approxTax;

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

        // Add Future Life Insurance from Allocation Module
        let futureLifeAllocationsThisYear = 0;
        investmentAllocations.forEach(alloc => {
            if (alloc.type !== 'Life Insurance') return;
            
            const allocStartYear = parseInt(alloc.startYear);
            const allocStartMonth = parseInt(alloc.startMonth) || 1;
            const allocDuration = parseInt(alloc.duration) || 1;
            const installmentAmount = parseFloat(alloc.amount) || 0;
            const freq = alloc.frequency || 'Monthly';
            
            const interval = freq === 'Monthly' ? 1 : 
                           freq === 'Quarterly' ? 3 : 
                           freq === 'Half-Yearly' ? 6 : 
                           12; // Annual
            const installmentsPerYear = 12 / interval;
            const yearlyAmount = installmentAmount * installmentsPerYear;

            if (year >= allocStartYear && year < (allocStartYear + allocDuration)) {
                if (year === allocStartYear) {
                    // Calculate how many installments fall in the remaining months of the start year
                    let installmentsThisYear = 0;
                    for (let m = allocStartMonth; m <= 12; m += interval) {
                        installmentsThisYear++;
                    }
                    futureLifeAllocationsThisYear += installmentAmount * installmentsThisYear;
                } else {
                    futureLifeAllocationsThisYear += yearlyAmount;
                }
            }
        });

        const totalInsuranceOutflow = genInsuranceAnnual + detailedLifeThisYear + unallocatedLifeAnnual + futureLifeAllocationsThisYear;
        const annualOutflow = householdOutflow + fixedOutflow;
        
        let totalEducationExpenses = 0;
        
        // 1. School Education
        familyMembers.forEach(member => {
            if (member.relation === 'Child') {
                if (member.occupation === 'School' || !member.occupation) {
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
                // Type == Expense (Legacy/Standard)
                const adjStartYear = parseInt(adj.startYear);
                const adjDuration = parseInt(adj.duration) || 1;
                const adjAmount = parseFloat(adj.amount) || 0;
                
                if (year >= adjStartYear && year < (adjStartYear + adjDuration)) {
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

        const currentMonthAbsolute = new Date().getMonth() + 1;
        const startMonthLimit = (i === 0) ? currentMonthAbsolute : 1;

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
                    const adjDuration = parseInt(adj.duration) || 1;
                    const adjAmount = parseFloat(adj.amount) || 0;
                    
                    if (year >= adjStartYear && year < (adjStartYear + adjDuration)) {
                        // Distribute the annual amount over active months
                        if (year === adjStartYear) {
                            if (m >= adjStartMonth) {
                                monthlyJourneyDeduction += (adjAmount / (13 - adjStartMonth)); 
                            }
                        } else {
                            monthlyJourneyDeduction += (adjAmount / 12);
                        }
                    }
                }
            });

            // 2. Calculate Monthly Allocation Deductions
            investmentAllocations.forEach(alloc => {
                const isRecurring = ['SIP', 'PPF', 'NPS', 'Life Insurance', 'Recurring Deposit'].includes(alloc.type);
                const isLifeInsurance = alloc.type === 'Life Insurance';

                if (isLifeInsurance) return; // Handled in savingsAndInvestments already as totalInsuranceOutflow

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
            const isRecurring = ['SIP', 'PPF', 'NPS', 'Life Insurance', 'Recurring Deposit'].includes(type);
            
            // If it's Life Insurance, it's already accounted for in totalInsuranceOutflow
            // We want it to show up in the Allocation Table, so we will add it to activeAllocations
            // but we MUST NOT subtract it from unallocatedSurplus (i.e., don't add to yearAllocationsTotal)
            const isLifeInsurance = type === 'Life Insurance';

            let yearlyAmount = 0;
            let monthlyAmount = 0;

            if (isLifeInsurance) {
                const freq = alloc.frequency || 'Monthly';
                const interval = freq === 'Monthly' ? 1 : 
                               freq === 'Quarterly' ? 3 : 
                               freq === 'Half-Yearly' ? 6 : 
                               12;
                const installmentAmount = parseFloat(alloc.amount) || 0;
                yearlyAmount = installmentAmount * (12 / interval);
                monthlyAmount = yearlyAmount / 12;
            } else {
                // For recurring investments, alloc.amount is the ANNUAL amount (Monthly * 12)
                // For one-time investments, alloc.amount is the TOTAL amount
                yearlyAmount = parseFloat(alloc.amount) || 0;
                monthlyAmount = isRecurring ? (yearlyAmount / 12) : 0;
            }

            if (isRecurring) {
                // If the year is between start and end (within duration)
                if (year >= allocStartYear && year < (allocStartYear + allocDuration)) {
                    let impactThisYear = yearlyAmount;
                    
                    // If it's the starting year, only count from startMonth onwards
                    if (year === allocStartYear) {
                        if (isLifeInsurance) {
                            const freq = alloc.frequency || 'Monthly';
                            const interval = freq === 'Monthly' ? 1 : 
                                           freq === 'Quarterly' ? 3 : 
                                           freq === 'Half-Yearly' ? 6 : 
                                           12;
                            let installmentsThisYear = 0;
                            for (let m = allocStartMonth; m <= 12; m += interval) {
                                installmentsThisYear++;
                            }
                            impactThisYear = (parseFloat(alloc.amount) || 0) * installmentsThisYear;
                        } else {
                            impactThisYear = monthlyAmount * (13 - allocStartMonth);
                        }
                    }
                    
                    if (!isLifeInsurance) {
                        yearAllocationsTotal += impactThisYear;
                    }
                    activeAllocations.push({ ...alloc, impactThisYear });
                }
            } else {
                // One-time investments only impact the starting year
                if (year === allocStartYear) {
                    if (!isLifeInsurance) {
                        yearAllocationsTotal += yearlyAmount;
                    }
                    activeAllocations.push({ ...alloc, impactThisYear: yearlyAmount });
                }
            }
        });

        const unallocatedSurplus = netInvestibleSurplus - yearAllocationsTotal;

        projections.push({
            year,
            annualInflow,
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
