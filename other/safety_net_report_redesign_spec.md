# Safety Net Report — Redesign Spec
For direct implementation. Each step: what's wrong, exact fix, copy (if changed), and visual spec (if changed).

---

## PRE-STEP — Confirmed non-issues (no action needed)
- **Health donut 34% vs 100%**: false alarm — screenshot was captured mid count-up
  animation. Not a data bug. Action: none, but see Step 9 for an export/testing note.
- **Crisis Stage 3 "0 months"**: this is real, data-driven — Radha's cover is
  genuinely ₹0, so life-insurance-funded runway is genuinely 0. Not a bug. The
  *framing* of this is addressed in Step 6, but the number itself is correct.

---

## STEP 1 — Fix unresolved template placeholders (Critical, do first)
**Problem:** "Why this matters" sub-headings in Recovery Plan render literally as
`Fill {selfName}'s Protection Gap` and `Fill {spouseName}'s Protection Gap`.
**Fix:** Locate the template string(s) feeding the collapsed detail heading in the
Recovery Plan card component and confirm it interpolates the same `selfName`/
`spouseName` variables already correctly used in the main card title above it
("Fill Krishna Vallabh's Protection Gap" renders fine — the bug is isolated to
the nested/collapsed sub-heading, likely a separate template string that wasn't
updated at the same time).
**No visual change** — text-binding fix only.

---

## STEP 2 — Wire self/spouse cards to the corrected per-person logic (Critical)
**Problem:** Self "Need (HLV)" = ₹2,44,92,400, Spouse "Need (HLV)" = ₹2,44,92,400.
Identical. Both equal `monthly expenses (₹1,22,462) × 200` — this is the legacy
flat multiplier, not `calculateIndividualGap()`'s output. The new engine should
produce two different numbers (income-shortfall + liabilities + goals, capped
by insurability) for Krishna vs Radha.
**Fix:** In the component populating these cards (likely `ProtectionGapOutput.jsx`
or `ReportView.jsx`), confirm it's reading `self.idealCover` / `self.need` and
`spouse.idealCover` / `spouse.need` from `calculateProtectionGap()`'s return
object — not a shared `protectionNeed` or `monthlyExpenditure * 200` field.
**Copy change:** Rename the card label from **"Need (HLV)"** to **"Protection
Need"**. Add a small (?) info icon next to it with tooltip text: *"Based on
income replacement, outstanding loans, and future goals for this person,
capped at what insurers will typically approve based on their income."*
Reserve "HLV"/"Human Life Value" as a spelled-out term only if you need it
elsewhere — don't lead with the acronym for a non-financial audience.

---

## STEP 3 — Add a need breakdown to each person's card
**Problem:** The number is currently opaque — user has no way to see *why*
₹1.70 Cr (self) vs whatever Radha's corrected number becomes.
**Fix (visual):** Under each Self/Spouse Protection card, add a compact
horizontal **stacked bar** (not a full chart, just a slim breakdown bar, ~24px
tall) with 3–4 segments:
```
[ Income Replacement ][ Loan Payoff ][ Future Goals ]   – Existing Cover (shown as a notch/marker)
```
- Each segment sized proportionally to its ₹ contribution to the total need.
- Existing cover shown as a vertical marker line or lighter overlay on top of
  the bar (not a separate segment) — visually communicates "this much of the
  bar is already funded."
- Hover/tap on a segment shows the ₹ amount and one-line label (e.g.
  "Income Replacement: ₹1.1 Cr — covers your family's living costs if Radha's
  income stops").
- If `isCapped` is true for that person, add a small warning chip on the card:
  **"⚠ Capped by income eligibility — actual need is ₹X, but insurers typically
  approve up to ₹Y based on declared income."**

---

## STEP 4 — Rework the "0% Covered" headline framing
**Problem:** Large red 0% with the "based on weakest-covered member" caveat
in small gray text below it reads as alarmist/misleading at a glance.
**Fix (visual):** Keep the donut, but:
- Move "Based on Radha's cover" to sit *directly under* the percentage, same
  font weight as "COVERED," not as separate small caption text.
- Add Radha's name/avatar as a small inline badge next to the percentage so
  it's immediately clear which household member is driving the number —
  e.g. `0% COVERED — driven by Radha's ₹0 cover`.

---

## STEP 5 — Trim repetition of the same rupee figures
**Problem:** ₹2,44,92,400 / ₹1,69,92,400 / ₹2,44,92,400 currently appear
across: donut caption → 3 metric cards → 2 protection cards → blue info
banner (twice) → duration caption → Recovery Plan title → Recovery Plan CTA
sentence → Recovery Plan detail box. 8+ repetitions of essentially 2 numbers.
**Fix:**
- **Blue info banner**: remove the restated ₹ figures entirely. Keep it as
  pure explanatory text: *"Life insurance pays the household only when the
  insured member dies. Cover on you doesn't help if your spouse dies, and
  vice versa."* Drop the "If Radha passed away tomorrow..." sentence here —
  it's now redundant with Step 7's duration chart, which shows this visually.
- **Recovery Plan cards**: keep the ₹ figure in exactly one place — the
  standalone "Self/Spouse Protection Gap" stat block. Remove it from the card
  title and the CTA sentence; those should describe the *action*, not restate
  the number (e.g. "Buy term cover to close this gap" instead of "Buy term
  cover of ₹1.70 Cr on Krishna Vallabh").

---

## STEP 6 — Reframe the Coverage Duration Timeline as a two-person comparison
**Problem:** Currently shows a single bar for Radha only ("0 yrs"), which
looks broken/empty and wastes the chance to show the actual insight the new
per-person logic makes possible.
**Fix (visual):** Replace the single bar with a **dual horizontal bar chart**,
one row per earning member:
```
Krishna  ████████░░░░░░░░░░  X yrs   (based on ₹75L existing cover)
Radha    ░░░░░░░░░░░░░░░░░░  0 yrs   (based on ₹0 existing cover)
```
- X-axis: 0–10 years, same scale as current.
- Each bar labeled with the person's name and computed runway.
- Caption below: *"This shows how long your family's expenses would be
  supported by each person's current life cover alone, if that person
  passed away today."* — this replaces the need for the earlier "if Radha
  passed away..." sentence in the blue banner (Step 5).

---

## STEP 7 — Crisis Scenario: clarify whose death the scenario models
**Problem:** The 4-stage crisis narrative is strong, but it isn't currently
labeled as being about a specific scenario (it's implicitly the weakest-link
case, i.e., Radha). A non-financial user may read it as "our family's general
risk" rather than "what happens specifically if Radha's income and ₹0 cover
scenario plays out."
**Fix (copy only):** Add a one-line subhead above the timeline:
*"Scenario shown: if Radha's income stops and no life cover payout occurs."*
Optionally (if UI complexity allows), add a toggle: **[Krishna's scenario] /
[Radha's scenario]** so the user can see both individually rather than only
the worse case — this becomes much more useful once Step 2 is fixed and the
two scenarios genuinely differ.

---

## STEP 8 — Health Protection section
**No structural changes needed** — data is correct once animation completes,
cards are not redundant, framing is clear. Leave as-is.

---

## STEP 9 — QA / export note
Any screenshot, PDF export, or automated report-generation flow must wait for
the count-up animations (donuts, bars) to fully resolve before capturing —
otherwise exports will show mid-animation values (like the 34% seen here),
which look like data bugs even when they aren't. Add a "render complete"
event/flag the export function waits on.

---

## Priority order for implementation
1. Step 1 — placeholder bug (trivial fix, highest visible damage)
2. Step 2 — wire self/spouse to corrected logic (core correctness issue)
3. Step 9 — export/animation-complete flag (cheap, prevents future false bug reports)
4. Step 5 — trim repetition (copy-only, no logic dependency)
5. Step 4, Step 6, Step 7 — framing/visual upgrades (depend on Step 2 being live
   to be meaningful — Step 6 and 7 especially only pay off once self/spouse
   numbers actually differ)
6. Step 3 — breakdown bar (highest design effort, do last once numbers are stable)
