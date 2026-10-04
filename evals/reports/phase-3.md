# Phase 3 report: multi-host packaging and verification

Date: 2026-10-03. Status: **IN PROGRESS**. The packaging, installer, verifier, drivers and suites are built and tested; two of eight hosts are verified. Three acceptance criteria are not met, each for a reason outside the code (see "What blocks completion"). Raw data: `evals/results/phase-3/` (ledger, transcripts), `evals/reports/hosts-2026-10-03.md`.

## Acceptance criteria

| # | Criterion | Result |
|---|---|---|
| 1 | Every host is `L` with evidence, or `D` with a concrete blocker; README claims nothing more | **Met.** 2 `L`, 6 `D`, each blocker written in `adapters/hosts.json` and INTEGRATIONS §2. `npm run check` fails if the two disagree |
| 2 | At least five hosts reach `L` | **Not met: 2 of 8** (Claude Code, Codex). The other six need a CLI install and a signed-in account, or a working local install (OpenClaw) |
| 3 | `claude plugin validate .` passes; Agent Plugins manifest validates; `gemini extensions link .` loads the skill where available | **Partly.** Validate passes; `plugin.json` validates against the vendored schema in `check`; Gemini CLI is not installed, so the link test did not run |
| 4 | Trigger suite on automatable hosts: recall ≥0.85, false-trigger ≤0.15 | **Met on Codex** (recall 15/15, false trigger 1/15, one run per prompt). **Not run on Claude Code**: its CLI login had expired |
| 5 | Installer idempotent on Windows and Linux; uninstall documented | **Windows met** (tests, including a path with a space and a non-ASCII character). **Linux not run** in this session |
| 6 | Codex A/B reruns `web-seeded`, result reported | **Not met.** One baseline run finished (2/2 defects fixed, no new S1, decoy intact); the first with-Nomi run hit the Codex usage limit |

## Environment

| Item | Value |
|---|---|
| Machine | Windows 11 (10.0.26300), Node 24.21.0, Edge and Chrome |
| Codex | codex-cli 0.159.3, `gpt-6.1-sol`, reasoning effort low, ChatGPT plan login, `workspace-write` sandbox |
| Codex flags | `exec --json --ignore-rules --ephemeral --disable memories --skip-git-repo-check`. User config applies; `--ignore-user-config` rejects every command |
| Baseline hygiene (Codex) | More than 20 user-level skills in `~/.agents/skills`, several of them design skills (for example `design-taste-frontend`, `minimalist-ui`), are visible to both arms. No Nomi skill is installed at user level |
| Claude Code | 2.1.286 installed; CLI login expired, so no headless run was possible today |
| OpenClaw | 2026.5.22; agent runs fail to start (bundled codex plugin load error; no provider keys) |

## Host verification (`tools/verify-hosts.mjs`)

| Host | Status | Evidence or blocker |
|---|---|---|
| Claude Code | L (2.1.286, 2026-10-01) | From the migration discovery runs: plugin and project-folder installs listed both skills, the web skill activated, the core CLI captured from the project, the capture was opened |
| OpenAI Codex | L (0.159.3, 2026-10-03) | Read `.agents/skills/nomi-web/SKILL.md` and the core, ran `doctor` (`domains web`), captured in the project's `.nomi/runs/`, read the proof number from a PNG, reported subagents. 178 s, 440k input tokens (420k cached) |
| OpenClaw | D | Lists `nomi` and `nomi-web` as ready from `~/.agents/skills`. No agent run |
| Cursor, OpenCode, Gemini CLI, Antigravity, Hermes | D | CLI not installed |

## Trigger suite (Codex, 30 prompts × 1 run)

| Metric | Result | Gate |
|---|---|---|
| Recall (15 should-trigger) | 15/15 = 1.00 | ≥0.85 |
| False-trigger rate (15 should-not) | 1/15 = 0.07 | ≤0.15 |
| Web prompts that read `nomi-web` | 10/10 | — |
| Non-web prompts that read the core | 5/5 (2 of them also read `nomi-web`: the motion and 3D plans) | — |

- The one false trigger: "Make the port configurable through the PORT environment variable" read both skills.
- 9 of 10 web prompts read both `SKILL.md` files in the first command. On Codex the hybrid's "one entry file" does not hold: the model reads every skill that looks relevant. Routing accuracy is therefore not a meaningful number on this host.
- Each run was stopped after the first skill read or four commands. Evidence for that cut: in 14 of the 16 activating runs the skill read was the first command; in the other two it came within the four-command window. 790k input tokens, 5.6k output tokens in total.
- Spread: one run per prompt. No repeat runs, so no variance estimate. The gate margin (15/15, 1/15) is wide, but a single run is weaker evidence than the plan's three.

## Codex `web-seeded` A/B

| Case | Arm | Seeded S1 fixed | New S1 | Decoy intact | Time | Tokens in / out |
|---|---|---|---|---|---|---|
| bench-prices | without | 2/2 | 0 | 1/1 | 93 s | 147k / 2.2k |
| bench-prices | with | usage limit after 129 s | — | — | — | — |

No comparison is possible from one baseline run. The Codex baseline fixing 2/2 is consistent with the Claude Code baseline ceiling of Phase 2.

## Findings that changed the design

1. **Codex sandbox and the browser (U3, D17).** Under `workspace-write` on Windows, Chromium cannot nest its sandbox: `observe` fails in about 8 s with the fallback message. Flags tried inside `codex sandbox`: none, `--disable-gpu`, `--disable-gpu-sandbox`, `--disable-gpu --disable-gpu-sandbox`, `--in-process-gpu` (all fail), `--no-sandbox` (captures). Nomi now has an opt-in `NOMI_BROWSER_NO_SANDBOX=1`, accepted only for local targets and noted in the run report.
2. **The agent enabled that switch itself.** In the verification run the Codex agent read `browser.mjs` after two failed captures, set the variable and captured. The switch is absent from the skill text and from error messages, but an agent that reads the source finds it. The local-target rule was added after this run. This is a user-level decision to confirm or reverse (see risks).
3. **`--ignore-user-config` is unusable for Codex evals.** Every command is rejected as "blocked by policy". Codex runs keep the user's config, which weakens isolation.
4. **OpenClaw's project folder is its agent workspace**, not the shell folder. A project install there needs `--dir <workspace>` or `--scope user`.
5. **Codex reads several skills at once**, so the per-domain entry skill does not reduce what Codex loads.

## Tests and checks

- `npm run check`: clean. New rules: manifest consistency, Agent Plugins schema, manifests listed in `hosts.json` exist, INTEGRATIONS status rows equal `hosts.json`.
- `npm test` on Windows, final code: 87/87 in 51 s (Edge).
  - Earlier full runs on a loaded machine (Codex evals and two overlapping test runs) failed one browser timing test and then hung. Cause of the hang: the harness gave `taskkill` 2 s to stop a timed-out host; under load it took longer, the process tree survived and the run never ended. The budget is now 15 s. This is the hang the migration report saw once and could not reproduce.
  - Browser timing tests still depend on machine load (a 10 s limit was missed at 13.7 s under load).
- `claude plugin validate .`: passes.
- Linux (WSL2): not run. The portable Node and browser used in earlier phases live in `/tmp` and are gone; fetching them again is a download that was not requested in this session.
- CI workflow added (`.github/workflows/check.yml`); it has never run, because nothing was pushed.

## Costs

| Item | Runs | Cost |
|---|---|---|
| Claude Code model calls | 0 | $0.00 |
| Codex trigger suite | 30 | plan-billed; 790k input, 5.6k output tokens |
| Codex host verification | 3 (one blocked by policy flags, one pass, plus flag probes) | plan-billed; about 0.7M input tokens, mostly cached |
| Codex `web-seeded` | 1 complete, 1 stopped by the usage limit | plan-billed; 147k input tokens for the complete run |
| **Dollar spend** | | **$0 of $25** |

## What blocks completion

| Blocker | Unblocks | Who |
|---|---|---|
| Claude Code CLI login expired (`claude`, then `/login`) | AC4 on Claude Code (30 runs, about $1–2), today's Claude Code verification, the U9 load test | User |
| Codex usage limit (resets 8:24 PM local, 2026-10-03) | AC6: 17 more `web-seeded` runs, about 150–450k input tokens each. The plan's limit may not cover 18 runs in one window | Time, or a larger plan |
| Three more hosts at `L` | AC2. Each needs an installed CLI and a signed-in account: Gemini CLI, OpenCode, Hermes, Cursor `agent`, Antigravity `agy`; or OpenClaw upgraded with a provider key | User (installs and sign-ins) |
| Linux toolchain | AC5 on Linux, DoD item 2 | User approval to download portable Node and chrome-headless-shell into WSL2, or a first CI run |

Resume commands, once unblocked:
```text
node tools/verify-hosts.mjs --record
node evals/harness/runner.mjs --suite trigger --arm with --runs 1 --out evals/results/phase-3
node evals/harness/runner.mjs --suite web-seeded --host codex --model gpt-6.1-sol --arm both --runs 3 --out evals/results/phase-3 --retry-errors
```

## Risks and limitations

- **D17 lets an agent turn off the browser sandbox** for local pages when it reads the source. Inside a host sandbox the exposure is small; outside one (a host with no sandbox) the same variable still works. Not yet restricted to sandboxed hosts, because Nomi cannot detect one reliably.
- **Codex isolation**: user config, user-level skills and the user's MCP servers are active in every Codex eval run.
- **Codex "opened a capture" is unmeasurable**: image views emit no event, so evidence-claim validity cannot be graded on Codex.
- **Trigger runs are cut short.** A skill that would load late in a long task is not counted. On Claude Code the migration data showed activation at the first or second action in 26 of 26 runs; on Codex it was the first command in 14 of 16 activating runs here.
- **Marketplace installs are untested**: the Codex and Claude Code marketplace files parse and list the plugin, but nothing was installed from GitHub.
- **U2, U4, U5, U7, U8, U11 remain open**; U6 and U9 are partly resolved.
