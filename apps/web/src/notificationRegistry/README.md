# Notification Registry

Declarative source of truth for Finbrella **coach-style** push notifications.

Marketing campaigns do **not** belong here.

## Architecture

```
Notification Registry (metadata: event + templates + deepLink + frequency + version)
         |
Trigger evaluators (signals → boolean)     ← no finance recalculation
         |
Frequency rules + global policy (quiet hours IST, daily/weekly caps)
         |
Resolver → title/body + deep link + FCM payload (+ variant id)
         |
Delivery channel (push today; email / WhatsApp / in-app later)
```

Business logic stays out of templates. Templates stay out of evaluators.

## Phase 1 notifications

| Id | Event | Deep link | Frequency |
|----|-------|-----------|-----------|
| `coach.wealthMapUpdated` | `WEALTHMAP_RECALCULATED` | Financial Workspace | 24h cooldown |
| `coach.protectionGapAttention` | `PROTECTION_GAP_UNRESOLVED` | Protection Gap report | 30d (reset on gap fingerprint change) |
| `coach.surplusAvailable` | `SURPLUS_INVESTABLE` | Put Your Money To Work | 1× / calendar month |
| `coach.goalFallingBehind` | `GOAL_BEHIND_SCHEDULE` | Goals | 14d per `goalId` |
| `coach.monthlyWealthSummary` | `MONTHLY_WEALTH_SUMMARY_READY` | Monthly Summary (`your_money_flow`) | 1× / calendar month |

## Product policy

- Quiet hours: **22:00–07:00 IST** → `planDelivery` returns `queue` with `deliverAt`
- Rate limits: **2 / day**, **10 / week** (weekend/campaign overrides reserved on `DEFAULT_PUSH_POLICY.rateLimits`)

## Versioning & A/B

- Every definition has `version` (bump on copy changes; keep `id` stable)
- `variants[]` holds A/B message options; `selectVariant` picks by `variantId` (experimentation engine later)

## Analytics

Lifecycle events (also on `AnalyticsEventName`):

- `notification_generated`
- `notification_sent`
- `notification_delivered`
- `notification_opened`
- `notification_deep_link_opened`

Use `trackNotificationLifecycle` / helpers with each entry’s `analyticsKey`.

## Usage

```js
import {
  resolveNotification,
  resolveApplicableNotifications,
  trackNotificationGenerated,
} from '@/notificationRegistry';

const result = resolveNotification(
  'coach.surplusAvailable',
  { hasInvestableSurplus: true, monthlySurplusAmount: 12000, amount: '12,000' },
  { optedIn: true, history: [], globalSendHistory: [] },
);

if (result.applicable && result.delivery.action === 'send_now') {
  trackNotificationGenerated({
    analyticsKey: result.rendered.analyticsKey,
    notificationId: result.rendered.notificationId,
    version: result.rendered.version,
    variantId: result.rendered.variantId,
  });
  // hand result.push to the send-push-notification edge function (Phase 2 wiring)
}
```

## Signals contract (adapters supply these)

| Signal | Used by |
|--------|---------|
| `wealthMapRecalculated`, `recalculationSucceeded` | WealthMap Updated |
| `hasProtectionGap`, `protectionGapResolved`, `protectionGapFingerprint` | Protection Gap |
| `hasInvestableSurplus`, `monthlySurplusAmount`, `amount` / `monthlySurplusDisplay` | Surplus |
| `hasGoalBehindSchedule`, `goalId` | Goal Falling Behind |
| `monthlyWealthSummaryReady` | Monthly Wealth Summary |

Wire product moments → signals → `resolveNotification` in a later delivery phase; this package is the framework + Phase 1 catalog.

## Wired triggers

| Notification | When it fires |
|---|---|
| `coach.wealthMapUpdated` | After successful Smart Edit save (persist + recalculate) |
| `coach.protectionGapAttention` | Same path — if protection gap unresolved |
| `coach.surplusAvailable` | Same path — if investable surplus > 0 |
| `coach.goalFallingBehind` | Same path — one send per behind goal |
| `coach.monthlyWealthSummary` | When summary is first marked ready, and on workspace load (≤1× / month) |

Dispatch order after Smart Edit: WealthMap → Protection → Surplus → Goals. Global rate limits (2/day, 10/week) and quiet hours still apply.
