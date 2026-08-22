# Safety Net Report — Full Redesign Spec v2
Supersedes the previous spec. Covers every section. Format per step: **KEEP / REMOVE / CHANGE**.

---

## PART A — Issues found in the new screenshot (fix before anything else)

1. **Name placeholder bug is still live, not fixed.** It now renders as
   `Fill (selfName)'s Protection Gap` / `Fill (spouseName)'s Protection Gap`
   in Recovery Plan — parentheses instead of curly braces, but it's the same
   unresolved-variable bug from before. This needs to actually be traced and
   fixed, not just reformatted.

2. **Self and Spouse numbers are identical again.** Both cards show "Ideal
   cover was ₹4,05,22,339" and both are "capped to ₹3,00,00,000" — same
   figures for Krishna and Radha. Given their very different incomes, their
   income-eligibility caps in particular should not match. This strongly
   suggests the per-person wiring (Step 2 from the last spec) is still not
   fully using individual income/age inputs — worth re-verifying
   `calculateIndividualGap()` is actually being called twice with the correct
   distinct `annualIncome`/`age` per person, not once with a shared value.

3. **New bug from the toggle:** the sentence under the toggle button reads
   *"If &nbsp; is not with the family tomorrow..."* — the name is blank. The
   toggle button itself shows "Radha" correctly, but the paragraph text below
   it isn't picking up the same selected name.

Fix all three before polishing anything cosmetic below — cosmetic changes on
top of wrong/broken data will need to be redone.

---

## PART B — Section-by-section spec

### 1. Header / Intro
- **KEEP:** Title, badge label ("The Safety Net").
- **CHANGE:** Trim the intro paragraph from 3 sentences to 2. Cut the middle
  sentence ("Right now, your protection and emergency reserves need
  attention") — it's restated by every section header below it anyway.

### 2. Long-Term Security — Protection
- **KEEP:** Donut with inline "Based on [Radha's Cover]" badge — good fix, matches spec.
- **KEEP:** 3 metric cards (Coverage Required / Cover / Total Term to Buy).
- **KEEP:** Gross Need Breakdown bar per card — this is the right addition, don't remove it.
- **CHANGE:** "Cap Applied" box — currently a 2-line explanatory sentence per
  card. Shorten to one fixed template used identically both times:
  *"Capped at ₹X by income eligibility (need: ₹Y)."* No more, no tooltip needed.
- **REMOVE:** The "Buy term cover on [Name] — only this cover pays if they are
  not with us" sentence at the bottom of each card. It's now redundant with
  both the Cap Applied box above it and the Coverage Duration chart below.
  Keep the CTA action inside Recovery Plan only, not duplicated here.
- **CHANGE:** Blue info banner — cut to one sentence:
  *"Life cover only pays out for the person named on the policy — cover on
  one spouse doesn't help if the other is the one who dies."* Remove the
  second paragraph ("If Radha is not with us tomorrow...") entirely — the
  Coverage Duration Timeline chart directly below already shows this.

### 3. Coverage Duration Timeline
- **KEEP:** Dual bar (Krishna vs Radha) — correct fix from last spec.
- **CHANGE:** Bar value labels are hard to read at current size/contrast in
  the screenshot — increase label font weight/size so "X.X yrs" is legible
  without zooming.

### 4. Short-Term Survival — Contingency
- **KEEP:** Headline stat ("1.6 MONTHS"), the 3 metric cards (Needed /
  Available / Gap), and the segmented 6-month runway bar. This trio is the
  right amount of information — don't add more here.
- **REMOVE:** The small formula box ("Runway = emergency fund ÷ monthly
  expenses + EMIs"). Move it behind a (?) tooltip on the headline stat instead
  of a permanently visible box — most readers don't need to see the formula,
  only the number.
- **CHANGE:** Shorten the paragraph under the headline stat to one sentence:
  *"Your ₹2,00,000 in reserves covers about 49 days — beyond that you may
  need to dip into savings."* Drop the restated ₹1,22,462 monthly-expense
  figure here since it's already shown in the metric cards directly below.

### 5. Crisis Scenario — What If
- **FIX BUG:** Blank name in the scenario sentence (Part A, item 3).
- **CHANGE:** Convert the single toggle button into a proper two-option
  segmented control showing both names as selectable pills — e.g.
  `[ Krishna ]  [ Radha ]` — so it's visually obvious the scenario is
  switchable and the user can check both, not just Radha's.
- **KEEP:** The 4-stage colored timeline — this is already lean, don't add text to it.
- **CONSIDER:** "is not with the family" / "is not with us" is a softened
  phrasing choice not in the original spec. Worth a second look — in a
  report about real financial risk, plain language ("passes away") is
  usually clearer for a non-financial reader than a euphemism, which can
  read as vague about what's actually being modeled. Your call on tone, but
  flagging it as a deliberate choice to confirm, not an oversight.

### 6. Health Protection — Medical Security
- **KEEP:** Donut (100% Covered) — clearest single visual, keep as the anchor.
- **KEEP:** 3 metric cards (Recommended / Have / Gap).
- **REMOVE:** The "Health Cover vs Recommended Minimum" horizontal bar chart
  entirely. It shows the exact same ₹10L vs ₹10L already conveyed by the
  donut and the two cards above it — pure repetition, no new information.
- **CHANGE:** Blue paragraph — cut to one line, drop the restated ₹10,00,000:
  *"You're fully covered for now — review every few years as medical costs rise."*
- **REMOVE:** The standalone caption below the (now-removed) bar chart
  ("Include personal policies, family floater plans..."). Fold this into a
  (?) tooltip on the "Cover You Have" card instead of a persistent visible line.

### 7. Recovery Plan — Next Steps
- **FIX BUG:** Name placeholders (Part A, item 1) — highest priority in this section.
- **CHANGE:** Card descriptions currently restate the ₹ gap figure in full
  sentences. Shorten to a plain action line with no number, e.g. *"Buy term
  cover to close this gap."* — the exact ₹ amount already lives in the
  collapsed "why this matters" stat box; no need to say it twice.
- **KEEP:** The collapsible "why this matters" disclosure pattern — this is
  the right way to hide detail by default, and it's the one section already
  doing text-reduction correctly. Worth reusing this same collapse pattern
  for the Contingency formula box (Step 4) and the Health Cover caption (Step 6).
- **CHANGE:** Two CTA buttons per card ("Update Insurance Details" + "Contact
  Finbrella for Help") × 3 cards = 6 buttons total, which is a lot of
  repeated action prompts at the end of a long report. Keep one primary CTA
  per card ("Update Insurance Details"), and move "Contact Finbrella for
  Help" to a single combined line at the bottom of the whole Recovery Plan
  section instead of repeating it on every card.

---

## PART C — Global text-reduction rules (apply across all sections)

1. **A number appears once as a headline/card stat and is never restated in
   a full sentence elsewhere in the same section.** Reference it implicitly
   ("this gap," "the shortfall") instead of reprinting the rupee figure.
2. **Formulas and methodology notes live behind a (?) tooltip or a collapsed
   disclosure — never as a permanently visible box.** (Contingency formula,
   Cap Applied reasoning, Health Cover asset-inclusion note.)
3. **Card/paragraph descriptions are capped at one sentence.** Anything
   longer goes behind the same "why this matters" expandable pattern already
   used well in Recovery Plan.
4. **Repeated boilerplate sentences use one fixed template, not re-worded
   each time** — e.g. the "Cap Applied" explanation should read identically
   for both people, just with different numbers substituted in.

---

## Priority order

1. Part A, items 1–3 — real bugs, fix first (name binding, per-person data wiring, toggle sync)
2. Section 7 (Recovery Plan) button/copy trim — quick win, most visible "wall of text" offender
3. Section 6 (Health) — remove the redundant bar chart, biggest single repetition cut
4. Section 4 (Contingency) — move formula behind tooltip
5. Section 2/3 (Protection + Duration) — copy trims and label legibility
6. Section 5 (Crisis Scenario) — toggle UI upgrade, tone decision on "is not with us"
