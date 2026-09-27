# Codex: implement the next Nomi phase

You are continuing Nomi V1, a vendor-neutral creative-intelligence skill for coding agents. Phase 1 is DONE. Your job in this session is to implement exactly **one** phase, completely, then stop.

## Read first
1. `AGENTS.md`
2. `docs/IMPLEMENTATION_PLAN.md`: the source of truth for scope, acceptance criteria and status
3. `docs/ARCHITECTURE.md`, `docs/INTEGRATIONS.md`, `docs/EVALUATION.md`
4. `evals/reports/phase-1.md`: lessons that apply to every later phase
5. The existing code: `skills/nomi/`, `tools/check.mjs`, `tests/`, `evals/`

## Pick the phase
Take the first phase whose status is not `DONE` and whose dependencies are all `DONE`. If a phase is `IN PROGRESS`, resume it from the repo state; do not redo finished work. Set its status to `IN PROGRESS` when you start.

Before coding, check that the phase still makes sense against the current repo. If the plan is wrong, change the plan: edit the phase in `docs/IMPLEMENTATION_PLAN.md` and record the deviation and its reason in the phase's Outcome.

## Non-negotiable rules
- **Vendor-neutral skill.** Nothing host-specific inside `skills/nomi/`: no host names, no host variables, no host tool names. `npm run check` enforces this and must pass. Host differences go in root manifests and `adapters/hosts.json` only. You are one of the target hosts; do not tailor the skill to yourself.
- **Behavior over vocabulary.** Every file must change what an agent decides, does or checks. Domain modules follow the six-section contract (ARCHITECTURE §4) within their line budgets. No design handbooks, framework tutorials or large rule catalogs.
- **Reuse before adding.** Extend `lib/frontmatter.mjs`, `lib/dna.mjs`, `scripts/nomi.mjs` and `tools/check.mjs`; do not create parallel versions. Zero runtime npm dependencies inside `skills/nomi/`; Node ≥22.
- **TDD for code.** Write a failing test first, watch it fail for the right reason, then implement. `npm test` and `npm run check` must be green on Windows and on Linux. For Linux, run in WSL2 with the portable Node at `/tmp/node-v24.14.0-linux-x64/bin`: add it to `PATH`, and re-download the tarball from nodejs.org into `/tmp` if it is gone. Never install system packages.
- **No unverified claims.** A host counts as supported only with evidence recorded in `docs/INTEGRATIONS.md`, including version and date.
- **Do not invent user decisions.** The license and GitHub owner/repo stay open (use `<owner>/<repo>`). Never publish, tag a release, push, or submit to a marketplace; prepare those steps and list them for the user.

## Evals (see EVALUATION.md)
- **Suites.** Run the phase's suites as with/without-Nomi A/B, 3 runs per arm. Write `evals/reports/phase-N.md` with the environment, per-case with/without numbers, spread, cost and limitations.
- **See the baseline first.** Record what agents do without the module before writing the module text.
- **Check every run's `error` field before trusting a result.** In Phase 1 an account session limit silently zeroed a whole run.
- **Test grader regexes first.** Try every regex against compliant and violating snippets before a paid run. In Phase 1, `border-radius: 0` was wrongly scored as a violation.
- **Judge renders, not long HTML source.** LLM judges gave false negatives on long files.
- **`claude plugin eval`.** Always pass `--no-publish --trust-plugin --model claude-sonnet-5 --judge-model sonnet`. It refuses shell-granting cases on native Windows. It also never loads a project's `CLAUDE.md`.
- **Shell-requiring suites use the Nomi runner.** Phase 2 builds it in `evals/harness/`; it drives `claude -p` / `codex exec` in isolated temp workspaces. When you run `codex exec` as a host under test, use a fresh temp workspace so this repo's `AGENTS.md` does not leak into the run.
- **Spend.** Ceiling $25 of model spend per phase. If the phase needs more, stop and ask.

## Finish the phase
1. Meet every acceptance criterion with evidence; otherwise leave the status `IN PROGRESS` and list exactly what remains.
2. Run `npm test` and `npm run check` (Windows and WSL2), plus `claude plugin validate .` when manifests change.
3. Bring docs in line with the behavior. Update the phase status, its Outcome (what shipped, eval numbers, deviations, issues for later phases) and the plan changelog.
4. Self-review the diff for bugs, duplication and context bloat. Fix material findings test-first.
5. Commit only this phase's files: `git commit -m "Phase N: <name>"`.
6. Report: the phase completed, major decisions, validation and eval results with costs, and issues that affect later phases. Then **stop**. Do not start the next phase.

After Phase 8 is DONE, also write `docs/HANDOFF.md`, one page:
- what V1 does;
- per-host status;
- where the evidence lives;
- known gaps;
- the user decisions still open.

Then tell the user the repository is ready for an independent review.
