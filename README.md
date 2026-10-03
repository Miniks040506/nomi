# Nomi

Nomi is a vendor-neutral creative intelligence layer for coding agents. It is designed to help agents set a clear direction, keep project context consistent, and evaluate creative work against observable evidence.

**Status:** Core direction, Project DNA, critique, browser observation and the Web skill are implemented (Phases 1–2). Multi-host packaging (Phase 3) is in progress: the installer, manifests and host verifier ship, and two of eight hosts are verified locally. Claim only the host support recorded in [integration evidence](docs/INTEGRATIONS.md).

## Install

Nomi is a set of skill folders that must stay side by side: `nomi` (the shared core) and `nomi-web` (web pages and UI, which uses the scripts and protocols in `nomi` next to it).

**Verified on this project's test machine** (version, date and evidence in [INTEGRATIONS.md](docs/INTEGRATIONS.md)):

| Host | How |
|---|---|
| Claude Code | `claude --plugin-dir <path-to-this-repo>`, or copy the folders into a project: `node tools/install.mjs --hosts claude --dir <project>` (writes `.claude/skills/`) |
| OpenAI Codex | `node tools/install.mjs --hosts codex --dir <project>` (writes `.agents/skills/`) |

**Shipped but not verified end to end.** These follow each host's documentation; no agent run has confirmed them here.
- Cursor, OpenCode, Gemini CLI, Antigravity, Hermes: `node tools/install.mjs --hosts <id> --dir <project>` writes `.agents/skills/`. Hermes loads project skills only in a git repository after `hermes skills trust`.
- OpenClaw: skills are read from its agent workspace, not from the folder you run it in. `node tools/install.mjs --scope user --hosts openclaw` writes `~/.agents/skills/`; OpenClaw 2026.5.22 then lists both skills as ready.
- Marketplace and extension manifests (`.claude-plugin/marketplace.json`, `plugin.json`, `.agents/plugins/marketplace.json`, `gemini-extension.json`) are validated but have not been installed from GitHub.

Installer options: `--scope project|user`, `--hosts all|claude,codex,cursor,opencode,gemini,antigravity,openclaw,hermes`, `--dir <project>`, `--dry-run`. Running it again replaces the Nomi folders with the current version. Choose only the hosts you use: Cursor and OpenCode read both `.agents/skills` and `.claude/skills`, so installing both can list Nomi twice.

Uninstall with the same arguments plus `--uninstall`; it removes only the Nomi folders. `nomi dna init` also adds one line pointing to `.nomi/dna.md` to `AGENTS.md`/`CLAUDE.md`; delete that line and the `.nomi/` folder by hand if you no longer want the project state.

After installing, `node <skills-folder>/nomi/scripts/nomi.mjs doctor` reports Node, the browser and the domain skills found next to the core.

**Codex on Windows.** Its `workspace-write` sandbox stops Chromium from starting its own sandbox, so `observe` fails there by default. Either run the capture outside the sandbox, or set `NOMI_BROWSER_NO_SANDBOX=1`, which Nomi accepts only for local pages (a file, a folder or a localhost URL) and records in the run report. Without either, the skill falls back to `probe print web` or reports "not visually verified".

## Observation CLI

The observation CLI needs Node 22+ and a Chromium-family browser:

```text
node skills/nomi/scripts/nomi.mjs observe <url-or-html-file>
node skills/nomi/scripts/nomi.mjs diff <before-run-id> <after-run-id>
node skills/nomi/scripts/nomi.mjs doctor
```

Run from the project you want to inspect, using an absolute path to the script when necessary. Open the images printed by `observe`; measurements alone do not establish visual quality. Set `NOMI_BROWSER` to a browser executable if discovery fails. Runs stay in the project's `.nomi/runs/`; the latest ten complete runs are retained. File/directory targets serve static assets; framework apps need their normal dev server.

## Repository

- `skills/nomi/` — shared vendor-neutral core: loop, direction and critique protocols, templates, zero-dependency scripts
- `skills/nomi-web/` — web entry skill: must-do steps and the web module (uses the core next to it)
- `adapters/hosts.json` — machine-readable host table: folders, channels, headless commands, verification record
- `tools/` — `check.mjs` (static gate), `install.mjs` (installer), `verify-hosts.mjs` (host smoke test)
- `docs/` — [architecture](docs/ARCHITECTURE.md), [implementation plan](docs/IMPLEMENTATION_PLAN.md), and [evaluation](docs/EVALUATION.md)
- `evals/` — cases, fixture projects, isolated runner and phase reports
- `tests/` — deterministic Node tests; browser tests explicitly skip if Chromium is unavailable

See the [implementation plan](docs/IMPLEMENTATION_PLAN.md) for current progress and the next phase.
