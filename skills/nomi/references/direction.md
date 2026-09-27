# Direction protocol

For Create-tier work: a new product, site, game or world, a redesign, or "make it distinctive". The result is `.nomi/dna.md`. Work through the steps in order and show steps 2–5 in your reply, a few lines each.

## 1. Ground in the subject
Before choosing anything, list at least six concrete things from the subject's own world: materials, objects, places, printed matter, tools, rituals, sounds, local words. A Lisbon bakery gives azulejo tiles, tram-28 yellow, flour-sack paper, the Saturday queue; "warm and artisanal" is not on the list. Distinctive choices come from this list, not from a style name.
For a redesign, add the current product's most recognisable element to the list and decide explicitly whether it survives.

## 2. Name the default
Write one sentence describing what a generated result for this exact brief would look like if nobody decided anything. Defaults current models reach for (as of 2026-09):
- Independent shops, cafés, bakeries, bookshops: warm cream background, high-contrast serif display, terracotta or clay accent.
- Wellness, yoga, therapy: greige and sand neutrals, a light serif or system sans, rounded cards with soft shadows, "find your balance" copy.
- Software products: white or near-black, a geometric sans, an indigo-to-purple gradient, a hero followed by three identical feature cards.
- Template chrome anywhere: tracked all-caps labels above every heading, "A · B · C" meta lines, 01/02/03 numbering on things that are not a sequence, an arrow on every link, one italic or coloured word in the headline.
- Motion: fade-and-rise on every section. 3D: a centred object under flat light. Games: floaty, symmetric jumps. Worlds: names like "Elara" and "Eldoria", an ancient evil awakening.
A default is not forbidden. Use it only when the brief asks for it or an item from step 1 argues for it, and say which.

## 3. Diverge
Sketch two or three directions that differ on at least two axes: light or dark, dense or airy, formal or loose, quiet or loud type, warm or cool, still or kinetic. Anchor each in an item from step 1. One line per direction.

## 4. Choose
Pick one against the intent: who it is for, the situation they are in, what they should feel or do. Give one sentence on why each other direction lost. Proceed with your pick, and name the alternatives in your final report so the user can redirect.

## 5. Translate
Rewrite every trait as concrete, checkable values for each active domain:

| Domain | Values to fix |
|---|---|
| Web | typefaces and their roles, 4–6 hex colours with roles, type sizes, spacing unit, layout rule, copy voice |
| Motion | what moves and why, 2–3 durations, one easing family, what never moves |
| 3D | lens and camera height, key light direction and colour, material palette, scale cue |
| Game | core verbs, and the numbers behind each feel word (jump height, time to apex, acceleration) |
| World | premise, what power costs, naming rules per culture |

Words such as "modern", "clean", "premium" or "playful" stay out of the DNA unless the same line says what they mean in values.

## 6. Signature and Never
- Signature: the one or two moves someone would remember and no default would produce. Spend boldness there; keep everything else disciplined.
- Never: 3–6 project-specific anti-goals, each checkable. Include the default you rejected in step 2.

## 7. Write the DNA
Run `node <skill-dir>/scripts/nomi.mjs dna init`, or copy `assets/dna.md` to `.nomi/dna.md` by hand. Fill Intent, Character (one trait per line, with its values), Signature and Never, plus a section for each active domain other than web (Motion, Space, Feel, World). Add the first decision: today's date · domain · the direction chosen, and why. Then run `dna check` and fix every finding; without Node, confirm by hand that every Character line carries values.

Make the DNA visible to every future agent, including ones that never load this skill. `dna init` does this. By hand: append the line "Creative direction for this project lives in `.nomi/dna.md`: read it before changing anything people see, and follow its Never list." to AGENTS.md and CLAUDE.md where they exist, or create AGENTS.md with it.

## When the brief already decides
Follow the brief exactly on every axis it fixes, including a look listed as a default in step 2. Apply steps 1–6 only to the axes it leaves open.
