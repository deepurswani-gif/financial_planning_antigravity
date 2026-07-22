# Recommendation Migration Inventory

This is the audit of every recommendation / insight / advice string currently
produced by Finbrella report code, grouped by the high-level category it maps to
in the Recommendation Registry.

Legend for **Status**:

- **Migrated + wired** — text now lives in the registry and the report renders it
  via the Recommendation Resolver (Phase 6 pilot).
- **Migrated (deferred wiring)** — canonical definition added to the registry, but
  the report component still uses its original generator (to be switched over in a
  follow-up). No behaviour change yet; preserves backward compatibility.
- **Deferred** — not yet migrated; documented here so coverage is not lost.

> Architectural note: recommendation strings live almost entirely in the sibling
> `*Logic.js` modules (via `compute*Insights` / `build*` helpers), not in the JSX.
> Those functions remain in place for backward compatibility; migrated pilot
> components read from the registry instead.

---

## Protection

| Source (file · function) | Original text | Driving metric | Original severity/tone | Registry id | Status |
|---|---|---|---|---|---|
| `SafetyNetLogic.buildRecoverySteps` | "Buy term cover of {gap} to secure your family's future." | `protectionData.protectionGap` (HLV) | urgency Immediate · `#6366F1` | `protection.lifeGap` | Migrated + wired |
| `SafetyNetLogic.buildRecoverySteps` | "Get family health insurance with at least {min} sum insured." | `healthData.coverageHave === 0` | urgency High · `#00A9F2` | `protection.healthAbsent` | Migrated + wired |
| `SafetyNetLogic.buildRecoverySteps` | "Increase health cover by {gap} to reach the {min} minimum." | `healthData.healthGap` | urgency High · `#00A9F2` | `protection.healthPartial` | Migrated + wired |
| `ExecutiveSummaryLogic` action priorities | "Close life and health coverage gaps to protect your family against major risks." | weak `family-protection` pillar | priority card | `protection.closeCoverageGaps` | Migrated + wired |
| `investSurplusLogic.buildInvestSurplusReport` suggestion | "Life cover helps your family maintain lifestyle if income stops unexpectedly." | `protectionData.hasGap` | tone accent | `protection.investSurplusGap` | Migrated (deferred wiring) |
| `SafetyNetSection.jsx` health-status block | "A single major hospitalization can cost ₹3–8 Lakh… minimum sum insured of {min}." | `healthData.status` | status-based | — | Deferred |
| `SafetyNetLogic.buildCrisisTimeline` | 4-stage crisis timeline copy | contingency + protection years | staged colours | — | Deferred |

## Emergency

| Source | Original text | Driving metric | Severity/tone | Registry id | Status |
|---|---|---|---|---|---|
| `SafetyNetLogic.buildRecoverySteps` | "Assign remaining funds for emergency reserves of {gap}." | `contingencyData.gap` | urgency Immediate · `#F59E0B` | `emergency.buildFund` | Migrated + wired |
| `ExecutiveSummaryLogic` action priorities | "Build liquid emergency reserves toward at least 6 months of expenses and EMIs." | weak `emergency` pillar | priority card | `emergency.buildReserves` | Migrated + wired |
| `investSurplusLogic` suggestion | "Your fund covers ~{months} months; ideal is {n} months." | `contingencyData.gap` | tone warning | `emergency.investSurplusBuffer` | Migrated (deferred wiring) |

## Cash Flow

| Source | Original text | Driving metric | Severity/tone | Registry id | Status |
|---|---|---|---|---|---|
| `ExecutiveSummaryLogic` action priorities | "Improve monthly surplus by reducing avoidable expenses or high-cost EMIs." | weak `daily-stability` pillar | priority card | `cashflow.improveSurplus` | Migrated + wired |
| `investSurplusLogic.computeInvestSurplusInsights` | "No free cash flow this month — review expenses or income before allocating new investments." | `monthlyFreeCash <= 0` | tone warning | `cashflow.noFreeCash` | Migrated + wired |
| `moneyFlowLedgerLogic.computeMoneyFlowInsights` | "EMI burden is {pct}% of income." | `emiRatio` (> 40% flag) | warning > 40% | `cashflow.highEmiBurden` | Migrated (deferred wiring) |
| `moneyFlowLedgerLogic.computeMoneyFlowInsights` | "Savings rate is {pct}%." / "Free cash flow is {amount}/month." | savings rate / free cash | neutral | — | Deferred |

## Investments

| Source | Original text | Driving metric | Severity/tone | Registry id | Status |
|---|---|---|---|---|---|
| `investSurplusLogic.computeInvestSurplusInsights` | "You have {amount}/month ready to deploy after savings." | `hero.monthlyFreeCash` | tone positive | `investments.readyToDeploy` | Migrated + wired |
| `investSurplusLogic.computeInvestSurplusInsights` | "~{amount} unallocated surplus projected through year-end." | `hero.proratedUnallocated` | tone neutral | `investments.yearEndSurplus` | Migrated + wired |
| `investSurplusLogic.computeInvestSurplusInsights` | "{n} investment allocation(s) already planned ({amount}/month committed)." | `allocationsSummary` | tone accent | `investments.existingAllocations` | Migrated + wired |
| `investSurplusLogic.computeInvestSurplusInsights` | "No investment allocations planned yet — use suggestions below or open the full allocation planner." | `allocationsSummary.count === 0` | tone accent | `investments.noAllocations` | Migrated + wired |
| `investSurplusLogic.computeInvestSurplusInsights` | "{n} years to retirement — consistent deployment now compounds over your full horizon." | `yearsToRetirement` | tone neutral | `investments.retirementHorizon` | Migrated + wired |
| `investSurplusLogic` suggestion / `MoneyStory` SIP card | "Direct {amount}/month into disciplined investments." | wealth SIP FV @12% | tone primary | `investments.wealthSip` | Migrated (deferred wiring) |
| `ExecutiveSummaryLogic` action priorities | "Increase monthly SIPs and disciplined investments to improve wealth conversion." | weak `wealth-building` pillar | priority card | `investments.increaseSips` | Migrated + wired |
| `allocationEngine` reason strings / `buildStudioInsights` | AI-bundle + slider insight copy | allocation engine | mixed | — | Deferred |

## Retirement

| Source | Original text | Driving metric | Severity/tone | Registry id | Status |
|---|---|---|---|---|---|
| `putYourMoneyToWorkLogic` SIP analysis | Retirement corpus shortfall narrative | `retirementCorpus` vs target | warning | `retirement.shortfall` | Migrated (deferred wiring) |

## Goals

| Source | Original text | Driving metric | Severity/tone | Registry id | Status |
|---|---|---|---|---|---|
| `ExecutiveSummaryLogic` action priorities | "Review each goal plan and increase funding pace for underprepared goals." | weak `goal-readiness` pillar | priority card | `goals.increaseFundingPace` | Migrated + wired |
| `FutureSelfLogic.buildGoalReadiness` (gapMessage) | "Based on current projections, there may be a gap between the resources available and the estimated future cost of this goal." | `goalReadiness.gap` | verdict amber | `goals.fundingGap` | Migrated (deferred wiring) |
| `FutureSelfLogic.buildGoalReadiness` (comfortableMessage) | "…this goal is comfortably achievable…" | `isAchievable` | verdict green | — | Deferred |

## Tax

| Source | Original text | Driving metric | Severity/tone | Registry id | Status |
|---|---|---|---|---|---|
| (new canonical) `YourMoneyFlow` tax context | "Explore tax-efficient investments to reduce your annual tax outgo." | `computedTax` | low | `tax.planningOpportunity` | Migrated (deferred wiring) |

## Wealth

| Source | Original text | Driving metric | Severity/tone | Registry id | Status |
|---|---|---|---|---|---|
| `MoneyStorySection.jsx` asset-mix callout | "…{legacyPct}% of your wealth consists of Legacy Assets… aim to increase income-generating assets." | `legacyPercent` | AlertTriangle amber | `wealth.assetDiversification` | Migrated (deferred wiring) |
| `AssetLogic.calculateNetWorth` derived copy | net-worth summaries | `netWorth` | neutral | — | Deferred |

## Behaviour

| Source | Original text | Driving metric | Severity/tone | Registry id | Status |
|---|---|---|---|---|---|
| `investSurplusLogic.computeInvestSurplusInsights` | "Complete Your Money Flow to see surplus deployment options." | `!meta.hasData` | tone warning | `behaviour.completeMoneyFlow` | Migrated + wired |
| Various report empty states | "Add Your Goals First", "Complete Your Cash Flow First", etc. | missing data | empty-state | — | Deferred |

---

## Coverage summary

- **Pilot reports fully migrated + wired**: The Safety Net (`safety_net`), the
  Invest-Surplus Deployment Insights (`invest_surplus`) and the Executive Summary
  "Your Priority Next Steps" (`useful_insights`).
- **Centralized (deferred wiring)**: Invest-Surplus suggestions, Money Story SIP /
  protection / contingency cards, Future Self goal verdict, Your Money Flow EMI
  burden, retirement shortfall, tax planning, asset diversification.
- **Deferred**: Life Journey insights, crisis-timeline copy, allocation-studio /
  allocation-engine narratives, executive-summary roadmap & uplift copy, various
  empty states. These retain their existing generators; migrating them is a
  mechanical follow-up that does not change the architecture.
