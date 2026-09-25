---
type: regex
pattern: '<em\b|\bitalic\b'
match: not_contains
target: { source: file, path: app/pages/index.vue }
---
