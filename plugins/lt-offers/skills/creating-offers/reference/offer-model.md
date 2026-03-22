# Offer Model & Status Lifecycle

## Offer Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | MongoDB ObjectId |
| `title` | string | Offer title (required) |
| `slug` | string | URL-friendly unique ID (auto-generated, 8 chars) |
| `status` | string | `draft` / `sent` / `viewed` / `template` |
| `description` | string | Rich-text description (optional) |
| `greeting` | string | Rich-text greeting (optional) |
| `customerName` | string | Customer name (optional) |
| `customerEmail` | string | Customer email (optional) |
| `customerCompany` | string | Customer company (optional) |
| `customerContacts` | array | Additional contacts `[{ name, email, position }]` |
| `contentBlocks` | array | Content blocks (see content-blocks.md) |
| `tags` | string[] | Tags for categorization |
| `validUntil` | Date | Expiration date (optional) |
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
- **viewed**: Customer has opened the offer (automatic transition).
- **template**: Saved as reusable template (no customer data).
- **expired**: Computed field — `validUntil` date has passed.

### Status Transitions

| Action | From | To | Trigger |
|--------|------|----|---------|
| `mark_sent` | draft | sent | Employee shares access |
| `mark_draft` | sent | draft | Employee resets |
| Customer opens | draft/sent | viewed | Customer enters access code |
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

## Offer URL

Customer-facing URL: `https://angebote.lenne.tech/angebot/{slug}`
