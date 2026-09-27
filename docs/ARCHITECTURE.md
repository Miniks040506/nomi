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
5. **One canonical skill, thin adapters.** Host differences live in manifests, install paths and data, never in the skill text.
6. **State belongs to the project.** Plain files in the repo, readable by any agent and any person.
7. **Scripts measure, the model judges.** Deterministic code for structure and measurement; judgment stays with the model.
8. **Small context.** Progressive disclosure under enforced budgets (§12).
9. **Degrade honestly.** Without Node or a browser the loop still runs and reports what was not verified.

## 3. System overview

```
 Any host: Claude Code · Codex · Cursor · OpenCode · Gemini CLI · Antigravity · OpenClaw · Hermes
     │  native discovery of skills/nomi   (adapters = manifests + install paths, no logic)
     ▼
 SKILL.md ──► tier ──► loop ──► loads only the modules the task needs
     │           references/direction.md · critique.md          core protocols
     │           references/web · motion · 3d · game · world     domain modules
     │
     ├─► scripts/nomi.mjs   (Node ≥22, zero dependencies)
     │      dna · critique pack · world · doctor
     │      observe ──► headless Chromium over CDP ──► probes/*.js run in the page
     │                        └──► .nomi/runs/<id>/  report.json · summary.md · *.png
     ▼
 The user's project (shared by every session and every agent)
     .nomi/dna.md   .nomi/world/**      + reads DESIGN.md, PRODUCT.md, CSS tokens when present
```

## 4. The canonical skill

`skills/nomi/` is the only skill. It conforms to the Agent Skills specification (agentskills.io), so every target host can load it unchanged (per-host evidence: `INTEGRATIONS.md`).

```
skills/nomi/
├── SKILL.md             scope, tiers, loop, state, CLI summary, module map, honesty rules
├── references/
│   ├── direction.md     core: ground → name the default → diverge → choose → translate → DNA
│   ├── critique.md      core: evidence rules, severity, output, critic packet, refinement, stop rules
│   └── web.md  motion.md  3d.md  game.md  world.md      domain modules
├── assets/
│   ├── dna.md           DNA v1 template
│   ├── critic-brief.md  packet template filled by `nomi critique pack`
│   ├── canon-entity.md  world entity template
│   └── hooks/           dev-only instrumentation snippets (Three.js, React Three Fiber, games)
└── scripts/
    ├── nomi.mjs         CLI entry
    ├── lib/             frontmatter (YAML subset), dna; later browser, cdp, serve, capture, compose, runs, canon
    ├── probes/          in-page JS returning JSON: web-census, motion, three, game
    └── data/            small dated tables: fingerprints, vague-words, generic-names
```

**SKILL.md contract**
- Frontmatter: `name: nomi`; `description` ≤400 characters with the trigger phrase first; optional `license`, `compatibility` (Node 22+ and a Chromium-family browser are optional accelerators), `metadata` with string values only (`version`). No host-specific keys.
- Body order: (1) scope and exit ramp: if the task changes nothing a person sees, hears, feels or reads, stop; (2) tier selection; (3) the loop; (4) state files; (5) CLI summary; (6) module map listing only modules that exist; (7) honesty rules.
- Paths are relative to the skill directory. Scripts run as `node <skill-dir>/scripts/nomi.mjs <command>`, where `<skill-dir>` is the folder containing SKILL.md. No `${CLAUDE_SKILL_DIR}`, `$ARGUMENTS` or host tool names; use host-neutral verbs ("run", "open the image", "start a subagent if your environment has one").

**Domain module contract.** Every `references/<domain>.md` has exactly these sections:

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
| `observe <url\|file\|dir> [flags]` | Capture and measure; writes a run | 2; `--motion` 4, `--3d` 5, `--game` 6 |
| `diff <runA> <runB>` | Metric deltas and a before/after sheet | 2 |
| `probe print <name>` | Print an in-page probe for a host's own browser tool | 2 |
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
| Control | Chrome DevTools Protocol from Node with zero npm dependencies; pipe transport preferred (no open port), WebSocket fallback |
| Measurement | `probes/*.js` are plain in-page functions returning JSON. `nomi probe print <name>` lets a host's own browser tool run the same probe when Nomi cannot launch a browser (sandboxed hosts) |
| Images | Screenshots per viewport; contact sheets and before/after sheets composed in the browser's canvas (no image libraries); downscaled viewing copies |
| Output | `.nomi/runs/<id>/report.json` (versioned; stable flag codes such as `web.contrast`, `motion.layout-property`), `summary.md` (≤60 lines), ≤4 images to open by default |
| Time | Web, 2 viewports ≤15 s; motion ≤30 s; 3D ≤30 s; game playtest ≤60 s. Every wait is bounded |
| Fidelity | Headless WebGL may be software-rendered: performance is reported as budgets (draw calls, triangles, textures), not FPS. `--headed` for GPU checks |
| Safety | Local only, no telemetry, temp profile removed. The browser sandbox stays on; if launch fails inside a restricted host, retry without it only for local targets and say so |

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
| Motion | The job of each motion, timing scale, easing family, choreography, reduced-motion strategy | — | Animation inventory, load and interaction timelines as contact sheets, reduced-motion comparison, long frames, settle time | Durations, easings, animated properties; frames; jank counts |
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
├── skills/nomi/                       the canonical skill (the product)
├── plugin.json                        Agent Plugins v1 manifest: Codex, Cursor, OpenClaw, Hermes
├── .claude-plugin/                    plugin.json + marketplace.json: Claude Code
├── gemini-extension.json              Gemini CLI extension (bundles skills/)
├── .agents/plugins/marketplace.json   Codex marketplace entry
├── adapters/hosts.json                machine-readable host table: paths, channels, headless commands, verification
├── adapters/<host>/                   only when a host needs its own files
├── tools/                             check.mjs · install.mjs · verify-hosts.mjs
├── evals/                             cases/ · fixtures/ · harness/ · reports/
├── tests/                             node --test: unit tests and fixture pages
├── docs/
└── package.json                       dev scripts and dev dependencies only
```
Project-level reach, as documented by each host (local verification is Phase 3): `.agents/skills/nomi` serves Codex, Cursor, OpenCode, Gemini CLI, Antigravity, OpenClaw and Hermes (trust required); `.claude/skills/nomi` serves Claude Code. Channels and caveats are in `INTEGRATIONS.md`.

## 12. Context budgets

| Item | Budget | Enforced by |
|---|---|---|
| Skill description | ≤400 characters, trigger phrase first | `tools/check.mjs` |
| SKILL.md | ≤150 lines (about 2k tokens) | `tools/check.mjs` |
| Each reference file | ≤200 lines, loaded only when relevant | `tools/check.mjs` |
| Templates | ≤120 lines | `tools/check.mjs` |
| CLI output | ≤60 lines by default; details go to files | tests |
| Images per observe | ≤4 opened by default; viewing copies ≤1280 px wide | tests |
| DNA | ≤150 lines, ≤20 decisions | `nomi dna check` |
| Canon slice | ≤80 lines per `world query` | tests |
| Typical load | Tweak: SKILL.md plus DNA sections. Build: plus one module and one run. Create: plus direction, critique, ≤2 modules | token-overhead evals |

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
| D1 | One skill `nomi` with domain modules, replacing six skill folders | Cross-skill references are not portable (Claude Code namespaces plugin skills as `nomi:<skill>`; Hermes namespaces packaged skills as `agent-plugin-<slug>-<hash>`; skill hubs install skills one by one). Listing budgets penalize many descriptions (Codex: ≤2% of context or 8,000 characters for all skills). Every domain needs the same loop | Reversible: generate thin per-domain entry skills from the same source if Phase 3 trigger evals show poor domain recall |
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

## 15. Glossary

**Tier**: Tweak, Build or Create; sets how much of the loop runs. **Direction note**: five lines of concrete direction written before a Build. **DNA**: `.nomi/dna.md`, the project's durable creative direction. **Canon**: the World module's entity files. **Run**: one `nomi observe` result in `.nomi/runs/<id>/`. **Probe**: in-page JS that measures and returns JSON. **Fingerprint**: a dated signature of generic output that prompts "chosen or fallen into?". **Critic packet**: the self-contained brief from `nomi critique pack`. **Module**: a domain reference file under the six-section contract. **Host**: an agent environment that loads the skill. **Channel**: a way to install Nomi into a host (folder, plugin, extension).
