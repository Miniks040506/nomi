# Hosts

What is verified, with version and date. `L` means verified locally end to end: the host listed the skill, loaded it on a request, ran a Nomi script from the project and opened a capture. `D` means the install path follows the host's documentation and no agent run has confirmed it.

| Host | Status | Version | Verified |
|---|---|---|---|
| Claude Code | L | 2.1.286 | 2026-10-01 |
| OpenAI Codex | L | 0.159.3 | 2026-10-03 |
| Cursor | D | — | — |
| OpenCode | D | — | — |
| Gemini CLI | D | — | — |
| Google Antigravity | D | — | — |
| OpenClaw | D | — | — |
| Hermes Agent | D | — | — |

Both verifications were made on the earlier two-folder layout. The current one-folder layout has run on Claude Code 2.1.289 and Codex 0.159.3 in evaluation runs; the formal host verification is repeated on both before release.

## Notes per host

- **Claude Code**: plugin (`--plugin-dir`) or project folder (`.claude/skills/nomi`).
- **OpenAI Codex**: project folder (`.agents/skills/nomi`). On Windows see the sandbox note in the README.
- **Cursor, OpenCode, Gemini CLI, Antigravity**: `.agents/skills/nomi` per their documentation.
- **Hermes Agent**: loads project skills only in a git repository after `hermes skills trust`.
- **OpenClaw**: reads skills from its agent workspace, not from the folder you run it in; install with `--scope user` or `--dir <workspace>`.

The machine-readable source is `adapters/hosts.json`.
