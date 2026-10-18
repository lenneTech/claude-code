---
type: regex
pattern: '^(?![^\n]*\.(?:spec|test)\.[jt]s$)[^\n]*(?:date|calendar|picker|datum|kalender)[^/\n]*\.(?:vue|ts|js)$'
flags: im
match: not_contains
target: files
---
