---
type: regex
pattern: '<(p|h[1-6])\b[^>]*\bmax-w-(prose|xs|sm|md|lg|[2-7]?xl|\[)'
match: not_contains
target: { source: file, path: app/pages/presse.vue }
---
