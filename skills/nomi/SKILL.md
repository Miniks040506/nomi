---
name: nomi
description: "Use for any web page, app screen or UI work, including small edits to an existing page: adding or changing sections, cards, forms, lists, layout, styling, animation or on-page copy; mobile, accessibility and readability fixes; designing, redesigning, polishing or reviewing an interface; setting a project's design direction. Checks the rendered result in a real browser and follows .nomi/dna.md."
compatibility: Optional Node.js 22+ and a Chromium-family browser for rendered checks. Without them the process still applies and results are marked not visually verified.
metadata:
  version: "0.1.0"
---
# Nomi

Delivers interface work the way a product team would: direct, build, look at the rendered result, critique, fix, record. `<skill-dir>` is the folder containing this file. If the task changes nothing a person sees or reads, stop here.

**Every task, in order:**
1. Read the nearest `.nomi/dna.md` (walk up from the project folder) before editing, and what its `sources` point to. Its Never list and Decisions bind; the brief's explicit wishes override them and everything in this skill. No DNA: the existing product is the direction; read its styles and pages before adding to them.
2. State the tier in one line (table below).
3. Open `<skill-dir>/modules/web.md` now, before changing anything: it says what to decide for a page, which capture options to use and what to judge. When the task adds or changes animation, transitions or hover and press states, open `<skill-dir>/modules/motion.md` as well.
4. Capture before and after the change and open the printed images. Run from the project folder:
```
node <skill-dir>/scripts/nomi.mjs observe <url-or-index.html>
```
   When the task adds or changes animation, transitions or hover and press states, also run it with `--motion` and open `load.png`.
5. Build and Create: critique with `references/critique.md` plus the module's lenses (at most 5 ranked issues, each tied to evidence), fix in severity order, capture again. Stop when no S1 or S2 remains or the round budget is spent; report what remains.
6. Append new decisions to the DNA's Decisions section: date · domain · decision, and why.

## Tiers

| Tier | When | Do |
|---|---|---|
| Tweak | Small change inside an existing direction: copy, one colour, spacing, a value, a visual bug | Respect the DNA (above all Never), make the change, capture the result. No direction note, no critique. |
| Build | New component, page, section or content inside a direction | Direction note, build, capture, critique, at most 2 refinement rounds, record decisions |
| Create | New product or site; redesign; "make it distinctive"; or no DNA and this work defines the look | Follow `references/direction.md`, write `.nomi/dna.md` from `assets/dna.md`, build, capture, independent critique, at most 3 rounds, record |

Build tier: write this note in your reply before any code.
```
Direction — <surface>
Intent:    who it is for; what they should feel or do
Avoiding:  the default this would otherwise become
Signature: the one memorable move
Choices:   concrete values (typefaces, hex colours, sizes, timings, layout rules)
```

## Modules

Step 3 opens these; each holds what to decide, the capture options, the critique lenses and the moves.
- `modules/web.md`: any page, screen or component. First command: `observe <url-or-index.html>`.
- `modules/motion.md`: the task adds or changes animation, transitions, or hover, focus and press states. First command: `observe <target> --motion`.
- Work with no module (3D scenes, native apps): apply the steps above, render and open evidence if you can, otherwise say "not visually verified".

## Asked for by name

- "nomi" with a task: work out which modules the task needs and run the steps above.
- One part by name ("nomi-web", "nomi-motion", "nomi web …"): open that part's file under `modules/` and do that part alone, to the same standard. The DNA, the capture and the honesty rules still apply.
- A part with no file in `modules/` (plan, review, readme, brandvid, mobile, 3d) is not in this version: say so in one line, then do the task with the steps above.

## Scripts

`node <skill-dir>/scripts/nomi.mjs <command>`, run from the project folder (runs are saved in its `.nomi/runs/`):
`observe <url-or-file> [--motion]`, `diff <before-id> <after-id>`, `dna init`, `dna check`, `dna show --for <domain>`, `critique pack --task "…" --run <id>`, `probe print <web|motion>`, `doctor`.
- Exit 1 from `observe` means findings were recorded; it is not a failed capture.
- If the browser cannot start, run `probe print web` through a browser tool of your environment and open its screenshots. With no browser at all, say "not visually verified" and cite code only.
- Without Node: copy `assets/dna.md` to `.nomi/dna.md` by hand and fill it in.

## Other design tools

When another design, review or accessibility skill or tool is installed and has produced output for this task (guidance, a lint report, an audit), use that output as evidence in the critique and cite it. Do not repeat its work, and do not let it replace the capture: its claims about the rendered result still need an opened image or a measured value.

## Honesty

- Never describe how something looks, moves or feels unless you opened a capture of it in this session.
- Quote measured values; do not estimate them.
- Report skipped or failed steps. "Done" for Build and Create means captured and critiqued, or explicitly marked unverified.
