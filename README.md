# Nomi

Nomi is a skill that makes a coding agent deliver software UI the way a product team would: it reads what the product is for and writes its jobs down as steps a script can run, sets a direction before code, builds, looks at the rendered result in a real browser, runs those jobs there, reviews against the evidence, fixes what it shows, and records the decisions for the next session.

**Status.** Built: direction and Project DNA, browser capture with measurement (type, colour, contrast, overflow, keyboard focus), motion capture (every animation and transition, replayed frames, reduced-motion comparison), evidence-bound critique with a bounded fix loop, a plan stage (product type, users, jobs as runnable flows), flow playtests in the browser (completed or the failing step, dead clicks, console errors), and a review verdict with a proof card. Planned, not built: README and demo-video stages. Five hosts are verified end to end (Claude Code, Codex, Cursor, Antigravity, Hermes); see [hosts](docs/HOSTS.md).

## Install

Nomi is one folder, `skills/nomi/`. Copy it where your agent reads skills:

| Host | How |
|---|---|
| Claude Code | `claude --plugin-dir <path-to-this-repo>`, or `node tools/install.mjs --hosts claude --dir <project>` (writes `.claude/skills/nomi`) |
| OpenAI Codex | `node tools/install.mjs --hosts codex --dir <project>` (writes `.agents/skills/nomi`) |
| Cursor | `node tools/install.mjs --hosts cursor --dir <project>` (writes `.agents/skills/nomi`) |
| Google Antigravity | `node tools/install.mjs --hosts antigravity --dir <project>` (writes `.agents/skills/nomi`) |
| Hermes Agent | `node tools/install.mjs --hosts hermes --dir <project>` (writes `.agents/skills/nomi`), then `hermes skills trust` in the project, which must be a git repository |
| OpenCode, Gemini CLI, OpenClaw, Kiro | `node tools/install.mjs --hosts <id> --dir <project>`; not verified end to end, see [hosts](docs/HOSTS.md) |

Installer options: `--scope project|user`, `--hosts all|claude,codex,cursor,opencode,gemini,antigravity,openclaw,hermes,kiro`, `--dir <project>`, `--dry-run`, `--uninstall`. Running it again replaces the Nomi folder with the current version; it never touches a folder that is not Nomi. Choose only the hosts you use: `all` writes three folders (`.agents/skills`, `.claude/skills`, `.kiro/skills`), and some hosts read two of them and would list Nomi twice. To remove Nomi, run the same command with `--uninstall`.

A project install also adds one line to the project's `CLAUDE.md` (Claude Code) or `AGENTS.md` (other hosts) telling the agent to load Nomi for interface work. Without that line agents skip the skill on roughly four page edits in ten; with it, on none of the 27 measured. `--uninstall` removes the line. The Claude Code plugin adds the same line at session start through a hook (27 of 27 measured as well). A `--scope user` folder install has neither: add the line to your project yourself, or expect the skill to be skipped sometimes.

Then ask your agent for interface work as usual ("add a pricing section", "improve this page for phones", "redesign the dashboard"). You can also name a part: "nomi-plan for this app", "use nomi-web on this page", "nomi-motion for the menu", "nomi-review this screen". To check the setup: `node <skills-folder>/nomi/scripts/nomi.mjs doctor`.

`nomi dna init` adds one line pointing to `.nomi/dna.md` to `AGENTS.md` or `CLAUDE.md`, so agents without Nomi also see the project's direction. To remove Nomi from a project, uninstall, delete that line and the `.nomi/` folder.

## What the agent does differently

- **Reads the project's direction first.** `.nomi/dna.md` holds intent, character, signature, a Never list and dated decisions. Every session and every agent extends the same file.
- **Sizes the effort.** A tweak stays a tweak; a new page gets a direction note, a capture, its jobs run as flows and a review; a new product or redesign gets the plan and the full direction protocol first.
- **Understands the product before designing it.** For a new product or a redesign it states what kind of product this is, who uses it and what they must get done, and writes `.nomi/plan.md`: those jobs as flows, the screens, and what done means.
- **Uses what it built.** `observe --flow` runs each job in the browser: it clicks, types and checks the end state, and reports the step where a job stops, clicks that change nothing and console errors, with a sheet of screenshots per job. Flows only run on the project's own local pages.
- **Ends with a verdict it can back.** `review` captures again, runs the flows, lists what blocks SHIP and writes a proof card (`.nomi/proof.md`). SHIP is not available over a failed flow or over evidence older than the last edit.
- **Looks before it claims.** `observe` renders the page at desktop and phone widths, measures it, and prints images the agent must open. No statement about how something looks or moves without a capture from the session.
- **Critiques with evidence.** At most five ranked issues, each tied to an image region, a measured value or a file and line, fixed in severity order and measured again.

## The CLI

Needs Node 22+ and a Chromium-family browser (Chrome, Edge, Chromium). No npm install.

```text
node skills/nomi/scripts/nomi.mjs observe <url-or-html-file>
node skills/nomi/scripts/nomi.mjs observe <url-or-html-file> --motion [--interact steps.json]
node skills/nomi/scripts/nomi.mjs observe <url-or-html-file> --flow <flows.json | .nomi/plan.md>
node skills/nomi/scripts/nomi.mjs review <url-or-html-file>
node skills/nomi/scripts/nomi.mjs plan init --type <booking|pos|admin|...>
node skills/nomi/scripts/nomi.mjs diff <before-run-id> <after-run-id>
node skills/nomi/scripts/nomi.mjs doctor
```

Run it from the project you want to inspect. Runs are saved in the project's `.nomi/runs/` (the latest ten are kept). File and folder targets are served as static files; framework apps need their own dev server and a URL. Set `NOMI_BROWSER` to a browser executable if discovery fails. Motion drawn frame by frame from script (canvas, `requestAnimationFrame`) is not measured. A flow acts on the page for real: it runs on a file, a folder or a localhost URL, refuses requests that would change data on another site, and needs `--live` for any other URL.

**Codex on Windows.** Its `workspace-write` sandbox stops Chromium from starting its own sandbox, so `observe` fails there by default. Run the capture outside the sandbox, or set `NOMI_BROWSER_NO_SANDBOX=1`, which Nomi accepts only for local pages (a file, a folder or a localhost URL) and records in the run report.

## Repository

- `skills/nomi/`: the skill: entry file, modules (plan, web, motion, review), protocols, templates, zero-dependency scripts
- `adapters/hosts.json`: host table: folders, channels, verification record
- `tools/install.mjs`: the installer
- `hooks/`: Claude Code plugin hook that tells each session to use Nomi for interface work
- `docs/`: [how Nomi works](docs/ARCHITECTURE.md), [hosts](docs/HOSTS.md)

Licence: none chosen yet; see [LICENSE](LICENSE).
