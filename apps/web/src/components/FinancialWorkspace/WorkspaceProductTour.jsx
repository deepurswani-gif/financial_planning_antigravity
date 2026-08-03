import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getWorkspaceTourSteps } from './workspaceTourConfig';

const PAD = 8;
const CARD_GAP = 12;

function readTargetRect(targetId) {
  const el = document.querySelector(`[data-tour="${targetId}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 && rect.height < 1) return null;
  return {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
    bottom: rect.bottom + PAD,
    right: rect.right + PAD,
  };
}

function sameSpot(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height
  );
}

function sameCardStyle(a, b) {
  return a?.top === b?.top && a?.left === b?.left && a?.width === b?.width;
}

/**
 * Mobile coach-mark overlay for the Financial Dashboard.
 */
export default function WorkspaceProductTour({
  open,
  trigger = 'intro',
  onClose,
  onPrepareStep,
}) {
  const titleId = useId();
  const cardRef = useRef(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [spot, setSpot] = useState(null);
  const [cardStyle, setCardStyle] = useState({ top: 16, left: 16, width: 320 });

  const steps = useMemo(() => getWorkspaceTourSteps(trigger), [trigger]);
  const step = steps[stepIndex] || steps[0];
  const targetId = step?.target;
  const isLast = stepIndex >= steps.length - 1;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onPrepareStepRef = useRef(onPrepareStep);
  onPrepareStepRef.current = onPrepareStep;

  const finish = useCallback(() => {
    onCloseRef.current?.();
  }, []);

  const updateLayout = useCallback(() => {
    if (!open || !targetId) return;

    const nextSpot = readTargetRect(targetId);
    setSpot((prev) => (sameSpot(prev, nextSpot) ? prev : nextSpot));

    const cardEl = cardRef.current;
    const cardH = cardEl?.offsetHeight || 160;
    const cardW = Math.min(320, window.innerWidth - 24);
    const preferBelow = nextSpot
      ? nextSpot.bottom + CARD_GAP + cardH < window.innerHeight - 12
      : true;

    let top = 24;
    let left = 12;

    if (nextSpot) {
      top = preferBelow
        ? nextSpot.bottom + CARD_GAP
        : Math.max(12, nextSpot.top - CARD_GAP - cardH);
      left = Math.min(
        Math.max(12, nextSpot.left),
        window.innerWidth - cardW - 12,
      );
    }

    const nextCard = { top, left, width: cardW };
    setCardStyle((prev) => (sameCardStyle(prev, nextCard) ? prev : nextCard));
  }, [open, targetId]);

  useEffect(() => {
    if (!open) return undefined;
    setStepIndex(0);
  }, [open, trigger]);

  // Open/close hub drawer when a step needs Smart Edit (or other hub panels) visible.
  useEffect(() => {
    if (!open || !step) return undefined;
    onPrepareStepRef.current?.(step);
    return undefined;
  }, [open, stepIndex, step]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateLayout();
    const onResize = () => updateLayout();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    // Drawer animation / mount can lag — retry a few times for hub steps.
    const timers = [50, 150, 320].map((ms) => window.setTimeout(updateLayout, ms));
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [open, stepIndex, targetId, updateLayout]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, finish]);

  if (!open || !step) return null;

  const goNext = () => {
    if (isLast) finish();
    else setStepIndex((i) => i + 1);
  };

  const goBack = () => {
    setStepIndex((i) => Math.max(0, i - 1));
  };

  return createPortal(
    <div className="fw-tour" role="presentation">
      <div className="fw-tour-backdrop" aria-hidden="true" />
      {spot ? (
        <div
          className="fw-tour-spotlight"
          aria-hidden="true"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
        />
      ) : null}

      <div
        ref={cardRef}
        className="fw-tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={cardStyle}
      >
        <div className="fw-tour-card-meta">
          <span className="fw-tour-step-count">
            {stepIndex + 1} of {steps.length}
          </span>
          <button type="button" className="fw-tour-skip" onClick={finish}>
            Skip
          </button>
        </div>
        <h2 id={titleId} className="fw-tour-title">
          {step.title}
        </h2>
        <p className="fw-tour-body">{step.body}</p>
        <div className="fw-tour-actions">
          <button
            type="button"
            className="btn btn-secondary fw-tour-btn"
            onClick={goBack}
            disabled={stepIndex === 0}
          >
            Back
          </button>
          <button type="button" className="btn btn-primary fw-tour-btn" onClick={goNext}>
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
