# Motion

The motion module of the Nomi core: animation, transitions, and hover, focus and press states in a browser. `<skill-dir>` is the core folder.

**Every motion task, in order** (web pages: these come on top of the web skill's steps):
1. Read the nearest `.nomi/dna.md` (walk up from the project folder) before editing. Its Motion section, Never list and Decisions bind; the brief's explicit wishes override them. No DNA: the motion already on the page is the direction.
2. Pick the tier from `<skill-dir>/SKILL.md` §1: Tweak changes and checks; Build writes a direction note first; Create follows `references/direction.md` and writes the DNA with a `## Motion` section.
3. Capture the motion before and after changing it (Observe below) and open the sheets. Say "not visually verified" only when capture is impossible.
4. Build and Create: critique with `references/critique.md` plus the lenses below, then record decisions in the DNA.
5. Never describe how something moves unless you opened a sheet of it this session. Quote durations and easings from the run, not from the code you wrote.

## Decide
- Give each motion one job before writing it: orient (where this came from), confirm (the input was received), direct attention, or carry the signature. A motion without a job is not built.
- Fix a timing scale of 2–3 durations in ms, one easing family with its curve values, and the order elements enter in. Write them in the direction note or the DNA's `## Motion` section, and reuse them instead of new values per component.
- Decide what never moves, and what a visitor who asked for reduced motion gets instead: the same state change without travel, not nothing by accident.
- For a repair, name the motions that must survive.

## Traps
- Does everything enter the same way at the same moment because the content is equal, or because one class was applied to all of it?
- Is 300 ms `ease` a choice for this product, or the first value that came to mind? The same question for `transition: all`.
- Does this loop, pulse or parallax tell the visitor something, or only show that animation exists?
- Is the entrance longer than the wait it covers, and how does it read the fiftieth time?
- A brief or DNA may ask for any of these. A fingerprint is a question, never permission to remove motion that was requested. The reverse also holds: when the DNA's Motion section sets an order, a scale or an easing and the page does something else, the question is answered. Fix it.

## Instrument
- Use CSS animations, CSS transitions or the Web Animations API where the design allows: they are what the capture measures and replays. Motion drawn frame by frame from script (canvas, `requestAnimationFrame` tweens) is not measured; say so and verify it another way.
- Keep the timing scale and curves in one place (custom properties or one constants module), so a measured value maps to one line of code.
- Put the reduced-motion branch next to the motion it replaces.
- The capture replays animations and can fire their end handlers again: use a disposable development page when those handlers have side effects.

## Observe
Run from the project folder:
```
node <skill-dir>/scripts/nomi.mjs observe <url-or-index.html> --motion [--interact steps.json]
```
- The run records every animation from page load on, replays it from its own timing data, and loads the page again with reduced motion requested. Capture existing motion before changing it, and capture again after.
- **Open `load.png`** (8 frames across the load sequence, labelled in ms) and, with `--interact`, **`interactions.png`** (per step: before, two frames inside the change, after; cropped around the target). Single frames sit beside them in the run folder.
- States need a script. `steps.json` is a list of up to 6 steps, run in order, with the pointer parked between them:
```
[{"do":"hover","target":"#cta"}, {"do":"press","target":"#cta"}, {"do":"click","target":".menu-button"},
 {"do":"focus","target":"input[name=email]"}, {"do":"scroll","target":"#pricing"}, {"do":"wait","ms":1500}]
```
- `scroll` also takes `"y": <px>`; `wait` records motion that starts late.
- Read the summary: each animation group with its properties, duration, easing and delays. "Settles after" is the span from the first start to the last end of the finite animations. Exit 1 means findings were recorded; it is not a failed capture. `report.json` lists every animation with its element.
- One viewport per run (default 1440×900; `--viewport 390x844` for a phone). `--wait` (up to 5000 ms) bounds how long the load is watched.
- If launch fails, run `node <skill-dir>/scripts/nomi.mjs probe print motion` and execute its expression through a host browser tool: it lists the animations alive at that moment and the declared transitions, without frames. With no browser access, say **not visually verified** and cite code only.

## Critique lenses
- Access: which `motion.reduced-motion` findings remain? Each is an element that still travels when reduced motion is requested. A clean run without `--interact` says nothing about hover and press states.
- Job: name the job of each animation group in the summary in one phrase. Which group has none?
- System: compare every measured duration, easing, delay and entrance order with the DNA's Motion section (the run prints it as `DNA Motion`) or the direction note. Quote both values. A mismatch on existing elements is drift, an S2 to fix in this task, unless a Decision records it as an exception.
- Sequence: in `load.png`, what does the eye follow, in which order, and is the page usable before the last frame? Cite frame labels.
- Response: in `interactions.png`, does each state change read as an answer to the input by the first frame? Cite the step.
- Cost: `motion.layout-property` and `motion.long-frame` are measured; frame rate in a headless browser is not. Do not claim smoothness from this run.

## Moves
- Stagger by meaning, not by index: lead with the element the visitor acts on, group the rest, and cap the whole sequence so the page is usable early.
- Replace an animated layout property with transform or opacity on the same element when the look allows; capture again to confirm the finding is gone and the frames still read the same.
- Replace `transition: all` with the properties that differ between the states you captured.
- For reduced motion, keep the state change and drop the travel; confirm with a new run, not by reading the media query.
- Compare two runs of the same page:
```
node <skill-dir>/scripts/nomi.mjs diff <before-id> <after-id>
```
- Open the before/after sheet. A shorter settle time or fewer findings is not proof of better motion; check what the frames show.
- Hand a fresh critic `node <skill-dir>/scripts/nomi.mjs critique pack --task "…" --domain motion --run <id>` when available. Stop at the tier's round budget and report unresolved or unverified issues.
