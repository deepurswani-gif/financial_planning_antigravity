/**
 * Prefer edit surface by capability / intent. Phase 1 helper — Focused shell comes in Phase 3.
 *
 * @param {import('./schema').QuestionField} field
 * @param {{ capability?: 'summary' | 'full', intent?: 'quick' | 'breakdown' | 'recap' }} [options]
 */
export function resolveEditTarget(field, options = {}) {
  if (!field) return null;

  const capability = options.capability === 'full' ? 'full' : 'summary';
  const intent = options.intent ?? 'quick';
  const surfaces = field.editSurfaces ?? [];

  if (!surfaces.length) {
    return {
      fieldId: field.id,
      experience: field.editExperience,
      sectionId: null,
      questionId: null,
      flow: null,
      capability,
      role: null,
    };
  }

  const preferredKey =
    capability === 'full'
      ? field.preferredSurface?.whenCapabilityFull
      : field.preferredSurface?.whenCapabilitySummary;

  let preferredFlow = preferredKey ?? (intent === 'breakdown' ? 'detailed' : 'summary');

  const byFlow = surfaces.filter((s) => s.flow === preferredFlow);
  const pool = byFlow.length ? byFlow : surfaces;

  let surface = pool[0];
  if (intent === 'breakdown') {
    surface = pool.find((s) => s.role === 'breakdown') ?? surface;
  } else if (intent === 'recap') {
    surface = pool.find((s) => s.role === 'recap') ?? surface;
  } else {
    surface =
      pool.find((s) => s.role === 'primary') ??
      pool.find((s) => s.role === 'recap') ??
      surface;
  }

  const requiredCapability =
    surface.capability ?? (surface.flow === 'detailed' ? 'full' : 'summary');

  return {
    fieldId: field.id,
    experience: field.editExperience,
    sectionId: surface.sectionId,
    questionId: surface.questionId,
    flow: surface.flow,
    role: surface.role ?? null,
    capability: requiredCapability,
    savePolicy: field.savePolicy,
  };
}

/**
 * @param {import('./schema').QuestionField} field
 * @returns {string[]}
 */
export function getImpactedReports(field) {
  return (field?.impacts ?? []).filter((id) => id.startsWith('report.'));
}
