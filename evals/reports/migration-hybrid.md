# Restructuring report: hybrid skill architecture

Date: 2026-10-01. A separate architecture migration between Phases 2 and 3, not a product phase. Raw data: `evals/results/migration-hybrid/` (ledger, transcripts, frozen variant snapshots) and `evals/results/migration-discovery/`.

## Result

- **Kept: the hybrid.** A shared core (`skills/nomi`) plus one entry skill per finished domain (`skills/nomi-web` first).
- **The activation gap is closed.** On the 27 existing-page edits, Nomi now activates 27/27 and observes 27/27. Phase 2 measured 11/27 and 0/27.
- **Root cause of 11/27: the skill description, not the architecture.** The same description fix on the single skill also reached 27/27.
- **What the hybrid adds is behaviour after activation.** With equal fixes, the hybrid observed 27/27 against 21/27 for the single skill, and read the project DNA 20/27 against 15/27.
- **No regression found** in new-page creation, DNA adherence, tweak discipline, false triggering or routing.
- **Spend: $15.82** against a $20 ceiling.

## Conditions

| Item | Value |
|---|---|
| Host | Claude Code 2.1.285 during the first pilot, 2.1.286 after (Phase 2 ran on 2.1.284, so a fresh control was run) |
| Model | `claude-sonnet-5-5`, `--effort low`, $1 cap per run, 32 turns: identical to Phase 2 |
| Runner | `evals/harness/runner.mjs`, Nomi arm only, with graders unchanged from Phase 2 plus two new signals: `dnaRead`, `coreRead` |
| Cases | The 9 existing-page edit cases (`web-seeded-v1`, `-v2`, `web-seeded`) × 3 runs = the 27-run set; pilot on the 4 cases that scored 0/3 in Phase 2 |
| Phase 1 cases | `claude plugin eval`, same command as Phase 1 (`claude-sonnet-5`, file tools only), Nomi arm only |

Variants, each a frozen snapshot under `evals/results/migration-hybrid/variants/`:

| Variant | What it is |
|---|---|
| V0 `single` | The single skill at commit `071e441`, unchanged (control) |
| V1 `single-desc` | V0 with only the description changed to cover small edits |
| V1b `single-desc-b` | V1 plus a five-line "every task, in order" block at the top of `SKILL.md` |
| V2 `hybrid` | Core + `nomi-web`; the web skill told the agent to read the core first |
| V2b `hybrid-b` | V2 with the same five must-do steps written in `nomi-web` itself. **This is what ships** |

## Root cause of 11/27

Found in the Phase 2 transcripts before any change, then confirmed by the pilot.

| Evidence | Finding |
|---|---|
| Skill call position | Index 0–1 in 26/26 activated runs. Every non-activated run started by reading `index.html`. The choice is made at the first action, before the agent has seen the project |
| Prompt wording | "Polish…" 6/6 and "improve… readability" 3/3 activated: both echo the old description. "Add a card/section/list" 1/9, "improve it for phones" 0/6 |
| `.nomi/` clause | "Use… in any project that has a `.nomi/` folder" could not fire: agents found the folder at their third action, after deciding |
| Effort | Medium effort on the original skill: 0/4. More effort did not help |
| Description only (V1) | 1/8 → 8/8 on the four hardest prompts |

## Pilot (4 hardest edit prompts × 2 runs)

| Variant | Activated | Observed | Read DNA | Fixed | Cost |
|---|---|---|---|---|---|
| V0 single | 1/8 | 0/8 | 8/8 | 16/16 | $0.55 |
| V0, medium effort (×1) | 0/4 | 0/4 | 4/4 | 8/8 | $0.28 |
| V1 single + description | 8/8 | 1/8 | 2/8 | 15/16 | $0.55 |
| V2 hybrid | 8/8 | 7/8 | 2/8 | 16/16 | $0.67 |
| V1b single + description + steps | 6/6 | 6/6 | 3/6 | 12/12 | $0.55 |
| V2b hybrid + steps | 8/8 | 7/8 | 3/8 | 16/16 | $0.82 |

The pilot left the two architectures too close to call (V1b 6/6 observed, V2b 7/8), which justified the full 27-run comparison.

## 27-run activation evaluation (equal conditions)

| Metric | Phase 2 single (2.1.284) | V0 control, fresh | V1b single, fixed | **V2b hybrid** |
|---|---|---|---|---|
| Runs | 27 | 17 (stopped at the user's request) | 27 | 27 |
| Activated | 11/27 | 7/17 | 27/27 | **27/27** |
| Observed (capture produced) | 0/27 | 0/17 | 21/27 | **27/27** |
| Opened a capture | 0/27 | 0/17 | 16/27 | **24/27** |
| Read `.nomi/dna.md` | not measured | 14/17 | 15/27 | **20/27** |
| Seeded defects fixed | 53/54 | 34/34 | 54/54 | 54/54 |
| DNA "Never" decoys intact | 27/27 | 17/17 | 27/27 | 27/27 |
| New S1 introduced | 0 | 0 | 0 | 0 |
| Evidence claims valid (grader) | none made | none made | 26/28 | 39/44 |
| Cost per run | $0.073 | $0.068 | $0.096 | $0.103 |

- Observed 27/27 vs 21/27: one-sided Fisher exact p ≈ 0.01. 21/27 (78%) is under the 80% observe gate of Phase 2; the hybrid meets it.
- The 5 hybrid claims the grader marked invalid are accurate disclosures on reading ("opened only the 390 px capture, not the 1440 px one"). The grader requires every viewport named in a sentence to have been opened. It was left unchanged for this report.
- In the hybrid, all 27 activations were `nomi-web`; the core skill was never invoked for these web tasks.

## Regression checks on the hybrid

| Area | Check | Result | Before |
|---|---|---|---|
| New-page creation | 3 golden briefs, 5 valid runs (the 6th hit the account limit) | Activated 5/5 (`nomi-web`), observed 5/5, opened a capture 5/5, claims 12/12, pages with S1 0/5 | Phase 2: 9/9, 9/9, 9/9 |
| DNA adherence | Phase 1 `build-continuity` (a rule that exists only in the DNA) | 3/3, all six graders | Phase 1: 3/3 |
| DNA creation | Phase 1 `create-writes-dna` | DNA file 3/3, concrete values 2/3 (gate ≥2/3) | Phase 1: 3/3 |
| Tweak discipline | Phase 1 `tweak-respects-dna` | 3/3: no DNA write, no direction note | Phase 1: 3/3 |
| No unnecessary triggering | Phase 1 `no-trigger-backend` | 3/3: skill not used | Phase 1: 3/3 |
| Routing | Non-web task (game lore, `routing/world-lore`) | Core `nomi` 3/3, `nomi-web` 0/3 | new case |
| Functional behaviour | `npm test`, `npm run check` | Windows 77/77 (Edge), 22/22 browser and observation tests (Chrome); WSL2 76 pass + 1 Windows-only skip; check clean. One full Windows run hung once and was not reproduced in two reruns | Phase 2: 74/74, 73 + 1 |

Not rerun: `brief-style-wins` (one valid run before the account limit: serif present, the judge failed the look, as it did once in Phase 1) and `vague-brief-translated`.

## Resource discovery (verified, not assumed)

| Host and layout | Result |
|---|---|
| Claude Code, plugin (`--plugin-dir`) | Skills listed as `nomi:nomi` and `nomi:nomi-web`. On an explicit request the agent loaded the web skill, read `../nomi/SKILL.md`, ran `../nomi/scripts/nomi.mjs observe` from the project folder and opened the capture |
| Claude Code, project folder (`.claude/skills/nomi`, `nomi-web`) | Same, through `.claude/skills/nomi/…` |
| Codex 0.159.1, project folder (`.agents/skills/…`) | Read both `SKILL.md` files and ran the core CLI. Browser launch failed inside the `workspace-write` sandbox, and the agent used the `probe print web` fallback. The run then stopped on the Codex usage limit |
| Other six hosts | Not verified (Phase 3, INTEGRATIONS U12) |

## What was learned about the architecture

- **Agents do not follow "read the core first".** In 48 runs that loaded `nomi-web`, none opened the core `SKILL.md` or its references. The single skill had the same habit: its one-hop web module was read in 5 of 36 runs. So the must-do steps moved into the entry file (D15). The core holds what is only sometimes needed.
- **The shared core is shared files, not a shared conversation.** The CLI, templates and protocols are used through the sibling path; the core's own instructions are read only when the core is the entry.
- **A domain entry puts the domain's steps where they are read.** That is the measured advantage over one broad skill, and it will matter more as Motion, 3D, Game and World need their own capture steps.

## Remaining limitations

- **DNA reads drop when a skill loads.** Agents without the skill explore and read `.nomi/dna.md` every time (30/30); with the hybrid, 20/27. Outcomes held (decoys 27/27, `build-continuity` 3/3), but the step is still skipped in a quarter of runs.
- **Direction and critique protocols are never opened at low effort**, in either architecture (0 reads in Phase 2 and here). Create-tier depth depends on effort.
- **Sibling paths are an install constraint.** A host that installs skills one at a time or renames packaged folders breaks `../nomi`. Verified on two hosts only.
- **Only `nomi-web` exists.** Motion, 3D, Game and World have no folders: a folder would make an unfinished skill discoverable. `tools/check.mjs` rejects a domain skill without its full module.
- **Evidence-claim grader**: 5 false positives on honest partial disclosures.
- **Control arm incomplete**: 17 of 27 fresh V0 runs.
- All results are one model at low effort on one host.

## Costs

| Item | Runs | Cost |
|---|---|---|
| Pilots (six variants) | 42 | $3.42 |
| 27-run evaluation: hybrid, fixed single, control | 63 | $5.99 |
| Routing and new-page checks | 8 | $1.25 |
| Discovery (two layouts) | 2 | $0.13 |
| Phase 1 cases via `claude plugin eval` (includes $1.26 lost to an account limit) | 15 valid | $4.41 |
| Interrupted or limit-stopped runs (transcript cost, or a $0.10 estimate) | 7 | $0.62 |
| **Total** | | **$15.82** |

Codex discovery ran on the ChatGPT plan and is not costed.
