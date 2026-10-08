# Reference: mirror-site.mjs and compare-site.mjs

Both scripts print their options with `--help`.

## mirror-site.mjs

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/mirror-site.mjs" <url> [options]
```

| Option | Default | Effect |
|---|---|---|
| `--out <dir>` | `~/Downloads/<host>-backup-<date>`, else `./` | output folder; must be empty unless `--force` |
| `--max-pages <n>` | 500 | page limit; further pages are listed under `skipped.limit` |
| `--concurrency <n>` | 4 | parallel requests |
| `--delay <ms>` | 150 | minimum gap between request starts |
| `--timeout <ms>` | 30000 | give up on a request that sends nothing for this long; three attempts, `Retry-After` honoured on 429/503 |
| `--max-time <ms>` | 300000 | give up on a download still running after this long, such as a live stream (webcam, web radio); listed under `skipped.tooSlow`, not retried |
| `--max-file-mb <n>` | 200 | larger files are skipped (`skipped.tooLarge`) and stay online links |
| `--include <regex>` | – | only crawl page paths that match (repeatable) |
| `--exclude <regex>` | – | skip page paths that match (repeatable) |
| `--external-assets` | off | also download CSS, JS, fonts and images from other hosts into `_external/<host>/` |
| `--no-sitemap` | – | discover pages through links only |
| `--ignore-robots` | off | crawl pages `robots.txt` disallows (site owner's consent only) |
| `--allow-private-hosts` | off | also fetch from loopback, LAN, link-local and cloud-metadata addresses; needed for a site on `localhost` or in the internal network. Without it the start URL, every redirect hop, sitemap entries and assets that resolve to such an address are refused and listed under `blocked` |
| `--no-bundle` | – | keep ES modules; the copy then needs a local web server |
| `--zip` | off | write `<out>.zip` next to the folder and verify every entry's CRC. When the files total more than 4 GiB uncompressed, no archive is written (no ZIP64): the folder stays complete, `zip.error` says why, and the exit code is the mirror's |
| `--force` | off | replace an existing, non-empty output folder |
| `--user-agent <ua>` | `lt-tools-mirror/1.0` | custom User-Agent |
| `--quiet` | off | no progress lines on stderr |

Exit codes: `0` complete, `1` missing references or a failed bundle, `2` error (start URL failed
or resolves to a private address without `--allow-private-hosts`, output folder not empty,
invalid option).

### Output layout

```
<out>/
├── README.md              how to open it, page list, changes, what is not included
├── mirror-report.json     everything below
├── mirror.log             one line per request (status, URL, bytes)
└── <host>/                the site: index.html, <page>/index.html, assets
    ├── _external/<host>/  only with --external-assets
    └── _offline/          bundles of inline module scripts, if any
```

Pages always end in `.html` (`/team/` → `team/index.html`, `/contact` → `contact/index.html`,
`/shop.php` → `shop.php.html`). Queries on pages become `__q<hash>`; cache-buster queries on
assets (`?v=3`, `?1787055968`) are dropped. Bundled entries sit next to the original module as
`<name>.offline.js`.

### mirror-report.json

| Field | Content |
|---|---|
| `source`, `outDir`, `root` | live start URL after redirects, output folder, site folder |
| `pages[]` | `{ url, file, inSitemap }` |
| `files`, `bytes` | counts including bundles |
| `cacheBustersDropped` | files whose query string was dropped |
| `bundled[]`, `bundleFailures[]` | `{ entry, output }` / `{ entry, error }` |
| `modulesNeedServer` | `true` when module scripts remain unbundled |
| `missing[]` | `{ file, ref }` local references without a file after rewriting |
| `errors[]` | `{ url, status, from }` references that could not be downloaded. A 4xx is missing on the live site as well; a timeout, dropped connection, 429 or 5xx failed during this crawl and still loads from the live site, and so does an unreadable sitemap's content |
| `skipped` | `robots`, `filter`, `limit`, `tooLarge`, `tooSlow`, `offSite` URL lists |
| `guessMisses` | asset-like strings in JavaScript that were not files (expected, not an error) |
| `external.requisites`, `external.links` | host → count of resources still loaded online / outgoing links |
| `sitemapExternalLinks[]` | sitemap entries on other hosts (not crawled) |
| `forms[]` | `{ page, action, method, sameSite }` |
| `onlineOnly[]` | same-site URLs the copy references but does not contain because they were skipped (robots, filter, limit, too large, too slow, blocked), so they still load from the live site. Failed downloads are in `errors[]` instead; URLs JavaScript builds at runtime are in neither and only show up in the comparison |
| `blocked[]` | `{ url, at, reason }` requests refused because they resolved to a private address (`at` is the hop that was refused) |
| `zip` | `{ path, files, bytes, verified }` with `--zip`, or `{ path, error }` when no archive was written |

## compare-site.mjs

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/compare-site.mjs" <out-dir> [options]
```

| Option | Default | Effect |
|---|---|---|
| `--original <url>` | `source` from the report | compare against another base URL (e.g. a staging host) |
| `--pages <list>` | all pages | comma-separated paths, e.g. `/,/team/` |
| `--viewports <list>` | `desktop,mobile` | desktop = 1440×900, mobile = 390×844 with touch |
| `--no-interactions` | – | compare only what the pages show |
| `--concurrency <n>` | 2 | pages compared in parallel (each loads original and copy) |
| `--ignore <selector>` | consent banners | extra CSS selector to leave out (repeatable) |
| `--screenshots <dir>` | – | `<page>-<viewport>-original.png` / `-backup.png` |
| `--json <file>` | – | full result incl. both sides' interaction results |
| `--chrome <path>` | auto (`CHROME_PATH`, standard install paths) | Chrome/Chromium binary |
| `--settle <ms>` | 1500 | wait after scrolling before measuring |
| `--page-timeout <ms>` | 30000 | give up on a page that does not load; it is reported as an error instead of stalling the run |
| `--quiet` | off | no progress lines on stderr |

Exit codes: `0` all identical, `1` differences, `2` error (no report, no Chrome).

### What is compared

| Area | Details |
|---|---|
| Content | title, h1–h3, visible text (hash + line diff), images and broken images, background images, loaded web fonts, page height (±3 px) |
| Styles | color, background, font, display, position, spacing, border, text-transform, background image of every element |
| Widgets | slider initialisation (Swiper, Slick, Splide, Flickity, Glide, Owl, tiny-slider), `data-bs-toggle` counts, forms (fields, `novalidate`, required), iframes, videos, header classes at top and after scrolling |
| Behaviour | one disclosure/accordion, tabs, tooltip, up to four sliders (autoplay and "next"), video playback, mobile menu, horizontal overflow |
| Problems | console errors, exceptions and failed requests the copy has and the original does not; a live URL that fails in both counts as the same failure |
| Offline capability | the copy loads with the site's own hosts blocked (its `www.` twin and `--original` included), so a file it still fetches from the live site fails there and shows up as a difference instead of passing as identical |

Consent banners (`[id*=cookie]`, `[class*=consent]`, CCM19, Cookiebot, Usercentrics, OneTrust,
Complianz) are left out by default. A difference that is only volatile (height, styles, header,
interactions) triggers one automatic rerun of that page before it is reported.
