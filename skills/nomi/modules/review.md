# Review

The review stage of Nomi: one verdict, from what was measured. `<skill-dir>` is the folder containing `SKILL.md`. It ends Build and Create work, and runs alone when asked to review an interface.

## Inputs
- The latest runs in `.nomi/runs/`: web (`observe`), motion (`observe --motion`) when motion changed, flow (`observe --flow`) when the page lets a person do something. A missing run is captured now, not assumed.
- `.nomi/plan.md` when it exists: its flows and its Done lines. `.nomi/dna.md`: Never and the direction.
- Output of other review or accessibility tools for this task, as evidence.
- Reviewing existing work that has no flows: write its main jobs as flows in `.nomi/flows.json` (the format in `assets/plan.md`) before step 1.

## Steps
1. Run from the project folder:
```
node <skill-dir>/scripts/nomi.mjs review <url-or-index.html>
```
   It captures the page, runs the flows of `.nomi/plan.md` or `.nomi/flows.json`, and lists what blocks SHIP: a failed flow, a dead click, an S1 finding, a planned flow that was not run, a page with form controls and no flow, a run older than the files. It writes the proof card. Without a target it reviews the runs that exist. Motion is not captured for you: run `observe --motion` first when motion changed.
2. Open the sheet of every failed flow and the image of every blocking finding. For each, find where the fix goes: file:line.
3. Check each issue before reporting it. It must be in a run of this session (a finding code, a value, a sheet step) or at a file:line. Drop an issue you cannot reproduce; do not soften it.
4. Rule out false positives before calling something a defect:
   - a choice the brief, the DNA or the plan asks for: a confirmation before deleting, a button disabled until the form is valid, uppercase labels;
   - a fingerprint (it is a question) and clipped optical bleed of a few pixels;
   - a flow that fails because its own step is wrong (a label that changed, text the plan never promised): correct the flow and say so;
   - a dead click on a control whose effect a flow cannot see (canvas, sound, clipboard).
5. Go through the plan's Done lines and the product type's questions (`plan check` prints them): each is answered by evidence, or it is not.
6. Fix in this order: failed flows, dead clicks, other S1, then S2. Then run `review <url-or-index.html>` again, and compare with the run before the change: `diff <before-id> <after-id>`.
7. End your reply with this block:
```
Verdict: SHIP | FIX | RETHINK
1. [S1|S2|S3] problem — evidence: <run id and sheet step | finding code = value | image and region> — fix at <file:line> — verify by <command>
Flows: <n> of <m> completed (run <id>)
Keep: up to 3 things that work and must survive
Not verified: the list from the review output, plus anything you did not open
Proof: .nomi/proof.md
```

## Outputs
- `.nomi/proof.md` and `.nomi/proof.png`, written by the last `review` run: flow results, the interface before and after, motion, what was not verified. Open `proof.png`.
- The verdict block. SHIP only when the last `review` printed no blocker and you opened the images. A blocker you showed to be a false positive is named with its reason; a failed flow is never one of those: fix the product or correct the flow, and run it again.
- FIX when something measured still blocks, with the remaining issues ranked.
- RETHINK when the flows pass but the product read was wrong, or the direction does not serve the Intent: go back to `modules/plan.md` or `references/direction.md`.

## Stop
- Stop when `review` prints no blocker and no confirmed S2 remains, or when the round budget is spent: 2 rounds for Build, 3 for Create; a RETHINK counts as one. Report what remains and why.
- Never end on a run older than your last edit: `review` reports it as a blocker.
