# Experience Registry (Phase 4A.5)

The **Experience Registry** is a lightweight abstraction that sits **between Smart
Edit and the Question Registry**. It is the single source of truth for
**launching editing experiences**.

```
Smart Edit UX
     │  searches / displays
     ▼
Experience Registry   ← this layer
     │  references (never duplicates)
     ▼
Question Registry (frozen)  ──▶  Editing Platform (frozen)
```

## Why it exists

The Question Registry models **canonical fields**. But users don't think "edit
`liabilities.loans.home`" — they think **"edit my Home Loan"**. Many entities
(Loans, Insurance Policies, Goals, Children, Fixed Deposits) are complex objects
with dedicated configure workflows. Smart Edit needs to launch the *right
experience*, not a raw field.

This registry adds the missing **intent + launch** layer without redesigning the
Question Registry or the Editing Platform.

## What an Experience is

An experience describes *what the user intends to edit* and *how to open it*:

| Property | Purpose |
|----------|---------|
| `id` | stable experience id (dotted, e.g. `income.salary`) |
| `title` | user-facing intent title (e.g. "Monthly Salary") |
| `aliases` | intent-level search synonyms (field aliases come from the registry) |
| `experienceType` | `scalar` · `configure` · `collection` · `wizard` · `read_only` |
| `launchStrategy` | how the UI opens (see below) |
| `capability` | `any` · `summary` · `full` |
| `icon` | optional lucide icon key |
| `registryTargets` | canonical field ids; `[0]` is primary |
| `picker` | picker strategy for collections |
| `configureComponent` | reference to an existing configure modal/section |
| `collectionResolver` | how instances are resolved (collections) |
| `searchPriority` | search ranking weight |
| `quickEditPriority` | Frequently-Updated ranking |

**No field metadata is duplicated.** Labels, aliases, `businessMeaning`, and
`searchBoost` are read from the referenced `registryTargets` at read time.

## Launch strategies (reuse existing UI only)

| Strategy | Opens | Reuses |
|----------|-------|--------|
| `focused_edit_session` | Focused Edit Mode | Editing Platform |
| `configure_modal` | existing calculator/config modal | e.g. Income Tax calculator |
| `configure_screen` | existing section editor | `WorkspaceSectionEditor` |
| `collection_picker` | existing screen that manages the collection | section editor |
| `mini_wizard` | existing short guided flow / section | section editor |
| `readonly_explanation` | explanation + link to the real editable source | — |

The **resolver** (`resolveLaunch`) turns an experience + capability into a
concrete `LaunchDescriptor`, deriving section ids from the Question Registry's
own `editSurfaces` (`resolveEditTarget`). It introduces **no new navigation
mappings** and performs **no side effects** — Smart Edit dispatches the result.

## Composition

The registry is assembled from two sources:

1. **Curated experiences** (`experiences.js`) — the primary user intents (Salary,
   Household Expenses, Home Loan, Life Insurance, Goals, Children, Fixed
   Deposits, Income Tax, Growth Assumptions, …).
2. **Auto-derived experiences** (`deriveExperiences.js`) — one per canonical
   field not already claimed by a curated experience, so **every editable field
   stays reachable** with zero hand-authoring and zero duplication.

Curated `registryTargets` are "claimed" so derivation never produces duplicates.
`getExperienceRegistryDiagnostics()` asserts full coverage (no gaps).

## Public API (`experienceRegistry/index.js`)

```js
getExperienceById(id)
listExperiences({ uiCategory?, experienceType?, curatedOnly? })
searchExperiences(query, options?)            // intent-aware ranking
listFrequentlyUpdatedExperiences({ limit? })  // metadata-driven (quickEditPriority)
listExperienceCategories()                    // browse tree by UI category
resolveLaunch(experience, { capability, intent?, instanceId? })
getExperienceRegistryDiagnostics()
```

## Smart Edit integration

Smart Edit now searches, browses, and displays **experiences** (see
`components/FinancialWorkspace/smartEdit/smartEditModel.js`). Selecting a result
calls `FinancialWorkspaceView.handleLaunchExperience`, which:

1. `getExperienceById` → `resolveLaunch(experience, { capability })`
2. dispatches by strategy using **existing** capabilities only:
   - `focused_edit_session` → `startEditSession(fieldId, { origin })`
   - `configure_modal` → `openCalculator(calculatorId)`
   - `configure_screen` / `collection_picker` / `mini_wizard` /
     `readonly_explanation` → navigate to the existing section via
     `financialWorkspacePath({ edit })`

Search examples:

| Query | Experience |
|-------|-----------|
| "Salary" | Monthly Salary (`income.salary`) |
| "Home Loan" | Home Loan (`liabilities.homeLoan`) |
| "Life Insurance" | Life Insurance Policies (`protection.lifeInsurance`) |
| "Goals" | Goals (`goals.collection`) |
| "Children" | Children (`family.children`) |

## Landing Targets (Phase 4A.6)

The Experience Registry decides *what* to launch. **Landing Targets** decide
*where inside that experience the user lands* — so Smart Edit never forces
chevron-browsing to find the right field or Configure control.

```
Search → Select experience → Land on the exact control → Save → Return
```

### Model (`landingTargets.js`)

A landing target is a **stable logical id** (never a question index or route
position) that names the first interactive control the user expects to edit:

| id | control | resolves via field |
|----|---------|--------------------|
| `income.selfSalary` | `scalar` | `income.self.monthlyTakeHome` |
| `expenses.household` | `scalar` | `expenses.household.monthlyTotal` |
| `insurance.life` | `collection` | `protection.life.policies` |
| `loan.personal` | `configure` | `debt.emi.loans` |
| `asset.fd` | `collection` | `assets.fixedDeposits` |
| `goal.selection` / `goal.years` / `goal.value` | `question` | `goals.item.*` |

Controls: `scalar` (Focused Edit), `question` (land on a question),
`configure` (land + reveal/auto-launch a Configure control), `collection`
(open instance list, or Add mode when empty).

A landing target only references a canonical field so the resolver can look up
the concrete `(section, question)` from the registry's own `editSurfaces`. **No
field metadata is duplicated** — landing targets describe *navigation intent
only* and stay valid even if question ordering changes.

### Experience integration

Each experience declares an optional `landingTarget` (see `experiences.js`).
When absent, the resolver derives one from the primary target + experience type.

### Resolver (`resolveLanding.js`)

`resolveLanding(experience, { capability })` →
`{ landingTargetId, control, sectionId, questionId, collectionFieldId }`.
It reuses `resolveEditTarget`; full users land on the detailed surface (where
Configure controls live), summary users on the summary surface.

`resolveLaunch` folds this in — section descriptors now carry
`landingQuestionId`, `landingControl`, and `collectionFieldId`.

### Orchestration (no redesign)

`handleLaunchExperience` appends the landing to the URL
(`financialWorkspacePath({ edit, land, control, collection })`). Both
`ProgressiveQuestionLayout` and `DetailedProgressiveLayout` consume
`useLandingQuestion(questions)`:

1. jump directly to the requested question (skipping unrelated ones),
2. `focusLandingControl` scrolls + focuses the first control,
3. one-shot: the `land`/`control`/`collection` params are cleared so chevron
   navigation and refreshes behave normally afterwards.

**Configure auto-launch** is opt-in: a question may expose
`[data-landing-configure]` (or `[data-landing-add]` for empty collections) and
the helper will click it. Components are never *required* to add these — landing
already renders only the correct question, so its Configure button is visible.
Ambiguous multi-instance cases (e.g. choosing among several loans) are left as
an intentional business workflow rather than auto-clicked.

## Activation (Phase 4A.7)

Landing puts the user on the right question. **Activation** completes the intent
by opening the first meaningful editing experience — so Smart Edit never stops
at a screen where the user must still hunt for a Configure button.

```
Search → Experience → Landing Target → Activation → Edit → Save → Return
```

### Strategies (`activationStrategies.js`)

`openFocusedEditor` · `openConfigureModal` · `openConfigureScreen` ·
`openCollectionPicker` · `openExistingInstance` · `openAddFlow` · `noActivation`.

### Resolver (`resolveActivation.js`)

- `resolveActivation(experience, landing, { instances? })` — metadata-driven:
  scalars → `openFocusedEditor`; calculators → `openConfigureModal`; deterministic
  configure (Home Loan, Life policy) → `openConfigureModal`; collections defer to
  instance count; read-only → `noActivation`.
- `resolveInstanceActivation(instances)` — the **never-guess** rule:
  `0 → openAddFlow`, `1 → openExistingInstance`, `>1 → openCollectionPicker`.
- `buildActivationRequest(experience, landing)` — builds the component-agnostic
  request (`{ channel, key, collection, collectionFieldId, questionId }`).

Experiences declare `activation: { channel, key?, collection?, screen? }` (see
`experiences.js`): Home Loan `{ loanModal, homeLoan }`, Life Insurance
`{ lifePolicyModal }`, Fixed Deposits `{ fdCollection, collection }`, Recurring
Deposits `{ rdCollection, collection }`.

### Explicit activation channel (no DOM)

Per the phase requirement, activation uses **explicit component APIs**, never
`querySelector` / `element.click()` / timing hacks (the previous
`data-landing-configure` click path was removed).

- `FinancialWorkspaceView` provides `SmartEditActivationContext` and, on launch,
  publishes an `ActivationRequest` before navigating to the section.
- Section components call `useSmartEditActivation(onActivate)` and map the
  request's `channel` to their existing setters:
  - `DetailedMoneyInOut`: `loanModal` → `setActiveLoanModal(key)`,
    `lifePolicyModal` → `setShowPolicyDetailsModal(true)`, `rdCollection` →
    add / open / picker via `resolveInstanceActivation`.
  - `DetailedMyWealthSnapshot`: `fdCollection` → add / open / picker.
- When multiple instances exist, the section renders `SmartEditInstancePicker`
  (a lightweight chooser) instead of guessing.

The existing configure components (LoanDetailsModal, LifePolicyDetailsModal,
InvestmentDetailsModal, …) are reused unchanged — Smart Edit only invokes them.

## Dynamic Entity Resolver (Phase 5)

The Experience Registry answers **"what *kind* of thing does the user want to
edit?"**. The **Dynamic Entity Resolver** answers **"*which specific* thing?"**
by extracting the user's live financial objects from the Financial Plan, so
Smart Edit finds what the user *remembers* — not where it was entered.

```
Searching "Life Insurance" → generic experience        (Experience Registry)
Searching "LIC Jeevan Anand" → that exact policy        (Dynamic Entity Resolver)
Searching "Marriage" / "Aarav" / "HDFC FD" → that object (Dynamic Entity Resolver)
```

Lives in `components/FinancialWorkspace/smartEdit/` (it derives from app plan
state, so it is **not** part of the frozen registry):

- `dynamicEntities.js` — pure `resolveEntities(plan)` + `searchEntities` +
  `matchScore`. An extractor per entity type (life policies, loans, FDs, RDs,
  goals, children, custom assets/liabilities) reads the relevant plan slice.
- `useDynamicEntities.js` — memoized binding; rebuilds only when a plan slice
  changes, never on every keystroke.

### Entity model

Each entity **references** an Experience (`experienceId`) and never duplicates
registry metadata:

| field | purpose |
|-------|---------|
| `entityId` | stable id, unique within a plan (`type:instance`) |
| `entityType` | `lifePolicy` · `loan` · `fixedDeposit` · `recurringDeposit` · `goal` · `child` · `customAsset` · `customLiability` |
| `displayName` / `aliases` | what the user searches for |
| `experienceId` | the Experience this maps to (validated to exist) |
| `instanceId` / `instanceIndex` | identity within the collection |
| `activation` | exact-instance override (`{ channel, key?, index? }`) |
| `searchBoost` / `subtitle` / `icon` | ranking + presentation |

### Search + ranking (merged)

`searchSmartEdit(query, { entities })` scores **experiences and entities on one
scale** (`matchScore`: exact > alias-exact > prefix > substring, plus
per-type boost / search priority) and returns unified descriptors tagged
`kind: 'experience' | 'entity'`. A remembered object outranks the generic
experience; an unmatched bare term (e.g. "FD") **falls back** to the generic
experience.

### Exact-instance launch (no picker)

Selecting an entity carries its launch context through
`handleLaunchExperience`. When the entity has an `activation` override, the
workspace publishes an `ActivationRequest` with the **exact index/key** so the
section opens *that* object directly — bypassing `SmartEditInstancePicker`
(FDs/RDs honour `request.index`; loans use `request.key`). Goals, children, and
custom items land on their section (no per-instance modal exists to reuse).

Stateless, additive, and reuses every existing configure component unchanged.

## Scope (Phase 4A.5 / 4A.6 / 4A.7 / 5)

Architectural / orchestration only. These phases **do not** build new configure
UIs, redesign existing configure components, or touch the Editing Platform, Save
Pipeline, or Smart Edit Drawer. They create the abstraction that lets Smart Edit
launch the correct editing experience, **land on the correct control**,
**activate it automatically**, and **search the user's live financial objects**
(all reusing existing configure components).

Out of scope: AI-assisted editing, voice, bulk editing, report editing,
recommendation CTAs, instance-aware search beyond exact-match launch.
