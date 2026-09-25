---
type: regex
pattern: 'uppercase[^"\x27]*tracking-(wide|wider|widest|\[)|tracking-(wide|wider|widest|\[)[^"\x27]*uppercase'
match: not_contains
target: { source: file, path: app/pages/index.vue }
---
