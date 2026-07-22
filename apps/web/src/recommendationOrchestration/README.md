# Recommendation Orchestration Engine

The Orchestration Engine is the **single source of truth for the user's active
financial recommendations**. It sits between the signal adapters and the
resolver, transforms applicable guidance into a single, prioritized,
lifecycle-aware set of recommendation **instances**, and exposes them
consistently to every Finbrella surface.

```
Financial Engines
        ↓
Signal Adapters            → normalized `signals`
        ↓
Recommendation Orchestration Engine   ← this module
        ↓  (consumes internally)
Recommendation Resolver    → trigger evaluation + template interpolation
        ↓  (consumes internally)
Commercial CTA Resolver    → renderable CTA
        ↓
Reports / Dashboard / Notifications / AI Assistant / Advisor CRM
```

## Responsibility split (unchanged across Finbrella)

| Layer | Owns |
| --- | --- |
| Recommendation **Registry** | Metadata — what guidance exists (immutable). |
| Recommendation **Resolver** | Interpretation — which guidance applies, wording. |
| **Orchestration Engine** | Runtime state — instances, lifecycle, ordering, dedupe, CTA. |
| Reports | Presentation only. |

The engine **never performs financial calculations** and **never duplicates**
resolver or registry responsibilities.

## Definitions vs. Instances

- The Registry contains **definitions** (immutable).
- The engine produces **instances** (dynamic). One instance per applicable
  recommendation, deduped by `recommendationId`.

An instance carries everything a channel needs:

```
{
  instanceId,          // canonical identity (== recommendationId)
  recommendationId,
  triggerId,
  status,              // lifecycle state (see below)
  priority,            // registry priority (lower = more important)
  priorityRank,        // 1-based position in the global order
  severity,
  category, type,      // category classifies guidance; it is NOT provenance
  title, summary, description,   // summary/description are interpolated
  action,              // Recommendation Registry action metadata
  originatingSources,  // [{ reportId, reportName, engineId, engineName }, ...]
  originatingReports,  // report ids derived from originatingSources
  supportingMetrics, metrics,
  tags, aiExplanation,
  createdAt, updatedAt,
  cta,                 // resolved Commercial CTA (renderable) or null
}
```

## Originating sources (provenance)

A category classifies a recommendation. It does **not** identify where that
recommendation originated.

Provenance lives on `originatingSources`, populated from the **adapter /
resolver report context** used during orchestration — never from category:

```
originatingSources: [
  {
    reportId: 'safety_net',
    reportName: 'The Safety Net',
    engineId: 'safetyNetLogic',
    engineName: 'Safety Net Logic',
  }
]
```

- `SOURCE_BY_REPORT` catalogs the known adapter surfaces.
- Callers may pass `sourceByReport` to override with adapter-declared provenance.
- Deduplication **merges** sources from every contributing report so a shared
  canonical instance retains full provenance.
- `originatingReports` is derived from `originatingSources` so store filters
  (`getByReport`) keep working without breaking changes.

## Lifecycle

States: `active`, `satisfied`, `dismissed`, `pending_assistance`, `completed`,
`expired`.

- Only **`active`** instances are surfaced today (`isRenderableStatus`).
- Transitions are validated (`canTransition`) and applied purely
  (`applyTransition`).
- Instances are re-derived from signals each run, so a future store can persist
  a **lifecycle overlay** (`recommendationId → status`) and replay it with
  `applyLifecycleOverride` / the `lifecycleOverrides` option — **no new
  persistence is introduced here**.

## Prioritization

One globally prioritized list, using **existing metadata only** (no new
financial scoring):

1. registry `priority` (lower first)
2. `severity` weight (heavier first) — this doubles as the proxy for
   *trigger importance*: a trigger's importance is reflected by the severity of
   the recommendation it fires
3. `recommendationId` (stable tie-breaker)

## Deduplication

Recommendations are resolved per report scope and collapsed into **one canonical
instance per `recommendationId`**. Contributing report provenance is merged into
`originatingSources` (and reflected in `originatingReports`). If the Emergency
Fund Gap recommendation were surfaced by Safety Net, Executive Summary and a
Dashboard, consumers still receive a single shared instance with all three
sources retained.

## Usage

### Pure API

```js
import { orchestrateRecommendations, createRecommendationStore } from '../recommendationOrchestration';

// Merge signals from every adapter for the global set, or pass a single
// adapter's signals plus a `reports` scope for a single surface.
const { instances, diagnostics } = orchestrateRecommendations(signals, {
  reports: ['safety_net'],        // optional; defaults to all REPORT_IDS
  capabilities,                   // optional; commercial capability flags
  lifecycleOverrides,             // optional; recommendationId -> status
  sourceByReport,                 // optional; adapter-declared provenance overrides
  now,                            // optional; injectable clock for tests
});
```

### Store

```js
const store = createRecommendationStore(signals, { reports: ['safety_net'] });

store.getActive();                 // all active, globally ordered
store.getByReport('safety_net');   // active for a report
store.getByCategory('protection'); // active in a category
store.getBySeverity('critical');   // active at a severity
store.getById('protection.lifeGap'); // lookup (any lifecycle state)
store.getDiagnostics();            // developer diagnostics
```

### React

```jsx
import { useRecommendationStore } from '../recommendationOrchestration';

const REPORTS = ['safety_net']; // stable module-level reference
const signals = useMemo(() => buildSafetyNetSignals(...), [deps]);
const store = useRecommendationStore(signals, { reports: REPORTS });
const steps = store.getByReport('safety_net'); // each carries a resolved `cta`
```

Reports **request** recommendations; they do not order, dedupe, or invoke the
CTA resolver. The engine attaches the resolved CTA to each instance
(`instance.cta`). Reports remain unaware of `originatingSources`.

## Diagnostics

`getDiagnostics()` / the pipeline's `diagnostics` return, for the current signal
snapshot:

- `total`, `active`
- `byLifecycle` — lifecycle state distribution
- `originatingSources` / `byOriginatingSource` — adapter/report provenance
- `byReport`, `bySeverity`, `byCategory`
- `priorityOrdering` — `[{ recommendationId, priority, severity, rank, originatingSources }]`
- `duplicatesRemoved`, `duplicateIds` — deduplication insight

Diagnostics are read-only and never affect rendering.

## Files

| File | Purpose |
| --- | --- |
| `lifecycle.js` | States, transitions, overlay application. |
| `instanceModel.js` | `createInstance` — definition → instance. |
| `originatingSources.js` | Adapter/report provenance + merge helpers. |
| `prioritize.js` | Global ordering. |
| `orchestrate.js` | Pipeline: resolve → create → dedupe/merge sources → lifecycle → sort → CTA → diagnostics. |
| `store.js` | Derived, read-only query APIs. |
| `useRecommendationStore.js` | React binding. |
| `diagnostics.js` | Developer diagnostics. |
| `index.js` | Public API. |

## Constraints honored

- No financial calculations, no registry/resolver/CTA-registry changes.
- No AI, no notifications, no new persistence.
- Channel-independent: the same instance shape serves reports, dashboards,
  notifications, email, AI and advisor CRM without changing orchestration logic.
