import ReconciliationBar from './ReconciliationBar';
import { reconcileInsurance } from './expenseDetailSync';
import { getInsuranceMonthlyTotal } from './insuranceDetailSync';

/**
 * Summary insurance anchor vs detailed premiums (health, life, car, bike, others).
 * Shown on insurance screens in Money In / Money Out.
 */
export default function InsuranceReconciliationPanel({
    expenseCategories,
}) {
    const summaryInsuranceTotal = parseFloat(expenseCategories?.summaryInsuranceTotal) || 0;
    if (summaryInsuranceTotal <= 0) return null;

    const reconciliation = reconcileInsurance(expenseCategories);
    const detailTotal = getInsuranceMonthlyTotal(expenseCategories?.insurance || {});

    return (
        <ReconciliationBar
            summaryLabel="Summary insurance"
            detailLabel="Detailed insurance"
            summaryAmount={summaryInsuranceTotal}
            detailAmount={detailTotal}
            reconciliation={reconciliation}
        />
    );
}
