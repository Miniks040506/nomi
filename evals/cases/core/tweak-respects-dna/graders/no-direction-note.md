---
type: regex
target: trace
pattern: '"type":"assistant"[^\n]*Avoiding:'
match: not_contains
arm: both
---
