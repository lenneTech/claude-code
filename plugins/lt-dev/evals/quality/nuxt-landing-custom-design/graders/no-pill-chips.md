---
type: regex
pattern: '\brounded-full\b[^"\x27]*\b(px-2|px-2\.5|px-3)\b[^"\x27]*\btext-xs\b|\btext-xs\b[^"\x27]*\b(px-2|px-2\.5|px-3)\b[^"\x27]*\brounded-full\b'
match: not_contains
target: { source: file, path: app/pages/index.vue }
---
