import { Users, ArrowRightLeft, Wallet, Target, Folder } from 'lucide-react';
import React, { useState, useRef } from 'react';
import FolderCard from './FolderCard';
import BreakdownModal from './BreakdownModal';
import BreakdownSheet from './BreakdownSheet';
import SummaryComparisonBar from './SummaryComparisonBar';
import BreakdownIncome from './Forms/BreakdownIncome';
import BreakdownExpenses from './Forms/BreakdownExpenses';
import BreakdownDebt from './Forms/BreakdownDebt';
import BreakdownInsurance from './Forms/BreakdownInsurance';
import BreakdownSavings from './Forms/BreakdownSavings';
import BreakdownFamily from './Forms/BreakdownFamily';
import BreakdownAssets from './Forms/BreakdownAssets';
import BreakdownLiabilities from './Forms/BreakdownLiabilities';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { getHouseholdBreakdownTotal, sumConfiguredEmis } from '../DetailedFlow/expenseDetailSync';
import { getMemberDetailMonthlyTotal, shouldIncludeSpouseIncome } from '../DetailedFlow/incomeDetailSync';
import { getInsuranceMonthlyTotal } from '../DetailedFlow/insuranceDetailSync';
import { guessEmploymentTypeFromSummaryOccupation } from '../DetailedFlow/employmentTypeSync';
import { sumConfiguredSavings } from '../DetailedFlow/savingsDetailSync';
import { hasWealthDetailEntered, hasLiabilityDetailEntered, getTotalAssetBreakdownTotal, getTotalLiabilityBreakdownTotal } from '../DetailedFlow/wealthDetailSync';
import GoalsDashboard from './GoalsDashboard';
import SharedDocumentVault from '../InsuranceModule/SharedDocumentVault';
import './DetailedHub.css';

const DetailedHub = () => {
    const { 
        income, setIncome, 
        expenseCategories, setExpenseCategories, 
        familyMembers, setFamilyMembers, 
        policies, 
        assetCategories, setAssetCategories, 
        liabilityCategories, setLiabilityCategories, 
        hasEMI,
        savePlanData
    } = useFinancialPlan();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState(null);

    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [activeSubCategory, setActiveSubCategory] = useState(null);
    const snapshot = useRef(null);

    const selfMember = familyMembers.find(m => m.relation === 'Self') || {};
    const selfType = selfMember.employmentType || guessEmploymentTypeFromSummaryOccupation(selfMember.occupation) || 'Private Sector';
    const isIncomeCompleted = getMemberDetailMonthlyTotal(income.selfDetail || {}, selfType) > 0;
    
    const isExpensesCompleted = getHouseholdBreakdownTotal(expenseCategories, familyMembers) > 0;
    const isSavingsCompleted = sumConfiguredSavings(expenseCategories.savings || {}) > 0;
    const isDebtCompleted = sumConfiguredEmis(expenseCategories.emi || {}) > 0;
    const isInsuranceCompleted = getInsuranceMonthlyTotal(expenseCategories.insurance || {}) > 0;

    const moneyInOutCompleted = [
        isIncomeCompleted,
        isExpensesCompleted,
        isSavingsCompleted,
        isDebtCompleted,
        isInsuranceCompleted
    ].filter(Boolean).length;

    const isFamilyCompleted = familyMembers.some(m => m.dob || (m.name && m.name.trim() !== '') || m.employmentType);
    const isAssetsCompleted = hasWealthDetailEntered(assetCategories);
    const isLiabilitiesCompleted = hasLiabilityDetailEntered(liabilityCategories);
    
    const wealthCompleted = [isAssetsCompleted, isLiabilitiesCompleted].filter(Boolean).length;

    const completedStates = {
        income: isIncomeCompleted,
        expenses: isExpensesCompleted,
        savings: isSavingsCompleted,
        debt: isDebtCompleted,
        insurance: isInsuranceCompleted,
        'family-details': isFamilyCompleted,
        assets: isAssetsCompleted,
        liabilities: isLiabilitiesCompleted
    };

    // These counts will be calculated from Redux state later.
    const totalDetailed = moneyInOutCompleted + (isFamilyCompleted ? 1 : 0) + wealthCompleted;
    const totalPossible = 8; // 5 (Money) + 1 (Family) + 2 (Wealth)

    const handleOpenModal = (sectionId) => {
        setActiveCategory(sectionId);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setActiveCategory(null);
    };

    const handleOpenSheet = (subCategory) => {
        snapshot.current = {
            income: JSON.parse(JSON.stringify(income)),
            expenseCategories: JSON.parse(JSON.stringify(expenseCategories)),
            familyMembers: JSON.parse(JSON.stringify(familyMembers)),
            assetCategories: JSON.parse(JSON.stringify(assetCategories)),
            liabilityCategories: JSON.parse(JSON.stringify(liabilityCategories)),
        };
        setActiveSubCategory(subCategory);
        setIsSheetOpen(true);
    };

    const handleCancelSheet = () => {
        if (snapshot.current) {
            if (setIncome) setIncome(snapshot.current.income);
            if (setExpenseCategories) setExpenseCategories(snapshot.current.expenseCategories);
            if (setFamilyMembers) setFamilyMembers(snapshot.current.familyMembers);
            if (setAssetCategories) setAssetCategories(snapshot.current.assetCategories);
            if (setLiabilityCategories) setLiabilityCategories(snapshot.current.liabilityCategories);
        }
        setIsSheetOpen(false);
        setActiveSubCategory(null);
        snapshot.current = null;
    };

    const handleSaveSheet = () => {
        setIsSheetOpen(false);
        setActiveSubCategory(null);
        snapshot.current = null;
        if (savePlanData) {
            savePlanData().catch(console.error);
        }
    };

    const handleOpenVault = () => {
        handleOpenSheet('vault');
    };

    const renderSheetContent = () => {
        let summaryTotal = 0;
        let breakdownTotal = 0;
        let content = null;

        switch (activeSubCategory) {
            case 'income': {
                summaryTotal = parseFloat(income.summarySelfInHand) || parseFloat(income.self) || 0;
                let bdTotal = 0;
                
                const selfMember = familyMembers.find(m => m.relation === 'Self') || {};
                const selfType = selfMember.employmentType || guessEmploymentTypeFromSummaryOccupation(selfMember.occupation) || 'Private Sector';
                bdTotal += getMemberDetailMonthlyTotal(income.selfDetail || {}, selfType);

                const spouseMember = familyMembers.find(m => m.relation === 'Spouse');
                if (shouldIncludeSpouseIncome(spouseMember, income.hasSpouseIncome, income)) {
                    const spouseType = spouseMember?.employmentType || guessEmploymentTypeFromSummaryOccupation(spouseMember?.occupation) || 'Private Sector';
                    summaryTotal += parseFloat(income.summarySpouseInHand) || parseFloat(income.spouse) || 0;
                    bdTotal += getMemberDetailMonthlyTotal(income.spouseDetail || {}, spouseType);
                }
                
                breakdownTotal = bdTotal;
                content = <BreakdownIncome />;
                break;
            }
            case 'expenses': {
                summaryTotal = parseFloat(expenseCategories.summaryHouseholdTotal) || 0;
                breakdownTotal = getHouseholdBreakdownTotal(expenseCategories, familyMembers);
                content = <BreakdownExpenses />;
                break;
            }
            case 'debt': {
                summaryTotal = parseFloat(expenseCategories.summaryEmiTotal) || 0;
                breakdownTotal = sumConfiguredEmis(expenseCategories.emi || {});
                content = <BreakdownDebt />;
                break;
            }
            case 'insurance': {
                summaryTotal = parseFloat(expenseCategories.summaryInsuranceTotal) || 0;
                breakdownTotal = getInsuranceMonthlyTotal(expenseCategories.insurance || {});
                content = <BreakdownInsurance />;
                break;
            }
            case 'savings': {
                summaryTotal = (parseFloat(expenseCategories.summaryMonthlyInvestments) || 0) + (parseFloat(expenseCategories.summaryOtherSavings) || 0);
                breakdownTotal = sumConfiguredSavings(expenseCategories.savings || {});
                content = <BreakdownSavings />;
                break;
            }
            case 'family-details': {
                content = <BreakdownFamily />;
                break;
            }
            case 'assets': {
                summaryTotal = (parseFloat(assetCategories.summaryPortfolioValue) || 0) + (parseFloat(assetCategories.summaryLiquidCash) || 0) + (parseFloat(assetCategories.summaryRealEstateAssets) || 0);
                breakdownTotal = getTotalAssetBreakdownTotal(assetCategories);
                content = <BreakdownAssets />;
                break;
            }
            case 'liabilities': {
                summaryTotal = (parseFloat(liabilityCategories.summaryOutstandingLoans) || 0) + (parseFloat(liabilityCategories.summaryCreditCardDues) || 0) + (parseFloat(liabilityCategories.summaryOtherPayables) || 0);
                breakdownTotal = getTotalLiabilityBreakdownTotal(liabilityCategories, hasEMI);
                content = <BreakdownLiabilities />;
                break;
            }
            case 'vault': {
                content = <SharedDocumentVault />;
                break;
            }
            default:
                break;
        }

        return content;
    };

    const renderHeaderComponent = () => {
        if (!['income', 'expenses', 'debt', 'insurance', 'savings', 'assets', 'liabilities'].includes(activeSubCategory)) {
            const title = activeSubCategory === 'vault' ? 'Document Vault' : `Break down ${activeSubCategory?.replace('-', ' ') || ''}`;
            const subtitle = activeSubCategory === 'vault' ? 'Safely upload and store your documents here' : 'Provide specific line items';
            return (
                <div>
                    <h2 className="breakdown-sheet-title" style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#111', textTransform: 'capitalize' }}>
                        {title}
                    </h2>
                    <p className="breakdown-sheet-subtitle" style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                        {subtitle}
                    </p>
                </div>
            );
        }

        let summaryTotal = 0;
        let breakdownTotal = 0;

        switch (activeSubCategory) {
            case 'income': {
                summaryTotal = parseFloat(income.summarySelfInHand) || parseFloat(income.self) || 0;
                let bdTotal = 0;
                
                const selfMember = familyMembers.find(m => m.relation === 'Self') || {};
                const selfType = selfMember.employmentType || guessEmploymentTypeFromSummaryOccupation(selfMember.occupation) || 'Private Sector';
                bdTotal += getMemberDetailMonthlyTotal(income.selfDetail || {}, selfType);

                const spouseMember = familyMembers.find(m => m.relation === 'Spouse');
                if (shouldIncludeSpouseIncome(spouseMember, income.hasSpouseIncome, income)) {
                    const spouseType = spouseMember?.employmentType || guessEmploymentTypeFromSummaryOccupation(spouseMember?.occupation) || 'Private Sector';
                    summaryTotal += parseFloat(income.summarySpouseInHand) || parseFloat(income.spouse) || 0;
                    bdTotal += getMemberDetailMonthlyTotal(income.spouseDetail || {}, spouseType);
                }
                breakdownTotal = bdTotal;
                break;
            }
            case 'expenses':
                summaryTotal = parseFloat(expenseCategories.summaryHouseholdTotal) || 0;
                breakdownTotal = getHouseholdBreakdownTotal(expenseCategories);
                break;
            case 'debt':
                summaryTotal = parseFloat(expenseCategories.summaryEmiTotal) || 0;
                breakdownTotal = sumConfiguredEmis(expenseCategories.emi || {});
                break;
            case 'insurance':
                summaryTotal = parseFloat(expenseCategories.summaryInsuranceTotal) || 0;
                breakdownTotal = getInsuranceMonthlyTotal(expenseCategories.insurance || {});
                break;
            case 'savings':
                summaryTotal = (parseFloat(expenseCategories.summaryMonthlyInvestments) || 0) + (parseFloat(expenseCategories.summaryOtherSavings) || 0);
                breakdownTotal = sumConfiguredSavings(expenseCategories.savings || {});
                break;
            case 'assets':
                summaryTotal = (parseFloat(assetCategories.summaryPortfolioValue) || 0) + (parseFloat(assetCategories.summaryLiquidCash) || 0) + (parseFloat(assetCategories.summaryRealEstateAssets) || 0);
                breakdownTotal = getTotalAssetBreakdownTotal(assetCategories);
                break;
            case 'liabilities':
                summaryTotal = (parseFloat(liabilityCategories.summaryOutstandingLoans) || 0) + (parseFloat(liabilityCategories.summaryCreditCardDues) || 0) + (parseFloat(liabilityCategories.summaryOtherPayables) || 0);
                breakdownTotal = getTotalLiabilityBreakdownTotal(liabilityCategories, hasEMI);
                break;
            default:
                break;
        }

        return (
            <SummaryComparisonBar 
                summaryTotal={Math.round(summaryTotal)} 
                breakdownTotal={Math.round(breakdownTotal)} 
                formatInr={(val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(val || 0))} 
            />
        );
    };

    return (
        <div className="detailed-hub-container">
            <header className="hub-header" style={{ borderBottom: '2px solid #eaeaea', paddingBottom: '1rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.75rem', fontWeight: 700, color: '#111' }}>
                            Your financial profile
                        </h1>
                        <p style={{ margin: 0, color: '#666', fontSize: '1rem' }}>
                            Add a breakdown to each category at your own pace for a more accurate plan.
                        </p>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#555', fontWeight: 600 }}>
                        {totalDetailed} / {totalPossible} detailed
                    </div>
                </div>
            </header>

            <div className="hub-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
                gap: '1.5rem' 
            }}>
                <FolderCard 
                    id="family"
                    title="Family Info" 
                    description="Personal info and family details"
                    icon={<Users size={20} />}
                    completedCount={isFamilyCompleted ? 1 : 0}
                    totalCount={1}
                    onClick={() => handleOpenModal('family')}
                />

                <FolderCard 
                    id="money-in-out"
                    title="Money In & Money Out" 
                    description="Income, expenses, savings, EMIs and insurance"
                    icon={<ArrowRightLeft size={20} />}
                    completedCount={moneyInOutCompleted}
                    totalCount={5}
                    onClick={() => handleOpenModal('money')}
                />

                <FolderCard 
                    id="wealth"
                    title="My Wealth Snapshot" 
                    description="Assets and Liabilities"
                    icon={<Wallet size={20} />}
                    completedCount={wealthCompleted}
                    totalCount={2}
                    onClick={() => handleOpenModal('wealth')}
                />

                <FolderCard 
                    id="vault"
                    title="Document Vault" 
                    description="Upload Life, Health and Motor Insurance policies or other documents."
                    icon={<Folder size={20} />}
                    completedCount={0}
                    isVault={true}
                    onClick={handleOpenVault}
                />
            </div>
            
            <GoalsDashboard />
            


            <BreakdownModal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                activeCategory={activeCategory} 
                onOpenSheet={handleOpenSheet}
                completedStates={completedStates}
            />

            <BreakdownSheet
                isOpen={isSheetOpen}
                onClose={handleCancelSheet}
                headerComponent={renderHeaderComponent()}
                onSkip={handleCancelSheet}
                onSave={handleSaveSheet}
            >
                {renderSheetContent()}
            </BreakdownSheet>
        </div>
    );
};

export default DetailedHub;
