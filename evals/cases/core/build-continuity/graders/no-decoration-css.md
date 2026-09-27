---
type: regex
target:
  source: file
  path: styles.css
pattern: 'box-shadow\s*:(?!\s*none\s*[;}!])|border-radius\s*:(?!\s*0(?:px|rem|em|%)?\s*[;}!])|gradient\('
flags: i
match: not_contains
---
