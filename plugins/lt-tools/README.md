# lt-tools — Claude Code Plugin

General-purpose tools for everyday work that do not belong to a specific stack. Each tool is a
skill backed by deterministic scripts, so a task that would otherwise take dozens of manual
steps runs in one or two commands with compact output.

## Installation

In a Claude Code session:

```
/plugin marketplace add lenneTech/claude-code
/plugin install lt-tools@lenne-tech
```

Or with the lenne.tech CLI: `lt claude plugins lt-tools`.

## Requirements

- Node.js ≥ 22 (the scripts have no npm dependencies)
- Google Chrome or Chromium for the website comparison (auto-detected; `CHROME_PATH` overrides)
- npx access on the first mirror run: it fetches esbuild for bundling JavaScript modules

## Commands

| Command | Purpose |
|---|---|
| `/lt-tools:save-website <url> [--zip]` | Save a website as an offline copy, verify it against the live site, optionally zip it |

## Skills

| Skill | Activates on |
|---|---|
| `saving-websites-locally` | "Website herunterladen / sichern / offline speichern / spiegeln", "Backup einer Website", "mirror a website", "offline copy", "wget mirror" |

## Scripts

| Script | Purpose |
|---|---|
| `scripts/mirror-site.mjs` | Crawls a site (sitemaps + links, robots.txt honoured), downloads every page and asset including JavaScript chunks, repairs the copy for `file://` (relative links, real file extensions, SRI removed, ES modules bundled within the copy), verifies all references, writes README, report and an optional ZIP. Refuses private network addresses unless `--allow-private-hosts` |
| `scripts/compare-site.mjs` | Loads the live site and the copy side by side in headless Chrome (desktop and mobile), the copy with the site's hosts blocked, and compares text, images, fonts, computed styles, widgets, interactions and console errors |

Both print `--help`. Details: `skills/saving-websites-locally/reference.md`.

## Tests

```bash
node --test plugins/lt-tools/scripts/__tests__/*.test.mjs
```

The tests serve a local fixture site, so they need no network. The comparison tests run when
Chrome/Chromium is installed and esbuild is reachable through npx, and are skipped otherwise,
except under `CI`, where a missing Chrome or esbuild fails the run instead of passing silently.
