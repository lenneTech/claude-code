---
type: regex
pattern: 'bg-(amber|orange|yellow|stone)-(50|100)\b|\b(cream|ivory|beige|off-white)\b|#(fdf|faf|fbf|f8f|f7f|f5f|fef)[0-9a-fA-F]{3}\b'
match: not_contains
target: { source: file, path: app/pages/index.vue }
---
