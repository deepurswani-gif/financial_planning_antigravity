import { getSavingsMonthlyAmount } from '../DetailedFlow/savingsDetailSync';

export const calculateGrowthProjections = (params) => {
    const {
        familyMembers,
        assetCategories,
        expenseCategories,
        allocations,
        goals,
        startYear = new Date().getFullYear()
    } = params;

    // 1. Determine End Year (Retirement Year of 'Self')
    const selfMember = familyMembers.find(m => m.relation?.toLowerCase() === 'self');
    if (!selfMember) return [];
    
    const birthYear = selfMember.dob ? new Date(selfMember.dob).getFullYear() : (startYear - (selfMember.age || 30));
    const retirementYear = birthYear + (parseInt(selfMember.retirementAge) || 60);
    const yearsToProject = retirementYear - startYear + 1;

    // 2. Initial Assets (Opening Balance)
    const initialAssets = [
        { name: 'Stocks', value: parseFloat(assetCategories.equity?.stocks) || 0, cagr: 12 },
        { name: 'Equity MF', value: parseFloat(assetCategories.equity?.mfEquity) || 0, cagr: 12 },
        { name: 'PPF (Asset)', value: parseFloat(assetCategories.debt?.ppf) || 0, cagr: 7.1 },
        { name: 'FD (Asset)', value: parseFloat(assetCategories.debt?.fd) || 0, cagr: 6 },
        { name: 'Gold', value: parseFloat(assetCategories.others?.gold) || 0, cagr: 8 },
        { name: 'Investment Property', value: parseFloat(assetCategories.realEstate?.investmentProp) || 0, cagr: 6 }
    ].filter(a => a.value > 0);

    // 3. Recurring Savings (Annualized)
    const recurringSavings = [
        { name: 'SIP (Existing)', amount: getSavingsMonthlyAmount(expenseCategories.savings?.sip) * 12, cagr: 12 },
        { name: 'PPF (Savings)', amount: getSavingsMonthlyAmount(expenseCategories.savings?.ppf) * 12, cagr: 7.1 },
        { name: 'NPS (Savings)', amount: getSavingsMonthlyAmount(expenseCategories.savings?.nps) * 12, cagr: 10 },
        { name: 'RD', amount: getSavingsMonthlyAmount(expenseCategories.savings?.rd) * 12, cagr: 6 },
        { name: 'Other Savings', amount: getSavingsMonthlyAmount(expenseCategories.savings?.otherSaving) * 12, cagr: 6 },
    ].filter(s => s.amount > 0);

    // 4. New Allocations
    const newAllocations = allocations.map(a => ({
        id: a.id,
        name: a.name || a.type,
        amount: parseFloat(a.amount) || 0,
        cagr: parseFloat(a.expectedReturn) || 12,
        startYear: parseInt(a.startYear) || startYear,
        duration: parseInt(a.duration) || 10
    }));

    const projections = [];
    let portfolio = initialAssets.map(a => ({ ...a, balance: a.value }));

    for (let i = 0; i < yearsToProject; i++) {
        const year = startYear + i;
        const yearData = {
            year,
            openingBalance: portfolio.reduce((sum, item) => sum + item.balance, 0),
            newInvestments: 0,
            growth: 0,
            withdrawals: 0,
            closingBalance: 0,
            details: []
        };

        // Apply Growth & Add New Investments
        portfolio.forEach(item => {
            const growth = item.balance * (item.cagr / 100);
            yearData.growth += growth;
            item.balance += growth;
        });

        // Add Recurring Savings
        recurringSavings.forEach(savings => {
            yearData.newInvestments += savings.amount;
            // Find existing item or add new to portfolio
            let existing = portfolio.find(p => p.name === savings.name);
            if (existing) {
                existing.balance += savings.amount;
            } else {
                portfolio.push({ name: savings.name, balance: savings.amount, cagr: savings.cagr });
            }
        });

        // Add New Allocations that start this year or are ongoing
        newAllocations.forEach(alloc => {
            if (year >= alloc.startYear && year < alloc.startYear + alloc.duration) {
                yearData.newInvestments += alloc.amount;
                let existing = portfolio.find(p => p.id === alloc.id);
                if (existing) {
                    existing.balance += alloc.amount;
                } else {
                    portfolio.push({ id: alloc.id, name: alloc.name, balance: alloc.amount, cagr: alloc.cagr });
                }
            }
        });

        // Goal Withdrawals (Basic logic: deduct from portfolio proportionally or from specific item)
        // For now, we just deduct from the total balance for visualization
        goals.forEach(goal => {
            const yearsToGoal = parseFloat(goal.yearsToGoal) || 0;
            const goalYear = startYear + Math.round(yearsToGoal);
            
            if (year === goalYear) {
                const amount = parseFloat(goal.futureValue) || (parseFloat(goal.presentValue) * Math.pow(1 + (parseFloat(goal.inflationRate) || 6) / 100, yearsToGoal));
                yearData.withdrawals += amount;
                
                // Deduct from portfolio
                let remainingToDeduct = amount;
                // Deduct from most liquid/highest CAGR first? Let's just deduct proportionally for now
                const totalBalance = portfolio.reduce((sum, item) => sum + item.balance, 0);
                if (totalBalance > 0) {
                    portfolio.forEach(item => {
                        const ratio = item.balance / totalBalance;
                        const deduction = Math.min(item.balance, remainingToDeduct * ratio);
                        item.balance -= deduction;
                    });
                }
            }
        });

        yearData.closingBalance = portfolio.reduce((sum, item) => sum + item.balance, 0);
        yearData.details = [...portfolio.map(p => ({ ...p }))];
        projections.push(yearData);
    }

    return projections;
};
