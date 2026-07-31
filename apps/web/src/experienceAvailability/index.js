/**
 * Experience Availability — public API.
 *
 * Single authority for capability enforcement between the Experience Registry
 * and Smart Edit. See README.md.
 */

export {
  PRODUCT_CAPABILITIES,
  CAPABILITY_POLICIES,
  EXPERIENCE_CAPABILITY_REQUIREMENTS,
  capabilitiesFromWorkspaceMode,
  resolveUserCapabilities,
  getRequiredCapabilities,
  isProductCapability,
  isFeatureEnabled,
} from './capabilities';

export {
  AVAILABILITY_ACTIONS,
  createAvailabilityModel,
  availableModel,
  lockedModel,
  hiddenModel,
} from './availabilityModel';

export {
  resolveExperienceAvailability,
  resolveAvailableExperiences,
  getAvailabilityDiagnostics,
} from './availabilityResolver';

export {
  validateAvailabilityModel,
  validateAvailabilityContext,
  assertAvailabilityModel,
} from './validateAvailability';

export { evaluateAvailabilityRules, evaluateCapabilityRequirement } from './rules';
