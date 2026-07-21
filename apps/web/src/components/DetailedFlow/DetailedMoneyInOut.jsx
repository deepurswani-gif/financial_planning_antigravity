import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Pencil, Check } from 'lucide-react';
import DetailedProgressiveLayout from './DetailedProgressiveLayout';
import LoanDetailsModal from '../CashFlowModule/LoanDetailsModal';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import {
    createEmptyIncomeDetail,
    isSalariedEmployment,
    isBusinessEmployment,
    isPensionerEmployment,
    isGovernmentSector,
    prefillDetailFromSummaryAmount,
    applyDetailSyncToIncome,
    reconcileMemberIncome,
    getMemberDetailMonthlyTotal,
    getSummaryIncomeTarget,
    shouldIncludeSpouseIncome,
    TDS_ASSUMPTION_NOTE,
    TDS_ALREADY_DEDUCTED_NOTE,
} from './incomeDetailSync';
import ReconciliationBar from './ReconciliationBar';
import { guessEmploymentTypeFromSummaryOccupation } from './employmentTypeSync';
import { useExpenseEmiQuestions } from './useExpenseEmiQuestions';
import { useInsurancePremiumQuestions } from './useInsurancePremiumQuestions';
import { useSavingsInvestmentQuestions } from './useSavingsInvestmentQuestions';
import LifePolicyDetailsModal from './LifePolicyDetailsModal';
import InvestmentDetailsModal from '../CashFlowModule/InvestmentDetailsModal';
import { EMI_LOAN_KEYS } from './expenseDetailSync';
import { useSmartEditActivation } from '../FinancialWorkspace/smartEdit/activationChannel';
import SmartEditInstancePicker from '../FinancialWorkspace/smartEdit/SmartEditInstancePicker';
import { resolveInstanceActivation } from '../../experienceRegistry';

const formatInr = (val) => {
    if (!val || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(val);
};

const CurrencyField = ({ label, value, onChange, placeholder = '0', readOnly = false }) => (
    <div>
        {label && (
            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                {label}
            </label>
        )}
        <div className="currency-input-wrapper">
            <span className="currency-symbol">₹</span>
            <input
                type="number"
                className="conversational-input"
                placeholder={placeholder}
                value={value || ''}
                readOnly={readOnly}
                onChange={(e) => !readOnly && onChange(e.target.value)}
                style={readOnly ? {
                    background: 'var(--bg-main)',
                    color: 'var(--text-muted)',
                    cursor: 'default',
                } : undefined}
            />
        </div>
    </div>
);

const AssumptionNote = ({ children }) => (
    <div style={{
        padding: '0.75rem 1rem',
        background: '#f0f9ff',
        borderLeft: '4px solid #0284c7',
        borderRadius: '4px',
        marginTop: '0.75rem',
        fontSize: '0.82rem',
        color: '#0c4a6e',
        textAlign: 'left',
    }}>
        <strong>Assumption:</strong> {children}
    </div>
);

const DetailedMoneyInOut = () => {
    const { familyMembers, income, setIncome, hasSpouseIncome, policies, setPolicies } = useFinancialPlan();
    const [editingRecap, setEditingRecap] = useState(false);
    const [recapSelf, setRecapSelf] = useState('');
    const [recapSpouse, setRecapSpouse] = useState('');

    const selfMember = familyMembers.find(m => m.relation === 'Self') || {};
    const spouseMember = familyMembers.find(m => m.relation === 'Spouse');
    const selfEmploymentType = selfMember.employmentType
        || guessEmploymentTypeFromSummaryOccupation(selfMember.occupation)
        || 'Private Sector';
    const spouseEmploymentType = spouseMember?.employmentType
        || guessEmploymentTypeFromSummaryOccupation(spouseMember?.occupation)
        || 'Private Sector';
    const includeSpouse = shouldIncludeSpouseIncome(spouseMember, hasSpouseIncome, income);

    const selfDetail = income.selfDetail || createEmptyIncomeDetail();
    const spouseDetail = income.spouseDetail || createEmptyIncomeDetail();

    useEffect(() => {
        setIncome(prev => {
            const selfType = selfMember.employmentType
                || guessEmploymentTypeFromSummaryOccupation(selfMember.occupation)
                || 'Private Sector';
            const spouseType = spouseMember?.employmentType
                || guessEmploymentTypeFromSummaryOccupation(spouseMember?.occupation)
                || 'Private Sector';
            const working = shouldIncludeSpouseIncome(spouseMember, hasSpouseIncome, prev);
            if (prev.selfDetail?.inHandSalary || prev.selfDetail?.takeHomeProfit || prev.selfDetail?.netPension) {
                return prev;
            }
            const selfD = prefillDetailFromSummaryAmount(prev.selfDetail, prev.summarySelfInHand || prev.self, selfType);
            const spouseD = prefillDetailFromSummaryAmount(prev.spouseDetail, prev.summarySpouseInHand || prev.spouse, spouseType);
            return applyDetailSyncToIncome(
                { ...prev, selfDetail: selfD, spouseDetail: spouseD },
                selfType,
                working ? spouseType : null,
            );
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const syncAndSetIncome = useCallback((updater) => {
        setIncome(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            return applyDetailSyncToIncome(
                next,
                selfEmploymentType,
                includeSpouse ? spouseEmploymentType : null,
            );
        });
    }, [setIncome, selfEmploymentType, spouseEmploymentType, includeSpouse]);

    const updateDetail = useCallback((memberKey, updater) => {
        const detailKey = memberKey === 'self' ? 'selfDetail' : 'spouseDetail';
        syncAndSetIncome(prev => {
            const current = prev[detailKey] || createEmptyIncomeDetail();
            const updated = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
            return { ...prev, [detailKey]: updated };
        });
    }, [syncAndSetIncome]);

    const updateTaxField = useCallback((memberKey, section, field, value) => {
        updateDetail(memberKey, (d) => ({
            ...d,
            taxPlanning: {
                ...d.taxPlanning,
                [section]: {
                    ...d.taxPlanning?.[section],
                    [field]: value,
                },
            },
        }));
    }, [updateDetail]);

    const updateOtherIncome = useCallback((memberKey, index, field, value) => {
        updateDetail(memberKey, (d) => {
            const list = [...(d.otherIncome || [{ name: '', amount: '' }])];
            list[index] = { ...list[index], [field]: value };
            return { ...d, otherIncome: list };
        });
    }, [updateDetail]);

    const addOtherIncome = useCallback((memberKey) => {
        updateDetail(memberKey, (d) => ({
            ...d,
            otherIncome: [...(d.otherIncome || []), { name: '', amount: '' }],
        }));
    }, [updateDetail]);

    const removeOtherIncome = useCallback((memberKey, index) => {
        updateDetail(memberKey, (d) => {
            const list = (d.otherIncome || []).filter((_, i) => i !== index);
            return { ...d, otherIncome: list.length ? list : [{ name: '', amount: '' }] };
        });
    }, [updateDetail]);

    const yesNoToggle = (value, onYes, onNo) => (
        <div className="yes-no-toggle">
            <button type="button" className={`yes-no-btn ${value === true ? 'active-yes' : ''}`} onClick={onYes}>Yes</button>
            <button type="button" className={`yes-no-btn ${value === false ? 'active-no' : ''}`} onClick={onNo}>No</button>
        </div>
    );

    const otherIncomeFields = (memberKey, detail) => (
        <div style={{ marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                Any other source of income
            </label>
            {(detail.otherIncome || [{ name: '', amount: '' }]).map((item, index) => (
                <div key={index} style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.75rem', position: 'relative' }}>
                    {(detail.otherIncome?.length || 1) > 1 && (
                        <button
                            type="button"
                            onClick={() => removeOtherIncome(memberKey, index)}
                            style={{ position: 'absolute', right: 0, top: 0, background: 'transparent', border: 'none', color: 'var(--negative)', cursor: 'pointer' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                    <input
                        type="text"
                        className="conversational-input"
                        placeholder="Source name (e.g. Freelance)"
                        value={item.name || ''}
                        onChange={(e) => updateOtherIncome(memberKey, index, 'name', e.target.value)}
                    />
                    <CurrencyField
                        value={item.amount}
                        onChange={(v) => updateOtherIncome(memberKey, index, 'amount', v)}
                        placeholder="Monthly amount"
                    />
                </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={() => addOtherIncome(memberKey)} style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}>
                <Plus size={14} style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} /> Add another source
            </button>
        </div>
    );

    const buildTaxEarningsFields = (memberKey, detail, employmentType) => {
        const isGov = isGovernmentSector(employmentType);
        const e = detail.taxPlanning?.earnings || {};

        return (
            <>
                <CurrencyField label="Basic Pay" value={e.basicPay} onChange={(v) => updateTaxField(memberKey, 'earnings', 'basicPay', v)} />
                <CurrencyField label="Dearness Allowance" value={e.dearnessAllowance} onChange={(v) => updateTaxField(memberKey, 'earnings', 'dearnessAllowance', v)} />
                <CurrencyField label="House Rent Allowance" value={e.houseRentAllowance} onChange={(v) => updateTaxField(memberKey, 'earnings', 'houseRentAllowance', v)} />
                <CurrencyField label="Allowances (All)" value={e.allowances} onChange={(v) => updateTaxField(memberKey, 'earnings', 'allowances', v)} />
                {isGov ? (
                    <>
                        <CurrencyField label="Leave Encashment (Annual)" value={e.leaveEncashment} onChange={(v) => updateTaxField(memberKey, 'earnings', 'leaveEncashment', v)} />
                        <CurrencyField label="Annual Bonus" value={e.bonus} onChange={(v) => updateTaxField(memberKey, 'earnings', 'bonus', v)} />
                    </>
                ) : (
                    <CurrencyField label="Annual Performance Bonus" value={e.performanceBonus} onChange={(v) => updateTaxField(memberKey, 'earnings', 'performanceBonus', v)} />
                )}
                <input
                    type="text"
                    className="conversational-input"
                    placeholder="Other earning name"
                    value={e.other?.name || ''}
                    onChange={(ev) => updateTaxField(memberKey, 'earnings', 'other', { ...e.other, name: ev.target.value })}
                />
                <CurrencyField
                    value={e.other?.amount}
                    onChange={(v) => updateTaxField(memberKey, 'earnings', 'other', { ...e.other, amount: v })}
                    placeholder="Annual amount"
                />
            </>
        );
    };

    const buildTaxDeductionsFields = (memberKey, detail, employmentType) => {
        const isGov = isGovernmentSector(employmentType);
        const d = detail.taxPlanning?.deductions || {};

        return (
            <>
                <CurrencyField
                    label={isGov ? 'Employee PF / NPS' : 'Employee PF'}
                    value={d.employeePF}
                    onChange={(v) => updateTaxField(memberKey, 'deductions', 'employeePF', v)}
                />
                <CurrencyField
                    label="Income Tax (TDS)"
                    value={d.incomeTax}
                    onChange={(v) => updateTaxField(memberKey, 'deductions', 'incomeTax', v)}
                />
                {isGov ? (
                    <>
                        <CurrencyField label="Group Insurance" value={d.groupInsurance} onChange={(v) => updateTaxField(memberKey, 'deductions', 'groupInsurance', v)} />
                        <CurrencyField label="Health Scheme" value={d.healthScheme} onChange={(v) => updateTaxField(memberKey, 'deductions', 'healthScheme', v)} />
                    </>
                ) : (
                    <>
                        <CurrencyField label="Group Personal Accident" value={d.groupPersonalAccident} onChange={(v) => updateTaxField(memberKey, 'deductions', 'groupPersonalAccident', v)} />
                        <CurrencyField label="Group Medical Coverage" value={d.groupMedicalCoverage} onChange={(v) => updateTaxField(memberKey, 'deductions', 'groupMedicalCoverage', v)} />
                    </>
                )}
                <input
                    type="text"
                    className="conversational-input"
                    placeholder="Other deduction name"
                    value={d.other?.name || ''}
                    onChange={(ev) => updateTaxField(memberKey, 'deductions', 'other', { ...d.other, name: ev.target.value })}
                />
                <CurrencyField
                    value={d.other?.amount}
                    onChange={(v) => updateTaxField(memberKey, 'deductions', 'other', { ...d.other, amount: v })}
                    placeholder="Other deduction amount"
                />
            </>
        );
    };

    const buildMainScreen = (memberKey, detail, employmentType, personLabel) => {
        const isSal = isSalariedEmployment(employmentType);
        const isBiz = isBusinessEmployment(employmentType);
        const isPen = isPensionerEmployment(employmentType);
        const showTaxSlip = isSal && detail.needTaxPlanning === true;
        const showSimpleSalaried = isSal && detail.needTaxPlanning === false;
        const summaryAmount = getSummaryIncomeTarget(income, memberKey);
        const memberReconciliation = reconcileMemberIncome(summaryAmount, detail, employmentType);
        const detailTotal = getMemberDetailMonthlyTotal(detail, employmentType);

        return (
            <div className="question-container">
                <p className="question-narrative">{personLabel} income details</p>
                <h2 className="question-title">Money coming in</h2>
                {parseFloat(summaryAmount) > 0 && (
                    <ReconciliationBar
                        summaryLabel="Summary Income"
                        detailLabel="Detailed income"
                        summaryAmount={summaryAmount}
                        detailAmount={detailTotal}
                        reconciliation={memberReconciliation}
                    />
                )}
                <div
                    className={`question-fields${showTaxSlip ? ' question-fields--expanded' : ''}`}
                    style={{
                        maxWidth: showTaxSlip ? '820px' : '420px',
                        margin: '0 auto',
                        gap: '1rem',
                    }}
                >
                    {isSal && (
                        <div>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.75rem', display: 'block' }}>
                                Do you need Tax planning
                            </label>
                            {yesNoToggle(
                                detail.needTaxPlanning === true ? true : detail.needTaxPlanning === false ? false : null,
                                () => updateDetail(memberKey, { needTaxPlanning: true }),
                                () => updateDetail(memberKey, { needTaxPlanning: false }),
                            )}
                        </div>
                    )}

                    {showSimpleSalaried && (
                        <>
                            <CurrencyField
                                label="In-hand-salary"
                                value={detail.inHandSalary}
                                onChange={(v) => updateDetail(memberKey, { inHandSalary: v })}
                            />
                            {otherIncomeFields(memberKey, detail)}
                            <AssumptionNote>{TDS_ALREADY_DEDUCTED_NOTE}</AssumptionNote>
                        </>
                    )}

                    {showTaxSlip && (
                        <>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textAlign: 'center' }}>
                                Break down your earnings and deductions — like filling a salary slip.
                            </p>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                                    gap: '1.25rem',
                                }}
                            >
                                <div
                                    className="card"
                                    style={{
                                        padding: '1rem',
                                        border: '1px solid var(--border)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.85rem',
                                    }}
                                >
                                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--primary)', textAlign: 'center' }}>
                                        Earnings
                                    </h3>
                                    {buildTaxEarningsFields(memberKey, detail, employmentType)}
                                </div>
                                <div
                                    className="card"
                                    style={{
                                        padding: '1rem',
                                        border: '1px solid var(--border)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.85rem',
                                    }}
                                >
                                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--primary)', textAlign: 'center' }}>
                                        Deductions
                                    </h3>
                                    {buildTaxDeductionsFields(memberKey, detail, employmentType)}
                                </div>
                            </div>
                            <CurrencyField
                                label="Gross Salary"
                                value={detail.grossSalary}
                                readOnly
                            />
                            <CurrencyField
                                label="In-hand-salary"
                                value={detail.inHandSalary}
                                readOnly
                            />
                            {otherIncomeFields(memberKey, detail)}
                            <AssumptionNote>{TDS_ASSUMPTION_NOTE}</AssumptionNote>
                        </>
                    )}

                    {isBiz && (
                        <>
                            <CurrencyField
                                label="Take-home-profit"
                                value={detail.takeHomeProfit}
                                onChange={(v) => updateDetail(memberKey, { takeHomeProfit: v })}
                            />
                            <CurrencyField
                                label="Passive Income like rent"
                                value={detail.passiveIncome}
                                onChange={(v) => updateDetail(memberKey, { passiveIncome: v })}
                            />
                            {otherIncomeFields(memberKey, detail)}
                        </>
                    )}
                    {isPen && (
                        <>
                            <CurrencyField
                                label="Net Pension Received"
                                value={detail.netPension}
                                onChange={(v) => updateDetail(memberKey, { netPension: v })}
                            />
                            {otherIncomeFields(memberKey, detail)}
                        </>
                    )}
                </div>
            </div>
        );
    };

    const buildMemberQuestions = (memberKey, detail, employmentType, personLabel) => ([{
        id: `${memberKey}-main`,
        content: buildMainScreen(memberKey, detail, employmentType, personLabel),
    }]);

    const saveRecapEdits = () => {
        syncAndSetIncome(prev => {
            const selfD = prefillDetailFromSummaryAmount(
                { ...createEmptyIncomeDetail(), ...prev.selfDetail },
                recapSelf,
                selfEmploymentType,
            );
            let next = {
                ...prev,
                summarySelfInHand: recapSelf,
                selfDetail: selfD,
            };

            if (includeSpouse) {
                const spouseD = prefillDetailFromSummaryAmount(
                    { ...createEmptyIncomeDetail(), ...prev.spouseDetail },
                    recapSpouse,
                    spouseEmploymentType,
                );
                next = {
                    ...next,
                    summarySpouseInHand: recapSpouse,
                    spouseDetail: spouseD,
                };
            }
            return next;
        });
        setEditingRecap(false);
    };

    useEffect(() => {
        setRecapSelf(getSummaryIncomeTarget(income, 'self'));
        setRecapSpouse(getSummaryIncomeTarget(income, 'spouse'));
    }, [income.summarySelfInHand, income.summarySpouseInHand, income.self, income.spouse]);

    const {
        householdQuestions,
        emiQuestions,
        activeLoanModal,
        setActiveLoanModal,
        emi,
        handleEmiSave,
    } = useExpenseEmiQuestions();

    const {
        insuranceQuestions,
        showPolicyDetailsModal,
        setShowPolicyDetailsModal,
        policyDetailsMembers,
        lifeUploadHelpModal,
    } = useInsurancePremiumQuestions();

    const {
        savingsQuestions,
        activeInvModal,
        setActiveInvModal,
        handleInvSave,
        activeInvInitialData,
        activeInvTitle,
        rdInstances,
        openRd,
        addRd,
        openInvestment,
    } = useSavingsInvestmentQuestions();

    const [rdPickerOpen, setRdPickerOpen] = useState(false);

    // Smart Edit activation — open the correct existing configure experience
    // immediately after landing (no chevrons, no manual Configure click).
    const onActivate = useCallback((request) => {
        switch (request.channel) {
            case 'loanModal':
                if (request.key) setActiveLoanModal(request.key);
                return true;
            case 'lifePolicyModal':
                setShowPolicyDetailsModal(true);
                return true;
            case 'investmentModal':
                if (request.key) openInvestment(request.key);
                return true;
            case 'rdCollection': {
                // A known entity carries the exact index — open it directly.
                if (request.index != null) {
                    openRd(request.index);
                    return true;
                }
                const strategy = resolveInstanceActivation(rdInstances);
                if (strategy === 'openAddFlow') addRd();
                else if (strategy === 'openExistingInstance') openRd(0);
                else setRdPickerOpen(true);
                return true;
            }
            default:
                return false;
        }
    }, [setActiveLoanModal, setShowPolicyDetailsModal, openInvestment, rdInstances, addRd, openRd]);

    useSmartEditActivation(onActivate);

    const questions = useMemo(() => {
        const list = [{
            id: 'recap',
            content: (
                <div className="question-container">
                    <p className="question-narrative">
                        Here is what we captured in your summary. Let&apos;s refine your income in more detail.
                    </p>
                    <div className="card" style={{ padding: '1.25rem', textAlign: 'left' }}>
                        {!editingRecap ? (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)' }}>Summary income totals</h3>
                                    <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => setEditingRecap(true)}>
                                        <Pencil size={14} style={{ marginRight: '0.35rem' }} /> Edit
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.95rem' }}>
                                    <div><strong>{selfMember.name || 'Self'}:</strong> {formatInr(getSummaryIncomeTarget(income, 'self'))} / month</div>
                                    {includeSpouse && (
                                        <div><strong>{spouseMember?.name || 'Spouse'}:</strong> {formatInr(getSummaryIncomeTarget(income, 'spouse'))} / month</div>
                                    )}
                                    <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        Employment: {selfEmploymentType}{includeSpouse ? ` · Spouse: ${spouseEmploymentType}` : ''}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)' }}>Edit in-hand amounts</h3>
                                    <button type="button" className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={saveRecapEdits}>
                                        <Check size={14} style={{ marginRight: '0.35rem' }} /> Done
                                    </button>
                                </div>
                                <div className="question-fields" style={{ gap: '1rem' }}>
                                    <CurrencyField
                                        label={`${selfMember.name || 'Self'} — in-hand-salary / take-home-profit`}
                                        value={recapSelf}
                                        onChange={setRecapSelf}
                                    />
                                    {includeSpouse && (
                                        <CurrencyField
                                            label={`${spouseMember?.name || 'Spouse'} — in-hand-salary / take-home-profit`}
                                            value={recapSpouse}
                                            onChange={setRecapSpouse}
                                        />
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ),
        }];

        list.push(...buildMemberQuestions('self', selfDetail, selfEmploymentType, selfMember.name || 'Your'));

        if (includeSpouse) {
            list.push(...buildMemberQuestions('spouse', spouseDetail, spouseEmploymentType, spouseMember?.name || 'Spouse'));
        }

        list.push(...householdQuestions);
        list.push(...insuranceQuestions);
        list.push(...emiQuestions);
        list.push(...savingsQuestions);

        return list;
    }, [
        editingRecap, income.self, income.spouse, income.summarySelfInHand, income.summarySpouseInHand,
        selfDetail, spouseDetail,
        selfEmploymentType, spouseEmploymentType, includeSpouse, selfMember.name,
        spouseMember?.name, recapSelf, recapSpouse, householdQuestions, emiQuestions, insuranceQuestions, savingsQuestions,
        updateDetail, updateTaxField, updateOtherIncome, addOtherIncome, removeOtherIncome,
    ]);

    const activeLoanMeta = EMI_LOAN_KEYS.find(l => l.key === activeLoanModal);

    return (
        <>
            <DetailedProgressiveLayout
                currentStepId="money_in_out"
                questions={questions}
                narrative="Thank you. I now have a clearer picture of your money in and money out — including your savings and investments."
                lastSectionLabel="Save & Continue"
                contentWidth="wide"
            />
            {lifeUploadHelpModal}
            {showPolicyDetailsModal && (
                <LifePolicyDetailsModal
                    isOpen={showPolicyDetailsModal}
                    onClose={() => setShowPolicyDetailsModal(false)}
                    familyMembers={policyDetailsMembers}
                    policies={policies}
                    setPolicies={setPolicies}
                />
            )}
            {activeLoanModal && (
                <LoanDetailsModal
                    isOpen={!!activeLoanModal}
                    onClose={() => setActiveLoanModal(null)}
                    onSave={(data) => handleEmiSave(activeLoanModal, data)}
                    initialData={typeof emi[activeLoanModal] === 'object' ? emi[activeLoanModal] : null}
                    loanTypeTitle={activeLoanMeta?.label || 'Loan Details'}
                />
            )}
            {activeInvModal && (
                <InvestmentDetailsModal
                    isOpen={!!activeInvModal}
                    onClose={() => setActiveInvModal(null)}
                    initialData={activeInvInitialData}
                    investmentTypeTitle={activeInvTitle}
                    onSave={handleInvSave}
                />
            )}
            <SmartEditInstancePicker
                open={rdPickerOpen}
                title="Which Recurring Deposit?"
                instances={rdInstances}
                getLabel={(rd, i) => `RD #${i + 1}`}
                getSublabel={(rd) => (rd && typeof rd === 'object' && rd.amount ? `₹${rd.amount}` : null)}
                addLabel="Add a new RD"
                onSelect={(index) => { setRdPickerOpen(false); openRd(index); }}
                onAdd={() => { setRdPickerOpen(false); addRd(); }}
                onClose={() => setRdPickerOpen(false)}
            />
        </>
    );
};

export default DetailedMoneyInOut;
