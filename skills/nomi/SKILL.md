---
name: nomi
description: "Use for creative work people see, hear, feel or play beyond web pages: animation and motion, 3D or WebGL scenes, game mechanics and feel, fictional worlds and lore; to set or change a project's creative direction or .nomi/dna.md; or when output looks generic or AI-made. Shared core of Nomi; web pages and UI have their own Nomi web skill."
compatibility: Optional Node.js 22+ for scripts. Without it the process still applies; results are marked unverified.
metadata:
  version: "0.1.0"
---
# Nomi

Creative judgment for work people experience, and the shared core every Nomi domain skill uses. If the task changes nothing a person sees, hears, feels or reads, stop here.

## 1. Choose the tier (state it in one line)

| Tier | When | Do |
|---|---|---|
| Tweak | Small change inside an existing direction: copy, one colour, spacing, a value, a visual bug | Respect the DNA (above all Never), make the change. Observe a visual fix (step 4) whenever a browser is available; "not visually verified" is only for when observing is impossible. No direction note, no critique. |
| Build | New component, page, section, scene, mechanic or content inside a direction | Direction note, build, look, critique, at most 2 refinement rounds, record decisions |
| Create | New product, site, game or world; redesign; "make it distinctive"; or no DNA and this work defines the look | Direction protocol, write DNA, build, look, independent critique, at most 3 rounds, record |

## 2. Load the creative state first

- Find the nearest `.nomi/dna.md` (walk up from the working folder) and read it before touching anything. Its Never list and Decisions are binding for every tier.
- Read what its `sources` point to (DESIGN.md, token files) instead of guessing values.
- No DNA: the existing product is the direction. Read its styles and pages before adding to them.
- The brief's explicit wishes override everything in this skill, including any default it would otherwise question.

## 3. Direct before you build

Build tier: write this note in your reply before any code.
```
Direction — <surface>
Intent:    who it is for; what they should feel or do
Avoiding:  the default this would otherwise become
Signature: the one memorable move
Choices:   concrete values (typefaces, hex colours, sizes, timings, layout rules)
```
Create tier: follow `references/direction.md`, then write `.nomi/dna.md` from `assets/dna.md`.

## 4. Look, critique, refine

- Web pages and UI: follow the web skill, `<skill-dir>/../nomi-web/SKILL.md`, for capture (`observe`), lenses and moves. Open the printed images before judging and measure again after fixes.
- If a capture fails, run the domain's `probe print` through a host browser tool and open its screenshots. Without browser access, say "not visually verified" and cite code only.
- Other domains: render and open evidence if possible; otherwise say "not visually verified".
- Critique with `references/critique.md`: at most 5 ranked issues, each tied to evidence.
- Fix in severity order and look again. Stop when no S1 or S2 remains or the round budget is spent; report what remains.

## 5. Record

Append new decisions to the DNA's Decisions section: date · domain · decision, and why.

## Scripts (optional)

Run `node <skill-dir>/scripts/nomi.mjs <command>` from the project folder (runs are saved in its `.nomi/runs/`), where `<skill-dir>` is the folder containing this file:
`dna init`, `dna check`, `dna show --for <domain>`, `observe <url-or-file>`, `diff <before-id> <after-id>`, `probe print web`, `critique pack --task "…" --run <id>`, `doctor`.
Without Node: copy `assets/dna.md` to `.nomi/dna.md` by hand and fill it in.

## Domain skills (load only what the task needs)

Each is a sibling folder of this one and uses this core.
- `<skill-dir>/../nomi-web/SKILL.md`: web pages and UI: rendered capture, accessibility findings, web lenses and moves.
- Motion, 3D, game and world have no domain skill yet: apply this loop and critique, and mark visual claims not visually verified.

## Honesty

- Never describe how something looks, moves or feels unless you observed it in this session.
- Quote measured values; do not estimate them.
- Report skipped or failed steps. "Done" for Build and Create means looked at and critiqued, or explicitly marked unverified.
