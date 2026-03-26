# Showcase Model & Status Lifecycle

## Showcase Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | MongoDB ObjectId |
| `title` | string | Showcase title (required) |
| `slug` | string | URL-friendly unique ID (auto-generated, unique index) |
| `status` | string | `draft` / `published` / `archived` / `template` |
| `greeting` | string | Rich-text greeting (optional) |
| `description` | string | Rich-text long description (optional) |
| `customerName` | string | Customer name (optional) |
| `customerCompany` | string | Customer company name (optional) |
| `meetingUrl` | string | Meeting URL for appointment booking (default: `https://meet.brevo.com/kai-haase`) |
| `category` | string | Showcase category, e.g. Web App, Mobile, IoT, Backend (optional) |
| `contentBlocks` | ContentBlock[] | Content blocks (see content-blocks.md) |
| `features` | FeatureEntry[] | Extracted features |
| `screenshots` | ScreenshotRef[] | Uploaded screenshots with device metadata |
| `technologies` | string[] | Technology names for badge rendering |
| `tags` | string[] | Tags for categorization and filtering |
| `showTableOfContents` | boolean | Show table of contents on showcase page (default: true) |
| `sourceCodeAnalysis` | object | Raw source code analysis report (JSON) — visible to authenticated users only |
| `statusLog` | StatusLogEntry[] | Status change log — visible to authenticated users only |
| `showcasePdfFileId` | string | File ID of generated showcase PDF — visible to authenticated users only |
| `pdfDownloadCount` | number | PDF download count (default: 0) — visible to authenticated users only |
| `viewCount` | number | Total view count (default: 0) — visible to authenticated users only |
| `firstViewedAt` | Date | First public view timestamp — visible to authenticated users only |
| `lastViewedAt` | Date | Last public view timestamp — visible to authenticated users only |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

## ScreenshotRef Object

| Field | Type | Description |
|-------|------|-------------|
| `fileId` | string | GridFS file ID (required) |
| `device` | string | `desktop` / `tablet` / `mobile` (default: `desktop`) |
| `caption` | string | Caption text (optional) |
| `order` | number | Display order (optional) |

## FeatureEntry Object

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Feature title (required) |
| `description` | string | Feature description (optional) |
| `icon` | string | Icon identifier (optional) |

## StatusLogEntry Object

| Field | Type | Description |
|-------|------|-------------|
| `at` | Date | Timestamp of the status change |
| `from` | string | Previous status |
| `to` | string | New status |
| `trigger` | string | Trigger that caused the change (manual, publish, archive) |

## Status Lifecycle

```
  draft ──── publish_showcase ───→ published
    │                                  │
    │    (unpublish_showcase)           │
    └◄──────────────────────────────────┘
    │
    └──── archive ───→ archived
```

- **draft**: Work in progress. Not publicly visible on showroom.lenne.tech.
- **published**: Visible on the public showroom. Included in listings and search.
- **archived**: Retired. Removed from public listing but data preserved.
- **template**: Showcase template that can be duplicated.

### Status Transitions

| Action | From | To |
|--------|------|----|
| `publish_showcase` | draft | published |
| `unpublish_showcase` | published | draft |
| `archive` | any | archived |

## Showcase URL

Public URL: `https://showroom.lenne.tech/showcase/{slug}`

## Access Model

- **Authenticated users** (showroom staff): Full CRUD access; all fields visible
- **Public visitors (prospects)**: Read-only access to published showcases; tracking fields (`firstViewedAt`, `lastViewedAt`, `viewCount`, `pdfDownloadCount`, `statusLog`, `sourceCodeAnalysis`, `showcasePdfFileId`) are stripped
- No per-user showcase ownership — all authenticated users can manage all showcases
