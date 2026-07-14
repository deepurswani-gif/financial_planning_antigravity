import ReconciliationBar from './ReconciliationBar';
import { reconcileHousehold } from './expenseDetailSync';

/**
 * Summary household anchor vs detailed household breakdown.
 * Shown on the household breakup screen in Money In / Money Out.
 */
export default function HouseholdReconciliationPanel({
    expenseCategories,
    familyMembers = [],
}) {
    const summaryHouseholdTotal = parseFloat(expenseCategories?.summaryHouseholdTotal) || 0;
    if (summaryHouseholdTotal <= 0) return null;

    const reconciliation = reconcileHousehold(expenseCategories, familyMembers);

    return (
        <ReconciliationBar
            summaryLabel="Summary household"
            detailLabel="Detailed household"
            summaryAmount={summaryHouseholdTotal}
            detailAmount={reconciliation.detailTotal}
            reconciliation={reconciliation}
        />
    );
}
