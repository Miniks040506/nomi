# Nomi Architecture

Canonical design for Nomi V1. Planned 2026-09-27; rewritten 2026-10-05 for the delivery pipeline, the single skill folder and the public/dev split (Phase 5); plan, flow measurement, review and the proof card added 2026-10-06 (Phase 6). This file describes what is built. Stages that are planned but not built are marked "planned" and are not in the skill text.

## 1. Thesis

Nomi makes a coding agent deliver software UI the way a product team would: plan, design, build, run and measure, review, fix what the evidence shows, present. Coding agents already know the principles of visual design and motion. They apply them inconsistently, for a handful of repeatable reasons. Nomi is one mechanism per reason. Nothing in Nomi exists to teach a model what it already knows.

| What agents do today | Nomi mechanism | What the agent does differently |
|---|---|---|
| Sample the median when unconstrained: Inter + indigo + three cards, fade-up on everything | **Direction protocol**: ground in the subject, name the default, diverge, choose, translate | Commits to subject-derived, checkable choices and can name the default it rejected |
| Let direction emerge implicitly from code | **Direction gate**: a note (Build) or DNA (Create) before code | Writes concrete direction first |
| Re-decide every session; drift between agents | **Creative state in the repo**: `.nomi/dna.md` | Reads and extends the same state in every session, on every host |
| Judge code instead of the experience | **Observation engine**: renders, motion timelines, measurements | Opens images, quotes measured values, says when it could not look |
| Self-review that rationalizes ("clean and modern") | **Evidence-bound critique** + **fresh-context critic** | Lists ≤5 ranked issues, each tied to an artifact and a fix |
| Stop at the first draft, or polish blindly | **Refinement loop** with measured deltas and round budgets | Fixes S1 then S2, re-observes, diffs runs, stops on evidence |
| Apply the same ceremony to every request | **Effort tiers** | Tweaks stay cheap; identity work gets the full loop |
| Design before knowing what the product is for | **Plan stage**: the product read, then its jobs written as runnable flows | States the product type, the user and the jobs before any interface file, and can be redirected on one line |
| Say "it works" without using it | **Flow playtest**: the jobs run as steps in a real browser | Reports each job as completed or stopped at a step, with dead clicks and console errors |
| End with a summary instead of a verdict | **Review**: a measured floor (what blocks SHIP) plus the proof card | Cannot report SHIP over a failed flow or over evidence older than the last edit |

## 2. Principles

1. **Behavior over vocabulary.** Every file must change a decision, an action or a check. No explanations of principles, frameworks or APIs the model already knows.
2. **Evidence over assertion.** No claim about how something looks, moves or feels without an observation from the current session.
3. **Taste is contextual.** Choices come from the subject, audience and brief, never from a Nomi house style. Explicit wishes in the brief override every Nomi list.
4. **Defaults are questions, not sins.** Fingerprints of generic output ask "chosen or fallen into?". Only a project's own Never list forbids.
5. **One skill folder, modules inside it, thin adapters.** All skill logic lives in `skills/nomi/`; host differences live in manifests, install paths and data, never in skill text.
6. **State belongs to the project.** Plain files in the repo, readable by any agent and any person.
7. **Scripts measure, the model judges.** Deterministic code for structure and measurement; judgment stays with the model.
8. **Small context.** Progressive disclosure under enforced budgets (§12).
9. **Degrade honestly.** Without Node or a browser the loop still runs and reports what was not verified.

## 3. System overview

```
 Any host: Claude Code · Codex · Cursor · OpenCode · Gemini CLI · Antigravity · OpenClaw · Hermes
     │  native discovery of one skill folder   (adapters = manifests + install paths, no logic)
     ▼
 skills/nomi/                     the only listed skill; the host loads it from its description
     │   SKILL.md                 pipeline entry: every-task steps, tiers, module map, honesty
     │   modules/plan · web · motion · review · readme · brandvid   one file per domain or stage, read when the task needs it
     │   references/direction.md · critique.md    protocols
     │   assets/                  DNA and critic templates
     ├─► scripts/nomi.mjs   (Node ≥22, zero dependencies)
     │      plan · dna · critique pack · review · readme · doctor
     │      observe ──► headless Chromium over CDP ──► probes/*.js run in the page; flows act on it
     │                        └──► .nomi/runs/<id>/  report.json · summary.md · *.png
 │      brandvid ─► the same browser films the flows; a blank loopback page composes and encodes ──► .nomi/video/
     ▼
 The user's project (shared by every session and every agent)
     .nomi/dna.md · plan.md · proof.md · storyboard.json · video/ · commands.json      + reads DESIGN.md, PRODUCT.md, CSS tokens when present
```

**The pipeline.** What Nomi is for: `plan → design → build → run and measure → review → present`. Built today: plan, design (direction), build, measure (interface, motion and business flows), critique, review with a bounded fix loop and the proof card, record, and present (a README whose claims are checked, and a demo video filmed from the flows). Present runs when it is asked for: alone ("write the README", "make a demo video") or as the end of a delivery the user wants presented (D35).

## 4. The skill: one folder, one listing, modules inside

Nomi ships one skill folder, `skills/nomi/`, conforming to the Agent Skills specification (agentskills.io), so each target host loads it unchanged (per-host evidence is kept in the development tree; `docs/HOSTS.md` states what is verified). One listing is a measured choice (D21): every extra listed skill or command competes for the host's attention at the first action.

```
skills/nomi/
├── SKILL.md             pipeline entry: the steps of every task, tiers, direction note, module map, scripts, honesty
├── modules/
│   ├── plan.md          stage module: the product read, jobs as flows, screens, done
│   ├── web.md           domain module: pages, screens, components
│   ├── motion.md        domain module: animation, transitions, interaction states
│   ├── review.md        stage module: measured verdict, false positives, fix order, proof card
│   ├── readme.md        stage module: run the commands, write from evidence, `readme check`
│   └── brandvid.md      stage module: storyboard, record from the flows, judge the sheet
├── references/
│   ├── direction.md     ground → name the default → diverge → choose → translate → DNA
│   └── critique.md      evidence rules, severity, output, critic packet, refinement, stop rules
├── assets/
│   ├── dna.md           DNA v1 template
│   ├── plan.md          plan v1 template; its Flows comment is the reference for the flow format
│   └── critic-brief.md  packet template filled by `nomi critique pack`
└── scripts/
    ├── nomi.mjs         CLI entry
    ├── lib/             frontmatter (YAML subset), dna, plan, browser, cdp, serve, capture, motion, flow, review, record, readme, compose, runs
    ├── probes/          in-page JS: web-census and motion return JSON; stage composes, encodes and measures a video on a blank page
    └── data/            small dated tables: fingerprints, vague-words (with README claims), product-types
```
Reserved module names, each added by the phase that builds it: `mobile`, `3d` (domains). `tools/check.mjs` rejects any other file in `modules/` and any module without its contract, so nothing unfinished is discoverable.

**How the pieces cooperate**
- The host loads `nomi` from its description, which names concrete artifacts and says small edits count (D16). A project install also writes one line into the always-read instruction file (D23), which is what makes loading reliable: 27/27 against 15/27 without it.
- Asked for by name: "nomi" with a task makes the agent work out which modules it needs; a named part ("nomi-web", "nomi-motion", "nomi-readme", "nomi-brandvid") runs that module alone; a part that is not built yet is reported as missing in one line.
- A request for only a README or only a demo video is routed by one line at the top of the entry, before the numbered steps: it opens that stage module and does that stage alone.
- Agents follow what the loaded file says first (D15). So every step that must happen on every task is in the entry file itself: read the DNA, state the tier, capture before and after with the literal command, critique, record, honesty.
- A module is named in the entry with one line: when it applies and its first command. Measured reads of the module for the task are in D21.
- Sessions and agents cooperate through the project, not through each other: all read and extend the same `.nomi/dna.md`.
- Other design tools: when another design, review or accessibility skill has produced output for the task, the entry tells the agent to cite it as evidence and not to repeat it; captures are still required.

**Entry file contract** (`SKILL.md`)
- Frontmatter: `name: nomi`; `description` ≤400 characters with the trigger phrase first; optional `license`, `compatibility`, `metadata` with string values only (`version`). No host-specific keys.
- Body order: (1) what it is and the exit ramp: if the task changes nothing a person sees or reads, stop; (2) the numbered steps of every task; (3) tiers and the direction note; (4) module map; (5) scripts; (6) other design tools; (7) honesty rules.
- Paths are relative to the skill directory. Scripts run as `node <skill-dir>/scripts/nomi.mjs <command>`, where `<skill-dir>` is the folder containing SKILL.md. No `${CLAUDE_SKILL_DIR}`, `$ARGUMENTS` or host tool names; host-neutral verbs only.

**Domain module contract.** `modules/<domain>.md` opens with one paragraph (and, when the domain has steps beyond the entry's, a numbered list), then exactly these sections, in this order:

| Section | Contains | Must not contain |
|---|---|---|
| Decide | Fields the direction must fix for this domain | Explanations of why they matter |
| Traps | Current model defaults, phrased as questions | Bans, style catalogs |
| Instrument | What to add to the build so it can be observed or tuned | Framework tutorials |
| Observe | Commands to run and which artifacts to open | Tool internals |
| Critique lenses | Questions answered with evidence from a run | Generic checklists |
| Moves | Non-obvious, high-leverage refinements | Things any model already does |

**Stage module contract.** `modules/<stage>.md` (plan, review, readme, brandvid) has exactly these sections, in this order. Each stage ends at a file a script can check, so the next stage never starts from a claim.

| Section | Contains |
|---|---|
| Inputs | The files and runs the stage reads, and what to do when one is missing |
| Steps | Numbered actions, each with its command when one exists |
| Outputs | The files the stage writes and the check that must pass on them |
| Stop | When the stage is done, when it hands back to an earlier stage, and its round budget |

**Stage commands.** Explicit commands (`/nomi-plan` and the like) are host adapters, not skill text. On Claude Code a command is one more listed entry; D21 records what four of them cost. None ship in Phase 5: the stages do not exist yet.

**CLI** (`nomi` below means `node <skill-dir>/scripts/nomi.mjs`). All commands print compact text (≤60 lines), accept `--json`, and exit 0 ok / 1 findings / 2 error.

| Command | Purpose |
|---|---|
| `plan init --type <id> \| check` | Create and lint `.nomi/plan.md`. `init` needs the product type and prints the jobs that type cannot ship without and what its reviewer asks; `check` lints structure (every flow ends in an expect and names a listed screen) and lists type jobs no flow covers |
| `dna init \| check \| show [--for <domain>]` | Create, lint and slice Project DNA |
| `critique pack [--task …] [--evidence …] [--run <id>] [--domain …]` | Write a self-contained critic brief; `--domain` reads the lenses of `modules/<domain>.md` |
| `doctor` | Check Node, browser, project state; lists the domain modules found |
| `observe <url\|file\|dir> [flags]` | Capture and measure; writes a run |
| `observe <target> --motion [--interact <file>]` | Animation inventory, replayed load and interaction frames, reduced-motion comparison; writes a `motion` run |
| `observe <target> --flow <flows.json\|plan.md> [--live]` | Run the jobs as steps; writes a `flow` run with one sheet per flow |
| `diff <runA> <runB>` | Metric deltas and a before/after sheet; both runs of one kind |
| `review [<target>]` | Measured verdict from the latest runs and the plan (exit 1 while something blocks SHIP); writes `.nomi/proof.md` and `proof.png`. With a target it first captures it and runs the flows of the plan or of `.nomi/flows.json`: one command after the last edit |
| `brandvid <url\|file\|dir> [--out <dir>] [--storyboard <file>] [--live]` | Film the flows of `.nomi/storyboard.json` and write `demo.mp4`, `poster.png`, `preview.webp`, `sheet.png`, `video.json` to `.nomi/video/`; exit 1 when the video's own check fails |
| `brandvid check [<dir>]` | Measure an existing video again from its files |
| `readme check [file]` | Lint a README: media and local links that do not exist, anchors, commands nobody ran, a `<video>` element, claims (exit 1 when something must be fixed) |
| `readme run "<command>" [--seconds n]` | Run a command from the project and record the result in `.nomi/commands.json` |
| `probe print <web\|motion>` | Print an in-page probe for a host's own browser tool |

## 5. The creative loop

**Tiers**, chosen first and stated in one line:

| Tier | When | What runs |
|---|---|---|
| Tweak | Small change inside an existing direction: copy, one color, spacing, a tuning value, a visual bug | Respect DNA (above all Never) → change → observe → done. No plan, no flows, no review |
| Build | New component, page, section or content inside a direction; visual work where identity is not the ask | Direction note → build → observe → flows for the jobs it touches → critique → review verdict → ≤2 fix rounds → record decisions |
| Create | A new product, app or site; a redesign; "make it distinctive / less generic"; no DNA and the work defines the look | Plan → direction protocol with 2–3 options → DNA → build → observe → flows → fresh-context critique → review verdict and proof card → ≤3 rounds → record |

**Steps**
1. **Load.** Read the nearest `.nomi/dna.md` and what it points to (DESIGN.md, token files). Without DNA, the existing product *is* the direction: observe it before adding to it.
1a. **Plan** (Create). Follow `modules/plan.md`: one line that reads the request (product type, who uses it, the job, the constraints), then `.nomi/plan.md` with the jobs as flows, the screens and what done means, before any interface file. At most one question to the user, only when two reads would give different products.
2. **Direct.** Read the module for the task. Build: a five-line direction note. Create: follow `references/direction.md`, pick one option, proceed, and name the alternatives in the final report so the user can redirect. The brief wins over every Nomi list.
3. **Build with observability.** Use what the capture can measure (Web Animations for motion); keep tunables in one place.
4. **Observe.** Run `nomi observe`, open the listed images, read the summary. If observation is impossible, say so and fall back to code-level evidence. Build and Create: when the page lets a person do something, run its jobs with `observe --flow` before and after the change (the plan's flows, or `.nomi/flows.json` when there is no plan). A flow that fails before the change is a defect of this task.
5. **Critique.** Follow `references/critique.md`. Create tier: hand the packet from `nomi critique pack` to a fresh-context subagent when the host has one; otherwise run the protocol as a separate pass over artifacts only.
6. **Review and fix.** Follow `modules/review.md`: `nomi review <target>` captures again, runs the flows and states what blocks SHIP, the agent opens the evidence, rules out false positives, fixes failed flows, dead clicks and S1 first, captures again, `nomi diff`, reviews again. Stop when nothing blocks and no confirmed S2 remains, the round budget is spent, or the verdict is RETHINK (back to the plan or to step 2).
7. **Record.** Append decisions with reasons to DNA.

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
Verdict: SHIP | FIX | RETHINK
1. [S1|S2|S3] problem — evidence: <image + region | metric=value | file:line> — fix — verify by
Keep: ≤3 things that work and must survive refinement
Not verified: what could not be observed
```
Severity: **S1** breaks function, access or intent (unreadable text, broken layout, dead input, motion hazard). **S2** weakens identity or coherence (unexamined default, off-DNA choice, system drift, motion without a job). **S3** polish.

**Review output** (the end of every Build and Create reply):
```
Verdict: SHIP | FIX | RETHINK
1. [S1|S2|S3] problem — evidence: <run id and sheet step | finding code = value | image and region> — fix at <file:line> — verify by <command>
Flows: <n> of <m> completed (run <id>)
Keep · Not verified · Proof: .nomi/proof.md
```

**Honesty rules** (verbatim in SKILL.md): do not describe the look, motion or feel of anything not observed this session; quote measured values instead of estimating; report failed or skipped steps; "done" for Build and Create means observed and critiqued, or explicitly marked unverified.

## 6. Creative state (in the user's project)

```
.nomi/
├── dna.md       committed: creative direction (schema v1)
├── plan.md      committed: the product read, its jobs as flows, screens, done (schema v1)
├── flows.json   optional: flows for Build work in a project without a plan
├── proof.md     the proof card of the last review, with proof.png
├── stage.json   the stage the last pipeline command belonged to
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

The section names `## Feel` and `## World` stay valid in DNA v1 although Game and World are shelved (2026-10-05): existing DNA files keep passing `dna check`.

**Plan schema v1** (`assets/plan.md`):
```
---
nomi: 1
type: booking            # an id from data/product-types.json, or other
---
## Read        one line: product type, who uses it and when, the job, the constraints   (required)
## Flows       a ```json block: 1–7 flows, the same list `observe --flow` runs           (required)
## Screens     - <name>: what happens there; its states                                  (required)
## Done        what must be true to ship, one checkable line each                        (required)
```
A flow is `{name, screen, covers?, start?, steps}`; a step is `{do, name | target, …}` (§7). `plan check` requires every flow to end with an `expect` and to name a screen listed under Screens. `data/product-types.json` holds ten product types, each with the jobs such a product cannot ship without and the questions a reviewer asks; it never says how anything looks. The type's jobs that no flow `covers` are printed as a prompt, not as a finding.

**Stage file.** Every pipeline command writes `.nomi/stage.json` (`{nomi, stage, command, at}`) when `.nomi/` exists: `plan` → plan, `dna` → design, `observe` and `diff` → measure, `critique` and `review` → review. No command builds, so there is no build event. Nothing reads the file yet (Phase 8 will).

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
| Time | Web, 2 viewports ≤15 s; motion ≤30 s; a flow of five steps about 2 s. Every wait is bounded, and the CLI stops any command after 240 s with exit 2, so a host never waits on Nomi forever (seen once: a browser inside a host sandbox that neither answered nor died) |
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
- A launcher may hand over to another process and exit with code 0 (Edge 154 on Windows): that is not a failed launch, and such a browser is closed through `Browser.close` because no process tree is left to kill.
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

Phase 6 flow playtest (`observe --flow`, `lib/flow.mjs`):
- **Input.** A JSON list of 1–7 flows, or a plan whose `## Flows` section holds that list. A flow has a `name`, 1–12 `steps`, and optionally `screen`, `covers` and `start` (a page path on the target, never another site). One viewport per run (default 1440×900).
- **Steps.** `click`, `type` (`text`), `select` (`value`), `press-key` (`key`), `hover`, `focus`, `scroll`, `wait` (`ms`), `expect`. A control is found by `name` (its visible label, placeholder, accessible name or button text; exact match before partial; an option of a closed list counts for `click`) or by `target` (a CSS selector). `expect` waits up to 2 s (`ms` up to 5 s) for `text` on the page or in a control, for text to be gone (`state: hidden`), for a control's `state` (visible, hidden, enabled, disabled, checked, unchecked), or for `url`.
- **How it acts.** Real pointer and key events through the browser's input domain; text is typed into the selected field; pickers (date, time, range, colour) and lists are set directly with `input` and `change` events. Browser dialogs are accepted and their text counts as shown.
- **Per flow.** Completed, or the step it stopped at with the reason; time; console errors and uncaught exceptions; failed requests (status ≥400 or a network error, a missing favicon ignored); dead clicks; a screenshot after every step, composed into one sheet (`flow-<n>.png`, failed flows listed first).
- **Dead click** (D25). A click after which the document, the address, form values and the scroll position are unchanged, no request started and no dialog opened, for 600 ms and until no timer of up to 3 s that the page set is pending. Clicks into fields are never dead. An effect that is only drawn on a canvas, played as sound or put on the clipboard is not seen, and the report says so.
- **Findings.** `flow.failed` and `flow.dead-click` (S1); `flow.console-error` and `flow.failed-request` (S2).
- **Safety** (D26). A flow acts for real. It runs only on a local target (a file, a folder, a loopback URL); another URL needs `--live`, which the skill allows only when the user named that URL and asked. On a local target, any request other than GET, HEAD or OPTIONS to a non-loopback host is refused before it is sent and listed in the notes. Every flow starts from a clean visit: cookies, local and session storage of the origin are cleared.
- **Diff.** `diff` of two flow runs reports flows completed, each flow whose status changed, and the finding counts.

Phase 7 demo video (`brandvid`, `lib/record.mjs`, `probes/stage.js`). There are two kinds. **The trailer** (`brandvid compose <file.html>`, D40) is what the stage makes by default: the agent writes one page of 1920x1080 in which the product's own controls, colours and words are animated beat by beat (`<html data-duration>`, `data-poster`, `data-tone`; motion in CSS animations, `element.animate` and `window.nomiVideo.start()`; sound cues in `nomiVideo.cues`), and the script renders it under the page's clock (D38) at 30 frames a second, one screenshot of the whole page a frame, makes the sound around the cues in the character the page asks for (`nomiVideo.music`: warm, cafe, cinema or pulse, with a tempo and a key), encodes and checks it (length, black, nothing motionless over 4 s, script errors, a picture of the real product in it, decoded frames against rendered ones, sound). It renders at 60 frames a second (30 with `data-fps="30"`), about three minutes for 22 s. The pictures of the real product are the ones a flow run leaves after every step. **The recording** is the product itself, filmed while its flows are replayed; the rest of this section describes it:
- **Input.** The flows (the plan's, or `.nomi/flows.json`) and `.nomi/storyboard.json`: `hook` (at most 60 characters), an optional `problem` (at most 80), one to three `scenes` (each a flow by name and one `caption`; exactly one marks its `wow` step), `cta`, and an optional `tone` (`calm`, `default`, `punchy`). Without a tone, the plan's product type gives it (`tone` in `data/product-types.json`: a till is punchy, a dashboard calm). The script validates the storyboard against the flows and refuses, before a browser starts, one whose scenes cannot fit in 30 s at the fastest pace.
- **Filming.** Each scene's flow is replayed for real by the flow engine (the same `visit` and `perform`) in a 1440x810 view. **The page is filmed under its own clock, held by the recorder** (`lib/clock.mjs`, D38). A script that runs before the page's own takes over its time: `Date`, `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, and, through the animations interface, CSS animations and transitions, `element.animate` and SVG animation. The page loads in real time; then the clock is held and moves only when the recorder says so, 1/60 s at a time, and after a step that can have changed the picture a screenshot is taken (one and a half device pixels a CSS pixel, so close shots are sharp). Every filmed frame is therefore the page at an exact time, whatever the machine was doing: the same storyboard gives the same length on every run (21.9 s on the fixture). The flow engine waits on that clock too, so a pause of 0.4 s is 24 frames. A step is one task for the browser, so the page is painted once per step; the clock says whether a step can have changed anything (a callback ran, an animation is placed, the document changed or scrolled, something was done from outside, or one of those in the two steps before), and a step that cannot have is not photographed; a picture equal to the one before is not kept. **The video plays in the product's own time:** nothing filmed is cut, sped up or reordered, so a clock, a timer or a progress bar in the product runs evenly. Before a step, the place it acts on is brought to the middle of the view with an eased scroll (the engine's own scroll is instant: a jump on film); the pointer takes 0.4 s to a target; text is typed at 50 ms a character. When the page's content is a narrow column, the page is filmed enlarged by the browser's own zoom (at most 1.4). A step that fails, or a click that changes nothing, ends the scene: that flow is not in the video and is reported (`video.flow-failed`). With no completed flow nothing is written. Not under the clock, and so too fast on film: animated images, `<video>`, the browser's own smooth scrolling, anything timed by a server. The caret of a text field is kept from blinking (`caret-animation: manual`).
- **Pacing.** The length is set before and while filming, never afterwards. A tone has a length (punchy 21 s, default 23 s, calm 25 s). From the storyboard the script estimates what each step takes (measured: a click 0.63 s with the pointer's way, a typed character 40 ms, an `expect` 0.15 to 0.4 s) and gives each scene its share; while a scene is filmed, the pause after each step (0.1 to 0.45 s, an `expect` 0.6 of it) is sized from the time the scene has left; a scene opens for 0.9 s before its first step and closes 0.35 s after its last and what the steps still to come need. Two rules keep short flows watchable: a scene lasts at least as long as its caption takes to come in, be read and leave, and flows with so few steps that the video would end under 21 s get pauses of up to a second (what a step saw can then be read; the camera moves through the pause). Recordings of the fixture come out at 21.9 s for a target of 23, the same every time. The wow step holds 0.45 s. A storyboard that cannot fit in 30 s at the shortest pauses is refused before a browser starts.
- **Picture.** 1920x1080 at 60 frames a second, every frame a function of its time, drawn on a blank page from the recorder's own loopback server (an encoder exists only in a secure context, and nothing is drawn inside the product's page). The ground is the product's background with two slow lights in its accent colour. The product sits in a window with a title bar (its title; on the right a "✓ text" chip for what the last `expect` step saw). The caption is above the window, so it covers nothing: set word by word, then held for its reading time (0.3 s a word, at least 1.2 s). Above it one bar a scene fills as the scene plays. Nothing is drawn around what a step saw: the title bar says it, and the page is scrolled so it is in view.
  - **The camera holds** (D39). A scene has one framing: everything the scene acts on and looks at, with a sixth of the view as air on every side, at most 1.35 times. When that is clearly closer than the whole page (1.1 times or more) the camera goes there once, as the scene opens and before anything is done, in one move of 1.2 s eased in and out, and stays; otherwise it does not move at all. It follows nothing, never goes out and in again, and has no drift. A scene opens for 0.9 s before its first step, so the first click lands as the camera settles. *The pointer* leaves for the next target in good time, slowly at first (a least-jerk curve on a slight arc), arrives, rests on the control for 0.18 s and then clicks (a click on arrival reads as a machine, a longer rest as hesitation), and rests when it has nowhere to go; its arc bends one way, then the other. A click presses the pointer in for 0.16 s and leaves two thin rings that open and fade over 0.65 s, the second 0.09 s after the first. The pause after a step varies by up to 18% from step to step, so no two are quite the same length. Captions do not all arrive the same way: the first scene's rises in word by word, the second's slides in, the third's grows in. The window arrives first and what is in it a moment later. The page is scrolled only when a place is not comfortably in view (outside the middle four fifths of its height). The place of an expected text is the text itself (its range), not the block that holds it.
  - **No change happens in one frame** (D36). A jump of the page is dissolved in over 0.22 s, on top of the picture before it: what an action brings up (the first paint after a click or a key and whatever follows in that time, such as an image that arrives), and a change that stands alone (a clock that ticks). A run of paints that nothing was done to start is a movement the page itself animates and is shown as filmed. From one scene to the next the page slides inside the same window in 0.6 s, softened while it moves fast. One picture hands over to the next while both are on screen: the window rises in under the hook as its line leaves, growing from 95% of its size, and the outro is set over the window as it goes (0.3 s each way).
  - Cards: the hook (under 3 s), the optional problem line, and the outro (the product's name, the `cta` in a pill, "Filmed from the running product · n of n flows passed"). Type and colours are the product's: body and heading font families and background, text and accent colours from computed styles, made safe to read (4.5:1 for text); `@font-face` files of those families are fetched from the product page and loaded into the stage. Frame 0 is the poster, the settled wow moment, so a page shows it before the video plays.
- **Sound.** Written for each video's own timeline and rendered offline by the browser's audio engine: a bed of four chords in one key (a pad, a plucked figure with an echo, a pulse that joins when the product appears) and effects in that key where things happen in the picture (a click, a tick per typed character, two notes when a step saw what it expected, a short figure on the wow step, a sweep at a scene change, a chord under the outro), brought to one level (peak 0.89). Tempo and key follow the tone. No audio file is shipped or used.
- **Encoding.** The browser's own encoders (WebCodecs): H.264 baseline level 4.2 in software (level 4.2 carries 1080p at 60 frames a second), a key frame every two seconds, at the bitrate a file of under 10 MB allows for its length (3.3 Mbit/s at 22 s), never under 3 and never over 6 Mbit/s; sound as AAC where the browser has that encoder (Edge and Chrome on Windows) and as Opus where it has not (chrome-headless-shell on Linux). The MP4 is written by the stage script: a video and an audio track, each in one chunk, the index before the data. The preview is an animated WebP assembled from stills the browser encodes (640x360, the scenes at 1.5 times speed or more, equal frames merged). No `ffmpeg`.
- **Output** (`.nomi/video/`, or `--out`; `--no-sound` leaves the sound out): `demo.mp4`, `poster.png`, `preview.webp`, `sheet.png` (eight moments with their times, for a reader that cannot play a video) and `video.json` (scenes with start and end, cards, captions with their rectangles, the sound's codec and level, findings). About a minute for a 22 s video.
- **Check** (run by the same command on the finished file, and again by `brandvid check`). Three sources, each for what only it can tell.
  - *The player.* The file is played in a `<video>` element and sampled five times a second: mean brightness of the picture, and mean change inside the product's window from the sample before; its sound track is decoded from the same file. A sample is taken when the frame of its time is presented (asked for before the seek): drawn at "seeked", the picture can still be the one of the seek before (measured on a 1080p 60 fps file; `dev/evals/spikes/seek60.mjs`).
  - *The encoded frames.* Every frame of the file is decoded again in order (WebCodecs), and four times a second the decoded picture is compared with the picture drawn for that frame, block by block (30x30 of 480x270): `fidelity.worst` in `video.json` is the largest mean difference of one block, of 255. Measured on the fixture: 1 (median) and 6 to 10 at the fastest move; the same file against the picture of a quarter second earlier, which is what a stall measures, 32 to 40 (median).
  - *The recording.* The picture cannot always tell a product that does nothing: the pointer or the camera may be moving over it. The recording knows: the longest time in a scene in which the page was not repainted and no step began, acted or saw anything (`still` on each scene).
  - Findings: `video.duration` (outside 20 to 30 s; above 25.5 s a note, S2, that 20 to 25 is the length to aim for), `video.resolution` (below 1280x720), `video.black` (brightness under 12 of 255 for more than 2 s), `video.frozen` (nothing happens in the product for more than 2 s, from the recording; or the product's window unchanged for more than 2 s, from the player), `video.encode` (a block of the file differs from what was composed by more than 14: an older picture was left standing), `video.flow-missing` (a storyboard flow that is not a completed scene, or whose stretch never changes), `video.caption-contrast` (under 4.5:1, measured from the pixels where the caption sits), `video.caption-time` (shorter than its reading time), `video.sound` (made with sound, and no track the browser can play, a silent one, or one whose length differs from the picture's; clipping is S2), `video.files` (the video, poster or preview missing, or a preview that is not animated), `video.encoder` (the browser cannot encode H.264: poster, sheet and preview are still written); `video.size` above 10 MB is S2.
- **Motion is measured in development** with `dev/tools/frames.mjs`, which looks at any video frame by frame in the headless browser: the share of still frames, the longest still stretch, pops (a jump between two still frames), and how long a movement lasts (the run a moving frame typically belongs to). Five reference launch videos made with `brag`: 0 pops, 53 to 82% still frames, a movement of 0.27 to 0.53 s. A test holds the fixture video to at most one pop, 40 to 85% still frames, no still stretch over 2.2 s and a movement of 0.27 s or more (measured: 0 pops, 71% still, 0.57 s; Nomi's own demo 0 pops, 60%, 0.77 s).
- **Safety.** The same rule as a flow run: local targets only, `--live` for a URL the user named, requests that would change data on another site refused.

Phase 7 README check (`readme check`, `readme run`, `lib/readme.mjs`):
- `readme run "<command>"` runs the command through the shell from the project folder and appends `{command, ok, exit, alive, seconds, at}` to `.nomi/commands.json` (the last 50). A command still running after `--seconds` (default 20, at most 200) is recorded as started and its process tree is stopped.
- `readme check` reads the README and reports, with line numbers: `readme.media` (an image, video or linked media file with a local path that does not exist), `readme.link` (a local link whose file is missing, or an anchor that matches no heading by the repository site's slug rule), `readme.command` (a line of a shell block, a prompt line of a transcript, or a line of an unlabelled block under a quick-start heading, that is not in the ledger, failed there, or ran more than a day ago, and is not marked `# unverified: <why>`; `cd`, `git clone` and `mkdir` are not claims), `readme.video-tag` (see INTEGRATIONS: the element is removed where repositories are shown). These are S1 and exit 1. As questions (S2): `readme.claim` (a phrase from `data/vague-words.json` `claims`: speed, readiness, ease, looks, "fully", unsourced numbers), `readme.opening` (no title, or a first paragraph over 240 characters), `readme.demo` (nothing shown, or the first picture more than 20 lines down). External addresses are never fetched.

Non-browser targets (native apps, Godot, Unity) get judgment only in V1 and are reported as not visually verified unless the host itself can show the result.

## 8. Critique and the independent critic

Self-critique in the builder's context tends to defend its own choices. Nomi counters this twice:
1. **Evidence binding.** An issue without an artifact, a measured value or a file:line reference is not an issue. The critic says "insufficient evidence" rather than guessing.
2. **Context separation.** `nomi critique pack` writes a self-contained brief: task, DNA excerpt, Never list, run summary, image paths, the module's lens section, output format. In Create tier the builder starts a fresh-context subagent with it when the host has subagents; otherwise it runs the protocol as a separate pass over artifacts only.

Refinement never discards the Keep list, and every round ends with a new run and `nomi diff`, so improvement is measured, not claimed.

**Review** (`nomi review`, `lib/review.mjs`, D27). The script computes the measured floor of the verdict; the model does the rest.
- With a target it captures the page and runs the flows first, so one command after the last edit gives current evidence. Agents at low effort run one measuring command and stop (Phase 6 pilots); this makes that one command the whole measurement.
- It reads the latest web, motion and flow run and the plan. It lists as blocking: a failed flow; a dead click; an S1 finding; a planned flow missing from the latest flow run, or a plan with flows and no flow run; a page with form controls and no flow run; a plan that fails `plan check`; no capture of the interface; and any run older than the newest interface file of the project (the evidence describes an earlier version).
- It lists S2 findings for judgment and what no run covered under Not verified.
- It writes the proof card: `.nomi/proof.md` (flow table, interface findings before and after, motion, blocking, not verified) and `.nomi/proof.png` (before, interface, flows, motion composed in one image).
- The model opens the evidence, rules out false positives (`modules/review.md` lists the typical ones), finds file:line for each fix, and writes the verdict. SHIP is not available while a flow fails. RETHINK is only ever the model's call.

## 9. Domain modules

| Module | Decides up front | Instruments | Observes | Evidence the critique uses |
|---|---|---|---|---|
| Web | Layout concept, type roles and scale, 4–6 colors with roles, density, signature, copy voice | — | Screenshots (mobile, desktop), style census, contrast, overflow, keyboard focus pass, token drift, copy fingerprints | Images; type/palette/spacing counts; failing nodes |
| Motion | The job of each motion, timing scale, easing family, entrance order, reduced-motion strategy | Web Animations (CSS or the Web Animations API) so the capture can measure them | Animation inventory, replayed load and interaction frames as sheets, reduced-motion comparison, long frames, settle time | Durations, easings, delays, animated properties per element; frame labels; long-frame counts |

Planned domain modules: mobile (Phase 9) and 3D (Phase 10). Game and World are shelved. One Character section in the DNA governs all domains so they stay coherent; a critique pass applies at most two modules' lenses.

## 10. What "multi-agent" means in V1

1. **Any host.** The same skill folder runs on every target host (`docs/HOSTS.md` states which are verified: five of nine).
2. **Shared memory.** `.nomi/` is the contract between sessions and agents: one agent builds what another later extends and a third reviews, all under one direction.
3. **Role separation.** Builder and critic run in different contexts when the host allows.

Not in V1: autonomous director/builder pipelines, per-host agent definitions, mandatory parallel domain critics. Revisit only with eval evidence (D7).

## 11. Packaging and repository layout

Two trees (D22). The public repository shows the product and works alone; the development tree holds everything that proves it.

```
nomi/                                  public repository
├── skills/nomi/                       the skill (§4)
├── plugin.json                        Agent Plugins v1 manifest: Codex, Cursor, OpenClaw, Hermes
├── .claude-plugin/                    plugin.json + marketplace.json: Claude Code
├── gemini-extension.json              Gemini CLI extension (bundles skills/)
├── .agents/plugins/marketplace.json   Codex marketplace entry
├── adapters/hosts.json                machine-readable host table: paths, channels, headless commands, verification
├── tools/install.mjs                  the installer (project scope also writes the pointer line, D23)
├── hooks/                             Claude Code plugin adapter: session-start hook that adds the pointer line
├── docs/                              ARCHITECTURE.md (this file) · HOSTS.md
├── README.md · LICENSE · media/
└── dev/                               ignored by the public repository; a nested git repository of its own, local only
    ├── tests/                         node --test: unit tests and fixture pages
    ├── evals/                         cases/ · fixtures/ · harness/ · reports/ · results/ (ignored)
    ├── tools/                         check.mjs · verify-hosts.mjs · schemas/
    ├── docs/                          IMPLEMENTATION_PLAN.md · EVALUATION.md · INTEGRATIONS.md · PRIOR_ART.md · concepts/
    ├── prompts/
    └── package.json                   `npm run check`, `npm test`, run from dev/
```

**State of the split.** Applied 2026-10-06 in the working tree: the development files are in `dev/`, the public repository has them staged as removed and ignores `dev/`. Two folders, `evals/` and `prompts/`, were held open by another program during the move, so they were copied; the originals at the root are ignored leftovers to delete by hand. The untracking is not committed or pushed yet.

Rules:
- The public tree works alone: install and every skill feature run from a checkout that has no `dev/`. Nothing in `skills/`, `tools/install.mjs` or the manifests imports from the development tree.
- Public docs link to nothing in `dev/` and state verified hosts with version and date only.
- Every manifest names the same plugin: `check` requires name `nomi`, one version and one description across `plugin.json`, `.claude-plugin/plugin.json` and `gemini-extension.json`, validates `plugin.json` against the vendored Agent Plugins schema, and requires both marketplace files to list `nomi`.
- `adapters/hosts.json` is the machine source for host facts; the status tables in `INTEGRATIONS.md` and `docs/HOSTS.md` must repeat its status, version and date for every host, or `check` fails.
- `tools/install.mjs` copies every folder under `skills/` (one today) into the distinct folders of the chosen hosts, replaces only a folder that is the Nomi skill, and removes it with `--uninstall`. In project scope it also writes or removes the D23 line.
- `verify-hosts` is the only way a host reaches status `L`.
- No CI workflow: the tests are not in the public repository. They run locally on Windows and in WSL2 before a phase is called done.

## 12. Context budgets

| Item | Budget | Enforced by |
|---|---|---|
| Skill description | ≤400 characters per skill, trigger phrase first | `tools/check.mjs` |
| SKILL.md | ≤150 lines (about 2k tokens); 94 today | `tools/check.mjs` |
| Each reference and module file | ≤200 lines, loaded only when relevant | `tools/check.mjs` |
| Plan | ≤7 flows of ≤12 steps | `nomi plan check` |
| Templates | ≤120 lines | `tools/check.mjs` |
| CLI output | ≤60 lines by default; details go to files | tests |
| Images per observe | ≤4 opened by default; viewing copies ≤1280 px wide | tests |
| DNA | ≤150 lines, ≤20 decisions | `nomi dna check` |
| Typical load | Any task: `SKILL.md` (90 lines) plus DNA, `modules/web.md` (48 lines) and one run; with motion, plus `modules/motion.md` (66 lines) and one or two sheets. Build: plus `modules/review.md` (44 lines) and a flow sheet per job. Create: plus `modules/plan.md` (36 lines), direction and critique. Present, when asked: `modules/readme.md` (41 lines), `modules/brandvid.md` (48 lines), one sheet and one poster | token-overhead evals |

## 13. Non-goals and duplication boundaries

Nomi must not contain:
- Explanations of design, color, typography, animation or 3D principles.
- Framework or API tutorials (Tailwind, GSAP/Motion, Three.js, React Three Fiber).
- Restated accessibility rules. Nomi measures contrast, focus visibility, reduced motion and target sizes instead.
- Style catalogs, palette or font libraries, prompt collections.
- Large anti-pattern rule sets. Static web detection already exists (Anthropic's `frontend-design` skill; Impeccable's detector). Nomi keeps ≤25 dated fingerprints per domain, phrased as questions, and treats other tools' output as evidence when a project already uses them.
- Asset generation (images, models, audio). Nomi directs and judges their use.

V1 non-goals: hooks, an MCP server, user-level taste profiles, non-browser observation, autonomous multi-agent pipelines, a published npm CLI.

## 14. Decision record

| # | Decision | Why | Reversibility / trigger to revisit |
|---|---|---|---|
| D1 | One skill `nomi` with domain modules, replacing six skill folders | Cross-skill references are not portable (Claude Code namespaces plugin skills as `nomi:<skill>`; Hermes namespaces packaged skills as `agent-plugin-<slug>-<hash>`; skill hubs install skills one by one). Listing budgets penalize many descriptions (Codex: ≤2% of context or 8,000 characters for all skills). Every domain needs the same loop | Superseded by D14 (2026-10-01) through this reversible path. Its portability concerns remain and shape D14: no cross-skill invocation, sibling folders only |
| D2 | Agent Skills spec-pure canonical skill; host specifics only in root manifests and `adapters/hosts.json` | Seven of the nine target hosts read `.agents/skills`; all nine read SKILL.md folders (Claude Code and Kiro only from their own folder) | Easy |
| D3 | Creative state in `.nomi/` (DNA v1) | Vendor-neutral memory across sessions and agents | One-way for users: versioned schema; a migration command ships before any breaking change |
| D4 | Interop with DESIGN.md, PRODUCT.md and CSS tokens; never duplicate token values | Avoid drift and competing sources of truth | Easy |
| D5 | Node ≥22, zero-dependency CLI inside the skill | Runs wherever Node runs; no install step | Moderate; the CLI boundary isolates callers |
| D6 | Raw CDP to any Chromium-family browser; probes are portable in-page JS | Zero-install observation; host browser tools can run the same probes | Easy: the capture layer can switch to Playwright |
| D7 | Evidence-bound critique; fresh-context critic via the host's own subagents; no per-host agent files | Portable; no adapter logic | Easy: adapters may add native agent definitions |
| D8 | Tiers Tweak / Build / Create with refinement budgets 0 / 2 / 3 | Proportional effort | Easy |
| D9 | No hooks in V1 (one exception since Phase 5: the Claude Code plugin's session-start pointer, D23) | Portability; evidence first | Add an optional reminder hook for Claude Code and Codex if observe-before-claim stays below 80% after Phase 2 |
| D10 | Distribution through project/user folders plus native packages (Claude Code plugin, Agent Plugins, Gemini CLI extension); Antigravity and OpenCode through folders only | Uses each host's real mechanism | Additive |
| D11 | Automated observation only for browser-rendered targets | Web and WebGL share one engine | Future per-engine adapters |
| D12 | Evals: `claude plugin eval` for Claude Code behavior suites; the Nomi runner for cross-host outcome A/B | First-party isolation where it exists | Easy |
| D13 | `dna init` adds a one-line DNA pointer to AGENTS.md and CLAUDE.md (creating AGENTS.md if neither exists) | Phase 1 eval: skill activation alone left the DNA unread in 3/3 runs of an ordinary UI request; persistent state must not depend on a skill firing | Easy: remove the line. Its effect on agents without Nomi is verified per host in Phase 3 (INTEGRATIONS U11); revisit if hosts gain a standard way to register project state |
| D14 | *Superseded by D21 (2026-10-05).* Hybrid: shared core `skills/nomi` plus one entry skill per finished domain (`nomi-web` first; motion stays a core module, D20). The domain skill is entry and module in one file and reaches core files as the sibling folder `../nomi` | Migration eval, 27 existing-page edits, equal conditions: the hybrid observed 27/27 and read the DNA 20/27, against 21/27 and 15/27 for the best single-skill variant (same description fix, same must-do block); activation 27/27 for both. Domain steps sit in the file that loads | Reversible: fold `nomi-web/SKILL.md` back into `references/web.md`. Revisit if a host installs or renames skill folders one by one (INTEGRATIONS U12), or if listing budgets bite with five domains |
| D15 | Must-do steps live in the entry file; the core is one hop away and holds only what is sometimes needed | In 48 `nomi-web` runs no agent followed "read the core first"; in the single skill the one-hop web module was read in 5 of 36 runs. What is not in the loaded file is skipped at low effort | Easy: move lines between files. `tools/check.mjs` keeps domain skills on the six-section contract |
| D16 | Descriptions name concrete artifacts and say small edits count; the "any project with a `.nomi/` folder" trigger is dropped | Root cause of 11/27 activation: the choice is made at the first action, from the prompt's wording alone, before the agent has seen the project. Fixing the description alone raised activation from 1/8 to 8/8; medium effort did not help (0/4) | Easy: edit the description. Phase 3 trigger suite owns recall and false-trigger gates |
| D17 | `NOMI_BROWSER_NO_SANDBOX=1` starts the browser without its own sandbox, for local targets only (file, folder, loopback URL); the run report notes it. Off by default and absent from the skill text and error messages | Phase 3, Codex 0.159.3 on Windows: inside the `workspace-write` sandbox Chromium cannot create its nested sandbox (GPU process exits with access denied); of five flag sets tried only `--no-sandbox` captured. Local pages are project code the host sandbox already confines. In the verification run the Codex agent found the switch by reading `browser.mjs` and set it itself | Easy: delete the switch; Codex on Windows then has only `probe print` or "not visually verified". Revisit if agents use it outside a host sandbox, or if Codex lets a sandboxed process start Chromium |
| D18 | Motion is measured with an in-page Web Animations recorder and replayed from animation data. The CDP Animation domain and real-time frame capture are not used | The plan named CDP Animation events and sampled frames. CDP animation events carry timing but no property names, so the inventory needed the in-page API anyway; one mechanism also gives the console probe the same keys. Real-time screenshots take 50–150 ms each and jitter under load (Phase 3 saw timing tests fail on a busy machine), so a 240 ms transition would get one or two frames at unknown times. Replay gives labelled frames at exact times; all motion tests pass under a parallel test run | Easy: the capture interface is `captureMotion`. Revisit for script-driven motion (canvas, `requestAnimationFrame` libraries), which this design cannot see: Phases 5 and 6 need their own hooks for that |
| D20 | *Path updated by D21: the module is now `modules/motion.md` and there is one listing.* Motion is a module of the core (`references/motion.md`), not a third entry skill. The six-section contract applies to it (`tools/check.mjs`), and `nomi-web` and the core carry its must-do lines | Phase 4, Claude Code 2.1.289, `claude-sonnet-5-5`, low effort, two Build prompts over existing pages (n = 6–16 per layout): the Phase 3 pair of skills loaded a Nomi skill in 11/16 runs; every layout with a third listed `nomi-motion` (full, short, narrow or split descriptions, or a raised listing budget) in 4/42; the final layout (two listings, the motion module in the core) in 3/6. A core description that no longer named animation also lowered activation (1/6 without a third skill) and was reverted. The motion skill itself routed correctly on a plain motion request (7/7), so the loss is on ordinary page edits, the common case. Codex was unaffected (it reads every relevant skill). The mechanism inside the host is not identified: raising `SLASH_COMMAND_TOOL_CHAR_BUDGET` did not help | Reversible: move `references/motion.md` back into `skills/nomi-motion/SKILL.md` with frontmatter. Revisit when a host update changes activation with three listed skills; measure it with the `trigger` suite plus two Build prompts before adding any new domain skill (3D, game, world) |
| D19 | One viewport per motion run; the pointer is parked between pointer steps | Two passes (normal, reduced) and replay already cost about 10 s per viewport. Without parking, the previous element's return transition was attributed to the next step | Easy. A hover menu that must stay open while a child is clicked needs `click` steps, or a future `keep` option |
| D21 | One listed skill, `nomi`, with domain and stage modules as files in `skills/nomi/modules/`. `nomi-web` is folded into `modules/web.md`; supersedes D14 and the two-listing part of D20. Parts are asked for by name through the entry ("nomi-web", "nomi-motion"), not through extra listings. No stage commands ship | User decision 2026-10-06: the layout is the implementer's call, as long as asking for interface work runs Nomi and a named part can be run alone. Listing count does not decide activation: Claude Code 2.1.289, low effort, nine prompts over existing pages, three runs, neutral workspace paths: one skill 15/27, the two-skill control 18/27 (three runs apart, noise). What decides it is D23. One folder is kept because nothing then depends on sibling folders, the installer and check are simpler, and Codex reads it correctly (9/9, 2/15 unrelated). Module for the task opened in 6/6 full runs once the entry step named the file | Reversible: move `modules/web.md` back to `skills/nomi-web/SKILL.md` with frontmatter and restore the sibling checks. A first measurement that favoured one skill (26/27 against 22/27) is void: the eval workspace path contained "nomi" |
| D22 | Public repository and development tree are separate. `dev/` is a nested git repository made by cloning this one without a checkout, so paths inside `dev/` equal the old root paths and file history follows; the public repository ignores `dev/` and untracks the moved paths | User decision 2026-10-05: GitHub shows the product only. A clone keeps `git log -- tests/…` working in `dev/` with no history rewrite; it costs one copy of the 1.6 MB object store | Reversible until pushed: move the folders back and `git add` them. After a push the files are gone from the tip of GitHub, never from its old commits; erasing those needs a history rewrite, which is a separate, explicit decision. Applied in the working tree 2026-10-06, not committed (see §11) |
| D23 | A project install writes one line into the instruction file the host always reads (`CLAUDE.md` for Claude Code, `AGENTS.md` for the others): interface work in this project uses the nomi skill, load it before reading or editing files. Marked `<!-- nomi -->`, written once, removed by `--uninstall` | Activation by description alone is the product's weakest point: about 55–65% of page edits and 0/6 Build requests on Claude Code. With the line, same prompts, same session, neutral paths, project install: Claude Code **27/27** existing-page runs and **0/15** unrelated prompts; Codex 9/9 and 0/15 (one run per prompt). Without it: 15/27 and 0/15; Codex 9/9 and 2/15. Same mechanism as D13 (the DNA pointer) | Easy: delete the line. The Claude Code plugin carries the same line through a session-start hook (`hooks/hooks.json`, `hooks/pointer.mjs`; an adapter outside `skills/`, which reverses D9 for this one hook): plugin install, same prompts, **27/27** and **0/15**. Limits: a user-scope folder install and plugin channels on other hosts get neither and still rely on the description (15/27 on Claude Code). It edits a file the user owns, one line, and says so in the README. Revisit if hosts gain a standard way for a skill to register itself for a project |
| D24 | The product's jobs are written once, as runnable flows: a JSON list under `## Flows` of `.nomi/plan.md` (Create), or `.nomi/flows.json` (Build without a plan). `observe --flow`, `review` and, later, the demo video read that one list. Controls are found by visible name first, CSS second | A plan the scripts cannot run is a document. Flows are written before the interface exists, so they name what a person sees (a label, a button text), not selectors that do not exist yet. Phase 6 pilots: agents wrote flows by name without being shown more than one example line | Easy: the format is `parseFlows`. Revisit if flows need data setup, several users or waits on a real backend |
| D25 | A dead click is defined without pixels: no DOM mutation, no change of address, form values or scroll position, no request, no dialog, for 600 ms and until no timer of up to 3 s set by the page is pending. `setTimeout` is wrapped in the page for this | A handler that answers after 900 ms is not dead (fixture `flow-census`, "Slow save"); a pixel comparison would call every click on a page with a looping animation alive and cost a screenshot per click | Easy: `rest()` in `lib/flow.mjs`. Known blind spot, stated in every report: effects drawn only on a canvas, sound, clipboard. Add a pixel comparison when a canvas domain (3D) needs flows |
| D26 | A flow acts for real, so it is confined: local targets only (file, folder, loopback URL); `--live` for another URL, which the skill allows only when the user named that URL and asked; on a local target a non-GET request to another host is refused before it is sent; every flow starts with cookies and storage cleared | Review focus 7 and R18: a playtest submits forms and presses buy buttons. The refusal is tested without touching the network (a POST to an `.invalid` host is failed in the browser) | Easy to loosen, deliberately not loosened. Revisit if projects need a staging backend: that is a user decision per project, not a default |
| D27 | Review is split: the script computes what blocks SHIP from the latest runs and the plan, and writes the proof card; the model opens the evidence, rules out false positives, places each fix at file:line and writes the verdict. `review <target>` also captures and runs the flows first. Evidence older than the newest interface file blocks. The verdict words are SHIP, FIX, RETHINK everywhere (the critique's REFINE is renamed) | "The review verdict must be reproducible from the runs it cites." Pilots at low effort: with the review one file away it ran in 0 of 2 runs; with the command in the entry, 2 of 4; as one command that also measures, with the verdict block tied to it, in 18 of 18 Build runs and 9 of 9 Create runs. An agent wrote "Verdict: FIX, the review hasn't run" and stopped: the block alone is an exit, the command is not | Easy: `lib/review.mjs`. The staleness check walks at most 4,000 entries and 6 levels; a monorepo needs the run's own target instead |
| D28 | `.nomi/stage.json` is written by the pipeline commands themselves (plan, dna, observe, diff, critique, review), only inside an existing `.nomi/` | Stage events must be real: a command that ran is one. There is no build event, because no command builds; Phase 8 must infer "build" from the gap between design and measure, or add a hook adapter | Easy: one function in `nomi.mjs` |
| D29 | `data/product-types.json` stays: ten product types, each with the jobs it cannot ship without and a reviewer's questions; `plan init` needs the type and prints them | Measured once, with and without the data (three product briefs, three runs each, Claude Code 2.1.289): the outcome was the same (harness flows 27/27 both ways), the plan was not. With the data the booking brief got a "cancel a booking" flow in 3 of 3 runs and it was built and tested; without it, in 0 of 3. No difference on the till and sign-up briefs. Median cost per run 0.32–0.41 against 0.23–0.32 dollars | Easy: empty the `types` list and `plan init --type other` still works. Delete it at the release audit if a blinded comparison shows no preference for the plans it shapes; it must never grow styles, palettes or layouts |
| D30 | Kiro is the ninth target host, installed to `.kiro/skills` (project and user). The host table also carries what a host needs around a run: `prepare` and `cleanup` commands (Hermes trusts a project before it loads its skills), `userWindows` (Hermes keeps its home in `%LOCALAPPDATA%\hermes` on Windows) and a `note`. Host verification passes on activation plus a Nomi script run, where a capture written by the script counts like `doctor` output | User decision 2026-10-08 (Kiro was installed and signed in on the dev machine; a fifth verifiable host was needed). Its docs name `.kiro/skills` and `~/.kiro/skills` only, so it cannot share `.agents/skills`. Phase 3 completion, 2026-10-07 UTC: Cursor, Antigravity and Hermes verified with nothing host-specific inside `skills/`; Hermes failed until the project was trusted and its first terminal command of a session printed only `stdin is not a tty`, which hid `doctor` while `observe` ran and captured | Easy: delete the `kiro` entry and the installer stops writing `.kiro/skills`. Kiro stays `D` until an agent run is made (every Kiro model bills credits). Revisit `userWindows` if Hermes moves its Windows home |
| D31 | Closing the browser never depends on being able to kill it. On Windows `taskkill /T` still goes first while the launcher is alive (it finds the children); when it is refused, the browser is asked to close over the protocol. The temp profile is then removed in a bounded loop (30 passes, 300 ms apart, about 9 s, no nested retries); what is left is reported as a warning | Phase 3, Codex 0.159.3 on Windows, 2026-10-08: inside its sandbox `taskkill` answers "Access denied". The browser of every capture lived until the Codex session ended and kept its profile locked; `fs.rm` with `maxRetries` retries at every folder level, so the cleanup ran for minutes. One capture was still inside it after 60 s, and `review <target>` (two captures) hit the 240 s command limit in both attempts of a pilot run, with no proof card. After the change the same sequence inside Codex (capture, three flows, review, proof image) takes 8 s and leaves no profile. With a file four folders deep locked by another process, the old close was still running after 45 s; the new one returns in about 10 s (`tests/browser.test.mjs`) | Easy: `close()` in `lib/browser.mjs`. Revisit the order if a browser is found to leave child processes behind after a refused kill |
| D32 | The demo video is encoded by the browser itself: WebCodecs H.264 and sound (AAC, or Opus where the browser has no AAC encoder) into an MP4 written by the stage script, and an animated WebP preview assembled from the browser's own stills. No `ffmpeg` path, no WebM fallback. *Updated 2026-10-08: the first version had no sound and was 1280x720; the user asked for sound and a sharp picture* | Spike on both platforms (INTEGRATIONS, Phase 7 findings): neither machine has `ffmpeg`; headless Edge 154 on Windows and chrome-headless-shell 154 on Linux both encode H.264 in software from a loopback page and play the result. H.264 MP4 is what the repository site recommends for uploads and what plays everywhere; a second container would be code nothing here can test. The fixture video: 30 s at 1920x1080 with sound, about 5 MB, made in 30 to 40 s on both platforms. The sound is synthesised per video: the music that ships with the `brag` skill has no stated licence, and a synthesised bed needs no file at all | Easy: `render`, `score` and `mp4` in `probes/stage.js`. A Chromium build without the H.264 encoder writes poster, sheet and preview and reports `video.encoder`; add a WebM writer if such browsers turn out to be common. Opus in MP4 plays in current Chrome, Edge, Firefox and Safari, not in older players: encode on Windows or macOS when AAC matters. A user-supplied track is not supported |
| D33 | The video is a recording of a flow run, composed afterwards on a separate page. The plan said captions and cards are "drawn in the page layer"; they are drawn on the stage page instead, in the product's measured fonts and colours | Anything injected into the product's page changes what is being filmed and can break the flow (the dead-click detector counts DOM changes; an overlay can take a click). Filming in real time with the screencast keeps whatever the product really does between steps; drawing on the stage keeps the evidence untouched and makes "only flows that completed are shown" true by construction, since a scene exists only if its flow completed while it was filmed | Easy: `film` and `produce` in `lib/record.mjs`. Two things are put into the filmed page, neither visible as an element: the browser's zoom on the root element when the content is a narrow column, and an eased scroll before a step. Limits: a screencast frame has the view's size whatever the device scale factor, so the product is filmed at 1440x810 and shown at 95% of that; a product font is used only when its `@font-face` file can be fetched from the page |
| D34 | A README's commands are verified through a ledger: `readme run` executes a command and records the result; `readme check` accepts a command only from that ledger (succeeded, less than a day old) or with a visible `# unverified: <why>` | "Every quick-start command was executed in this session" cannot be read from a README or taken from an agent's word (Phase 6: outcome is what the harness measures, never the report). The ledger is the smallest record a script can check. A server that keeps running is the common case, so "still alive after n seconds" counts as started | Easy: `lib/readme.mjs`. The ledger says a command exited 0 or stayed up, not that the product then worked; that is the flows' job. A day is an arbitrary freshness window |
| D35 | Present does not run by itself at the end of every Create task. The entry routes a request for only a README or only a video to its stage, and the two modules are listed with the others; a delivery is presented when the user asks for that | A video costs about a minute and a README several turns; Phase 6 already measured Create overhead at +5% to +55% tokens with the gates for Tweak and Build exceeded. Phase 7's acceptance criteria measure the standalone requests. The product direction draws present as the last stage of the pipeline: making it automatic is one line in the Create row of the tier table | Easy, and the user's call: add "then present: `modules/readme.md`" to the Create tier and rerun `pipeline-golden` for the overhead |
| D41 | Present is the last step of a Create delivery, after asking: on a SHIP verdict the agent asks the user in one line whether to present it, and makes the README and the trailer only on a yes. Replaces D35 | User decision of 2026-10-08 ("automatic for a new product, but ask the user before creating"). A trailer costs about five minutes and a README several turns, so it is offered, not imposed | Easy: one clause in the Create row of `SKILL.md`. Not measured: how often agents ask, and whether they wait for the answer |
| D36 | No change is shown in one frame, and the video plays in the product's own time. A change of the page that stands alone is dissolved in, scrolling is eased, scenes slide inside one window, frames carry the browser's own presentation time, and the length is reached by sizing the pauses while filming, never by cutting what was filmed | User review of 2026-10-08: three drafts were "stiff, slow, with stalls", and the bar was the videos of the `brag` skill. Measured with `dev/tools/frames.mjs` on five `brag` videos and on the drafts: `brag` has 0 pops and a change lasts 0.10 to 0.23 s (median); the third draft had 4 pops and a median of 0.03 s, one frame, because it played back in real time whatever the machine did and showed every state change of the page as a cut. After this decision: 0 pops beyond the poster frame and a median of 0.13 s. `brag` is no more in motion than the drafts were (53 to 82% still frames against 66%): the difference is that every change takes several frames. A fourth draft cut the stretches where nothing happened and placed its pauses afterwards; the user saw the product's countdown run unevenly ("time does not pass smoothly"), found the coloured frame around what a step saw unnatural and the pace too slow, and asked for 20 to 25 s. So nothing filmed is cut any more, the frame is gone, the pointer and typing are faster, and the pauses adapt while filming: 23.2 s, 0 pops, 0.13 s | Easy: `pace`, `film` and the `soft` flag in `lib/record.mjs`, `page` in `probes/stage.js`. A dissolve is presentation, not a state the product was in; it lasts at most 0.22 s. Filming in real time means a loaded machine films a slower product. Not done: filming under a virtual clock, frame by frame (the mechanism of timesnap and of `brag`'s renderer). It would remove the dependence on the machine's speed while filming; take it up if videos filmed on a loaded machine stutter |
| D37 | The picture never stands still: 60 frames a second, a pointer that never parks, a camera that goes close, follows with inertia, leads the action and keeps closing in while it holds, and pictures that hand over to each other while both are on screen. What a video shows is checked three ways: by the player, by decoding every frame of the file against what was composed, and, for a product that does nothing, from the recording | User review of 2026-10-08, the fifth: "smoother: continuous effects, frames changing the way a film does; after a button is pressed time stalls and waits for the zoom before it runs; it is stiff". In the draft the user saw, the pointer rested on each target, the camera moved only when a target left the view (1.18 at most) and began its move after a step had been verified, a second after the click; 57% of frames were still. Now 16% are, the longest still stretch is 0.9 s, and a moving frame is part of a run of 17 s. While building this the measuring tool said the encoder dropped frames for up to 2 s. It did not: decoding the file frame by frame showed every frame faithful, and the tool had drawn the picture at "seeked", which is one seek behind. So the seek now waits for the presented frame, and the comparison of decoded against composed frames is part of the check (`video.encode`), because the next stall might be real. With a camera that always moves the picture can no longer tell whether the product does nothing, so that finding now comes from the recording | Easy to tune: `pointer`, `camera` and `LAP` in `probes/stage.js`, the zoom ranges in `CLOSE`. Costs: the page is filmed at 1440x810 and shown up to 1.5 times enlarged, so close shots are a little softer than wide ones (the screencast has the size of the view whatever the scale factor); 60 frames a second take about twice the bits, 8.5 MB for 22 s against 4.1 MB. The motion numbers are no longer those of the reference videos, on purpose: those are 53 to 82% still, with movements of 0.27 to 0.53 s |
| D38 | The page is filmed under its own clock, taken over by a script and held by the recorder: one step of 1/60 s, one screenshot. The screencast in real time is gone | User review of 2026-10-08, the sixth, on draft v6: "still not smooth enough; faster, but now it jerks. More alive, more animation, continuously smooth, graceful and coordinated, not fast to cover things up, and stable. Look at brag's source". brag's own rule, in its slim skill: "every frame must be a pure function of time". Draft v6 was one only on the stage: the page under it was filmed in real time, its frames arriving when the machine got to them, so a scroll or a transition of the page was sampled unevenly while the camera over it moved evenly, and a busy machine filmed a slower product (a recording made while other tests ran came out at 30.3 s, outside the limit). Tried first, and not usable: the browser's own virtual clock (`Emulation.setVirtualTimePolicy`); in new headless a screenshot stops answering after 12 to 18 frames while that clock is paused (`dev/evals/spikes/vtime.mjs`, `vtime-shot.mjs`). A clock taken over inside the page follows exactly (`jsclock.mjs`: 16.667 ms a frame; a CSS animation, a frame-callback loop and a transition started by a click 0 px from where the clock puts them; `transitionend` 1000 ms after the click for a transition of one second; 25 of 25 interval ticks; a chain of four timers awaited one after another done at 100 ms for 50 + 0 + 0 + 50) | Moderate: `lib/clock.mjs`, `filmClock` and `film` in `lib/record.mjs`, the `clock` parameter of `perform` in `lib/flow.mjs` (a flow run outside a recording still uses the machine's clock). Costs: a recording takes about a minute where it took 46 s (a screenshot at this size costs about 80 ms); what is not under the clock runs too fast on film (animated images, video, native smooth scrolling); a step is one task, so a page that needs a real task of its own between two timers (a message channel) gets it a step late; by construction, not measured. The method is that of timesnap and timeweb (PRIOR_ART P11) |
| D39 | The camera holds. One framing a scene, reached in one eased move as the scene opens, or no move at all; no following, no going out and in, no drift. This takes back the moving camera of D37; its 60 frames a second, its pointer and its hand-overs stay | User review of 2026-10-09, the seventh, on draft v7: "the frame moving and zooming in and out is unpleasant. Take brag as the reference for a short demo that is beautiful and smooth, and OpenMontage for making video". In v7 the camera had up to six targets in an eight-second scene, followed the pointer, kept closing in and answered every click. Read for this: the Hyperframes animation rules that OpenMontage carries (the renderer `brag` uses): a product demo has one or two camera moves a scene; a move takes 1 to 2 s, eased in and out, without overshoot (under 0.8 s it reads as a jump, over 2.5 s it drags); the viewer gets 0.5 to 1.5 s to see the picture first and at least a second of hold after; the camera is static at the payoff. Measured after: the fixture video has 71% still frames and movements of 0.57 s, where the five `brag` videos have 53 to 82% and 0.27 to 0.53 s; v7 had 15% | Easy: `camera`, `START` and `MOVE` in `probes/stage.js`, `OPEN` in `lib/record.mjs`. Costs: a scene whose steps are spread over the page gets no close shot at all, so small text stays small; each scene opens half a second later than it did. Not done: a second move to the storyboard's moment, which the same rules allow |
| D40 | The demo video is by default a trailer the agent composes (one animated page built from the product's own interface, rendered by Nomi), not a recording of the flows. The recording stays as a second kind, for when a recording is asked for | User decision of 2026-10-09 after nine drafts of the recording: "compose it the way brag does, its code may be used; it is mainly to demo the product, and composing is normal, like editing a trailer. The purpose of the README and the video is a demo, a trailer of the product". A recording can only move as much as the product does; the user found every version of it dull. What made composing possible without a dependency is D38: under the page's clock any page is a pure function of time, so Nomi can render an animated page itself. This changes what Phase 7's video criterion measures: a composed video has no "every storyboard flow is in the video"; what guards the truth is the module's rule (only controls, messages and results the flows showed) and the flows having passed first | Moderate. `compose` in `lib/record.mjs`, the `film` segment in `probes/stage.js`, `modules/brandvid.md`. Costs: a trailer can show something the product does not do, and no script can tell; a render takes about a minute and a half (a screenshot of a whole 1080p page costs over 100 ms, and most frames of a trailer differ); the quality now depends on the agent's composition, where a recording's did not |

## 15. Glossary

**Tier**: Tweak, Build or Create; sets how much of the loop runs. **Direction note**: five lines of concrete direction written before a Build. **DNA**: `.nomi/dna.md`, the project's durable creative direction. **Run**: one `nomi observe` result in `.nomi/runs/<id>/`, of kind `web`, `motion`, `flow` or `diff`. **Plan**: `.nomi/plan.md`, the product read and its jobs as flows. **Flow**: one job of the product as steps a script runs, ending in an expected state. **Dead click**: a click after which nothing changed (§7). **Proof card**: `.nomi/proof.md` and `proof.png`, written by `nomi review`. **Settle time**: the span from the first start to the last end of a page's finite animations. **Step**: one entry of an `--interact` script. **Probe**: in-page JS that measures and returns JSON. **Fingerprint**: a dated signature of generic output that prompts "chosen or fallen into?". **Critic packet**: the self-contained brief from `nomi critique pack`. **Entry file**: `skills/nomi/SKILL.md`, the one listed skill. **Module**: `modules/<name>.md`, a domain module (six sections) or a stage module (Inputs, Steps, Outputs, Stop). **Stage**: one step of the pipeline: plan, design, build, measure, review, present. **Storyboard**: `.nomi/storyboard.json`, what the demo video says and which flows it shows. **Stage page**: the blank loopback page where a video is composed, encoded and measured (not a pipeline stage). **Command ledger**: `.nomi/commands.json`, the commands `readme run` executed and how they ended. **Host**: an agent environment that loads the skill. **Channel**: a way to install Nomi into a host (folder, plugin, extension).
