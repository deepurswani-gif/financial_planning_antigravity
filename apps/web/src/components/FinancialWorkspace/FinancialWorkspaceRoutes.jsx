import React from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import FinancialWorkspaceView from './FinancialWorkspaceView';
import WorkspaceSectionEditor from './WorkspaceSectionEditor';
import { resolveSectionId } from './sectionIds';

/**
 * Routes inside the permanent Financial Workspace shell.
 * Reports and section editing share drawer + provider context.
 */
export default function FinancialWorkspaceRoutes() {
  return <Outlet />;
}

export function FinancialWorkspaceReportsRoute() {
  return <FinancialWorkspaceView />;
}

export function FinancialWorkspaceSectionRoute() {
  const [searchParams] = useSearchParams();
  const edit = searchParams.get('edit');
  return <WorkspaceSectionEditor sectionId={edit ? resolveSectionId(edit) : null} />;
}
