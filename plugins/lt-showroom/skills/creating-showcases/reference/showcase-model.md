# Showcase Model, Status and Visibility

## Showcase Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | MongoDB ObjectId |
| `title` | string | Showcase title (required) |
| `slug` | string | URL-friendly unique ID, formed from `project.alias` (with `named`: `project.name`) and formed anew when that changes; set explicitly only at creation, for a showcase without repository |
| `status` | string | `draft` (default) / `active` / `archived` / `template` |
| `clearance` | string | Who may see it at most: `public` / `invited` / `internal` (default) / `confidential` |
| `customerNaming` | string | How customer and project are named: `named` / `named_in_selections` / `anonymous` (default) |
| `audiences` | string[] | Whom it is meant for: `customers`, `talents`, `partners`; placement only, never permission |
| `customer` | object | Customer naming values and permissions (see "Customer Object") |
| `project` | object | `name` (`{{projekt}}`) and `alias` |
| `links` | Link[] | References to the running project (see "Links"); `{{link:live}}` is the `live` entry |
| `source` | object | Where the showcase comes from: repositories, analyzed and screenshot commit, references (see "Source") |
| `greeting` | string | Rich-text greeting (optional) |
| `description` | string | Short description, plain text (optional). The hero renders it as text; HTML in older entries is shown with the tags stripped, so new content carries none |
| `year` | number | Year of the project, 1990-2100 (optional, key fact) |
| `duration` | string | How long the project ran, free text up to 40 characters, e.g. "6 Monate" or "seit 2022" (optional, key fact) |
| `teamSize` | number | People on the project team, 1-100 (optional, key fact; shown as "N Personen") |
| `platforms` | string[] | Any of `web`, `ios`, `android`, `desktop`, each once (optional, key fact) |
| `outcomes` | string[] | Up to 6 result statements with a number, each 1-120 characters, e.g. "-70 % Bearbeitungszeit" (optional; shown as cards in the hero) |
| `customerName`, `customerCompany` | string | Deprecated inputs, stored as `customer.contactName` and `customer.name`; send `customer` instead |
| `teaserImageFileId` | string | File ID of the teaser image shown on showcase cards and in the hero (optional; `null` removes it in an update); `generate_teaser` renders and sets one |
| `teaserShowsCustomer` | boolean | The teaser shows the customer (logo, branding): left out wherever the alias is shown |
| `meetingUrl` | string | The showcase's own booking link (optional; omit it and the page uses the booking link from the company settings, see `get_showroom_context`) |
| `category` | string | Kind of solution, a key: `platform`, `web-app`, `app`, `website`, `configurator`, `ai`, `backend`, `workshop`, `open-source` (free text is refused) |
| `industry` | string | Industry of the customer, a key: `finance`, `industry`, `crafts`, `public-sector`, `health`, `sports-leisure`, `education`, `retail`, `energy`, `software-it`, `other` |
| `featured`, `sortOrder` | boolean, number | Editorial order of the gallery; set by the editorial team |
| `contentBlocks` | ContentBlock[] | Content blocks (see content-blocks.md) |
| `technologies` | string[] | Technology names; the page hero renders them as badges |
| `tags` | string[] | Tags for categorization and filtering |
| `showTableOfContents` | boolean | Show table of contents on showcase page (default: true) |
| `features` | FeatureEntry[] | Extracted features (stored; neither create nor update accepts them) |
| `screenshots` | ScreenshotRef[] | Project screenshots (at most 50, replaced as a whole); cards and the hero fall back to the first without a teaser |
| `sourceCodeAnalysis` | object | The analysis report (JSON, `analyzing-projects` report schema), replaced as a whole — signed-in users only; `get_showcase` returns it only through `fields` |
| `statusLog` | StatusLogEntry[] | Log of every change to status, clearance and customer naming — editorial team only; `get_showcase` returns it only through `fields` |
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

`customer`, `project`, `links`, `source`, `sourceCodeAnalysis`, the teaser and the screenshots go through
`create_showcase`, `update_showcase` and `upsert_showcase` (REST as well); in an update `null` clears a single value.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Real name of the customer (`{{kunde}}`) |
| `shortName` | string | Short name of the customer (`{{kunde.kurz}}`) |
| `alias` | string | What a viewer without the name reads instead, e.g. "Mittelständischer Maschinenbauer" |
| `contactName` | string | Contact person at the customer (`{{ansprechpartner}}`) |
| `contactAlias` | string | What a viewer without the name reads instead of the contact, e.g. "Vorstand" |
| `domains` | string[] | Domains of the customer, e.g. "kunde.de"; replaced as a whole. Texts with one of them are refused while not named |
| `logoFileId` | string | File id of the customer logo; shown with real names only |
| `publicationVeto` | boolean | The customer objected to publication: clearance at most `internal`, never in a selection (default: false) |
| `referenceConsent` | object \| null | The customer's confirmed consent to be named as a reference. Send only `{ "source": "<where it comes from>" }` (at most 500 characters, e.g. the reference clause of the accepted offer); the server records `confirmedAt`, `confirmedBy` and `confirmedByName`. `null` withdraws it |

Texts never carry these values: they carry the placeholders, and the server fills them per viewer (`SKILL.md` →
"Customer Naming"). Above `internal`, any name or domain of a customer with `publicationVeto` is refused.

## Links

`links[]`, at most a handful, replaced as a whole:

| Field | Type | Description |
|-------|------|-------------|
| `kind` | string | `live`, `appstore`, `press` or `demo` |
| `url` | string | `https://…` |
| `label` | string | Button text (optional) |
| `expected` | string | A feature the page must show, e.g. the brand name, for the weekly link check (optional); worth it when the page text does not contain the project name |

The link check's results (`status`, `failures` …) are set by the server only; never send them.

## Source

Where the showcase comes from (`source`). The Showroom is its source of truth; nothing is written into the
repositories. `upsert_showcase` finds a showcase by one of its repository URLs, and a repository belongs to one
showcase only (`409`). In an update each given key replaces the stored one, `null` removes it; `references` is merged
field by field.

| Field | Type | Description |
|-------|------|-------------|
| `repositories` | Repository[] | `provider` (`gitlab`, `github`, `other`), `url` (https, ssh or `git@host:path`), `projectPath`, `defaultBranch`, `path` (subfolder in a monorepo, optional) |
| `analyzedCommit` | string | Full commit id the analysis was made at |
| `analyzedAt` | string | ISO date-time of the analysis |
| `analyzedVersion` | string | Version of the app at that commit |
| `analyzerVersion` | string | Version of the plugin that analysed |
| `screenshotsCommit` | string | Full commit id the screenshots were taken at (local route only) |
| `screenshotsAt` | string | ISO date-time of the screenshots |
| `references` | object | `lexwareCustomer`, `websiteCase`, `stageBundleSlug`, `workshopDate`; live links belong to `links` |

`screenshot-session.mjs source <slug>` prints `repositories`, `analyzedCommit`, `analyzedAt`, `analyzedVersion` and
`analyzerVersion` of the cloned commit in exactly this form, without credentials. `list_showcase_sources` lists the
`source` of every showcase you may see, without blocks.

## ScreenshotRef Object

| Field | Type | Description |
|-------|------|-------------|
| `fileId` | string | File ID (required) |
| `device` | string | `desktop` / `tablet` / `mobile` (default: `desktop`) |
| `caption` | string | Caption text (optional) |
| `order` | number | Display order (optional) |
| `showsCustomer` | boolean | Shows the customer (logo, branding): left out wherever the alias is shown |

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
| Recipient of a selection link | `active` and `public`; with an explicit showcase list, `active` showcases on it that are `public` or `invited`; never a showcase hidden for that selection | with `named` or `named_in_selections` |
| Visitor (no login) | `active` and `public` only | with `named` only |

A publication veto caps the effective clearance at `internal` for every viewer.

### Release Rules

`update_showcase` and `PATCH /showcases/{id}` refuse a state that breaks these rules with `422` and the reason in plain
words. They judge the state the save would leave behind, so no order of saves gets around them:

- With `customer.publicationVeto`, the clearance is at most `internal`, and the showcase goes into no selection.
- `clearance: public` together with `customerNaming: named` needs a confirmed `customer.referenceConsent`. Without one,
  publish with `customerNaming: anonymous`, or record the consent with its source first.

A more open clearance or naming is the editorial team's decision after reviewing the draft; the lt-showroom commands
never set one. The defaults are the safe state.

## Showcase URL

- Editor: `https://showroom.lenne.tech/app/showcases/{id}` (preview: `…/{id}/preview`), for the editorial team in any
  status
- Public: `https://showroom.lenne.tech/projects/{slug}`, reachable without login only when the showcase is `active`
  and `public`

## Access Model

- **Editorial team** (`admin`, `editor`): creates, edits, activates, archives and deletes showcases, uploads files,
  sets any clearance. The MCP tools are for this team only; anyone else gets `Forbidden (403)`.
- **Admins** additionally manage users and change the company settings (`update_settings`).
- **Staff**: read-only access as the Visibility table shows.
- **Selection recipients and visitors**: read-only access to what the Visibility table allows; tracking fields (`firstViewedAt`,
  `lastViewedAt`, `viewCount`, `pdfDownloadCount`, `statusLog`, `sourceCodeAnalysis`, `showcasePdfFileId`) are
  stripped.
- No per-user showcase ownership: the editorial team manages all showcases.
