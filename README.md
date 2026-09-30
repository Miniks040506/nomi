# Nomi

Nomi is a vendor-neutral creative intelligence layer for coding agents. It is designed to help agents set a clear direction, keep project context consistent, and evaluate creative work against observable evidence.

**Status:** Core direction, Project DNA and critique are implemented. Phase 2 (browser observation and the Web module) is complete; results are in the [implementation plan](docs/IMPLEMENTATION_PLAN.md) and `evals/reports/phase-2.md`. Multi-host packaging remains Phase 3 work. Only claim host support backed by [integration evidence](docs/INTEGRATIONS.md).

## Local use

Load the repository as a local Claude Code plugin with `claude --plugin-dir <absolute-repository-path>`. Nomi is discovered as `nomi:nomi`; implicit activation depends on the host/model and is measured in the phase reports.

The observation CLI needs Node 22+ and a Chromium-family browser:

```text
node skills/nomi/scripts/nomi.mjs observe <url-or-html-file>
node skills/nomi/scripts/nomi.mjs diff <before-run-id> <after-run-id>
node skills/nomi/scripts/nomi.mjs doctor
```

Run from the project you want to inspect, using an absolute path to the script when necessary. Open the images printed by `observe`; measurements alone do not establish visual quality. Set `NOMI_BROWSER` to a browser executable if discovery fails. Runs stay in the project's `.nomi/runs/`; the latest ten complete runs are retained. File/directory targets serve static assets; framework apps need their normal dev server.

## Repository

- `skills/nomi/` — canonical vendor-neutral skill and zero-dependency observation scripts
- `adapters/` — host-specific integration notes
- `docs/` — [architecture](docs/ARCHITECTURE.md), [implementation plan](docs/IMPLEMENTATION_PLAN.md), and [evaluation](docs/EVALUATION.md)
- `evals/` — cases, fixture projects, isolated runner and phase reports
- `tests/` — deterministic Node tests; browser tests explicitly skip if Chromium is unavailable

See the [implementation plan](docs/IMPLEMENTATION_PLAN.md) for current progress and the next phase.
