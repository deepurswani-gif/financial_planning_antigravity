import React from 'react';
import { useFinancialPlan } from '../../../contexts/FinancialPlanContext';
import { 
    sumUserEducationFromChildren 
} from '../../DetailedFlow/expenseDetailSync';
import CurrencyInput from '../../common/CurrencyInput';

import { Sparkles } from 'lucide-react';

const toStored = (v) => (v == null ? '' : String(v));

const CurrencyField = ({ label, value, onChange, placeholder = '0' }) => (
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
            onValueChange={(v) => onChange(toStored(v))}
        />
    </div>
);

const BreakdownExpenses = () => {
    const { familyMembers, setFamilyMembers, expenseCategories, setExpenseCategories } = useFinancialPlan();

    const household = expenseCategories.household || {};
    
    // We only need childMembers for the education inputs.
    const childMembers = familyMembers.filter((m) => m.relation === 'Child');

    const handleHouseholdChange = (field, value) => {
        setExpenseCategories((prev) => ({
            ...prev,
            household: {
                ...(prev.household || {}),
                [field]: value,
            },
        }));
    };

    const handleAutoFill = () => {
        const summary = parseFloat(expenseCategories.summaryHouseholdTotal) || 0;
        const currentSum = 
            (parseFloat(household.grocery) || 0) +
            (parseFloat(household.rent) || 0) +
            (parseFloat(household.medical) || 0) +
            (parseFloat(household.travel) || 0);
        
        const remainder = summary - currentSum;
        if (remainder > 0) {
            handleHouseholdChange('lifestyle', String(remainder));
        }
    };

    const syncEducationTotal = (members) => {
        setExpenseCategories(prev => ({
            ...prev,
            household: {
                ...prev.household,
                education: sumUserEducationFromChildren(members.filter(m => m.relation === 'Child')).toString(),
            },
        }));
    };

    const updateChild = (index, field, value) => {
        setFamilyMembers(prev => {
            const children = prev.filter(m => m.relation === 'Child');
            const others = prev.filter(m => m.relation !== 'Child');
            const updatedChildren = children.map((c, i) => (i === index ? { ...c, [field]: value } : c));
            const next = [...others, ...updatedChildren];
            syncEducationTotal(next);
            return next;
        });
    };

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

    return (
        <div className="breakdown-expenses-container">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>Item</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>Amount</div>
            </div>
            
            <CurrencyField 
                label="Groceries, LPG, Fuel etc." 
                value={household.grocery} 
                onChange={(v) => handleHouseholdChange('grocery', v)} 
            />
            <CurrencyField 
                label="House Rent" 
                value={household.rent} 
                onChange={(v) => handleHouseholdChange('rent', v)} 
            />
            <CurrencyField 
                label="Medical / Regular Medicines" 
                value={household.medical} 
                onChange={(v) => handleHouseholdChange('medical', v)} 
            />
            <CurrencyField 
                label="Travel (Fuel, cab etc.)" 
                value={household.travel} 
                onChange={(v) => handleHouseholdChange('travel', v)} 
            />
            <CurrencyField 
                label="Lifestyle (Shopping, Movies etc.)" 
                value={household.lifestyle} 
                onChange={(v) => handleHouseholdChange('lifestyle', v)} 
            />

            <div style={{ marginTop: '0.5rem', display: 'flex' }}>
                <button 
                    onClick={handleAutoFill}
                    style={{ 
                        background: 'transparent', border: 'none', color: '#555', 
                        display: 'flex', alignItems: 'center', gap: '0.5rem', 
                        cursor: 'pointer', fontSize: '0.9rem', padding: '0.5rem 0' 
                    }}
                >
                    <Sparkles size={16} /> Auto-fill remainder as "Lifestyle"
                </button>
            </div>
            
            {renderChildFeeFields()}
        </div>
    );
};

export default BreakdownExpenses;
