# Phase 1 eval report — `core` suite

Date: 2026-09-27. Skill version: 0.1.0 (`skills/nomi/`).

## Environment

| Item | Value |
|---|---|
| Runner | `claude plugin eval` (Claude Code 2.1.283), isolated runs, with/without-plugin arms |
| Agent under test | `claude-sonnet-5` (pinned) |
| Judge | `sonnet` (`--judge-model sonnet`; the default judge was too lenient on design rubrics) |
| Tools | Read, Glob, Grep, Skill, Write, Edit, TodoWrite. No shell: native Windows has no sandbox backend, so every case exercised the skill's no-scripts path (acceptance criterion 5) |
| OS | Windows 11; scaffold scripts ran natively through Git Bash |
| Runs | 3 per arm per case |
| Total Phase 1 eval spend | About $21.5 (RED baseline $1.5, smoke $1.8, first A/B $7.4, diagnosis $1.2, invalid run $0.1, final A/B $9.5); within the $25 ceiling |
| Command | `claude plugin eval . --tag core --runs 3 --model claude-sonnet-5 --judge-model sonnet --allow-tools Write Edit --scaffold --trust-plugin --no-publish -j 4 --max-cost-usd 25` |

## RED: baseline before the skill existed

Run against the plugin with no skill (1–2 runs per case, about $1.50 in total), to see what the base model does on its own.

| Case | Baseline | What happened |
|---|---|---|
| tweak-respects-dna | pass | Changed the label, nothing else |
| no-trigger-backend | pass | — |
| brief-style-wins | pass | Delivered the requested cream + serif + terracotta look |
| build-continuity | fail 2/2 | Never opened `.nomi/dna.md`; used `<input type="date">` although the DNA says walks only run on listed tides. It copied the visual style from the existing CSS without help |
| create-writes-dna | fail 2/2 | No DNA. The judge failed the visual system both times: warm cream + serif + terracotta, the same cluster it produced for the unrelated York bookshop |
| vague-brief-translated | fail 1/1 | No DNA. Greige + Georgia + rounded cards, with 22 radius/shadow/gradient rules; the judge called it a stock template |

## GREEN: final A/B (skill 0.1.0, final description)

42 runs (7 cases × 3 × 2), $9.47, 28 min. Scores are the with/without means; Δ is with − without.

| Case | With | Without | Δ | Gate (plan AC4) | Result |
|---|---|---|---|---|---|
| create-writes-dna | 0.67 | 0.50 | +0.17 | Valid DNA (4 sections, ≥3 concrete values) in ≥2/3 | **3/3**. The judge found the visual system subject-grounded in 1/3 runs with the skill vs 0/3 without |
| tweak-respects-dna | 1.00 | 1.00 | 0 | No DNA write, no direction note in ≥2/3 | **3/3** |
| build-continuity | 1.00 | 0.83 | +0.17 | DNA respected; with > without | **Pass**: DNA-only rule held 3/3 with the skill vs 0/3 without |
| no-trigger-backend | 1.00 | 1.00 | 0 | Skill not invoked 3/3 | **3/3** |
| vague-brief-translated | 1.00 | 1.00 | 0 | No untranslated vague words in ≥2/3 | **2/3**. One run hit the 900 s timeout before finishing its DNA. The judged page specificity was equal: this time the baseline also avoided the stock template |
| brief-style-wins | 0.83 | 1.00 | −0.17 | Requested look in ≥2/3 | **2/3**. The failing page has exactly the requested tokens (cream `#F3E8D6`, Playfair Display, terracotta `#C1502E`); the judge flagged the file as long and voted FAIL, so this is a judge false negative, not an override of the brief |
| build-continuity-pointer | 1.00 | 0.83 | +0.17 | (D13 probe) | **Inconclusive**: `claude plugin eval` does not load project `CLAUDE.md`, so the baseline never saw the pointer. Case removed; verification moves to Phase 3 (INTEGRATIONS U11) |

All plan gates for Phase 1 are met.

### How the gates were reached

1. **First A/B** (earlier description, $7.42): the continuity case failed 3/3 *with* the skill. Kept traces showed why: the skill never fired on "Add a booking form…". The agent grepped, edited, and never opened `.nomi/dna.md`.
2. **Fix 1, trigger:** the description now names ordinary UI changes (sections, components, forms) and projects with a `.nomi/` folder. Check: the skill was the first action in 3/3 runs, the DNA was read, and every grader passed ($0.58).
3. **Fix 2, D13:** `nomi dna init` now adds a one-line DNA pointer to `AGENTS.md`/`CLAUDE.md`. Skill activation is probabilistic, and persistent state must not depend on it.
4. **Second A/B** was invalid: the account session limit hit, and all 42 runs errored at turn 1 ($0.13, discarded).
5. **Third A/B**: the table above.

### Cost of the loop (reported, not gated in Phase 1)

With the skill, Create-tier runs took 12–29 turns vs 2–3 without, and cost 2–4× more: direction, DNA, critique and refinement are real work. Tweak and backend runs cost about the same with or without the skill. Phase 8's `overhead` suite sets the gates.

## Grader corrections made during the phase

| Grader | Problem | Fix |
|---|---|---|
| build-continuity (first versions) | Non-discriminating: the base model copies style from existing CSS (no cards, one orange) and avoids placeholders by habit, so the baseline passed | Continuity now hinges on a DNA rule that conflicts with a model habit (no free date picker) |
| create-writes-dna `subject-grounded` | Passed a default-cluster page because its copy was specific | Rubric judges the visual system; copy alone does not count |
| build-continuity `no-decoration-*` | Penalised compliance: the agent wrote `border-radius: 0` to enforce "no rounded corners" | Patterns match only non-zero radius, real shadows and `gradient(`; verified against 8 compliant and violating snippets. The change is more lenient, so the baseline's result is unaffected |

## Limitations

- One agent model (Sonnet 5), 3 runs per arm: enough to see direction, not to estimate small effects. Re-run on an Opus-class model before release.
- The judge is a Claude model judging a Claude model, and it reads HTML source, not renders. Cross-vendor judging and rendered evidence arrive with the Nomi runner in Phase 2.
- The CLI (`dna init`, `dna check`, `critique pack`) is covered by unit tests only; no eval run had a shell.
- LLM judges are noisy on long HTML files: one clear false negative in this run. Phase 2 judges rendered screenshots, not source.
- The effect of the D13 pointer on agents without Nomi is unmeasured; see INTEGRATIONS U11.
