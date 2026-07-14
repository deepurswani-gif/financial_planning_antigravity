import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RECONCILIATION_STACK_ID } from './reconciliationStackId';

function getStackHost() {
    if (typeof document === 'undefined') return null;
    return document.getElementById(RECONCILIATION_STACK_ID);
}

/**
 * Portals reconciliation bar content into the fixed flow chrome (below step nav).
 */
export default function ReconciliationStickyPanel({ children, visible = true }) {
    const host = getStackHost();

    useEffect(() => {
        if (!host) return undefined;
        host.dispatchEvent(new CustomEvent('reconciliation-stack-change'));
        return () => {
            requestAnimationFrame(() => {
                host.dispatchEvent(new CustomEvent('reconciliation-stack-change'));
            });
        };
    }, [host, visible, children]);

    if (!visible || !children || !host) return null;

    return createPortal(
        <div className="reconciliation-fixed-panel" role="status" aria-live="polite">
            {children}
        </div>,
        host,
    );
}
