Continue building Nomi from the current repository state.

Read:
- `AGENTS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/INTEGRATIONS.md` and `docs/EVALUATION.md`
- the latest `evals/reports/phase-*.md` (lessons from earlier phases)
- relevant existing code and docs

Find the **next incomplete, unblocked implementation phase**. If a phase is `IN PROGRESS`, resume it from the repository state and do not redo finished work.

Implement that entire phase.

Do not split it into artificial microtasks and do not stop after implementing only one file or one small component.

Before coding, briefly verify that the planned phase still makes architectural sense given the current repository state. Improve the plan if implementation has revealed a better approach, and record the change in the phase's Outcome.

During the phase:
- implement production-quality behavior
- preserve Nomi's vendor-neutral core: nothing host-specific inside `skills/nomi/`. `npm run check` enforces this; do not tailor the skill to Codex, which is one of the hosts under test
- avoid duplicating capabilities the base coding model already has
- keep skill entrypoints concise and domain modules within the six-section contract and line budgets
- use progressive disclosure
- add deterministic scripts when they are better than prose; extend the existing CLI, libs and `tools/check.mjs` instead of creating parallel ones; zero runtime npm dependencies in the skill; Node ≥22
- write a failing test first for every code unit, and watch it fail for the right reason
- implement real platform integration rather than claiming unsupported compatibility; record evidence (version, date) in `docs/INTEGRATIONS.md`
- add/update tests and evals appropriate to the capability
- keep documentation synchronized with implementation
- never invent user decisions (license, GitHub owner) and never publish, push, tag or submit anything; prepare those steps and list them for the user

For Nomi features, continuously ask:
> What does this make the agent actually do differently?

Reject features that add mostly terminology or documentation without meaningful behavioral value.

Evals (follow `docs/EVALUATION.md`):
- Before writing a module's text, run its cases without Nomi to see the baseline behavior.
- Run the phase's suites as with/without A/B, 3 runs per arm. Write `evals/reports/phase-N.md` with environment, per-case numbers, spread, cost and limitations.
- Check every run's `error` field before trusting a result (a session limit once errored every run of a suite).
- Test every grader regex against compliant and violating snippets before a paid run.
- Judge rendered screenshots, not long HTML source.
- `claude plugin eval` always runs with `--no-publish --trust-plugin --model claude-sonnet-5 --judge-model sonnet`. It refuses shell-granting cases on native Windows and never loads a project's `CLAUDE.md`; use the Nomi runner (`evals/harness/`) for anything that needs a shell.
- When running an agent as a host under test, use a fresh temp workspace so this repository's `AGENTS.md` does not leak in.
- Stay under $25 of model spend per phase; stop and ask if more is needed.

Before finishing the phase:
1. run `npm test` and `npm run check` on Windows and on Linux (WSL2 with the portable Node in `/tmp/node-v24.14.0-linux-x64/bin`; re-download it into `/tmp` if missing; no system installs), plus `claude plugin validate .` if manifests changed
2. run applicable evals
3. fix meaningful failures
4. check for context bloat or unnecessary abstractions
5. update architecture/docs if behavior changed
6. update `docs/IMPLEMENTATION_PLAN.md`: status, Outcome and changelog
7. commit only this phase's files: `git commit -m "Phase N: <name>"`

Mark the phase `DONE` only when its acceptance criteria are actually satisfied.

Do **not** automatically start the next major phase.

Finish by reporting:
- phase completed
- major implementation decisions
- validation/eval results, with costs
- any issue that should affect later phases

After Phase 8, also write `docs/HANDOFF.md`, one page:
- what V1 does
- per-host status
- where the evidence lives
- known gaps
- the user decisions still open

Then state that the repository is ready for independent review.

Then stop.
