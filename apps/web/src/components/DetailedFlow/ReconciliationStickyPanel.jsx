import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Fixed top-left reconciliation panel — stays visible while the page scrolls.
 * Uses a portal so flex/overflow ancestors don't affect positioning.
 * Left position is intentionally hardcoded to 1rem; the form is always centered
 * so this lands in the empty left margin without overlapping inputs.
 */
export default function ReconciliationStickyPanel({ children, visible = true }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!visible || !children) return null;
    if (!mounted) return null;

    return createPortal(
        <div className="reconciliation-fixed-panel" role="status" aria-live="polite">
            {children}
        </div>,
        document.body,
    );
}
