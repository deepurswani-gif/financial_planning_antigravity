import React, { useEffect, useState } from 'react';
import { X, ChevronDown, ChevronRight, Lock, Calculator } from 'lucide-react';
import {
  DETAIL_REPORT_TAB_ITEMS,
  PRIMARY_NAV_ITEMS,
  SECONDARY_NAV_BY_PRIMARY,
  STANDALONE_CALCULATOR_ITEMS,
  SUMMARY_REPORT_NAV_ITEMS,
} from './workspaceNavConfig';
import { SmartEditPanel } from './SmartEditDrawer';
import { useDrawerFocusRestore } from './useDrawerFocusRestore';

const HUB_TABS = [
  { id: 'edit', label: 'Edit' },
  { id: 'reports', label: 'Reports' },
  { id: 'tools', label: 'Tools' },
];

/**
 * Mobile navigation hub — Edit (Smart Edit), Reports, and Tools (calculators).
 */
export default function WorkspaceHubDrawer({
  open,
  onClose,
  activeTab = 'edit',
  onTabChange,
  capability = 'full',
  activeSummaryReportId,
  activeDetailReportId,
  workspaceFocus,
  detailReportsLocked = false,
  calculatorsLocked = false,
  onSelectSummaryReport,
  onSelectDetailReport,
  onOpenCalculator,
  onLockedSelect,
  onLaunchExperience,
  onLockedExperience,
}) {
  const [expandedTools, setExpandedTools] = useState(() => new Set(['wealth_creation']));
  const closeDrawer = useDrawerFocusRestore(open, onClose);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeDrawer]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const toggleToolGroup = (id) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectSummary = (reportId) => {
    onSelectSummaryReport?.(reportId);
    closeDrawer();
  };

  const selectDetail = (reportId) => {
    if (detailReportsLocked) {
      onLockedSelect?.();
      return;
    }
    onSelectDetailReport?.(reportId);
    closeDrawer();
  };

  const selectCalculator = (calculatorId) => {
    if (calculatorsLocked) {
      onLockedSelect?.();
      return;
    }
    onOpenCalculator?.(calculatorId);
    closeDrawer();
  };

  return (
    <>
      <div
        className={`fw-drawer-backdrop ${open ? 'open' : ''}`}
        onClick={closeDrawer}
        aria-hidden={!open}
      />
      <aside
        className={`fw-drawer fw-hub-drawer ${open ? 'open' : ''}`}
        aria-hidden={!open}
        aria-label="Workspace menu"
      >
        <div className="fw-hub-header">
          <span className="fw-hub-title">Menu</span>
          <button type="button" className="fw-icon-btn" onClick={closeDrawer} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <div className="fw-hub-tabs" role="tablist" aria-label="Menu sections">
          {HUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`fw-hub-tab ${activeTab === tab.id ? 'fw-hub-tab--active' : ''}`}
              onClick={() => onTabChange?.(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="fw-hub-body">
          {activeTab === 'reports' ? (
            <div className="fw-hub-panel" role="tabpanel" aria-label="Reports">
              <section className="fw-hub-section">
                <p className="fw-hub-section-title">Summary Reports</p>
                <ul className="fw-hub-list">
                  {SUMMARY_REPORT_NAV_ITEMS.map((item) => {
                    const selected =
                      workspaceFocus === 'summary' && activeSummaryReportId === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`fw-hub-link ${selected ? 'fw-hub-link--active' : ''}`}
                          onClick={() => selectSummary(item.id)}
                        >
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="fw-hub-section">
                <p className="fw-hub-section-title">Detailed Journey</p>
                <ul className="fw-hub-list">
                  {DETAIL_REPORT_TAB_ITEMS.map((item, index) => {
                    const selected =
                      workspaceFocus === 'detail' && activeDetailReportId === item.id;
                    const locked = detailReportsLocked;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`fw-hub-link ${selected ? 'fw-hub-link--active' : ''} ${
                            locked ? 'fw-locked' : ''
                          }`}
                          onClick={() => selectDetail(item.id)}
                          aria-label={
                            locked
                              ? `${item.stage}: ${item.label} (locked)`
                              : `${index + 1}. ${item.stage}: ${item.label}`
                          }
                          title={locked ? 'Available after Detailed Planning' : undefined}
                        >
                          {locked ? (
                            <Lock size={14} className="fw-lock-icon" aria-hidden="true" />
                          ) : (
                            <span className="fw-hub-step-num" aria-hidden="true">
                              {index + 1}
                            </span>
                          )}
                          <span className="fw-hub-link-text">
                            <span className="fw-hub-link-stage">{item.stage}</span>
                            <span>{item.label}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          ) : null}

          {activeTab === 'tools' ? (
            <div className="fw-hub-panel" role="tabpanel" aria-label="Tools">
              {PRIMARY_NAV_ITEMS.map((primary) => {
                const items = SECONDARY_NAV_BY_PRIMARY[primary.id] || [];
                const isOpen = expandedTools.has(primary.id);
                return (
                  <div key={primary.id} className="fw-hub-tool-group">
                    <button
                      type="button"
                      className="fw-hub-tool-toggle"
                      onClick={() => toggleToolGroup(primary.id)}
                      aria-expanded={isOpen}
                    >
                      <span>{primary.label}</span>
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {isOpen ? (
                      <ul className="fw-hub-list fw-hub-list--nested">
                        {items.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              className={`fw-hub-link ${calculatorsLocked ? 'fw-locked' : ''}`}
                              onClick={() => selectCalculator(item.id)}
                              aria-label={
                                calculatorsLocked ? `${item.label} (locked)` : item.label
                              }
                              title={
                                calculatorsLocked
                                  ? 'Available after Detailed Planning'
                                  : undefined
                              }
                            >
                              {calculatorsLocked ? (
                                <Lock size={14} className="fw-lock-icon" aria-hidden="true" />
                              ) : (
                                <Calculator size={14} aria-hidden="true" />
                              )}
                              <span>{item.label}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}

              {STANDALONE_CALCULATOR_ITEMS.length > 0 ? (
                <section className="fw-hub-section">
                  <p className="fw-hub-section-title">More tools</p>
                  <ul className="fw-hub-list">
                    {STANDALONE_CALCULATOR_ITEMS.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`fw-hub-link ${calculatorsLocked ? 'fw-locked' : ''}`}
                          onClick={() => selectCalculator(item.id)}
                        >
                          {calculatorsLocked ? (
                            <Lock size={14} className="fw-lock-icon" aria-hidden="true" />
                          ) : (
                            <Calculator size={14} aria-hidden="true" />
                          )}
                          <span>{item.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'edit' ? (
            <div className="fw-hub-panel fw-hub-panel--edit se-drawer" role="tabpanel" aria-label="Edit">
              <SmartEditPanel
                capability={capability}
                onLaunchExperience={onLaunchExperience}
                onLockedExperience={onLockedExperience}
                onClose={closeDrawer}
                showHeaderClose={false}
                resetKey={open && activeTab === 'edit'}
              />
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
