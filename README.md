# Nomi

Nomi is a skill that makes a coding agent deliver software UI the way a product team would: it sets a direction before code, builds, looks at the rendered result in a real browser, critiques it against evidence, fixes what the evidence shows, and records the decisions for the next session.

**Status.** Built: direction and Project DNA, browser capture with measurement (type, colour, contrast, overflow, keyboard focus), motion capture (every animation and transition, replayed frames, reduced-motion comparison), evidence-bound critique with a bounded fix loop. Planned, not built: a plan stage, business-flow playtests, a review verdict with a proof card, README and demo-video stages. Two hosts are verified; see [hosts](docs/HOSTS.md).

## Install

Nomi is one folder, `skills/nomi/`. Copy it where your agent reads skills:

| Host | How |
|---|---|
| Claude Code | `claude --plugin-dir <path-to-this-repo>`, or `node tools/install.mjs --hosts claude --dir <project>` (writes `.claude/skills/nomi`) |
| OpenAI Codex | `node tools/install.mjs --hosts codex --dir <project>` (writes `.agents/skills/nomi`) |
| Other hosts | `node tools/install.mjs --hosts <id> --dir <project>`; not verified end to end, see [hosts](docs/HOSTS.md) |

Installer options: `--scope project|user`, `--hosts all|claude,codex,cursor,opencode,gemini,antigravity,openclaw,hermes`, `--dir <project>`, `--dry-run`, `--uninstall`. Running it again replaces the Nomi folder with the current version; it never touches a folder that is not Nomi. Choose only the hosts you use: some read both `.agents/skills` and `.claude/skills` and would list Nomi twice.

Then ask your agent for interface work as usual ("add a pricing section", "improve this page for phones", "redesign the dashboard"). To check the setup: `node <skills-folder>/nomi/scripts/nomi.mjs doctor`.

`nomi dna init` adds one line pointing to `.nomi/dna.md` to `AGENTS.md` or `CLAUDE.md`, so agents without Nomi also see the project's direction. To remove Nomi from a project, uninstall, delete that line and the `.nomi/` folder.

## What the agent does differently

- **Reads the project's direction first.** `.nomi/dna.md` holds intent, character, signature, a Never list and dated decisions. Every session and every agent extends the same file.
- **Sizes the effort.** A tweak stays a tweak; a new page gets a direction note, a capture and a critique; a new product or redesign gets the full direction protocol.
- **Looks before it claims.** `observe` renders the page at desktop and phone widths, measures it, and prints images the agent must open. No statement about how something looks or moves without a capture from the session.
- **Critiques with evidence.** At most five ranked issues, each tied to an image region, a measured value or a file and line, fixed in severity order and measured again.

## The CLI

Needs Node 22+ and a Chromium-family browser (Chrome, Edge, Chromium). No npm install.

```text
node skills/nomi/scripts/nomi.mjs observe <url-or-html-file>
node skills/nomi/scripts/nomi.mjs observe <url-or-html-file> --motion [--interact steps.json]
node skills/nomi/scripts/nomi.mjs diff <before-run-id> <after-run-id>
node skills/nomi/scripts/nomi.mjs doctor
```

Run it from the project you want to inspect. Runs are saved in the project's `.nomi/runs/` (the latest ten are kept). File and folder targets are served as static files; framework apps need their own dev server and a URL. Set `NOMI_BROWSER` to a browser executable if discovery fails. Motion drawn frame by frame from script (canvas, `requestAnimationFrame`) is not measured.

**Codex on Windows.** Its `workspace-write` sandbox stops Chromium from starting its own sandbox, so `observe` fails there by default. Run the capture outside the sandbox, or set `NOMI_BROWSER_NO_SANDBOX=1`, which Nomi accepts only for local pages (a file, a folder or a localhost URL) and records in the run report.

## Repository

- `skills/nomi/`: the skill: entry file, modules (web, motion), protocols, templates, zero-dependency scripts
- `adapters/hosts.json`: host table: folders, channels, verification record
- `tools/install.mjs`: the installer
- `docs/`: [how Nomi works](docs/ARCHITECTURE.md), [hosts](docs/HOSTS.md)

Licence: none chosen yet; see [LICENSE](LICENSE).
