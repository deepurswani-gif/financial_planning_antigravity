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
} from './incomeDetailSync';
import { guessEmploymentTypeFromSummaryOccupation } from './employmentTypeSync';
import { useExpenseEmiQuestions } from './useExpenseEmiQuestions';
import { EMI_LOAN_KEYS } from './expenseDetailSync';

const formatInr = (val) => {
    if (!val || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(val);
};

const CurrencyField = ({ label, value, onChange, placeholder = '0' }) => (
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
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    </div>
);

const DetailedMoneyInOut = () => {
    const { familyMembers, income, setIncome, hasSpouseIncome } = useFinancialPlan();
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
    const includeSpouse = spouseMember?.isSpouseWorking === true || hasSpouseIncome === true;

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
            const working = spouseMember?.isSpouseWorking === true || hasSpouseIncome === true;
            if (prev.selfDetail?.inHandSalary || prev.selfDetail?.takeHomeProfit || prev.selfDetail?.netPension) {
                return prev;
            }
            const selfD = prefillDetailFromSummaryAmount(prev.selfDetail, prev.self, selfType);
            const spouseD = prefillDetailFromSummaryAmount(prev.spouseDetail, prev.spouse, spouseType);
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
                        <CurrencyField label="Leave Encashment" value={e.leaveEncashment} onChange={(v) => updateTaxField(memberKey, 'earnings', 'leaveEncashment', v)} />
                        <CurrencyField label="Bonus" value={e.bonus} onChange={(v) => updateTaxField(memberKey, 'earnings', 'bonus', v)} />
                    </>
                ) : (
                    <CurrencyField label="Performance Bonus" value={e.performanceBonus} onChange={(v) => updateTaxField(memberKey, 'earnings', 'performanceBonus', v)} />
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
                    placeholder="Other earning amount"
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

        return (
            <div className="question-container">
                <p className="question-narrative">{personLabel} income details</p>
                <h2 className="question-title">Money coming in</h2>
                <div
                    className="question-fields"
                    style={{
                        maxWidth: showTaxSlip ? '820px' : '420px',
                        margin: '0 auto',
                        gap: '1rem',
                    }}
                >
                    {isSal && (
                        <>
                            <CurrencyField
                                label="Gross Salary"
                                value={detail.grossSalary}
                                onChange={(v) => updateDetail(memberKey, { grossSalary: v })}
                            />
                            <CurrencyField
                                label="In-hand-salary"
                                value={detail.inHandSalary}
                                onChange={(v) => updateDetail(memberKey, { inHandSalary: v })}
                            />
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
                        </>
                    )}
                    {isPen && (
                        <CurrencyField
                            label="Net Pension Received"
                            value={detail.netPension}
                            onChange={(v) => updateDetail(memberKey, { netPension: v })}
                        />
                    )}
                    {otherIncomeFields(memberKey, detail)}
                    {isSal && (
                        <div style={{ marginTop: '0.5rem' }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.75rem', display: 'block' }}>
                                I need Tax planning
                            </label>
                            {yesNoToggle(
                                detail.needTaxPlanning === true ? true : detail.needTaxPlanning === false ? false : null,
                                () => updateDetail(memberKey, { needTaxPlanning: true }),
                                () => updateDetail(memberKey, { needTaxPlanning: false }),
                            )}
                        </div>
                    )}
                    {showTaxSlip && (
                        <div
                            style={{
                                marginTop: '1.25rem',
                                paddingTop: '1.25rem',
                                borderTop: '1px solid var(--border)',
                                textAlign: 'left',
                            }}
                        >
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center' }}>
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
                        </div>
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
            const selfD = { ...createEmptyIncomeDetail(), ...prev.selfDetail };
            if (isSalariedEmployment(selfEmploymentType)) selfD.inHandSalary = recapSelf;
            else if (isBusinessEmployment(selfEmploymentType)) selfD.takeHomeProfit = recapSelf;
            else if (isPensionerEmployment(selfEmploymentType)) selfD.netPension = recapSelf;

            let next = { ...prev, self: recapSelf, selfDetail: selfD };

            if (includeSpouse) {
                const spouseD = { ...createEmptyIncomeDetail(), ...prev.spouseDetail };
                if (isSalariedEmployment(spouseEmploymentType)) spouseD.inHandSalary = recapSpouse;
                else if (isBusinessEmployment(spouseEmploymentType)) spouseD.takeHomeProfit = recapSpouse;
                else if (isPensionerEmployment(spouseEmploymentType)) spouseD.netPension = recapSpouse;
                next = { ...next, spouse: recapSpouse, spouseDetail: spouseD };
            }
            return next;
        });
        setEditingRecap(false);
    };

    useEffect(() => {
        setRecapSelf(income.self || '');
        setRecapSpouse(income.spouse || '');
    }, [income.self, income.spouse]);

    const {
        expenseQuestions,
        activeLoanModal,
        setActiveLoanModal,
        emi,
        handleEmiSave,
    } = useExpenseEmiQuestions();

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
                                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)' }}>Summary in-hand amounts</h3>
                                    <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => setEditingRecap(true)}>
                                        <Pencil size={14} style={{ marginRight: '0.35rem' }} /> Edit
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.95rem' }}>
                                    <div><strong>{selfMember.name || 'Self'}:</strong> {formatInr(income.self)} / month</div>
                                    {includeSpouse && (
                                        <div><strong>{spouseMember?.name || 'Spouse'}:</strong> {formatInr(income.spouse)} / month</div>
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

        list.push(...expenseQuestions);

        return list;
    }, [
        editingRecap, income.self, income.spouse, selfDetail, spouseDetail,
        selfEmploymentType, spouseEmploymentType, includeSpouse, selfMember.name,
        spouseMember?.name, recapSelf, recapSpouse, expenseQuestions,
        updateDetail, updateTaxField, updateOtherIncome, addOtherIncome, removeOtherIncome,
    ]);

    const activeLoanMeta = EMI_LOAN_KEYS.find(l => l.key === activeLoanModal);

    return (
        <>
            <DetailedProgressiveLayout
                currentStepId="money_in_out"
                questions={questions}
                narrative="Thank you. I now have a clearer picture of your money in and money out. Next we'll capture your insurance premiums."
                lastSectionLabel="Save & Continue"
            />
            {activeLoanModal && (
                <LoanDetailsModal
                    isOpen={!!activeLoanModal}
                    onClose={() => setActiveLoanModal(null)}
                    onSave={(data) => handleEmiSave(activeLoanModal, data)}
                    initialData={typeof emi[activeLoanModal] === 'object' ? emi[activeLoanModal] : null}
                    loanTypeTitle={activeLoanMeta?.label || 'Loan Details'}
                />
            )}
        </>
    );
};

export default DetailedMoneyInOut;
