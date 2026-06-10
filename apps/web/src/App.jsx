import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RoleBasedRouting from './components/Auth/RoleBasedRouting';
import ProtectedRoute from './components/ProtectedRoute';
import MobileWebComingSoon from '@/components/common/MobileWebComingSoon';
import { useBreakpoints } from '@/hooks';
import { useFinancialPlan } from './contexts/FinancialPlanContext';
import BlankLayout from './components/Layouts/BlankLayout';

// Summary View Placeholders
import SummaryProfile from './components/SummaryFlow/SummaryProfile';
import SummaryCashFlow from './components/SummaryFlow/SummaryCashFlow';
import SummarySavings from './components/SummaryFlow/SummarySavings';
import SummaryAssets from './components/SummaryFlow/SummaryAssets';
import SummaryLiabilities from './components/SummaryFlow/SummaryLiabilities';
import SummaryGoals from './components/SummaryFlow/SummaryGoals';
import SummaryReportView from './components/SummaryReport/SummaryReportView';

// Detailed Flow Placeholder
import DetailedFamilyInfo from './components/DetailedFlow/DetailedFamilyInfo';
import DetailedMoneyInOut from './components/DetailedFlow/DetailedMoneyInOut';

// Legacy Existing App Flow
import DetailedFlowLayout from './DetailedFlowLayout';

function App() {
  const { lg } = useBreakpoints();
  const { loading } = useFinancialPlan();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  // Tablet/desktop (lg+, same 768px threshold as the hook): full app. Narrow phone browsers: coming-soon
  if (!lg) {
    return <MobileWebComingSoon />;
  }

  return (
    <RoleBasedRouting>
      <Routes>
        <Route path="/" element={<Navigate to="/summary-flow/profile" replace />} />
        
        {/* Summary Flow Routes (No Drawers) */}
        <Route path="/summary-flow" element={<ProtectedRoute><BlankLayout /></ProtectedRoute>}>
          <Route path="profile" element={<SummaryProfile />} />
          <Route path="cashflow" element={<SummaryCashFlow />} />
          <Route path="savings" element={<SummarySavings />} />
          <Route path="assets" element={<SummaryAssets />} />
          <Route path="liabilities" element={<SummaryLiabilities />} />
          <Route path="goals" element={<SummaryGoals />} />
        </Route>

        {/* Summary Report View */}
        <Route path="/summary-report" element={<ProtectedRoute><BlankLayout /></ProtectedRoute>}>
          <Route index element={<SummaryReportView />} />
        </Route>

        {/* Legacy Existing App */}
        <Route path="/detailed-flow/existing-app/*" element={<ProtectedRoute><DetailedFlowLayout /></ProtectedRoute>} />

        {/* Detailed Flow Routes */}
        <Route path="/detailed-flow" element={<ProtectedRoute><BlankLayout /></ProtectedRoute>}>
          <Route path="familyinfo" element={<DetailedFamilyInfo />} />
          <Route path="money_in_out" element={<DetailedMoneyInOut />} />
          <Route path="expenses_emis" element={<Navigate to="/detailed-flow/money_in_out" replace />} />
          <Route path="*" element={<Navigate to="/detailed-flow/familyinfo" replace />} />
        </Route>
      </Routes>
    </RoleBasedRouting>
  );
}

export default App;
