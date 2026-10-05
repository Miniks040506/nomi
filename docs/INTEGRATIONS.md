| Hermes Agent | D | — | — | Not installed; needs install and a provider login || OpenClaw | D | — | — | 2026.5.22 lists both skills as ready from `~/.agents/skills`; no agent run (bundled codex plugin fails to load, no provider keys) || Google Antigravity | D | — | — | `agy` not installed; needs install and sign-in || Gemini CLI | D | — | — | Not installed; needs install and sign-in || OpenCode | D | — | — | Not installed; needs install and a provider login || Cursor | D | — | — | `agent` CLI not installed; needs install and sign-in || OpenAI Codex | L | 0.159.3 | 2026-10-03 | Project-folder install: skill read, `doctor` ran (`domains web`), capture in the project, image read. Browser needs D17 or a run outside the sandbox on Windows || Claude Code | L | 2.1.286 | 2026-10-01 | Plugin and project-folder installs: skills listed, web skill activated, core CLI `observe` ran from the project, capture opened. The 2026-10-03 rerun was not possible (CLI login expired) |# Nomi Integrations

How Nomi reaches each target host. Host documentation below was checked on **2026-09-27** (status `D`). Local evidence is recorded below: the verification status table (Phase 3, `tools/verify-hosts.mjs`) and the Phase 2 and migration records. `adapters/hosts.json` is the machine-readable copy of the host table.

## 1. Summary

- Every target host loads **Agent Skills** (a folder with `SKILL.md`), so Nomi ships **one set of skill folders**: the shared core `skills/nomi/` and one entry skill per finished domain (`skills/nomi-web/` today; motion is a module inside the core), with no per-host copies of their logic. The set is installed together: domain skills reach the core as the sibling folder `../nomi`.
- A project install copies the Nomi folders side by side into two places: **`.agents/skills/`** (Codex, Cursor, OpenCode, Gemini CLI, Antigravity, OpenClaw, Hermes) and **`.claude/skills/`** (Claude Code, which does not read `.agents/skills`).
- Native packages are optional conveniences: a Claude Code plugin, an **Agent Plugins v1** portable package (Codex, Cursor, OpenClaw, Hermes), and a Gemini CLI extension. Antigravity and OpenCode are served by folders.
- V1 needs no hooks, MCP servers, commands or host agent definitions on any host.

## 2. Host matrix

| Host | Project skill folder Nomi uses | User-level folders | Native package channel | Headless run (evals) | Subagents for the critic | Local machine (2026-09-27) |
|---|---|---|---|---|---|---|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` | Plugin + marketplace (`.claude-plugin/`) | `claude -p`; `claude plugin eval` | D | 2.1.283 installed |
| OpenAI Codex | `.agents/skills/` | `~/.agents/skills/` | Agent Plugins + `.agents/plugins/marketplace.json` | `codex exec --json` | D | codex-cli 0.154.0 installed |
| Cursor | `.agents/skills/` (also reads `.cursor/`, `.claude/`, `.codex/skills/`) | `~/.agents/skills/`, `~/.cursor/skills/` | Agent Plugins or `.cursor-plugin/`; local `~/.cursor/plugins/local/` | `agent -p --force --output-format json` | ? | IDE installed; `agent` CLI not on PATH |
| OpenCode | `.agents/skills/` (also `.opencode/skills/`, `.claude/skills/`) | `~/.config/opencode/skills/`, `~/.agents/skills/` | Folders only | `opencode run --format json` | ? | not installed |
| Gemini CLI | `.agents/skills/` (alias of `.gemini/skills/`) | `~/.agents/skills/`, `~/.gemini/skills/` | Extension (`gemini-extension.json`, bundles `skills/`) | `gemini -p --output-format json` | D | not installed |
| Google Antigravity | `.agents/skills/` (legacy `.agent/skills/`) | `~/.gemini/config/skills/` (Antigravity 2.0, IDE); `~/.gemini/antigravity-cli/skills/` (CLI) | Folders only in V1 (see U5) | `agy -p --output-format json` | D (CLI) | not installed |
| OpenClaw | `<workspace>/.agents/skills/` or `<workspace>/skills/` | `~/.agents/skills/`; managed `<state-dir>/skills` | Agent Plugins bundle (documented from 2026.8.1) or `openclaw skills install` | `openclaw agent --local --message … --json` | ? | 2026.5.22 installed |
| Hermes Agent | `.agents/skills/` or `.hermes/skills/` (git repo + `hermes skills trust`) | `~/.hermes/skills/`; `skills.external_dirs` in `~/.hermes/config.yaml` | Agent Plugins portable package (disabled until enabled) or `hermes skills install` | `hermes chat -q …`; `hermes -z` | ? | not installed |

Status legend: `D` documented (checked 2026-09-27) · `L` verified locally (version, date, evidence) · `?` unknown · `✗` known not to work.

### Verification status

One row per host, identical to `adapters/hosts.json` (`npm run check` fails when they differ). `tools/verify-hosts.mjs --record` writes the JSON; the row is then updated by hand with the evidence.

| Host | Status | Version | Verified | Evidence or blocker |
|---|---|---|---|---|
| Claude Code | D | — | — | pending |
| OpenAI Codex | D | — | — | pending |
| Cursor | D | — | — | pending |
| OpenCode | D | — | — | pending |
| Gemini CLI | D | — | — | pending |
| Google Antigravity | D | — | — | pending |
| OpenClaw | D | — | — | pending |
| Hermes Agent | D | — | — | pending |

### Phase 2 local evidence (2026-09-29)

| Component | Tested version / environment | Evidence and scope |
|---|---|---|
| Windows browser engine | Node 24.14.0; Microsoft Edge 154.0.4258.37; Google Chrome 154.0.8037.58 | Real CDP capture, census, directory/file/URL targets, diff, failure and interruption cleanup in `tests/browser.test.mjs`; WebSocket transport |
| Linux browser engine | WSL2 Ubuntu 26.04; portable Node 24.14.0 linux-x64; Chrome Headless Shell 154.0.8037.57 via `NOMI_BROWSER` | Same test suite with pipe transport. Portable binaries plus NSS/NSPR/ALSA libraries fetched with `apt-get download` and unpacked with `dpkg -x` under `/tmp`; no root, no system installation |
| Claude Code local plugin | 2.1.284; `claude-sonnet-5-5`, low effort | Fresh temp workspace and config per run; `--plugin-dir` lists `nomi:nomi`. Discovery is verified; activation, script use and image opening rates are reported separately in the Phase 2 report |
| Codex CLI as eval judge | codex-cli 0.154.0, auto-updated to 0.159.1 during the run | The npm `.cmd` shim cannot be spawned without a shell, so the harness runs its `codex.js` with Node. `--image` takes several values, so the prompt follows `--`. A copied access token without its refresh token was rejected (401), so the judge uses the normal Codex login, with `--ignore-user-config --ignore-rules --ephemeral` and a read-only sandbox |
| Hybrid layout, Claude Code plugin (2026-10-01) | 2.1.286; `--plugin-dir` with `skills/nomi` and `skills/nomi-web` | Listed as `nomi:nomi` and `nomi:nomi-web`. On an explicit request the web skill loaded, the agent read `../nomi/SKILL.md` and ran `../nomi/scripts/nomi.mjs observe` from the project folder; 2/2 evidence claims valid |
| Hybrid layout, Claude Code project folder (2026-10-01) | 2.1.286; `.claude/skills/nomi` and `.claude/skills/nomi-web` in the workspace | Listed as `nomi` and `nomi-web`; same resolution through `.claude/skills/nomi/…`; observed and opened the capture |
| Hybrid layout, Codex project folder (2026-10-01) | codex-cli 0.159.1; `.agents/skills/nomi` and `.agents/skills/nomi-web`, `workspace-write` sandbox | Read both `SKILL.md` files and ran `node .agents/skills/nomi/scripts/nomi.mjs observe index.html` from the project root. Browser launch failed inside the sandbox (GPU process exit), and the agent fell back to `probe print web`. The run then stopped on the account usage limit, and it also read the user's Codex memories, so it is evidence of discovery only |
| Restricted desktop sandbox | Local browser launch may be blocked | Actionable failure and `probe print web` fallback. This is not visual verification and does not establish Codex host compatibility |

Migration checkpoint (2026-10-01, hybrid layout): Windows `npm test` 77/77 with Edge and 22/22 browser and observation tests with Chrome; WSL2 76 pass plus 1 Windows-only skip; `npm run check` clean on both.

Final checkpoint (2026-09-30): Windows `npm test` 74/74 with Edge, and the browser and observation files pass 22/22 with Chrome; WSL2 73 pass plus 1 Windows-only skip; `npm run check` clean on both; no leftover profiles or browser processes. WSL shuts down when idle and clears `/tmp`, so set up the portable toolchain and run the tests in one WSL session. Run WSL tests with the Linux `node` first on PATH; otherwise WSL interop silently runs Windows npm and node. Final results and costs live in `evals/reports/phase-2.md`. macOS and the other host integrations remain unverified. Browser integration is independent of host packaging.

The development harness passes an unexpired Claude access token to a fresh config directory. It never copies a refresh token: copying one caused refresh rotation to invalidate the original login during early experiments. Both arms retain identical built-in skills; only the with arm adds Nomi. The repository's `AGENTS.md` and `CLAUDE.md` are not copied into either workspace.

## 3. Per-host notes

**Claude Code** (D)
- Discovers `~/.claude/skills/`, `.claude/skills/` (walking up to the repo root, plus nested folders when files there are touched), `--add-dir` folders, and plugin `skills/`. Does **not** read `.agents/skills`.
- Combined `description` + `when_to_use` is capped at 1,536 characters in the listing. When a skill runs, the model is told the skill's base directory, so relative paths resolve.
- Plugin: optional manifest `.claude-plugin/plugin.json` (`name` required); `skills/` is scanned by default; component paths must stay inside the plugin root (no `..`). Marketplace: `.claude-plugin/marketplace.json`. Install: `/plugin marketplace add <owner>/<repo>`, then `/plugin install nomi@<marketplace>`. Validate: `claude plugin validate .`. Local development: `claude --plugin-dir .`.
- `claude plugin eval` (v2.1.269+) runs cases with and without the plugin. It also accepts a root `plugin.json` as a manifest, so the Agent Plugins manifest and `.claude-plugin/plugin.json` must agree (U9). On native Windows it refuses cases that grant Bash (no sandbox backend); run those under WSL2.
- Claude-only features Nomi deliberately does not use in the canonical skill: `${CLAUDE_SKILL_DIR}`, `context: fork`, `allowed-tools`, skill hooks.

**OpenAI Codex** (D)
- Skills: `.agents/skills` in the working directory, its parents and the repo root; `$HOME/.agents/skills`; `/etc/codex/skills`; bundled system skills. Symlinked skill folders are followed.
- Optional `agents/openai.yaml` inside a skill adds UI metadata and `policy.allow_implicit_invocation` (default true). Nomi does not need it.
- The initial skill list uses at most 2% of the context window (8,000 characters when unknown); descriptions are shortened first when many skills are installed. This is why Nomi keeps one short description.
- Explicit use: `$nomi` or `/skills`. Plugins: portable Agent Plugins layout (root `plugin.json`, `skills/`, `mcp.json`, OpenAI settings under `extensions`); legacy `.codex-plugin/plugin.json`. Marketplace file: `$REPO_ROOT/.agents/plugins/marketplace.json`; `codex plugin marketplace add <owner>/<repo>`; browse with `/plugins`.
- Hooks (SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, SubagentStart, SubagentStop, Stop) exist but are unused in V1. Subagents exist (used for the critic).

**Cursor** (D)
- Skills: project `.agents/skills/` and `.cursor/skills/`, compatibility folders `.claude/skills/` and `.codex/skills/`, the same four under the home directory, and nested project folders. Extra frontmatter (`paths`, `disable-model-invocation`, `icon`, `color`) is optional and unused.
- Plugins: Agent Plugins (skills + MCP) or Cursor plugins (`.cursor-plugin/plugin.json`, adding rules, agents, commands, hooks). Local install: `~/.cursor/plugins/local/<name>`, then restart. Team marketplaces import from Git.
- The CLI binary is `agent` (`-p`, `--force`, `--output-format json`, `CURSOR_API_KEY`). The docs do not say whether it loads skills headless (U8).

**OpenCode** (D)
- Skills: `.opencode/skills/`, `.claude/skills/`, `.agents/skills/` (walking up to the git worktree root) and `~/.config/opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/`. Loaded through its native `skill` tool; `permission.skill` in `opencode.json` can allow, ask or deny.
- Name must match the folder and `^[a-z0-9]+(-[a-z0-9]+)*$`; description 1–1,024 characters.
- Headless: `opencode run "<prompt>" --format json` (`--auto` approves non-denied permissions).

**Gemini CLI** (D)
- Skills: workspace `.gemini/skills/` or the `.agents/skills/` alias (the alias wins within a tier), user `~/.gemini/skills/` or `~/.agents/skills/`, extension `skills/`, built-in. Enabled by default in current stable releases.
- The model activates a skill with `activate_skill`; the user is asked for consent first (U4). Commands: `/skills list|link|enable|disable|reload`; `gemini skills install|list|uninstall`.
- Extension: `gemini-extension.json` at the root plus `skills/` (also `commands/*.toml`, `hooks/hooks.json`, `agents/*.md`, `GEMINI.md`, all unused). Install: `gemini extensions install <repo-url>`; develop: `gemini extensions link <path>`. Nomi ships no `GEMINI.md`, so nothing loads into context until the skill activates.

**Google Antigravity** (D)
- Skills: workspace `.agents/skills/` (legacy `.agent/skills/` still read); global `~/.gemini/config/skills/` (Antigravity 2.0 and IDE), `~/.gemini/antigravity-cli/skills/` (CLI), legacy `~/.gemini/antigravity/skills/`. `description` is required, `name` defaults to the folder. Manual use: `/<skill-name>`.
- Plugins use an Antigravity-specific `plugin.json` (`name` matching `^[a-zA-Z0-9-_]+$`, optional `description`, Antigravity `$schema`) with `skills/`, `agents/`, `rules/`, `mcp_config.json`, `hooks.json`; installed with `agy plugin install <path|url>` into `.agents/plugins/` or `~/.gemini/config/plugins/`. Nomi's root `plugin.json` follows Agent Plugins instead, so V1 installs Antigravity by folder (U5).
- CLI: `agy -p "<prompt>" --output-format json`; tools needing approval are soft-denied in headless mode unless `--dangerously-skip-permissions` is passed. The CLI has asynchronous subagents.

**OpenClaw** (D)
- Skill sources, highest precedence first: `<workspace>/skills`, `<workspace>/.agents/skills`, `~/.agents/skills` (default state only), `<state-dir>/skills`, workshop skills, bundled skills, then `skills.load.extraDirs` and plugin skills. Same-name conflicts go to the highest source.
- Follows the Agent Skills spec; adds optional gating in `metadata.openclaw` (a nested JSON5 object: `requires.bins`, `requires.env`, `os`). Nomi's canonical frontmatter stays spec-pure (string-valued metadata), so no gating is declared (U6).
- Install: `openclaw skills install <@owner/slug | git:owner/repo@ref | ./path --as nomi>` (add `--global` for managed scope). Eligible skills are snapshotted at session start.
- A root `plugin.json` is treated as an Agent Plugins bundle (documented in the 2026.8.1 release notes). A native `openclaw.plugin.json` takes precedence; Nomi ships none.
- Headless: `openclaw agent --message "<text>" --local` (`--json` for a summary).

**Hermes Agent** (D)
- Primary store `~/.hermes/skills/`; more folders through `skills.external_dirs` (for example `~/.agents/skills`). Project `.hermes/skills/` and `.agents/skills/` load only inside a git repository after `hermes skills trust`.
- agentskills.io format; optional `platforms` and `metadata.hermes`. Loading is progressive through `skills_list` and `skill_view(name[, path])`. Skills are also slash commands (`/nomi`).
- Install: `hermes skills install <owner>/<repo>/<path>` (GitHub), a direct `SKILL.md` URL, skills.sh or well-known sources. Agent Plugins portable packages install **disabled** until enabled, and their skills are namespaced `agent-plugin-<slug>-<hash>`.
- Hermes is Python-based: Node may be missing, so observation can be unavailable (`nomi doctor` reports it).
- Headless: `hermes chat -q "<text>"` (`-s <skill>` preloads a skill); `hermes -z` prints only the final text.

## 4. Distribution channels

| Channel | Hosts | How |
|---|---|---|
| Project folders | All eight | Copy every folder under `skills/` (`nomi`, `nomi-web`) into `<project>/.agents/skills/`; add `<project>/.claude/skills/` only when Claude Code is used (U2). Always copy the whole set: a domain skill without `nomi` beside it loses the CLI and protocols. `tools/install.mjs --scope project` does both idempotently |
| User folders | All eight | The same set of folders, side by side: `~/.agents/skills/nomi` (Codex, Cursor, OpenCode, Gemini CLI, OpenClaw default state), `~/.claude/skills/nomi`, `~/.gemini/config/skills/nomi` (Antigravity), `~/.hermes/skills/nomi` or an `external_dirs` entry. `tools/install.mjs --scope user` |
| Claude Code plugin | Claude Code | `.claude-plugin/plugin.json` + `marketplace.json` at the Nomi repo root |
| Agent Plugins v1 | Codex, Cursor, OpenClaw (≥2026.8.1), Hermes | Root `plugin.json` (`$schema` `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`, `name`, `version`, `description`, …) + `skills/`. Codex also needs `.agents/plugins/marketplace.json` |
| Gemini CLI extension | Gemini CLI | Root `gemini-extension.json`; `skills/` is bundled |
| Third-party installer | All eight | `npx skills add <owner>/<repo>` (vercel-labs/skills) works as a fallback, but some of its target paths lag the hosts' own docs (for example Antigravity's global path), so it is not the primary channel |

All five manifests ship (listed in `adapters/hosts.json`). `tools/check.mjs` requires one name, version and description across them, validates `plugin.json` against the vendored Agent Plugins schema (`tools/schemas/`), and `claude plugin validate .` passes. None has been installed from GitHub yet: the marketplace entries point at `https://github.com/Miniks040506/nomi`.

Installer: `node tools/install.mjs [--scope project|user] [--hosts all|<ids>] [--dir <project>] [--dry-run] [--uninstall]`. It copies every folder under `skills/` into the distinct folders of the chosen hosts, replaces an existing Nomi folder (idempotent), refuses to touch a same-named folder that is not a Nomi skill, and `--uninstall` removes exactly what it installed. For OpenClaw use `--scope user` or `--dir <its workspace>`.

## 5. Rules for the canonical skill (normative)

1. Frontmatter uses only `name`, `description`, `license`, `compatibility` and `metadata` with string values.
2. `name` equals the folder name: `nomi` for the core, `nomi-<domain>` (web, motion, 3d, game, world) for a domain skill. A domain folder ships only with its complete six-section module.
3. `description` ≤400 characters with the trigger phrase first (Codex budgets all descriptions together; OpenClaw truncates under `skills.limits.maxSkillsPromptChars`; Hermes recommends short descriptions).
4. Paths are relative to the skill folder; scripts run as `node <skill-dir>/scripts/nomi.mjs` from the core and `node <core>/scripts/nomi.mjs` from a domain skill, where `<core>` = `<skill-dir>/../nomi`. A domain skill uses core files, never a request to invoke another skill.
5. No host variables (`${CLAUDE_SKILL_DIR}`, `$ARGUMENTS`), no host tool names, no host-only frontmatter.
6. Nothing refers to Nomi by a namespaced name; hosts may rename it (`nomi:nomi`, `agent-plugin-<slug>-<hash>`).
7. Nothing requires hooks, MCP servers, commands or agent definitions.

## 6. Uncertainties: Phase 3 findings (2026-10-03)

Resolved means verified on a real host run. Open means the host CLI was not installed or not signed in on the test machine; the question and its test stay as written.

| ID | Question | Status | Finding |
|---|---|---|---|
| U1 | Does every host let the model resolve `node <skill-dir>/scripts/nomi.mjs`? | Resolved for Claude Code and Codex | Claude Code tells the model the skill's base directory. Codex reads the skill by its project path and ran `node .agents/skills/nomi/scripts/nomi.mjs doctor` and `observe` from the project folder; the run landed in the project's `.nomi/runs/`. Other hosts open |
| U2 | Cursor and OpenCode read both `.agents/skills` and `.claude/skills`: is Nomi listed twice? | Open, mitigated | Neither CLI is installed. `tools/install.mjs` writes only the folders of the hosts named in `--hosts`, so a duplicate needs an explicit two-host install |
| U3 | Does Codex's sandbox block the browser? | Resolved (Windows) | Yes. Under `workspace-write` on Windows, Chromium cannot create its nested sandbox inside Codex's restricted token: the GPU process exits with access denied and `observe` fails in about 8 s with the fallback message, never a hang. Of `--disable-gpu`, `--disable-gpu-sandbox`, `--in-process-gpu` and `--no-sandbox`, only `--no-sandbox` captured. Options for a user: run the capture outside the sandbox; set `NOMI_BROWSER_NO_SANDBOX=1` (local pages only, noted in the report; ARCHITECTURE D17); or accept the `probe print web` fallback. Codex on Linux and macOS is untested |
| U4 | Gemini CLI consent before `activate_skill` in `-p` runs | Open | Gemini CLI not installed |
| U5 | Antigravity plugin schema and `agy -p` skill loading | Open | `agy` not installed. V1 stays folder-only |
| U6 | OpenClaw: bundle support, which folder is the workspace, metadata conflict | Partly resolved | OpenClaw 2026.5.22 does not read `.agents/skills` from the shell folder: its workspace is `~/.openclaw/workspace`. With the set in `~/.agents/skills`, `openclaw skills list` shows `nomi` and `nomi-web` as ready (source `agents-skills-personal`, visible to the model). An agent run was not possible: the installed `@openclaw/codex` plugin fails to load on this version, and `agent --local` needs provider keys that are not set. The Agent Plugins bundle (documented from 2026.8.1) is untested |
| U7 | Hermes trust step and missing Node | Open | Hermes not installed |
| U8 | Does Cursor's `agent -p` load skills? | Open | The `agent` CLI is not installed (the IDE is) |
| U9 | Claude Code reads a root `plugin.json` and `.claude-plugin/plugin.json` | Mitigated | Both now ship. `claude plugin validate .` passes, and `npm run check` requires identical name, version and description, so precedence cannot matter. A load test with both present is pending a Claude Code sign-in |
| U10 | Can each host's model open local PNG files? | Resolved for Claude Code and Codex | Claude Code opened captures in Phase 2 and the migration runs. Codex read a random five-digit number that existed only in a PNG. Codex emits no event for viewing an image, so image viewing cannot be graded from its transcript |
| U11 | Which instruction file does each host always read? | Open | Not tested in Phase 3 |
| U12 | Does every host keep the Nomi folders side by side under their own names? | Resolved for Claude Code, Codex; listing only for OpenClaw | Codex read `.agents/skills/nomi-web/SKILL.md`, then ran the core CLI at `.agents/skills/nomi/`; `doctor` printed `domains web`. OpenClaw lists both folders under their own names. Hermes plugin packages (renamed folders) remain the known risk; no bundling was needed for any verified host |

Other findings:
- `codex exec --ignore-user-config` rejects every command ("blocked by policy"), with or without `--ignore-rules`. Headless Codex runs therefore keep the user config; Nomi's harness adds `--ignore-rules --ephemeral --disable memories`.
- `codex plugin marketplace add <repo>` accepts `.agents/plugins/marketplace.json` and lists `nomi@nomi` (tested against a throwaway `CODEX_HOME`). Installing the plugin from its GitHub URL is untested.
- npm installs host CLIs on Windows as `.cmd` shims, which Node cannot spawn without a shell. `tools/install.mjs` `resolveBin` runs the shim's script with Node instead.
- Codex reported that it can start subagents (self-reported; not exercised).
- Claude Code 2.1.289 with `claude-sonnet-5-5` at `--effort low` (2026-10-04): on Build requests over an existing project ("…fix any serious problems you find. Deliver index.html and a short verification report.") the model read the page and edited it without loading any skill, 0/7 with the Nomi plugin, including a Phase 2 case that activated 27/27 on 2.1.286. Short prompts still activated 4/4, and the same Build case at `--effort medium` loaded `nomi:nomi-web` first and captured. The cause was a third listed Nomi skill, not effort: with the Phase 3 pair of skills the same prompts activated 11/16 at low effort (ARCHITECTURE D20). Nomi therefore keeps two listings, and evals stay at low effort.
- Codex 0.159.3 runs a command that takes about 10 s (a motion capture) as a background session: `exec --json` then has the command's `item.started` but never its `item.completed`. The agent still reads the result. The harness counts such an observe with the runs it wrote before the agent finished.
- Codex agents on Windows wrote `--interact` files with PowerShell `Set-Content -Encoding utf8`, which adds a byte-order mark; `observe` now strips it.

## 7. Verification protocol

- `tools/verify-hosts.mjs` runs for every host CLI on PATH: temp project (a git repository) → project install for that host → one headless prompt from `adapters/hosts.json` → evidence read from the host's raw output and the files it left: skill activated, `doctor` ran (`domains web`), a capture exists and where, a number read from an image, subagents (self-reported) → `evals/reports/hosts-<date>.md`. `--record` writes status, version, date and evidence into `adapters/hosts.json`.
- Pass means activation plus a Nomi script run. Capture and image results are recorded but do not gate, because a host sandbox can block the browser.
- A host moves to `L` only with that evidence. A host that cannot be run locally stays `D`, and README states the limitation.
- Re-verify whenever packaging changes and within 14 days before a release. Host mechanisms changed several times in 2026 (Codex moved user skills to `~/.agents/skills`; Antigravity moved to `.agents/skills` and `~/.gemini/config/skills`), so dates matter.

## 8. Sources (accessed 2026-09-27)

- Agent Skills specification: https://agentskills.io/specification
- Agent Plugins specification v1.0.0: https://agent-plugins.org/specification
- Claude Code skills: https://code.claude.com/docs/en/skills · plugin manifest: https://code.claude.com/docs/en/plugins-reference · plugin evals: https://code.claude.com/docs/en/plugin-evals
- Codex skills: https://learn.chatgpt.com/docs/build-skills · plugins: https://developers.openai.com/codex/plugins/build · hooks: https://developers.openai.com/codex/hooks · non-interactive: https://developers.openai.com/codex/noninteractive
- Cursor skills: https://cursor.com/docs/context/skills · plugins: https://cursor.com/docs/plugins · headless CLI: https://cursor.com/docs/cli/headless
- OpenCode skills: https://opencode.ai/docs/skills/ · CLI: https://opencode.ai/docs/cli/
- Gemini CLI skills: https://geminicli.com/docs/cli/skills/ · extensions: https://geminicli.com/docs/extensions/reference/ · headless: https://geminicli.com/docs/cli/headless/
- Antigravity skills: https://antigravity.google/docs/skills · plugins: https://antigravity.google/docs/plugins/ · CLI headless: https://antigravity.google/docs/cli/headless/
- OpenClaw skills: https://docs.openclaw.ai/tools/skills · bundles: https://docs.openclaw.ai/plugins/bundles · agent CLI: https://docs.openclaw.ai/cli/agent
- Hermes skills: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills · plugins: https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins · CLI: https://hermes-agent.nousresearch.com/docs/user-guide/cli
- Universal installer: https://github.com/vercel-labs/skills
