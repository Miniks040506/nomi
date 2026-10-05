# Phase 4 report: Nomi Motion

Date: 2026-10-05. Status: **DONE**. All six acceptance criteria are met, check and tests are green on Windows and Linux, and every planned eval run is complete on both hosts. Raw data: `evals/results/phase-4/` (Codex), `evals/results/phase-4-claude/` (Claude Code), `evals/results/phase-4-trigger/` (activation investigation), `evals/results/phase-4-pilot/` (discarded pilot).

## Acceptance criteria

| # | Criterion | Result |
|---|---|---|
| 1 | Inventory exact on fixtures: durations, easings, properties, targets | **Met.** `tests/motion.test.mjs` compares all six load animations and three declared transitions of `evals/fixtures/motion-census` field by field |
| 2 | Contact sheet shows ≥8 frames spanning load | **Met.** `load.png` holds 8 frames, the first at 0 ms and the last at the settle time |
| 3 | Reduced-motion non-compliance detected | **Met.** The cards, the bar and the hovered button are flagged; the spinner and the link, which have a reduced-motion rule, are not |
| 4 | Settle time within ±100 ms of ground truth | **Met.** 983, 1000 and 1017 ms in three captures against 1000 ms; 900 ms page within ±100 ms under a parallel test run |
| 5 | A motion capture finishes in ≤30 s | **Met.** 11.9–12.7 s with three interaction steps; about 6 s without steps |
| 6 | Evals on Claude Code and Codex: more seeded defects fixed than baseline on ≥2 of 3 fixtures, decoys intact, critiques quote measured timings | **Met, with two caveats.** Claude Code: ahead on 3 of 3 fixtures (19/24 against 12/24). Codex: ahead on 2 of 3 (23/24 against 18/24), tied on one at the baseline ceiling. Decoys intact in all 36 runs. Caveats: on Claude Code Nomi loaded in only 4 of 9 runs, so one fixture win is noise; measured timings are quoted on Claude Code (16/17) and barely appear in Codex reports. Golden briefs: Nomi preferred in 66.7% of blinded votes on each host (gate ≥60%) |

## Environment

| Item | Value |
|---|---|
| Machine | Windows 11 (10.0.26300), Node 24.21.0, Edge and Chrome |
| Claude Code | 2.1.289 (updated since Phase 3's 2.1.286), `claude-sonnet-5-5`, effort low, plugin install, isolated config |
| Codex | codex-cli 0.159.3, `gpt-6.1-sol`, effort low, project install, `workspace-write` sandbox, `NOMI_BROWSER_NO_SANDBOX=1` (D17), user config and user-level skills visible to both arms |
| Linux (WSL2) | Ubuntu, portable Node 24.21.0 and chrome-headless-shell 154.0.8037.92 in `~/nomi-toolchain` (downloaded with the user's approval; three browser libraries unpacked from Ubuntu packages beside it, nothing installed system-wide) |

## Tests and checks

- `npm run check`: clean. New rule: a domain module inside the core (`references/<domain>.md`) must carry the six-section contract.
- `npm test`, Windows, final code: 95/95 in 62 s (Edge). Seven tests are new for motion (script validation, findings, summary budget, capture on the fixture, bounded capture on a page that never rests, CLI errors, harness grading); two cover the harness changes.
- `claude plugin validate .`: passes (with warnings, as before).
- Linux, final code: WSL2 (Ubuntu, portable Node 24.21.0, chrome-headless-shell 154.0.8037.92 with `libnspr4`, `libnss3` and `libasound2` unpacked beside it): `check` clean, 94 pass + 1 Windows-only skip, in 35 s.

## Seeded suite (`motion-seeded`)

A defect counts as fixed when its finding code is gone from the harness's own motion run and the page still has load motion. Decoys are the DNA-requested live dot, 2 px press and 900 ms tick. Three runs per arm on each host.

**Grader correction (2026-10-05).** The first grading scored the seed shop's "all 12 packets enter at the same moment" defect as unfixed in every run. That was a grader error: its DNA asks for a row-by-row entrance, a row holds six packets at 1440 px, and six elements starting together still raised the same-moment fingerprint. The defect is now "seven or more elements at the same moment" (`minCount` in the case), and all stored neutral runs were re-scored without new model calls. The tables below are the corrected scores.

**Claude Code** (18 runs, $1.64):

| Fixture | Arm | Nomi loaded | Motion captured | Defects fixed | Decoys intact | New S1 runs | Pages with S1 |
|---|---|---|---|---|---|---|---|
| clinic-reminders | without | 0/3 | 0/3 | 4/9 | 3/3 | 0/3 | 1/3 |
| clinic-reminders | with | 0/3 | 0/3 | 6/9 | 3/3 | 0/3 | 1/3 |
| ferry-notice | without | 0/3 | 0/3 | 2/6 | 3/3 | 1/3 | 1/3 |
| ferry-notice | with | 1/3 | 1/3 | 4/6 | 3/3 | 0/3 | 0/3 |
| seed-badges | without | 0/3 | 0/3 | 6/9 | 3/3 | 0/3 | 0/3 |
| seed-badges | with | 3/3 | 3/3 | 9/9 | 3/3 | 0/3 | 0/3 |
| **Total** | without | 0/9 | 0/9 | 12/24 | 9/9 | 1/9 | 2/9 |
| **Total** | with | 4/9 | 4/9 | 19/24 | 9/9 | 0/9 | 1/9 |

- With Nomi ahead on 3 of 3 fixtures. Only seed-badges is a clean Nomi effect: Nomi loaded 3/3 and the entrance was made row by row 3/3, against 0/3 without. The ferry gain coincides with activation in one run of three. The clinic gain (6/9 against 4/9) came from runs where Nomi never loaded, so it is noise.
- Per defect, with against without: same-moment entrance 3/3 and 0/3; `reduced-motion` 8/9 and 7/9; `transition-all` 6/6 and 5/6; layout property 2/6 and 0/6.

**Codex** (18 runs, plan-billed):

| Fixture | Arm | Nomi read | Motion captured | Defects fixed | Decoys intact | New S1 runs | Pages with S1 |
|---|---|---|---|---|---|---|---|
| clinic-reminders | without | 0/3 | 0/3 | 8/9 | 3/3 | 0/3 | 0/3 |
| clinic-reminders | with | 3/3 | 3/3 | 8/9 | 3/3 | 0/3 | 0/3 |
| ferry-notice | without | 0/3 | 0/3 | 3/6 | 3/3 | 0/3 | 0/3 |
| ferry-notice | with | 3/3 | 3/3 | 6/6 | 3/3 | 0/3 | 0/3 |
| seed-badges | without | 0/3 | 0/3 | 7/9 | 3/3 | 0/3 | 0/3 |
| seed-badges | with | 3/3 | 3/3 | 9/9 | 3/3 | 0/3 | 0/3 |
| **Total** | without | 0/9 | 0/9 | 18/24 | 9/9 | 0/9 | 0/9 |
| **Total** | with | 9/9 | 9/9 | 23/24 | 9/9 | 0/9 | 0/9 |

- With Nomi ahead on 2 of 3 fixtures and tied on clinic, where the baseline is at the ceiling (8/9).
- The difference is two defects a model does not look for unprompted and the capture names: the bar that animates `width` (3/3 against 0/3) and the same-moment entrance (3/3 against 1/3).
- The Codex baseline adds a reduced-motion rule unprompted in every run (9/9), so `motion.reduced-motion` has no headroom there.
- Codex final reports are short and quote almost no timings (4 `ms` values in 15 with runs, 3 of them measured), so "critiques quote measured timings" is shown on Claude Code only.

**Rerun of the with arm after one more change** (the capture now prints the DNA's Motion section beside the measurements, and the module calls a contradiction drift to fix). The change was made to cure the same-moment miss before it was known to be a grader error, so it has no measured benefit: Claude Code 18/24 with Nomi loading in 6/9 runs; Codex 23/24. Both are within one defect of the first with-arm runs. The change stays because it puts declared and measured values in one read; it is not evidence of anything.

## Golden suite (`motion-golden`)

| Host | Arm | Runs | Nomi loaded | Motion captured | Pages with `motion.reduced-motion` |
|---|---|---|---|---|---|
| Claude Code | without | 6 | 0/6 | 0/6 | 0/6 |
| Claude Code | with | 6 | 6/6 | 6/6 | 0/6 |
| Codex | without | 6 | 0/6 | 0/6 | 0/6 |
| Codex | with | 6 | 6/6 | 6/6 | 0/6 |

Both arms ship reduced-motion support on new pages, so the deterministic outcome does not discriminate.

Blinded pairwise judgment (`gpt-6-sol`, low reasoning, position-swapped; the judge sees each page's load sheet and its final frame):

| Host under test | Pairs | Votes for Nomi | Preference | Gate |
|---|---|---|---|---|
| Claude Code | 6 | 8/12 | 66.7% | ≥60% |
| Codex | 6 | 8/12 | 66.7% | ≥60% |

- Per pair on Claude Code: 0.5, 0, 1 (crew board) and 1, 0.5, 1 (bakery). On Codex: 0.5, 1, 1 and 0, 1, 0.5. No ties were voted.
- Twelve votes per host is a small sample: 8/12 is above the gate, and 7/12 would not be.
- The Codex row is not cross-vendor (a Codex model judging Codex output). The Claude Code row is.
- One Codex Create run with Nomi exceeded the harness's 600 s limit (median 300–435 s); the limit for Codex is now 900 s.

## Adherence (with-Nomi runs on Claude Code)

| Signal | Result |
|---|---|
| Nomi loaded, Build prompts on existing pages | 4/9 |
| Nomi loaded, Create briefs | 6/6 |
| Of the 10 runs that loaded Nomi: ran `observe --motion` | 10/10 |
| … opened a capture | 10/10 |
| … read `references/motion.md` (one hop from `nomi-web`) | 10/10 |
| Evidence claims valid | 25/25 |
| `N ms` values in final reports that a run of the session measured | Build 16/17; Create 4/11 |
| Baseline, same measure | 0/10 quoted values measured (no captures) |

In Create reports most unmatched values are design values the agent chose and wrote into the page (for example a stagger step), stated before measuring. The grader cannot tell a stated intention from an unmeasured claim.

## Finding that changed the design: a third listed skill costs activation on Claude Code

Phase 4 first shipped motion as a third entry skill, `nomi-motion`. On Claude Code 2.1.289 the with-Nomi arm then stopped loading any skill on ordinary page edits. Controlled runs (low effort, the clinic and ferry Build prompts, with arm only):

| Skill layout | Nomi loaded |
|---|---|
| Phase 3 skills (`nomi`, `nomi-web`), 6 of the 16 runs with the new script files added | 11/16 |
| Three skills, full descriptions | 0/6 |
| Three skills, raised listing budget (`SLASH_COMMAND_TOOL_CHAR_BUDGET=30000`) | 0/4 |
| Three skills, descriptions cut to about 200 characters | 3/8 |
| Three skills, `nomi-motion` narrowed to "motion itself" | 0/6 |
| Three skills, animation moved into the web description | 0/6 |
| Phase 3 skills plus `nomi-motion` only | 0/6 |
| Phase 3 core description, three skills | 1/6 |
| Two skills, core description without "animation" | 1/6 |
| **Final: two skills, Phase 3 descriptions, motion as a core module** | 3/6, then 1/6 in the suite (4/12) |

- A plain motion request ("design the motion for this page") routed to `nomi-motion` in 7/7 runs, so the skill itself was discoverable. The loss was on page edits, the common case.
- Medium effort did not rescue the three-skill layout (0/3 on clinic).
- The host mechanism is not identified. Claude Code caps the skill listing at 1% of the context window and drops descriptions by priority when over, but raising that budget did not help, and its debug log prints nothing about it.
- Decision D20: motion is a module of the core, `skills/nomi/references/motion.md`, held to the six-section contract; `nomi-web` and the core carry its must-do lines. In the final runs every agent that loaded `nomi-web` followed the pointer.
- The final layout still activates less than the Phase 3 controls on these two prompts (4/12 against 11/16), and far less than the 27/27 measured on 2.1.286 in the migration. Activation on Build prompts over existing pages is the main open risk and belongs to Phase 3's trigger gate on Claude Code, which has never been run in full.

## Other findings

1. **Fixture realism.** Two pilots were discarded: agents in both arms removed a "draft saved" notice that had no draft behind it, which erased three seeded defects. The fixture now shows a restored draft in the form. The low-effort Claude batch (13 runs) and a medium-effort batch (7 runs) were stopped during the activation investigation and are not in the tables.
2. **Codex backgrounds slow commands.** A 10 s capture has an `item.started` but no `item.completed` in `exec --json`. The grader counted no observations until it was changed to count the runs such a command left behind.
3. **Byte-order marks.** Codex wrote the interaction script with PowerShell, which adds one. `observe --interact` now strips it.
4. **An opacity pulse is not travel.** The first reduced-motion rule flagged every loop. It now flags only transform, position and layout animation, so a DNA-requested live dot is not a violation.
5. **A grader that punished the right fix.** See the grader correction above: every agent that staggered the entrance by rows, as the DNA asks, was scored as not having fixed it. The lesson for later suites: a fingerprint threshold is not a defect definition; state the seeded defect in the case and test the grader against a correct fix before the run.
6. **`report.json` grows with the page.** A motion report lists every animation (cap 300); the summary groups them.

## Costs

| Item | Runs | Cost |
|---|---|---|
| Claude Code, final suites (seeded and golden) | 30 | $3.88 |
| Claude Code, with-arm rerun after the DNA Motion note | 9 | $1.08 |
| Claude Code, stopped batches and interrupted runs (charged at the cap when unknown) | 21 | $4.01 |
| Claude Code, activation investigation | 97 | $8.98 |
| **Claude Code total** | | **$17.95 of $25** (plus the judge estimate below) |
| Codex agent runs | 51 completed, 4 failed or interrupted (lost login, usage limit, one timeout) | plan-billed; 180–880k input tokens per run |
| Judge (Codex, both hosts) | 24 votes | plan-billed; $1.35 by the harness's upper estimate |

Overhead on Claude Code, cost per run with against without: Build $0.109 against $0.073 (+49%, with Nomi loading in 4/9); Create $0.205 against $0.168 (+22%).

## Completion

Nothing is outstanding for this phase. The A/B runs are stored under the label `fold`, the with-arm rerun under `fold2`. The Linux toolchain lives in `~/nomi-toolchain` inside WSL2; run tests there with `PATH`, `LD_LIBRARY_PATH` (its `libs/usr/lib/x86_64-linux-gnu`) and `NOMI_BROWSER` pointing into it.

## Risks and limitations

- **Activation on Claude Code** is the largest risk to every Nomi domain, not only motion (see above). Adding a 3D, game or world skill as a new listing would likely repeat the loss; D20 requires measuring it first.
- **Seeded evidence is thin.** Three runs per arm. The clean effects are two defects on Codex (3/3 against 0/3 and 3/3 against 1/3) and one on Claude Code (3/3 against 0/3). The clinic fixture shows no Nomi effect on either host.
- **The first report of these results was wrong** about the same-moment entrance (it said no agent fixed it). The correction came from reading agent reports against the neutral run, not from a test; other graders in this suite have had the same single review.
- **A known test race.** `a failed navigation leaves no browser profile behind` (Phase 2) counts temporary browser profiles while other test files launch browsers; it failed once in four full runs after the motion tests were added.
- **Only Web Animations are measured.** Canvas, `requestAnimationFrame` tweens and video are invisible to the capture; libraries that drive styles from script are not covered.
- **Replay is not filming.** Frames show what the animation data says at each time. Anything else that changes with time, and side effects of end handlers that run again, are outside it.
- **Late starts.** Motion that begins more than 300 ms after the page went still is missed unless a `wait` step asks for it.
- **Long frames** in a headless browser are indicative only.
- **Timing-quote grader** counts chosen design values in Create reports as unmeasured.
- **Codex judging Codex** would not be cross-vendor; Claude Code outputs judged by Codex are.
