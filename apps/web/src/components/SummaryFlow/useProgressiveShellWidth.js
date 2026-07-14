import { useEffect } from 'react';

const SHELL_WIDTH = {
    default: '650px',
    wide: '1024px',
};

/**
 * Syncs document-level shell width tokens and returns the shell className.
 * @param {'default' | 'wide'} contentWidth
 */
export function useProgressiveShellWidth(contentWidth = 'default') {
    const isWide = contentWidth === 'wide';

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty(
            '--progressive-shell-max-width',
            isWide ? SHELL_WIDTH.wide : SHELL_WIDTH.default,
        );
        root.classList.toggle('progressive-shell-wide', isWide);

        return () => {
            root.style.setProperty('--progressive-shell-max-width', SHELL_WIDTH.default);
            root.classList.remove('progressive-shell-wide');
        };
    }, [isWide]);

    return isWide
        ? 'progressive-question-shell progressive-question-shell--wide'
        : 'progressive-question-shell';
}
