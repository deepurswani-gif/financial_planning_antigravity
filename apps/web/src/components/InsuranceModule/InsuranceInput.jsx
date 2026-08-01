import React from 'react';
import { Plus, User, Trash2, HelpCircle } from 'lucide-react';
import { calculatePolicyEndDate } from './InsuranceLogic';
import CurrencyInput from '../common/CurrencyInput';
import DateInput from '../common/DateInput';
import { todayISO } from '../../utils/dateFormat';

const InsuranceInput = ({ familyMembers, policies, setPolicies, isProposed = false, investmentAllocations = [] }) => {

    const updatePolicy = (id, field, value) => {
        setPolicies(policies.map(p => {
            if (p.id === id) {
                const updated = { ...p, [field]: value };
                if (field === 'startDate' || field === 'policyTerm') {
                    updated.endDate = calculatePolicyEndDate(updated.startDate, updated.policyTerm);
                }
                return updated;
            }
            return p;
        }));
    };

    const addPolicy = (memberName) => {
        const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        const newPolicy = {
            id: newId,
            insuredName: memberName,
            company: '', planName: '', planType: 'Term Insurance',
            premium: '', frequency: 'Annually', paymentTerm: '',
            policyTerm: '', startDate: '', endDate: '',
            sumAssured: '', maturityAmount: '', isProposed
        };
        setPolicies([...policies, newPolicy]);
    };

    const removePolicy = (id) => {
        setPolicies(policies.filter(p => p.id !== id));
    };

    return (
        <div className="insurance-input">
            {familyMembers.map((member, mIdx) => {
                const memberKey = member.name || member.relation;
                const memberPolicies = policies.filter(p => p.insuredName === memberKey && !!p.isProposed === isProposed);
                const initials = (member.name || member.relation || 'FM')?.split(' ').map(n=>n[0]).join('').substring(0,2) || 'FM';
                const isSelf = member.relation?.toLowerCase() === 'self';
                const isChild = member.relation?.toLowerCase() === 'child';
                
                const avatarColor = isSelf ? 'var(--color-1)' : (isChild ? 'var(--warning)' : 'var(--color-3)');
                const roleBg = isSelf ? 'rgba(0,169,242,0.1)' : (isChild ? 'rgba(245, 158, 11,0.1)' : 'rgba(120, 124, 254,0.1)');
                const roleColor = isSelf ? 'var(--color-2)' : (isChild ? 'var(--warning)' : 'var(--color-3)');
                const headerGrad = isSelf ? 'linear-gradient(to right, rgba(23,45,157,0.05), transparent)' : 'linear-gradient(to right, rgba(120, 124, 254,0.05), transparent)';

                return (
                    <div key={mIdx} className="member-block">
                        <div className="member-header" style={{ background: headerGrad }}>
                            <div className="member-identity">
                                <div className="avatar" style={{ background: avatarColor }}>{initials.toUpperCase()}</div>
                                <div>
                                    <div className="member-name">{member.name || member.relation || 'Unnamed'}</div>
                                    <div className="member-role" style={{ background: roleBg, color: roleColor }}>{member.relation}</div>
                                </div>
                            </div>
                            <button className="add-btn" onClick={() => addPolicy(memberKey)}>
                                <Plus size={18} /> Add Policy
                            </button>
                        </div>
                        
                        <div className="policies-container" style={{ justifyContent: memberPolicies.length === 0 ? 'center' : 'flex-start' }}>
                            {memberPolicies.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    <div style={{ marginBottom: '1rem', opacity: 0.3, display: 'flex', justifyContent: 'center' }}>
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                    </div>
                                    <p>No policies recorded for {(member.name || member.relation || 'this member').split(' ')[0]} yet.</p>
                                </div>
                            ) : (
                                memberPolicies.map((p) => (
                                    <div key={p.id} className="policy-card">
                                        <div className="policy-card-top">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '80%' }}>
                                                <input 
                                                    type="text" 
                                                    value={p.company} 
                                                    onChange={e => updatePolicy(p.id, 'company', e.target.value)} 
                                                    className="input-field" 
                                                    style={{ border: 'none', background: 'transparent', fontSize: '1.1rem', fontWeight: 700, padding: 0, boxShadow: 'none' }} 
                                                    placeholder="Company Name (e.g. LIC)" 
                                                />
                                                <input 
                                                    type="text" 
                                                    value={p.planName} 
                                                    onChange={e => updatePolicy(p.id, 'planName', e.target.value)} 
                                                    className="input-field" 
                                                    style={{ border: 'none', background: 'transparent', fontSize: '0.9rem', color: 'var(--text-muted)', padding: 0, boxShadow: 'none' }} 
                                                    placeholder="Plan Name" 
                                                />
                                            </div>
                                            <button className="delete-btn" onClick={() => removePolicy(p.id)}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>

                                        <div className="form-grid">
                                            <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                                <label>Plan Type</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {['Term Insurance', 'Saving Plan', 'ULIP'].map(type => {
                                                        const isSelected = p.planType === type;
                                                        return (
                                                            <label key={type} style={{
                                                                flex: 1, 
                                                                border: isSelected ? '1px solid var(--color-1)' : '1px solid var(--border)', 
                                                                background: isSelected ? 'rgba(23,45,157,0.05)' : 'transparent', 
                                                                color: isSelected ? 'var(--color-1)' : 'var(--text-muted)', 
                                                                padding: '8px', 
                                                                borderRadius: '8px', 
                                                                textAlign: 'center', 
                                                                cursor: 'pointer',
                                                                fontWeight: isSelected ? 600 : 400
                                                            }}>
                                                                <input type="radio" checked={isSelected} onChange={() => updatePolicy(p.id, 'planType', type)} style={{display:'none'}} /> {type}
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            <div className="input-group">
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    Sum Assured (₹)
                                                    <span className="tooltip-wrapper" data-tooltip="The total guaranteed payout available to your beneficiaries upon covered events.">
                                                        <HelpCircle size={14} color="var(--text-muted)" />
                                                    </span>
                                                </label>
                                                <CurrencyInput name="sumAssured" placeholder="0" value={p.sumAssured} onChange={e => updatePolicy(p.id, 'sumAssured', e.target.value)} className="input-field" />
                                            </div>
                                            <div className="input-group">
                                                <label>Premium (₹)</label>
                                                <CurrencyInput name="premium" placeholder="0" value={p.premium} readOnly={isProposed} className={isProposed ? "input-field calc" : "input-field"} onChange={e => updatePolicy(p.id, 'premium', e.target.value)} />
                                            </div>

                                            <div className="input-group">
                                                <label>Frequency</label>
                                                <select value={p.frequency} disabled={isProposed} onChange={e => updatePolicy(p.id, 'frequency', e.target.value)} className={isProposed ? "input-field calc" : "input-field"}>
                                                    <option value="Monthly">Monthly</option>
                                                    <option value="Quarterly">Quarterly</option>
                                                    <option value="Half-Yearly">Half-Yearly</option>
                                                    <option value="Annually">Annually</option>
                                                </select>
                                            </div>
                                            <div className="input-group">
                                                <label>Payment Term (Years)</label>
                                                <input type="number" placeholder="Years" value={p.paymentTerm} readOnly={isProposed} className={isProposed ? "input-field calc" : "input-field"} onWheel={(e) => e.target.blur()} onChange={e => updatePolicy(p.id, 'paymentTerm', e.target.value)} />
                                            </div>
                                            
                                            <div className="input-group" style={{ gridColumn: p.planType === 'Term Insurance' ? 'span 2' : 'span 1' }}>
                                                <label>Policy Term (Years)</label>
                                                <input type="number" placeholder="Years" value={p.policyTerm} onWheel={(e) => e.target.blur()} onChange={e => updatePolicy(p.id, 'policyTerm', e.target.value)} className="input-field" />
                                            </div>
                                            {p.planType !== 'Term Insurance' && (
                                                <div className="input-group">
                                                    <label>Maturity (₹)</label>
                                                    <CurrencyInput name="maturityAmount" placeholder="0" value={p.maturityAmount} onChange={e => updatePolicy(p.id, 'maturityAmount', e.target.value)} className="input-field" />
                                                </div>
                                            )}

                                            <div className="input-group">
                                                <label>{isProposed ? 'Proposed Start Date' : 'Policy Start Date'}</label>
                                                {isProposed ? (
                                                    <DateInput
                                                        value={p.startDate || ''}
                                                        readOnly
                                                        showCalendarButton={false}
                                                        className="input-field calc"
                                                    />
                                                ) : (
                                                    <DateInput
                                                        value={p.startDate || ''}
                                                        max={todayISO()}
                                                        clampOnBlur
                                                        className="input-field"
                                                        onChange={(iso) => updatePolicy(p.id, 'startDate', iso)}
                                                    />
                                                )}
                                            </div>
                                            <div className="input-group">
                                                <label>Policy End Date</label>
                                                <DateInput
                                                    value={p.endDate || ''}
                                                    readOnly
                                                    showCalendarButton={false}
                                                    className="input-field calc"
                                                />
                                            </div>
                                            
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );
            })}

            <style>{`
                .member-block { background: var(--bg-card); border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid var(--border); overflow: hidden; margin-bottom: 2rem; }
                .member-header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
                .member-identity { display: flex; align-items: center; gap: 1rem; }
                .avatar { width: 48px; height: 48px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; }
                .member-name { font-size: 1.25rem; font-weight: 700; color: var(--text-main); }
                .member-role { font-size: 0.85rem; padding: 4px 10px; border-radius: 12px; font-weight: 600; display: inline-block; margin-top: 4px; }
                .add-btn { background: var(--color-1); color: white; border: none; padding: 0.6rem 1.25rem; border-radius: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
                .add-btn:hover { background: var(--color-2); }
                .policies-container { padding: 2rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 1.5rem; background: var(--bg-main); }
                .policy-card { background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border); box-shadow: 0 2px 10px rgba(0,0,0,0.02); transition: transform 0.2s; }
                .policy-card:hover { border-color: var(--color-4); box-shadow: 0 10px 30px rgba(0,0,0,0.08); transform: translateY(-2px); }
                .policy-card-top { padding: 1.25rem; border-bottom: 1px dashed var(--border); display: flex; justify-content: space-between; align-items: flex-start; }
                .delete-btn { color: var(--text-muted); background: none; border: none; cursor: pointer; transition: color 0.2s; }
                .delete-btn:hover { color: var(--destructive); }
                .form-grid { padding: 1.25rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
                .input-group { display: flex; flex-direction: column; gap: 6px; }
                .input-group label { font-size: 0.8rem; color: var(--text-muted); font-weight: 600; }
                .input-field { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-main); color: var(--text-main); font-size: 0.95rem; font-family: inherit; transition: border-color 0.2s; }
                .input-field:focus { border-color: var(--color-2); outline: none; box-shadow: 0 0 0 3px rgba(0,169,242,0.1); }
                .input-field.calc { background: #f8fafc; color: var(--text-muted); cursor: not-allowed; border-style: dashed; }
            `}</style>
        </div>
    );
};

export default InsuranceInput;
