# Web

The web module of Nomi: pages, app screens and components rendered in a browser. `<skill-dir>` is the folder containing `SKILL.md`. The entry file's steps apply; this module adds what to decide, how to capture and what to judge.

## Decide
- Read the existing page and token sources before choosing a direction. Preserve choices the brief or DNA explicitly names.
- Fix the layout concept, type roles, palette roles, density, copy voice and one signature. Translate them into values in the direction note; do not add a second design document.
- One style, written down: one way to show emphasis, one family of corner radii, one rule for depth, one accent with one job. A second way needs a reason in the direction note. Mixed treatments are what makes a page look assembled rather than designed.
- For a repair, name what must survive. For a new surface, name the action the visitor should find first.

## Traps
- Does the same card shape carry unrelated content because the content needs it, or because it was easy to repeat?
- Would the layout still identify this subject with the headline removed? Check the rendered composition, not merely subject-specific nouns.
- Are uppercase labels, large mastheads, gradients or square corners requested choices? A fingerprint is a question, never permission to erase them.
- Does the final report describe an intended result or an image you actually opened?

## Instrument
- Use the project's normal development server for framework apps. File/directory capture serves static assets; it does not compile an app.
- Keep existing CSS tokens as the source of truth. Read their roles before treating an off-palette semantic colour as drift.
- No page instrumentation is required. The probe runs focus handlers, so use a disposable development page when focus has side effects.

## Observe
Run from the project folder:
```
node <skill-dir>/scripts/nomi.mjs observe <url-or-index.html>
```
- For existing work, capture before changing it. After building or fixing it, capture again. Defaults cover desktop 1440×900 and phone 390×844.
- **Open the printed contact sheet and the individual image for any region you judge.** Read `report.json` when a summary truncates findings. Exit 1 means findings were recorded; it is not a failed capture.
- Inspect lower sections with `--full`; use `--viewport 390x844` for a focused follow-up, `--dark` or `--reduced-motion` when relevant. Loading is bounded; a settle warning means the captured state may be incomplete.
- A capture is one state. Use the host's browser interaction tools to inspect menus, forms and other states the task changes. The keyboard pass only checks detected indicators on sampled controls.
- Animation, transitions and hover or press states are not in a static capture. When the task adds or changes any, also run `observe <target> --motion` before and after, open `load.png`, and follow `<skill-dir>/modules/motion.md` (interaction steps, lenses, moves).
- If launch fails, run `node <skill-dir>/scripts/nomi.mjs probe print web` and execute its expression through a host browser tool, then capture and open that browser's images. With no browser access, say **not visually verified** and cite code only.

## Critique lenses
- Access: which `web.contrast`, `web.overflow` or `web.focus` findings are confirmed in the rendered state? Unknown contrast is unverified, not passing. Check focus styles in their keyboard state before changing them.
- Hierarchy: which element wins attention in each screenshot, and does that serve the visitor's action? Cite the image and region.
- Continuity: compare measured families, sizes and colours with the DNA and token roles. Counts are evidence, not targets to minimize.
- Identity: which visible choice makes this page specific, and which repeated treatment obscures a meaningful content distinction?
- In the verdict cite `.nomi/runs/<id>/<image>.png` only after opening it. For a numeric claim, cite that run's `report.json` and quote its value. Do not infer a successful interaction from a static image.

## Moves
- Repair the shared token or component when several findings share a cause; re-observe both widths to catch collateral changes.
- Preserve the signature and Keep list while changing density or hierarchy. Do not solve contrast by replacing the whole palette.
- Compare the same state and viewport after refinement:
```
node <skill-dir>/scripts/nomi.mjs diff <before-id> <after-id>
```
- Open the before/after sheet. A lower finding count is not proof of better taste; inspect what changed and retain deliberate exceptions with reasons.
- Hand a fresh critic `node <skill-dir>/scripts/nomi.mjs critique pack --task "…" --domain web --run <id>` when available. Stop at the tier's round budget and report unresolved or unverified issues.
