# Nomi Evaluation

How Nomi proves it changes what agents do, and that the change is better. Every phase adds suites here; results go to `evals/reports/`. A claim in any doc without a result behind it is a defect.

## 1. Claims to prove

| # | Claim | Evidence that settles it |
|---|---|---|
| C1 | Nomi changes behavior wherever it activates: tier choice, direction before code, DNA use, observation, evidence-bound critique | Transcript and workspace graders on behavior suites |
| C2 | Outcomes improve over the same host without Nomi | Seeded-defect repair re-measured deterministically; blinded pairwise judgments on golden briefs |
| C3 | Projects stay consistent across sessions and agents | Continuity suites: session 2, possibly on another host, respects session 1's DNA and canon |
| C4 | Nomi does not homogenize and does not override explicit briefs | Diversity suite (style dispersion across briefs); anti-dogma suite (decoys and brief-requested "default" styles) |
| C5 | Overhead is proportional | Token and wall-time overhead per tier versus baseline |
| C6 | Nomi installs and activates on the eight hosts as documented | `tools/verify-hosts.mjs` evidence and trigger suites (`INTEGRATIONS.md` §7) |

## 2. Layers

| Layer | What | Cost | When |
|---|---|---|---|
| L0 Static | `npm run check`: Agent Skills rules, budgets (ARCHITECTURE §12), link integrity, vendor-neutrality lint, manifest consistency and schemas, `claude plugin validate .` when available | Free | Every change |
| L1 Unit | `npm test` (`node --test`): CLI commands on fixtures, probes against fixture pages in a real headless browser, canon checks | Free | Every change |
| L2 Behavior | Agent-in-the-loop, graded from transcripts and workspaces: activation, tier behavior, adherence, citation validity | Model calls | Each phase |
| L3 Outcome | A/B against baseline: seeded defects, golden briefs, continuity, diversity, anti-dogma, overhead | Model calls + judge | Each domain phase; full at release |
| L4 Release | Full matrix, human panel, host re-verification | Highest | Phase 8 |

## 3. Suites

| Suite | Phase | Kind | Cases | Primary metric | Hosts |
|---|---|---|---|---|---|
| `core` | 1 | L2 | Discriminating: build-continuity (a DNA-only rule), create-writes-dna, vague-brief-translated (judge on the visual system). Guards that the baseline already passes: tweak-respects-dna, no-trigger-backend, brief-style-wins | With/without score per case; guards must not regress | Claude Code |
| `web-seeded` | 2 | L3 | Build requests on three existing pages whose S1 defects are render-only and not named by the prompt: tide leads (dusk-panel contrast, mobile-only strip overflow), reading talks (night-palette contrast, focus reset), bench prices (white-on-amber pill, `nowrap` ticket overflow); uppercase-code, masthead and square-card decoys. Archived: `web-seeded-v1` (defects in plain sight) and `web-seeded-v2` (render-only defects, category named in the prompt) both hit the baseline ceiling | Seeded S1 defects fixed, new S1 introduced | Claude Code; Codex from 3 |
| `web-golden` | 2 | L3 | 3 contrasting briefs | Blinded pairwise preference | Claude Code; Codex from 3 |
| `web-adherence` | 2 | L2 | 2 Build/Create tasks | Observe-before-claim, citation validity | Claude Code |
| `discovery` | migration | L2 | One explicit request for the web skill, run in each install layout (`--install plugin` or `project`) | Web skill loaded, core files resolved, capture produced and opened | Claude Code; other hosts in 3 |
| `routing` | migration | L2 | A non-web creative task (game lore) | Core skill loads, web skill does not | Claude Code |
| `trigger` | 3 | L2 | `evals/cases/trigger/prompts.json`: 15 should-trigger prompts (7 edits to existing pages, 2 new pages, 1 review, 5 non-web creative tasks that must route to the core) and 15 should-not (backend, tests, tooling, three of them inside a web project). Each run is cut after the first actions (3 turns on Claude Code; first skill read or 4 commands on Codex) | Recall, false-trigger rate, routing | Claude Code, Codex (the two hosts with a transcript driver) |
| `host-smoke` | 3 | L2 | `tools/verify-hosts.mjs`: temp project → project install → one explicit prompt → skill activated, `doctor` ran (`domains web`), capture produced and where, a number read from an image, subagents (self-reported) | Pass = activation and a script run | Every host CLI present |
| `motion-seeded` / `motion-golden` | 4 | L3 | 3 fixtures (`transition: all`, layout-property animation, uniform 300 ms ease, 12 simultaneous fade-ups, no reduced-motion); 2 briefs | Seeded fixes; preference | Claude Code, Codex |
| `3d-seeded` / `3d-golden` | 5 | L3 | 3 fixtures (ambient-only light without tone mapping; dead-center camera with near-plane clipping; unbounded controls, uncapped DPR, 300+ draw calls); 2 briefs | Seeded fixes; preference | Claude Code, Codex |
| `game-seeded` / `game-golden` | 6 | L3 | 3 fixtures (symmetric floaty jump; no coyote time or buffer; 3-frame input delay; hits without feedback); 2 briefs | Measured feel metrics vs targets; preference | Claude Code, Codex |
| `world-seeded` / `world-continuity` / `crossdomain-golden` | 7 | L3 | Contradictions, undefined and generic names; two-session (two-host) canon growth; small browser game with world and UI | Contradictions introduced; coherence preference | Claude Code, Codex |
| `diversity` | 8 | L3 | 6 contrasting briefs (for example a children's reading app, a compliance dashboard, a techno festival, a bakery, CLI documentation, a watchmaker) | Style-fingerprint dispersion vs baseline | Claude Code, Codex |
| `dogma` | 8 | L3 | 3 decoy cases: the brief or DNA asks for a look that Nomi's fingerprints list | Brief followed; decoys left intact | Claude Code, Codex |
| `overhead` | 8 | L3 | Tweak and Build tasks | Token and time overhead | Claude Code, Codex |

## 4. Graders

**Deterministic** (preferred for anything objective)
- File, regex and DNA-rule checks on the workspace.
- Neutral re-measurement: after a run, the harness (never the agent) renders both arms' outputs with the Nomi engine and compares seeded-defect detectors. Each seeded defect has an id, severity, detector and fix criterion.
- Canon checks for World suites.

**Transcript**
- Activation signal per host (driver-specific).
- Observe-before-claim: an observe command succeeded, meaning its output names a run whose `report.json` exists anywhere in the eval's temp root (agents run the CLI from the project, its parent or the skill folder). "Looked" additionally requires a capture to have been opened.
- Evidence-claim validity (the citation metric): agents cite evidence in prose, not paths. Each final-report sentence that says a screenshot or capture was opened, viewed or shows something must be backed by an opened image of each viewport it names. Each "N findings" must match a report the session produced. Sentences that disclaim ("did not open") are not claims.
- Tier behavior: no DNA write, direction note or critic for Tweak prompts.

**Judge**
- Pairwise and blinded: the judge sees the brief and neutral renders only (no code, no `.nomi/`, no transcript), both orders (position swap), ties allowed.
- Rubric: fit to brief, distinctiveness (would not be mistaken for a generic template), craft (no broken details), coherence.
- The judge model comes from a different vendor than the agent under test by default; the judge model is recorded with every result.

**Human** (release): at least two raters on the same blinded pairs, same rubric, agreement reported.

**Anti-Goodhart rules**
- Measurements the agent can see (census counts, fingerprints) are never the only grader of taste. Taste is judged by judges and people.
- Objective S1 checks (contrast, overflow, focus, latency, contradictions) are fine to grade deterministically.
- Every seeded fixture contains decoys, intentional choices that look like defects (for example DNA-declared all-caps labels). "Fixing" a decoy counts as a regression.

**Grader lessons from Phase 1** (apply to every later suite)
- A continuity rule only discriminates if it conflicts with a model habit. Current models copy the style of existing code unprompted, so rules the code already shows (no cards, one accent colour) pass without Nomi.
- Regexes for Never items must match violations, not mentions: `border-radius: 0` enforces "no rounded corners". Test every grader pattern against compliant and violating snippets before a run.
- Judge the visual system, not the copy: specific copy on a default-cluster page passed a lenient rubric. Design rubrics use a stronger judge than the default one.

**Lessons from the hybrid migration** (2026-10-01, `evals/reports/migration-hybrid.md`)
- Activation is decided at the first action, from the prompt wording and the skill description alone. A trigger that depends on project contents ("has a `.nomi/` folder") cannot fire. Test descriptions with edit prompts, not only creation prompts.
- Activation is not adherence. Report what the agent did after loading the skill: observed, opened a capture, read the DNA (`behavior.dnaRead`), opened the core (`behavior.coreRead`).
- Compare architectures with a control that isolates the cause: the same description fix on the single skill showed that wording fixes activation, and that the entry file's own steps drive observation.
- A host update between runs (2.1.284 to 2.1.286 here) means a fresh control arm, not reuse of older numbers.

**Grader lessons from Phase 2**
- A seeded defect only measures observation if code reading alone misses it. Literal values in plain sight (`color:#aaa`, `width:1400px`, `outline:none`) and prompts that name the defect class ("for phones and keyboards") let the baseline fix everything (v1 and v2: 36/36 per arm).
- Find evidence by run id, not by a fixed folder. A path-bound grader scored 5 of 9 real observations as missing.
- "New S1" is relative to the untouched fixture's own findings; a pre-existing unlisted finding is not new.
- Judges see full-page desktop and phone renders. Briefs put required content below the first screen.

## 5. Metrics and gates

Initial gates; recalibrate after the first baseline run and record any change here with the reason.

Recalibration 2026-09-30 (user decision, Phase 2):
- The seeded gate "with Nomi fixes more than baseline on ≥2 of 3 fixtures" had no headroom. The baseline fixed 54/54 seeded S1 defects across three fixture designs (plain-sight, render-only, and unmentioned in Build requests).
- Seeded repair now guards against regression. The discriminating outcome is how often Build/Create pages ship with measured S1 findings.
- The single Nomi-arm miss (53/54) came from a run where the skill had not loaded.

| Metric | Phase gate | Release gate |
|---|---|---|
| Trigger recall / false-trigger rate | ≥0.85 / ≤0.15 (Phase 3) | ≥0.90 / ≤0.10 |
| Observe-before-claim (with Nomi, Build/Create) | ≥80% (Phase 2) | ≥90% |
| Citation validity | ≥95% | ≥95% |
| Tweak over-processing (direction note, DNA write or critic on a Tweak) | ≤20% | ≤10% |
| Seeded defects | Recalibrated 2026-09-30, see below. Seeded repair within noise of baseline (at most 1 defect below it per fixture over 3 runs); no new S1 in ≥90% of runs; decoys intact | More fixed than baseline where the baseline leaves headroom; otherwise the Phase 2 rule |
| Shipped S1 (Build/Create pages, harness re-render) | Fewer runs with Nomi ship a page with S1 findings than baseline | Same |
| Blinded preference vs vanilla host | ≥60% | ≥65% |
| Continuity | DNA or canon violations in session 2 below baseline in ≥2 of 3 cases | Same |
| Diversity | Style dispersion across briefs ≥ baseline; no single fingerprint cluster above 40% of Nomi outputs | Same |
| Anti-dogma | Brief-requested style followed in ≥90% of runs; decoys intact | Same |
| Overhead (median tokens vs baseline) | Tweak ≤ +15%, Build ≤ +60%; Create reported | Same |

## 6. Runners and isolation

- **`claude plugin eval`** (Claude Code ≥2.1.269) runs behavior suites with built-in with/without-plugin arms, three runs per arm, and cost ceilings (`--max-cost-usd`). Suites that grant Bash run under WSL2 or Linux, because native Windows has no sandbox backend. Suites that only need file tools run natively; scaffold scripts run natively too (via Git Bash). Always pass `--no-publish`, because reports publish to claude.ai by default. Pin the agent model (`--model`) and use `--judge-model sonnet` for design rubrics. Its judge is a Claude model, so cross-vendor judging starts with the Nomi runner in Phase 2.
- Standard invocation: `claude plugin eval . --tag <suite> --model claude-sonnet-5 --judge-model sonnet --allow-tools Write Edit --scaffold --trust-plugin --no-publish -j 4 --max-cost-usd 25`.
- **Nomi runner** (`evals/harness/`, Phase 2) runs outcome A/B: a fresh temp workspace per run, the host's headless CLI, post-run neutral rendering, deterministic, transcript and judge graders. Phase 2 ships the Claude Code driver; Phase 3 adds Codex (full A/B) and trigger/smoke drivers for the remaining hosts.
- **Baseline hygiene**: the baseline arm must show zero Nomi activation; each result records host version, model, and the list of installed skills and plugins, because other installed skills (for example a design skill) change the baseline.
- **Competitor baseline** (optional, reported, never gated): web suites may add an arm with Anthropic's `frontend-design` skill so Nomi's value over the strongest common alternative is visible.

Phase 2 runner command (native Windows, shell access through the headless CLI rather than `claude plugin eval`):
```text
node evals/harness/runner.mjs --suite web-seeded,web-golden,web-adherence --model claude-sonnet-5-5 --arm both --runs 3 --cap 1
node evals/harness/runner.mjs --suite judge --model claude-sonnet-5-5
node evals/harness/runner.mjs --suite regrade --model claude-sonnet-5-5
node evals/harness/runner.mjs --suite web-golden --arm competitor --runs 3 --cap 1 --model claude-sonnet-5-5
node evals/harness/runner.mjs --suite judge --versus competitor --model claude-sonnet-5-5
```
`judge` renders both arms full-page at 1440 and 390 px (cached under `judge-renders/`) and asks a Codex model (`gpt-6-sol`, low reasoning, normal Codex login) for a blinded, position-swapped vote. The `competitor` arm loads Anthropic's `frontend-design` plugin (`NOMI_COMPETITOR_PLUGIN` overrides the path); report its activation, because an installed but unused skill is not a comparison with its guidance. `regrade` re-scores saved transcripts and workspaces after a grader change without model calls; it needs the temp workspaces the results point to. Variant runs: `--plugin-root <dir>` loads the skills and manifest from a snapshot (for example a `git archive` of an earlier commit), `--label <name>` keeps variants apart in one ledger, `--install project` copies the skill folders into the workspace's `.claude/skills/` instead of loading a plugin, `--effort <level>` and `--ceiling <usd>` set the host effort and the ledger's spend limit, and `--case a,b` selects cases. A case with `"render": false` in `nomi.json` skips the neutral render. `--out` defaults to `evals/results/phase-2`. Keep one runner active against its shared ledger. Existing successful runs are reused; errors stop the suite and require inspection plus `--retry-errors`. Unknown costs block further spending. All pilots and retries count toward $25. The `--cap` is per Claude run; judge token costs are conservative estimates and must be reported separately. Do not compare a baseline with disabled native skills against an arm that retains them.

Phase 3 additions to the runner:
```text
node evals/harness/runner.mjs --suite trigger --arm with --runs 1 --out evals/results/phase-3                         # Claude Code
node evals/harness/runner.mjs --suite trigger --host codex --model gpt-6.1-sol --arm with --runs 1 --out evals/results/phase-3
node evals/harness/runner.mjs --suite trigger-report --model gpt-6.1-sol --out evals/results/phase-3
node evals/harness/runner.mjs --suite web-seeded --host codex --model gpt-6.1-sol --arm both --runs 3 --out evals/results/phase-3
node tools/verify-hosts.mjs [--hosts a,b] [--record] [--keep]
```
- `--host codex` runs `codex exec --json` in the temp workspace: with arm = the skill folders in `.agents/skills`, baseline = none. Its events are converted to the shape the Claude graders read: a command becomes a shell call, a read of a Nomi `SKILL.md` is the activation signal (Codex has no skill tool), `.md`/`.png` paths in successful commands count as reads.
- Codex isolation is weaker than Claude Code's: the normal login and user config apply (`--ignore-user-config` makes `exec` reject every command), with `--ignore-rules --ephemeral --disable memories`. User-level skills in `~/.agents/skills` are visible to both arms. Record them with the result.
- Codex is plan-billed: the ledger records cost 0 and results carry token usage. Usage limits, not dollars, bound a Codex run.
- Codex does not emit an event when it views an image, so "opened a capture" and evidence-claim validity are not measurable there; only "observed" (a run report exists) is.
- A suite is either a folder of case folders or one `prompts.json` (`id`, `prompt`, optional `fixture`, `expect`: `nomi-web`, `nomi` or `null`). Prompt-list runs skip the neutral render and are cut short on purpose; a turn-limit stop is not an error there.

## 7. Case format

Cases share a directory layout. Core cases use `claude plugin eval`; the shell-driven Web cases use the Nomi runner:
```
evals/cases/<suite>/<case>/
├── prompt.md        frontmatter: max_turns, allowed_tools, tags · body: the user prompt
├── case.yaml        scaffold script, add_dirs (optional)
├── graders/*.md     regex | tool_used | tool_order | file_exists | llm   (read by claude plugin eval)
└── nomi.json        Nomi-only: tier expectation, seeded defects + decoys, deterministic graders, judge rubric id
evals/fixtures/<name>/   shared fixture projects
```
`claude plugin eval` ignores `nomi.json`. The Nomi runner reads `prompt.md` and `nomi.json` (fixture directory, target, tier, defects and tested regex rules). It does not interpret `case.yaml` shell scaffolds or Markdown graders; Web cases need neither. Avoid claiming interchangeable runner support. Both arms receive a copy of the same fixture, with no repository instructions.

## 8. Cost and cadence

- L0 and L1 on every change.
- Per phase: that phase's suites, three runs per arm, one or two hosts, a default ceiling of $25 unless the user raises it.
- Release: the full matrix with a user-set ceiling; runs parallelized (`-j`) where the runner allows.

## 9. Reporting

`evals/reports/<phase-N | vX.Y>.md` records: environment (hosts, versions, models, OS), suites and cases, with/without means, per-run spread, Δ, cost, notable transcript excerpts, regressions, and decisions taken because of the results.

## 10. Anti-theater checklist

- [ ] Every gate compares against a baseline, not an absolute score.
- [ ] No grader rewards using Nomi's vocabulary; graders check outcomes and verifiable actions.
- [ ] Judges never see which arm produced an output or any Nomi artifacts.
- [ ] Seeded fixtures include decoys.
- [ ] Results report spread, not only means; single-run results are never used for decisions.
- [ ] Failing results are reported with the same prominence as passing ones.
