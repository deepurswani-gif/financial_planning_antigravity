import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const STACK_ID = 'reconciliation-panel-stack';

function getOrCreateStackHost() {
    let host = document.getElementById(STACK_ID);
    if (!host) {
        host = document.createElement('div');
        host.id = STACK_ID;
        host.className = 'reconciliation-panel-stack';
        host.setAttribute('aria-label', 'Reconciliation summaries');
        document.body.appendChild(host);
    }
    return host;
}

function syncStackMetrics(host) {
    const root = document.documentElement;
    if (!host || host.childElementCount === 0) {
        root.style.removeProperty('--reconciliation-stack-height');
        root.classList.remove('reconciliation-stack-active');
        return;
    }
    root.classList.add('reconciliation-stack-active');
    const { height } = host.getBoundingClientRect();
    root.style.setProperty('--reconciliation-stack-height', `${Math.ceil(height)}px`);
}

function removeStackHostIfEmpty() {
    const host = document.getElementById(STACK_ID);
    if (host && host.childElementCount === 0) {
        host.remove();
    }
    syncStackMetrics(null);
}

/**
 * Fixed reconciliation panel — stays visible while the form scrolls.
 * Side-docked in the left gutter when space allows; top-docked on narrower screens.
 */
export default function ReconciliationStickyPanel({ children, visible = true }) {
    const [mounted, setMounted] = useState(false);
    const [host, setHost] = useState(null);

    useEffect(() => {
        setMounted(true);
        const stackHost = getOrCreateStackHost();
        setHost(stackHost);

        const observer = new ResizeObserver(() => syncStackMetrics(stackHost));
        observer.observe(stackHost);

        syncStackMetrics(stackHost);

        return () => {
            observer.disconnect();
            requestAnimationFrame(() => {
                removeStackHostIfEmpty();
            });
        };
    }, []);

    if (!visible || !children) return null;
    if (!mounted || !host) return null;

    return createPortal(
        <div className="reconciliation-fixed-panel" role="status" aria-live="polite">
            {children}
        </div>,
        host,
    );
}
