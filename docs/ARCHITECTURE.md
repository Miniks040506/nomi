# Nomi Architecture

Canonical design for Nomi V1 (planned 2026-09-27). Phase status lives in `IMPLEMENTATION_PLAN.md`, host facts in `INTEGRATIONS.md`, measurement in `EVALUATION.md`. Update this file whenever behavior changes.

## 1. Thesis

Coding agents already know the principles of visual design, motion, 3D, game feel and narrative. They apply them inconsistently, for a handful of repeatable reasons. Nomi is one mechanism per reason. Nothing in Nomi exists to teach a model what it already knows.

| What agents do today | Nomi mechanism | What the agent does differently |
|---|---|---|
| Sample the median when unconstrained: Inter + indigo + three cards, fade-up on everything, a grey cube under ambient light, a floaty jump, "Elara of Eldoria" | **Direction protocol**: ground in the subject, name the default, diverge, choose, translate | Commits to subject-derived, checkable choices and can name the default it rejected |
| Let direction emerge implicitly from code | **Direction gate**: a note (Build) or DNA (Create) before code | Writes concrete direction first |
| Re-decide every session; drift between agents | **Creative state in the repo**: `.nomi/dna.md`, `.nomi/world/` | Reads and extends the same state in every session, on every host |
| Judge code instead of the experience | **Observation engine**: renders, timelines, playtests, measurements | Opens images, quotes measured values, says when it could not look |
| Self-review that rationalizes ("clean and modern") | **Evidence-bound critique** + **fresh-context critic** | Lists ≤5 ranked issues, each tied to an artifact and a fix |
| Stop at the first draft, or polish blindly | **Refinement loop** with measured deltas and round budgets | Fixes S1 then S2, re-observes, diffs runs, stops on evidence |
| Apply the same ceremony to every request | **Effort tiers** | Tweaks stay cheap; identity work gets the full loop |

## 2. Principles

1. **Behavior over vocabulary.** Every file must change a decision, an action or a check. No explanations of principles, frameworks or APIs the model already knows.
2. **Evidence over assertion.** No claim about how something looks, moves or feels without an observation from the current session.
3. **Taste is contextual.** Choices come from the subject, audience and brief, never from a Nomi house style. Explicit wishes in the brief override every Nomi list.
4. **Defaults are questions, not sins.** Fingerprints of generic output ask "chosen or fallen into?". Only a project's own Never list forbids.
5. **One shared core, one entry skill per domain, thin adapters.** Shared logic lives once in the core; host differences live in manifests, install paths and data, never in skill text.
6. **State belongs to the project.** Plain files in the repo, readable by any agent and any person.
7. **Scripts measure, the model judges.** Deterministic code for structure and measurement; judgment stays with the model.
8. **Small context.** Progressive disclosure under enforced budgets (§12).
9. **Degrade honestly.** Without Node or a browser the loop still runs and reports what was not verified.

## 3. System overview

```
 Any host: Claude Code · Codex · Cursor · OpenCode · Gemini CLI · Antigravity · OpenClaw · Hermes
     │  native discovery of the skill folders   (adapters = manifests + install paths, no logic)
     ▼
 Entry skills (the host picks one by description)
     nomi-web   web pages and UI ─┐  every must-do step is in the entry file itself
     nomi       everything else ──┤  (motion, 3D, game, world, direction, DNA)
                                  ▼
 Shared core: skills/nomi/        reached from a domain skill as the sibling folder ../nomi
     │   SKILL.md                 tiers, loop, state, honesty
     │   references/direction.md · critique.md      protocols, one hop away
     │   assets/                  DNA and critic templates
     ├─► scripts/nomi.mjs   (Node ≥22, zero dependencies)
     │      dna · critique pack · world · doctor
     │      observe ──► headless Chromium over CDP ──► probes/*.js run in the page
     │                        └──► .nomi/runs/<id>/  report.json · summary.md · *.png
     ▼
 The user's project (shared by every session, every agent and every Nomi skill)
     .nomi/dna.md   .nomi/world/**      + reads DESIGN.md, PRODUCT.md, CSS tokens when present
```

## 4. The skills: one core, one entry skill per domain

Nomi ships a shared core, `skills/nomi/`, and one entry skill per finished domain, `skills/nomi-<domain>/` (today: `nomi-web`). A domain may instead be a module inside the core, `references/<domain>.md` (today: motion), when another listed skill would cost activation (D20). Every folder conforms to the Agent Skills specification (agentskills.io), so each target host can load them unchanged (per-host evidence: `INTEGRATIONS.md`). They are installed together as siblings; the installation unit is the set, never a single folder.

```
skills/
├── nomi/                    shared core, and the entry for work that has no domain skill yet
│   ├── SKILL.md             scope, tiers, loop, state, CLI summary, domain map, honesty rules
│   ├── references/
│   │   ├── direction.md     ground → name the default → diverge → choose → translate → DNA
│   │   ├── motion.md        the motion module (six sections), reached from nomi-web and the core
│   │   └── critique.md      evidence rules, severity, output, critic packet, refinement, stop rules
│   ├── assets/
│   │   ├── dna.md           DNA v1 template
│   │   ├── critic-brief.md  packet template filled by `nomi critique pack`
│   │   ├── canon-entity.md  world entity template
│   │   └── hooks/           dev-only instrumentation snippets (Three.js, React Three Fiber, games)
│   └── scripts/
│       ├── nomi.mjs         CLI entry, shared by every domain
│       ├── lib/             frontmatter (YAML subset), dna, browser, cdp, serve, capture, motion, compose, runs; later canon
│       ├── probes/          in-page JS returning JSON: web-census, motion; later three, game
│       └── data/            small dated tables: fingerprints, vague-words, generic-names
└── nomi-web/
    └── SKILL.md             web entry: must-do steps, then the six-section web module
```
Later domains add `nomi-3d/`, `nomi-game/` and `nomi-world/` in the same shape, or a core module like motion; each new listing must first pass the activation check of D20. A domain folder exists only when its module is complete: `tools/check.mjs` rejects a domain skill without the full contract, so nothing unfinished is ever discoverable.

**How the pieces cooperate** (measured in `evals/reports/migration-hybrid.md`)
- The host activates one entry skill from its description. Web requests, including small edits, load `nomi-web`; other creative work, motion plans included, loads `nomi`. Both entry files carry the motion must-do lines (capture with `--motion`, open `load.png`) and point to `references/motion.md` for the rest.
- A domain skill reaches shared files through the sibling path `<core>` = `<skill-dir>/../nomi`. It never asks for another skill to be invoked, because hosts rename skills (`nomi:nomi-web`) but keep folders side by side.
- Agents follow what the loaded file says first and skip "go read another file first": in 48 runs that loaded `nomi-web`, no agent opened the core `SKILL.md` or its references (the single skill had the same habit: its one-hop web module was read in 5 of 36 runs). So every step that must happen on every task (read the DNA, pick the tier, capture before and after, honesty) is written in the entry file itself. The core holds what is only needed sometimes: the direction protocol, the critique protocol, templates and the CLI.
- Domain skills cooperate through the project, not through each other: all of them read and extend the same `.nomi/dna.md`.

**Core SKILL.md contract**
- Frontmatter: `name: nomi`; `description` ≤400 characters with the trigger phrase first; optional `license`, `compatibility` (Node 22+ and a Chromium-family browser are optional accelerators), `metadata` with string values only (`version`). No host-specific keys.
- Body order: (1) scope and exit ramp: if the task changes nothing a person sees, hears, feels or reads, stop; (2) tier selection; (3) the loop; (4) state files; (5) CLI summary; (6) domain map listing only domain skills that exist; (7) honesty rules.
- Paths are relative to the skill directory. Scripts run as `node <skill-dir>/scripts/nomi.mjs <command>`, where `<skill-dir>` is the folder containing SKILL.md. No `${CLAUDE_SKILL_DIR}`, `$ARGUMENTS` or host tool names; use host-neutral verbs ("run", "open the image", "start a subagent if your environment has one").

**Domain skill contract.** `skills/nomi-<domain>/SKILL.md` is both the entry and the module:
- Frontmatter: `name` equals the folder; a `description` that names the domain's concrete artifacts and says small edits count; the same `metadata.version` as the core.
- First, without a heading: where the core is (`<core>`), then the numbered must-do steps for every task in this domain, then what to do when `<core>` is missing.
- Then exactly these sections, in this order:

| Section | Contains | Must not contain |
|---|---|---|
| Decide | Fields the direction must fix for this domain | Explanations of why they matter |
| Traps | Current model defaults, phrased as questions | Bans, style catalogs |
| Instrument | What to add to the build so it can be observed or tuned | Framework tutorials |
| Observe | Commands to run and which artifacts to open | Tool internals |
| Critique lenses | Questions answered with evidence from a run | Generic checklists |
| Moves | Non-obvious, high-leverage refinements | Things any model already does |

**CLI** (`nomi` below means `node <skill-dir>/scripts/nomi.mjs`). All commands print compact text (≤60 lines), accept `--json`, and exit 0 ok / 1 findings / 2 error.

| Command | Purpose | Phase |
|---|---|---|
| `dna init \| check \| show [--for <domain>]` | Create, lint and slice Project DNA | 1 |
| `critique pack [--task …] [--evidence …] [--run <id>] [--domain …]` | Write a self-contained critic brief | 1; `--run` from 2 |
| `doctor` | Check Node, browser, project state | 1, browser in 2 |
| `observe <url\|file\|dir> [flags]` | Capture and measure; writes a run | 2; `--3d` 5, `--game` 6 |
| `observe <target> --motion [--interact <file>]` | Animation inventory, replayed load and interaction frames, reduced-motion comparison; writes a `motion` run | 4 |
| `diff <runA> <runB>` | Metric deltas and a before/after sheet; both runs of one kind | 2; motion runs 4 |
| `probe print <web\|motion>` | Print an in-page probe for a host's own browser tool | 2; `motion` 4 |
| `world new \| check \| query \| scan` | Canon tools | 7 |

## 5. The creative loop

**Tiers**, chosen first and stated in one line:

| Tier | When | What runs |
|---|---|---|
| Tweak | Small change inside an existing direction: copy, one color, spacing, a tuning value, a visual bug | Respect DNA (above all Never) → change → observe if cheap → done |
| Build | New component, page, section, scene, mechanic or content inside a direction; visual work where identity is not the ask | Direction note → build → observe → critique → ≤2 refinement rounds → record decisions |
| Create | Establishing or changing identity: new product, site, game or world; redesign; "make it distinctive / less generic"; no DNA and the work defines the look | Direction protocol with 2–3 options → DNA → build → observe → fresh-context critique → ≤3 rounds → record |

**Steps**
1. **Load.** Read the nearest `.nomi/dna.md` and what it points to (DESIGN.md, token files, a canon slice via `world query`). Without DNA, the existing product *is* the direction: observe it before adding to it.
2. **Direct.** Build: a five-line direction note. Create: follow `references/direction.md`, pick one option, proceed, and name the alternatives in the final report so the user can redirect. The brief wins over every Nomi list.
3. **Build with observability.** Add dev-only hooks for 3D and games; keep tunables in one place.
4. **Observe.** Run `nomi observe`, open the listed images, read the summary. If observation is impossible, say so and fall back to code-level evidence.
5. **Critique.** Follow `references/critique.md`. Create tier: hand the packet from `nomi critique pack` to a fresh-context subagent when the host has one; otherwise run the protocol as a separate pass over artifacts only.
6. **Refine.** Fix in severity order, re-observe, `nomi diff`. Stop when no S1/S2 remain, the round budget is spent, or the verdict is RETHINK (back to step 2).
7. **Record.** Append decisions with reasons to DNA; commit canon changes.

**Direction note** (Build):
```
Direction — <surface>
Intent:    who it is for; what they should feel or do
Avoiding:  the default this would otherwise become
Signature: the one memorable move
Choices:   concrete values: type, color, layout, timings/easing, lens/light, feel numbers, naming rules
```

**Critique output**:
```
Verdict: SHIP | REFINE | RETHINK
1. [S1|S2|S3] problem — evidence: <image + region | metric=value | file:line> — fix — verify by
Keep: ≤3 things that work and must survive refinement
Not verified: what could not be observed
```
Severity: **S1** breaks function, access or intent (unreadable text, broken layout, dead input, motion hazard, canon contradiction). **S2** weakens identity or coherence (unexamined default, off-DNA choice, system drift, motion without a job). **S3** polish.

**Honesty rules** (verbatim in SKILL.md): do not describe the look, motion or feel of anything not observed this session; quote measured values instead of estimating; report failed or skipped steps; "done" for Build and Create means observed and critiqued, or explicitly marked unverified.

## 6. Creative state (in the user's project)

```
.nomi/
├── dna.md       committed: creative direction (schema v1)
├── world/       committed: canon entities (World module)
├── runs/        ignored: observation runs, pruned to the last 10
└── .gitignore   contains "runs/" (Nomi never edits the project's root .gitignore)
```
Resolution: the nearest `.nomi/` walking up from the working directory, so packages in a monorepo can differ.

**DNA schema v1** (`assets/dna.md`):
```
---
nomi: 1
domains: [web, motion]      # active modules
sources:                    # pointers only: Nomi reads these, never copies their values
  design: DESIGN.md
  tokens: src/styles/tokens.css
---
## Intent        who it is for, the context, what they should feel or do       (required)
## Character     3–5 traits, each translated into concrete choices per domain   (required)
## Signature     the one or two memorable moves                                 (required)
## Never         project-specific anti-goals, checked in critique              (required)
## Motion | Space | Feel | World   per-domain direction, only for active domains
## Decisions     dated one-liners with reasons, newest first, ≤20 (older ones summarized)
## Open questions
```
`nomi dna check` enforces the version, required sections, vague words without a concrete translation (`data/vague-words.json`), ≤20 decisions and ≤150 lines.

**Canon entity** (`.nomi/world/<type>/<slug>.md`): frontmatter `name`, `type` (character, place, faction, culture, item, event, rule, term), `aliases`, `tags`, optional `date` / `born` / `died`, `status` (canon, draft, retired). The body is concrete prose; `[[Name]]` links are the relations.

**Interop, not invention**
- `DESIGN.md` (Google Labs open format, alpha) is the visual token source when present; drift checks compare rendered output with its `colors` and `typography`. Nomi does not create one unless asked.
- `PRODUCT.md` or brand documents are read as intent input.
- Rendered CSS custom properties are the implementation truth; Nomi measures rendered values rather than parsing framework configs.
- `nomi dna init` appends one line pointing to `.nomi/dna.md` to each existing `AGENTS.md` and `CLAUDE.md`, or creates `AGENTS.md` when neither exists (D13). Skills load only when a host judges them relevant, and in Phase 1 evals an ordinary "add a form" request left the DNA unread 3/3 times. The always-read instruction file makes every agent see the DNA, including agents without Nomi installed.

## 7. Observation engine

| Concern | Design |
|---|---|
| Targets | A URL (a dev server the agent started), an HTML file, or a directory served by a built-in static server |
| Browser | First Chromium-family browser found: `NOMI_BROWSER`, then installed Chrome, Edge or Chromium, then a chrome-headless-shell cache. Headless, temporary profile |
| Control | Chrome DevTools Protocol from Node with zero npm dependencies; pipe on Linux, WebSocket on Windows because Node's Windows stdio pipes do not implement Chromium's inherited-handle protocol. Browser-selected loopback port, temporary profile, no externally exposed debugger |
| Measurement | `probes/*.js` are plain in-page functions returning JSON. `nomi probe print <name>` lets a host's own browser tool run the same probe when Nomi cannot launch a browser (sandboxed hosts) |
| Images | Screenshots per viewport; contact sheets and before/after sheets composed in the browser's canvas (no image libraries); downscaled viewing copies |
| Output | `.nomi/runs/<id>/report.json` (versioned; stable flag codes such as `web.contrast`, `motion.layout-property`), `summary.md` (≤60 lines), ≤4 images to open by default |
| Time | Web, 2 viewports ≤15 s; motion ≤30 s; 3D ≤30 s; game playtest ≤60 s. Every wait is bounded |
| Fidelity | Web capture is headless. Later WebGL measurements may be software-rendered; performance budgets and headed checks are future domain work, not implemented flags |
| Safety | Local artifacts, no Nomi telemetry, temp profile removed. The browser sandbox stays on by default. `NOMI_BROWSER_NO_SANDBOX=1` turns it off for local pages only (file, folder, localhost URL) and is noted in the run report (D17). Restricted-host failures otherwise use `probe print web` through an available host browser, or report not visually verified. URL targets may themselves make network requests |

Phase 2 implementation boundaries:
- Reports use `nomi: 1`, `kind: web|diff`, viewport census, stable finding codes, notes and absolute artifact paths. They are local evidence, not portable archives.
- Text summaries are capped at 60 lines; JSON and critic packets preserve evidence rather than silently truncating their data. Up to four images are suggested for opening; individual viewport screenshots remain in the run folder.
- Platform-font and keyboard passes sample at most 200 elements/controls; the keyboard pass also has a 1200 ms budget. Unvisited controls are explicitly unverified. The portable console probe has the same census keys, but uses a programmatic focus heuristic and leaves actual rendered families null.
- Focus handlers can run during measurement; use a disposable development state for pages with focus side effects. Focus and scroll are restored, but arbitrary application event-handler effects cannot be undone. This replaces the unrealistic promise of pure interaction probes.
- Contrast over images, gradients, opacity, filters or unsupported colour spaces is unknown. Pseudo-elements, shadow roots, canvas, occlusion and interaction states need visual review. Overflow counts when the page scrolls sideways, or when visible content is clipped by more than 8 px. Smaller clipped bleed (optical negative margins) and wholly left-offscreen elements such as skip links are not flagged. Viewports narrower than 768 px are emulated as phones (overlay scrollbars, `<meta viewport>` honoured), so a phone capture never loses 15 px to a desktop scrollbar.
- Census counts, token drift and dated copy fingerprints are questions, not a taste score. Layout identity is judged from screenshots; there is no reliable deterministic generic-layout detector in V1.
- Static serving rejects traversal, dot paths and escaping symlinks. Browser waits are bounded; continuous requests yield a warning and current-state capture. Contact sheets use a separate blank browser target.
- Cleanup: Windows kills the browser tree with `taskkill` by absolute path, waits for the root to exit, and retries profile removal for about 5 s, because killed trees release file locks late. A profile that stays locked produces a stderr warning; it never turns a finished capture into a failure. Discovery never looks in world-writable folders; portable binaries are passed through `NOMI_BROWSER`.
- Runs resolve from the working directory, so SKILL.md tells agents to run the CLI from the project folder. In Phase 2 evals, agents sometimes ran it from the skill folder or the project's parent. The captures were still valid, but they landed outside the project (Phase 3, U1).

Phase 4 motion capture (`observe --motion`, `lib/motion.mjs`, `probes/motion.js`):
- **What is measured.** Web Animations only: CSS animations, CSS transitions and script-created `Animation` objects. A recorder injected before the page's own scripts keeps every animation from the frame it first appears in (finished ones leave `document.getAnimations()`), tagged with the step that was running. The probe reports per animation: kind, name, element, properties, duration, delay, iterations, easing, direction, fill, start and end on the document timeline. It also scans computed styles for declared transitions and counts `prefers-reduced-motion` media rules. Motion drawn frame by frame from script (canvas, `requestAnimationFrame` tweens, video) is not measured, and the report says so.
- **Timing comes from animation data.** Settle time is the span from the first start to the last end of the finite animations. Infinite animations are counted separately and never block the capture. No value is derived from frame timestamps.
- **Frames are replayed, not filmed.** After the load has been watched, each recorded animation is paused and set to the time it would have had, and a screenshot is taken: 8 frames evenly across the load span, 2 inside each interaction. A transition before its start shows its from-value. Frames are therefore exact for Web Animations and blind to anything else that changes with time. Replay can make a page's `animationend`/`transitionend` handlers run again.
- **Watch window.** The load is watched until its animations have ended and nothing new has started for 300 ms, bounded by `--wait` (default 4000 ms in motion mode, at most 5000). Motion that starts later needs a `wait` step.
- **Interactions.** `--interact <file>` is a JSON list of 1–6 steps: `hover`, `press`, `click`, `focus`, `scroll` (`target` or `y`), `wait` (`ms`). Each step gets a row on `interactions.png`: before, two replayed frames, after, cropped to 480×300 px around the target. The pointer is parked between pointer steps, so the way back is not counted in the next step.
- **Reduced motion.** The page is loaded a second time with `prefers-reduced-motion: reduce` and the same steps, without screenshots. An animation that still animates transform, position or a layout property is `motion.reduced-motion` (S1). A fade or an opacity pulse passes.
- **Findings.** `motion.reduced-motion` (S1); `motion.layout-property`, `motion.transition-all`, `motion.long-frame` (S2); and three fingerprints phrased as questions from `data/fingerprints.json`: `motion.fingerprint.uniform-timing`, `.same-entrance` (6 or more elements start one animation at the same moment), `.infinite`. Findings are grouped per animation, with an element count. Long frames come from the browser's long-animation-frame entries that overlap the load motion; in a headless browser they are indicative only.
- **Output.** A run of kind `motion`: `report.json` (`motion.animations`, `motion.transitions`, `motion.load`, `motion.interactions`, `motion.reduced`, `motion.longFrames`, plus the summary's `overview` lines), `load.png`, `interactions.png` when steps were given, and the single frames. One viewport per run. A fixture capture with three steps takes about 10 s.
- **Console probe.** `probe print motion` returns the same keys, but only for animations alive at that moment and without start times or frames.

Non-browser targets (native apps, Godot, Unity) get judgment only in V1 and are reported as not visually verified unless the host itself can show the result.

## 8. Critique and the independent critic

Self-critique in the builder's context tends to defend its own choices. Nomi counters this twice:
1. **Evidence binding.** An issue without an artifact, a measured value or a file:line reference is not an issue. The critic says "insufficient evidence" rather than guessing.
2. **Context separation.** `nomi critique pack` writes a self-contained brief: task, DNA excerpt, Never list, run summary, image paths, the module's lens section, output format. In Create tier the builder starts a fresh-context subagent with it when the host has subagents; otherwise it runs the protocol as a separate pass over artifacts only.

Refinement never discards the Keep list, and every round ends with a new run and `nomi diff`, so improvement is measured, not claimed.

## 9. Domain modules

| Module | Decides up front | Instruments | Observes | Evidence the critique uses |
|---|---|---|---|---|
| Web | Layout concept, type roles and scale, 4–6 colors with roles, density, signature, copy voice | — | Screenshots (mobile, desktop), style census, contrast, overflow, keyboard focus pass, token drift, copy fingerprints | Images; type/palette/spacing counts; failing nodes |
| Motion | The job of each motion, timing scale, easing family, entrance order, reduced-motion strategy | Web Animations (CSS or the Web Animations API) so the capture can measure them | Animation inventory, replayed load and interaction frames as sheets, reduced-motion comparison, long frames, settle time | Durations, easings, delays, animated properties per element; frame labels; long-frame counts |
| 3D | Shot (lens, framing), light intent, material palette, scale cue, performance budget | `window.__nomi = { renderer, scene, camera, shots }`, dev only | Renders per named shot, renderer stats and config, lights and materials census, luminance histogram, subject coverage | Renders; draw calls and triangles; tone mapping; histogram |
| Game | ≤3 core verbs, feel translated into numbers, feedback per verb, first-30-seconds pacing | One `tuning` object; `window.__nomi.game = { tuning, state(), events }` | Scripted playtests: frame strips, input-to-response latency, state traces (arcs, acceleration), feedback coverage | Latency in ms and frames; arc numbers vs targets; verb × channel matrix |
| World | Premise, rules and their costs, cultures in tension, naming systems, tone, material culture | Canon entities in `.nomi/world/` | `world check` (contradictions, undefined refs, duplicates, naming, generic names), `world query` slices, `world scan` of content | Findings with file:line; slices |

**Cross-domain Create work** sets direction in this order: world → visual → space → feel → interface → motion. One Character section governs all domains so they stay coherent. A critique pass applies at most two lenses.

## 10. What "multi-agent" means in V1

1. **Any host.** The same skill runs on all eight targets (`INTEGRATIONS.md`).
2. **Shared memory.** `.nomi/` is the contract between sessions and agents: one agent builds what another later extends and a third reviews, all under one direction.
3. **Role separation.** Builder and critic run in different contexts when the host allows.

Not in V1: autonomous director/builder pipelines, per-host agent definitions, mandatory parallel domain critics. Revisit only with eval evidence (D7).

## 11. Packaging and repository layout

```
nomi/                                  target layout at the end of V1
├── skills/nomi/                       the shared core (protocols, templates, CLI)
├── skills/nomi-<domain>/              one entry skill per finished domain (today: nomi-web)
├── plugin.json                        Agent Plugins v1 manifest: Codex, Cursor, OpenClaw, Hermes
├── .claude-plugin/                    plugin.json + marketplace.json: Claude Code
├── gemini-extension.json              Gemini CLI extension (bundles skills/)
├── .agents/plugins/marketplace.json   Codex marketplace entry
├── adapters/hosts.json                machine-readable host table: paths, channels, headless commands, verification
├── adapters/<host>/                   only when a host needs its own files (none so far)
├── tools/                             check.mjs · install.mjs · verify-hosts.mjs · schemas/ (vendored manifest schemas)
├── .github/workflows/check.yml        check and tests on Windows and Linux
├── evals/                             cases/ · fixtures/ · harness/ · reports/
├── tests/                             node --test: unit tests and fixture pages
├── docs/
└── package.json                       dev scripts and dev dependencies only
```
Project-level reach, as documented by each host (local verification is Phase 3): the Nomi folders (`nomi` and every `nomi-<domain>`) copied side by side into `.agents/skills/` serve Codex, Cursor, OpenCode, Gemini CLI, Antigravity, OpenClaw and Hermes (trust required); the same folders in `.claude/skills/` serve Claude Code. Sibling resolution is verified on Claude Code (plugin and project folder) and Codex (project folder); OpenClaw lists both folders from `~/.agents/skills` but reads project skills from its own agent workspace, not the shell folder. Channels and caveats are in `INTEGRATIONS.md`.

Packaging rules (Phase 3):
- Every manifest names the same plugin: `tools/check.mjs` requires name `nomi`, one version and one description across `plugin.json`, `.claude-plugin/plugin.json` and `gemini-extension.json`, validates `plugin.json` against the vendored Agent Plugins schema, and requires both marketplace files to list `nomi`.
- `adapters/hosts.json` is the machine source for host facts; the status table in `INTEGRATIONS.md` must repeat its status, version and date for every host, or `check` fails.
- `tools/install.mjs` copies the whole set into the distinct folders of the chosen hosts, replaces only folders that are Nomi skills, and removes them with `--uninstall`.
- `tools/verify-hosts.mjs` is the only way a host reaches status `L`.

## 12. Context budgets

| Item | Budget | Enforced by |
|---|---|---|
| Skill description | ≤400 characters per skill, trigger phrase first | `tools/check.mjs` |
| SKILL.md, core and each domain skill | ≤150 lines (about 2k tokens) | `tools/check.mjs` |
| Each reference file | ≤200 lines, loaded only when relevant | `tools/check.mjs` |
| Templates | ≤120 lines | `tools/check.mjs` |
| CLI output | ≤60 lines by default; details go to files | tests |
| Images per observe | ≤4 opened by default; viewing copies ≤1280 px wide | tests |
| DNA | ≤150 lines, ≤20 decisions | `nomi dna check` |
| Canon slice | ≤80 lines per `world query` | tests |
| Typical load | Web task: `nomi-web/SKILL.md` (about 65 lines) plus DNA and one run; with motion, plus `references/motion.md` (about 65 lines) and one or two sheets. Other work: core SKILL.md plus DNA. Create: plus direction and critique, ≤2 domain skills | token-overhead evals |

## 13. Non-goals and duplication boundaries

Nomi must not contain:
- Explanations of design, color, typography, animation, 3D, game-design or narrative principles.
- Framework or API tutorials (Tailwind, GSAP/Motion, Three.js, React Three Fiber, Phaser, engines).
- Restated accessibility rules. Nomi measures contrast, focus visibility, reduced motion and target sizes instead.
- Style catalogs, palette or font libraries, prompt collections.
- Large anti-pattern rule sets. Static web detection already exists (Anthropic's `frontend-design` skill; Impeccable's detector). Nomi keeps ≤25 dated fingerprints per domain, phrased as questions, and treats other tools' output as evidence when a project already uses them.
- Asset generation (images, models, audio). Nomi directs and judges their use.

V1 non-goals: hooks, an MCP server, user-level taste profiles, non-browser observation, autonomous multi-agent pipelines, a published npm CLI.

## 14. Decision record

| # | Decision | Why | Reversibility / trigger to revisit |
|---|---|---|---|
| D1 | One skill `nomi` with domain modules, replacing six skill folders | Cross-skill references are not portable (Claude Code namespaces plugin skills as `nomi:<skill>`; Hermes namespaces packaged skills as `agent-plugin-<slug>-<hash>`; skill hubs install skills one by one). Listing budgets penalize many descriptions (Codex: ≤2% of context or 8,000 characters for all skills). Every domain needs the same loop | Superseded by D14 (2026-10-01) through this reversible path. Its portability concerns remain and shape D14: no cross-skill invocation, sibling folders only |
| D2 | Agent Skills spec-pure canonical skill; host specifics only in root manifests and `adapters/hosts.json` | Seven of eight hosts read `.agents/skills`; all eight read SKILL.md folders | Easy |
| D3 | Creative state in `.nomi/` (DNA v1, canon) | Vendor-neutral memory across sessions and agents | One-way for users: versioned schema; a migration command ships before any breaking change |
| D4 | Interop with DESIGN.md, PRODUCT.md and CSS tokens; never duplicate token values | Avoid drift and competing sources of truth | Easy |
| D5 | Node ≥22, zero-dependency CLI inside the skill | Runs wherever Node runs; no install step | Moderate; the CLI boundary isolates callers |
| D6 | Raw CDP to any Chromium-family browser; probes are portable in-page JS | Zero-install observation; host browser tools can run the same probes | Easy: the capture layer can switch to Playwright |
| D7 | Evidence-bound critique; fresh-context critic via the host's own subagents; no per-host agent files | Portable; no adapter logic | Easy: adapters may add native agent definitions |
| D8 | Tiers Tweak / Build / Create with refinement budgets 0 / 2 / 3 | Proportional effort | Easy |
| D9 | No hooks in V1 | Portability; evidence first | Add an optional reminder hook for Claude Code and Codex if observe-before-claim stays below 80% after Phase 2 |
| D10 | Distribution through project/user folders plus native packages (Claude Code plugin, Agent Plugins, Gemini CLI extension); Antigravity and OpenCode through folders only | Uses each host's real mechanism | Additive |
| D11 | Automated observation only for browser-rendered targets | Web, WebGL and web games share one engine | Future per-engine adapters |
| D12 | Evals: `claude plugin eval` for Claude Code behavior suites; the Nomi runner for cross-host outcome A/B | First-party isolation where it exists | Easy |
| D13 | `dna init` adds a one-line DNA pointer to AGENTS.md and CLAUDE.md (creating AGENTS.md if neither exists) | Phase 1 eval: skill activation alone left the DNA unread in 3/3 runs of an ordinary UI request; persistent state must not depend on a skill firing | Easy: remove the line. Its effect on agents without Nomi is verified per host in Phase 3 (INTEGRATIONS U11); revisit if hosts gain a standard way to register project state |
| D14 | Hybrid: shared core `skills/nomi` plus one entry skill per finished domain (`nomi-web` first; motion stays a core module, D20). The domain skill is entry and module in one file and reaches core files as the sibling folder `../nomi` | Migration eval, 27 existing-page edits, equal conditions: the hybrid observed 27/27 and read the DNA 20/27, against 21/27 and 15/27 for the best single-skill variant (same description fix, same must-do block); activation 27/27 for both. Domain steps sit in the file that loads | Reversible: fold `nomi-web/SKILL.md` back into `references/web.md`. Revisit if a host installs or renames skill folders one by one (INTEGRATIONS U12), or if listing budgets bite with five domains |
| D15 | Must-do steps live in the entry file; the core is one hop away and holds only what is sometimes needed | In 48 `nomi-web` runs no agent followed "read the core first"; in the single skill the one-hop web module was read in 5 of 36 runs. What is not in the loaded file is skipped at low effort | Easy: move lines between files. `tools/check.mjs` keeps domain skills on the six-section contract |
| D16 | Descriptions name concrete artifacts and say small edits count; the "any project with a `.nomi/` folder" trigger is dropped | Root cause of 11/27 activation: the choice is made at the first action, from the prompt's wording alone, before the agent has seen the project. Fixing the description alone raised activation from 1/8 to 8/8; medium effort did not help (0/4) | Easy: edit the description. Phase 3 trigger suite owns recall and false-trigger gates |
| D17 | `NOMI_BROWSER_NO_SANDBOX=1` starts the browser without its own sandbox, for local targets only (file, folder, loopback URL); the run report notes it. Off by default and absent from the skill text and error messages | Phase 3, Codex 0.159.3 on Windows: inside the `workspace-write` sandbox Chromium cannot create its nested sandbox (GPU process exits with access denied); of five flag sets tried only `--no-sandbox` captured. Local pages are project code the host sandbox already confines. In the verification run the Codex agent found the switch by reading `browser.mjs` and set it itself | Easy: delete the switch; Codex on Windows then has only `probe print` or "not visually verified". Revisit if agents use it outside a host sandbox, or if Codex lets a sandboxed process start Chromium |
| D18 | Motion is measured with an in-page Web Animations recorder and replayed from animation data. The CDP Animation domain and real-time frame capture are not used | The plan named CDP Animation events and sampled frames. CDP animation events carry timing but no property names, so the inventory needed the in-page API anyway; one mechanism also gives the console probe the same keys. Real-time screenshots take 50–150 ms each and jitter under load (Phase 3 saw timing tests fail on a busy machine), so a 240 ms transition would get one or two frames at unknown times. Replay gives labelled frames at exact times; all motion tests pass under a parallel test run | Easy: the capture interface is `captureMotion`. Revisit for script-driven motion (canvas, `requestAnimationFrame` libraries), which this design cannot see: Phases 5 and 6 need their own hooks for that |
| D20 | Motion is a module of the core (`references/motion.md`), not a third entry skill. The six-section contract applies to it (`tools/check.mjs`), and `nomi-web` and the core carry its must-do lines | Phase 4, Claude Code 2.1.289, `claude-sonnet-5-5`, low effort, two Build prompts over existing pages (n = 6–16 per layout): the Phase 3 pair of skills loaded a Nomi skill in 11/16 runs; every layout with a third listed `nomi-motion` (full, short, narrow or split descriptions, or a raised listing budget) in 4/42; the final layout (two listings, the motion module in the core) in 3/6. A core description that no longer named animation also lowered activation (1/6 without a third skill) and was reverted. The motion skill itself routed correctly on a plain motion request (7/7), so the loss is on ordinary page edits, the common case. Codex was unaffected (it reads every relevant skill). The mechanism inside the host is not identified: raising `SLASH_COMMAND_TOOL_CHAR_BUDGET` did not help | Reversible: move `references/motion.md` back into `skills/nomi-motion/SKILL.md` with frontmatter. Revisit when a host update changes activation with three listed skills; measure it with the `trigger` suite plus two Build prompts before adding any new domain skill (3D, game, world) |
| D19 | One viewport per motion run; the pointer is parked between pointer steps | Two passes (normal, reduced) and replay already cost about 10 s per viewport. Without parking, the previous element's return transition was attributed to the next step | Easy. A hover menu that must stay open while a child is clicked needs `click` steps, or a future `keep` option |

## 15. Glossary

**Tier**: Tweak, Build or Create; sets how much of the loop runs. **Direction note**: five lines of concrete direction written before a Build. **DNA**: `.nomi/dna.md`, the project's durable creative direction. **Canon**: the World module's entity files. **Run**: one `nomi observe` result in `.nomi/runs/<id>/`, of kind `web`, `motion` or `diff`. **Settle time**: the span from the first start to the last end of a page's finite animations. **Step**: one entry of an `--interact` script. **Probe**: in-page JS that measures and returns JSON. **Fingerprint**: a dated signature of generic output that prompts "chosen or fallen into?". **Critic packet**: the self-contained brief from `nomi critique pack`. **Core**: `skills/nomi`, the shared protocols, templates and CLI. **Domain skill**: `skills/nomi-<domain>`, an entry skill whose body is the domain module under the six-section contract. **Module**: the six sections of a domain skill. **Host**: an agent environment that loads the skill. **Channel**: a way to install Nomi into a host (folder, plugin, extension).
