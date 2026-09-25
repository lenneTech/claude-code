---
type: regex
pattern: '[\x27">]\s*0[1-9]\s*[\x27"<]|\b0[1-9]\s*/\s*0[1-9]\b'
match: not_contains
target: { source: file, path: app/pages/index.vue }
---
