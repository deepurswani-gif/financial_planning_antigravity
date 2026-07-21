/**
 * Smart Edit activation channel — an explicit, DOM-free way for Smart Edit to
 * tell a section component "activate this editing experience now".
 *
 * Phase 4A.7 replaces the previous DOM-selector / simulated-click approach with
 * a React context + hook. The workspace publishes an `ActivationRequest`; the
 * mounted section consumes it via `useSmartEditActivation(onActivate)` and calls
 * its own existing setters (openLoanModal, openPolicyModal, addFd, …). No
 * `querySelector`, no `element.click()`, no timing hacks.
 */

import { createContext, useContext, useEffect, useRef } from 'react';

/** @type {React.Context<null | { request: object|null, clearActivation: () => void }>} */
export const SmartEditActivationContext = createContext(null);

/**
 * Section components call this with a handler that maps an activation request to
 * their existing component API. Return `false` to decline (request stays for
 * another consumer); anything else marks it handled and clears it.
 *
 * @param {(request: object) => boolean|void} onActivate
 */
export function useSmartEditActivation(onActivate) {
  const ctx = useContext(SmartEditActivationContext);
  const handlerRef = useRef(onActivate);
  handlerRef.current = onActivate;

  const request = ctx?.request ?? null;

  useEffect(() => {
    if (!request || !ctx) return;
    const handled = handlerRef.current?.(request);
    if (handled !== false) ctx.clearActivation();
  }, [request, ctx]);
}
