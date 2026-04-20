#!/usr/bin/env bun
/**
 * Cross-Reference Integrity Checker
 *
 * Scans the plugins/ directory for cross-references to other skill reference
 * files and rule anchors, then verifies each target exists.
 *
 * Catches:
 * - Broken markdown links to .md files inside plugins/
 * - References to "Rule N" in security-rules.md when Rule N no longer exists
 * - References to "reference/<name>.md" paths that don't exist
 * - Missing anchors (#heading-slug) in the target file
 *
 * Usage:
 *   bun .claude/scripts/check-cross-references.ts [--json] [--plugin=<name>]
 *
 * Flags:
 *   --json           Output results as JSON
 *   --plugin=<name>  Only check cross-references in one plugin (e.g. lt-dev)
 *
 * Exit codes:
 *   0 - All cross-references resolve
 *   1 - Broken cross-references detected
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { dirname, join, relative, resolve } from "path";

const REPO_ROOT = resolve(dirname(import.meta.path), "..", "..");
const PLUGINS_ROOT = join(REPO_ROOT, "plugins");

interface BrokenReference {
  source: string;          // file containing the reference
  line: number;
  text: string;             // the matched reference text
  target: string;           // resolved absolute path that was missing
  kind: "missing-file" | "missing-anchor" | "missing-rule";
  detail?: string;
}

interface CheckResult {
  filesScanned: number;
  referencesChecked: number;
  broken: BrokenReference[];
}

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const pluginFilter = args.find((a) => a.startsWith("--plugin="))?.split("=")[1];

function walkDir(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkDir(full, out);
    } else if (entry.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function slugify(heading: string): string {
  // Match GitHub-style anchor generation used by most Markdown renderers.
  return heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function extractAnchors(filePath: string): Set<string> {
  const content = readFileSync(filePath, "utf-8");
  const anchors = new Set<string>();
  for (const line of content.split("\n")) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (match) {
      anchors.add(slugify(match[2]));
    }
  }
  return anchors;
}

// Parse "Rule N" occurrences in security-rules.md to know which rule numbers exist
function extractRuleNumbers(securityRulesPath: string): Set<number> {
  const rules = new Set<number>();
  if (!existsSync(securityRulesPath)) return rules;
  const content = readFileSync(securityRulesPath, "utf-8");
  // Match numbered list items at the top level: "12. **..."
  for (const line of content.split("\n")) {
    const match = line.match(/^(\d+)\.\s+\*\*/);
    if (match) {
      rules.add(parseInt(match[1], 10));
    }
  }
  return rules;
}

function checkFile(
  filePath: string,
  allAnchors: Map<string, Set<string>>,
  ruleNumbersByFile: Map<string, Set<number>>,
): { checked: number; broken: BrokenReference[] } {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const broken: BrokenReference[] = [];
  let checked = 0;

  // Match markdown links [text](target) where target is a relative .md file, optionally with #anchor
  // Exclude external links (http, https, mailto)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  lines.forEach((line, idx) => {
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(line)) !== null) {
      const target = match[2];
      // Skip external and absolute anchor-only links
      if (/^https?:|^mailto:|^#|^\$\{/.test(target)) continue;
      // Only check .md targets (with or without anchor)
      const [path, anchor] = target.split("#");
      if (!path.endsWith(".md")) continue;

      checked++;

      const absolutePath = resolve(dirname(filePath), path);
      if (!existsSync(absolutePath)) {
        broken.push({
          source: relative(REPO_ROOT, filePath),
          line: idx + 1,
          text: match[0],
          target: relative(REPO_ROOT, absolutePath),
          kind: "missing-file",
        });
        continue;
      }

      if (anchor) {
        let anchors = allAnchors.get(absolutePath);
        if (!anchors) {
          anchors = extractAnchors(absolutePath);
          allAnchors.set(absolutePath, anchors);
        }
        if (!anchors.has(anchor)) {
          broken.push({
            source: relative(REPO_ROOT, filePath),
            line: idx + 1,
            text: match[0],
            target: `${relative(REPO_ROOT, absolutePath)}#${anchor}`,
            kind: "missing-anchor",
            detail: `anchor #${anchor} not found in target`,
          });
        }
      }
    }

    // Match "Rule N" references that point to a file containing rule definitions
    // Pattern: "<file>.md" followed by "Rule N" in the same line or nearby
    const ruleRefRegex = /([a-zA-Z0-9_-]+\.md)\s+Rule\s+(\d+)/g;
    let ruleMatch: RegExpExecArray | null;
    while ((ruleMatch = ruleRefRegex.exec(line)) !== null) {
      checked++;
      const targetFile = ruleMatch[1];
      const ruleNum = parseInt(ruleMatch[2], 10);

      // Resolve file relative to the current doc
      let absolutePath: string | undefined;
      // Search for targetFile in sibling or reference/ subdirectory
      const candidates = [
        resolve(dirname(filePath), targetFile),
        resolve(dirname(filePath), "reference", targetFile),
      ];
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          absolutePath = candidate;
          break;
        }
      }
      if (!absolutePath) continue; // File not found — already flagged above if referenced via link

      let rules = ruleNumbersByFile.get(absolutePath);
      if (!rules) {
        rules = extractRuleNumbers(absolutePath);
        ruleNumbersByFile.set(absolutePath, rules);
      }
      if (!rules.has(ruleNum)) {
        broken.push({
          source: relative(REPO_ROOT, filePath),
          line: idx + 1,
          text: ruleMatch[0],
          target: `${relative(REPO_ROOT, absolutePath)} :: Rule ${ruleNum}`,
          kind: "missing-rule",
          detail: `Rule ${ruleNum} not found in ${targetFile}`,
        });
      }
    }
  });

  return { checked, broken };
}

function main() {
  if (!existsSync(PLUGINS_ROOT)) {
    console.error(`plugins/ directory not found at ${PLUGINS_ROOT}`);
    process.exit(1);
  }

  let files: string[];
  if (pluginFilter) {
    const pluginDir = join(PLUGINS_ROOT, pluginFilter);
    if (!existsSync(pluginDir)) {
      console.error(`Plugin not found: ${pluginFilter}`);
      process.exit(1);
    }
    files = walkDir(pluginDir);
  } else {
    files = walkDir(PLUGINS_ROOT);
  }

  const allAnchors = new Map<string, Set<string>>();
  const ruleNumbersByFile = new Map<string, Set<number>>();

  let totalChecked = 0;
  const allBroken: BrokenReference[] = [];

  for (const file of files) {
    const { checked, broken } = checkFile(file, allAnchors, ruleNumbersByFile);
    totalChecked += checked;
    allBroken.push(...broken);
  }

  const result: CheckResult = {
    filesScanned: files.length,
    referencesChecked: totalChecked,
    broken: allBroken,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=".repeat(60));
    console.log("Cross-Reference Integrity Check");
    console.log("=".repeat(60));
    console.log(`Plugin filter:       ${pluginFilter ?? "(all plugins)"}`);
    console.log(`Files scanned:       ${result.filesScanned}`);
    console.log(`References checked:  ${result.referencesChecked}`);
    console.log(`Broken references:   ${result.broken.length}`);
    console.log("");

    if (result.broken.length > 0) {
      const byKind = new Map<string, BrokenReference[]>();
      for (const b of result.broken) {
        const list = byKind.get(b.kind) ?? [];
        list.push(b);
        byKind.set(b.kind, list);
      }
      for (const [kind, list] of byKind) {
        console.log(`${kind} (${list.length}):`);
        for (const b of list) {
          console.log(`  ${b.source}:${b.line}`);
          console.log(`    ${b.text}`);
          console.log(`    → ${b.target}`);
          if (b.detail) console.log(`    ${b.detail}`);
        }
        console.log("");
      }
    } else {
      console.log("✓ All cross-references resolve.");
    }
  }

  process.exit(result.broken.length > 0 ? 1 : 0);
}

main();
