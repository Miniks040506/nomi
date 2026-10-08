# Hosts

What is verified, with version and date (UTC). `L` means verified locally end to end on Windows 11: installed into a fresh project with `tools/install.mjs`, the host's headless agent loaded the skill, ran a Nomi script from the project and read an image. `D` means the install path follows the host's documentation and no agent run has confirmed it.

| Host | Status | Version | Verified |
|---|---|---|---|
| Claude Code | L | 2.1.289 | 2026-10-07 |
| OpenAI Codex | L | 0.159.3 | 2026-10-07 |
| Cursor | L | 2026.10.01-e373342 | 2026-10-07 |
| OpenCode | D | — | — |
| Gemini CLI | D | — | — |
| Google Antigravity | L | 1.3.1 | 2026-10-07 |
| OpenClaw | D | — | — |
| Hermes Agent | L | 0.21.5+8894.g04dc7f8 | 2026-10-07 |
| Kiro | D | — | — |

Linux and macOS installs of these hosts are not verified. Nomi's own scripts and installer are tested on Windows and Linux.

## Notes per host

- **Claude Code**: plugin (`--plugin-dir`) or project folder (`.claude/skills/nomi`). Captured and opened the capture.
- **OpenAI Codex**: project folder (`.agents/skills/nomi`). On Windows its sandbox stops the browser; see the sandbox note in the README.
- **Cursor** (`cursor-agent`): project folder (`.agents/skills/nomi`). Captured and opened the capture. On Windows start it from PowerShell or cmd: started from Git Bash it runs your hooks through bash, and a hook written for PowerShell then blocks every tool call.
- **Google Antigravity** (`agy`): project folder (`.agents/skills/nomi`). Captured and opened the capture.
- **Hermes Agent**: project folder (`.agents/skills/nomi`), loaded only in a git repository after `hermes skills trust`. On Windows a user install goes to `%LOCALAPPDATA%\hermes\skills`. The first terminal command of a Hermes session on Windows can print only `stdin is not a tty`; the agent has to run it again.
- **Kiro**: reads `.kiro/skills/nomi` only. Installed from its documentation; no agent run yet.
- **OpenCode, Gemini CLI**: `.agents/skills/nomi` per their documentation; not installed on the test machine.
- **OpenClaw**: reads skills from its agent workspace, not from the folder you run it in; install with `--scope user` or `--dir <workspace>`. Its agent could not be started on the test machine.

The machine-readable source is `adapters/hosts.json`.
