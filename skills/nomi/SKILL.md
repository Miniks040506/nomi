---
name: nomi
description: "Use for any web page, app screen or UI work, including small edits to an existing page: adding or changing sections, cards, forms, lists, layout, styling, animation or on-page copy; mobile, accessibility and readability fixes; designing, redesigning, polishing or reviewing an interface; setting a project's design direction. Checks the rendered result in a real browser and follows .nomi/dna.md."
compatibility: Optional Node.js 22+ and a Chromium-family browser for rendered checks. Without them the process still applies and results are marked not visually verified.
metadata:
  version: "0.1.0"
---
# Nomi

Delivers interface work the way a product team would: plan, design, build, run and measure, review, fix, record. `<skill-dir>` is the folder containing this file. If the task changes nothing a person sees or reads, stop here.

**Every task, in order:**
1. Read the nearest `.nomi/dna.md` (walk up from the project folder) before editing, and what its `sources` point to. Its Never list and Decisions bind; the brief's explicit wishes override them and everything in this skill. No DNA: the existing product is the direction; read its styles and pages before adding to them.
2. State the tier in one line (table below).
3. Open `<skill-dir>/modules/web.md` now, before changing anything: it says what to decide for a page, which capture options to use and what to judge. When the task adds or changes animation, transitions or hover and press states, open `<skill-dir>/modules/motion.md` as well.
4. Create tier: open `<skill-dir>/modules/plan.md` and write `.nomi/plan.md` before any interface file. It makes you read the product first: what kind it is, who uses it, the jobs it must do.
5. Measure with these two commands, run from the project folder, and open the images they print:
```
node <skill-dir>/scripts/nomi.mjs observe <url-or-index.html>
node <skill-dir>/scripts/nomi.mjs review <url-or-index.html>
```
   `observe` captures a page: run it before you change an existing page, and again after a Tweak. `review` ends every Build and Create task: after your last edit it captures the page again, runs its flows, lists what blocks SHIP and writes the proof card. When the task adds or changes animation, transitions or hover and press states, also run `observe` with `--motion` and open `load.png`.
6. Build and Create, when the page lets a person do something (a form, a button, a step, navigation): write its jobs as flows, one per job the page already does and one per job you add. With a plan they are in `.nomi/plan.md`; otherwise write `.nomi/flows.json`:
```
[{"name": "Book a slot", "steps": [{"do": "type", "name": "Your name", "text": "Ada"}, {"do": "click", "name": "Book"}, {"do": "expect", "text": "Booking confirmed"}]}]
```
   Find a control by `name` (its visible label or button text) or `target` (a CSS selector). Steps: click, type, select, press-key, hover, focus, scroll, wait, expect (`text` | a control with `state` | `url`). Every flow ends with an expect.
7. Build and Create: open the images and flow sheets the review printed. A flow that fails is a defect of this task, also when it failed before your change. Critique what you opened with `references/critique.md` plus the module's lenses (at most 5 ranked issues, each tied to evidence), fix what blocks first, and run the review again, within the tier's rounds. `<skill-dir>/modules/review.md` has the false positives to rule out and the fix order.
   End your reply with this block. It is written from the last review run: if the review has not run after your last edit, run it now instead of writing FIX. Never write SHIP while it lists a blocker.
```
Verdict: SHIP | FIX | RETHINK
1. [S1|S2|S3] problem — evidence: <run id and sheet step | finding = value | image and region> — fix at <file:line>
Flows: <n> of <m> completed (run <id>)
Not verified: <from the review output>
Proof: .nomi/proof.md
```
8. Append new decisions to the DNA's Decisions section: date · domain · decision, and why.

## Tiers

| Tier | When | Do |
|---|---|---|
| Tweak | Small change inside an existing direction: copy, one colour, spacing, a value, a visual bug | Respect the DNA (above all Never), make the change, capture the result. No plan, no direction note, no flows, no critique, no review. |
| Build | New component, page, section or content inside a direction | Direction note, build, capture, flows for the jobs it touches, critique, review verdict, at most 2 fix rounds, record decisions |
| Create | New product, app or site; redesign; "make it distinctive"; or no DNA and this work defines the look | Plan, then `references/direction.md` and `.nomi/dna.md` from `assets/dna.md`, build, capture, flows, independent critique, review verdict with its proof card, at most 3 rounds, record |

Build tier: write this note in your reply before any code.
```
Direction — <surface>
Intent:    who it is for; what they should feel or do
Avoiding:  the default this would otherwise become
Signature: the one memorable move
Choices:   concrete values (typefaces, hex colours, sizes, timings, layout rules)
Jobs:      what a person does here, and what the screen shows when it is empty, wrong and done
```
Build inside the project's own stack: use what it already depends on, and add or swap a library only when the brief asks.

## Modules

The steps above open these. A domain module holds what to decide, the capture options, the critique lenses and the moves; a stage module holds its inputs, steps, outputs and stop rule.
- `modules/plan.md`: Create tier, before any design. First command: `plan init --type <id>`.
- `modules/web.md`: any page, screen or component. First command: `observe <url-or-index.html>`.
- `modules/motion.md`: the task adds or changes animation, transitions, or hover, focus and press states. First command: `observe <target> --motion`.
- `modules/review.md`: the end of Build and Create work, and any request to review an interface. First command: `review`.
- Work with no module (3D scenes, native apps): apply the steps above, render and open evidence if you can, otherwise say "not visually verified".

## Asked for by name

- "nomi" with a task: work out which modules the task needs and run the steps above.
- One part by name ("nomi-plan", "nomi-web", "nomi-motion", "nomi-review", "nomi web …"): open that part's file under `modules/` and do that part alone, to the same standard. The DNA, the capture and the honesty rules still apply.
- A part with no file in `modules/` (readme, brandvid, mobile, 3d) is not in this version: say so in one line, then do the task with the steps above.

## Scripts

`node <skill-dir>/scripts/nomi.mjs <command>`, run from the project folder (runs are saved in its `.nomi/runs/`):
`observe <url-or-file> [--motion | --flow <file>]`, `diff <before-id> <after-id>`, `review <url-or-file>`, `plan init --type <id>`, `plan check`, `dna init`, `dna check`, `dna show --for <domain>`, `critique pack --task "…" --run <id>`, `probe print <web|motion>`, `doctor`.
- Exit 1 from `observe` means findings were recorded; it is not a failed capture.
- If the browser cannot start, run `probe print web` through a browser tool of your environment and open its screenshots. With no browser at all, say "not visually verified" and cite code only.
- Without Node: copy `assets/dna.md` to `.nomi/dna.md` by hand and fill it in.

## Other design tools

When another design, review or accessibility skill or tool is installed and has produced output for this task (guidance, a lint report, an audit), use that output as evidence in the critique and cite it. Do not repeat its work, and do not let it replace the capture: its claims about the rendered result still need an opened image or a measured value.

## Honesty

- Never describe how something looks, moves or feels unless you opened a capture of it in this session.
- Quote measured values; do not estimate them.
- "Done" for Build and Create means the review ran after the last edit and its verdict block ends the reply. A step you can run is run, not reported as skipped; report only what failed or could not run, and why.
- A flow acts on the page for real. Run flows on the project's own local pages; never on a live site unless the user named that URL and asked for it.
