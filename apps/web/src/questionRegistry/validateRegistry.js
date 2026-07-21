import { validateField } from './schema';
import {
  SUMMARY_QUESTION_IDS_BY_SECTION,
  DETAILED_QUESTION_IDS_BY_SECTION,
} from './legacyQuestionMap';

/**
 * Cross-entry registry diagnostics for tests and the DEV explorer.
 *
 * @param {import('./schema').QuestionField[]} fields
 */
export function validateRegistry(fields) {
  const issues = [];
  const byId = new Map();
  const aliasOwners = new Map();

  for (const field of fields) {
    const fieldErrors = validateField(field);
    fieldErrors.forEach((message) => {
      issues.push({ severity: 'error', code: 'schema', fieldId: field.id, message });
    });

    if (byId.has(field.id)) {
      issues.push({
        severity: 'error',
        code: 'duplicate_id',
        fieldId: field.id,
        message: `Duplicate field id "${field.id}"`,
      });
    } else {
      byId.set(field.id, field);
    }

    for (const alias of field.aliases ?? []) {
      const key = alias.trim().toLowerCase();
      if (!key) continue;
      if (aliasOwners.has(key) && aliasOwners.get(key) !== field.id) {
        issues.push({
          severity: 'warning',
          code: 'duplicate_alias',
          fieldId: field.id,
          message: `Alias "${alias}" also used by "${aliasOwners.get(key)}"`,
        });
      } else {
        aliasOwners.set(key, field.id);
      }
    }

    if (
      (field.importance === 'critical' || field.importance === 'high') &&
      !field.businessMeaning
    ) {
      issues.push({
        severity: 'warning',
        code: 'missing_business_meaning',
        fieldId: field.id,
        message: `High-importance field "${field.id}" is missing businessMeaning`,
      });
    }

    if (!(field.editSurfaces ?? []).length && field.kind !== 'collectionItemField') {
      issues.push({
        severity: 'warning',
        code: 'missing_surfaces',
        fieldId: field.id,
        message: `Field "${field.id}" has no editSurfaces`,
      });
    }

    for (const surface of field.editSurfaces ?? []) {
      if (surface.flow === 'summary') {
        const known = SUMMARY_QUESTION_IDS_BY_SECTION[surface.sectionId];
        if (known && !known.includes(surface.questionId)) {
          issues.push({
            severity: 'warning',
            code: 'unknown_summary_question',
            fieldId: field.id,
            message: `Summary question "${surface.questionId}" not in known map for section "${surface.sectionId}"`,
          });
        }
      }
      if (surface.flow === 'detailed') {
        const known = DETAILED_QUESTION_IDS_BY_SECTION[surface.sectionId];
        if (known && !known.includes(surface.questionId)) {
          issues.push({
            severity: 'warning',
            code: 'unknown_detailed_question',
            fieldId: field.id,
            message: `Detailed question "${surface.questionId}" not in known map for section "${surface.sectionId}"`,
          });
        }
      }
    }

    if (field.kind === 'collectionItemField') {
      const collection = byId.get(field.collectionId) ?? fields.find((f) => f.id === field.collectionId);
      if (!collection) {
        issues.push({
          severity: 'error',
          code: 'missing_collection',
          fieldId: field.id,
          message: `collectionId "${field.collectionId}" not found`,
        });
      } else if (
        Array.isArray(collection.itemFieldIds) &&
        !collection.itemFieldIds.includes(field.id)
      ) {
        issues.push({
          severity: 'warning',
          code: 'collection_item_not_listed',
          fieldId: field.id,
          message: `Field not listed in ${field.collectionId}.itemFieldIds`,
        });
      }
    }
  }

  for (const field of fields) {
    if (field.kind !== 'collection' || !Array.isArray(field.itemFieldIds)) continue;
    for (const itemId of field.itemFieldIds) {
      if (!byId.has(itemId)) {
        issues.push({
          severity: 'error',
          code: 'missing_item_field',
          fieldId: field.id,
          message: `itemFieldIds references missing field "${itemId}"`,
        });
      }
    }
  }

  const mappedSummaryQuestions = new Set();
  /** @type {Map<string, Set<string>>} */
  const mappedDetailedBySection = new Map();

  for (const field of fields) {
    for (const surface of field.editSurfaces ?? []) {
      if (surface.flow === 'summary') {
        mappedSummaryQuestions.add(surface.questionId);
      }
      if (surface.flow === 'detailed') {
        if (!mappedDetailedBySection.has(surface.sectionId)) {
          mappedDetailedBySection.set(surface.sectionId, new Set());
        }
        mappedDetailedBySection.get(surface.sectionId).add(surface.questionId);
      }
    }
  }

  for (const [sectionId, questionIds] of Object.entries(SUMMARY_QUESTION_IDS_BY_SECTION)) {
    for (const questionId of questionIds) {
      if (questionId === 'INTRO' || questionId === 'SUMMARY') continue;
      if (!mappedSummaryQuestions.has(questionId)) {
        issues.push({
          severity: 'warning',
          code: 'unmapped_summary_question',
          fieldId: null,
          message: `Summary question "${questionId}" in section "${sectionId}" has no registry surface`,
        });
      }
    }
  }

  for (const [sectionId, questionIds] of Object.entries(DETAILED_QUESTION_IDS_BY_SECTION)) {
    const mapped = mappedDetailedBySection.get(sectionId) ?? new Set();
    for (const questionId of questionIds) {
      if (!mapped.has(questionId)) {
        issues.push({
          severity: 'warning',
          code: 'unmapped_detailed_question',
          fieldId: null,
          message: `Detailed question "${questionId}" in section "${sectionId}" has no registry surface`,
        });
      }
    }
  }

  return {
    ok: !issues.some((i) => i.severity === 'error'),
    issues,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
  };
}
