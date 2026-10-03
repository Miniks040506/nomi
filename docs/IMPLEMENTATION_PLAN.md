# Nomi V1 Implementation Plan

Planning completed 2026-09-27. Design: `ARCHITECTURE.md` · hosts: `INTEGRATIONS.md` · measurement: `EVALUATION.md`.

**How to use this plan** (per `CLAUDE.md`): each implementation run takes the next unblocked phase, re-checks that the phase still makes sense against the current repo, implements the whole phase, validates it, updates this file (status, outcome, deviations) and the other docs, then stops. Never start the next phase in the same run.

## Status

| Phase | Name | Status | Depends on |
|---|---|---|---|
| 1 | Nomi Core: direction, taste, critique, Project DNA | DONE | — |
| 2 | Observation engine + Nomi Web | DONE | 1 |
| 3 | Multi-host packaging and verification | NOT STARTED | 1, 2 |
| 4 | Nomi Motion | NOT STARTED | 2 |
| 5 | Nomi 3D | NOT STARTED | 2 |
| 6 | Nomi Game | NOT STARTED | 2, 4 |
| 7 | Nomi World + cross-domain orchestration | NOT STARTED | 1; 4–6 for the cross-domain suite |
| 8 | Evals at scale, hardening, release | NOT STARTED | 1–7 |

Order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Phases 4 and 5 may swap if needed.

Between Phases 2 and 3 an architecture migration (not a product phase) moved Nomi to a shared core plus domain entry skills. It is DONE (2026-10-01); see "Architecture migration" below.

## Before Phase 1

- Recommended (user's call): `git init` and commit the planning state, so every phase is a reviewable diff.
- Environment already present on the dev machine: Node 24.14, Edge and Chrome, Claude Code 2.1.283, Codex CLI 0.154.0, OpenClaw 2026.5.22, Cursor IDE, WSL2 Ubuntu (needed for Claude Code eval suites that grant Bash).

## Global constraints

Every phase implicitly includes these.
- Every skill folder under `skills/` (the core `nomi` and each domain skill `nomi-<domain>`) conforms to the Agent Skills spec: `name` equals the folder; description ≤1,024 characters by spec and ≤400 by project budget; `metadata` values are strings.
- No host-specific syntax inside `skills/` (`${CLAUDE_*}`, `$ARGUMENTS`, host tool names, host-only frontmatter). `tools/check.mjs` enforces it.
- Budgets from ARCHITECTURE §12 are enforced by `tools/check.mjs` and tests: SKILL.md ≤150 lines, references ≤200, templates ≤120, CLI output ≤60 lines, ≤4 images per observe, DNA ≤150 lines.
- Runtime: Node.js ≥22, ESM `.mjs`, zero runtime npm dependencies inside `skills/nomi/`. Dev dependencies live only in the root `package.json`.
- Platforms: Windows 11, Linux (WSL2 counts), macOS when available. Scripts are invoked as `node <path>`; nothing in the skill relies on shebangs or bash.
- Observation uses Chromium-family browsers over CDP. Tests never touch the network. Artifacts go only under `.nomi/runs/`.
- Versioned schemas: DNA `nomi: 1`, run report `nomi: 1`. A breaking change ships with a migration command.
- Compatibility claims require evidence recorded in `INTEGRATIONS.md`.

## Definition of done (every phase)

1. Every acceptance criterion is met, with the evidence summarized in the phase's Outcome line.
2. `npm run check` and `npm test` are green on Windows and on Linux (WSL2).
3. The phase's eval suites ran; `evals/reports/phase-N.md` records with/without numbers, spread and cost.
4. Docs match behavior: ARCHITECTURE if the design moved, INTEGRATIONS if host facts changed, EVALUATION if suites changed; this plan's status and Outcome updated.
5. Context budgets hold, and every new file answers "what does this make the agent do differently?"

## Review focus

Failure modes the design implies but no single suite fully covers. Each phase that touches the relevant code adds a test for it.
1. **No Node or no browser** (Hermes or Antigravity machines, CI): the loop still runs, never errors opaquely, and reports "not visually verified". Tests: Phases 1–2.
2. **Sandboxed hosts** block browser launch or localhost (Codex default sandbox, Antigravity terminal sandbox): clear error within 10 s, `probe print` fallback, never a hang. Tests: Phases 2–3.
3. **Pages that never go idle** (HMR websockets, infinite animations, long polling): bounded waits, capture anyway, note it in the report. Tests: Phases 2 and 4.
4. **Windows paths** with spaces, non-ASCII characters or OneDrive folders, and locked temp profiles: correct quoting, cleanup retries, no orphan browser processes. Tests: Phase 2.
5. **Large or nested state** (monorepo with several `.nomi/`, 200+ canon entities, oversized DNA): nearest-ancestor resolution, slices, compaction warnings. Tests: Phases 1 and 7.

---

## Phase 1 — Nomi Core: direction, taste, critique, Project DNA

**Status:** DONE (2026-09-27)

**Objective.** One canonical `nomi` skill that measurably changes what agents do on creative work (tiered effort, direction before code, persistent DNA, evidence-bound critique), with the CLI foundation, repo checks and the first Claude Code behavior evals.

**Scope**
- Consolidate: delete `skills/nomi-web`, `nomi-motion`, `nomi-3d`, `nomi-game`, `nomi-world`; `skills/nomi/` becomes the only skill (decision D1).
- `SKILL.md` per ARCHITECTURE §4–5: scope and exit ramp, tiers, loop, state, CLI summary, module map (only modules that exist), honesty rules. The "no DNA: the existing product is the direction" rule is included.
- `references/direction.md`: ground in the subject (its materials, vernacular, artifacts) → name the median default for this brief → 2–3 options differing on at least two axes → choose with reasons → translate every trait word into checkable values → signature → Never list → write DNA or a direction note. Includes the brief-wins rule.
- `references/critique.md`: evidence rules, severity, output format, Keep list, critic packet use, refinement and stop rules, round budgets per tier.
- `assets/dna.md` (schema v1) and `assets/critic-brief.md`.
- CLI `scripts/nomi.mjs` with `lib/yaml-subset.mjs` (flat keys, inline lists, one nesting level), `lib/dna.mjs`, `lib/out.mjs` (compact text, `--json`, exit codes 0/1/2):
  - `dna init` writes `.nomi/dna.md` from the template plus `.nomi/.gitignore` (`runs/`); refuses to overwrite.
  - `dna check` reports missing required sections, untranslated vague words, more than 20 decisions and more than 150 lines, with line numbers.
  - `dna show [--for <domain>]` prints only Intent, Character, Signature, Never and that domain's section.
  - `critique pack --task … [--evidence …] [--domain …]` writes a self-contained brief to stdout or a file.
  - `doctor`, `version`, `help`.
- `data/vague-words.json` (for example modern, clean, sleek, minimal, elegant, intuitive, seamless, premium, engaging, vibrant, immersive), dated.
- Repo tooling: root `package.json` (`engines.node >=22`, scripts `check` and `test`, no runtime dependencies), `tools/check.mjs` (spec rules, budgets, link integrity, vendor-neutrality lint), `tests/` using `node --test`, minimal `.claude-plugin/plugin.json` so `claude plugin eval` and `claude --plugin-dir .` can load the repo.
- Evals: `evals/cases/core/*` (six cases, EVALUATION §3) and fixtures in `evals/fixtures/`.

**Dependencies.** None.

**Expected deliverables.** The skill files and CLI above, `tools/check.mjs`, `tests/`, `.claude-plugin/plugin.json`, `evals/cases/core/`, `evals/fixtures/`, `evals/reports/phase-1.md`, updated docs.

**Acceptance criteria**
1. `skills/` contains only `nomi/`.
2. `npm run check` passes on the repo, and tests prove each check rule fires on a violating fixture.
3. `npm test` covers every CLI behavior listed in Scope, including refusal to overwrite and line-numbered findings.
4. `core` suite on Claude Code, three runs per arm:
   - create-writes-dna: a DNA file with non-empty Intent, Character, Signature and Never, and at least three concrete translations (hex, px, ms or named typefaces), in ≥2 of 3 with-Nomi runs.
   - tweak-respects-dna: no DNA write and no direction note in ≥2 of 3 runs; Never items not introduced.
   - build-continuity: DNA palette and typefaces reused, Never items absent; with-Nomi score above baseline.
   - no-trigger-backend: the skill is not invoked in 3 of 3 runs.
   - vague-brief-translated: no untranslated vague words in the resulting DNA or note in ≥2 of 3 runs.
   - brief-style-wins: the brief's requested look (a style Nomi would otherwise call a default) is delivered in ≥2 of 3 runs.
5. create-writes-dna passes with file tools only (no shell granted): the skill works without its scripts.
6. D13 (pointer from AGENTS.md or CLAUDE.md to DNA) is decided from the continuity results and recorded in ARCHITECTURE §14.

**Validation / evals.** `npm run check`; `npm test`; `claude plugin eval . --tag core --scaffold` natively on Windows (file tools only), with cost recorded. Fixtures are seeded by scaffold scripts; if they do not run on native Windows (Git Bash), run the suite under WSL2 and note it in the report.

**Architectural considerations**
- Protocols are written as decisions and checks. Anything that explains a principle is cut.
- Divergence comes from the subject, never from a style catalog. The brief-style-wins case guards against anti-slop dogma from day one.
- DNA v1 is a one-way door for users: keep the frontmatter minimal and the sections exactly as in ARCHITECTURE §6.
- The critique protocol forbids unobserved claims even before the engine exists: evidence is code references plus explicit "not visually verified".

**Outcome** (2026-09-27, full evidence in `evals/reports/phase-1.md`):
- All six acceptance criteria met.
  - AC1–3: `skills/nomi/` is the only skill; `npm run check` is clean, with every rule proven by a violating fixture; `npm test` passes 36/36 on Windows and on Linux (WSL2, portable Node 24).
  - AC4, final A/B, 42 runs on Sonnet 5, $9.47:
    - create-writes-dna: valid DNA 3/3.
    - tweak-respects-dna: 3/3 clean.
    - build-continuity: 1.00 with the skill vs 0.83 without (the DNA-only rule held 3/3 vs 0/3).
    - no-trigger-backend: 3/3.
    - vague-brief-translated: 2/3.
    - brief-style-wins: 2/3. The single failure is a judge false negative on a page with exactly the requested tokens.
  - AC5: every eval ran without a shell.
  - AC6: D13 decided (see Deviations).
- Deviations, each recorded as a ruling:
  - Skill description rewritten. The first description never fired on an ordinary "add a form" request, so the DNA went unread 3/3.
  - D13 reversed: `dna init` now writes a one-line DNA pointer into `AGENTS.md`/`CLAUDE.md`.
  - `critique pack --out` creates folders.
  - Three self-review fixes: BOM handling, one-line frontmatter errors with file line numbers, and `<skill-dir>/` path checks.
  - Two graders corrected: one was non-discriminating, one penalised compliance.
- For later phases:
  - Create-tier runs cost 2–4× the baseline; the Phase 8 overhead gates need calibrating against this.
  - The effect of the D13 pointer on agents without Nomi can only be measured outside `claude plugin eval` (Phase 3, U11).
  - Judges must see renders, not long HTML (Phase 2).
  - Verify skill triggering per host early in Phase 3; it was the main failure mode here.
- Total eval spend: about $21.5.

---

## Phase 2 — Observation engine + Nomi Web

**Status:** DONE (2026-09-30)

**Objective.** Give agents real eyes on browser-rendered work: zero-dependency capture, in-page measurement, run diffs and critic packets with evidence. Ship the Web module and prove it on seeded-defect and golden web evals against the vanilla host.

**Scope**
- Engine in `scripts/lib/`:
  - `browser.mjs`: locate Chrome, Edge, Chromium or chrome-headless-shell per OS; `NOMI_BROWSER` override.
  - `cdp.mjs`: CDP client over pipe transport, WebSocket fallback.
  - `serve.mjs`: static server for file and directory targets.
  - `capture.mjs`: viewport emulation; bounded waits for load, network quiet and fonts; screenshots; reduced-motion and dark-scheme emulation.
  - `compose.mjs`: contact sheets and before/after sheets drawn in the browser's canvas.
  - `runs.mjs`: run folders, report schema v1, pruning to 10.
  - Process hygiene: Windows process-tree kill, temp-profile removal with retries, cleanup on errors and Ctrl-C.
- `probes/web-census.js`:
  - Type: families actually rendered, sizes, weights, line heights, fit to a scale.
  - Color: distinct text, background and border colors, clustered.
  - Sets of spacing, radius and shadow values.
  - Contrast (WCAG AA with effective background; "unknown" over images and gradients), horizontal overflow, tap targets, line length.
  - Heading outline and number of competing primary actions.
  - Keyboard focus pass: tab through, list focusables without a visible indicator, restore state.
  - Visible-copy fingerprints.
  - Drift against CSS custom properties and DESIGN.md `colors` and `typography`.
- `data/fingerprints.json`: web layout and copy, ≤25 entries, dated, each with the question it raises.
- CLI:
  - `observe <target> [--viewport …] [--full] [--wait …] [--dark] [--reduced-motion] [--label …]`
  - `diff <runA> <runB>`
  - `probe print <name>`
  - `doctor` gains a browser launch test
  - `critique pack --run <id>` embeds the run summary and image paths
- `references/web.md` under the six-section contract; SKILL.md observe step and module map updated.
- Eval runner v1 in `evals/harness/`: reads the case format from EVALUATION §7; Claude Code driver; temp workspaces; neutral post-run rendering; deterministic, transcript and pairwise judge graders; reports.
- Suites: `web-seeded`, `web-golden`, `web-adherence`.

**Dependencies.** Phase 1.

**Expected deliverables.** Engine, probe, data, CLI commands, `references/web.md`, fixture pages with known values, runner v1, suites, `evals/reports/phase-2.md`.

**Acceptance criteria**
1. `observe` works against URL, file and directory targets on Windows (Edge and Chrome) and Linux (WSL2 with Chrome or chrome-headless-shell). A two-viewport run on the fixture finishes in ≤15 s, and the summary is ≤60 lines.
2. After success, failure and interruption, no browser process or temp profile remains (tested on Windows).
3. Census is exact on fixtures: counts of families, sizes and colors. Every seeded contrast failure is found, with ≤1 false positive across fixtures. Overflow and invisible-focus elements are found.
4. `diff` reports metric deltas and writes a before/after sheet.
5. `probe print web` output runs in a plain browser console and returns the same JSON keys as `observe`.
6. Without a browser, `observe` exits 2 in under 10 s with an actionable message, and SKILL.md tells the agent the next step: run `probe print` through a host browser tool if one exists, otherwise report "not visually verified".
7. Evals on Claude Code:
   - With Nomi, more seeded S1 defects get fixed than in the baseline on ≥2 of 3 fixtures, with no new S1 in ≥90% of runs and decoys intact. *Recalibrated 2026-09-30 (user decision; baseline at ceiling, EVALUATION §5): seeded repair within noise of baseline, no new S1 in ≥90% of runs, decoys intact; and fewer Build/Create pages ship with S1 findings with Nomi than without.*
   - Observe-before-claim holds in ≥80% of with-Nomi Build/Create runs.
   - Citation validity is ≥95%.
   - Golden briefs: with-Nomi output is preferred in ≥60% of blinded, position-swapped judgments.
   - The competitor baseline (`frontend-design`) is reported, not gated.

**Validation / evals.** check; tests (browser tests skip with a stated reason when no browser exists); runner suites under WSL2 for shell-granting cases; report with costs.

**Architectural considerations**
- Largest phase. If it cannot finish in one run, stop at the split point (engine, probe, CLI and `references/web.md` meeting criteria 1–6 first; runner and suites for criterion 7 second), set status IN PROGRESS and record what remains.
- Measurement is not taste. Census values are evidence for critique, never a score to minimize. Only accessibility and function flags default to S1.
- Probes stay pure: no dependencies, no lasting page mutation.
- Sandbox findings from running Codex against `observe` feed Phase 3 (U3).
- Decide D9 (reminder hook) from the observe-before-claim rate.

**Outcome** (2026-09-30, full evidence in `evals/reports/phase-2.md`). All acceptance criteria are met; AC7a is met under the recalibrated gate the user approved.
- AC1–6, engine:
  - Tests on final code: Windows 74/74 with Edge, and the browser and observation files 22/22 with Chrome. WSL2 73 pass + 1 Windows-only skip (portable Node 24.14, chrome-headless-shell 154). `check` clean.
  - Two viewports in 3.8 s, 23 summary lines.
  - Every seeded contrast, overflow and focus defect found on 7 fixtures, with 0 contrast false positives.
  - No leftover processes or profiles after success, failure or interruption.
- AC7b–c, behaviour: in 15 Build/Create runs, Nomi observed 15/15, opened captures 15/15 and made 30/30 valid evidence claims; the baseline observed 0/15. D9 is not triggered: no hook.
- AC7d, preference: Nomi preferred in 14/18 blinded, position-swapped Codex `gpt-6-sol` votes (77.8%; gate ≥60%).
- AC7e, competitor: Nomi preferred over the `frontend-design` arm in 72.2% of judgments. That skill activated in 0/9 of its runs, so this is not a comparison with its guidance.
- AC7a, recalibrated with the user because the baseline was at ceiling (EVALUATION §5):
  - Seeded repair within noise: 53/54 vs 54/54 over three fixture designs.
  - No new S1: 27/27 runs per arm. Decoys intact: 27/27 per arm.
  - Build/Create pages shipped with S1: 0/15 with Nomi vs 8/15 baseline (64 findings).
- Cost: Create 1.7× baseline, Build +38%. Eval spend: $13.61 of $25.
- Deviations from Astra's checkpoint, each with evidence in the report:
  - Cleanup never fails a finished capture.
  - `taskkill` by absolute path.
  - No world-writable browser candidates.
  - Viewports under 768 px emulated as phones.
  - Overflow ignores up to 8 px of clipped optical bleed.
  - Transparent-fill text contrast is reported as unknown.
  - SKILL.md: run from the project folder; observe visual Tweak fixes whenever a browser exists.
  - Harness: run-id grader over the eval root, deterministic evidence-claim grader, `regrade`, full-page judge renders, new S1 relative to the fixture, codex shim handling and normal Codex login for the judge, name-based contamination check, competitor arm.
  - Seeded v1 and v2 archived; v3 is `web-seeded`.
- For Phase 3:
  - Skill activation on edits to existing pages was 11/27, against 15/15 on new pages. Include such prompts in the trigger suite before tuning the description.
  - Agents sometimes run the CLI from the skill folder or the project's parent (U1).
  - Codex drivers: normal login, auto-updates mid-run, npm shim spawned through Node on Windows.
  - Competitor arms need proof of activation.

## Architecture migration — hybrid skills (between Phases 2 and 3)

**Status:** DONE (2026-10-01). Not a product phase: no new capability, same acceptance criteria as Phases 1–2.

**Objective.** Move from one skill with domain modules (D1) to a shared core plus one entry skill per finished domain (D14), find out why Nomi activated in only 11/27 existing-page edits, and keep the hybrid only if it measurably helps.

**What changed**
- `skills/nomi/references/web.md` became `skills/nomi-web/SKILL.md`: a web entry skill with its own description, the must-do steps first, then the six-section module. It reaches the core as `../nomi`.
- `skills/nomi/` is the shared core and the entry for work without a domain skill. Its description no longer covers web pages and no longer relies on a `.nomi/` folder.
- CLI: `critique pack --domain` reads lenses from the sibling domain skill; `doctor` lists the domain skills it finds.
- `tools/check.mjs` checks every skill folder: only `nomi` and `nomi-<domain>` are allowed, a domain skill needs the full contract, sibling paths must resolve, and all versions match the manifest.
- Harness: plugin snapshots (`--plugin-root`), variant labels, project-folder installs, effort and ceiling options, `dnaRead` and `coreRead` signals, `discovery` and `routing` cases.
- No folders for Motion, 3D, Game or World yet: a folder would make an unfinished skill discoverable.

**Outcome** (evidence and costs in `evals/reports/migration-hybrid.md`)
- Root cause of 11/27: the description. Agents decide at their first action from the prompt wording; "polish" matched the old description and "add a card" or "improve for phones" did not; the `.nomi/` clause could never fire. Medium effort did not help (0/4).
- 27 existing-page edits, equal conditions:
  - Hybrid: activated 27/27, observed 27/27, read the DNA 20/27.
  - Best single-skill variant (same fixes): activated 27/27, observed 21/27, read the DNA 15/27.
  - Original single skill, fresh control (17 runs over 6 of the 9 cases; stopped there at the user's request): activated 7/17, observed 0/17. Phase 2 measured 11/27 and 0/27.
  - Defects fixed and decoys intact in every arm.
- No regressions found: new pages 5/5 activated and observed; Phase 1 cases `build-continuity` 3/3, `tweak-respects-dna` 3/3, `no-trigger-backend` 3/3, `create-writes-dna` 3/3 with a DNA file; non-web lore task routed to the core 3/3.
- Tests: Windows 77/77 (Edge) and 22/22 (Chrome); WSL2 76 pass + 1 Windows-only skip; `check` clean.
- Spend: $15.82 against a $20 ceiling.
- Limits carried into Phase 3: agents never open the core from a domain skill (D15); a loaded skill lowers DNA reads (hybrid 20/27; agents without the skill read it 30/30 by exploring); hosts that separate or rename skill folders are unverified (U12); `brief-style-wins` and `vague-brief-translated` were not rerun.

---

## Phase 3 — Multi-host packaging and verification

**Status:** NOT STARTED

**Objective.** Nomi installs, activates and runs its scripts on all eight target hosts through their real mechanisms, and every compatibility claim is backed by recorded evidence.

**Scope**
- Manifests at the repo root: `plugin.json` (Agent Plugins v1), `.claude-plugin/plugin.json` + `marketplace.json`, `gemini-extension.json`, `.agents/plugins/marketplace.json`. `tools/check.mjs` gains manifest consistency (name, version, description) and validation against vendored JSON schemas.
- `adapters/hosts.json`: paths, channels, headless commands, activation signals, isolation recipe, verification record. The placeholder adapter READMEs are deleted; a per-host folder exists only for real host files. INTEGRATIONS.md stays the human source; check keeps it in sync with hosts.json.
- `tools/install.mjs`: project and user scope, copy mode, idempotent, `--dry-run`, avoids duplicate listings (U2), Windows-safe. It always installs the whole set of Nomi folders side by side (D14); per host, verify that siblings stay siblings (U12) and bundle the core into the domain folder only where a host breaks them.
- `tools/verify-hosts.mjs`: for every host CLI present, temp project → install → headless prompt → records discovery, activation, `nomi doctor` via the host, image viewing, subagent availability → `evals/reports/hosts-<date>.md`.
- Resolve U1–U10 from INTEGRATIONS §6. Install missing CLIs where possible (Gemini CLI, OpenCode and Hermes in WSL2; Cursor's `agent`; Antigravity's `agy` if available; upgrade OpenClaw).
- Runner drivers: Codex (full A/B from here on) plus trigger and smoke drivers for the other hosts. `trigger` and `host-smoke` suites. The trigger suite includes edits to existing pages ("add a section", "improve it for phones"), the prompts that exposed the Phase 2 activation gap, and non-web creative prompts that must route to the core.
- CI workflow: check and unit tests on Windows and Linux.
- README install section written from verified channels only.

**Dependencies.** Phases 1–2.

**Expected deliverables.** Manifests, hosts.json, installer, verifier, drivers, suites, CI, updated INTEGRATIONS.md statuses, `evals/reports/hosts-<date>.md`, `evals/reports/phase-3.md`.

**Acceptance criteria**
1. Every host has status `L` (version, date, evidence of discovery, activation and a script run) or stays `D` with the concrete blocker written down. README claims nothing beyond that.
2. At least five hosts reach `L`: Claude Code, Codex and OpenClaw are installed now; Gemini CLI, OpenCode and Hermes are installable in WSL2; Cursor CLI and Antigravity CLI where available.
3. `claude plugin validate .` passes; the Agent Plugins manifest validates against its schema; `gemini extensions link .` loads the skill where Gemini CLI is available.
4. Trigger suite on automatable hosts: recall ≥0.85 and false-trigger rate ≤0.15. Tune the one description; do not fork per host.
5. `tools/install.mjs` is idempotent on Windows and Linux; uninstall is documented.
6. Codex A/B reruns `web-seeded`, and the result is reported.

**Validation / evals.** check; tests; `verify-hosts`; `trigger` and `host-smoke` suites; `web-seeded` on Codex.

**Architectural considerations**
- Host differences are fixed by data or packaging, never by editing the canonical skill per host. If a host truly needs different instructions, record the evidence and a decision before adding an adapter file.
- If one broad description hurts domain recall, apply D1's reversible path (generated per-domain entry skills) only with trigger-eval evidence.
- No hooks unless D9 was triggered in Phase 2.

**Outcome:** _pending_

---

## Phase 4 — Nomi Motion

**Status:** NOT STARTED

**Objective.** Every animation has a job, a system and evidence: agents design motion under DNA timing, easing and choreography rules, and verify it from captured timelines, reduced-motion behavior and frame health.

**Scope**
- `probes/motion.js`: `document.getAnimations()` plus a stylesheet transition scan (targets, properties, durations, delays, easing, iterations; layout-affecting properties flagged).
- CDP Animation-domain capture.
- Timelines for page load and scripted interactions (hover, click, focus, scroll; a JSON script format), sampled frames composed into contact sheets.
- Reduced-motion comparison run, long-animation-frame collection, settle time.
- Hover and active state before/after sheets.
- `observe --motion [--interact <file>]`; `skills/nomi-motion/SKILL.md`; DNA Motion section guidance; motion fingerprints.
- Suites `motion-seeded` and `motion-golden`, plus adherence cases.

**Dependencies.** Phase 2.

**Expected deliverables.** Probe, capture extensions, `skills/nomi-motion/SKILL.md`, fixtures with known timings, suites, `evals/reports/phase-4.md`.

**Acceptance criteria**
1. The inventory is exact on fixtures: durations, easings, properties and targets.
2. The contact sheet shows ≥8 frames spanning load.
3. Reduced-motion non-compliance is detected.
4. Settle time is within ±100 ms of fixture ground truth.
5. A motion capture finishes in ≤30 s.
6. Evals on Claude Code and Codex: with Nomi, more seeded motion defects get fixed than in the baseline on ≥2 of 3 fixtures, decoys stay intact, and motion critiques quote measured timings.

**Validation / evals.** check; tests; motion suites; overhead spot-check.

**Architectural considerations**
- Take timing from animation data, not frame timestamps (headless jitter).
- Cap frame counts and downscale images.
- The motion system is cross-domain: 3D camera moves and game feedback timing reuse these capture primitives and the DNA Motion section.

**Outcome:** _pending_

---

## Phase 5 — Nomi 3D

**Status:** NOT STARTED

**Objective.** Spatial judgment with rendered evidence for WebGL, starting with Three.js and React Three Fiber. Shot, light, materials, scale and performance budget are decided up front and verified from renders and renderer stats.

**Scope**
- `assets/hooks/three.js` and `assets/hooks/r3f.jsx`: dev-only `window.__nomi` registration with named shots.
- `probes/three.js`:
  - Renderer stats and config: draw calls, triangles, geometries, textures, tone mapping, output color space, shadows, pixel ratio.
  - Census of lights and materials.
  - Shot rendering, luminance histogram and clipping, subject coverage and centroid.
  - A frame-time sample tagged hardware or software.
- `observe --3d [--shots …]` and a `--headed` mode; a screenshot-only degraded mode without the hook that states its limits.
- `skills/nomi-3d/SKILL.md`; DNA Space section; 3D fingerprints; fixtures built on the dev dependency `three`.
- Suites `3d-seeded` and `3d-golden`.

**Dependencies.** Phase 2. Phase 4 is optional (camera-motion capture).

**Expected deliverables.** Hooks, probe, capture extensions, `skills/nomi-3d/SKILL.md`, fixtures, suites, `evals/reports/phase-5.md`.

**Acceptance criteria**
1. Stats are exact on fixtures.
2. Two renders of the same shot on one machine match: ≤1% of pixels differ by more than 2/255 per channel.
3. Degraded mode reports what it could not measure.
4. A 3D capture finishes in ≤30 s.
5. Evals on Claude Code and Codex: with Nomi, more seeded defects get fixed than in the baseline on ≥2 of 3 fixtures, and decoys stay intact.

**Validation / evals.** check; tests (WebGL through headless Chromium); 3D suites.

**Architectural considerations**
- Headless GPU reality: report performance budgets, not FPS.
- No Three.js tutorials in the module.
- Other engines (Babylon, PlayCanvas) are screenshot-only in V1 unless a hook turns out trivial.

**Outcome:** _pending_

---

## Phase 6 — Nomi Game

**Status:** NOT STARTED

**Objective.** Game-feel judgment with playtest evidence: verbs become feel targets, targets become one tuning object, and scripted playtests measure responsiveness, motion arcs and feedback coverage.

**Scope**
- `assets/hooks/game.js`: the `tuning` object and the `window.__nomi.game = { tuning, state(), events }` contract, with notes for canvas, Phaser, Pixi and Three.
- Playtest script format (timed key and pointer sequences) and CDP input dispatch.
- Measurements:
  - Input-to-response latency by frame difference.
  - State-trace sampling and derived metrics: time to apex, apex height, acceleration time, coyote and buffer probes.
  - Verb × channel feedback matrix from events.
  - Frame strips.
- `observe --game --script <file>`; `skills/nomi-game/SKILL.md`; DNA Feel section.
- Fixture canvas platformer with seeded feel defects; suites `game-seeded` and `game-golden`.

**Dependencies.** Phases 2 and 4.

**Expected deliverables.** Hook, playtest runner, probe, `skills/nomi-game/SKILL.md`, fixture game, suites, `evals/reports/phase-6.md`.

**Acceptance criteria**
1. Latency is within ±1 frame of fixture ground truth.
2. Derived arc metrics are within 5% of fixture parameters.
3. The feedback matrix matches the fixture's events.
4. A playtest finishes in ≤60 s.
5. Evals: with Nomi, seeded feel metrics move toward their targets more than in the baseline on ≥2 of 3 fixtures, and tuning decisions are recorded in DNA.

**Validation / evals.** check; tests; game suites.

**Architectural considerations**
- Fixed timestep and determinism (a seeded-RNG hook).
- Measure frame pacing in-page.
- Non-web engines are judgment-only, and the module says so.

**Outcome:** _pending_

---

## Phase 7 — Nomi World + cross-domain orchestration

**Status:** NOT STARTED

**Objective.** Canon-backed worldbuilding that stays consistent, specific and causal, and Create-tier work that stays coherent across world, visuals, space, feel, interface and motion under one DNA.

**Scope**
- Canon format (`.nomi/world/<type>/<slug>.md`, `assets/canon-entity.md`).
- `world new | check | query | scan`:
  - Entity index.
  - Undefined `[[refs]]`.
  - Duplicates and aliases.
  - Born and died dates against events.
  - Naming-rule patterns per culture.
  - Generic-name hits from `data/generic-names.json`.
  - Query slices of ≤80 lines.
  - Scan of content files for proper nouns missing from canon.
- `skills/nomi-world/SKILL.md`; DNA World section.
- Cross-domain ordering and multi-lens critique added to `direction.md` and `critique.md`.
- Suites: `world-seeded`; `world-continuity` (two sessions, two hosts where possible); `crossdomain-golden`.

**Dependencies.** Phase 1; Phases 4–6 for the cross-domain suite.

**Expected deliverables.** Canon tools, `skills/nomi-world/SKILL.md`, fixture worlds (including one with 200 entities), suites, `evals/reports/phase-7.md`.

**Acceptance criteria**
1. Every seeded contradiction is found, with ≤1 false positive on fixtures.
2. A query slice is ≤80 lines for any entity in the 200-entity fixture.
3. Continuity: session-2 content adds zero contradictions in ≥2 of 3 with-Nomi runs, and fewer than the baseline.
4. Cross-domain: with-Nomi output is preferred for coherence in ≥60% of blinded judgments.

**Validation / evals.** check; tests; world and cross-domain suites.

**Architectural considerations**
- Canon is never loaded wholesale.
- Canon is the user's IP and stays local.
- World tools also serve non-game fiction, such as copy for a fictional brand.

**Outcome:** _pending_

---

## Phase 8 — Evals at scale, hardening, release

**Status:** NOT STARTED

**Objective.** Prove V1 across hosts, remove bloat, fix what fails and ship a release candidate.

**Scope**
- Full matrix: every suite A/B on Claude Code and Codex; trigger and smoke on every other host.
- `diversity`, `dogma` and `overhead` suites.
- Human review: at least two raters on blinded pairs.
- Red-team audit against the ASTRA list: design-handbook syndrome, prompt-library syndrome, one-style bias, anti-slop dogma, context explosion, fragmentation, architecture cosplay, fake self-observation, framework duplication, weak routing, test theater, documentation drift.
- Budget audit; cross-platform runs; security review of scripts (network use, temp files, process cleanup).
- Docs sync; versioning and CHANGELOG; license; release packaging (tags, marketplace entries, install docs).
- INTEGRATIONS re-verified within 14 days of release.

**Dependencies.** Phases 1–7.

**Expected deliverables.** `evals/reports/v1.0.md`, fixes for every failed gate, final docs, a tagged release candidate.

**Acceptance criteria**
1. The release gates in EVALUATION §5 are met, or each waiver has a written reason.
2. Everything is green on Windows and Linux (and macOS if available).
3. The docs describe only implemented behavior.
4. No red-team finding of S1 or S2 severity remains open.

**Validation / evals.** Everything above.

**Architectural considerations**
- Prefer deleting over adding: every module, fingerprint and CLI flag must still justify itself with eval evidence.

**Outcome:** _pending_

---

## Smallest compelling V1

**Phases 1–4, plus Phase 8's hardening applied to them**: creative direction, cross-session memory, real observation and evidence-bound critique for web UI and motion, on eight hosts.

Why not stop at 1–3: direction prompts and static web anti-pattern detection already exist. Anthropic's `frontend-design` skill covers direction and self-critique; Impeccable ships a 61-rule detector with design hooks across 17 harnesses; Google's DESIGN.md standardizes visual tokens. Nomi's difference becomes visible once evidence spans time (motion timelines) and memory spans agents (DNA). Phases 5–7 are additive modules on the same engine and loop.

## Risk register

| # | Risk | Likelihood / impact | Mitigation | Phase |
|---|---|---|---|---|
| R1 | Agents skip the loop, especially observation | High / High | One-command steps, useful output, adherence evals; optional reminder hook if below 80% (D9) | 1–3 |
| R2 | Fake self-observation: describing images never opened | Medium / High | Honesty rules; citation-validity and image-opened graders; the critic sees artifacts only | 1–2 |
| R3 | Metric Goodharting homogenizes output | Medium / High | Metrics are evidence, never scores; diversity suite; taste judged by judges and people | 2, 8 |
| R4 | One-style bias or anti-slop dogma | Medium / High | Subject-derived divergence; the brief wins; fingerprints phrased as questions; decoys; dogma suite | 1, 8 |
| R5 | Headless fidelity (software WebGL, fonts, GPU) | High / Medium | Budgets instead of FPS; `--headed`; fidelity noted in reports | 2, 5 |
| R6 | Browser unavailable or blocked by sandboxes | Medium / Medium | `doctor`, `NOMI_BROWSER`, `probe print`, honest failure | 2–3 |
| R7 | Host mechanisms drift (paths moved several times in 2026) | High / Medium | `adapters/hosts.json` as the single source; `verify-hosts`; re-verify before release | 3, 8 |
| R8 | Eval cost and nondeterminism | High / Medium | Three runs per arm, spread reported, per-phase ceilings, tiered cadence | all |
| R9 | Baseline contaminated by other installed skills | Medium / High | Isolated runs, recorded environment, explicit competitor arm | 2–3 |
| R10 | Windows-specific breakage | Medium / Medium | Windows-first development (the dev machine), `node`-invoked scripts, cleanup retries | 2 |
| R11 | Context bloat | Medium / High | Budgets enforced by check; image caps; slices; overhead suite | all |
| R12 | Domain modules drift into handbooks | Medium / High | Six-section contract, line budgets, per-phase "does differently" review | 2, 4–7 |

## Integration uncertainty

The host questions still open (U1–U10) are tracked in INTEGRATIONS §6 and closed in Phase 3. The ones most likely to change the design: U1 (can every host resolve the skill's own script path?), U3 (Codex sandbox versus launching a browser), and U2 (duplicate listings when two folders are installed).

## Where Nomi could duplicate the base model (and the rule for each)

| Area | Rule |
|---|---|
| Design, typography, color, animation, 3D and game-design principles | Never explained; only decisions to force and evidence to collect |
| Framework and engine APIs | Never taught; the only code shipped is Nomi's instrumentation hooks |
| Accessibility rules | Measured, not restated |
| Narrative craft | Replaced by canon checks and the cause-and-consequence rule |
| Generic anti-pattern catalogs (already in `frontend-design` and Impeccable) | ≤25 dated fingerprints per domain; other tools' outputs used as evidence |
| Self-review | Replaced by evidence binding and context separation, not by more review prose |

## Context-bloat risks

Budgets and their enforcement are in ARCHITECTURE §12. Watch in particular:
- Images: each costs about 1–2k tokens. Default to ≤4, with contact sheets instead of frame dumps.
- Multi-module Create tasks: at most two modules per critique pass.
- DNA growth: the decisions log is capped at 20 and older entries are compacted.
- Canon: slices only, never the whole world.
- CLI output: summaries in stdout, details in files.

## Reversible architecture decisions

Recorded with triggers in ARCHITECTURE §14 (D1–D16; D14 supersedes D1). The only one-way door for users is the `.nomi/` schema (D3), which is why DNA v1 is minimal and versioned.

## Open decisions (user)

| Decision | Needed by | Default if unanswered |
|---|---|---|
| License | Phase 8 (manifests may omit it earlier) | None; release is blocked without one |
| GitHub owner and repo name (used in marketplace entries and install docs) | Phase 3 | Docs use `<owner>/<repo>` |
| `git init` before Phase 1 | Phase 1 | Recommended, not required |
| Eval spend ceiling per phase | Phase 1 | $25 |
| Acceptable judge models | Phase 2 | Cross-vendor: Codex judges Claude Code outputs and the reverse |

## Critical review and simplification (applied once, 2026-09-27)

1. **Six skills became one** (D1). Cross-skill references do not survive host namespacing or per-skill hub installs, and six descriptions compete for listing budgets. The product areas stay as modules, suites and phases.
2. **"Taste / critique / anti-slop" is not a separate phase.** Taste without observation would become a handbook. It lives in the direction protocol and critique (Phase 1), the Traps and lenses of each module, and the diversity and dogma evals.
3. **Web anti-pattern rules were cut to ≤25 fingerprints.** Prior art covers static detection. Nomi's web value is measurement plus critique plus memory.
4. **Playwright was dropped for raw CDP** (D6) to keep observation zero-install. The swap stays possible behind the capture interface.
5. **Cut from V1**, each with a trigger for reconsidering: hooks (D9), MCP server, per-host agent definitions (D7), user-level taste profiles, autonomous multi-agent pipelines, non-browser observation (D11), npm-published CLI, DESIGN.md generation (D4), Antigravity native plugin (U5).
6. **The eval runner was scoped down.** Full A/B runs on two hosts (Claude Code and Codex, both installed); the other six are verified for integration and triggering only. `claude plugin eval` is reused instead of rebuilding isolation for Claude Code.
7. **Multi-host moved early (Phase 3).** Script-path resolution, sandboxes and activation behavior shape every later module; discovering them in Phase 8 would force rework.
8. **Adapter folders shrink to what hosts need.** Eight README placeholders would be architecture cosplay; `adapters/hosts.json` plus INTEGRATIONS.md replace them.

## Plan changelog

- 2026-09-27: initial plan from the master planning run (research, architecture, eight phases).
- 2026-09-27: Phase 1 DONE. D13 reversed (DNA pointer in AGENTS.md/CLAUDE.md); skill description rewritten after the continuity eval; U11 added to INTEGRATIONS.
- 2026-10-01: Architecture migration DONE. Hybrid skills (core `nomi` + `nomi-web`) replace the single skill (D14–D16); activation on existing-page edits 27/27 and observation 27/27 in the migration eval; later phases deliver `skills/nomi-<domain>/SKILL.md`; U12 added to INTEGRATIONS.
- 2026-09-30: Phase 2 DONE after the review and completion run. The seeded gate was recalibrated (baseline at ceiling; user decision); golden preference 77.8%; competitor reported. Seeded v1 and v2 archived; seeded v3 is the current suite.
