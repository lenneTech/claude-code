#!/usr/bin/env bun
/**
 * Cache Integrity Checker
 *
 * Verifies that all sources defined in sources.json have corresponding
 * cached .md files in the docs-cache directory.
 *
 * Usage:
 *   bun .claude/scripts/check-cache-integrity.ts [--json] [--fix]
 *
 * Flags:
 *   --json  Output results as JSON
 *   --fix   Attempt to fetch missing sources
 *
 * Exit codes:
 *   0 - All cache files present
 *   1 - Missing cache files detected
 */

import { existsSync, readFileSync, statSync } from "fs";
import { dirname, join } from "path";
import type { Source, SourcesConfig, CacheFileStatus, IntegrityResult } from "./types";

const SCRIPT_DIR = dirname(import.meta.path);
const DOCS_CACHE_DIR = join(SCRIPT_DIR, "..", "docs-cache");
const SOURCES_FILE = join(DOCS_CACHE_DIR, "sources.json");

// Parse arguments
const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const autoFix = args.includes("--fix");

function loadSources(): SourcesConfig {
  if (!existsSync(SOURCES_FILE)) {
    throw new Error(`Sources file not found: ${SOURCES_FILE}`);
  }

  const content = readFileSync(SOURCES_FILE, "utf-8");
  return JSON.parse(content) as SourcesConfig;
}

function checkCacheIntegrity(): IntegrityResult {
  const config = loadSources();
  const files: CacheFileStatus[] = [];

  for (const source of config.sources) {
    const expectedPath = join(DOCS_CACHE_DIR, `${source.name}.md`);
    const exists = existsSync(expectedPath);

    const status: CacheFileStatus = {
      name: source.name,
      expected: expectedPath,
      exists,
      source,
    };

    if (exists) {
      const stats = statSync(expectedPath);
      status.size = stats.size;
      status.modified = stats.mtime.toISOString();
    }

    files.push(status);
  }

  const present = files.filter((f) => f.exists).length;
  const missing = files.filter((f) => !f.exists).length;

  return {
    total: config.sources.length,
    present,
    missing,
    files,
    cacheVersion: config.cache?.claudeCodeVersion || null,
    lastUpdated: config.cache?.lastUpdated || null,
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatOutput(result: IntegrityResult): void {
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("=".repeat(60));
  console.log("Cache Integrity Check");
  console.log("=".repeat(60));
  console.log(`Cache Version: ${result.cacheVersion || "unknown"}`);
  console.log(`Last Updated:  ${result.lastUpdated || "unknown"}`);
  console.log(`Total Sources: ${result.total}`);
  console.log(`Present:       ${result.present}`);
  console.log(`Missing:       ${result.missing}`);
  console.log("");

  if (result.missing > 0) {
    console.log("Missing files:");
    for (const file of result.files.filter((f) => !f.exists)) {
      console.log(`  - ${file.name} (${file.source.type})`);
      console.log(`    URL: ${file.source.url}`);
    }
    console.log("");
  }

  if (result.present > 0 && !jsonOutput) {
    console.log("Cached files:");
    for (const file of result.files.filter((f) => f.exists)) {
      const size = file.size ? formatSize(file.size) : "?";
      const age = file.modified
        ? Math.round((Date.now() - new Date(file.modified).getTime()) / (1000 * 60 * 60))
        : "?";
      console.log(`  ✓ ${file.name}.md (${size}, ${age}h ago)`);
    }
  }
}

async function fixMissing(result: IntegrityResult): Promise<void> {
  const missing = result.files.filter((f) => !f.exists);
  if (missing.length === 0) {
    console.log("\nNo missing files to fix.");
    return;
  }

  console.log(`\nAttempting to fetch ${missing.length} missing source(s)...`);

  // Import and run the update script for each missing source
  const { spawn } = await import("child_process");

  for (const file of missing) {
    console.log(`  Fetching: ${file.name}...`);

    const result = await new Promise<boolean>((resolve) => {
      const proc = spawn("bun", [
        join(SCRIPT_DIR, "update-docs-cache.ts"),
        `--source=${file.name}`,
      ]);

      proc.on("close", (code) => {
        resolve(code === 0);
      });

      proc.on("error", () => {
        resolve(false);
      });
    });

    if (result) {
      console.log(`  ✓ ${file.name} fetched successfully`);
    } else {
      console.log(`  ✗ ${file.name} fetch failed`);
    }
  }
}

async function main() {
  const result = checkCacheIntegrity();
  formatOutput(result);

  if (autoFix && result.missing > 0) {
    await fixMissing(result);

    // Re-check after fix
    console.log("\n" + "=".repeat(60));
    console.log("Re-checking after fix...");
    const newResult = checkCacheIntegrity();
    console.log(`Present: ${newResult.present}/${newResult.total}`);

    if (newResult.missing > 0) {
      console.log(`Still missing: ${newResult.missing}`);
      process.exit(1);
    }
  } else if (result.missing > 0) {
    console.log("\nRun with --fix to attempt fetching missing sources.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
