---
type: regex
pattern: '^(?:[^\n]*\n){131}'
match: not_contains
target: { source: file, path: app/components/Task/TaskForm.vue }
---
