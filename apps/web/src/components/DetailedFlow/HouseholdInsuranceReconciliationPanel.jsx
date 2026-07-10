import ReconciliationStatus from './ReconciliationStatus';
import ReconciliationStickyPanel from './ReconciliationStickyPanel';
import { reconcileHouseholdWithInsurance } from './expenseDetailSync';

const formatInr = (val) => {
    if (!val || Number.isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(val);
};

/**
 * Summary household anchor vs detailed household + insurance breakdown.
 * Shown on household and insurance screens in Money In / Money Out.
 */
export default function HouseholdInsuranceReconciliationPanel({
    expenseCategories,
    familyMembers = [],
}) {
    const summaryHouseholdTotal = parseFloat(expenseCategories?.summaryHouseholdTotal) || 0;
    if (summaryHouseholdTotal <= 0) return null;

    const {
        householdDetailTotal,
        insuranceDetailTotal,
        reconciliation,
    } = reconcileHouseholdWithInsurance(expenseCategories, familyMembers);

    return (
        <ReconciliationStickyPanel>
            <div className="reconciliation-sticky-panel__title">Summary vs detailed household</div>
            <div>Summary household: <strong>{formatInr(summaryHouseholdTotal)}</strong> / month</div>
            <div>
                Your detailed household total:{' '}
                <strong style={{ color: 'var(--primary)' }}>{formatInr(householdDetailTotal)}</strong> / month
            </div>
            <div>
                Your detailed Insurance total:{' '}
                <strong style={{ color: 'var(--primary)' }}>{formatInr(insuranceDetailTotal)}</strong> / month
            </div>
            <div style={{ marginTop: '0.35rem' }}>
                <ReconciliationStatus reconciliation={reconciliation} />
            </div>
        </ReconciliationStickyPanel>
    );
}
