/**
 * Recommendation density limits — presentation only.
 * Orchestration ranking is unchanged; lists simply truncate to the top N.
 */

export const DENSITY_LIMITS = Object.freeze({
  /** Summary reports (Safety Net, Useful Insights, …) */
  summary: 3,
  /** Detailed reports (Invest Surplus, …) */
  detailed: 5,
});

/**
 * @param {'summary'|'detailed'|number|null|undefined} density
 * @returns {number|null} max items, or null for no limit
 */
export function resolveDensityLimit(density) {
  if (density == null) return null;
  if (typeof density === 'number' && Number.isFinite(density) && density >= 0) {
    return Math.floor(density);
  }
  if (typeof density === 'string' && density in DENSITY_LIMITS) {
    return DENSITY_LIMITS[density];
  }
  return null;
}

/**
 * Keep the highest-priority items already ordered by orchestration.
 * @template T
 * @param {T[]} items
 * @param {'summary'|'detailed'|number|null|undefined} density
 * @returns {T[]}
 */
export function applyDensityLimit(items = [], density) {
  const limit = resolveDensityLimit(density);
  if (limit == null) return [...items];
  return items.slice(0, limit);
}
