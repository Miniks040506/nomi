---
type: regex
target:
  source: file
  path: index.html
pattern: 'font-family[^;{}]*(?<!sans-)serif'
flags: i
---
