import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { resolveWorkspaceEntry } from './workspaceEntry';
import { useAuth } from '../../contexts/AuthContext';
import { loadWorkspaceCapability } from './workspaceCapabilityStorage';

/** App root redirect — routes users to onboarding or workspace based on capability. */
export default function WorkspaceEntryRedirect() {
  const { workspaceCapability, summaryReportGeneratedAt, loading } = useFinancialPlan();
  const { user } = useAuth();

  if (loading) {
    return null;
  }

  const target = resolveWorkspaceEntry({
    workspaceCapability,
    summaryReportGeneratedAt,
    storedCapability: loadWorkspaceCapability(user?.id),
  });

  return <Navigate to={target} replace />;
}
