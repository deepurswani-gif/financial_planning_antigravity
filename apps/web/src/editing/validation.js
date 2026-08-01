/**
 * Registry-driven validation for the Editing Platform.
 *
 * Uses each canonical field's declared `validation` and `valueType`. Purely
 * functional so the Save Pipeline can validate before persisting, and future
 * entry points (Quick Edit, AI edits) reuse the same rules.
 */

import { getFieldById } from '../questionRegistry';
import { validateISODate } from '../utils/dateFormat';

/**
 * @typedef {object} FieldValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 * @property {any} value   coerced value (when valid)
 */

/**
 * Coerce a raw input value to its declared valueType. Empty strings become
 * empty (so "required" can catch them); numbers/percents parse to Number.
 */
export function coerceValue(valueType, raw) {
  if (raw == null) return raw;
  switch (valueType) {
    case 'number':
    case 'currency':
    case 'percent':
    case 'year': {
      if (raw === '') return '';
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
      return Number.isNaN(n) ? raw : n;
    }
    case 'boolean':
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return Boolean(raw);
    case 'date': {
      if (raw === '') return '';
      const result = validateISODate(String(raw).trim());
      return result.valid ? result.iso : String(raw).trim();
    }
    case 'text':
    case 'tel':
    case 'enum':
    default:
      return raw;
  }
}

/**
 * Validate a single value against a field's registry rules.
 *
 * @param {import('../questionRegistry/schema').QuestionField} field
 * @param {any} raw
 * @returns {FieldValidationResult}
 */
export function validateFieldValue(field, raw) {
  const errors = [];
  if (!field) {
    return { valid: false, errors: ['Unknown field'], value: raw };
  }

  const rules = field.validation ?? {};
  const value = coerceValue(field.valueType, raw);

  const isEmpty =
    value == null ||
    value === '' ||
    (typeof value === 'string' && value.trim() === '');

  if (rules.required && isEmpty) {
    errors.push(`${field.shortLabel ?? field.label} is required`);
  }

  if (!isEmpty && (field.valueType === 'number' || field.valueType === 'currency' || field.valueType === 'percent' || field.valueType === 'year')) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      errors.push(`${field.shortLabel ?? field.label} must be a number`);
    } else {
      if (typeof rules.min === 'number' && value < rules.min) {
        errors.push(`${field.shortLabel ?? field.label} must be at least ${rules.min}`);
      }
      if (typeof rules.max === 'number' && value > rules.max) {
        errors.push(`${field.shortLabel ?? field.label} must be at most ${rules.max}`);
      }
    }
  }

  if (!isEmpty && field.valueType === 'date') {
    const min = typeof rules.min === 'string' ? rules.min : '';
    const max = typeof rules.max === 'string' ? rules.max : '';
    const dateResult = validateISODate(value, { min, max });
    if (!dateResult.valid) {
      errors.push(`${field.shortLabel ?? field.label}: ${dateResult.error}`);
    }
  }

  if (!isEmpty && rules.pattern && typeof value === 'string') {
    const re = rules.pattern instanceof RegExp ? rules.pattern : new RegExp(rules.pattern);
    if (!re.test(value)) {
      errors.push(`${field.shortLabel ?? field.label} is not in a valid format`);
    }
  }

  return { valid: errors.length === 0, errors, value };
}

/**
 * Validate a map of fieldId → raw value (used for `hosts`/`section` save scope).
 *
 * @param {Record<string, any>} valuesByFieldId
 * @returns {{ valid: boolean, errors: string[], values: Record<string, any> }}
 */
export function validateFieldValues(valuesByFieldId) {
  const allErrors = [];
  const values = {};
  for (const [fieldId, raw] of Object.entries(valuesByFieldId ?? {})) {
    const field = getFieldById(fieldId);
    const result = validateFieldValue(field, raw);
    values[fieldId] = result.value;
    if (!result.valid) allErrors.push(...result.errors);
  }
  return { valid: allErrors.length === 0, errors: allErrors, values };
}
