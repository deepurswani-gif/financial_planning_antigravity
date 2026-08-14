import React, { useEffect } from 'react';
import HubCard from '../HubCard';
import { Wallet } from 'lucide-react';
import { useFinancialPlan } from '../../../contexts/FinancialPlanContext';
import CurrencyInput from '../../common/CurrencyInput';
import { sumHouseholdIncludingEducation, initializeExpenseSnapshots } from '../../DetailedFlow/expenseDetailSync';

const ExpensesCard = () => {
    const { expenseCategories, setExpenseCategories } = useFinancialPlan();
    
    useEffect(() => {
        setExpenseCategories(prev => initializeExpenseSnapshots(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Safely default to an empty object if undefined
    const household = expenseCategories?.household || {};
    const summaryHouseholdTotal = expenseCategories?.summaryHouseholdTotal || '';
    
    // Calculate the current sum of detailed line items
    const detailedSum = sumHouseholdIncludingEducation(household);
    
    // The "Status" logic
    let status = 'Not Started';
    if (detailedSum > 0 && detailedSum === parseFloat(summaryHouseholdTotal)) {
        status = 'Done';
    } else if (detailedSum > 0) {
        status = 'In Progress';
    }

    const handleFieldChange = (field, value) => {
        setExpenseCategories(prev => {
            const currentHousehold = prev.household || {};
            const updatedHousehold = {
                ...currentHousehold,
                [field]: String(value || '')
            };
            
            // Auto-reconcile: update the summary total to match the details
            const newSum = sumHouseholdIncludingEducation(updatedHousehold);
            
            return {
                ...prev,
                household: updatedHousehold,
                summaryHouseholdTotal: String(newSum)
            };
        });
    };

    const formatInr = (val) => {
        if (!val || isNaN(val)) return '₹ 0';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(val);
    };

    return (
        <HubCard 
            id="expenses"
            title="Household & Lifestyle Expenses" 
            icon={<Wallet />}
            status={status}
            summaryValue={formatInr(summaryHouseholdTotal)}
        >
            <div className="hub-form-grid">
                <div className="hub-input-group">
                    <label>Grocery & Daily Needs</label>
                    <CurrencyInput
                        placeholder="0"
                        value={household.grocery || ''}
                        onValueChange={(val) => handleFieldChange('grocery', val)}
                    />
                </div>
                <div className="hub-input-group">
                    <label>House Rent</label>
                    <CurrencyInput
                        placeholder="0"
                        value={household.rent || ''}
                        onValueChange={(val) => handleFieldChange('rent', val)}
                    />
                </div>
                <div className="hub-input-group">
                    <label>Medical Expenses</label>
                    <CurrencyInput
                        placeholder="0"
                        value={household.medical || ''}
                        onValueChange={(val) => handleFieldChange('medical', val)}
                    />
                </div>
                <div className="hub-input-group">
                    <label>Travel & Commute</label>
                    <CurrencyInput
                        placeholder="0"
                        value={household.travel || ''}
                        onValueChange={(val) => handleFieldChange('travel', val)}
                    />
                </div>
                <div className="hub-input-group">
                    <label>Lifestyle & Entertainment</label>
                    <CurrencyInput
                        placeholder="0"
                        value={household.lifestyle || ''}
                        onValueChange={(val) => handleFieldChange('lifestyle', val)}
                    />
                </div>
                <div className="hub-input-group">
                    <label>Education (Auto-calculated from Children)</label>
                    <CurrencyInput
                        placeholder="0"
                        value={household.education || ''}
                        disabled={true}
                    />
                </div>
            </div>
            
            <div className="hub-card-footer">
                <div className="hub-reconciliation-toast">
                    Auto-reconciled: Summary matches your detailed breakdown ({formatInr(detailedSum)}).
                </div>
            </div>
        </HubCard>
    );
};

export default ExpensesCard;
