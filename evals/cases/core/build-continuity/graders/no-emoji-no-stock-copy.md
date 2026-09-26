---
type: regex
target:
  source: file
  path: index.html
pattern: '[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|unforgettable|discover the magic|adventure awaits'
flags: iu
match: not_contains
---
