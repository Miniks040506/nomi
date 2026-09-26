---
type: regex
target:
  source: file
  path: index.html
pattern: 'type\s*=\s*["'']?date'
flags: i
match: not_contains
---
