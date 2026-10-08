---
name: saving-websites-locally
description: 'Saves a complete website with all pages, images, CSS, JavaScript, fonts and media as an offline copy that opens from file:// by double-click, then proves in headless Chrome that the copy looks and behaves like the original (sliders, accordions, tabs, tooltips, mobile menu, video). Two deterministic scripts crawl, repair, zip and compare. Activates on "Website herunterladen", "Website sichern", "Backup einer Website", "Seite offline speichern", "Website spiegeln", "Website als ZIP", "mirror a website", "download a whole site", "offline copy of a site", "wget mirror", "HTTrack". NOT for a CMS or server backup with database and uploads (ask the hoster). NOT for scraping data into tables or for app screenshots (use lt-showroom).'
---

# Saving Websites Locally

Two scripts do the work; Claude runs them, reads their compact summaries and reports. Claude
does not build the mirror from `wget`, `curl` or ad-hoc `grep`/`sed` pipelines: a wget mirror
misses JavaScript chunks and breaks on `file://` in ways a screenshot does not show (see
"Why the scripts exist"), and the scripts answer in a few hundred tokens what manual checking
costs in hundreds of thousands.

| Script | Does | Talks to the live site |
|---|---|---|
| `scripts/mirror-site.mjs` | crawls, downloads, repairs for `file://`, verifies references, writes README, report and ZIP | GET requests only, throttled |
| `scripts/compare-site.mjs` | opens original and copy side by side in headless Chrome and compares content and behaviour | loads each page once per viewport |

Requirements: Node.js ≥ 22, Google Chrome or Chromium for the comparison, and npx access on the
first run (it fetches esbuild for the module bundling).

## Before Starting

- **Permission.** Copy only sites the user owns, runs, or may copy. When the request does not make
  that clear (a third party's site, a competitor), ask once. The mirror honours `robots.txt`;
  `--ignore-robots` only with the site owner's consent.
- **Output.** Default is `~/Downloads/<host>-backup-<date>` (else the current directory). Pass
  `--out` only when the user named another place.
- **Scope.** Sites with more than about 300 pages: agree on `--max-pages` or `--include`/`--exclude`
  first, and run the mirror in the background.
- **Internal sites.** The mirror refuses loopback, LAN and cloud-metadata addresses, so a site on
  `localhost` or in the internal network needs `--allow-private-hosts` (exit 2 names it). Pass it
  only for a site the user named as internal: a public site that redirects there is the case the
  refusal exists for.

## Workflow

### 1. Mirror

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/mirror-site.mjs" <url> [--zip] [--out <dir>] [--external-assets]
```

Run it with a Bash timeout of 600000 ms. A site of 10 pages takes about 20 s; beyond a few
hundred pages start it with `run_in_background` and continue when the notification arrives. Exit
code 0 = complete, 1 = missing references or a failed bundle (the summary names them), 2 = error.

The summary has one line per topic:

| Line | Meaning | Act on it when |
|---|---|---|
| `pages` | saved pages; how many came from the sitemap, how many only via links; skipped by robots / filter / limit | `limit` > 0: the site is larger than `--max-pages` |
| `files` | files, size, references not downloaded (listed in the `errors` line) | a 4xx is the site's own bug: mention it, do not "fix" it. A timeout, dropped connection, 429 or 5xx failed during this crawl: rerun with `--force` |
| `js modules` | ES module entries bundled for `file://` | `FAILED` or `needs a local web server`: see Step 2, row "errors" |
| `missing refs` | local references without a file | > 0: inspect `mirror-report.json` → `missing` |
| `external` | hosts the copy still loads from the internet | the user wants these offline too: rerun with `--external-assets --force` (copies CSS, JS, fonts, images; not iframes or APIs) |
| `forms` | pages whose forms post to a server | always mention: they cannot be submitted offline |
| `online only` | files of the site the copy references but skipped (robots, filter, limit, too large, too slow, blocked) | name them: the copy breaks for them once the site is gone |
| `blocked` | requests refused because they pointed at a private address | expected for a public site; mention it, never rerun with `--allow-private-hosts` to make it go away |
| `zip` | archive path and size, or `FAILED` | above 4 GiB of files no archive is written; the folder is complete, say so |

### 2. Compare with the original

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/compare-site.mjs" <out-dir> [--viewports desktop,mobile] [--screenshots <dir>]
```

About 5 s per page and viewport (two pages in parallel), Bash timeout 600000 ms. Each page is
loaded from the live site and from `file://` in fresh browser contexts, compared on content,
computed styles, widgets and errors, and exercised once (disclosure, tabs, tooltip, sliders,
video, mobile menu). Forms are never submitted. The copy is loaded with the site's own hosts
blocked, so it passes only when it really works without the live site. A page that does not load
within `--page-timeout` (30 s) is reported as an error instead of stalling the run. Exit code 0 =
identical, 1 = differences, 2 = error.
A line `✓ /path [viewport] identical` needs no action; for `✗` lines:

| Key | Likely cause | What to do |
|---|---|---|
| `errors` with CORS / `ERR_FILE_NOT_FOUND` | JavaScript blocked or a file missing on `file://` | read `bundleFailures` / `missing` in the report; fix the cause, rerun the mirror with `--force` |
| `images` or `errors` with `ERR_BLOCKED_BY_CLIENT` | the copy fetches a file of the site from the live host, which is blocked for the copy | in `onlineOnly` or `errors[]` when the crawl skipped or lost it (rerun with `--force`, or raise the limit that skipped it); in neither, JavaScript builds the URL at runtime, so report that part as not offline-capable. Not a comparison artefact |
| `sliders` (`initialized: false`), `interactions` | the page's JavaScript does not run | almost always the same cause as `errors` |
| `images`, `imageFiles`, `backgroundImages`, `fonts` | an asset the page loads at runtime was not found by the crawler | check whether the host is external (`--external-assets`); otherwise report it |
| `text` | missing content, or content that changes on every load (dates, random testimonials, live feeds) | compare `onlyOriginal` with `onlyBackup`; rotating content is a legitimate difference, name it as such |
| `scrollHeight`, `styles`, `headerScrolled` | animation timing (the script already retried once) | rerun the page alone: `--pages /x/ --viewports desktop`; a stable difference is real |

### 3. Visual Spot Check

`--screenshots <dir>` writes one PNG pair per page and viewport. Read two or three pairs (home
page, a page with a slider) to confirm what the numbers say. For interactive debugging beyond
that, the Chrome DevTools MCP of the lt-dev plugin (`mcp__plugin_lt-dev_chrome-devtools__*`)
opens the copy via `file://` like a double-click.

### 4. Report

In the user's language, without pasting site content: where the copy is (folder and ZIP), pages
and size, the comparison result per viewport with the exercised features, what does not work
offline (forms, the external services by name), live-site failures found on the way, and that a
mirror is not a CMS restore.

## Why the Scripts Exist

Observed 2026-10-08 on a TYPO3 site with a Vite build: a wget mirror looked complete in a
screenshot, but the stage slider, accordions and calculators were dead. Four chunks the entry
module imports were never downloaded, the entry itself was blocked on `file://`, and an SVG
saved as `orbit-center.svg?<timestamp>` rendered empty because the extension was gone. Each
trap and how the scripts handle it:

| Trap | Symptom | Handled by |
|---|---|---|
| JS chunks imported by a bundle (`import … from "./vendor-x.js"`) | widgets dead, no visible error in a screenshot | mirror parses static and dynamic imports and asset literals in JS |
| ES modules on `file://` (origin `null`) | same, CORS errors in the console | esbuild bundles each entry into a classic `defer` script, `import.meta.url` shimmed |
| query strings in file names | SVG/ICO empty, wrong MIME type | cache-busters dropped, other queries hashed, extension from Content-Type |
| SRI `integrity` / `crossorigin` | CSS or JS blocked after rewriting | removed on local files only |
| `<base href>`, protocol-relative `//host/x` | links resolve to the wrong place / `file://host` | resolved during rewriting, `<base>` removed, explicit scheme |
| pages only in the navigation, renamed pages | pages missing, duplicates | link crawl besides the sitemap, redirects become aliases |
| srcset, data-src, JSON-LD logos, manifest icons | images missing | dedicated extractors |
| SPA fallback (`index.html` with status 200 for any path) | HTML saved as an image | rejected and reported |

During the same check a calculator restored its inputs from `sessionStorage` written by an
earlier test run, so original and copy disagreed for a reason unrelated to the copy. That is why
`compare-site.mjs` opens every page in a fresh browser context. Submitting a form on the original
would send a real inquiry to the site owner; neither script ever submits one.

## Limits

- Rendered output only: no CMS database, backend, server code or files no page links to. A
  restorable backup needs a database dump and the upload folder from the hoster.
- Forms, logins and anything behind them do not work offline.
- Third-party widgets (consent banners, feeds, booking, maps, video embeds) keep loading online.
- Client-side apps that fetch their content from an API (`fetch('/api/…')`) show only what the
  server-rendered HTML contains; the comparison reports the gap.

Options, output layout and the report format: [reference.md](reference.md).

## Related Elements

- `/lt-tools:save-website` — the command that runs this workflow
- lt-dev Chrome DevTools MCP — manual inspection of the copy beyond the comparison report
