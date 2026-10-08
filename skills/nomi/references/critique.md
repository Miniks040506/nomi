# Critique protocol

Use after building in the Build and Create tiers, and whenever asked to review, polish or improve something. Tweaks skip it.

## 1. Collect evidence before judging
- Render the result and capture it: a page at about 390 px and about 1440 px wide; for motion, several frames across the animation; for a scene or game, the main view while in use. Open every image you capture.
- If you cannot render or capture, the evidence is the code. Cite file:line and put "not visually verified" in the verdict.
- Evidence is only what you gathered in this session. What you meant to build is not evidence.

## 2. Check, in this order
1. Function and access: text readable on its background, layout intact at narrow widths, controls reachable by keyboard and large enough to tap, reduced motion respected, input answered at once.
2. Never: every item in the DNA's Never list, one by one.
3. Intent: would the person described in Intent feel or do what it says, looking at this?
4. Default audit: list what here would appear in any similar project (typeface, palette, layout, copy phrases, motion, lighting). For each, cite the DNA line or brief that chose it, or mark it as fallen into.
5. System: count what should be few (type sizes, colours, radii, durations) and flag values that are not in the DNA.

## 3. Write the critique
```
Verdict: SHIP | FIX | RETHINK
1. [S1|S2|S3] problem — evidence: <image and region | value | file:line> — fix — verify by
Keep: up to 3 things that work and must survive refinement
Not verified: what the evidence could not show
```
- S1 breaks function, access or intent, or violates Never. S2 weakens identity or coherence: an unexamined default, a value off the DNA, motion without a job. S3 is polish.
- At most 5 issues, ranked. Fewer is fine; never invent issues to fill the list.
- No evidence, no issue: write "insufficient evidence" instead of guessing.
- A choice the brief or the DNA asked for is not a defect.
- RETHINK means the direction itself does not serve the intent: go back to `references/direction.md`.

## 4. Independent critic (Create tier)
Your own critique tends to defend your own choices, so Create work also gets one from a fresh context:
1. Write the brief: `node <skill-dir>/scripts/nomi.mjs critique pack --task "<what was made, for whom>" --evidence <image> --out .nomi/runs/critique.md`. Without Node, fill `assets/critic-brief.md` by hand.
2. If your environment can start a subagent, give it only: "Read <brief path> and follow it." Add none of your reasoning or intentions.
3. Otherwise run this protocol again as a separate pass: re-read the brief, open the images, judge only what they show.
Check each issue the critic raises against the evidence before acting on it.

## 5. Refine
- Fix S1 first, then S2, in rank order. Never remove an item from Keep.
- After each round, capture and open fresh evidence, then re-check the issues you fixed.
- Rounds: at most 2 for Build, 3 for Create. RETHINK counts as a round.
- Stop when no S1 or S2 remains or the budget is spent. Report what remains and why.
- Record any decision that changed the direction in the DNA's Decisions.
