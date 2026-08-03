import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Capture the opener when a drawer opens, and restore focus *before*
 * calling onClose so aria-hidden is never applied to a focused descendant.
 *
 * @returns {() => void} close handler that restores focus then closes
 */
export function useDrawerFocusRestore(open, onClose) {
  const previouslyFocusedRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement;
  }, [open]);

  return useCallback(() => {
    const restore = previouslyFocusedRef.current;
    previouslyFocusedRef.current = null;

    if (restore && typeof restore.focus === 'function' && document.contains(restore)) {
      restore.focus();
    } else {
      const active = document.activeElement;
      if (active && active !== document.body && typeof active.blur === 'function') {
        active.blur();
      }
    }

    onClose?.();
  }, [onClose]);
}
