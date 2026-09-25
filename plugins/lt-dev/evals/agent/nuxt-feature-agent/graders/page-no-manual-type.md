---
type: regex
pattern: '(interface|type)\s+Product(Dto)?\s*(=|\{)'
match: not_contains
target: { source: file, path: app/pages/app/products/index.vue }
---
