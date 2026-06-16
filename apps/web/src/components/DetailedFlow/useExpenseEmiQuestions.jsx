import { useMemo, useState, useCallback, useEffect } from 'react';
import { Pencil, Check } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import {
    initializeExpenseSnapshots,
    sumHouseholdExceptEducation,
    sumHouseholdIncludingEducation,
    sumConfiguredEmis,
    sumUserEducationFromChildren,
    reconcileHousehold,
    reconcileEmi,
    EMI_LOAN_KEYS,
} from './expenseDetailSync';
import ReconciliationStatus from './ReconciliationStatus';

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

export function useExpenseEmiQuestions() {
    const {
        familyMembers,
        setFamilyMembers,
        expenseCategories,
        setExpenseCategories,
        hasEMI,
        setHasEMI,
        loading,
    } = useFinancialPlan();

    const [editingHouseholdSummary, setEditingHouseholdSummary] = useState(false);
    const [editHouseholdSummary, setEditHouseholdSummary] = useState('');
    const [activeLoanModal, setActiveLoanModal] = useState(null);

    useEffect(() => {
        if (loading) return;
        setExpenseCategories(prev => initializeExpenseSnapshots(prev));
    }, [loading, setExpenseCategories]);

    useEffect(() => {
        if (loading) return;
        setFamilyMembers(prev => {
            let changed = false;
            const next = prev.map((m) => {
                if (m.relation !== 'Child' || m.monthlyEducationExpense) return m;
                if (m.occupation === 'School' && m.annualSchoolFee) {
                    changed = true;
                    return {
                        ...m,
                        monthlyEducationExpense: String(Math.round(parseFloat(m.annualSchoolFee) / 12)),
                    };
                }
                return m;
            });
            if (!changed) return prev;
            const total = sumUserEducationFromChildren(next);
            setExpenseCategories((ec) => ({
                ...ec,
                household: { ...ec.household, education: total ? String(total) : '' },
            }));
            return next;
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]);

    const childMembers = familyMembers.filter((m) => m.relation === 'Child');
    const household = expenseCategories.household || {};
    const emi = expenseCategories.emi || {};
    const summaryHouseholdTotal = expenseCategories.summaryHouseholdTotal || '';
    const summaryEmiTotal = expenseCategories.summaryEmiTotal || '';

    const syncEducationTotal = useCallback((members) => {
        const total = sumUserEducationFromChildren(members);
        setExpenseCategories(prev => ({
            ...prev,
            household: {
                ...prev.household,
                education: total ? String(total) : '',
            },
        }));
    }, [setExpenseCategories]);

    const handleHouseholdChange = useCallback((field, value) => {
        setExpenseCategories(prev => ({
            ...prev,
            household: { ...prev.household, [field]: value },
        }));
    }, [setExpenseCategories]);

    const updateChild = useCallback((index, field, value) => {
        setFamilyMembers(prev => {
            const children = prev.filter(m => m.relation === 'Child');
            const others = prev.filter(m => m.relation !== 'Child');
            const updatedChildren = children.map((c, i) => (i === index ? { ...c, [field]: value } : c));
            const next = [...others, ...updatedChildren];
            syncEducationTotal(next);
            return next;
        });
    }, [setFamilyMembers, syncEducationTotal]);

    const handleEmiSave = useCallback((loanKey, configuredData) => {
        setExpenseCategories(prev => ({
            ...prev,
            emi: { ...prev.emi, [loanKey]: configuredData },
        }));
        setHasEMI(true);
    }, [setExpenseCategories, setHasEMI]);

    const saveHouseholdSummaryEdit = () => {
        setExpenseCategories(prev => ({
            ...prev,
            summaryHouseholdTotal: editHouseholdSummary,
        }));
        setEditingHouseholdSummary(false);
    };

    const yesNoToggle = (value, onYes, onNo) => (
        <div className="yes-no-toggle">
            <button type="button" className={`yes-no-btn ${value === true ? 'active-yes' : ''}`} onClick={onYes}>Yes</button>
            <button type="button" className={`yes-no-btn ${value === false ? 'active-no' : ''}`} onClick={onNo}>No</button>
        </div>
    );

    const householdBreakdownTotal = sumHouseholdExceptEducation(household);
    const educationMonthlyTotal = sumUserEducationFromChildren(childMembers);
    const householdGrandTotal = sumHouseholdIncludingEducation(household, educationMonthlyTotal);
    const emiTotal = sumConfiguredEmis(emi);
    const householdReconciliation = reconcileHousehold(expenseCategories, childMembers);
    const emiReconciliation = reconcileEmi(expenseCategories);

    const renderChildFeeFields = () => {
        const feeChildren = childMembers.filter(
            (c) => c.occupation === 'School' || c.occupation === 'College',
        );
        if (feeChildren.length === 0) return null;

        return (
            <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '1rem' }}>
                    Children&apos;s monthly education
                </div>
                {childMembers.map((child, index) => {
                    if (child.occupation !== 'School' && child.occupation !== 'College') return null;
                    const label = child.occupation === 'School'
                        ? `Monthly School Fee — ${child.name || `Child ${index + 1}`}`
                        : `Monthly Spend (College fee + accommodation) — ${child.name || `Child ${index + 1}`}`;
                    return (
                        <div key={`${child.name}-${index}`} style={{ marginBottom: '1rem' }}>
                            <CurrencyField
                                label={label}
                                value={child.monthlyEducationExpense || ''}
                                onChange={(v) => updateChild(index, 'monthlyEducationExpense', v)}
                            />
                        </div>
                    );
                })}
            </div>
        );
    };

    const questions = useMemo(() => {
        const list = [{
            id: 'household-breakup',
            content: (
                <div className="question-container">
                    <p className="question-narrative">Let&apos;s split your monthly household expenses.</p>
                    <h2 className="question-title">Household &amp; lifestyle</h2>
                    <p className="question-helper" style={{ maxWidth: '420px', margin: '0 auto 1.25rem', textAlign: 'center' }}>
                        Split your regular household costs below, then add each child&apos;s monthly school or college fee in the same screen.
                    </p>
                    <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem', maxWidth: '420px', margin: '0 auto 1.25rem', textAlign: 'left' }}>
                        {!editingHouseholdSummary ? (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--primary)' }}>Summary household expenses</h3>
                                    <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => { setEditHouseholdSummary(summaryHouseholdTotal); setEditingHouseholdSummary(true); }}>
                                        <Pencil size={13} style={{ marginRight: '0.3rem' }} /> Edit
                                    </button>
                                </div>
                                <div style={{ fontSize: '0.95rem' }}>{formatInr(summaryHouseholdTotal)} / month</div>
                            </>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--primary)' }}>Edit summary amount</h3>
                                    <button type="button" className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={saveHouseholdSummaryEdit}>
                                        <Check size={13} style={{ marginRight: '0.3rem' }} /> Done
                                    </button>
                                </div>
                                <CurrencyField value={editHouseholdSummary} onChange={setEditHouseholdSummary} />
                            </>
                        )}
                    </div>
                    <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto', gap: '1rem' }}>
                        <CurrencyField label="Household (Grocery, LPG, Fuel etc.)" value={household.grocery} onChange={(v) => handleHouseholdChange('grocery', v)} />
                        <CurrencyField label="House Rent" value={household.rent} onChange={(v) => handleHouseholdChange('rent', v)} />
                        <CurrencyField label="Lifestyle (Shopping, Movies, Dinner etc.)" value={household.lifestyle} onChange={(v) => handleHouseholdChange('lifestyle', v)} />
                        <CurrencyField label="Medical Expenses" value={household.medical} onChange={(v) => handleHouseholdChange('medical', v)} />
                        <CurrencyField label="Travel" value={household.travel} onChange={(v) => handleHouseholdChange('travel', v)} />
                        {renderChildFeeFields()}
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.75rem', lineHeight: 1.5 }}>
                            {educationMonthlyTotal > 0 && (
                                <div style={{ marginBottom: '0.35rem' }}>
                                    Education (separate from summary total): {formatInr(educationMonthlyTotal)} / month
                                </div>
                            )}
                            <div>Your detailed split: <strong style={{ color: 'var(--primary)' }}>{formatInr(householdBreakdownTotal)}</strong> / month</div>
                            <div>Summary household: <strong>{formatInr(summaryHouseholdTotal)}</strong> / month</div>
                            {summaryHouseholdTotal > 0 && (
                                <div style={{ marginTop: '0.35rem' }}>
                                    <ReconciliationStatus reconciliation={householdReconciliation} />
                                </div>
                            )}
                            {householdGrandTotal !== householdBreakdownTotal && (
                                <div style={{ marginTop: '0.35rem', fontWeight: 600, color: 'var(--primary)' }}>
                                    Total with education: {formatInr(householdGrandTotal)} / month
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ),
        }];

        list.push({
            id: 'recap-emi',
            content: (
                <div className="question-container">
                    <p className="question-narrative">Now let&apos;s look at your loan commitments.</p>
                    <h2 className="question-title">Do you have ongoing EMIs?</h2>
                    <div style={{ maxWidth: '420px', margin: '0 auto' }}>
                        {yesNoToggle(
                            hasEMI ? true : hasEMI === false ? false : null,
                            () => setHasEMI(true),
                            () => {
                                setHasEMI(false);
                                setExpenseCategories(prev => ({
                                    ...prev,
                                    summaryEmiTotal: '',
                                    emi: {
                                        personalLoan: '', homeLoan: '', educationLoan: '',
                                        carLoan: '', twoWheelerLoan: '', otherEmi: '', otherEmiName: '',
                                    },
                                }));
                            },
                        )}
                        {(hasEMI || summaryEmiTotal) && (
                            <div className="card" style={{ padding: '1rem', marginTop: '1.25rem', textAlign: 'left' }}>
                                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.35rem' }}>Summary EMI total</div>
                                <div style={{ fontSize: '0.95rem' }}>{formatInr(summaryEmiTotal)} / month</div>
                                {emiTotal > 0 && (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>
                                        <div>Your configured loans total: {formatInr(emiTotal)} / month</div>
                                        {summaryEmiTotal > 0 && (
                                            <div style={{ marginTop: '0.35rem' }}>
                                                <ReconciliationStatus reconciliation={emiReconciliation} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ),
        });

        if (hasEMI === true) {
            list.push({
                id: 'emi-loans',
                content: (
                    <div className="question-container">
                        <p className="question-narrative">Configure each loan below. Start dates cannot be in the future.</p>
                        <h2 className="question-title">EMIs (monthly)</h2>
                        <div className="question-fields" style={{ maxWidth: '480px', margin: '0 auto', gap: '1rem' }}>
                            {EMI_LOAN_KEYS.map(({ key, label, hasName }) => {
                                const rawValue = emi[key];
                                const isConfigured = rawValue !== null && typeof rawValue === 'object' && rawValue.principal > 0;
                                const displayValue = isConfigured ? rawValue.emi : '';

                                return (
                                    <div key={key}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>{label}</label>
                                            <button
                                                type="button"
                                                onClick={() => setActiveLoanModal(key)}
                                                style={{ background: 'transparent', border: 'none', color: isConfigured ? 'var(--success)' : 'var(--primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                            >
                                                {isConfigured ? '✓ Configured' : '⚙ Configure Details'}
                                            </button>
                                        </div>
                                        {hasName && (
                                            <input
                                                type="text"
                                                className="conversational-input"
                                                placeholder="Loan name (e.g. Gold Loan)"
                                                value={emi.otherEmiName || ''}
                                                onChange={(e) => setExpenseCategories(prev => ({
                                                    ...prev,
                                                    emi: { ...prev.emi, otherEmiName: e.target.value },
                                                }))}
                                                style={{ marginBottom: '0.5rem' }}
                                            />
                                        )}
                                        <div className="currency-input-wrapper">
                                            <span className="currency-symbol">₹</span>
                                            <input
                                                type="number"
                                                className="conversational-input"
                                                readOnly
                                                value={displayValue || ''}
                                                onClick={() => setActiveLoanModal(key)}
                                                placeholder="0"
                                                style={{ cursor: 'pointer', background: 'var(--bg-card)', fontWeight: 600, color: isConfigured ? 'var(--primary)' : 'var(--text-muted)' }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)', marginTop: '0.5rem' }}>
                                Total configured EMI: {formatInr(emiTotal)} / month
                            </div>
                            {summaryEmiTotal > 0 && emiTotal > 0 && (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.5 }}>
                                    Summary EMI: <strong>{formatInr(summaryEmiTotal)}</strong> / month
                                    <div style={{ marginTop: '0.35rem' }}>
                                        <ReconciliationStatus reconciliation={emiReconciliation} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ),
            });
        }

        return list;
    }, [
        editingHouseholdSummary, household, childMembers, hasEMI, emi, emiTotal,
        summaryHouseholdTotal, summaryEmiTotal, householdGrandTotal, householdBreakdownTotal,
        educationMonthlyTotal, householdReconciliation, emiReconciliation,
        editHouseholdSummary,
        handleHouseholdChange, updateChild, setHasEMI, setExpenseCategories,
    ]);

    return {
        expenseQuestions: questions,
        activeLoanModal,
        setActiveLoanModal,
        emi,
        handleEmiSave,
    };
}
