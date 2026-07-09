import { useMemo, useSyncExternalStore } from 'react';

function subscribeToViewport(callback) {
  window.addEventListener('resize', callback);
  window.addEventListener('orientationchange', callback);
  return () => {
    window.removeEventListener('resize', callback);
    window.removeEventListener('orientationchange', callback);
  };
}

/** String snapshot so useSyncExternalStore compares with Object.is reliably across renders. */
function getViewportSnapshot() {
  return `${window.innerWidth},${window.innerHeight},${window.devicePixelRatio || 1}`;
}

function getServerViewportSnapshot() {
  return '0,0,1';
}

/**
 * Web stand-in for React Native's useWindowDimensions — subscribes via useSyncExternalStore (React 18+).
 */
function useWindowDimensions() {
  const serialized = useSyncExternalStore(
    subscribeToViewport,
    getViewportSnapshot,
    getServerViewportSnapshot
  );
  return useMemo(() => {
    const [width, height, scale] = serialized.split(',').map(Number);
    return { width, height, scale };
  }, [serialized]);
}

/**
 * @typedef {object} UseBreakpointsResult
 * @property {boolean} xl3
 * @property {boolean} xl2
 * @property {boolean} xl
 * @property {boolean} lg
 * @property {boolean} md
 * @property {boolean} sm
 * @property {boolean} xs
 * @property {number} width
 * @property {number} height
 * @property {number} scale
 */

/**
 * Responsive layout breakpoints only — never used to block or gate mobile access.
 * @returns {UseBreakpointsResult}
 */
function useBreakpoints() {
  const { width, height, scale } = useWindowDimensions();
  return useMemo(
    () => ({
      'xl3': width >= 1536,
      'xl2': width >= 1280,
      xl: width >= 1024,
      lg: width >= 768,
      md: width >= 640,
      sm: width >= 480,
      xs: width < 480,
      width,
      height,
      scale,
    }),
    [width, height, scale]
  );
}

export default useBreakpoints;
