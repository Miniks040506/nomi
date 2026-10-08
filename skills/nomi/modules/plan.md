# Plan

The plan stage of Nomi: understand the product before designing it. It ends at `.nomi/plan.md`, a file that scripts test. `<skill-dir>` is the folder containing `SKILL.md`. It runs for a new product, app or site and for a redesign. A Tweak, or a Build inside an existing plan, skips it.

## Inputs
Read these in order. A later one never overrides an earlier one.
1. The request's own words: what it asks for, what it names, what it rules out.
2. What exists: code and pages, `.nomi/dna.md`, brand or product documents. For a redesign, capture the current product first and run its main job as a flow before proposing anything: what works today is a requirement.
3. Who uses it, and in what situation: standing at a counter, on a phone outdoors, at a desk all day, once a year.
4. Quiet constraints that override taste: handles money or personal data, regulated, accessibility-first, used by children, used under stress.

Missing input is not a reason to stop: put the assumption in the Read line.

## Steps
1. Write the read as the first line of your reply: `Reading this as: <product type> for <who, and when>, whose job here is <the task>, constrained by <limits>.`
2. Create the plan with the type that fits, or `other`:
```
node <skill-dir>/scripts/nomi.mjs plan init --type <pos|booking|admin|dashboard|storefront|content|onboarding|chat|docs|landing|other>
```
   It prints the jobs a product of that type cannot ship without and what its reviewer asks. Without Node, copy `assets/plan.md` to `.nomi/plan.md`.
3. Fill `.nomi/plan.md`:
   - Read: the line from step 1.
   - Flows: the 1–7 jobs, each as steps that end in the state on screen that proves the job is done. Include one flow for what goes wrong: wrong input, nothing found, an empty list.
   - Screens: one line each, with the states the screen has (empty, loading, error, done).
   - Done: what must be true to ship, one checkable line each.
4. Decide now every label, button text and message a flow names. The build uses exactly these words: a flow that cannot find its control fails.
5. Run `node <skill-dir>/scripts/nomi.mjs plan check` and fix every finding. For each job of the type it reports as not covered, add the flow or write the reason under Done. After building, `review <url-or-index.html>` runs these flows.

## Outputs
- `.nomi/plan.md` that passes `plan check`, written before the first interface file.
- The Read line in your reply. When the request could mean two different products, name the other read there and again in the final report, so the user can redirect.

## Stop
- Done when `plan check` prints ok. Design comes next: the direction must give each flow its screen states and say which of the type's questions it answers.
- Ask the user at most one question, and only when two reads would produce different products and nothing in Inputs decides between them. Otherwise state the read and proceed.
- One pass. Return here only when a review ends in RETHINK because a flow was the wrong job: change the plan first, then the build.
