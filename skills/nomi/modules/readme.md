# Readme

The README stage of Nomi: a visitor understands what the product is and wants to try it within one screen, and everything the page shows or tells them to type is true. `<skill-dir>` is the folder containing `SKILL.md`. It runs when a README is asked for, and at the end of a delivery the user wants presented.

## Inputs
- The product as it is now: run it. Its jobs: `.nomi/plan.md` or `.nomi/flows.json`, and the latest review (`.nomi/proof.md`). No review yet, and the product has an interface: run `review <target>` first; the README states what was verified, so something must have been.
- How a person starts it: the manifest's scripts, the entry file, the port. Read them; do not assume a stack's usual commands.
- The existing README, if any: keep what is true and specific to this project (licence, credits, links that resolve).
- Pictures from the latest runs, when one says something faster than a sentence. Copy what you show out of `.nomi/runs/` (it is not kept) into a folder the repository tracks.

## Steps
1. Run every command the README will tell a reader to type, from a clean state where you can, each through:
```
node <skill-dir>/scripts/nomi.mjs readme run "<command>"
```
   It records the result in `.nomi/commands.json`. A command still running after 20 seconds (a server) counts as started and is stopped. A command that fails is fixed or left out. One you cannot run here (it needs an account, a key, another machine) stays in with `# unverified: <why>` on its line. Do not fetch a tool to make a command work (`npx <package>`, a global install): use what the project ships, and say what is broken.
2. Make the demo, unless the user said no video: open `<skill-dir>/modules/brandvid.md`, write `.nomi/storyboard.json` and run
```
node <skill-dir>/scripts/nomi.mjs brandvid <url-or-index.html>
```
   A flow sheet or a screenshot is not the demo. Only when the user said no video, or there is nothing to film (no interface, no flow that completes): put `<!-- no demo: <why> -->` under the title and show one capture.
3. Write the README in the order the best-known repositories use, top to bottom, and stop adding sections when the reader has enough:
   - Header: the name, then one line that says what it is and for whom, in plain words (the plan's Read line is the source). A README longer than two screens gets a row of links to its own sections under that line.
   - The demo, at full width, before any other section, in the form `brandvid` printed: `[![<what it shows>](.nomi/video/preview.webp)](.nomi/video/demo.mp4)`, and under it one line that says exactly what is shown. A `<video>` element is removed where repositories are shown; the linked preview plays there.
   - Highlights: three to six lines, one fact each, in the reader's words. A number only with where it was measured.
   - Quick start: the shortest path from a fresh copy to the first job done, one block per way to start, only commands from step 1. Under a command, the lines it printed when they tell the reader it worked.
   - What it does: one short part per job: what the person does, and a capture or the real output of it.
   - Verified, then Not verified: what was run and measured, from the proof card (flows completed, viewports), with the date; then what was not.
   - Then only what this project has: configuration, limits, credits for what it builds on, its licence. No badge, logo or section that would read the same in another project's README.
4. Check it, and fix every line marked to fix:
```
node <skill-dir>/scripts/nomi.mjs readme check
```
   For each `readme.claim` line, answer its question with a number, a capture or a flow, or cut the phrase.

## Outputs
- `README.md` for which `readme check` prints nothing to fix: every image and video it shows exists, every local link and anchor resolves, every command was run or is marked unverified.
- In your reply: what the README shows, which commands were run with their results, and what is marked unverified.

## Stop
- Done when `readme check` exits 0 and you read the result once as a visitor: the first screen says what it is and shows it.
- Do not invent what is missing: no badge, benchmark, roadmap, contributor guide or licence that the project does not have. Ask the user at most one question, and only for a fact you cannot find and the README cannot do without (the licence, a public address).
