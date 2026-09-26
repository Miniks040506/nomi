Continue building Nomi from the current repository state.

Read:
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/ARCHITECTURE.md`
- relevant existing code and docs

Find the **next incomplete, unblocked implementation phase**.

Implement that entire phase.

Do not split it into artificial microtasks and do not stop after implementing only one file or one small component.

Before coding, briefly verify that the planned phase still makes architectural sense given the current repository state. Improve the plan if implementation has revealed a better approach.

During the phase:
- implement production-quality behavior
- preserve Nomi's vendor-neutral core
- avoid duplicating capabilities the base coding model already has
- keep skill entrypoints concise
- use progressive disclosure
- add deterministic scripts when they are better than prose
- implement real platform integration rather than claiming unsupported compatibility
- add/update tests and evals appropriate to the capability
- keep documentation synchronized with implementation

For Nomi features, continuously ask:
> What does this make the agent actually do differently?

Reject features that add mostly terminology or documentation without meaningful behavioral value.

Before finishing the phase:
1. run relevant validation/tests
2. run applicable evals
3. fix meaningful failures
4. check for context bloat or unnecessary abstractions
5. update architecture/docs if behavior changed
6. update `docs/IMPLEMENTATION_PLAN.md`

Mark the phase `DONE` only when its acceptance criteria are actually satisfied.

Do **not** automatically start the next major phase.

Finish by reporting:
- phase completed
- major implementation decisions
- validation/eval results
- any issue that should affect later phases

Then stop.
