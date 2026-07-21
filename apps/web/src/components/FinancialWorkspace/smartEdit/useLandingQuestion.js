/**
 * useLandingQuestion — Smart Edit landing orchestration for progressive layouts.
 *
 * When Smart Edit launches a section-based experience it appends stable landing
 * params to the URL (`land` = question id, `control` = scalar|question|configure
 * |collection, `collection` = collection field id). This hook reads those params,
 * validates the requested question exists in the current step, and returns a
 * one-shot instruction the layout can honor (jump to the question, focus/scroll,
 * optionally reveal a Configure control). It then clears the params so chevron
 * navigation and refreshes behave normally afterwards.
 *
 * It is intentionally thin: it does NOT own layout state, it only tells the
 * layout where to land. This keeps landing an orchestration layer, independent
 * of question ordering.
 */

import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useLandingQuestion(questions = []) {
  const location = useLocation();
  const navigate = useNavigate();

  const { landRaw, control, collection } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      landRaw: params.get('land'),
      control: params.get('control'),
      collection: params.get('collection'),
    };
  }, [location.search]);

  const landingQuestionId = useMemo(() => {
    if (!landRaw) return null;
    return questions.some((q) => q && q.id === landRaw) ? landRaw : null;
  }, [landRaw, questions]);

  const clearLanding = useCallback(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has('land') && !params.has('control') && !params.has('collection')) {
      return;
    }
    params.delete('land');
    params.delete('control');
    params.delete('collection');
    const query = params.toString();
    navigate(`${location.pathname}${query ? `?${query}` : ''}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return { landingQuestionId, control, collection, clearLanding };
}

const FOCUS_ATTEMPT_DELAYS = [60, 260];

/**
 * After landing on the right question, gently bring its first input into view
 * and focus it. This is presentation only — *activating* an editing experience
 * (opening a configure modal, add flow, or picker) is handled explicitly via
 * the activation channel (`useSmartEditActivation`), never by simulated clicks.
 *
 * `control` is accepted for API stability but no longer drives any DOM clicks.
 */
export function focusLandingControl(/* control */) {
  if (typeof document === 'undefined') return;

  const run = () => {
    const scope =
      document.querySelector('.fw-section-editor-body') ||
      document.querySelector('.progressive-shell') ||
      document.querySelector('.progressive-shell-wide') ||
      document.body;
    if (!scope) return false;

    const focusable = scope.querySelector(
      'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])',
    );
    if (focusable) {
      focusable.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof focusable.focus === 'function') {
        focusable.focus({ preventScroll: true });
      }
      return true;
    }
    return false;
  };

  FOCUS_ATTEMPT_DELAYS.forEach((delay) => {
    setTimeout(run, delay);
  });
}
