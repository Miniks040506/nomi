# Phase 2 eval report: observation engine and Web module

Dates: 2026-09-28 to 2026-09-30. Skill 0.1.0. Astra started the implementation and a Claude Opus review took it over. All numbers come from `evals/results/phase-2/ledger.json` and the per-run `result.json` files, re-scored with the corrected graders (`--suite regrade`).

## Environment

| Item | Value |
|---|---|
| Host under test | Claude Code 2.1.284, headless `claude -p`, fresh temp workspace and config per run. The with arm adds Nomi through `--plugin-dir`; the competitor arm adds Anthropic's `frontend-design` plugin. All arms keep the same built-in skills; no baseline run invoked any skill |
| Agent model | `claude-sonnet-5-5`, `--effort low`, $1 cap per run, 32 turns |
| Tools | Read, Write, Edit, Glob, Grep, Bash, PowerShell, Skill (native Windows, no sandbox) |
| Runs | 3 per arm per case |
| Judge | Codex `gpt-6-sol`, low reasoning, codex-cli 0.159.1 (auto-updated from 0.154.0 during the phase) using the normal Codex login; blinded, position-swapped, full-page renders at 1440 and 390 px; ties allowed |
| Engine platforms | Windows 11 with Edge 154.0.4258.37 and Chrome 154.0.8037.58 (WebSocket CDP); WSL2 Ubuntu 26.04 with portable Node 24.14.0 and chrome-headless-shell 154.0.8037.57 (pipe CDP) |
| Spend | **$13.61 of $25**. Seeded, all versions plus an early pilot: $4.02. Golden: $3.08. Adherence: $1.58. Competitor arm: $1.29. Judge: $1.19 + $1.19 (conservative token estimates). Native-skills confound pilot: $0.77. Aborted sandbox run: $0.50 (estimate) |

## Engine acceptance (AC1–AC6)

| AC | Result | Evidence |
|---|---|---|
| 1 | Pass | URL, file and directory targets on Windows with Edge and Chrome, and on Linux with chrome-headless-shell. Two viewports take 3.8 s and produce a 23-line summary (budget: 15 s, 60 lines) |
| 2 | Pass | Tests cover success, navigation failure, SIGINT and Windows tree kill, and check that no process or profile is left. A profile that stays locked now warns instead of discarding a finished capture (this was the cause of the one eval error, EBUSY) |
| 3 | Pass | Exact family, size and colour census on `web-census`. On all 7 fixtures, every seeded contrast, overflow and focus defect is found, with 0 contrast false positives. Two false-positive classes found in agents' pages are fixed and tested: optical bleed plus a desktop scrollbar at phone width, and transparent-fill stroked text |
| 4 | Pass | `diff` writes deltas and a before/after sheet |
| 5 | Pass | The `probe print web` census keys equal `observe`'s |
| 6 | Pass | A missing browser exits 2 in under 10 s with the `probe print` / "not visually verified" next step; SKILL.md §4 says the same |

Tests on final code: Windows `npm test` 74/74 with Edge; the browser and observation files 22/22 with Chrome. Linux 73 pass plus 1 Windows-only skip. `check` is clean on both. No leftover profiles.

## Behaviour (AC7b, AC7c)

Build and Create cases with a new or extended page: 3 golden and 2 adherence cases, 15 runs per arm.

| Metric | With Nomi | Baseline |
|---|---|---|
| Skill activated | 15/15 | 0/15 |
| Observed: an `observe` run whose report exists | **15/15** | 0/15 |
| Opened a capture before reporting | 15/15 | 0/15 |
| Valid evidence claims (AC7c) | **30/30** | 1/2 |

- The first grader scored only 9/15 as observed. It looked for reports only in `<workspace>/.nomi/runs`, while agents ran the CLI from the project's parent (3 runs) or the skill folder (2 runs). The path-based citation metric was always vacuous (0 citations), because agents cite evidence in prose.
- D9 (reminder hook): 100% observe-before-claim in Build/Create, so no hook.

## Outcomes

**Golden preference (AC7d), blinded and position-swapped:**
- Nomi's page was preferred in **14/18 votes (77.8%)** against the vanilla host; the gate is ≥60%.
- Per pair: orchard 0 / 1 / 1, techno 1 / 1 / 0.5, tidal 1 / 0.5 / 1.
- 7 of 9 pairs voted the same way in both orders; there were no ties.

**Competitor, reported and not gated:**
- Nomi was preferred over the `frontend-design` arm in **72.2%** of judgments. Per pair: orchard 1 / 0.5 / 0.5, techno 0.5 / 0.5 / 0.5, tidal 1 / 1 / 1.
- `frontend-design` activated in **0/9** of its runs, while Nomi activated in 9/9 on the same briefs. This compares Nomi against a host with `frontend-design` installed, not against its guidance applied.

**Pages shipped with measured S1 defects.** The harness re-rendered all final pages with the final probe; this is deterministic:

| Case | Baseline runs with S1 (findings) | Nomi runs with S1 (findings) |
|---|---|---|
| orchard-ledger | 3/3 (6, 6, 8 contrast) | 0/3 |
| techno-listening | 0/3 | 0/3 |
| tidal-lab | 2/3 (22, 19 contrast) | 0/3 |
| build-schedule | 0/3 | 0/3 |
| create-map | 3/3 (1 focus each) | 0/3 |
| **Total** | **8/15 runs, 64 findings** | **0/15 runs** |

Both arms' earlier techno "contrast failures" (2 per page) were outlined text with a transparent fill, which the final probe reports as unknown.

**Seeded defect repair (AC7a, recalibrated with the user on 2026-09-30).** Three fixture designs, 54 defect instances per arm:

| Version | Design | Baseline fixed | Nomi fixed | Nomi activated | Nomi observed |
|---|---|---|---|---|---|
| v1 (`web-seeded-v1`) | 10-line pages, defects in plain sight, category named in the prompt | 18/18 | 18/18 | 6/9 | 0/9 |
| v2 (`web-seeded-v2`) | Realistic pages, render-only defects (cascade, media query, reset), category named in the prompt | 18/18 | 18/18 | 4/9 | 0/9 |
| v3 (`web-seeded`) | Same pages; Build request that does not name the defects, only "fix any serious problems you find" | 18/18 | 17/18 | 1/9 | 0/9 |

- The original gate, "more fixed than baseline on ≥2 of 3 fixtures", had no headroom: vanilla Sonnet 5.5 repairs these S1 classes by reading code.
- Recalibrated gate (EVALUATION §5):
  - Seeded repair within noise of baseline: met, 53/54 vs 54/54. The one miss came from a run where Nomi had not loaded.
  - No new S1 in ≥90% of runs: met, 27/27 per arm.
  - Decoys intact: met, 27/27 per arm.
  - Fewer Build/Create pages shipped with S1 than baseline: met, 0/15 vs 8/15.

## Overhead

- Create (golden): $0.216 vs $0.126 per run (1.7×), 88 s vs 68 s.
- Build (build-schedule): $0.102 vs $0.074 (+38%).
- Seeded edits: +0–51%.
- The competitor arm cost about the baseline ($0.132), consistent with its skill never loading.

## Decisions and deviations

- Kept from Astra:
  - The raw CDP engine.
  - WebSocket transport on Windows (Node's stdio pipes cannot carry Chromium's inherited handles there).
  - Portable probe, bounded waits, keyboard focus pass, fingerprints as S2 questions.
  - Harness safety: pinned model, budget reservation, stop on error, no copied refresh tokens for Claude.
  - `tests/` removed from `.gitignore`, because CI in Phase 3 needs tracked tests.
- Corrected, each with evidence:
  - Cleanup that failed finished captures (EBUSY).
  - `taskkill` resolved through PATH.
  - A world-writable `/tmp` browser candidate in product discovery.
  - Phone viewports rendered with a desktop scrollbar.
  - Overflow flagged on ≤8 px optical bleed.
  - Contrast failed on transparent-fill text.
  - Graders tied to one folder.
  - The vacuous citation metric.
  - "New S1" not relative to the fixture.
  - A stale ledger path for one retry.
  - Judge renders resolving to the repo-root `.nomi/`.
  - The contamination check matching temp paths.
  - The judge had never run: npm `.cmd` shim, `--image` swallowing the prompt, and a copied access token rejected with 401. It now uses the normal Codex login with user config, rules and history excluded.
- SKILL.md now says to run the CLI from the project folder, and that a visual Tweak fix is observed whenever a browser is available.
- Superseded seeded cases are moved to `web-seeded-v1` and `web-seeded-v2`, not deleted. Failed attempts that never reached a model are recorded at $0 under `/failed-*` keys.

## For Phase 3

- **Triggering on edits to existing pages is the main gap.** Activation was 11/27 on "improve/add to this page" prompts at low effort, against 15/15 on new-page briefs. The trigger suite must include such prompts before the description is tuned. Seeded outcomes only reflect Nomi when it loads.
- U1: agents resolve `<skill-dir>` but sometimes run from the skill folder or the project's parent, so check where runs land on each host.
- Codex, as judge and later as a driver:
  - Use the normal login.
  - Expect auto-updates mid-run.
  - Spawn the npm shim through Node on Windows.
- Competitor arms need proof of activation; an installed-but-unused skill is not a comparison with its guidance.
