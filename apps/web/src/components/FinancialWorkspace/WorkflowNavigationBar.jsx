import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Sticky bottom workflow navigation.
 * Prev/Next use adjacent report names (not generic labels).
 * Summary Mode additionally offers Continue to Detailed Planning.
 */
export default function WorkflowNavigationBar({
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  previousLabel = null,
  nextLabel = null,
  visible = true,
  showSteps = false,
  stepItems = [],
  activeStepId = null,
  onStepSelect,
  showContinueDetailed = false,
  onContinueDetailed,
}) {
  return (
    <footer
      className={`fw-workflow-nav-bar ${visible ? '' : 'fw-workflow-nav-bar--hidden'}`}
      aria-hidden={!visible}
      aria-label="Report workflow"
      data-tour="workspace-workflow"
    >
      <div className="fw-workflow-nav-bar-inner">
        <button
          type="button"
          className="btn btn-secondary fw-workflow-btn fw-workflow-btn-prev"
          onClick={onPrevious}
          disabled={previousDisabled || !visible}
          aria-disabled={previousDisabled || !visible}
          tabIndex={visible ? 0 : -1}
          title={previousLabel || 'Previous report'}
        >
          <ChevronLeft size={16} aria-hidden="true" className="fw-workflow-btn-icon" />
          <span className="fw-workflow-btn-label">{previousLabel || 'Previous'}</span>
        </button>

        {showSteps && stepItems.length > 0 ? (
          <div className="fw-workflow-steps" role="tablist" aria-label="Report steps">
            {stepItems.map((item, index) => {
              const selected = item.id === activeStepId;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={item.stage ? `${item.stage}: ${item.label}` : item.label}
                  className={`fw-workflow-step ${selected ? 'fw-workflow-step--active' : ''}`}
                  onClick={() => onStepSelect?.(item.id)}
                  tabIndex={visible ? 0 : -1}
                >
                  <span className="fw-workflow-step-dot" aria-hidden="true" />
                  <span className="fw-workflow-step-index">{index + 1}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        <button
          type="button"
          className="btn btn-primary fw-workflow-btn fw-workflow-btn-next"
          onClick={onNext}
          disabled={nextDisabled || !visible}
          aria-disabled={nextDisabled || !visible}
          tabIndex={visible ? 0 : -1}
          title={nextLabel || 'Next report'}
        >
          <span className="fw-workflow-btn-label">{nextLabel || 'Next'}</span>
          <ChevronRight size={16} aria-hidden="true" className="fw-workflow-btn-icon" />
        </button>
      </div>

      {showContinueDetailed ? (
        <div className="fw-workflow-continue">
          <button
            type="button"
            className="btn btn-primary fw-workflow-continue-btn"
            onClick={onContinueDetailed}
            tabIndex={visible ? 0 : -1}
          >
            Continue to Detailed Planning →
          </button>
        </div>
      ) : null}
    </footer>
  );
}
