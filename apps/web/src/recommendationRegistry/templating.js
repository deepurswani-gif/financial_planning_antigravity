/**
 * Template interpolation for recommendation text.
 *
 * Recommendation `summary`/`description` are declarative templates that
 * reference signal keys by name, e.g. "Buy term cover of {protectionGapDisplay}".
 * The resolver fills these from the signals snapshot at runtime. Keeping the
 * templates declarative (data, not code) is what lets the registry stay
 * metadata-only.
 *
 * Unknown tokens are left intact (never replaced with "undefined") so a missing
 * signal degrades to a visible, debuggable placeholder rather than corrupt copy.
 */

const TOKEN_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

/**
 * @param {string} template
 * @param {Record<string, unknown>} [signals]
 * @returns {string}
 */
export function interpolate(template, signals = {}) {
  if (typeof template !== 'string' || !template) return template ?? '';
  return template.replace(TOKEN_PATTERN, (match, key) => {
    const value = signals?.[key];
    if (value === undefined || value === null) return match;
    return String(value);
  });
}

/**
 * List the token names a template references (useful for validation/tests).
 * @param {string} template
 * @returns {string[]}
 */
export function extractTokens(template) {
  if (typeof template !== 'string' || !template) return [];
  const tokens = [];
  let m;
  TOKEN_PATTERN.lastIndex = 0;
  while ((m = TOKEN_PATTERN.exec(template)) !== null) {
    tokens.push(m[1]);
  }
  return tokens;
}
