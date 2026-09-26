You are the lead architect for **Nomi**, a multi-agent creative intelligence layer for coding agents.

Your job in this run is to **fully understand, research, architect, and plan Nomi V1**.

Do NOT implement the product yet.

Read the entire repository first.

Nomi should ultimately support major agent environments including:
- Claude Code
- OpenAI Codex
- Cursor
- OpenCode
- Gemini CLI
- Google Antigravity
- OpenClaw
- Hermes Agent

Nomi should use a vendor-neutral canonical skill system wherever possible, with thin platform-specific adapters only where required.

Before planning an integration, verify the current real mechanism used by that platform. Do not invent compatibility.

Nomi's product goal is to give coding agents capabilities they often apply inconsistently:
- creative direction
- contextual taste
- anti-generic / anti-AI-slop reasoning
- visual and interaction judgment
- motion judgment
- 3D / spatial judgment
- game feel
- worldbuilding consistency
- iterative critique and refinement

Planned product areas:
- Nomi Core
- Nomi Web
- Nomi Motion
- Nomi 3D
- Nomi Game
- Nomi World

You may change the internal architecture if a better abstraction exists.

For every feature ask:
> What does this make the agent actually do differently?

Avoid turning Nomi into a design handbook, prompt collection, or framework tutorial.

Create or revise:
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/INTEGRATIONS.md`
- `docs/EVALUATION.md`

Keep documentation concise and canonical.

## IMPLEMENTATION PLAN RULES

Divide implementation into **large coherent phases**, not tiny tasks.

A phase should produce a meaningful working capability and normally involve multiple related files and implementation decisions.

Good phase examples:
- Core creative intelligence
- Taste / critique / anti-slop
- Web + observation loop
- Motion
- Multi-agent integration
- 3D
- Game
- World + orchestration
- Evals / hardening / release packaging

Bad phase examples:
- create one file
- add one function
- rename one field
- write one test

For every phase define:
- objective
- scope
- dependencies
- expected deliverables
- acceptance criteria
- validation/evals
- important architectural considerations
- status: `NOT STARTED`, `IN PROGRESS`, or `DONE`

Prefer roughly **6–10 substantial implementation phases** for V1.

Also identify:
- major technical risks
- integration uncertainty
- reversible architecture decisions
- areas where Nomi may duplicate base-model capability
- context-bloat risks
- the smallest compelling V1

At the end, critically review and simplify the plan once.

Do not begin implementation.

Stop when the repository contains a strong architecture and executable implementation plan ready for the next coding run.
