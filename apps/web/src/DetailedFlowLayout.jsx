import { 
  LogOut, User, Users, ArrowRightLeft, Wallet, Target, Shield, 
  Umbrella, LifeBuoy, Map, PieChart, TrendingUp, ListChecks, 
  LayoutDashboard, Calculator, Percent, Landmark, Car, 
  GraduationCap, LineChart, MoveDown, PiggyBank, Home, CheckCircle2,
  Copy, Menu, X,
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AssetModule from './components/AssetModule/AssetModule';
import RoleBasedRouting from './components/Auth/RoleBasedRouting';
import CashFlowModule from './components/CashFlowModule/CashFlowModule';
import ContingencyModule from './components/ContingencyModule/ContingencyModule';
import GoalModule from './components/GoalModule/GoalModule';
import InsuranceModule from './components/InsuranceModule/InsuranceModule';
import IncomeTaxModule from './components/IncomeTaxModule/IncomeTaxModule';
import JourneyModule from './components/JourneyModule/JourneyModule';
import { generateProjections } from './components/JourneyModule/ProjectionLogic';
import ProfileModule from './components/ProfileModule/ProfileModule';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectionGapModule from './components/ProtectionGapModule/ProtectionGapModule';
import AllocationModule from './components/AllocationModule/AllocationModule';
import GrowthModule from './components/GrowthModule/GrowthModule';
import FulfillmentModule from './components/FulfillmentModule/FulfillmentModule';
// FLAG_PAYMENT_DISABLED: import CheckoutGate from './components/CheckoutModule/CheckoutGate';
import ReportView from './components/ReportModule/ReportView';
import CalculatorPlaceholder from './components/Calculators/CalculatorPlaceholder';
import SIPCalculator from './components/Calculators/SIPCalculator';
import PersonalLoanCalculator from './components/Calculators/PersonalLoanCalculator';
import HomeLoanCalculator from './components/Calculators/HomeLoanCalculator';
import CarLoanCalculator from './components/Calculators/CarLoanCalculator';
import TwoWheelerCalculator from './components/Calculators/TwoWheelerCalculator';
import EducationLoanCalculator from './components/Calculators/EducationLoanCalculator';
import LumpsumCalculator from './components/Calculators/LumpsumCalculator';
import EquityCalculator from './components/Calculators/EquityCalculator';
import SWPCalculator from './components/Calculators/SWPCalculator';
import PPFCalculator from './components/Calculators/PPFCalculator';
import NPSCalculator from './components/Calculators/NPSCalculator';
import FDCalculator from './components/Calculators/FDCalculator';
import RDCalculator from './components/Calculators/RDCalculator';
import MobileWebComingSoon from '@/components/common/MobileWebComingSoon';
import { useBreakpoints } from '@/hooks';
import { useAuth } from './contexts/AuthContext';
import { signOut } from './services/authService';
import { createFinancialPlan, getActivePlan, updateFinancialPlan } from './services/financialPlanService';
import finbrellaLogo from './assets/finbrella_logo.png';
import { SHOW_STAGING_USER_ID_TOOL } from '@/config/environment';

/**
 * Main App Component
 * 
 * This component manages the overall state for the financial planning application,
 * including family profile, cash flow, assets, goals, insurance, and contingency funds.
 * It uses a step-based navigation to guide the user through the planning process.
 */
function DetailedFlowLayout() {
  const { user } = useAuth();
  const { lg } = useBreakpoints();
  const navigate = useNavigate();
  
  // Supabase plan ID
  const [planId, setPlanId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState(false);
  const [planSyncError, setPlanSyncError] = useState(null);
  const [planReloadToken, setPlanReloadToken] = useState(0);

  // States for responsive mobile drawer toggles
  const [isMobileLeftMenuOpen, setIsMobileLeftMenuOpen] = useState(false);
  const [isMobileRightMenuOpen, setIsMobileRightMenuOpen] = useState(false);

  // State for tracking the current navigation step (1-12)
  const [currentStep, setCurrentStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1); // Track maximum unlocked step

  // New states for Secondary Navigation (Calculators)
  const [activeSection, setActiveSection] = useState('modules'); // 'modules' or 'calculators'
  const [activeCalculator, setActiveCalculator] = useState(null);
  const [insuranceMode, setInsuranceMode] = useState(null); // 'accurate' or 'anyway'
  const [planStartMonth, setPlanStartMonth] = useState(new Date().getMonth());

  // Auto-close mobile drawers when step or section or calculator changes
  useEffect(() => {
    setIsMobileLeftMenuOpen(false);
    setIsMobileRightMenuOpen(false);
  }, [currentStep, activeSection, activeCalculator, planReloadToken]);

  // Helper to handle step progression securely with async storage track
  const handleStepProgression = async (nextStep) => {
    setCurrentStep(nextStep);
    try {
      const storedMax = await Promise.resolve(localStorage.getItem(`max_step_${planId}`));
      const currentMax = storedMax ? parseInt(storedMax, 10) : 1;
      const newMax = Math.max(currentMax, maxStep, nextStep);
      setMaxStep(newMax);
      await Promise.resolve(localStorage.setItem(`max_step_${planId}`, newMax.toString()));
    } catch (e) {
      console.warn("Async storage saving failed", e);
    }
    window.scrollTo(0, 0);
  };

  // State for Family Profile details
  const [familyMembers, setFamilyMembers] = useState([
    {
      name: '',
      dob: '',
      occupation: 'Salaried',
      retirementAge: 60,
      relation: 'Self',
      natureOfBusiness: '',
      organizationName: '',
      educationalQualification: '',
      mobile: '',
    }
  ]);

  // Cash Flow State
  const [income, setIncome] = useState({
    self: '',
    selfBonus: '',
    selfPassive: '',
    selfOther: '',
    spouse: '',
    spouseBonus: '',
    spousePassive: '',
    spouseOther: '',
    bonus: '', // Keep for sync/migration
    passive: '',
    other: ''
  });
  const [expenseCategories, setExpenseCategories] = useState({
    household: { grocery: '', rent: '', education: '', lifestyle: '', medical: '', travel: '' },
    emi: { personalLoan: '', homeLoan: '', educationLoan: '', otherEmi: '' },
    insurance: {
      health: { value: '', frequency: 'Annual' },
      car: { value: '', frequency: 'Annual' },
      bike: { value: '', frequency: 'Annual' },
      life: {},
      others: { value: '', frequency: 'Annual' }
    },
    savings: { rd: '', fd: '', ppf: '', savingSchemes: '', mfSip: '', otherSaving: '' }
  });

  // Asset State
  const [assetCategories, setAssetCategories] = useState({
    realEstate: { residential: '', secondProperty: '', landPlot: '' },
    vehicles: { idv: '' },
    valuables: { gold: '', art: '' },
    cash: { savings: '' },
    investments: { equity: '', mutualFunds: '', fixedDeposit: '', recurringDeposit: '' },
    insurance: { savingPlans: '', ulip: '' },
    retirement: { epf: '', ppf: '', nps: '' },
    others: { other: '' },
    custom: []
  });
  const [liabilityCategories, setLiabilityCategories] = useState({
    loans: { home: '', personal: '', car: '', education: '', otherEmis: '', creditCard: '' },
    custom: []
  });

  // Goals State
  const [goals, setGoals] = useState([]);

  // Insurance State
  const [policies, setPolicies] = useState([]);

  // Contingency State
  const [contingencyFund, setContingencyFund] = useState('');

  // Journey/Inflation State
  const [inflationRates, setInflationRates] = useState({
    incomeIncrement: 10,
    householdInflation: 6,
    educationInflation: 8
  });
  const [journeyAdjustments, setJourneyAdjustments] = useState([]);
  const [investmentAllocations, setInvestmentAllocations] = useState([]);
  
  // Fulfillment Module State (Supabase Synced)
  const [loanProposals, setLoanProposals] = useState([]);
  const [allocationPlans, setAllocationPlans] = useState({});

  const [goalMappings, setGoalMappings] = useState({});

  // Calculator Persistence State
  const [calculatorInputs, setCalculatorInputs] = useState({
    personal_loan: { amount: 0, rate: 10.5, tenure: 5, events: [] },
    home_loan: { amount: 0, rate: 8.5, tenure: 20, events: [] },
    car_loan: { amount: 0, rate: 9.5, tenure: 5, events: [] },
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
    income: Array(12).fill(0),
    household: Array(12).fill(0)
  });
  const [cashFlowSubStep, setCashFlowSubStep] = useState(1);

  // --- Active State Cleanup for Phantom Spouse Income ---
  useEffect(() => {
    const spouseMember = familyMembers.find(m => m.relation?.toLowerCase() === 'spouse');
    const isSpouseHousewife = spouseMember?.occupation?.toLowerCase() === 'housewife';
    
    if (!spouseMember || isSpouseHousewife) {
      setIncome(prev => {
        if (prev.spouse || prev.spouseBonus || prev.spousePassive || prev.spouseOther) {
          return {
            ...prev,
            spouse: '',
            spouseBonus: '',
            spousePassive: '',
            spouseOther: ''
          };
        }
        return prev;
      });
    }
  }, [familyMembers]);

  // --- Reset All State ---
  const resetState = () => {
    setPlanId(null);
    setCurrentStep(1);
    setMaxStep(1);
    setActiveSection('modules');
    setActiveCalculator(null);
    setInsuranceMode(null);
    setPlanStartMonth(new Date().getMonth());
    setSaving(false);
    setFamilyMembers([
      {
        name: '',
        dob: '',
        occupation: 'Salaried',
        retirementAge: 60,
        relation: 'Self',
        natureOfBusiness: '',
        organizationName: '',
        educationalQualification: '',
        mobile: '',
      }
    ]);
    setIncome({
      self: '',
      selfBonus: '',
      selfPassive: '',
      selfOther: '',
      spouse: '',
      spouseBonus: '',
      spousePassive: '',
      spouseOther: '',
      bonus: '',
      passive: '',
      other: ''
    });
    setExpenseCategories({
      household: { grocery: '', rent: '', education: '', lifestyle: '', medical: '', travel: '' },
      emi: { personalLoan: '', homeLoan: '', educationLoan: '', carLoan: '', twoWheelerLoan: '', otherEmi: '' },
      insurance: {
        health: { value: '', frequency: 'Annual' },
        car: { value: '', frequency: 'Annual' },
        bike: { value: '', frequency: 'Annual' },
        life: {},
        others: { value: '', frequency: 'Annual' }
      },
      savings: { sip: '', ppf: '', nps: '', rd: '', otherSaving: '' }
    });
    setAssetCategories({
      realEstate: { residential: '', secondProperty: '', landPlot: '' },
      vehicles: { idv: '' },
      valuables: { gold: '', art: '' },
      cash: { savings: '' },
      investments: { equity: '', mutualFunds: '', fixedDeposit: '', recurringDeposit: '' },
      insurance: { savingPlans: '', ulip: '' },
      retirement: { epf: '', ppf: '', nps: '' },
      others: { other: '' },
      custom: []
    });
    setLiabilityCategories({
      loans: { home: '', personal: '', car: '', education: '', otherEmis: '', creditCard: '' },
      custom: []
    });
    setGoals([]);
    setPolicies([]);
    setContingencyFund('');
    setInflationRates({
      incomeIncrement: 10,
      householdInflation: 6,
      educationInflation: 8
    });
    setJourneyAdjustments([]);
    setInvestmentAllocations([]);
    setLoanProposals([]);
    setAllocationPlans({});
    setGoalMappings({});
    setCalculatorInputs({
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
    setCurrentYearLedger({
      income: Array(12).fill(0),
      household: Array(12).fill(0)
    });
    setCashFlowSubStep(1);
    setPlanSyncError(null);
  };

  // --- Load Financial Plan from Supabase ---
  useEffect(() => {
    const loadPlan = async () => {
      // First, reset local state to ensure no stale data remains
      resetState();

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await getActivePlan();

      if (error) {
        console.error('Error loading plan from Supabase:', error);
        const retry = await createFinancialPlan();
        if (retry.data) {
          setPlanSyncError(null);
          setPlanId(retry.data.id);
          setCurrentStep(retry.data.current_step || 1);
          setMaxStep(retry.data.current_step || 1);
          setFamilyMembers(
            retry.data.family_members && retry.data.family_members.length > 0
              ? retry.data.family_members.map((m) => ({ ...m, mobile: m.mobile || '' }))
              : [
                  {
                    name: '',
                    dob: '',
                    occupation: 'Salaried',
                    retirementAge: 60,
                    relation: 'Self',
                    natureOfBusiness: '',
                    organizationName: '',
                    educationalQualification: '',
                    mobile: '',
                  },
                ],
          );
          setLoading(false);
          return;
        }
        const msg =
          typeof error?.message === 'string'
            ? error.message
            : error?.code
              ? `${error.code}: ${error.message || error.details || ''}`
              : String(error);
        const retryDetail = retry?.error
          ? ` Retry failed: ${retry.error.message || retry.error.code || String(retry.error)}.`
          : '';
        setPlanSyncError(
          `${msg}.${retryDetail} Profile saves go to table financial_plans (column family_members), not user_profiles.`,
        );
        setLoading(false);
        return;
      }

      setPlanSyncError(null);

      if (data) {
        console.log('Successfully loaded plan:', data.id);
        setPlanId(data.id);
        
        // Initialize max step from async storage and DB
        const initializeMaxStep = async () => {
          try {
             const stored = await Promise.resolve(localStorage.getItem(`max_step_${data.id}`));
             let newMax = data.current_step || 1;
             if (stored) {
                newMax = Math.max(parseInt(stored, 10), newMax);
             }
             setMaxStep(newMax);
             await Promise.resolve(localStorage.setItem(`max_step_${data.id}`, newMax.toString()));
          } catch(e) {
             setMaxStep(data.current_step || 1);
          }
        };
        initializeMaxStep();

        setCurrentStep(data.current_step || 1);
        setInsuranceMode(data.insurance_mode || null);
        let rawPlanStartMonth = data.plan_start_month;
        let derivedPlanStartMonth = (rawPlanStartMonth !== undefined && rawPlanStartMonth !== null) ? parseInt(rawPlanStartMonth, 10) : null;
        
        let finalMonth = (derivedPlanStartMonth !== null && !isNaN(derivedPlanStartMonth)) ? derivedPlanStartMonth : new Date().getMonth();

        // If the database returns 0 (January), we verify it since old test profiles often lack valid creation months.
        if (finalMonth === 0) {
            let trueMonth = null;
            
            // 1. First Authority: Is there mathematical proof in the Ledger?
            if (data.current_year_ledger && data.current_year_ledger.income) {
                const firstActive = data.current_year_ledger.income.findIndex(val => Number(val) > 0);
                if (firstActive > 0) {
                    trueMonth = firstActive; // Safely establishes March (2) if Jan/Feb are empty!
                }
            }

            // 2. Second Authority: Supabase Timestamps
            if (trueMonth === null) {
                const extractMonth = (dateVal) => {
                     if (!dateVal) return null;
                     let normalized = dateVal;
                     if (typeof dateVal === 'string' && !/^\d+$/.test(dateVal)) {
                         normalized = dateVal.replace(' ', 'T');
                     } else if (typeof dateVal === 'string' && /^\d+$/.test(dateVal)) {
                         normalized = parseInt(dateVal, 10);
                     }
                     const mt = new Date(normalized).getMonth();
                     return isNaN(mt) ? null : mt;
                };
                
                trueMonth = extractMonth(user?.created_at) ?? extractMonth(data.created_at) ?? extractMonth(data.updated_at);
            }
            
            // Overwrite the 0 with the established true start month
            if (trueMonth !== null && trueMonth !== 0) {
                finalMonth = trueMonth;
            } else if (new Date().getMonth() !== 0) {
                // Failsafe for completely empty/bugged test profiles to match live clock instead of trailing to January
                finalMonth = new Date().getMonth();
            }
        }
        
        if (isNaN(finalMonth)) finalMonth = new Date().getMonth();
        setPlanStartMonth(finalMonth);
        setFamilyMembers(data.family_members && data.family_members.length > 0 
          ? data.family_members.map(m => ({ ...m, mobile: m.mobile || '' })) 
          : [{ name: '', dob: '', occupation: 'Salaried', retirementAge: 60, relation: 'Self', mobile: '' }]);
        const loadedIncome = data.income || {};
        
        // Handle migration from old flat structure to new per-person structure
        const migrationIncome = {
            self: loadedIncome.self ?? loadedIncome.family ?? '',
            selfBonus: loadedIncome.selfBonus ?? loadedIncome.bonus ?? '',
            selfPassive: loadedIncome.selfPassive ?? loadedIncome.passive ?? '',
            selfOther: loadedIncome.selfOther ?? loadedIncome.other ?? '',
            spouse: loadedIncome.spouse ?? '',
            spouseBonus: loadedIncome.spouseBonus ?? '',
            spousePassive: loadedIncome.spousePassive ?? '',
            spouseOther: loadedIncome.spouseOther ?? ''
        };
        
        setIncome(migrationIncome);
        
        // Merge loaded expense_categories with default structure
        const defaultExpenseCategories = {
          household: { grocery: '', rent: '', education: '', lifestyle: '', medical: '', travel: '' },
          emi: { personalLoan: '', homeLoan: '', educationLoan: '', carLoan: '', twoWheelerLoan: '', otherEmi: '' },
          insurance: {
            health: { value: '', frequency: 'Annual' },
            car: { value: '', frequency: 'Annual' },
            bike: { value: '', frequency: 'Annual' },
            life: {},
            others: { value: '', frequency: 'Annual' }
          },
          savings: { sip: '', ppf: '', nps: '', rd: '', otherSaving: '' }
        };
        const loadedExpenseCategories = data.expense_categories || {};
        
        // Migration logic for insurance and savings
        const loadedInsurance = loadedExpenseCategories.insurance || {};
        
        // Ensure life premiums are migrated to a member-specific structure if they exist in old format
        let migratedLife = {};
        const selfMember = (data.family_members || []).find(m => m.relation === 'Self') || { name: '', relation: 'Self' };
        const selfKey = selfMember.name || selfMember.relation;

        if (loadedInsurance.life && typeof loadedInsurance.life === 'object' && 'value' in loadedInsurance.life) {
            // Check if it actually has members (already partially migrated or polluted)
            const hasMembers = Object.keys(loadedInsurance.life).some(k => k !== 'value' && k !== 'frequency');
            if (hasMembers) {
                // Keep only the members
                migratedLife = { ...loadedInsurance.life };
                delete migratedLife.value;
                delete migratedLife.frequency;
            } else {
                // Pure old format
                migratedLife = { [selfKey]: { value: loadedInsurance.life.value, frequency: loadedInsurance.life.frequency || 'Annual' } };
            }
        } else if (loadedInsurance.life) {
            // Already a member-specific object, but check for 'Self' pollution if name exists
            migratedLife = { ...loadedInsurance.life };
            if (selfMember.name && migratedLife['Self']) {
                if (!migratedLife[selfMember.name]) {
                    migratedLife[selfMember.name] = migratedLife['Self'];
                }
                delete migratedLife['Self'];
            }
        }

        const migratedInsurance = {
            health: loadedInsurance.health || { value: loadedExpenseCategories.emi?.healthInsurance || '', frequency: 'Annual' },
            car: loadedInsurance.car || { value: loadedExpenseCategories.emi?.carInsurance || '', frequency: 'Annual' },
            bike: loadedInsurance.bike || { value: loadedExpenseCategories.emi?.bikeInsurance || '', frequency: 'Annual' },
            life: migratedLife,
            others: loadedInsurance.others || { value: loadedExpenseCategories.emi?.otherInsurance || '', frequency: 'Annual' }
        };

        const mergedExpenseCategories = {
          household: { ...defaultExpenseCategories.household, ...(loadedExpenseCategories.household || {}) },
          emi: { 
            personalLoan: loadedExpenseCategories.emi?.personalLoan ?? '',
            homeLoan: loadedExpenseCategories.emi?.homeLoan ?? '',
            educationLoan: loadedExpenseCategories.emi?.educationLoan ?? '',
            carLoan: loadedExpenseCategories.emi?.carLoan ?? '',
            twoWheelerLoan: loadedExpenseCategories.emi?.twoWheelerLoan ?? '',
            otherEmi: loadedExpenseCategories.emi?.otherEmi ?? ''
          },
          insurance: migratedInsurance,
          savings: { 
            ...defaultExpenseCategories.savings, 
            ...(loadedExpenseCategories.savings || {}),
            sip: loadedExpenseCategories.savings?.sip || loadedExpenseCategories.savings?.mfSip || ''
          }
        };
        // Explicitly remove ghost keys that might have been accidentally merged via spread
        delete mergedExpenseCategories.savings.lifeInsurance;
        delete mergedExpenseCategories.savings.fd;
        delete mergedExpenseCategories.savings.savingSchemes;
        delete mergedExpenseCategories.savings.mfSip;
        
        setExpenseCategories(mergedExpenseCategories);
        
        // Merge loaded asset_categories with default structure
        const defaultAssetCategories = {
          realEstate: { residential: '', secondProperty: '', landPlot: '' },
          vehicles: { idv: '' },
          valuables: { gold: '', art: '' },
          cash: { savings: '' },
          investments: { equity: '', mutualFunds: '', fixedDeposit: '', recurringDeposit: '' },
          insurance: { savingPlans: '', ulip: '' },
          retirement: { epf: '', ppf: '', nps: '' },
          others: { other: '' },
          custom: []
        };
        const loadedAssetCategories = data.asset_categories || {};
        
        // Surgical migration: Only map known fields and avoid polluting with old top-level keys
        const migratedAssetCategories = {
          ...defaultAssetCategories,
          realEstate: { 
            ...defaultAssetCategories.realEstate, 
            ...(loadedAssetCategories.realEstate || {}),
            residential: loadedAssetCategories.realEstate?.residential || loadedAssetCategories.realEstate?.residence || '',
            secondProperty: loadedAssetCategories.realEstate?.secondProperty || loadedAssetCategories.realEstate?.investmentProp || ''
          },
          vehicles: { ...defaultAssetCategories.vehicles, ...(loadedAssetCategories.vehicles || {}) },
          valuables: { 
            ...defaultAssetCategories.valuables, 
            ...(loadedAssetCategories.valuables || {}),
            gold: loadedAssetCategories.valuables?.gold || loadedAssetCategories.others?.gold || ''
          },
          cash: { ...defaultAssetCategories.cash, ...(loadedAssetCategories.cash || {}) },
          investments: {
            ...defaultAssetCategories.investments,
            ...(loadedAssetCategories.investments || {}),
            equity: loadedAssetCategories.investments?.equity || loadedAssetCategories.equity?.stocks || '',
            mutualFunds: loadedAssetCategories.investments?.mutualFunds || loadedAssetCategories.equity?.mfEquity || '',
            fixedDeposit: loadedAssetCategories.investments?.fixedDeposit || loadedAssetCategories.debt?.fd || ''
          },
          insurance: { ...defaultAssetCategories.insurance, ...(loadedAssetCategories.insurance || {}) },
          retirement: {
            ...defaultAssetCategories.retirement,
            ...(loadedAssetCategories.retirement || {}),
            ppf: loadedAssetCategories.retirement?.ppf || loadedAssetCategories.debt?.ppf || ''
          },
          others: {
            ...defaultAssetCategories.others,
            ...(loadedAssetCategories.others || {}),
            other: loadedAssetCategories.others?.other || loadedAssetCategories.others?.others || ''
          },
          custom: Array.isArray(loadedAssetCategories.custom) ? loadedAssetCategories.custom : []
        };
        setAssetCategories(migratedAssetCategories);
        
        // Merge loaded liability_categories with default structure
        const defaultLiabilityCategories = { 
          loans: { home: '', personal: '', car: '', education: '', otherEmis: '', creditCard: '' },
          custom: []
        };
        const loadedLiabilityCategories = data.liability_categories || {};
        const migratedLiabilityCategories = {
          loans: { 
            ...defaultLiabilityCategories.loans, 
            ...(loadedLiabilityCategories.loans || {}),
            // Map old keys if they exist and new ones are empty
            home: loadedLiabilityCategories.loans?.home || '',
            car: loadedLiabilityCategories.loans?.car || '',
            otherEmis: loadedLiabilityCategories.loans?.otherEmis || loadedLiabilityCategories.loans?.other || ''
          },
          custom: Array.isArray(loadedLiabilityCategories.custom) ? loadedLiabilityCategories.custom : []
        };

        // Final cleanup: remove ghost keys that might have been accidentally merged via spread
        delete migratedLiabilityCategories.loans.other; 

        setLiabilityCategories(migratedLiabilityCategories);
        
        setGoals(data.goals || []);
        setPolicies(data.policies || []);
        setContingencyFund(data.contingency_fund || '');
        setInflationRates(data.inflation_rates || { incomeIncrement: 10, householdInflation: 6, educationInflation: 8 });
        setJourneyAdjustments(data.journey_adjustments || []);
        setInvestmentAllocations(data.investment_allocations || []);
        setLoanProposals(data.loan_proposals || []);
        setAllocationPlans(data.allocation_plans || {});
        
        let loadedMappings = data.goal_mappings || {};
        // Migrate legacy array-based structural bindings to strictly numeric dictionaries
        Object.keys(loadedMappings).forEach(goalId => {
            if (Array.isArray(loadedMappings[goalId])) {
                const legacyArray = loadedMappings[goalId];
                const newDict = {};
                legacyArray.forEach(sourceName => {
                    newDict[sourceName] = 0; // Pre-map the source with 0 value
                });
                loadedMappings[goalId] = newDict;
            }
        });
        setGoalMappings(loadedMappings);

        if (data.calculator_inputs) {
            setCalculatorInputs(data.calculator_inputs);
        }
        setCurrentYearLedger(data.current_year_ledger || {
            income: Array(12).fill(0),
            household: Array(12).fill(0)
        });
      }
      
      setLoading(false);
    };

    loadPlan();
  }, [user, planReloadToken]);

  const expandedGoals = useMemo(() => {
    let result = [];
    goals.forEach(g => {
        let duration = Math.max(1, parseInt(g.courseDuration) || 1);
        if (duration > 1) {
             const totalFutureValue = parseFloat(g.futureValue) || (parseFloat(g.presentValue) * Math.pow(1 + (parseFloat(g.inflationRate) || 8) / 100, parseFloat(g.yearsToGoal) || 0));
             const perYearFutureValue = totalFutureValue / duration;
             for (let i = 0; i < duration; i++) {
                 result.push({
                     ...g,
                     id: `${g.id}_yr${i+1}`,
                     name: `${g.name || g.placeholder} - Year ${i+1}`,
                     yearsToGoal: parseFloat(g.yearsToGoal) + i,
                     futureValue: perYearFutureValue,
                     presentValue: 0,
                     courseDuration: 1 
                 });
             }
        } else {
             result.push({ ...g, courseDuration: 1 });
        }
    });
    return result;
  }, [goals]);

  const journeyProjections = useMemo(() => {
    if (!familyMembers.find(m => m.relation?.toLowerCase() === 'self')) return [];
    return generateProjections({
      familyMembers,
      income,
      expenseCategories,
      goals: goals,
      inflationRates,
      journeyAdjustments,
      investmentAllocations,
      loanProposals,
      policies,
      planStartMonth,
      currentYearLedger
    });
  }, [familyMembers, income, expenseCategories, goals, inflationRates, journeyAdjustments, investmentAllocations, loanProposals, policies, planStartMonth, currentYearLedger]);

  const proposedSIPs = useMemo(() => {
    return investmentAllocations.filter(a => a.type === 'SIP');
  }, [investmentAllocations]);

  const proposedLumpsums = useMemo(() => {
    return investmentAllocations.filter(a => a.type === 'Lumpsum' || a.type === 'Lump Sum');
  }, [investmentAllocations]);

  const proposedEquities = useMemo(() => {
    return investmentAllocations.filter(a => a.type === 'Direct Equity & ETFs');
  }, [investmentAllocations]);

  const updateCalculatorData = (calculatorKey) => (val) => {
    setCalculatorInputs(prev => ({ ...prev, [calculatorKey]: val }));
  };

  const savePlanData = async () => {
    if (!planId) return;
    try {
      console.log('Attemping to save plan...', planId);
      const { data, error } = await updateFinancialPlan(planId, {
        current_step: currentStep,
        family_members: familyMembers,
        income,
        expense_categories: expenseCategories,
        asset_categories: assetCategories,
        liability_categories: liabilityCategories,
        goals,
        policies,
        contingency_fund: parseFloat(contingencyFund) || 0,
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
      });
      
      if (error) {
          console.error('Save failed with error:', error);
      } else {
          console.log('Save successful at:', new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Save crashed with exception:', err);
    }
  };

  // --- Save to Supabase with debouncing ---
  useEffect(() => {
    if (!planId || loading) return;

    setSaving(true);
    const timeoutId = setTimeout(async () => {
      await savePlanData();
      setSaving(false);
      setLastSaved(new Date());
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [planId, loading, currentStep, familyMembers, income, expenseCategories, assetCategories, liabilityCategories, goals, policies, contingencyFund, inflationRates, journeyAdjustments, investmentAllocations, loanProposals, allocationPlans, goalMappings, insuranceMode, calculatorInputs, currentYearLedger, planStartMonth]);

  // Handle logout
  const handleLogout = async () => {
    setSaving(true);
    await savePlanData();
    await signOut();
    resetState(); // Clear data immediately after logout
  };

  const copySupabaseUserId = async () => {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setCopiedUserId(true);
      window.setTimeout(() => setCopiedUserId(false), 2000);
    } catch {
      // clipboard API unavailable or denied
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  // Tablet/desktop (lg+, same 768px threshold as the hook): full app. Mobile screens are now fully supported.

  return (
    <RoleBasedRouting>
      <ProtectedRoute>
        <div className="app-shell">
        {(isMobileLeftMenuOpen || isMobileRightMenuOpen) && !lg && (
          <div 
            className="sidebar-overlay"
            onClick={() => {
              setIsMobileLeftMenuOpen(false);
              setIsMobileRightMenuOpen(false);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(4px)',
              zIndex: 999
            }}
          />
        )}
        {planSyncError && (
          <div
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              background: 'rgba(220, 38, 38, 0.12)',
              borderBottom: '1px solid rgba(220, 38, 38, 0.35)',
              fontSize: '0.9rem',
              lineHeight: 1.45,
            }}
          >
            <strong>Cannot sync your plan ΓÇö edits will not save.</strong>{' '}
            <span>{planSyncError}</span>
            <button
              type="button"
              onClick={() => setPlanReloadToken((t) => t + 1)}
              style={{
                marginLeft: '0.75rem',
                padding: '0.25rem 0.6rem',
                cursor: 'pointer',
                borderRadius: '6px',
                border: '1px solid rgba(220, 38, 38, 0.5)',
                background: 'var(--bg-card, #fff)',
              }}
            >
              Retry
            </button>
          </div>
        )}
        {/* Left Drawer: Process Navigation */}
        <aside className={`sidebar left-drawer ${isMobileLeftMenuOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem', padding: '1.5rem 1rem 0 1rem', height: 'auto', borderBottom: 'none', position: 'relative' }}>
            {!lg && (
              <button 
                type="button"
                onClick={() => setIsMobileLeftMenuOpen(false)}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px'
                }}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <LayoutDashboard size={24} color="var(--primary)" />
              <span className="nav-label" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Finbrella</span>
            </div>
            <button 
                className="btn btn-secondary nav-label" 
                onClick={() => navigate('/summary-report/money_story')}
                style={{ fontSize: '0.85rem', padding: '0.5rem', width: '100%', textAlign: 'center', borderRadius: '8px', border: '1px solid var(--border)' }}
            >
                &larr; Back to Summary
            </button>
          </div>
          
          <div style={{ flex: 1, padding: '1rem 0' }}>
            {[
              {
                phase: 'Foundation',
                items: [
                  { step: 1, name: 'Profile', icon: Users },
                  { step: 2, name: 'Cash Flow', icon: ArrowRightLeft },
                  { step: 3, name: 'Assets', icon: Wallet },
                  { step: 4, name: 'Goals', icon: Target }
                ]
              },
              {
                phase: 'Protection',
                items: [
                  { step: 5, name: 'Insurance', icon: Shield },
                  { step: 6, name: 'Protection Gap', icon: Umbrella },
                  { step: 7, name: 'Contingency', icon: LifeBuoy }
                ]
              },
              {
                phase: 'Trajectory',
                items: [
                  { step: 8, name: 'Journey', icon: Map },
                  { step: 9, name: 'Allocation', icon: PieChart },
                  { step: 10, name: 'Growth', icon: TrendingUp }
                ]
              },
              {
                phase: 'Execution',
                items: [
                  { step: 11, name: 'Roadmap', icon: ListChecks },
                  { step: 12, name: 'Overview', icon: LayoutDashboard }
                ]
              }
            ].map((phaseGroup, pIdx) => {
              const phaseUnlocked = phaseGroup.items.some(item => maxStep >= item.step);
              
              return (
                <div key={phaseGroup.phase} className={`phase-group ${phaseUnlocked ? 'unlocked' : 'locked'}`} style={{ marginBottom: pIdx < 3 ? '1rem' : '0' }}>
                  <div className="phase-header" style={{ padding: '0.25rem 1.4rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                     <span className="nav-label">Phase {pIdx + 1}: {phaseGroup.phase}</span>
                     {phaseGroup.items.every(item => item.step < maxStep) && (
                       <CheckCircle2 size={14} color="var(--emerald-500)" style={{ marginLeft: 'auto', marginRight: '1rem' }} className="nav-label" />
                     )}
                  </div>
                  {phaseGroup.items.map((mod) => {
                    const isCompleted = mod.step < maxStep;
                    const isActive = activeSection === 'modules' && currentStep === mod.step;
                    const isLocked = mod.step > maxStep || (mod.name === 'Insurance' && insuranceMode === 'anyway');
                    
                    return (
                      <div key={mod.name} style={{ position: 'relative' }}>
                        <button
                          className={`sidebar-btn ${isActive ? 'active' : ''}`}
                          disabled={isLocked}
                          onClick={() => {
                            if (!isLocked) {
                              setCurrentStep(mod.step);
                              setActiveSection('modules');
                              if (mod.name === 'Cash Flow') setCashFlowSubStep(1);
                            }
                          }}
                          style={{ opacity: isLocked ? 0.4 : 1 }}
                        >
                          {isCompleted && !isActive ? (
                            <div style={{ position: 'relative' }}>
                              <mod.icon size={20} />
                              <CheckCircle2 size={10} color="var(--emerald-500)" style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--bg-card)', borderRadius: '50%' }} />
                            </div>
                          ) : (
                            <mod.icon size={20} />
                          )}
                          <span className="nav-label">{mod.step}. {mod.name}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right Drawer: Calculators Navigation */}
        <aside className={`sidebar right-drawer ${isMobileRightMenuOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-header" style={{ color: 'var(--text-main)', position: 'relative' }}>
            <Calculator size={24} />
            <span className="nav-label">Calculators</span>
            {!lg && (
              <button 
                type="button"
                onClick={() => setIsMobileRightMenuOpen(false)}
                style={{
                  position: 'absolute',
                  top: '1.5rem',
                  right: '1rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px'
                }}
                aria-label="Close calculators"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <div style={{ flex: 1, padding: '1rem 0' }}>
            {[
              { id: 'tax', label: 'Income Tax', icon: Landmark },
              { id: 'sip', label: 'SIP', icon: LineChart },
              { id: 'ppf', label: 'PPF', icon: PiggyBank },
              { id: 'nps', label: 'NPS', icon: Umbrella },
              { id: 'fd', label: 'Fixed Deposit', icon: Percent },
              { id: 'rd', label: 'Recurring Dep.', icon: ArrowRightLeft },
              { id: 'per_loan', label: 'Personal Loan', icon: User },
              { id: 'home_loan', label: 'Home Loan', icon: Home },
              { id: 'car_loan', label: 'Car Loan', icon: Car },
              { id: 'two_wheeler_loan', label: 'Two-Wheeler', icon: Car },
              { id: 'edu_loan', label: 'Edu. Loan', icon: GraduationCap },
              { id: 'lumpsum', label: 'Lumpsum', icon: Wallet },
              { id: 'equity', label: 'Equity & ETFs', icon: TrendingUp },
              { id: 'swp', label: 'SWP', icon: MoveDown }
            ].map((calc) => (
              <button
                key={calc.id}
                className={`sidebar-btn ${activeSection === 'calculators' && activeCalculator === calc.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveCalculator(calc.id);
                  setActiveSection('calculators');
                }}
              >
                <calc.icon size={20} />
                <span className="nav-label">{calc.label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="main-content-wrapper fade-in">
          <header style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            marginBottom: '2rem', 
            paddingBottom: '1rem', 
            borderBottom: '1px solid var(--border)',
            position: lg ? 'static' : 'sticky',
            top: lg ? 'auto' : 0,
            background: lg ? 'transparent' : 'var(--bg-card)',
            zIndex: lg ? 'auto' : 100,
            padding: lg ? '0 0 1rem 0' : '0.75rem 1rem',
            margin: lg ? '0 0 2rem 0' : '0 -1rem 2rem -1rem',
            boxShadow: lg ? 'none' : 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: lg ? '4rem' : 0 }}>
              {!lg && (
                <button
                  type="button"
                  onClick={() => setIsMobileLeftMenuOpen(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    borderRadius: '8px'
                  }}
                  aria-label="Toggle menu"
                >
                  <Menu size={24} />
                </button>
              )}
              <img src={finbrellaLogo} alt="Finbrella Logo" style={{ height: lg ? '56px' : '36px', width: 'auto', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginRight: lg ? '3rem' : 0 }}>
              {saving ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  {lg && "Saving..."}
                </span>
              ) : lastSaved ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  {lg && `Saved at ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </span>
              ) : null}
              {!lg && (
                <button
                  type="button"
                  onClick={() => setIsMobileRightMenuOpen(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    borderRadius: '8px'
                  }}
                  aria-label="Toggle calculators"
                >
                  <Calculator size={22} />
                </button>
              )}
              {SHOW_STAGING_USER_ID_TOOL && user?.id && lg ? (
                <button
                  type="button"
                  onClick={() => { void copySupabaseUserId(); }}
                  title="Copy your Supabase user id (staging only)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '0.35rem 0.55rem',
                    borderRadius: '8px',
                    border: '1px dashed var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <Copy size={14} />
                  {copiedUserId ? 'Copied' : 'User id'}
                </button>
              ) : null}
              <div style={{ position: 'relative' }}>
                <button 
                  className="profile-icon-btn" 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  style={{ 
                    background: 'var(--primary-light)', 
                    border: '1px solid var(--primary-light)', 
                    borderRadius: '50%', 
                    width: lg ? '40px' : '32px', 
                    height: lg ? '40px' : '32px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    cursor: 'pointer',
                    color: 'var(--primary)',
                    marginLeft: lg ? '1rem' : '0.25rem'
                  }}
                >
                  <User size={lg ? 20 : 16} />
                </button>
                {showProfileMenu && (
                  <>
                    <div 
                      style={{ position: 'fixed', inset: 0, zIndex: 1040 }} 
                      onClick={() => setShowProfileMenu(false)}
                    />
                    <div className="fade-in" style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '0.5rem',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      boxShadow: 'var(--shadow-md)',
                      padding: '1rem',
                      minWidth: '220px',
                      zIndex: 1050
                    }}>
                      <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <User size={14} /> {user?.email || 'User'}
                        </p>
                      </div>
                      <button className="btn" onClick={handleLogout} style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                        <LogOut size={16} /> Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <main style={{ maxWidth: '64rem', margin: '0 auto', width: '100%' }}>
          {activeSection === 'modules' ? (
            <>
              {currentStep === 1 && (
                <ProfileModule
                  members={familyMembers}
                  setMembers={setFamilyMembers}
                  onNext={() => { handleStepProgression(2); }}
                />
              )}
              {currentStep === 2 && (
                <CashFlowModule
                  familyMembers={familyMembers}
                  income={income}
                  setIncome={setIncome}
                  expenseCategories={expenseCategories}
                  setExpenseCategories={setExpenseCategories}
                  currentYearLedger={currentYearLedger}
                  setCurrentYearLedger={setCurrentYearLedger}
                  cashFlowSubStep={cashFlowSubStep}
                  setCashFlowSubStep={setCashFlowSubStep}
                  planStartMonth={planStartMonth}
                  onNext={() => { handleStepProgression(3); setCashFlowSubStep(1); }}
                  onBack={() => { setCurrentStep(1); window.scrollTo(0, 0); }}
                  setCurrentStep={setCurrentStep}
                />
              )}
              {currentStep === 3 && (
                <AssetModule
                  assetCategories={assetCategories}
                  setAssetCategories={setAssetCategories}
                  liabilityCategories={liabilityCategories}
                  setLiabilityCategories={setLiabilityCategories}
                  onNext={() => { handleStepProgression(4); }}
                  onBack={() => { setCurrentStep(2); window.scrollTo(0, 0); }}
                />
              )}
              {currentStep === 4 && (
                <GoalModule
                  familyMembers={familyMembers}
                  goals={goals}
                  setGoals={setGoals}
                  onNext={() => { handleStepProgression(5); }}
                  onBack={() => { setCurrentStep(3); window.scrollTo(0, 0); }}
                />
              )}
              {currentStep === 5 && (
                <InsuranceModule
                  familyMembers={familyMembers}
                  policies={policies}
                  setPolicies={setPolicies}
                  expenseCategories={expenseCategories}
                  setExpenseCategories={setExpenseCategories}
                  investmentAllocations={investmentAllocations}
                  onNext={() => { handleStepProgression(6); }}
                  onBack={() => { setCurrentStep(4); window.scrollTo(0, 0); }}
                  setCurrentStep={setCurrentStep}
                />
              )}
              {currentStep === 6 && (
                <ProtectionGapModule
                  familyMembers={familyMembers}
                  expenseCategories={expenseCategories}
                  policies={policies}
                  assetCategories={assetCategories}
                  calculatorInputs={calculatorInputs}
                  proposedSIPs={proposedSIPs}
                  proposedEquities={proposedEquities}
                  goals={goals}
                  goalMappings={goalMappings}
                  onNext={() => { handleStepProgression(7); }}
                  onBack={() => { setCurrentStep(5); window.scrollTo(0, 0); }}
                />
              )}
              {currentStep === 7 && (
                <ContingencyModule
                  expenseCategories={expenseCategories}
                  contingencyFund={contingencyFund}
                  setContingencyFund={setContingencyFund}
                  onNext={() => { handleStepProgression(8); }}
                  onBack={() => { setCurrentStep(6); window.scrollTo(0, 0); }}
                />
              )}
              {currentStep === 8 && (
                <>
                {/* FLAG_PAYMENT_DISABLED: <CheckoutGate user={user} planId={planId} onBack={() => { setCurrentStep(7); window.scrollTo(0, 0); }}> */}
                  <JourneyModule
                    familyMembers={familyMembers}
                    income={income}
                    expenseCategories={expenseCategories}
                    goals={goals}
                    inflationRates={inflationRates}
                    setInflationRates={setInflationRates}
                    journeyAdjustments={journeyAdjustments}
                    setJourneyAdjustments={setJourneyAdjustments}
                    policies={policies}
                    projections={journeyProjections}
                    onNext={() => { handleStepProgression(9); }}
                    onBack={() => { setCurrentStep(7); window.scrollTo(0, 0); }}
                  />
                {/* FLAG_PAYMENT_DISABLED: </CheckoutGate> */}
                </>
              )}
              {currentStep === 9 && (
                <AllocationModule
                  familyMembers={familyMembers}
                  expenseCategories={expenseCategories}
                  netInvestibleSurplus={
                    (journeyProjections.find(p => p.year === new Date().getFullYear()))?.netInvestibleSurplus || 0
                  }
                  allocations={investmentAllocations}
                  setAllocations={setInvestmentAllocations}
                  projections={journeyProjections}
                  planStartMonth={planStartMonth}
                  onNext={() => { handleStepProgression(10); }}
                  onBack={() => { setCurrentStep(8); window.scrollTo(0, 0); }}
                />
              )}
              {currentStep === 10 && (
                <GrowthModule
                  familyMembers={familyMembers}
                  assetCategories={assetCategories}
                  expenseCategories={expenseCategories}
                  allocations={investmentAllocations}
                  goals={goals}
                  calculatorInputs={calculatorInputs}
                  journeyProjections={journeyProjections}
                  policies={policies}
                  goalMappings={goalMappings}
                  currentYearLedger={currentYearLedger}
                  onNext={() => { handleStepProgression(11); }}
                  onBack={() => { setCurrentStep(9); window.scrollTo(0, 0); }}
                />
              )}
              {currentStep === 11 && (
                <FulfillmentModule
                  familyMembers={familyMembers}
                  goals={expandedGoals}
                  allocations={investmentAllocations}
                  goalMappings={goalMappings}
                  setGoalMappings={setGoalMappings}
                  expenseCategories={expenseCategories}
                  calculatorInputs={calculatorInputs}
                  assetCategories={assetCategories}
                  loanProposals={loanProposals}
                  setLoanProposals={setLoanProposals}
                  allocationPlans={allocationPlans}
                  setAllocationPlans={setAllocationPlans}
                  onNext={() => { handleStepProgression(12); }}
                  onBack={() => { setCurrentStep(10); window.scrollTo(0, 0); }}
                />
              )}
              {currentStep === 12 && (
                <ReportView
                  familyMembers={familyMembers}
                  income={income}
                  expenseCategories={expenseCategories}
                  assetCategories={assetCategories}
                  liabilityCategories={liabilityCategories}
                  goals={expandedGoals}
                  policies={policies}
                  allocations={investmentAllocations}
                  goalMappings={goalMappings}
                  contingencyFund={contingencyFund}
                  journeyAdjustments={journeyAdjustments}
                  projections={journeyProjections}
                  calculatorInputs={calculatorInputs}
                  onBack={() => { setCurrentStep(11); window.scrollTo(0, 0); }}
                />
              )}
            </>
          ) : (
            <>
              {activeCalculator === 'tax' && (
                <IncomeTaxModule
                  familyMembers={familyMembers}
                  income={income}
                  isCalculatorMode={true}
                />
              )}
              {activeCalculator === 'sip' && (
                <SIPCalculator 
                  expenseCategories={expenseCategories} 
                  assetCategories={assetCategories} 
                  familyMembers={familyMembers}
                  proposedSIPs={proposedSIPs}
                  goalMappings={goalMappings}
                  goals={expandedGoals}
                  data={calculatorInputs.sip}
                  setData={updateCalculatorData('sip')}
                />
              )}
              {activeCalculator === 'per_loan' && (
                <PersonalLoanCalculator 
                  data={calculatorInputs.personal_loan}
                  setData={updateCalculatorData('personal_loan')}
                  expenseCategories={expenseCategories}
                  journeyAdjustments={journeyAdjustments}
                />
              )}
              {activeCalculator === 'home_loan' && (
                <HomeLoanCalculator 
                  data={calculatorInputs.home_loan}
                  setData={updateCalculatorData('home_loan')}
                  expenseCategories={expenseCategories}
                  journeyAdjustments={journeyAdjustments}
                />
              )}
              {activeCalculator === 'car_loan' && (
                <CarLoanCalculator 
                  data={calculatorInputs.car_loan}
                  setData={updateCalculatorData('car_loan')}
                  expenseCategories={expenseCategories}
                  journeyAdjustments={journeyAdjustments}
                />
              )}
              {activeCalculator === 'two_wheeler_loan' && (
                <TwoWheelerCalculator 
                  data={calculatorInputs.two_wheeler_loan}
                  setData={updateCalculatorData('two_wheeler_loan')}
                  expenseCategories={expenseCategories}
                  journeyAdjustments={journeyAdjustments}
                />
              )}
              {activeCalculator === 'edu_loan' && (
                <EducationLoanCalculator 
                  data={calculatorInputs.edu_loan}
                  setData={updateCalculatorData('edu_loan')}
                  expenseCategories={expenseCategories}
                  journeyAdjustments={journeyAdjustments}
                  loanProposals={loanProposals}
                />
              )}
              {activeCalculator === 'lumpsum' && (
                <LumpsumCalculator 
                  familyMembers={familyMembers} 
                  proposedLumpsums={proposedLumpsums}
                  goalMappings={goalMappings}
                  goals={expandedGoals}
                  data={calculatorInputs.lumpsum}
                  setData={updateCalculatorData('lumpsum')}
                />
              )}
              {activeCalculator === 'equity' && (
                <div className="calculator-wrapper slide-up" style={{ padding: '0.5rem', background: '#f8fafc', borderRadius: '12px' }}>
                  <EquityCalculator 
                    data={calculatorInputs.equity || {}} 
                    setData={updateCalculatorData('equity')} 
                    expenseCategories={expenseCategories}
                    assetCategories={assetCategories}
                    familyMembers={familyMembers}
                    proposedEquities={proposedEquities}
                    goalMappings={goalMappings}
                    goals={expandedGoals}
                  />
                </div>
              )}
              {activeCalculator === 'ppf' && (
                <PPFCalculator 
                  allocations={investmentAllocations}
                  expenseCategories={expenseCategories}
                  assetCategories={assetCategories}
                  data={calculatorInputs.ppf || { rate: 7.10 }}
                  setData={(val) => setCalculatorInputs(prev => ({ ...prev, ppf: val }))}
                />
              )}
              {activeCalculator === 'nps' && (
                <NPSCalculator 
                  allocations={investmentAllocations}
                  familyMembers={familyMembers}
                  expenseCategories={expenseCategories}
                  assetCategories={assetCategories}
                  data={calculatorInputs.nps || { rate: 10.00, annuity: 40, annuityRate: 6.00 }}
                  setData={(val) => setCalculatorInputs(prev => ({ ...prev, nps: val }))}
                />
              )}
              {activeCalculator === 'fd' && (
                <FDCalculator 
                  allocations={investmentAllocations}
                  expenseCategories={expenseCategories}
                  assetCategories={assetCategories}
                  data={calculatorInputs.fd || { rate: 7.00, frequency: 'Quarterly' }}
                  setData={(val) => setCalculatorInputs(prev => ({ ...prev, fd: val }))}
                />
              )}
              {activeCalculator === 'rd' && (
                <RDCalculator 
                  allocations={investmentAllocations}
                  expenseCategories={expenseCategories}
                  assetCategories={assetCategories}
                  data={calculatorInputs.rd || { rate: 7.00 }}
                  setData={(val) => setCalculatorInputs(prev => ({ ...prev, rd: val }))}
                />
              )}
              {activeCalculator === 'swp' && (
                <SWPCalculator 
                  data={calculatorInputs.swp}
                  setData={(val) => setCalculatorInputs(prev => ({ ...prev, swp: val }))}
                />
              )}
            </>
          )}
        </main>

        <footer style={{
          marginTop: '4rem',
          padding: '2rem 0',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
          borderTop: '1px solid var(--border)'
        }}>
          ┬⌐ 2026 FinPlan - Comprehensive Financial Planning Report
        </footer>
        </div>
      </div>
      </ProtectedRoute>
    </RoleBasedRouting>
  );
}

export default DetailedFlowLayout;
