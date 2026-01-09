#!/usr/bin/env bun
/**
 * Check if the documentation cache is outdated
 *
 * Compares the cached Claude Code version with the current version from GitHub.
 * Outputs JSON with version info and update recommendation.
 *
 * Usage:
 *   bun .claude/scripts/check-cache-version.ts
 *
 * Output (JSON):
 *   {
 *     "cacheVersion": "1.0.38",
 *     "currentVersion": "1.0.40",
 *     "lastUpdated": "2024-01-15T10:30:00.000Z",
 *     "isOutdated": true,
 *     "recommendation": "update"  // "update" | "current" | "unknown"
 *   }
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import type { CacheInfo, UpdateBehavior, VersionCheckResult } from "./types";

const SCRIPT_DIR = dirname(import.meta.path);
const SOURCES_FILE = join(SCRIPT_DIR, "..", "docs-cache", "sources.json");

interface SourcesConfigPartial {
  cache?: CacheInfo;
}

/**
 * Fetch current Claude Code version from GitHub CHANGELOG
 */
async function fetchCurrentVersion(): Promise<string | null> {
  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md"
    );
    if (!response.ok) return null;

    const text = await response.text();
    const match = text.match(/^## \[?(\d+\.\d+\.\d+)\]?/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Load cached version from sources.json
 */
function loadCachedVersion(): CacheInfo | null {
  if (!existsSync(SOURCES_FILE)) return null;

  try {
    const content = readFileSync(SOURCES_FILE, "utf-8");
    const config = JSON.parse(content) as SourcesConfigPartial;
    return config.cache || null;
  } catch {
    return null;
  }
}

/**
 * Compare semantic versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

async function main() {
  const cached = loadCachedVersion();
  const currentVersion = await fetchCurrentVersion();
  const updateBehavior: UpdateBehavior = cached?.updateBehavior || "auto";

  const result: VersionCheckResult = {
    cacheVersion: cached?.claudeCodeVersion || null,
    currentVersion,
    lastUpdated: cached?.lastUpdated || null,
    isOutdated: false,
    updateBehavior,
    recommendation: "unknown",
  };

  // Handle "never" behavior first
  if (updateBehavior === "never") {
    result.recommendation = "skip";
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Handle "always" behavior
  if (updateBehavior === "always") {
    result.isOutdated = true;
    result.recommendation = "update";
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Handle "askAlways" behavior
  if (updateBehavior === "askAlways") {
    result.recommendation = "ask";
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Determine if cache is outdated
  if (!cached?.claudeCodeVersion || !cached?.lastUpdated) {
    // No cache or no version info - definitely outdated
    result.isOutdated = true;
  } else if (!currentVersion) {
    // Can't determine current version - unknown state
    result.recommendation = "unknown";
    console.log(JSON.stringify(result, null, 2));
    return;
  } else if (compareVersions(cached.claudeCodeVersion, currentVersion) < 0) {
    // Cache is older than current
    result.isOutdated = true;
  } else {
    // Cache is current or newer
    result.recommendation = "current";
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Cache is outdated - apply behavior
  if (updateBehavior === "auto") {
    result.recommendation = "update";
  } else if (updateBehavior === "ask") {
    result.recommendation = "ask";
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ error: String(error) }));
  process.exit(1);
});
