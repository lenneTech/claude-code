# Knowledge Base

## Overview
The knowledge base stores company-wide information used as AI context when creating offers. Entries are automatically included in the AI context when `get_offer_context` is called.

## Schema
- **title** (string, required) — Entry title
- **content** (string) — Main text (Markdown/Plaintext)
- **category** (string) — company | services | team | process | legal | technical | portfolio
- **tags** (string[]) — Search keywords
- **priority** (number) — Sort priority (higher = more important)
- **active** (boolean) — Include in AI context (default: true)
- **files** (KnowledgeFileRef[]) — Attached documents
- **links** (string[]) — External URLs

## Categories
| Category | Purpose |
|----------|---------|
| company | General company info, history, values |
| services | Service offerings, capabilities |
| team | Team structure, expertise |
| process | Development process, workflows |
| legal | Legal information, compliance |
| technical | Tech stack, architecture |
| portfolio | Past projects, case studies |

## Best Practices
- Use **priority** to ensure the most important information is always included
- Set **active: false** for outdated entries instead of deleting them
- Use **tags** for cross-category search (e.g., "ai", "web", "consulting")
- Keep content focused — one topic per entry
- Link to external docs rather than duplicating content
