/**
 * Notification template interpolation.
 * Supports {{token}} (preferred) and {token} (compat with recommendation registry).
 * Missing tokens are left intact for debuggability.
 */

const TOKEN_PATTERN = /\{\{([a-zA-Z0-9_]+)\}\}|\{([a-zA-Z0-9_]+)\}/g;

/**
 * @param {string} template
 * @param {Record<string, unknown>} [values]
 */
export function interpolate(template, values = {}) {
  if (typeof template !== 'string' || !template) return template ?? '';
  return template.replace(TOKEN_PATTERN, (match, mustacheKey, braceKey) => {
    const key = mustacheKey || braceKey;
    const value = values?.[key];
    if (value === undefined || value === null) return match;
    return String(value);
  });
}

/**
 * @param {string} template
 * @returns {string[]}
 */
export function extractTokens(template) {
  if (typeof template !== 'string' || !template) return [];
  const tokens = [];
  let m;
  TOKEN_PATTERN.lastIndex = 0;
  while ((m = TOKEN_PATTERN.exec(template)) !== null) {
    tokens.push(m[1] || m[2]);
  }
  return tokens;
}
