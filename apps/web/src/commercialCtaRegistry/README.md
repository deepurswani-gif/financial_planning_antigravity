# Commercial CTA Framework

Decides **how a recommendation's action is presented and executed**, keeping
reports, recommendations and commercial workflows fully decoupled.

```
Financial Engine
       |
Recommendation Registry
       |
Recommendation Resolver
       |
Commercial CTA Resolver   <-- this framework
       |
Reports (render CTA objects only)
```

Recommendations answer *"What should the user do next?"*. The Commercial CTA
Framework answers *"How can Finbrella help the user accomplish that?"*. These
concerns stay separate so recommendations remain objective and reusable while
commercial capabilities evolve independently.

## What reports must NOT do

Reports never decide which CTA to show, how it behaves, what workflow it
launches, or whether it is available. They render the CTA object returned by
`resolveCommercialCta(recommendation, context)` and hardcode nothing — no
labels, visibility, actions, navigation or email behaviour.

## Current business rule

Finbrella is completing regulatory approvals, so commercial CTAs such as **Buy
Policy / Buy Mutual Fund / View Plans / Compare Plans / Invest Now** must not be
shown. Every such recommendation currently resolves to **Contact Finbrella for
Help**, which reuses the existing support email service
(`services/supportRequestEmailService.js`). No new communication infrastructure
is created.

In the registry this is expressed declaratively: only `contactFinbrella` is
`active`; every other CTA is inactive metadata (regulated ones are also
`regulatoryStatus: 'pending'`). The resolver falls back to `contactFinbrella`
whenever the ideal CTA is not usable.

## Files

| File | Responsibility |
|---|---|
| `index.js` | Assembly, `Object.freeze`, public API |
| `schema.js` | `CommercialCta` typedef + `normalize/validate/assert` |
| `ctaTypes.js` | Action-type / execution-strategy / availability / regulatory vocabularies |
| `capabilities.js` | Commercial capability flags (today only assistance is on) |
| `ctas.js` | CTA definitions (single source of truth) |
| `actionMap.js` | recommendation `action.type` → ideal CTA id (the only coupling point) |
| `resolveCommercialCta.js` | The resolver + `explainResolution` diagnostics (pure) |
| `analytics.js` | Analytics-readiness metadata (no emission) |
| `validateRegistry.js` | Cross-entry diagnostics |

The execution UI lives in `components/CommercialCta/CommercialCtaButton.jsx`
(reuses the existing email service; only the `email` strategy is implemented).

## CTA schema

```js
normalizeCta({
  id: 'contactFinbrella',            // stable camelCase id
  label: 'Contact Finbrella for Help',
  description: '…',
  icon: 'send',
  actionType: 'contact',             // semantic action (CTA_ACTION_TYPES)
  availability: 'active',            // active | inactive
  regulatoryStatus: 'not_required',  // approved | pending | not_required
  executionStrategy: 'email',        // only 'email' is implemented
  analyticsEvent: 'cta_contact_finbrella',
  futureCapability: 'assistance.contactFinbrella',
  emailTemplateRef: 'support_request',   // -> existing email flow
  payloadSchema: { moduleName: { type: 'string', required: true }, … },
  commercial: false,
  fallbackCtaId: null,               // contactFinbrella for everything else
});
```

## Resolver

`resolveCommercialCta(recommendation, context)`:

1. reads `recommendation.action.type` (never any financial value)
2. maps it to the ideal CTA (`actionMap.js`)
3. checks the CTA's `availability`, `regulatoryStatus` and `futureCapability`
   against `context.capabilities`
4. returns the ideal CTA if usable, otherwise the fallback (`contactFinbrella`)
5. attaches analytics-ready metadata

Returns `null` when the recommendation has no action (`none`).

```js
import { resolveCommercialCta } from '../../commercialCtaRegistry';

const cta = resolveCommercialCta(recommendation, { report: 'safety_net' });
// -> { ctaId: 'contactFinbrella', label: 'Contact Finbrella for Help',
//      executionStrategy: 'email', fallbackApplied: true, analytics: { … } }
```

## Capability-aware evolution

To activate a richer CTA in the future, change **only the registry + resolver
config** — reports stay untouched:

1. Set the CTA `availability: 'active'` and `regulatoryStatus: 'approved'` in
   `ctas.js`.
2. Enable its `futureCapability` flag in `capabilities.js` (or pass it in
   `context.capabilities`).

Then `Recommendation → View Plans` (and eventually `→ Buy Product`) resolves to
the ideal CTA instead of the fallback. This is covered by a resolver test.

## Analytics readiness

Every resolved CTA exposes `analytics` metadata (`recommendationId`, `ctaId`,
`requestedCtaId`, `originatingReport`, `actionType`, `ctaActionType`,
`analyticsEvent`, `fallbackApplied`, `timestamp` placeholder, `completionStatus`).
This phase only exposes the metadata; nothing is emitted or persisted.

## Pilot integration

`Health Insurance Gap → Contact Finbrella for Help`. In
`components/SummaryReport/SafetyNetSection.jsx`, the health-coverage recovery
recommendation (`protection.healthAbsent` / `protection.healthPartial`, action
`viewPlans`) is passed to `resolveCommercialCta`, which returns the
`contactFinbrella` email CTA rendered by `CommercialCtaButton`.

## Scope

Built: CTA registry, schema, capability-aware resolver, validation, diagnostics,
analytics-ready metadata, tests, and one pilot integration. Not built (future
phases): regulated purchase journeys, second email service, report redesign,
changes to financial calculations, the Recommendation Registry, or Smart Edit.
