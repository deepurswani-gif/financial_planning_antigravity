import React, { useCallback } from 'react';
import {
    calculateIncomeTaxFromDetail,
    showPensionerTaxNote,
    showTaxPlanningDisabledNote,
    showTaxSlipRequiredNote,
    PENSIONER_STANDARD_DEDUCTION_NOTE,
    TAX_PLANNING_DISABLED_NOTE,
    TAX_SLIP_REQUIRED_NOTE,
} from './IncomeTaxLogic';
import IncomeTaxOutput from './IncomeTaxOutput';
import { guessEmploymentTypeFromSummaryOccupation } from '../DetailedFlow/employmentTypeSync';
import { createEmptyIncomeDetail, isSalariedEmployment, isGovernmentSector, applyDetailSyncToIncome } from '../DetailedFlow/incomeDetailSync';
import CurrencyInput from '../common/CurrencyInput';

const toStored = (v) => (v == null ? '' : String(v));

const CurrencyField = ({ label, value, onChange, placeholder = '0', readOnly = false }) => (
    <div>
        {label && (
            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                {label}
            </label>
        )}
        <CurrencyInput
            className="conversational-input"
            placeholder={placeholder}
            value={value ?? ''}
            readOnly={readOnly}
            onValueChange={(v) => {
                if (!readOnly) onChange(toStored(v));
            }}
            style={readOnly ? {
                background: 'var(--bg-main)',
                color: 'var(--text-muted)',
                cursor: 'default',
            } : undefined}
        />
    </div>
);

const resolveEmploymentType = (member) => (
    member?.employmentType || guessEmploymentTypeFromSummaryOccupation(member?.occupation) || 'Private Sector'
);

const IncomeTaxModule = ({ familyMembers, income, onNext, onBack, isCalculatorMode = false, setIncome }) => {
    const selfMember = familyMembers.find(m => m.relation?.toLowerCase() === 'self') || { name: 'Self', occupation: 'Salaried' };
    const spouseMember = familyMembers.find(m => m.relation?.toLowerCase() === 'spouse');

    const isSpouseHousewife = spouseMember?.occupation?.toLowerCase() === 'housewife';

    const selfEmploymentType = resolveEmploymentType(selfMember);
    const spouseEmploymentType = resolveEmploymentType(spouseMember);

    const selfDetail = income.selfDetail || createEmptyIncomeDetail();
    const spouseDetail = income.spouseDetail || createEmptyIncomeDetail();

    const selfTaxResults = calculateIncomeTaxFromDetail(selfDetail, selfEmploymentType);

    let spouseTaxResults = null;
    if (spouseMember && !isSpouseHousewife) {
        spouseTaxResults = calculateIncomeTaxFromDetail(spouseDetail, spouseEmploymentType);
    }

    const updateTaxField = useCallback((memberKey, section, field, value) => {
        if (!setIncome) return;
        setIncome(prev => {
            const detailKey = memberKey === 'self' ? 'selfDetail' : 'spouseDetail';
            const currentDetail = prev[detailKey] || createEmptyIncomeDetail();
            const updatedDetail = {
                ...currentDetail,
                needTaxPlanning: true,
                taxPlanning: {
                    ...currentDetail.taxPlanning,
                    [section]: {
                        ...currentDetail.taxPlanning?.[section],
                        [field]: value,
                    },
                },
            };
            const nextIncome = {
                ...prev,
                [detailKey]: updatedDetail
            };
            return applyDetailSyncToIncome(
                nextIncome,
                selfEmploymentType,
                spouseMember ? spouseEmploymentType : null
            );
        });
    }, [setIncome, selfEmploymentType, spouseEmploymentType, spouseMember]);

    const buildTaxEarningsFields = (memberKey, detail, employmentType) => {
        const isGov = isGovernmentSector(employmentType);
        const e = detail.taxPlanning?.earnings || {};

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Other Earning</label>
                    <input
                        type="text"
                        className="conversational-input"
                        style={{ marginBottom: '0.5rem' }}
                        placeholder="Other earning name"
                        value={e.other?.name || ''}
                        onChange={(ev) => updateTaxField(memberKey, 'earnings', 'other', { ...e.other, name: ev.target.value })}
                    />
                    <CurrencyField
                        value={e.other?.amount}
                        onChange={(v) => updateTaxField(memberKey, 'earnings', 'other', { ...e.other, amount: v })}
                        placeholder="Annual amount"
                    />
                </div>
            </div>
        );
    };

    const buildTaxDeductionsFields = (memberKey, detail, employmentType) => {
        const isGov = isGovernmentSector(employmentType);
        const d = detail.taxPlanning?.deductions || {};

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Other Deduction</label>
                    <input
                        type="text"
                        className="conversational-input"
                        style={{ marginBottom: '0.5rem' }}
                        placeholder="Other deduction name"
                        value={d.other?.name || ''}
                        onChange={(ev) => updateTaxField(memberKey, 'deductions', 'other', { ...d.other, name: ev.target.value })}
                    />
                    <CurrencyField
                        value={d.other?.amount}
                        onChange={(v) => updateTaxField(memberKey, 'deductions', 'other', { ...d.other, amount: v })}
                        placeholder="Annual amount"
                    />
                </div>
            </div>
        );
    };

    const renderMemberTax = (member, employmentType, detail, taxResults, memberKey) => {
        const isSalaried = isSalariedEmployment(employmentType);

        return (
            <>
                {isSalaried && (
                    <div style={{ marginBottom: '2rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#0f172a' }}>Salary Slip Details</h3>
                        <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1.5rem' }}>
                            Fill in your detailed earnings and deductions to accurately calculate your income tax.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                            <div>
                                <h4 style={{ color: '#334155', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Earnings</h4>
                                {buildTaxEarningsFields(memberKey, detail, employmentType)}
                            </div>
                            <div>
                                <h4 style={{ color: '#334155', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Deductions</h4>
                                {buildTaxDeductionsFields(memberKey, detail, employmentType)}
                            </div>
                        </div>
                    </div>
                )}
                {showPensionerTaxNote(employmentType) && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: '#fefce8',
                        borderLeft: '4px solid #ca8a04',
                        borderRadius: '4px',
                        marginBottom: '1rem',
                        fontSize: '0.85rem',
                        color: '#854d0e',
                    }}>
                        <strong>Assumption:</strong> {PENSIONER_STANDARD_DEDUCTION_NOTE}
                    </div>
                )}
                {taxResults && <IncomeTaxOutput results={taxResults} />}
            </>
        );
    };

    return (
        <div className="fade-in" style={{ marginTop: '2rem' }}>
            <div className="card">
                <div style={{ padding: '1rem', background: '#eff6ff', borderLeft: '4px solid #2563eb', borderRadius: '4px', marginBottom: '2rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e40af' }}>Tax Calculation Info</h4>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e3a8a' }}>
                        Tax calculation is based on the <strong>New Tax Regime (FY 2025-26)</strong>.
                        The tax calculated here is an approximation and should not be taken as the actual tax liability.
                    </p>
                </div>

                <h1 style={{ marginBottom: '0.5rem' }}>Income Tax Estimation (Step 8)</h1>
                <p className="text-muted" style={{ marginBottom: '2rem' }}>
                    A breakdown of your projected annual income tax based on the latest regime rules.
                </p>

                <div className="tax-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>
                    <div>
                        <h2 style={{ color: 'var(--primary)', borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem' }}>
                            {selfMember.name || 'Self'}'s Tax ({selfMember.employmentType || selfMember.occupation})
                        </h2>
                        {renderMemberTax(selfMember, selfEmploymentType, selfDetail, selfTaxResults, 'self')}
                    </div>

                    {spouseMember && (
                        <div>
                            <h2 style={{ color: 'var(--accent)', borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem' }}>
                                {spouseMember.name || 'Spouse'}'s Tax ({spouseMember.employmentType || spouseMember.occupation})
                            </h2>
                            {isSpouseHousewife ? (
                                <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-main)', borderRadius: '8px', marginTop: '1rem' }}>
                                    <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                        No tax calculation applicable for Housewife as there is no active income source.
                                    </p>
                                </div>
                            ) : (
                                renderMemberTax(spouseMember, spouseEmploymentType, spouseDetail, spouseTaxResults, 'spouse')
                            )}
                        </div>
                    )}
                </div>

                {!isCalculatorMode && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '3rem', marginBottom: '2rem' }}>
                        <button className="btn btn-secondary" onClick={onBack} style={{ padding: '1rem 3rem' }}>
                            Back to Life Goals
                        </button>
                        <button className="btn btn-primary" onClick={onNext} style={{ padding: '1rem 3rem' }}>
                            Proceed to Journey Roadmap
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IncomeTaxModule;
