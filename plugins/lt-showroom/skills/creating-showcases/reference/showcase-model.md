# Showcase Model, Status and Visibility

## Showcase Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | MongoDB ObjectId |
| `title` | string | Showcase title (required) |
| `slug` | string | URL-friendly unique ID (auto-generated, unique index) |
| `status` | string | `draft` (default) / `active` / `archived` / `template` |
| `clearance` | string | Who may see it at most: `public` / `invited` / `internal` (default) / `confidential` |
| `customerNaming` | string | How customer and project are named: `named` / `named_in_selections` / `anonymous` (default) |
| `audiences` | string[] | Whom it is meant for: `customers`, `talents`, `partners`; placement only, never permission |
| `customer` | object | Customer permissions: `publicationVeto` (boolean) and `referenceConsent` (see below) |
| `greeting` | string | Rich-text greeting (optional) |
| `description` | string | Short description, plain text (optional). The hero renders it as text; HTML in older entries is shown with the tags stripped, so new content carries none |
| `year` | number | Year of the project, 1990-2100 (optional, key fact) |
| `duration` | string | How long the project ran, free text up to 40 characters, e.g. "6 Monate" or "seit 2022" (optional, key fact) |
| `teamSize` | number | People on the project team, 1-100 (optional, key fact; shown as "N Personen") |
| `platforms` | string[] | Any of `web`, `ios`, `android`, `desktop`, each once (optional, key fact) |
| `outcomes` | string[] | Up to 6 result statements with a number, each 1-120 characters, e.g. "-70 % Bearbeitungszeit" (optional; shown as cards in the hero) |
| `customerName` | string | Customer name (optional; hidden from viewers the naming excludes, see Visibility) |
| `customerCompany` | string | Customer company name (optional; hidden like `customerName`) |
| `teaserImageFileId` | string | File ID of the teaser image shown on showcase cards and in the hero (optional; settable over REST only) |
| `meetingUrl` | string | The showcase's own booking link (optional; omit it and the page uses the booking link from the company settings, see `get_showroom_context`) |
| `category` | string | Showcase category, e.g. Web App, Mobile, IoT, Backend (optional) |
| `contentBlocks` | ContentBlock[] | Content blocks (see content-blocks.md) |
| `technologies` | string[] | Technology names; the page hero renders them as badges |
| `tags` | string[] | Tags for categorization and filtering |
| `showTableOfContents` | boolean | Show table of contents on showcase page (default: true; settable over REST only) |
| `features` | FeatureEntry[] | Extracted features (stored; neither create nor update accepts them) |
| `screenshots` | ScreenshotRef[] | Screenshots with device metadata (stored; neither create nor update accepts them, so screenshots go into a `screenshot-gallery` block) |
| `sourceCodeAnalysis` | object | Raw source code analysis report (JSON) — signed-in users only |
| `statusLog` | StatusLogEntry[] | Log of every change to status, clearance and customer naming — editorial team only |
| `showcasePdfFileId` | string | File ID of generated showcase PDF — signed-in users only |
| `pdfDownloadCount` | number | PDF download count (default: 0) — signed-in users only |
| `viewCount` | number | Total view count (default: 0) — signed-in users only |
| `firstViewedAt` | Date | First public view timestamp — signed-in users only |
| `lastViewedAt` | Date | Last public view timestamp — signed-in users only |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

## Key Facts

`year`, `duration`, `teamSize`, `platforms` and `outcomes` are what the hero shows next to the title: only the
facts that are set, nothing when none is. `create_showcase` and `update_showcase` take them (REST as well); in an
update `null` clears `year`, `duration` or `teamSize`, and `[]` clears a list.

They are public fields: everyone who may see the showcase sees them, whatever `customerNaming` hides. An outcome
therefore never names or identifies the customer of an anonymous showcase, and states only numbers that may be
published (the customer's own figures need their consent like a quote does).

## Customer Object

| Field | Type | Description |
|-------|------|-------------|
| `publicationVeto` | boolean | The customer objected to publication: clearance at most `internal`, never in a selection (default: false) |
| `referenceConsent` | object \| null | The customer's confirmed consent to be named as a reference. Send only `{ "source": "<where it comes from>" }` (at most 500 characters, e.g. the reference clause of the accepted offer); the server records `confirmedAt`, `confirmedBy` and `confirmedByName`. `null` withdraws it |

## ScreenshotRef Object

| Field | Type | Description |
|-------|------|-------------|
| `fileId` | string | File ID (required) |
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
| `at` | Date | Timestamp of the change |
| `field` | string | Changed field: `status`, `clearance` or `customerNaming` |
| `from` | string | Previous value |
| `to` | string | New value |
| `trigger` | string | Trigger that caused the change (manual, publish, archive) |
| `by` / `byName` | string | ID and name of the user who made the change |

## Status Lifecycle

```
  draft ──── publish_showcase ───→ active
    ▲                                 │
    └──── update_showcase status ─────┘
    │
    └──── archive_showcase ───→ archived
```

- **draft**: Work in progress. Only the editorial team sees it.
- **active**: Released. Who sees it now depends on its `clearance` (see Visibility); activating does not change the clearance.
- **archived**: Retired. Staff still find it; the public does not.
- **template**: Showcase template that can be duplicated.

| Action | From | To |
|--------|------|----|
| `publish_showcase` | draft, template (an archived showcase cannot be activated; `400`) | active |
| `archive_showcase` | draft, active, template | archived |
| `update_showcase` with `status` | any | the given status |

Both shortcuts answer `400` when the showcase already has the target status.

Every new showcase starts as `draft`, `internal` and `anonymous`, whatever `create_showcase` is sent; the same holds
for a copy from `duplicate_showcase`. Clearance, naming and status change afterwards with `update_showcase`, and every
such change lands in `statusLog`.

## Visibility

`publish_showcase` makes a showcase `active`; it does not make it public. Who sees an active showcase:

| Viewer | Sees | Customer name |
|--------|------|---------------|
| Editorial team (roles `admin`, `editor`) | every showcase, any status | always |
| Staff (role `staff`) | `active` and `archived`, unless `confidential` | always |
| Recipient of a prospect link | `active` and `public`; with an explicit showcase list, `active` showcases on it that are `public` or `invited`; never a showcase hidden for that prospect | with `named` or `named_in_selections` |
| Visitor (no login) | `active` and `public` only | with `named` only |

A publication veto caps the effective clearance at `internal` for every viewer.

### Release Rules

`update_showcase` and `PATCH /showcases/{id}` refuse a state that breaks these rules with `422` and the reason in plain
words. They judge the state the save would leave behind, so no order of saves gets around them:

- With `customer.publicationVeto`, the clearance is at most `internal`, and the showcase goes into no selection.
- `clearance: public` together with `customerNaming: named` needs a confirmed `customer.referenceConsent`. Without one,
  publish with `customerNaming: anonymous`, or record the consent with its source first.

Set a more open clearance or naming only when the user has decided it for this showcase; the defaults are the safe
state.

## Showcase URL

Public URL: `https://showroom.lenne.tech/projects/{slug}`, reachable without login only when the showcase is `active`
and `public`.

## Access Model

- **Editorial team** (`admin`, `editor`): creates, edits, activates, archives and deletes showcases, uploads files,
  sets any clearance. The MCP tools are for this team only; anyone else gets `Forbidden (403)`.
- **Admins** additionally manage users and change the company settings (`update_settings`).
- **Staff**: read-only access as the Visibility table shows.
- **Prospects and visitors**: read-only access to what the Visibility table allows; tracking fields (`firstViewedAt`,
  `lastViewedAt`, `viewCount`, `pdfDownloadCount`, `statusLog`, `sourceCodeAnalysis`, `showcasePdfFileId`) are
  stripped.
- No per-user showcase ownership: the editorial team manages all showcases.
