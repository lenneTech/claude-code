# Offer Model & Status Lifecycle

## Offer Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | MongoDB ObjectId |
| `title` | string | Offer title (required) |
| `kind` | string | `offer` (default) or `concept` for a concept folder (Konzeptmappe). Decides the link domain, the allowed blocks (no `pricing-table`, no `offerPdfFileId` for `concept`) and the wording on the customer page; see "Document URL" below and the `creating-concepts` skill |
| `relatedDocumentIds` | string[] | Linked documents, typically a concept folder and the offers it is based on or leads to. A link always holds in both directions: setting it on one document sets it on the other. Each id must name an existing document (`400` otherwise); a self-link is ignored. `update_offer` replaces the whole list. Copies (`duplicate_offer`, templates) start without links. Internal: the customer learns neither the ids nor that a linked document exists |
| `relatedDocuments` | array | Read-only, from `get_offer` and `get_offer_context`: the links resolved to `{ id, kind, slug, status, title }`. Holds only documents that still exist; the raw `relatedDocumentIds` can still name a deleted one, so rely on this list |
| `slug` | string | URL-friendly unique ID (auto-generated, 8 chars) |
| `status` | string | `draft` / `sent` / `viewed` / `template` |
| `description` | string | Rich-text description (optional) |
| `greeting` | string | Rich-text greeting (optional) |
| `customerName` | string | Customer name (optional) |
| `customerEmail` | string | Customer email (optional) |
| `customerCompany` | string | Customer company (optional) |
| `customerContacts` | array | Additional contacts `[{ name, email, position }]` |
| `subtitle` | string | Overrides the line under the document title, which otherwise reads `<customerCompany> — <customerName>`. Plain text, no HTML. Useful for a concept folder: „für Musterfirma GmbH" instead of „Musterfirma GmbH — Max Mustermann". An empty string falls back to the automatic line, so clearing it restores the default. Applies online and in the PDF. `duplicate_offer` and `create_from_template` carry it; `save_as_template` drops it like every other customer field, because a line naming one customer has no place in a reusable template |
| `contentBlocks` | array | Content blocks (see content-blocks.md) |
| `tags` | string[] | Tags for categorization |
| `theme` | object | Per-offer theme override `{ enabled, light, dark }` — see [theming.md](./theming.md). When `enabled: false` (or missing), the renderer falls back to the app-wide default theme (`set_default_theme`); when neither is configured, the platform palette applies. |
| `colorMode` | string | `'system'` / `'light'` / `'dark'` (default `'system'`). Forces the customer-facing offer page into light or dark mode on load; `'system'` follows the browser preference. Independent of `theme` — the theme defines the palettes, `colorMode` picks which one is active. |
| `validUntil` | Date | Expiration date (optional). The editor labels it „Gültig bis" for an offer and „Zugang bis" for a concept folder: the folder's content does not expire, the customer's access does |
| `showTableOfContents` | boolean | Show TOC on offer page (default: true) |
| `customerContacts` | array | Additional contacts `[{ name, email?, position? }]` |
| `accessCode` | string | Access code for customer (auto-generated, 8 chars) |
| `viewCount` | number | Total view count |
| `firstViewedAt` | Date | First customer view |
| `lastViewedAt` | Date | Last customer view |
| `pdfDownloadCount` | number | Total PDF download count |
| `firstPdfDownloadAt` | Date | First PDF download timestamp |
| `lastPdfDownloadAt` | Date | Last PDF download timestamp |
| `attachmentDownloads` | array | Per-file download tracking `[{ fileId, fileName, downloadCount, firstDownloadAt, lastDownloadAt }]` |
| `sources` | OfferSource[] | Per-offer briefing materials (see below) |
| `sentAt` | Date | When access was shared |
| `statusLog` | array | Status change history |
| `offerPdfFileId` | string | Attached PDF file ID |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

## Status Lifecycle

```
  ┌─────────────────────────────────┐
  │                                 │
  ▼                                 │
draft ──── mark_sent ───→ sent ─────┘
  │                        │     (mark_draft)
  │                        │
  │    (customer opens)    │
  │         │              │
  │         ▼              │
  │       viewed ◄─────────┘
  │                    (customer opens)
  │
  └──── saveAsTemplate ───→ template
```

- **draft**: Initial state. Offer is being created/edited.
- **sent**: Access shared with customer (via `mark_sent` / copy-link).
- **viewed**: Customer has opened the offer (automatic transition). A signed-in employee
  opening the customer link does **not** trigger it — their visit leaves `status`, `viewCount`,
  `firstViewedAt` and the analytics untouched, so "viewed" really means the customer.
- **template**: Saved as reusable template (no customer data).
- **expired**: Computed field — `validUntil` date has passed. Enforced server-side: past that
  date the public endpoints answer `410 Gone` and hand out neither content nor PDF.

### Status Transitions

| Action | From | To | Trigger |
|--------|------|----|---------|
| `mark_sent` | draft | sent | Employee shares access |
| `mark_draft` | sent | draft | Employee resets |
| Customer opens | draft/sent | viewed | Customer enters access code (not an employee's visit) |
| `saveAsTemplate` | any | template | Employee saves template |

### StatusLog Entries

Each transition creates a log entry:
```json
{ "at": "2026-03-19T12:00:00Z", "from": "draft", "to": "sent", "trigger": "copy-link" }
```

Triggers: `copy-link`, `manual`, `customer-view`, `analytics-reset`

## sources (OfferSource[])

Per-offer briefing materials. Each source has:
- `addedAt` (Date) — When added
- `content` (string, optional) — Text content (type: text)
- `fileId` (string, optional) — GridFS file ID (type: file)
- `fileName` (string, optional) — File name (type: file)
- `mimeType` (string, optional) — MIME type (type: file)
- `title` (string) — Display title
- `type` (string) — 'file' | 'text' | 'link'
- `url` (string, optional) — URL (type: link)

## Access Model

- **Employees** (authenticated via Better Auth): Full access to ALL offers. No per-user restrictions.
- **Customers**: Access via slug + accessCode. Can only view, not edit.
- **Access Code**: 8-char alphanumeric code, shared with customer. Shown once after creation.
- **Taking access back**: resetting the access code (`reset-password`) invalidates every session
  already issued, so a forwarded link stops working immediately. The customer gets back in with
  the new code without waiting.

## Document URL

The customer-facing URL follows the document's `kind`:

| Kind | URL |
|---|---|
| `offer` (default) | `https://angebote.lenne.tech/angebot/{slug}` |
| `concept` | `https://konzept.lenne.tech/{slug}` |

Do not assemble either by hand — `generate_snippet` returns the link that matches the kind, and
`get_offer` reports the kind. A concept folder reached through the offer URL still resolves (the
customer page redirects it), but the address in a mail stays wrong, and the customer sees the
offer domain first.

The concept domain is configured per stage and may legitimately be unset; then a concept folder
stays reachable under the main domain and nothing redirects.
