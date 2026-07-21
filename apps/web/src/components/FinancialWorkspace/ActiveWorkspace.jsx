import React from 'react';

/**
 * Central reusable workspace content container.
 * Empty canvas — ready for report content in later phases.
 */
export default function ActiveWorkspace({ children }) {
  return (
    <section className="fw-active-workspace" aria-label="Active workspace">
      <div className="fw-active-workspace-inner">
        {children ?? null}
      </div>
    </section>
  );
}
