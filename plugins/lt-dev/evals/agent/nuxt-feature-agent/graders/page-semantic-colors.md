---
type: regex
pattern: '(text|bg|border|ring)-(red|blue|green|yellow|orange|amber|gray|slate|zinc|stone|emerald|sky|indigo|purple|pink|rose|teal|cyan|lime|violet|fuchsia)-[0-9]{2,3}'
match: not_contains
target: { source: file, path: app/pages/app/products/index.vue }
---
