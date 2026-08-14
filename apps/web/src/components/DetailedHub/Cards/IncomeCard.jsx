import React, { useEffect } from 'react';
import HubCard from '../HubCard';
import { ArrowRightLeft } from 'lucide-react';
import { useFinancialPlan } from '../../../contexts/FinancialPlanContext';
import { useFinancialWorkspace } from '../../FinancialWorkspace/FinancialWorkspaceContext';
import CurrencyInput from '../../common/CurrencyInput';
import { 
    isBusinessEmployment, 
    isPensionerEmployment, 
    getMemberDetailMonthlyTotal,
    shouldIncludeSpouseIncome,
    prefillDetailFromSummaryAmount,
    applyDetailSyncToIncome
} from '../../DetailedFlow/incomeDetailSync';

const IncomeCard = () => {
    const { income, setIncome, familyMembers, hasSpouseIncome } = useFinancialPlan();
    const { openCalculator } = useFinancialWorkspace();

    const selfMember = familyMembers.find(m => m.relation === 'Self') || {};
    const selfEmploymentType = selfMember.employmentType || 'Private Sector';
    const selfDetail = income.selfDetail || {};

    const spouseMember = familyMembers.find(m => m.relation === 'Spouse');
    const spouseEmploymentType = spouseMember?.employmentType || 'Private Sector';
    const spouseDetail = income.spouseDetail || {};

    useEffect(() => {
        setIncome(prev => {
            if (prev.selfDetail?.inHandSalary || prev.selfDetail?.takeHomeProfit || prev.selfDetail?.netPension) {
                return prev;
            }
            const working = shouldIncludeSpouseIncome(spouseMember, hasSpouseIncome, prev);
            const selfD = prefillDetailFromSummaryAmount(prev.selfDetail, prev.summarySelfInHand || prev.self, selfEmploymentType);
            const spouseD = prefillDetailFromSummaryAmount(prev.spouseDetail, prev.summarySpouseInHand || prev.spouse, spouseEmploymentType);
            return applyDetailSyncToIncome(
                { ...prev, selfDetail: selfD, spouseDetail: spouseD },
                selfEmploymentType,
                working ? spouseEmploymentType : null
            );
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleUpdate = (memberKey, field, value) => {
        setIncome(prev => {
            const currentDetail = prev[memberKey] || {};
            return {
                ...prev,
                [memberKey]: {
                    ...currentDetail,
                    [field]: value
                }
            };
        });
    };

    const updateOtherIncome = (memberKey, index, field, value) => {
        setIncome(prev => {
            const currentDetail = prev[memberKey] || {};
            const list = [...(currentDetail.otherIncome || [{ name: '', amount: '' }])];
            list[index] = { ...list[index], [field]: value };
            return {
                ...prev,
                [memberKey]: { ...currentDetail, otherIncome: list }
            };
        });
    };

    const addOtherIncome = (memberKey) => {
        setIncome(prev => {
            const currentDetail = prev[memberKey] || {};
            return {
                ...prev,
                [memberKey]: {
                    ...currentDetail,
                    otherIncome: [...(currentDetail.otherIncome || []), { name: '', amount: '' }]
                }
            };
        });
    };

    const removeOtherIncome = (memberKey, index) => {
        setIncome(prev => {
            const currentDetail = prev[memberKey] || {};
            const list = (currentDetail.otherIncome || []).filter((_, i) => i !== index);
            return {
                ...prev,
                [memberKey]: {
                    ...currentDetail,
                    otherIncome: list.length ? list : [{ name: '', amount: '' }]
                }
            };
        });
    };

    // Calculate total detailed income to check status
    const selfTotal = getMemberDetailMonthlyTotal(selfDetail, selfEmploymentType);
    const spouseTotal = spouseMember ? getMemberDetailMonthlyTotal(spouseDetail, spouseEmploymentType) : 0;
    const totalIncome = selfTotal + spouseTotal;
    
    // Status Logic
    const summaryTarget = (parseFloat(income.selfSummary) || 0) + (parseFloat(income.spouseSummary) || 0);
    let status = 'Not Started';
    if (totalIncome > 0 && totalIncome === summaryTarget) {
        status = 'Done';
    } else if (totalIncome > 0) {
        status = 'In Progress';
    }

    const formatInr = (val) => {
        if (!val || isNaN(val)) return '₹ 0';
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
    };

    const renderOtherIncome = (memberKey, detail) => (
        <div style={{ marginTop: '1.5rem', borderTop: '1px dashed #eaeaea', paddingTop: '1rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#555', marginBottom: '0.8rem', display: 'block' }}>
                Any other source of income
            </label>
            {(detail.otherIncome || [{ name: '', amount: '' }]).map((item, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end', marginBottom: '1rem' }}>
                    <div>
                        <label style={{ fontSize: '0.8rem', color: '#666', display: 'block', marginBottom: '0.3rem' }}>Source Name</label>
                        <input 
                            type="text" 
                            className="conversational-input" 
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                            placeholder="e.g. Freelancing"
                            value={item.name}
                            onChange={(e) => updateOtherIncome(memberKey, index, 'name', e.target.value)}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', color: '#666', display: 'block', marginBottom: '0.3rem' }}>Amount</label>
                        <CurrencyInput
                            placeholder="0"
                            value={item.amount}
                            onValueChange={(val) => updateOtherIncome(memberKey, index, 'amount', String(val || ''))}
                        />
                    </div>
                    {(detail.otherIncome?.length || 1) > 1 && (
                        <button type="button" onClick={() => removeOtherIncome(memberKey, index)} style={{ padding: '0.5rem', background: '#ffebee', color: '#d32f2f', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            Remove
                        </button>
                    )}
                </div>
            ))}
            <button type="button" onClick={() => addOtherIncome(memberKey)} style={{ background: 'transparent', color: '#007bff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                + Add another source
            </button>
        </div>
    );

    const renderInputsForMember = (memberKey, detail, employmentType, label) => {
        return (
            <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#333' }}>{label} Income</h4>
                
                {isBusinessEmployment(employmentType) ? (
                    <>
                        <div className="hub-input-group">
                            <label>Take-home Profit (Monthly)</label>
                            <CurrencyInput
                                placeholder="0"
                                value={detail.takeHomeProfit || ''}
                                onValueChange={(val) => handleUpdate(memberKey, 'takeHomeProfit', val)}
                            />
                        </div>
                        <div className="hub-input-group" style={{ marginTop: '1rem' }}>
                            <label>Passive Income (e.g. Rent)</label>
                            <CurrencyInput
                                placeholder="0"
                                value={detail.passiveIncome || ''}
                                onValueChange={(val) => handleUpdate(memberKey, 'passiveIncome', val)}
                            />
                        </div>
                    </>
                ) : isPensionerEmployment(employmentType) ? (
                    <div className="hub-input-group">
                        <label>Net Pension (Monthly)</label>
                        <CurrencyInput
                            placeholder="0"
                            value={detail.netPension || ''}
                            onValueChange={(val) => handleUpdate(memberKey, 'netPension', val)}
                        />
                    </div>
                ) : (
                    <div className="hub-input-group">
                        <label>In-Hand Salary (Monthly)</label>
                        <CurrencyInput
                            placeholder="0"
                            value={detail.inHandSalary || ''}
                            onValueChange={(val) => handleUpdate(memberKey, 'inHandSalary', val)}
                        />
                        <div style={{ marginTop: '0.8rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openCalculator('income_tax')}>
                                Optimize my taxes (Salary Breakdown)
                            </button>
                        </div>
                    </div>
                )}
                
                {renderOtherIncome(memberKey, detail)}
            </div>
        );
    };

    return (
        <HubCard 
            id="income"
            title="Income & Taxes" 
            icon={<ArrowRightLeft />}
            status={status}
            summaryValue={formatInr(summaryTarget)}
        >
            <div className="hub-form-grid" style={{ display: 'block' }}>
                {renderInputsForMember('selfDetail', selfDetail, selfEmploymentType, 'Self')}
                {shouldIncludeSpouseIncome(spouseMember, hasSpouseIncome, income) && 
                    renderInputsForMember('spouseDetail', spouseDetail, spouseEmploymentType, 'Spouse')
                }
            </div>
            <div className="hub-card-footer" style={{ marginTop: '1rem' }}>
                <div className="hub-reconciliation-toast">
                    Detailed total: {formatInr(totalIncome)}
                </div>
            </div>
        </HubCard>
    );
};

export default IncomeCard;
