import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RoleBasedRouting from './components/Auth/RoleBasedRouting';
import ProtectedRoute from './components/ProtectedRoute';
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
import DetailedReportView from './components/DetailedReport/DetailedReportView';
import FinancialWorkspaceView from './components/FinancialWorkspace/FinancialWorkspaceView';
import { FinancialWorkspaceProvider } from './components/FinancialWorkspace/FinancialWorkspaceContext';
import WorkspaceEntryRedirect from './components/FinancialWorkspace/WorkspaceEntryRedirect';
import { EditingProvider, FocusedEditShell } from './editing';

// Detailed Flow Placeholder
import DetailedFamilyInfo from './components/DetailedFlow/DetailedFamilyInfo';
import DetailedMoneyInOut from './components/DetailedFlow/DetailedMoneyInOut';
import DetailedMyWealthSnapshot from './components/DetailedFlow/DetailedMyWealthSnapshot';
import DetailedDreamsGoals from './components/DetailedFlow/DetailedDreamsGoals';
import DetailedGrowthExpectations from './components/DetailedFlow/DetailedGrowthExpectations';

// Legacy Existing App Flow
import DetailedFlowLayout from './DetailedFlowLayout';

// DEV-only Question Registry Explorer (not an end-user product surface)
const RegistryExplorer = import.meta.env.DEV
  ? React.lazy(() => import('./questionRegistry/explorer/RegistryExplorer'))
  : null;

function App() {
  const { loading } = useFinancialPlan();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <RoleBasedRouting>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <WorkspaceEntryRedirect />
            </ProtectedRoute>
          }
        />
        
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
          <Route index element={<Navigate to="money_story" replace />} />
          <Route path=":section" element={<SummaryReportView />} />
        </Route>

        {/* Detailed Report View */}
        <Route path="/detailed-report" element={<ProtectedRoute><BlankLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="your_money_flow" replace />} />
          <Route path=":section" element={<DetailedReportView />} />
        </Route>

        {/* Financial Workspace (shell v1.0 + Phase 2 navigation) */}
        <Route
          path="/financial-workspace"
          element={
            <ProtectedRoute>
              <FinancialWorkspaceProvider>
                <EditingProvider>
                  <FinancialWorkspaceView />
                  <FocusedEditShell />
                </EditingProvider>
              </FinancialWorkspaceProvider>
            </ProtectedRoute>
          }
        />

        {/* Legacy Existing App */}
        <Route path="/detailed-flow/existing-app/*" element={<ProtectedRoute><DetailedFlowLayout /></ProtectedRoute>} />

        {/* Detailed Flow Routes */}
        <Route path="/detailed-flow" element={<ProtectedRoute><BlankLayout /></ProtectedRoute>}>
          <Route path="familyinfo" element={<DetailedFamilyInfo />} />
          <Route path="money_in_out" element={<DetailedMoneyInOut />} />
          <Route path="mywealth" element={<DetailedMyWealthSnapshot />} />
          <Route path="dreams_goals" element={<DetailedDreamsGoals />} />
          <Route path="growth_expectations" element={<DetailedGrowthExpectations />} />
          <Route path="expenses_emis" element={<Navigate to="/detailed-flow/money_in_out" replace />} />
          <Route path="*" element={<Navigate to="/detailed-flow/familyinfo" replace />} />
        </Route>

        {import.meta.env.DEV && RegistryExplorer && (
          <Route
            path="/dev/question-registry"
            element={
              <React.Suspense fallback={<div style={{ padding: '2rem' }}>Loading registry explorer…</div>}>
                <RegistryExplorer />
              </React.Suspense>
            }
          />
        )}
      </Routes>
    </RoleBasedRouting>
  );
}

export default App;
