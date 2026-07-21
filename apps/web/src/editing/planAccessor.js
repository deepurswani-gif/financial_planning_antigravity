/**
 * Plan Accessor — read/write plan values by a registry `state.path`.
 *
 * The Editing Platform is registry-driven: it never hardcodes which context
 * key a field lives in. Instead it interprets the canonical field's
 * `state.path` against the live FinancialPlanContext value.
 *
 * Supported path grammar:
 *   - dotted objects:            income.summarySelfInHand
 *   - nested objects:            expenseCategories.household.grocery
 *   - array member selector:     familyMembers[relation=Self].dob
 *   - collection instance:       goals[id=abc].presentValue   (via instanceId)
 *
 * Writing is immutable: it returns the next value for the ROOT segment so the
 * provider can call the matching context setter. This keeps us compatible with
 * the existing setState-based context (no direct mutation of live state).
 */

/**
 * Parse a path string into segments.
 * @param {string} path
 * @returns {Array<{ key: string, selector?: { field: string, value: string } }>}
 */
export function parsePath(path) {
  if (!path || typeof path !== 'string') return [];
  return path.split('.').map((segment) => {
    const match = segment.match(/^([a-zA-Z0-9_]+)\[([a-zA-Z0-9_]+)=([^\]]+)\]$/);
    if (match) {
      return { key: match[1], selector: { field: match[2], value: match[3] } };
    }
    return { key: segment };
  });
}

/** The top-level context key a path targets (the setter root). */
export function getRootKey(path) {
  const segments = parsePath(path);
  return segments.length ? segments[0].key : null;
}

function selectFromArray(arr, selector) {
  if (!Array.isArray(arr)) return undefined;
  return arr.find((item) => String(item?.[selector.field]) === String(selector.value));
}

/**
 * Read a value from a plan-like object by path.
 * @param {object} plan  a snapshot with top-level keys (familyMembers, income, ...)
 * @param {string} path
 * @param {{ instanceId?: string, idKey?: string }} [options]
 */
export function readValueByPath(plan, path, options = {}) {
  const segments = withInstanceSelector(parsePath(path), options);
  let cursor = plan;
  for (const segment of segments) {
    if (cursor == null) return undefined;
    cursor = cursor[segment.key];
    if (segment.selector) cursor = selectFromArray(cursor, segment.selector);
    if (cursor === undefined) return undefined;
  }
  return cursor;
}

/**
 * Produce the next value for the ROOT segment after writing `value` at `path`.
 * Immutable — clones only along the touched path.
 *
 * @param {object} plan  snapshot with top-level keys
 * @param {string} path
 * @param {any} value
 * @param {{ instanceId?: string, idKey?: string }} [options]
 * @returns {{ rootKey: string, rootValue: any }}
 */
export function computeRootUpdate(plan, path, value, options = {}) {
  const segments = withInstanceSelector(parsePath(path), options);
  if (!segments.length) {
    throw new Error('Invalid empty path');
  }
  const rootKey = segments[0].key;
  const rootValue = setAtSegments(plan?.[rootKey], segments, 0, value);
  return { rootKey, rootValue };
}

/**
 * Immutably set `value` at segments[index...] within `node`.
 * `node` corresponds to the container addressed by segments[index].key.
 */
function setAtSegments(node, segments, index, value) {
  const segment = segments[index];
  const isLast = index === segments.length - 1;

  if (segment.selector) {
    const arr = Array.isArray(node) ? node.slice() : [];
    const matchIndex = arr.findIndex(
      (item) => String(item?.[segment.selector.field]) === String(segment.selector.value),
    );
    if (isLast) {
      if (matchIndex >= 0) arr[matchIndex] = value;
      else arr.push(value);
      return arr;
    }
    const current = matchIndex >= 0
      ? arr[matchIndex]
      : { [segment.selector.field]: segment.selector.value };
    const updated = setChild(current, segments, index + 1, value);
    if (matchIndex >= 0) arr[matchIndex] = updated;
    else arr.push(updated);
    return arr;
  }

  if (isLast) return value;

  return setChild(node, segments, index + 1, value);
}

/** Set the child key (segments[index]) inside an object node, cloning it. */
function setChild(node, segments, index, value) {
  const clone = { ...(node ?? {}) };
  const childKey = segments[index].key;
  const childNode = clone[childKey];
  // Reuse setAtSegments starting at this child segment.
  clone[childKey] = setAtSegments(childNode, segments, index, value);
  return clone;
}

/**
 * If a collection instance is targeted, inject an `[idKey=instanceId]` selector
 * onto the root segment so the item is addressed within its array.
 */
function withInstanceSelector(segments, options) {
  if (!options?.instanceId || !segments.length) return segments;
  const idKey = options.idKey ?? 'id';
  const [root, ...rest] = segments;
  if (root.selector) return segments;
  return [{ key: root.key, selector: { field: idKey, value: options.instanceId } }, ...rest];
}
