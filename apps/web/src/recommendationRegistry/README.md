# Recommendation Registry

The **single source of truth** for every recommendation shown anywhere in
Finbrella. Reports are *consumers* of recommendations, never *creators*.

```
Question Registry            Experience Registry           Recommendation Registry
        |                            |                              |
      Forms                     Smart Edit                    Recommendation Resolver
                                                                    |
                                                                 Reports
```

Financial guidance is centralized here so it can be reused consistently across
reports, dashboards, notifications, AI assistants and future commercial
workflows — without report components owning any financial knowledge.

## Design principles

1. **Declarative metadata only.** A recommendation contains **no executable
   functions**. Applicability is a stable `triggerId`; text is `{token}`
   templates. Logic lives in the resolver, not the metadata.
2. **Presentation-independent.** No colours, icons, CTAs or component references.
   Reports own styling; the registry owns wording, severity and meaning.
3. **The resolver never calculates.** It reads a pre-computed `signals` snapshot
   produced by report adapters from existing calculation engines.
4. **Reference, don't duplicate.** Recommendations point at canonical question
   registry `relatedFields`; defaults like `businessMeaning` are pulled from
   there when omitted.
5. **Fail fast.** The registry is assembled, asserted and `Object.freeze`d at
   import; malformed or duplicate entries throw immediately.

## Data flow

```
Existing engines (*Logic.js, allocationEngine/)
        |
   Report adapter  ->  signals snapshot   (adapters/*.js — no recomputation)
        |
Recommendation Registry (declarative)      Trigger evaluators (executable)
        \___________________  ____________________/
                            \/
              Recommendation Resolver
        (evaluate trigger / dedupe / sort by priority / interpolate)
                            |
                     Reports (present)
```

## Files

| File | Responsibility |
|---|---|
| `index.js` | Assembly, `Object.freeze`, public API |
| `schema.js` | `Recommendation` typedef + `normalize/validate/assert` |
| `categories.js` | High-level financial domains (frozen vocabulary) |
| `recommendationTypes.js` | Granular recommendation types (frozen vocabulary) |
| `severity.js` | Severity vocabulary + weight (metadata only) |
| `triggers.js` | Stable trigger-id vocabulary (metadata) |
| `triggerEvaluators.js` | Executable trigger predicates (resolver-owned) |
| `actions.js` | Generic, UI-agnostic Action model (placeholder) |
| `reports.js` | Report-id vocabulary |
| `templating.js` | `{token}` interpolation from signals |
| `search.js` | Pure `searchRecommendations` scorer |
| `validateRegistry.js` | Cross-entry diagnostics |
| `resolveRecommendations.js` | The Resolver (pure) |
| `recommendations/*.js` | Entries, one file per domain |
| `adapters/*.js` | Engine-output → signals mappers |

## Anatomy of a recommendation

```js
normalizeRecommendation({
  id: 'protection.lifeGap',              // dotted camelCase, unique
  title: 'Fill Protection Gap',
  summary: "Buy term cover of {protectionGapDisplay} to secure your family's future.",
  category: 'protection',                // high-level domain
  type: 'protectionGap',                 // granular concept
  severity: 'critical',                  // metadata only
  priority: 10,                          // lower = shown first
  triggerId: 'HAS_PROTECTION_GAP',       // resolver evaluates this
  reports: ['safety_net'],               // where it may surface
  relatedFields: ['protection.life.totalCover'],   // canonical question fields
  supportingMetrics: ['protectionGap', 'protectionGapDisplay'], // exposed to report
  businessMeaning: 'Life cover replaces lost income…',
  action: 'viewPlans',                   // metadata-only Action placeholder
});
```

## Consuming from a report

```js
import { resolveRecommendations } from '../../recommendationRegistry';
import { buildSafetyNetSignals } from '../../recommendationRegistry/adapters/safetyNetAdapter';

const recs = useMemo(() => {
  const signals = buildSafetyNetSignals({ protectionData, contingencyData, healthData });
  return resolveRecommendations(signals, { report: 'safety_net' });
}, [protectionData, contingencyData, healthData]);
```

Each resolved recommendation exposes: `id, title, summary, description, category,
type, severity, priority, reports, metrics, action, aiExplanation, tags`. The
report maps these to its own presentation (icons, colours, urgency labels).

## Adding a recommendation

1. Add the entry to the appropriate `recommendations/<domain>.js` file.
2. If it needs a new applicability rule, add a `triggerId` to `triggers.js` and
   its predicate to `triggerEvaluators.js`.
3. Ensure the driving report's adapter populates the `signals` the template and
   trigger reference (every `{token}` should also be in `supportingMetrics`).
4. Run `npm test -- --run src/recommendationRegistry`.

## Future compatibility

The registry is deliberately presentation-independent so later phases can attach
behaviour **without changing report components**:

- **Commercial CTAs / product flows** → read `action` (already a generic model;
  default `{ type: 'none' }`).
- **AI explanations** → populate the reserved `aiExplanation` placeholder.
- **Dashboard widgets, notifications, email summaries** → call
  `resolveRecommendations(signals)` (optionally without a `report` filter) and
  render the descriptors in any surface.

Out of scope for this phase: the CTA framework, email/product flows, UI redesign
and AI generation.
