# Nomi Integrations

How Nomi reaches each target host. Facts below were checked against official documentation on **2026-09-27** (status `D`). Nothing is claimed as working until it is verified locally in Phase 3 (status `L`, with version, date and evidence). Tools read the same facts from `adapters/hosts.json`; `tools/check.mjs` keeps the two in sync.

## 1. Summary

- Every target host loads **Agent Skills** (a folder with `SKILL.md`), so Nomi ships **one canonical skill folder**, `skills/nomi/`, and no per-host copies of its logic.
- A project install needs only two folders: **`.agents/skills/nomi`** (Codex, Cursor, OpenCode, Gemini CLI, Antigravity, OpenClaw, Hermes) and **`.claude/skills/nomi`** (Claude Code, which does not read `.agents/skills`).
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
| Project folders | All eight | Copy `skills/nomi` to `<project>/.agents/skills/nomi`; add `<project>/.claude/skills/nomi` only when Claude Code is used (U2). `tools/install.mjs --scope project` does both idempotently |
| User folders | All eight | `~/.agents/skills/nomi` (Codex, Cursor, OpenCode, Gemini CLI, OpenClaw default state), `~/.claude/skills/nomi`, `~/.gemini/config/skills/nomi` (Antigravity), `~/.hermes/skills/nomi` or an `external_dirs` entry. `tools/install.mjs --scope user` |
| Claude Code plugin | Claude Code | `.claude-plugin/plugin.json` + `marketplace.json` at the Nomi repo root |
| Agent Plugins v1 | Codex, Cursor, OpenClaw (≥2026.8.1), Hermes | Root `plugin.json` (`$schema` `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`, `name`, `version`, `description`, …) + `skills/`. Codex also needs `.agents/plugins/marketplace.json` |
| Gemini CLI extension | Gemini CLI | Root `gemini-extension.json`; `skills/` is bundled |
| Third-party installer | All eight | `npx skills add <owner>/<repo>` (vercel-labs/skills) works as a fallback, but some of its target paths lag the hosts' own docs (for example Antigravity's global path), so it is not the primary channel |

All manifests share one `name` (`nomi`) and one `version`; `tools/check.mjs` fails on mismatches.

## 5. Rules for the canonical skill (normative)

1. Frontmatter uses only `name`, `description`, `license`, `compatibility` and `metadata` with string values.
2. `name` is `nomi` and equals the folder name.
3. `description` ≤400 characters with the trigger phrase first (Codex budgets all descriptions together; OpenClaw truncates under `skills.limits.maxSkillsPromptChars`; Hermes recommends short descriptions).
4. Paths are relative to the skill folder; scripts run as `node <skill-dir>/scripts/nomi.mjs`.
5. No host variables (`${CLAUDE_SKILL_DIR}`, `$ARGUMENTS`), no host tool names, no host-only frontmatter.
6. Nothing refers to Nomi by a namespaced name; hosts may rename it (`nomi:nomi`, `agent-plugin-<slug>-<hash>`).
7. Nothing requires hooks, MCP servers, commands or agent definitions.

## 6. Open uncertainties (resolved in Phase 3)

| ID | Question | How to resolve |
|---|---|---|
| U1 | Does every host tell the model the skill's directory so `node <skill-dir>/scripts/nomi.mjs` resolves? Claude Code does ("base directory"); others unverified | Headless run per host asking the agent to run `nomi doctor` |
| U2 | Cursor and OpenCode read both `.agents/skills` and `.claude/skills`; a two-folder install may list `nomi` twice | Install both, inspect the listing; the installer writes `.claude/skills` only when Claude Code is a target |
| U3 | Codex's default sandbox may block launching a browser or reaching localhost | Run `nomi observe` through `codex exec`; document the needed sandbox setting or the `probe print` fallback |
| U4 | Gemini CLI asks consent before `activate_skill`; behavior in `-p` runs is undocumented | Headless run with and without an approval-mode flag |
| U5 | Antigravity's plugin schema differs from Agent Plugins at the same filename (`plugin.json`); global skill paths differ between 2.0/IDE and CLI; skill loading in `agy -p` is undocumented | Test `agy plugin install` against the repo; otherwise stay folder-only |
| U6 | Local OpenClaw 2026.5.22 predates documented bundle support; its "workspace" may not be the project folder; nested `metadata.openclaw` conflicts with the spec's string map | Upgrade, test bundle and folder installs, confirm which folder the agent works in |
| U7 | Hermes needs `hermes skills trust` for project skills and may lack Node | Test both project and `~/.hermes/skills` installs; check `nomi doctor` output |
| U8 | Does Cursor's `agent -p` load skills? | Headless trigger prompt; fall back to documented IDE verification |
| U9 | Claude Code reads a root `plugin.json` as well as `.claude-plugin/plugin.json`; precedence is undocumented | Keep both identical; confirm with `claude plugin validate .` and a load test |
| U10 | Can each host's model open local PNG files? | Headless run asking the agent to describe a fixture image |

## 7. Verification protocol

- `tools/verify-hosts.mjs` runs for every host CLI present: temp project → install → headless prompt → record discovery, activation, script execution, image viewing and subagent availability → `evals/reports/hosts-<date>.md`.
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
