---
type: regex
pattern: '(interface|type)\s+Product(Dto|CreateInput)?\s*(=|\{)'
match: not_contains
target: { source: file, path: app/components/Product/ProductCreateModal.vue }
---
