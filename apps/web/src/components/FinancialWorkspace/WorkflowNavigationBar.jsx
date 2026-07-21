import React from 'react';

/**
 * Sticky bottom workflow navigation.
 * Full Mode: Previous / Next through detail journey.
 * Summary Mode: Back to Summary Reports + Continue to Detailed Planning.
 */
export default function WorkflowNavigationBar({
  variant = 'detail',
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  visible = true,
  onBackToSummary,
  onContinueDetailed,
}) {
  if (variant === 'summary') {
    return (
      <footer className="fw-workflow-nav-bar" aria-label="Summary workspace actions">
        <div className="fw-workflow-nav-bar-inner">
          <button
            type="button"
            className="btn btn-secondary fw-workflow-btn fw-workflow-btn-prev"
            onClick={onBackToSummary}
          >
            Back to Summary Reports
          </button>
          <button
            type="button"
            className="btn btn-primary fw-workflow-btn fw-workflow-btn-next"
            onClick={onContinueDetailed}
          >
            Continue to Detailed Planning →
          </button>
        </div>
      </footer>
    );
  }

  return (
    <footer
      className={`fw-workflow-nav-bar ${visible ? '' : 'fw-workflow-nav-bar--hidden'}`}
      aria-hidden={!visible}
      aria-label="Detail journey workflow"
    >
      <div className="fw-workflow-nav-bar-inner">
        <button
          type="button"
          className="btn btn-secondary fw-workflow-btn fw-workflow-btn-prev"
          onClick={onPrevious}
          disabled={previousDisabled || !visible}
          aria-disabled={previousDisabled || !visible}
          tabIndex={visible ? 0 : -1}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn-primary fw-workflow-btn fw-workflow-btn-next"
          onClick={onNext}
          disabled={nextDisabled || !visible}
          aria-disabled={nextDisabled || !visible}
          tabIndex={visible ? 0 : -1}
        >
          Next
        </button>
      </div>
    </footer>
  );
}
