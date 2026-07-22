# Recommendation Presentation System

The visual layer of Finbrella's financial intelligence. Recommendation Registries
define guidance. The Orchestration Engine determines what is active. The
Commercial CTA Framework determines how assistance is offered. **This system
transforms recommendation instances into a consistent, action-oriented UI**
shared across every report.

```
Financial Engines
        ↓
Recommendation Registry
        ↓
Recommendation Resolver
        ↓
Recommendation Orchestration Engine
        ↓
Commercial CTA Resolver   (attached on instances)
        ↓
Recommendation Presentation System   ← this module
        ↓
Reports / future Dashboard / Notifications
```

## Design principles

1. **First-class UI objects** — every surface uses the same card language.
2. **Presentation only** — no financial calculations, no trigger logic, no CTA
   registry decisions. Components consume prepared props.
3. **Registry-agnostic components** — only `toPresentationModel()` may look up
   definition metadata (`businessMeaning`).
4. **Intent, not mechanics** — primary actions call
   `launchRecommendationAction(recommendation)`.
5. **Action groups** — `primaryActions[]` / `secondaryActions[]` for future
   commercial actions without redesigning the card.
6. **Action before explanation** — collapsed cards emphasize what to do next.

## Presentation rules (Phase 9.5)

### Context-aware primary labels

`resolvePrimaryActionLabel()` maps id → type → category → default
(“Update Information”). Behavior is unchanged (`launchRecommendationAction`).

| Example | Label |
| --- | --- |
| Protection Gap | Update Insurance Details |
| Health Coverage | Update Health Coverage |
| Emergency Fund | Review Emergency Fund |
| Retirement Shortfall | Update Retirement Savings |
| Goal Funding | Update Goal Details |
| High EMI | Update Loan Details |
| Cash Flow | Update Income & Expenses |
| Missing Information | Complete Information |
| SIP / Investment | Update Investment Details |

### Density limits

Orchestration ranking is unchanged. Lists truncate to the top N:

| Surface | `density` | Max cards |
| --- | --- | --- |
| Summary reports | `summary` | 3 |
| Detailed reports | `detailed` | 5 |

```jsx
<RecommendationList recommendations={items} density="summary" ... />
```

### Card hierarchy

1. Severity indicator  
2. Title  
3. One-line summary (clamped)  
4. Primary action(s)  
5. Secondary commercial CTA(s) when eligible  
6. View details (expand)  

Expanded: business meaning → supporting metrics → description.

### Commercial CTA eligibility

Presentation policy (`isCommercialCtaEligible`) — does **not** change the
Commercial CTA Registry. Eligible: protection, health, retirement, SIP /
investment opportunity, tax planning. Ineligible: missing-info / profile /
emergency-fund / goal-funding / cash-flow hygiene recommendations (primary
Smart Edit only).

### Empty state

Positive copy when no cards remain after filtering/density — e.g.
“Excellent! No immediate actions are required.”

## Component hierarchy

```
RecommendationGroup
  └── RecommendationList
        ├── RecommendationEmptyState
        └── RecommendationCard
              ├── RecommendationActions  (primaryActions[] → secondaryActions[])
              └── (expanded) RecommendationMetric + reasoning + description
```

## Usage

```jsx
import { RecommendationList } from '../recommendationPresentation';
import { useLaunchRecommendationAction } from '../FinancialWorkspace/FinancialWorkspaceContext';

const launchRecommendationAction = useLaunchRecommendationAction();

<RecommendationList
  recommendations={store.getByReport('safety_net')}
  density="summary"
  emptySurface="safety_net"
  onPrimaryAction={launchRecommendationAction}
  ctaContext={{ familyMembers, user, moduleName: 'Your Safety Net' }}
/>
```

## Workspace intent API

```js
launchRecommendationAction(recommendationInstance);
```

Preferred experience overrides (in Financial Workspace) land on Life Insurance,
Health Insurance, Goals picker, SIP, Loans, FD configure — without chevron
browsing and without modifying the Experience Registry.

## Pilot consumers

| Surface | Density |
| --- | --- |
| Safety Net | summary (3) |
| Useful Insights | summary (3) |
| Invest Surplus Deployment Insights | detailed (5) |

## Success criteria

A card should answer:

1. **What is the issue?** — title + summary  
2. **What should I do next?** — context-aware primary action  
3. **Can Finbrella help?** — secondary CTA only when commercially eligible  
