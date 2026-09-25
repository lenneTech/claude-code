---
type: regex
pattern: '<(UButton|button)\b[^>]*\brounded-full\b'
match: not_contains
target: { source: file, path: app/pages/index.vue }
---
