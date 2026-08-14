import React, { useCallback, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useFinancialPlan } from '../../../contexts/FinancialPlanContext';
import {
    createEmptyIncomeDetail,
    isSalariedEmployment,
    isBusinessEmployment,
    isPensionerEmployment,
    prefillDetailFromSummaryAmount,
    applyDetailSyncToIncome,
    shouldIncludeSpouseIncome,
    TDS_ALREADY_DEDUCTED_NOTE,
} from '../../DetailedFlow/incomeDetailSync';
import { guessEmploymentTypeFromSummaryOccupation } from '../../DetailedFlow/employmentTypeSync';
import CurrencyInput from '../../common/CurrencyInput';

const toStored = (v) => (v == null ? '' : String(v));

const CurrencyField = ({ label, value, onChange, placeholder = '0', readOnly = false }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        {label && (
            <div style={{ fontSize: '1rem', color: 'var(--text-main)' }}>
                {label}
            </div>
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



const BreakdownIncome = () => {
    const { familyMembers, income, setIncome, hasSpouseIncome } = useFinancialPlan();

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

    const otherIncomeFields = (memberKey, detail) => (
        <div style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '0.75rem', display: 'block' }}>
                Any other source of income
            </label>
            {(detail.otherIncome || [{ name: '', amount: '' }]).map((item, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem', position: 'relative' }}>
                    <input
                        type="text"
                        className="conversational-input"
                        placeholder="Source name (e.g. Freelance)"
                        value={item.name || ''}
                        onChange={(e) => updateOtherIncome(memberKey, index, 'name', e.target.value)}
                    />
                    <div style={{ position: 'relative' }}>
                        <CurrencyInput
                            className="conversational-input"
                            value={item.amount}
                            onValueChange={(v) => updateOtherIncome(memberKey, index, 'amount', toStored(v))}
                            placeholder="Amount"
                        />
                        {(detail.otherIncome?.length || 1) > 1 && (
                            <button
                                type="button"
                                onClick={() => removeOtherIncome(memberKey, index)}
                                style={{ position: 'absolute', right: '-25px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--negative)', cursor: 'pointer' }}
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={() => addOtherIncome(memberKey)} style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}>
                <Plus size={14} style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} /> Add another source
            </button>
        </div>
    );

    const buildMainScreen = (memberKey, detail, employmentType, personLabel) => {
        const isSal = isSalariedEmployment(employmentType);
        const isBiz = isBusinessEmployment(employmentType);
        const isPen = isPensionerEmployment(employmentType);

        return (
            <div style={{ marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #eaeaea' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#111', marginBottom: '1rem' }}>{personLabel} income details</h3>
                
                {isSal && (
                    <>
                        <CurrencyField
                            label="In-hand-salary"
                            value={detail.inHandSalary}
                            onChange={(v) => updateDetail(memberKey, { inHandSalary: v })}
                        />
                        {otherIncomeFields(memberKey, detail)}

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
        );
    };

    return (
        <div className="breakdown-income-container">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>Item</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>Amount</div>
            </div>
            {buildMainScreen('self', selfDetail, selfEmploymentType, selfMember.name || 'Your')}
            {includeSpouse && buildMainScreen('spouse', spouseDetail, spouseEmploymentType, spouseMember?.name || 'Spouse')}
            
            <div style={{
                padding: '1rem',
                background: '#f8fafc',
                borderRadius: '8px',
                marginTop: '1rem',
                fontSize: '0.85rem',
                color: '#64748b',
                textAlign: 'center',
            }}>
                <strong>Note:</strong> For tax planning access side drawer from your Financial Dashboard
            </div>
        </div>
    );
};

export default BreakdownIncome;
