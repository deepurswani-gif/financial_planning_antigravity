# Experience Availability Resolver

The **single authority for capability enforcement** in Finbrella.

```
Experience Registry          (what can be edited — complete catalogue)
        ↓
Experience Availability Resolver   ← this layer
        ↓
Smart Edit                   (renders + launches from Availability Model)
```

The Experience Registry remains a **capability-agnostic catalogue** of every
editing experience. This resolver decides whether the current user may launch
each one — available, locked (visible, upgrade), or hidden.

Smart Edit **never** performs capability checks itself.

## Availability Model

Every resolution returns an immutable model:

```js
{
  available: true,
  locked: false,
  hidden: false,
  reason: null,
  subtitle: null,
  action: 'launch',           // 'launch' | 'upgrade' | 'none'
  requiredCapability: null,
}
```

Locked example (Summary user → Detailed experience):

```js
{
  available: false,
  locked: true,
  hidden: false,
  reason: 'Requires Complete Financial Planning',
  subtitle: 'Available in Complete Financial Planning',
  action: 'upgrade',
  requiredCapability: 'detailed',
}
```

## Product capabilities

| Capability | When missing |
|---|---|
| `summary` | allow (baseline) |
| `detailed` | **lock** + upgrade CTA copy |
| `advisor` | hide |
| `aiAssistant` | hide |
| `familyWorkspace` | hide |
| `premiumReports` | hide |

Mapping from Experience Registry `capability`:

| Experience `capability` | Required product caps |
|---|---|
| `any` | _(none)_ |
| `summary` | `summary` |
| `full` | `detailed` |

Future experiences may declare `requiredCapabilities: ['advisor', …]` or
`futureFeature: 'flagName'` without changing Smart Edit.

## Public API

```js
import {
  resolveExperienceAvailability,
  resolveAvailableExperiences,
  getAvailabilityDiagnostics,
} from '../../experienceAvailability';

const availability = resolveExperienceAvailability(experience, {
  capability: 'summary', // or workspaceMode / explicit capabilities
});

const visible = resolveAvailableExperiences(experiences, { capability: 'summary' });

const diag = getAvailabilityDiagnostics(experiences, { capability: 'summary' });
```

All functions are **pure**.

## Files

| File | Responsibility |
|---|---|
| `capabilities.js` | Product capability vocabulary + policies |
| `availabilityModel.js` | Immutable model factories |
| `rules.js` | Pure evaluation rules |
| `availabilityResolver.js` | Public resolvers + diagnostics |
| `validateAvailability.js` | Model / context validation |
| `index.js` | Public exports |

## Smart Edit integration

1. Model helpers call `resolveExperienceAvailability` and attach the model to
   each descriptor.
2. Hidden experiences are omitted from Frequently Updated, Browse Categories,
   and search.
3. Locked rows show a lock icon + `availability.subtitle`.
4. Selecting a locked row invokes `onLockedExperience(item)` — never launch.
5. Payment / purchase flows attach later via that callback only.
