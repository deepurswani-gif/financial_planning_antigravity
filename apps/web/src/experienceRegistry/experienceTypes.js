/**
 * Experience Registry — supported experience types and launch strategies.
 *
 * An "experience" is what the user intends to edit (e.g. "Home Loan"), as
 * opposed to a raw canonical field. Types describe the shape of the thing;
 * launch strategies describe how the editing UI is opened. Both are frozen
 * vocabularies so Smart Edit and future entry points stay consistent.
 */

/** What kind of financial object the experience represents. */
export const EXPERIENCE_TYPES = Object.freeze([
  'scalar', // a single value (Salary, Household Expenses)
  'configure', // a compound object with a dedicated configure flow (Home Loan)
  'collection', // a set of instances (Goals, Children, Policies, FDs)
  'wizard', // a short guided multi-step edit (Growth Assumptions)
  'read_only', // explained, not directly edited (Total EMI — derived)
]);

/** How the editing UI is launched. Maps to existing platform capabilities. */
export const LAUNCH_STRATEGIES = Object.freeze([
  'focused_edit_session', // Editing Platform Focused Edit Mode
  'configure_modal', // an existing configure modal (e.g. Income Tax calculator)
  'configure_screen', // an existing configure screen / section editor
  'collection_picker', // pick an instance, then edit (reuses existing screen)
  'mini_wizard', // an existing short guided flow / section
  'readonly_explanation', // show explanation; route to the real editable source
]);

/** Capability required to fully use an experience. */
export const EXPERIENCE_CAPABILITIES = Object.freeze(['any', 'summary', 'full']);

export function isExperienceType(type) {
  return EXPERIENCE_TYPES.includes(type);
}

export function isLaunchStrategy(strategy) {
  return LAUNCH_STRATEGIES.includes(strategy);
}

export function isExperienceCapability(capability) {
  return EXPERIENCE_CAPABILITIES.includes(capability);
}

/** Default launch strategy for a given experience type. */
export function defaultLaunchStrategy(experienceType) {
  switch (experienceType) {
    case 'scalar':
      return 'focused_edit_session';
    case 'configure':
      return 'configure_screen';
    case 'collection':
      return 'collection_picker';
    case 'wizard':
      return 'mini_wizard';
    case 'read_only':
      return 'readonly_explanation';
    default:
      return 'focused_edit_session';
  }
}
