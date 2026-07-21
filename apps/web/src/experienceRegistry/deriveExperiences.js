/**
 * Auto-derive experiences for the long tail of editable fields.
 *
 * Every canonical field that a curated experience does not already "claim"
 * still needs to be reachable from Smart Edit. Rather than hand-author an
 * experience for each, we derive one from the field's own registry metadata —
 * so there is a single source of truth (the field) and zero duplication.
 *
 * Mapping:
 *   collection field                 → collection experience (collection_picker)
 *   field w/ editExperience 'modal'  → configure experience (configure_screen)
 *   scalar field (question/single/breakdown) → scalar experience (focused_edit_session)
 *
 * Collection sub-fields (kind 'collectionItemField') are never surfaced as
 * top-level experiences.
 */

import { QUESTION_REGISTRY } from '../questionRegistry';

const DERIVABLE_KINDS = new Set(['field', 'collection']);

/**
 * @param {Iterable<string>} claimedFieldIds  field ids already used by curated experiences
 * @param {ReadonlyArray} [registry]
 * @returns {object[]} experience partials (pre-normalization)
 */
export function deriveExperiences(claimedFieldIds, registry = QUESTION_REGISTRY) {
  const claimed = new Set(claimedFieldIds);
  const derived = [];

  for (const field of registry) {
    if (!DERIVABLE_KINDS.has(field.kind)) continue;
    if (claimed.has(field.id)) continue;

    const experienceType = classifyExperienceType(field);
    const partial = {
      id: field.id,
      title: field.label,
      aliases: [],
      experienceType,
      capability: 'any',
      icon: null,
      registryTargets: [field.id],
      searchPriority: field.quickEditPriority,
      quickEditPriority: field.quickEditPriority,
      uiCategory: field.uiCategory,
      businessMeaning: field.businessMeaning ?? null,
      derived: true,
    };

    if (experienceType === 'collection') {
      partial.collectionResolver = {
        collectionFieldId: field.id,
        idKey: field.state?.idKey ?? 'id',
      };
      partial.picker = { strategy: 'instance_list' };
    }

    derived.push(partial);
  }

  return derived;
}

function classifyExperienceType(field) {
  if (field.kind === 'collection') return 'collection';
  const type = field.editExperience?.type;
  if (type === 'modal') return 'configure';
  return 'scalar';
}
