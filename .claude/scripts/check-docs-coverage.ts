#!/usr/bin/env bun
/**
 * List Claude Code documentation pages that the docs cache does not hold
 *
 * Fetches the official page index (https://code.claude.com/docs/llms.txt), compares it
 * with the code.claude.com sources in sources.json, and prints every uncached page with
 * its index description, minus the path prefixes in `coverage.ignore` (areas that never
 * matter for plugin authoring, such as the Agent SDK or enterprise gateways). /optimize
 * runs this after a cache update so pages Anthropic adds or splits off are noticed
 * instead of discovered by accident.
 *
 * Usage:
 *   bun .claude/scripts/check-docs-coverage.ts          # human-readable list
 *   bun .claude/scripts/check-docs-coverage.ts --json   # machine-readable
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import type { SourcesConfig } from "./types";

const SCRIPT_DIR = dirname(import.meta.path);
const SOURCES_FILE = join(SCRIPT_DIR, "..", "docs-cache", "sources.json");
const INDEX_URL = "https://code.claude.com/docs/llms.txt";
const PAGE_PREFIX = "https://code.claude.com/docs/en/";

const asJson = process.argv.includes("--json");

const config: SourcesConfig = JSON.parse(readFileSync(SOURCES_FILE, "utf-8"));
const ignore = config.coverage?.ignore ?? [];
const cached = new Set(
  config.sources
    .filter((s) => s.url.startsWith(PAGE_PREFIX))
    .map((s) => s.url.slice(PAGE_PREFIX.length).replace(/\.md$/, ""))
);

const response = await fetch(INDEX_URL, { signal: AbortSignal.timeout(30000) });
if (!response.ok) {
  console.error(`Could not fetch ${INDEX_URL}: HTTP ${response.status}`);
  process.exit(1);
}

// Index lines look like: - [Title](https://code.claude.com/docs/en/<page>.md): Description
const pages = [...(await response.text()).matchAll(/^- \[([^\]]+)\]\((https:\/\/code\.claude\.com\/docs\/en\/[^)]+)\)(?::\s*(.*))?$/gm)].map(
  ([, title, url, description]) => ({
    page: url.slice(PAGE_PREFIX.length).replace(/\.md$/, ""),
    title,
    description: description ?? "",
  })
);

const missing = pages.filter(
  ({ page }) => !cached.has(page) && !ignore.some((prefix) => page.startsWith(prefix))
);

// A cached page that left the index was usually moved or split upstream. Its old URL
// may keep answering with the content of a different page, so the next cache update
// would silently store the wrong page (or trip the shrink guard).
const indexed = new Set(pages.map(({ page }) => page));
const orphaned = [...cached].filter((page) => !indexed.has(page)).sort();

if (asJson) {
  console.log(JSON.stringify({ indexed: pages.length, cached: cached.size, missing, orphaned }, null, 2));
} else {
  console.log(`${pages.length} pages indexed, ${cached.size} cached, ${missing.length} uncached (after coverage.ignore):\n`);
  for (const { page, title, description } of missing) {
    console.log(`  ${page.padEnd(32)} ${title}${description ? ` — ${description.slice(0, 140)}` : ""}`);
  }
  if (orphaned.length > 0) {
    console.log(`\n${orphaned.length} cached page(s) no longer in the index — moved or split upstream; repoint their sources:\n`);
    for (const page of orphaned) console.log(`  ${page}`);
  }
}
