import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { createFinancialPlan, getActivePlan, updateFinancialPlan, markSummaryReportGenerated } from '../services/financialPlanService';
import { generateProjections } from '../components/JourneyModule/ProjectionLogic';
import { normalizeIncomeState } from '../components/DetailedFlow/incomeDetailSync';
import { initializeExpenseSnapshots, hasAnyEmiCommitment } from '../components/DetailedFlow/expenseDetailSync';
import { initializeSavingsSnapshots } from '../components/DetailedFlow/savingsDetailSync';
import { migrateInsuranceBlock } from '../components/DetailedFlow/insuranceDetailSync';

const FinancialPlanContext = createContext();

export const useFinancialPlan = () => {
  const context = useContext(FinancialPlanContext);
  if (!context) {
    throw new Error('useFinancialPlan must be used within a FinancialPlanProvider');
  }
  return context;
};

export const FinancialPlanProvider = ({ children }) => {
  const { user } = useAuth();
  
  // Supabase plan ID & sync state
  const [planId, setPlanId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [planSyncError, setPlanSyncError] = useState(null);
  const [planReloadToken, setPlanReloadToken] = useState(0);

  // Keep step tracking in context? Yes, it's easier to access from nested components that have explicit Back/Next buttons, but for now we'll keep it there if needed. Actually it's probably better to keep navigation state in App.jsx or move it to a NavigationContext later. Let's keep data state here, and we can also move currentStep/maxStep here to avoid prop drilling on every module.
  const [currentStep, setCurrentStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [insuranceMode, setInsuranceMode] = useState(null);
  const [planStartMonth, setPlanStartMonth] = useState(new Date().getMonth());

  // Data States
  const [familyMembers, setFamilyMembers] = useState([{
    name: '', dob: '', occupation: 'Salaried', retirementAge: 60, relation: 'Self', natureOfBusiness: '', organizationName: '', educationalQualification: '', mobile: ''
  }]);

  const [income, setIncome] = useState(() => normalizeIncomeState({}));

  const [expenseCategories, setExpenseCategories] = useState({
    household: { grocery: '', rent: '', education: '', lifestyle: '', medical: '', travel: '' },
    emi: { personalLoan: '', homeLoan: '', educationLoan: '', carLoan: '', twoWheelerLoan: '', otherEmi: '' },
    insurance: { health: { value: '', frequency: 'Annual' }, car: { value: '', frequency: 'Annual' }, bike: { value: '', frequency: 'Annual' }, life: {}, others: { value: '', frequency: 'Annual' }, policyDocs: {} },
    savings: { sip: '', ppf: '', nps: '', rd: '', otherSaving: '' },
    summaryMonthlyInvestments: '',
    summaryOtherSavings: '',
  });

  const [assetCategories, setAssetCategories] = useState({
    summaryPortfolioValue: '', summaryLiquidCash: '', summaryRealEstateAssets: '',
    realEstate: { residential: '', secondProperty: '', landPlot: '' }, vehicles: { idv: '' }, valuables: { gold: '', art: '' }, cash: { savings: '', cashInHand: '' }, investments: { equity: '', mutualFunds: '', fixedDeposit: '', recurringDeposit: '' }, insurance: { savingPlans: '', ulip: '' }, retirement: { epf: '', ppf: '', nps: '' }, others: { other: '' }, custom: []
  });

  const [liabilityCategories, setLiabilityCategories] = useState({
    summaryOutstandingLoans: '', summaryCreditCardDues: '', summaryOtherPayables: '',
    loans: { home: '', personal: '', car: '', education: '', otherEmis: '', creditCard: '' }, custom: []
  });

  const [goals, setGoals] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [contingencyFund, setContingencyFund] = useState('');
  const [hasEMI, setHasEMI] = useState(false);
  const [hasSpouseIncome, setHasSpouseIncome] = useState(false);
  const [hasLifeInsurance, setHasLifeInsurance] = useState(null);
  const [hasHealthInsurance, setHasHealthInsurance] = useState(null);
  const [summaryLifeCover, setSummaryLifeCover] = useState('');
  const [summaryHealthCover, setSummaryHealthCover] = useState('');
  const [summaryReportGeneratedAt, setSummaryReportGeneratedAt] = useState(null);

  const [inflationRates, setInflationRates] = useState({
    incomeIncrement: 10, householdInflation: 6, educationInflation: 8
  });

  const [journeyAdjustments, setJourneyAdjustments] = useState([]);
  const [investmentAllocations, setInvestmentAllocations] = useState([]);
  const [loanProposals, setLoanProposals] = useState([]);
  const [allocationPlans, setAllocationPlans] = useState({});
  const [goalMappings, setGoalMappings] = useState({});

  const [calculatorInputs, setCalculatorInputs] = useState({
    personal_loan: { amount: 0, rate: 10.5, tenure: 5, events: [] },
    home_loan: { amount: 0, rate: 8.5, tenure: 15, events: [] },
    car_loan: { amount: 0, rate: 9.5, tenure: 5, events: [] },
    two_wheeler_loan: { amount: 0, rate: 11.5, tenure: 3, events: [] },
    edu_loan: { amount: 0, rate: 9.0, tenure: 7, events: [] },
    lumpsum: { amount: 0, rate: 12, tenure: 10, events: [] },
    swp: { amount: 0, withdrawal: 0, rate: 10, tenure: 15, events: [] },
    sip: { amount: 0, rate: 12, tenure: 10, increments: [] },
    ppf: { rate: 7.10 },
    nps: { rate: 10.00, annuity: 40, annuityRate: 6.00 },
    fd: { rate: 7.00, frequency: 'Quarterly' },
    rd: { rate: 7.00 },
    equity: {}
  });

  const [currentYearLedger, setCurrentYearLedger] = useState({
    income: Array(12).fill(0), household: Array(12).fill(0)
  });
  const [cashFlowSubStep, setCashFlowSubStep] = useState(1);

  // Active State Cleanup for Phantom Spouse Income
  useEffect(() => {
    const spouseMember = familyMembers.find(m => m.relation?.toLowerCase() === 'spouse');
    const isSpouseHousewife = spouseMember?.occupation?.toLowerCase() === 'housewife';
    
    if (!spouseMember || isSpouseHousewife) {
      setIncome(prev => {
        if (prev.spouse || prev.spouseBonus || prev.spousePassive || prev.spouseOther) {
          return { ...prev, spouse: '', spouseBonus: '', spousePassive: '', spouseOther: '' };
        }
        return prev;
      });
    }
  }, [familyMembers]);

  const resetState = () => {
    setPlanId(null);
    setCurrentStep(1);
    setMaxStep(1);
    setInsuranceMode(null);
    setPlanStartMonth(new Date().getMonth());
    setSaving(false);
    setFamilyMembers([{ name: '', dob: '', occupation: 'Salaried', retirementAge: 60, relation: 'Self', natureOfBusiness: '', organizationName: '', educationalQualification: '', mobile: '' }]);
    setIncome(normalizeIncomeState({}));
    setExpenseCategories({
      household: { grocery: '', rent: '', education: '', lifestyle: '', medical: '', travel: '' },
      emi: { personalLoan: '', homeLoan: '', educationLoan: '', carLoan: '', twoWheelerLoan: '', otherEmi: '' },
      insurance: { health: { value: '', frequency: 'Annual' }, car: { value: '', frequency: 'Annual' }, bike: { value: '', frequency: 'Annual' }, life: {}, others: { value: '', frequency: 'Annual' }, policyDocs: {} },
      savings: { sip: '', ppf: '', nps: '', rd: '', otherSaving: '' },
      summaryMonthlyInvestments: '',
      summaryOtherSavings: '',
    });
    setAssetCategories({
      summaryPortfolioValue: '', summaryLiquidCash: '', summaryRealEstateAssets: '',
      realEstate: { residential: '', secondProperty: '', landPlot: '' }, vehicles: { idv: '' }, valuables: { gold: '', art: '' }, cash: { savings: '', cashInHand: '' }, investments: { equity: '', mutualFunds: '', fixedDeposit: '', recurringDeposit: '' }, insurance: { savingPlans: '', ulip: '' }, retirement: { epf: '', ppf: '', nps: '' }, others: { other: '' }, custom: []
    });
    setLiabilityCategories({
      summaryOutstandingLoans: '', summaryCreditCardDues: '', summaryOtherPayables: '',
      loans: { home: '', personal: '', car: '', education: '', otherEmis: '', creditCard: '' }, custom: []
    });
    setGoals([]);
    setPolicies([]);
    setContingencyFund('');
    setHasLifeInsurance(null);
    setHasHealthInsurance(null);
    setSummaryLifeCover('');
    setSummaryHealthCover('');
    setSummaryReportGeneratedAt(null);
    setInflationRates({ incomeIncrement: 10, householdInflation: 6, educationInflation: 8 });
    setJourneyAdjustments([]);
    setInvestmentAllocations([]);
    setLoanProposals([]);
    setAllocationPlans({});
    setGoalMappings({});
    setCalculatorInputs({
      personal_loan: { amount: 0, rate: 10.5, tenure: 5, events: [] }, home_loan: { amount: 0, rate: 8.5, tenure: 15, events: [] }, car_loan: { amount: 0, rate: 9.5, tenure: 5, events: [] }, two_wheeler_loan: { amount: 0, rate: 11.5, tenure: 3, events: [] }, edu_loan: { amount: 0, rate: 9.0, tenure: 7, events: [] }, lumpsum: { amount: 0, rate: 12, tenure: 10, events: [] }, swp: { amount: 0, withdrawal: 0, rate: 10, tenure: 15, events: [] }, sip: { amount: 0, rate: 12, tenure: 10, increments: [] }, ppf: { rate: 7.10 }, nps: { rate: 10.00, annuity: 40, annuityRate: 6.00 }, fd: { rate: 7.00, frequency: 'Quarterly' }, rd: { rate: 7.00 }, equity: {}
    });
    setCurrentYearLedger({ income: Array(12).fill(0), household: Array(12).fill(0) });
    setCashFlowSubStep(1);
    setPlanSyncError(null);
  };

  useEffect(() => {
    const loadPlan = async () => {
      resetState();
      if (!user) { setLoading(false); return; }
      setLoading(true);
      const { data, error } = await getActivePlan();

      if (error) {
        console.error('Error loading plan from Supabase:', error);
        const retry = await createFinancialPlan();
        if (retry.data) {
          setPlanSyncError(null); setPlanId(retry.data.id); setCurrentStep(retry.data.current_step || 1); setMaxStep(retry.data.current_step || 1);
          setFamilyMembers(retry.data.family_members?.length > 0 ? retry.data.family_members.map(m => ({ ...m, mobile: m.mobile || '' })) : [{ name: '', dob: '', occupation: 'Salaried', retirementAge: 60, relation: 'Self', mobile: '' }]);
          setLoading(false); return;
        }
        const msg = typeof error?.message === 'string' ? error.message : error?.code ? `${error.code}: ${error.message || error.details || ''}` : String(error);
        setPlanSyncError(`${msg}. Retry failed.`);
        setLoading(false); return;
      }

      setPlanSyncError(null);
      if (data) {
        setPlanId(data.id);
        
        const initializeMaxStep = async () => {
          try {
             const stored = await Promise.resolve(localStorage.getItem(`max_step_${data.id}`));
             let newMax = data.current_step || 1;
             if (stored) newMax = Math.max(parseInt(stored, 10), newMax);
             setMaxStep(newMax);
             await Promise.resolve(localStorage.setItem(`max_step_${data.id}`, newMax.toString()));
          } catch(e) { setMaxStep(data.current_step || 1); }
        };
        initializeMaxStep();

        setCurrentStep(data.current_step || 1);
        setInsuranceMode(data.insurance_mode || null);
        let rawPlanStartMonth = data.plan_start_month;
        let derivedPlanStartMonth = (rawPlanStartMonth !== undefined && rawPlanStartMonth !== null) ? parseInt(rawPlanStartMonth, 10) : null;
        let finalMonth = (derivedPlanStartMonth !== null && !isNaN(derivedPlanStartMonth)) ? derivedPlanStartMonth : new Date().getMonth();

        if (finalMonth === 0) {
            let trueMonth = null;
            if (data.current_year_ledger?.income) {
                const firstActive = data.current_year_ledger.income.findIndex(val => Number(val) > 0);
                if (firstActive > 0) trueMonth = firstActive;
            }
            if (trueMonth === null) {
                const extractMonth = (dateVal) => {
                     if (!dateVal) return null;
                     let normalized = dateVal;
                     if (typeof dateVal === 'string' && !/^\d+$/.test(dateVal)) normalized = dateVal.replace(' ', 'T');
                     else if (typeof dateVal === 'string' && /^\d+$/.test(dateVal)) normalized = parseInt(dateVal, 10);
                     const mt = new Date(normalized).getMonth(); return isNaN(mt) ? null : mt;
                };
                trueMonth = extractMonth(user?.created_at) ?? extractMonth(data.created_at) ?? extractMonth(data.updated_at);
            }
            if (trueMonth !== null && trueMonth !== 0) finalMonth = trueMonth;
            else if (new Date().getMonth() !== 0) finalMonth = new Date().getMonth();
        }
        if (isNaN(finalMonth)) finalMonth = new Date().getMonth();
        setPlanStartMonth(finalMonth);

        setFamilyMembers(data.family_members?.length > 0 ? data.family_members.map(m => ({ ...m, mobile: m.mobile || '' })) : [{ name: '', dob: '', occupation: 'Salaried', retirementAge: 60, relation: 'Self', mobile: '' }]);
        
        const loadedIncome = data.income || {};
        setIncome(normalizeIncomeState(loadedIncome));
        setHasSpouseIncome(!!(loadedIncome.spouse && Number(loadedIncome.spouse) > 0));

        const loadedExpenseCategories = data.expense_categories || {};
        const emiObj = loadedExpenseCategories.emi || {};
        setHasEMI(hasAnyEmiCommitment({
            ...loadedExpenseCategories,
            emi: emiObj,
        }));
        const loadedInsurance = loadedExpenseCategories.insurance || {};
        let migratedLife = {};
        const selfMember = (data.family_members || []).find(m => m.relation === 'Self') || { name: '', relation: 'Self' };
        const selfKey = selfMember.name || selfMember.relation;

        if (loadedInsurance.life && typeof loadedInsurance.life === 'object' && 'value' in loadedInsurance.life) {
            const hasMembers = Object.keys(loadedInsurance.life).some(k => k !== 'value' && k !== 'frequency');
            if (hasMembers) { migratedLife = { ...loadedInsurance.life }; delete migratedLife.value; delete migratedLife.frequency; } 
            else migratedLife = { [selfKey]: { value: loadedInsurance.life.value, frequency: loadedInsurance.life.frequency || 'Annual' } };
        } else if (loadedInsurance.life) {
            migratedLife = { ...loadedInsurance.life };
            if (selfMember.name && migratedLife['Self']) {
                if (!migratedLife[selfMember.name]) migratedLife[selfMember.name] = migratedLife['Self'];
                delete migratedLife['Self'];
            }
        }

        setExpenseCategories(initializeSavingsSnapshots(initializeExpenseSnapshots({
          household: { grocery: '', rent: '', education: '', lifestyle: '', medical: '', travel: '', ...(loadedExpenseCategories.household || {}) },
          emi: { 
            personalLoan: loadedExpenseCategories.emi?.personalLoan ?? '', homeLoan: loadedExpenseCategories.emi?.homeLoan ?? '', educationLoan: loadedExpenseCategories.emi?.educationLoan ?? '', carLoan: loadedExpenseCategories.emi?.carLoan ?? '', twoWheelerLoan: loadedExpenseCategories.emi?.twoWheelerLoan ?? '', otherEmi: loadedExpenseCategories.emi?.otherEmi ?? '', otherEmiName: loadedExpenseCategories.emi?.otherEmiName ?? '',
          },
          insurance: migrateInsuranceBlock({
            health: loadedInsurance.health || { value: loadedExpenseCategories.emi?.healthInsurance || '', frequency: 'Annual' },
            car: loadedInsurance.car || { value: loadedExpenseCategories.emi?.carInsurance || '', frequency: 'Annual' },
            bike: loadedInsurance.bike || { value: loadedExpenseCategories.emi?.bikeInsurance || '', frequency: 'Annual' },
            life: migratedLife,
            others: loadedInsurance.others || { value: loadedExpenseCategories.emi?.otherInsurance || '', frequency: 'Annual' },
            policyDocs: loadedInsurance.policyDocs || {},
          }),
          savings: { 
            ppf: '', nps: '', rd: '', otherSaving: '', ...(loadedExpenseCategories.savings || {}), sip: loadedExpenseCategories.savings?.sip || loadedExpenseCategories.savings?.mfSip || ''
          },
          summaryHouseholdTotal: loadedExpenseCategories.summaryHouseholdTotal ?? '',
          summaryEmiTotal: loadedExpenseCategories.summaryEmiTotal ?? '',
          summaryMonthlyInvestments: loadedExpenseCategories.summaryMonthlyInvestments ?? '',
          summaryOtherSavings: loadedExpenseCategories.summaryOtherSavings ?? '',
        })));

        const defaultAssetCategories = { summaryPortfolioValue: '', summaryLiquidCash: '', summaryRealEstateAssets: '', realEstate: { residential: '', secondProperty: '', landPlot: '' }, vehicles: { idv: '' }, valuables: { gold: '', art: '' }, cash: { savings: '', cashInHand: '' }, investments: { equity: '', mutualFunds: '', fixedDeposit: '', recurringDeposit: '' }, insurance: { savingPlans: '', ulip: '' }, retirement: { epf: '', ppf: '', nps: '' }, others: { other: '' }, custom: [] };
        const loadedAssetCategories = data.asset_categories || {};
        setAssetCategories({
          ...defaultAssetCategories,
          summaryPortfolioValue: loadedAssetCategories.summaryPortfolioValue ?? '',
          summaryLiquidCash: loadedAssetCategories.summaryLiquidCash ?? '',
          summaryRealEstateAssets: loadedAssetCategories.summaryRealEstateAssets ?? '',
          realEstate: { ...defaultAssetCategories.realEstate, ...(loadedAssetCategories.realEstate || {}), residential: loadedAssetCategories.realEstate?.residential || loadedAssetCategories.realEstate?.residence || '', secondProperty: loadedAssetCategories.realEstate?.secondProperty || loadedAssetCategories.realEstate?.investmentProp || '' },
          vehicles: { ...defaultAssetCategories.vehicles, ...(loadedAssetCategories.vehicles || {}) },
          valuables: { ...defaultAssetCategories.valuables, ...(loadedAssetCategories.valuables || {}), gold: loadedAssetCategories.valuables?.gold || loadedAssetCategories.others?.gold || '' },
          cash: { ...defaultAssetCategories.cash, ...(loadedAssetCategories.cash || {}) },
          investments: { ...defaultAssetCategories.investments, ...(loadedAssetCategories.investments || {}), equity: loadedAssetCategories.investments?.equity || loadedAssetCategories.equity?.stocks || '', mutualFunds: loadedAssetCategories.investments?.mutualFunds || loadedAssetCategories.equity?.mfEquity || '', fixedDeposit: loadedAssetCategories.investments?.fixedDeposit || loadedAssetCategories.debt?.fd || '' },
          insurance: { ...defaultAssetCategories.insurance, ...(loadedAssetCategories.insurance || {}) },
          retirement: { ...defaultAssetCategories.retirement, ...(loadedAssetCategories.retirement || {}), ppf: loadedAssetCategories.retirement?.ppf || loadedAssetCategories.debt?.ppf || '' },
          others: { ...defaultAssetCategories.others, ...(loadedAssetCategories.others || {}), other: loadedAssetCategories.others?.other || loadedAssetCategories.others?.others || '' },
          custom: Array.isArray(loadedAssetCategories.custom) ? loadedAssetCategories.custom : []
        });

        const loadedLiabilityCategories = data.liability_categories || {};
        setLiabilityCategories({
          summaryOutstandingLoans: loadedLiabilityCategories.summaryOutstandingLoans ?? '',
          summaryCreditCardDues: loadedLiabilityCategories.summaryCreditCardDues ?? '',
          summaryOtherPayables: loadedLiabilityCategories.summaryOtherPayables ?? '',
          loans: { home: loadedLiabilityCategories.loans?.home || '', personal: loadedLiabilityCategories.loans?.personal || '', car: loadedLiabilityCategories.loans?.car || '', education: loadedLiabilityCategories.loans?.education || '', otherEmis: loadedLiabilityCategories.loans?.otherEmis || loadedLiabilityCategories.loans?.other || '', creditCard: loadedLiabilityCategories.loans?.creditCard || '' },
          custom: Array.isArray(loadedLiabilityCategories.custom) ? loadedLiabilityCategories.custom : []
        });

        setGoals(data.goals || []);
        setPolicies(data.policies || []);
        setContingencyFund(data.contingency_fund || '');
        setHasLifeInsurance(data.has_life_insurance ?? null);
        setHasHealthInsurance(data.has_health_insurance ?? null);
        setSummaryLifeCover(data.summary_life_cover || '');
        setSummaryHealthCover(data.summary_health_cover || '');
        setSummaryReportGeneratedAt(data.summary_report_generated_at || null);
        setInflationRates(data.inflation_rates || { incomeIncrement: 10, householdInflation: 6, educationInflation: 8 });
        setJourneyAdjustments(data.journey_adjustments || []);
        setInvestmentAllocations(data.investment_allocations || []);
        setLoanProposals(data.loan_proposals || []);
        setAllocationPlans(data.allocation_plans || {});
        
        let loadedMappings = data.goal_mappings || {};
        Object.keys(loadedMappings).forEach(goalId => {
            if (Array.isArray(loadedMappings[goalId])) {
                const legacyArray = loadedMappings[goalId];
                const newDict = {};
                legacyArray.forEach(sourceName => { newDict[sourceName] = 0; });
                loadedMappings[goalId] = newDict;
            }
        });
        setGoalMappings(loadedMappings);

        if (data.calculator_inputs) setCalculatorInputs(data.calculator_inputs);
        setCurrentYearLedger(data.current_year_ledger || { income: Array(12).fill(0), household: Array(12).fill(0) });
      }
      setLoading(false);
    };

    loadPlan();
  }, [user, planReloadToken]);

  const savePlanData = async () => {
    if (!planId) return;
    try {
      const payload = {
        current_step: currentStep,
        family_members: familyMembers,
        income,
        expense_categories: expenseCategories,
        asset_categories: assetCategories,
        liability_categories: liabilityCategories,
        goals,
        policies,
        contingency_fund: parseFloat(contingencyFund) || 0,
        has_life_insurance: hasLifeInsurance,
        has_health_insurance: hasHealthInsurance,
        summary_life_cover: (summaryLifeCover !== '' && summaryLifeCover !== null && summaryLifeCover !== undefined) ? parseFloat(summaryLifeCover) : null,
        summary_health_cover: (summaryHealthCover !== '' && summaryHealthCover !== null && summaryHealthCover !== undefined) ? parseFloat(summaryHealthCover) : null,
        summary_report_generated_at: summaryReportGeneratedAt || null,
        inflation_rates: inflationRates,
        journey_adjustments: journeyAdjustments,
        investment_allocations: investmentAllocations,
        loan_proposals: loanProposals,
        allocation_plans: allocationPlans,
        goal_mappings: goalMappings,
        insurance_mode: insuranceMode,
        calculator_inputs: calculatorInputs,
        current_year_ledger: currentYearLedger,
        plan_start_month: planStartMonth
      };
      
      const { error } = await updateFinancialPlan(planId, payload);
      
      if (error) {
        console.warn('Save failed, trying fallback without summary insurance columns:', error);
        const fallbackPayload = { ...payload };
        delete fallbackPayload.has_life_insurance;
        delete fallbackPayload.has_health_insurance;
        delete fallbackPayload.summary_life_cover;
        delete fallbackPayload.summary_health_cover;
        
        const { error: fallbackError } = await updateFinancialPlan(planId, fallbackPayload);
        if (fallbackError) {
          console.error('Fallback save also failed:', fallbackError);
        }
      }
    } catch (err) {
      console.error('Save crashed:', err);
    }
  };

  useEffect(() => {
    if (!planId || loading) return;
    setSaving(true);
    const timeoutId = setTimeout(async () => {
      await savePlanData();
      setSaving(false);
      setLastSaved(new Date());
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [planId, loading, currentStep, familyMembers, income, expenseCategories, assetCategories, liabilityCategories, goals, policies, contingencyFund, hasLifeInsurance, hasHealthInsurance, summaryLifeCover, summaryHealthCover, summaryReportGeneratedAt, inflationRates, journeyAdjustments, investmentAllocations, loanProposals, allocationPlans, goalMappings, insuranceMode, calculatorInputs, currentYearLedger, planStartMonth]);

  const markReportGenerated = useCallback(async () => {
    const now = new Date().toISOString();
    setSummaryReportGeneratedAt(now);
    if (planId) {
      const { error } = await markSummaryReportGenerated(planId);
      if (error) console.error('Failed to persist summary report generated timestamp:', error);
    }
  }, [planId]);

  const expandedGoals = useMemo(() => {
    let result = [];
    goals.forEach(g => {
        let duration = Math.max(1, parseInt(g.courseDuration) || 1);
        if (duration > 1) {
             const totalFutureValue = parseFloat(g.futureValue) || (parseFloat(g.presentValue) * Math.pow(1 + (parseFloat(g.inflationRate) || 8) / 100, parseFloat(g.yearsToGoal) || 0));
             const perYearFutureValue = totalFutureValue / duration;
             for (let i = 0; i < duration; i++) {
                 result.push({ ...g, id: `${g.id}_yr${i+1}`, name: `${g.name || g.placeholder} - Year ${i+1}`, yearsToGoal: parseFloat(g.yearsToGoal) + i, futureValue: perYearFutureValue, presentValue: 0, courseDuration: 1 });
             }
        } else { result.push({ ...g, courseDuration: 1 }); }
    });
    return result;
  }, [goals]);

  const journeyProjections = useMemo(() => {
    if (!familyMembers.find(m => m.relation?.toLowerCase() === 'self')) return [];
    return generateProjections({ familyMembers, income, expenseCategories, goals: goals, inflationRates, journeyAdjustments, investmentAllocations, loanProposals, policies, planStartMonth, currentYearLedger });
  }, [familyMembers, income, expenseCategories, goals, inflationRates, journeyAdjustments, investmentAllocations, loanProposals, policies, planStartMonth, currentYearLedger]);

  const proposedSIPs = useMemo(() => investmentAllocations.filter(a => a.type === 'SIP'), [investmentAllocations]);
  const proposedLumpsums = useMemo(() => investmentAllocations.filter(a => a.type === 'Lumpsum' || a.type === 'Lump Sum'), [investmentAllocations]);
  const proposedEquities = useMemo(() => investmentAllocations.filter(a => a.type === 'Direct Equity & ETFs'), [investmentAllocations]);

  const updateCalculatorData = (calculatorKey) => (val) => {
    setCalculatorInputs(prev => ({ ...prev, [calculatorKey]: val }));
  };

  const handleStepProgression = async (nextStep) => {
    setCurrentStep(nextStep);
    try {
      const storedMax = await Promise.resolve(localStorage.getItem(`max_step_${planId}`));
      const currentMax = storedMax ? parseInt(storedMax, 10) : 1;
      const newMax = Math.max(currentMax, maxStep, nextStep);
      setMaxStep(newMax);
      await Promise.resolve(localStorage.setItem(`max_step_${planId}`, newMax.toString()));
    } catch (e) { console.warn("Async storage saving failed", e); }
    window.scrollTo(0, 0);
  };

  const handleLogoutCleanup = () => {
      resetState();
  };

  return (
    <FinancialPlanContext.Provider value={{
      planId, loading, saving, lastSaved, planSyncError, planReloadToken, setPlanReloadToken,
      currentStep, setCurrentStep, maxStep, setMaxStep, handleStepProgression,
      insuranceMode, setInsuranceMode, planStartMonth, setPlanStartMonth,
      familyMembers, setFamilyMembers,
      income, setIncome,
      expenseCategories, setExpenseCategories,
      assetCategories, setAssetCategories,
      liabilityCategories, setLiabilityCategories,
      goals, setGoals, expandedGoals,
      policies, setPolicies,
      contingencyFund, setContingencyFund,
      inflationRates, setInflationRates,
      journeyAdjustments, setJourneyAdjustments,
      investmentAllocations, setInvestmentAllocations,
      loanProposals, setLoanProposals,
      allocationPlans, setAllocationPlans,
      goalMappings, setGoalMappings,
      calculatorInputs, setCalculatorInputs, updateCalculatorData,
      currentYearLedger, setCurrentYearLedger,
      cashFlowSubStep, setCashFlowSubStep,
      hasEMI, setHasEMI, hasSpouseIncome, setHasSpouseIncome,
      hasLifeInsurance, setHasLifeInsurance, hasHealthInsurance, setHasHealthInsurance,
      summaryLifeCover, setSummaryLifeCover, summaryHealthCover, setSummaryHealthCover,
      summaryReportGeneratedAt, setSummaryReportGeneratedAt, markReportGenerated,
      journeyProjections, proposedSIPs, proposedLumpsums, proposedEquities,
      handleLogoutCleanup, savePlanData
    }}>
      {children}
    </FinancialPlanContext.Provider>
  );
};
