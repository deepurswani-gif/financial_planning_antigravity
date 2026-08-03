/**
 * Reset scroll when the user advances between progressive-flow questions/sections.
 * Window is the primary scroller; also clear known nested panes if they hold scroll.
 */
export function scrollProgressiveFlowToTop() {
    if (typeof window === 'undefined') return;

    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

    document
        .querySelectorAll('.fw-section-editor-body, .fw-workspace-content, .summary-body')
        .forEach((el) => {
            if (el.scrollTop) el.scrollTop = 0;
        });
}
