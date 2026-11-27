---
type: regex
pattern: '\bmax-w-(prose|xs|sm|md|lg|[2-7]?xl|\[)[^>]*>\s*(<!--[^>]*-->\s*)?<(h[1-6]|p)\b'
match: not_contains
target: { source: file, path: app/pages/presse.vue }
---
