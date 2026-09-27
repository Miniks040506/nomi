---
type: regex
target:
  source: file
  path: index.html
pattern: 'box-shadow\s*:(?!\s*none\s*[;}!])|border-radius\s*:(?!\s*0(?:px|rem|em|%)?\s*[;}!])|gradient\('
flags: i
match: not_contains
---
