import React, { useState } from 'react';
import { Plus, Trash2, HelpCircle } from 'lucide-react';
import { convertToMonthly } from './CashFlowLogic';
import LoanDetailsModal from './LoanDetailsModal';
import InvestmentDetailsModal from './InvestmentDetailsModal';
import DocumentUploadButton from '../common/DocumentUploadButton';
import CurrencyInput from '../common/CurrencyInput';
import { MONTH_LABELS_LONG } from '../DetailedReport/moneyFlowLedgerLogic';
import { formatEducationMonthlyTotal } from '../DetailedFlow/educationExpenseSync';

const CashFlowInput = ({ familyMembers, income, setIncome, expenseCategories, setExpenseCategories, currentYearLedger, setCurrentYearLedger, subStep, planStartMonth = 0, hasSpouseIncome = false }) => {
    const [activeModal, setActiveModal] = useState(null);
    const [activeInvModal, setActiveInvModal] = useState(null);
    const [policyDocs, setPolicyDocs] = useState({});

    React.useEffect(() => {
        const saved = localStorage.getItem('cashflow_policy_docs');
        if (saved) {
            try { setPolicyDocs(JSON.parse(saved)); } catch (e) {}
        }
    }, []);

    const handleDocsChange = (insKey, fileName) => {
        const newDocs = { ...policyDocs };
        if (fileName) {
            newDocs[insKey] = fileName;
        } else {
            delete newDocs[insKey];
        }
        setPolicyDocs(newDocs);
        localStorage.setItem('cashflow_policy_docs', JSON.stringify(newDocs));
    };

    const handleIncomeChange = (e) => {
        const { name, value } = e.target;
        setIncome(prev => ({ ...prev, [name]: value }));
    };

    const handleExpenseChange = (category, item, value) => {
        setExpenseCategories(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [item]: value
            }
        }));
    };

    const handleInsuranceChange = (item, field, value) => {
        setExpenseCategories(prev => ({
            ...prev,
            insurance: {
                ...prev.insurance,
                [item]: {
                    ...prev.insurance[item],
                    [field]: value
                }
            }
        }));
    };

    const handleLifeInsuranceChange = (memberName, field, value) => {
        setExpenseCategories(prev => ({
            ...prev,
            insurance: {
                ...prev.insurance,
                life: {
                    ...prev.insurance.life,
                    [memberName]: {
                        ...(prev.insurance.life[memberName] || { value: '', frequency: 'Annual' }),
                        [field]: value
                    }
                }
            }
        }));
    };

    // Auto-fill Children Education Expense
    React.useEffect(() => {
        const education = formatEducationMonthlyTotal(familyMembers);
        if (education) {
            handleExpenseChange('household', 'education', education);
        }
    }, [familyMembers]);

    const selfMember = familyMembers.find(m => m.relation?.toLowerCase() === 'self') || { name: 'Self' };
    const spouseMember = familyMembers.find(m => m.relation?.toLowerCase() === 'spouse');
    const isSpouseHousewife = spouseMember?.occupation?.toLowerCase() === 'housewife';
    const currentMonth = new Date().getMonth();

    const renderLedgerReadOnlyRow = ({
        label,
        ledgerKey,
        labelColor = 'var(--text-main)',
        borderBottom = '1px solid var(--border)',
    }) => (
        <tr style={{ borderBottom }}>
            <td style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: labelColor, fontSize: '0.9rem' }}>{label}</td>
            {(currentYearLedger[ledgerKey] || Array(12).fill('')).map((val, idx) => (
                <td
                    key={`${ledgerKey}-${idx}`}
                    style={{
                        padding: '0.65rem 0.5rem',
                        fontSize: '0.85rem',
                        background: idx === currentMonth ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                        color: parseFloat(val) < 0 ? '#ef4444' : 'var(--text-main)',
                    }}
                >
                    ₹{Math.round(parseFloat(val) || 0).toLocaleString('en-IN')}
                </td>
            ))}
        </tr>
    );

    return (
        <div className="cash-flow-input">
            {subStep === 1 && (
            <>
            <div className="grid" style={{ marginBottom: '2.5rem' }}>
                <div className="cash-flow-section card" style={{ background: 'var(--bg-main)', border: '1px solid var(--border)' }}>
                    <h3 style={{ borderBottom: 'none', marginBottom: '1rem' }}>Detailed Baseline Components</h3>
                    
                    <div className="income-sections-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Member 1: Self */}
                        <div className="income-form-member" style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)' }}>{selfMember.name || 'Self'}'s Income</h4>
                            <div className="input-grid-mini">
                                <div className="input-group">
                                    <label>Monthly Salary / Earnings</label>
                                    <CurrencyInput name="self" value={income.self} onChange={handleIncomeChange} placeholder="0" />
                                </div>
                                <div className="input-group">
                                    <label>Bonuses, Incentives, Irregular</label>
                                    <CurrencyInput name="selfBonus" value={income.selfBonus} onChange={handleIncomeChange} placeholder="0" />
                                </div>
                                <div className="input-group">
                                    <label>Rental, Dividends, Passive</label>
                                    <CurrencyInput name="selfPassive" value={income.selfPassive} onChange={handleIncomeChange} placeholder="0" />
                                </div>
                                <div className="input-group">
                                    <label>Other Sources</label>
                                    <CurrencyInput name="selfOther" value={income.selfOther} onChange={handleIncomeChange} placeholder="0" />
                                </div>
                            </div>
                        </div>

                        {/* Member 2: Spouse (Conditional) */}
                        {!isSpouseHousewife && spouseMember && (
                            <div className="income-form-member" style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent)' }}>{spouseMember.name || 'Spouse'}'s Income</h4>
                                <div className="input-grid-mini">
                                    <div className="input-group">
                                        <label>Monthly Salary / Earnings</label>
                                        <CurrencyInput name="spouse" value={income.spouse} onChange={handleIncomeChange} placeholder="0" />
                                    </div>
                                    <div className="input-group">
                                        <label>Bonuses, Incentives, Irregular</label>
                                        <CurrencyInput name="spouseBonus" value={income.spouseBonus} onChange={handleIncomeChange} placeholder="0" />
                                    </div>
                                    <div className="input-group">
                                        <label>Rental, Dividends, Passive</label>
                                        <CurrencyInput name="spousePassive" value={income.spousePassive} onChange={handleIncomeChange} placeholder="0" />
                                    </div>
                                    <div className="input-group">
                                        <label>Other Sources</label>
                                        <CurrencyInput name="spouseOther" value={income.spouseOther} onChange={handleIncomeChange} placeholder="0" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Total Household Income Calculation */}
                        {(() => {
                            const totalSelf = (parseFloat(income.self) || 0) + (parseFloat(income.selfBonus) || 0) + (parseFloat(income.selfPassive) || 0) + (parseFloat(income.selfOther) || 0);
                            const totalSpouse = (parseFloat(income.spouse) || 0) + (parseFloat(income.spouseBonus) || 0) + (parseFloat(income.spousePassive) || 0) + (parseFloat(income.spouseOther) || 0);
                            const grandTotal = totalSelf + totalSpouse;

                            return (
                                <div className="income-summary-section" style={{ padding: '1.5rem', borderRadius: '12px', border: '2px solid var(--border)', background: 'var(--bg-main)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <label style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                                                Total Household Income (Self + Spouse)
                                            </label>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                Sum total of all income sources for your family.
                                            </p>
                                        </div>
                                        <div style={{ 
                                            padding: '1rem 2rem', 
                                            background: 'var(--bg-card)', 
                                            borderRadius: '8px', 
                                            border: '1px solid var(--primary)',
                                            fontSize: '1.5rem',
                                            fontWeight: 'bold',
                                            color: 'var(--primary)',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                        }}>
                                            ₹{grandTotal.toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            <div className="expense-categories">
                {/* Category A: Household & Lifestyle */}
                <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--bg-main)' }}>
                    <h4 style={{ color: 'var(--primary)', marginBottom: '1.25rem', fontSize: '1.1rem' }}>A. Household & Lifestyle</h4>
                    <div className="input-grid-mini">
                        <div className="input-group">
                            <label>Household (Grocery, LPG, Fuel etc.)</label>
                            <CurrencyInput value={expenseCategories.household.grocery} onChange={(e) => handleExpenseChange('household', 'grocery', e.target.value)} placeholder="0" />
                        </div>
                        <div className="input-group">
                            <label>House Rent</label>
                            <CurrencyInput value={expenseCategories.household.rent} onChange={(e) => handleExpenseChange('household', 'rent', e.target.value)} placeholder="0" />
                        </div>
                        <div className="input-group">
                            <label>Children Education</label>
                            <CurrencyInput 
                                value={expenseCategories.household.education} 
                                readOnly
                                
                                placeholder="Auto-calculated from Profile"
                                style={{ background: 'var(--bg-card)', fontWeight: 600, color: 'var(--primary)', cursor: 'not-allowed' }}
                            />
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                (Auto-filled from Profile Module)
                            </div>
                        </div>
                        <div className="input-group">
                            <label>Lifestyle (Shopping, Movies, Dinner etc.)</label>
                            <CurrencyInput value={expenseCategories.household.lifestyle} onChange={(e) => handleExpenseChange('household', 'lifestyle', e.target.value)} placeholder="0" />
                        </div>
                        <div className="input-group">
                            <label>Medical Expenses</label>
                            <CurrencyInput value={expenseCategories.household.medical} onChange={(e) => handleExpenseChange('household', 'medical', e.target.value)} placeholder="0" />
                        </div>
                        <div className="input-group">
                            <label>Travel</label>
                            <CurrencyInput value={expenseCategories.household.travel} onChange={(e) => handleExpenseChange('household', 'travel', e.target.value)} placeholder="0" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid" style={{ marginBottom: '2.5rem' }}>
                <div className="cash-flow-section card" style={{ background: 'var(--bg-main)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--border)' }}>
                        <h3 style={{ borderBottom: 'none', margin: 0 }}>Current Year Tracking Ledger (Monthly)</h3>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: 'white', fontWeight: 600, background: 'var(--primary)', padding: '4px 8px', borderRadius: '4px' }}>Plan Start: {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][planStartMonth]}</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600, background: 'var(--success-light)', padding: '4px 8px', borderRadius: '4px' }}>Year {new Date().getFullYear()}</span>
                        </div>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        This table establishes your intra-year granular timeline. Your first year surplus is calculated strictly from the Planning Start Month ({['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][planStartMonth]}) to December. Editing the current or future months will automatically establish a new run-rate projected to the end of the year.
                    </p>
                    
                    <div style={{ overflowX: 'auto' }}>
                        <table className="monthly-ledger-table" style={{ minWidth: '800px', width: '100%', borderCollapse: 'collapse', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <thead>
                                <tr style={{ background: 'var(--border)', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Category (₹)</th>
                                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((mon, i) => (
                                        <th key={mon} style={{ padding: '0.75rem', fontWeight: 600, color: i === new Date().getMonth() ? 'var(--primary)' : 'inherit' }}>
                                            {mon} {i === new Date().getMonth() && '(Now)'}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {renderLedgerReadOnlyRow({
                                    label: 'Net Income',
                                    ledgerKey: 'income',
                                    labelColor: 'var(--primary)',
                                })}

                                {renderLedgerReadOnlyRow({
                                    label: 'Tax Adjustment',
                                    ledgerKey: 'taxAdjustment',
                                    labelColor: '#7c3aed',
                                })}
                                
                                {renderLedgerReadOnlyRow({
                                    label: 'Household & Lifestyle (incl. education)',
                                    ledgerKey: 'household',
                                    labelColor: 'var(--danger)',
                                    borderBottom: 'none',
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(37, 99, 235, 0.05)', borderRadius: '8px', borderLeft: '4px solid var(--primary)', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        <strong>Note:</strong> Net income is in-hand salary / take-home profit plus other income. Household includes education. Tax adjustment (additional tax in {MONTH_LABELS_LONG[5]}, refund in {MONTH_LABELS_LONG[8]}) applies from the next assessment year — current year is ignored as ITR is assumed filed. View the full ledger in Detailed Report → Your Money Flow.
                    </div>
                </div>
            </div>
            </>
            )}

            {subStep === 2 && (
            <div className="expense-categories">
                {/* Category B1: EMIs */}
                <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--bg-main)' }}>
                    <h4 style={{ color: 'var(--primary)', marginBottom: '1.25rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        B1. EMIs (Monthly)
                        <span className="tooltip-wrapper" data-tooltip="Equated Monthly Installments. Exclude any upcoming pre-payments.">
                            <HelpCircle size={16} color="var(--text-muted)" />
                        </span>
                    </h4>
                    <div className="input-grid-mini">
                        {['personalLoan', 'homeLoan', 'educationLoan', 'carLoan', 'twoWheelerLoan'].map((loanKey) => {
                            const rawValue = expenseCategories.emi[loanKey];
                            const isConfigured = rawValue !== null && typeof rawValue === 'object' && rawValue.principal > 0;
                            const displayValue = isConfigured ? rawValue.emi : rawValue;
                            const labelNames = {
                                personalLoan: 'Personal Loan',
                                homeLoan: 'Home Loan',
                                educationLoan: 'Education Loan',
                                carLoan: 'Car Loan',
                                twoWheelerLoan: 'Two Wheeler Loan'
                            };

                            return (
                                <div className="input-group" key={loanKey}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.25rem' }}>
                                        <label style={{ marginBottom: 0 }}>{labelNames[loanKey]}</label>
                                        <button 
                                            onClick={() => setActiveModal(loanKey)}
                                            style={{ 
                                                background: 'transparent', border: 'none', 
                                                color: isConfigured ? 'var(--success)' : 'var(--primary)', 
                                                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                                textDecoration: 'none', padding: 0
                                            }}
                                        >
                                            {isConfigured ? '✓ Configured' : '⚙️ Configure Details'}
                                        </button>
                                    </div>
                                    <CurrencyInput 
                                        value={displayValue} 
                                        readOnly={true}
                                        onChange={(e) => handleExpenseChange('emi', loanKey, e.target.value)} 
                                        onClick={() => setActiveModal(loanKey)}
                                        placeholder="0" 
                                        style={{ background: 'var(--bg-card)', color: isConfigured ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}
                                    />
                                </div>
                            );
                        })}
                        <div className="input-group">
                            <label>Any other EMIs</label>
                            <CurrencyInput value={expenseCategories.emi.otherEmi} onChange={(e) => handleExpenseChange('emi', 'otherEmi', e.target.value)} placeholder="0" />
                        </div>
                    </div>
                </div>

                {/* Loan Details Configuration Modal */}
                <LoanDetailsModal 
                    isOpen={!!activeModal}
                    onClose={() => setActiveModal(null)}
                    initialData={activeModal ? expenseCategories.emi[activeModal] : null}
                    loanTypeTitle={activeModal ? activeModal.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()) : ''}
                    onSave={(configuredData) => {
                        setExpenseCategories(prev => ({
                            ...prev,
                            emi: {
                                ...prev.emi,
                                [activeModal]: configuredData
                            }
                        }));
                    }}
                />

                {/* Category B2: Insurance Premiums */}
                <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--bg-main)' }}>
                    <h4 style={{ color: 'var(--primary)', marginBottom: '1.25rem', fontSize: '1.1rem' }}>B2. Insurance Premiums</h4>
                    <div className="insurance-grid">
                        {[
                            { key: 'health', label: 'Health Insurance', info: 'We can review your existing policy, please upload the policy document.' },
                            { key: 'car', label: 'Car Insurance', info: 'If you want competitive quotes for car insurance, please upload the existing car insurance policy. We will share quotes before the due date.' },
                            { key: 'bike', label: 'Two-wheeler Insurance', info: 'If you want competitive quotes for 2-wheeler insurance, please upload the existing insurance policy. We will share quotes before the due date.' },
                            { key: 'others', label: 'Others (Insurance)' }
                        ].map((ins) => (
                            <div key={ins.key} style={{ marginBottom: '1.5rem' }}>
                                <div className="insurance-input-row" style={{ display: 'grid', gridTemplateColumns: ['health', 'car', 'bike'].includes(ins.key) ? 'minmax(200px, 1fr) auto 120px 140px' : '1fr 140px 140px', gap: '1rem', alignItems: 'end', marginBottom: '0.5rem' }}>
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label>{ins.label}</label>
                                        <CurrencyInput 
                                            value={expenseCategories.insurance[ins.key].value} 
                                            onChange={(e) => handleInsuranceChange(ins.key, 'value', e.target.value)} 
                                            placeholder="0" 
                                        />
                                        {ins.info && (
                                            <div style={{ 
                                                fontWeight: 500, 
                                                fontSize: '0.85rem', 
                                                color: 'var(--primary)', 
                                                marginTop: '0.5rem',
                                                background: 'rgba(37, 99, 235, 0.05)',
                                                padding: '0.5rem 0.75rem',
                                                borderRadius: '6px',
                                                borderLeft: '4px solid var(--primary)'
                                            }}>
                                                {ins.info}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {['health', 'car', 'bike'].includes(ins.key) && (
                                        <div className="input-group" style={{ marginBottom: 0, alignSelf: 'end' }}>
                                            <DocumentUploadButton 
                                                label="Upload Policy"
                                                documentName={policyDocs[ins.key]}
                                                onUploadComplete={(fileName) => handleDocsChange(ins.key, fileName)}
                                                onDeleteComplete={() => handleDocsChange(ins.key, null)}
                                            />
                                        </div>
                                    )}

                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label>Frequency</label>
                                        <select 
                                            value={expenseCategories.insurance[ins.key].frequency} 
                                            onChange={(e) => handleInsuranceChange(ins.key, 'frequency', e.target.value)}
                                            style={{ height: '42px' }}
                                        >
                                            <option value="Annual">Annual</option>
                                            <option value="Half Yearly">Half Yearly</option>
                                            <option value="Quarterly">Quarterly</option>
                                            <option value="Monthly">Monthly</option>
                                        </select>
                                    </div>
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label>Monthly (₹)</label>
                                        <div style={{ 
                                            height: '42px', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            padding: '0 1rem', 
                                            background: 'var(--bg-card)', 
                                            border: '1px solid var(--border)', 
                                            borderRadius: '6px',
                                            color: 'var(--primary)',
                                            fontWeight: 600,
                                            fontSize: '0.9rem'
                                        }}>
                                            {Math.round(convertToMonthly(expenseCategories.insurance[ins.key].value, expenseCategories.insurance[ins.key].frequency)).toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="insurance-grid" style={{ marginTop: '1rem' }}>
                        {familyMembers.map((member) => (
                            <div key={member.name || member.relation} className="insurance-input-row" style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', gap: '1rem', marginBottom: '1rem', alignItems: 'end' }}>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label>Life Insurance Premium ({member.name || member.relation})</label>
                                    <CurrencyInput 
                                        value={expenseCategories.insurance.life[member.name || member.relation]?.value || ''} 
                                        onChange={(e) => handleLifeInsuranceChange(member.name || member.relation, 'value', e.target.value)} 
                                        
                                        placeholder="0" 
                                    />
                                </div>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label>Frequency</label>
                                    <select 
                                        value={expenseCategories.insurance.life[member.name || member.relation]?.frequency || 'Annual'} 
                                        onChange={(e) => handleLifeInsuranceChange(member.name || member.relation, 'frequency', e.target.value)}
                                        style={{ height: '42px' }}
                                    >
                                        <option value="Annual">Annual</option>
                                        <option value="Half Yearly">Half Yearly</option>
                                        <option value="Quarterly">Quarterly</option>
                                        <option value="Monthly">Monthly</option>
                                    </select>
                                </div>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label>Monthly Premium (₹)</label>
                                    <div style={{ 
                                        height: '42px', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        padding: '0 1rem', 
                                        background: 'var(--bg-card)', 
                                        border: '1px solid var(--border)', 
                                        borderRadius: '6px',
                                        color: 'var(--primary)',
                                        fontWeight: 600,
                                        fontSize: '0.9rem'
                                    }}>
                                        {Math.round(convertToMonthly(
                                            expenseCategories.insurance.life[member.name || member.relation]?.value || 0, 
                                            expenseCategories.insurance.life[member.name || member.relation]?.frequency || 'Annual'
                                        )).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Category C: Savings & Investments */}
                <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--bg-main)' }}>
                    <h4 style={{ color: 'var(--primary)', marginBottom: '1.25rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        C. Savings & Investments
                        <span className="tooltip-wrapper" data-tooltip="Recurring monthly cash flows deployed into growth vehicles.">
                            <HelpCircle size={16} color="var(--text-muted)" />
                        </span>
                    </h4>
                    <div className="input-grid-mini">
                        {['ppf', 'nps'].map((invKey) => {
                            const rawValue = expenseCategories.savings[invKey] || '';
                            const isConfigured = rawValue !== null && typeof rawValue === 'object' && rawValue.amount > 0;
                            const displayValue = isConfigured ? rawValue.amount : rawValue;
                            const labelNames = { ppf: 'PPF', nps: 'NPS', rd: 'RD' };

                            return (
                                <div className="input-group" key={invKey}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.25rem' }}>
                                        <label style={{ marginBottom: 0 }}>{labelNames[invKey]}</label>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button 
                                                onClick={() => setActiveInvModal(invKey)}
                                                style={{ 
                                                    background: 'transparent', border: 'none', 
                                                    color: isConfigured ? 'var(--success)' : 'var(--primary)', 
                                                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                                    textDecoration: 'none', padding: 0
                                                }}
                                            >
                                                {isConfigured ? '✓ Configured' : '⚙️ Configure'}
                                            </button>
                                            {isConfigured && (
                                                <button
                                                    onClick={() => handleExpenseChange('savings', invKey, null)}
                                                    style={{ 
                                                        background: 'transparent', border: 'none', 
                                                        color: 'var(--danger)', 
                                                        fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                                        textDecoration: 'none', padding: 0
                                                    }}
                                                >
                                                    ✕ Clear
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <CurrencyInput 
                                        value={displayValue} 
                                        readOnly={true}
                                        onChange={(e) => handleExpenseChange('savings', invKey, e.target.value)} 
                                        onClick={() => setActiveInvModal(invKey)}
                                        placeholder="0" 
                                        style={{ background: 'var(--bg-card)', color: isConfigured ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}
                                    />
                                </div>
                            );
                        })}
                        
                        {/* Dynamic Recurring Deposits (RD) Array */}
                        {(() => {
                            const rawRD = expenseCategories.savings?.rd;
                            const rdArray = Array.isArray(rawRD) ? rawRD : (rawRD ? [rawRD] : []);
                            
                            return (
                                <div style={{ gridColumn: '1 / -1', background: 'var(--bg-main)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                        <label style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: 0, fontWeight: 700 }}>Recurring Deposits (RD)</label>
                                        <button 
                                            onClick={() => {
                                                const newRds = [...rdArray, ''];
                                                handleExpenseChange('savings', 'rd', newRds);
                                            }}
                                            style={{ 
                                                background: 'var(--primary-light)', border: '1px solid var(--primary)', 
                                                color: 'var(--primary)', padding: '0.4rem 0.75rem', 
                                                fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <Plus size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} /> Add RD
                                        </button>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                        {rdArray.map((rdItem, rdIndex) => {
                                            const isConfigured = rdItem !== null && typeof rdItem === 'object' && rdItem.amount > 0;
                                            const displayValue = isConfigured ? rdItem.amount : rdItem;

                                            return (
                                                <div className="input-group" key={`rd-${rdIndex}`} style={{ marginBottom: 0, background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                        <label style={{ marginBottom: 0, fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>RD #{rdIndex + 1}</label>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button 
                                                                onClick={() => setActiveInvModal({ key: 'rd', index: rdIndex })}
                                                                style={{ 
                                                                    background: 'transparent', border: 'none', 
                                                                    color: isConfigured ? 'var(--success)' : 'var(--primary)', 
                                                                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0
                                                                }}
                                                            >
                                                                {isConfigured ? '✓ Configured' : '⚙️ Configure'}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const newRds = rdArray.filter((_, i) => i !== rdIndex);
                                                                    handleExpenseChange('savings', 'rd', newRds.length > 0 ? newRds : '');
                                                                }}
                                                                style={{ 
                                                                    background: 'transparent', border: 'none', 
                                                                    color: 'var(--danger)', 
                                                                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0
                                                                }}
                                                            >
                                                                <Trash2 size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Remove
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <CurrencyInput 
                                                        value={displayValue || ''} 
                                                        readOnly={true}
                                                        onChange={(e) => {
                                                            const newRds = [...rdArray];
                                                            newRds[rdIndex] = e.target.value;
                                                            handleExpenseChange('savings', 'rd', newRds);
                                                        }} 
                                                        onClick={() => setActiveInvModal({ key: 'rd', index: rdIndex })}
                                                        placeholder="0" 
                                                        style={{ background: 'var(--bg-main)', color: isConfigured ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}
                                                    />
                                                </div>
                                            );
                                        })}
                                        {rdArray.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, gridColumn: '1 / -1' }}>No Recurring Deposits added.</p>}
                                    </div>
                                </div>
                            );
                        })()}
                        <div className="input-group">
                            <label>SIPs</label>
                            <CurrencyInput value={expenseCategories.savings.sip || ''} onChange={(e) => handleExpenseChange('savings', 'sip', e.target.value)} placeholder="0" />
                        </div>
                        <div className="input-group">
                            <label>Any other Saving</label>
                            <CurrencyInput value={expenseCategories.savings.otherSaving || ''} onChange={(e) => handleExpenseChange('savings', 'otherSaving', e.target.value)} placeholder="0" />
                        </div>
                    </div>
                </div>

                <InvestmentDetailsModal 
                    isOpen={!!activeInvModal}
                    onClose={() => setActiveInvModal(null)}
                    initialData={
                        activeInvModal 
                            ? (typeof activeInvModal === 'string' 
                                ? expenseCategories.savings[activeInvModal] 
                                : Array.isArray(expenseCategories.savings[activeInvModal.key]) 
                                    ? expenseCategories.savings[activeInvModal.key][activeInvModal.index]
                                    : expenseCategories.savings[activeInvModal.key])
                            : null
                    }
                    investmentTypeTitle={
                        activeInvModal 
                            ? (typeof activeInvModal === 'string' 
                                ? activeInvModal.toUpperCase() 
                                : activeInvModal.key.toUpperCase())
                            : ''
                    }
                    onSave={(configuredData) => {
                        if (typeof activeInvModal === 'string') {
                            setExpenseCategories(prev => ({
                                ...prev,
                                savings: {
                                    ...prev.savings,
                                    [activeInvModal]: configuredData
                                }
                            }));
                        } else {
                            // Modal is an object { key, index }
                            setExpenseCategories(prev => {
                                const rawArray = prev.savings[activeInvModal.key];
                                const arr = Array.isArray(rawArray) ? [...rawArray] : (rawArray ? [rawArray] : []);
                                arr[activeInvModal.index] = configuredData;
                                return {
                                    ...prev,
                                    savings: {
                                        ...prev.savings,
                                        [activeInvModal.key]: arr
                                    }
                                };
                            });
                        }
                    }}
                />
            </div>
            )}

            <style>{`
        .input-grid-mini {
          display: grid;
          gap: 1.25rem;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
        .cash-flow-input h3 {
          font-size: 1.25rem;
          margin-bottom: 1.5rem;
          border-bottom: 2px solid var(--border);
          padding-bottom: 0.5rem;
        }
      `}</style>

        </div>
    );
};

export default CashFlowInput;
