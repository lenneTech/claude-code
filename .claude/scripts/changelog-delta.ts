#!/usr/bin/env bun
/**
 * Print the Claude Code changelog entries newer than a given version
 *
 * Reads the cached changelog (.claude/docs-cache/github-changelog.md) and prints every
 * `## <version>` section above `--from` (exclusive) up to `--to` (inclusive, default:
 * newest). /optimize records the cache version before updating and feeds that value in
 * here, so the analysis agents grep one focused file instead of the whole changelog.
 *
 * Usage:
 *   bun .claude/scripts/changelog-delta.ts --from=2.1.239 [--to=2.1.281] > delta.md
 *   bun .claude/scripts/changelog-delta.ts --from=2.1.239 --stat
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";

const SCRIPT_DIR = dirname(import.meta.path);
const CHANGELOG = join(SCRIPT_DIR, "..", "docs-cache", "github-changelog.md");

const args = process.argv.slice(2);
const arg = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const from = arg("from");
const to = arg("to");
const statOnly = args.includes("--stat");

function compare(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

if (!from) {
  console.error("Usage: bun .claude/scripts/changelog-delta.ts --from=<version> [--to=<version>] [--stat]");
  process.exit(2);
}
if (!existsSync(CHANGELOG)) {
  console.error(`Changelog not cached: ${CHANGELOG} (run update-docs-cache.ts first)`);
  process.exit(1);
}

const sections = readFileSync(CHANGELOG, "utf-8").split(/^(?=## \d+\.\d+\.\d+)/m);
const selected = sections.filter((section) => {
  const version = section.match(/^## (\d+\.\d+\.\d+)/)?.[1];
  if (!version) return false;
  return compare(version, from) > 0 && (!to || compare(version, to) <= 0);
});

if (statOnly) {
  const versions = selected.map((s) => s.match(/^## (\S+)/)?.[1]);
  const bullets = selected.reduce((n, s) => n + (s.match(/^\s*[-*] /gm)?.length ?? 0), 0);
  console.log(
    JSON.stringify({ from, to: to ?? versions[0] ?? from, versions: versions.length, entries: bullets }, null, 2)
  );
} else {
  process.stdout.write(selected.join(""));
}
