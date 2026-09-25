---
type: regex
pattern: 'blur-(2xl|3xl|\[)|animate-(ping|pulse)'
match: not_contains
target: { source: file, path: app/pages/index.vue }
---
