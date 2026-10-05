---
nomi: 1
domains: [web, motion]
---
## Intent
Foot passengers check the next sailing from the quay, phone in one hand, often in rain.
## Character
Harbour signage: Arial 18px, ink #0b1f2a on white, signal yellow #ffd400 for late and live states, 2px rules, no cards.
## Signature
Departure rows arrive like a split-flap board settling, top row first.
## Never
Nothing may delay reading the next sailing. Keep the live dot pulsing: it shows the board is connected.
## Motion
Rows enter in order, 40ms apart, 240ms each, cubic-bezier(0.2, 0.8, 0.2, 1). The live dot pulses over 1600ms, ease-in-out, forever. State changes take 120ms.
## Decisions
## Open questions
