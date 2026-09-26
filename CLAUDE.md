# CLAUDE.md

Claude Opus is the primary architect and implementer for Nomi V1.

Workflow:
1. Run the master planning prompt once.
2. Follow the generated implementation plan phase by phase.
3. Complete one substantial phase per implementation run.
4. Validate, update the plan, and stop after each phase.
5. Do not split work into unnecessary microtasks.
6. Do not auto-start the next major phase in the same run.
