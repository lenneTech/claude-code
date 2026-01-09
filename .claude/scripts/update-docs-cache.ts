#!/usr/bin/env bun
/**
 * Claude Code Documentation Cache Updater
 *
 * Downloads Claude Code documentation pages and converts them to Markdown.
 * Uses Playwright for JavaScript-rendered pages and Turndown for HTML->MD conversion.
 *
 * Configuration is loaded from .claude/docs-cache/sources.json
 * Downloads run in PARALLEL for speed.
 *
 * Usage:
 *   bun .claude/scripts/update-docs-cache.ts [--verbose] [--sequential] [--source=<name>]
 */

import { chromium, type Page, type BrowserContext } from "playwright";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { existsSync, readFileSync } from "fs";
import { writeFile } from "fs/promises";
import { dirname, join } from "path";

// Paths
const SCRIPT_DIR = dirname(import.meta.path);
const PROJECT_ROOT = join(SCRIPT_DIR, "..", "..");
const OUTPUT_DIR = join(PROJECT_ROOT, ".claude", "docs-cache");
const SOURCES_FILE = join(OUTPUT_DIR, "sources.json");

// Configuration
const TIMEOUT = 30000; // 30 seconds per page

// Type definitions
interface Source {
  name: string;
  path: string;
  description: string;
}

interface SourcesConfig {
  baseUrl: string;
  sources: Source[];
}

interface FetchResult {
  name: string;
  success: boolean;
  error?: string;
  duration?: number;
}

// Parse command line arguments
const args = process.argv.slice(2);
const verbose = args.includes("--verbose") || args.includes("-v");
const sequential = args.includes("--sequential") || args.includes("-s");
const specificSource = args.find((a) => a.startsWith("--source="))?.split("=")[1];

function log(message: string, force = false) {
  if (verbose || force) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

function logError(message: string) {
  console.error(`[ERROR] ${message}`);
}

/**
 * Load sources configuration from JSON file
 */
function loadSources(): SourcesConfig {
  if (!existsSync(SOURCES_FILE)) {
    throw new Error(`Sources file not found: ${SOURCES_FILE}`);
  }

  const content = readFileSync(SOURCES_FILE, "utf-8");
  const config = JSON.parse(content) as SourcesConfig;

  if (!config.baseUrl || !Array.isArray(config.sources)) {
    throw new Error("Invalid sources.json format: missing baseUrl or sources array");
  }

  return config;
}

/**
 * Configure Turndown for optimal Markdown output
 */
function createTurndownService(): TurndownService {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });

  // Add GitHub Flavored Markdown support (tables, strikethrough, etc.)
  turndown.use(gfm);

  // Custom rule for code blocks with language detection
  turndown.addRule("codeBlocks", {
    filter: (node) => {
      return (
        node.nodeName === "PRE" &&
        node.firstChild !== null &&
        node.firstChild.nodeName === "CODE"
      );
    },
    replacement: (_content, node) => {
      const codeNode = node.firstChild as HTMLElement;
      const code = codeNode.textContent || "";
      const lang = codeNode.className?.match(/language-(\w+)/)?.[1] || "";
      return `\n\`\`\`${lang}\n${code.trim()}\n\`\`\`\n`;
    },
  });

  // Remove navigation and footer elements
  turndown.addRule("removeNav", {
    filter: ["nav", "footer", "aside"],
    replacement: () => "",
  });

  // Clean up empty links
  turndown.addRule("cleanLinks", {
    filter: (node) => {
      return node.nodeName === "A" && !node.textContent?.trim();
    },
    replacement: () => "",
  });

  return turndown;
}

/**
 * Extract the main content from a Claude Code documentation page
 */
async function extractMainContent(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const contentSelectors = [
      "#content-area",
      '[id="content-area"]',
      "main article",
      "article.prose",
      ".prose",
      '[class*="content"]',
      "main",
      "article",
    ];

    let contentElement: Element | null = null;

    for (const selector of contentSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent && el.textContent.length > 500) {
        contentElement = el;
        break;
      }
    }

    if (!contentElement) {
      contentElement = document.body;
    }

    const clone = contentElement.cloneNode(true) as HTMLElement;

    const removeSelectors = [
      "script", "style", "noscript", "nav", "header", "footer", "aside",
      '[aria-hidden="true"]', '[role="navigation"]', '[role="banner"]',
      '[role="contentinfo"]', '[class*="sidebar"]', '[class*="Sidebar"]',
      '[class*="nav"]', '[class*="Nav"]', '[class*="menu"]', '[class*="Menu"]',
      '[class*="toc"]', '[class*="ToC"]', '[class*="breadcrumb"]',
      '[class*="Breadcrumb"]', '[class*="search"]', '[class*="Search"]',
      '[class*="footer"]', '[class*="Footer"]', '[class*="header"]',
      '[class*="Header"]', "button", '[role="button"]', '[class*="skip"]',
      '[class*="logo"]', '[class*="Logo"]', "svg", "img[src*='logo']",
    ];

    removeSelectors.forEach((sel) => {
      try {
        clone.querySelectorAll(sel).forEach((el) => el.remove());
      } catch {
        // Ignore invalid selectors
      }
    });

    clone.querySelectorAll("div, span").forEach((el) => {
      if (!el.textContent?.trim() && !el.querySelector("img, svg, code, pre")) {
        el.remove();
      }
    });

    return clone.innerHTML;
  });
}

/**
 * Clean up the generated Markdown
 */
function cleanMarkdown(markdown: string, title: string, sourceUrl: string): string {
  const cleanTitle = title
    .replace(" | Claude Code", "")
    .replace(" - Claude Code Docs", "")
    .replace("Claude Code Docs", "")
    .trim();

  const header = `# ${cleanTitle}

> Source: ${sourceUrl}
> Generated: ${new Date().toISOString()}

---

`;

  let cleaned = markdown
    .replace(/\[[\u200B\s]*\]\(#[^)]*\)\s*/g, "")
    .replace(/\[Skip to [^\]]+\]\([^)]*\)/gi, "")
    .replace(/^\[[\w\s]+\n\n\]\([^)]+\)\n?/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*(?:logo|icon|flag)[^)]*\)/gi, "")
    .replace(/\[\s*\]\([^)]*\)/g, "")
    .replace(/^\[\/docs\/[^\]]+\]\([^)]+\)\s*$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/^#{1,6}\s*$/gm, "")
    .replace(/^\s*-\s*$/gm, "")
    .replace(/\[([^\]]*)\]\(\s*\)/g, "$1")
    .replace(/`\s+/g, "`")
    .replace(/\s+`/g, "`")
    .replace(/^(Navigation|Search\.\.\.|⌘K|Ask AI)\s*$/gm, "")
    .replace(/^[★●◆►▸▹▷▶︎\-\*]+\s*$/gm, "")
    .replace(/-{3,}/g, "---")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/^\n+/, "")
    .trim();

  return header + cleaned + "\n";
}

/**
 * Fetch a single documentation page and convert to Markdown
 */
async function fetchAndConvert(
  context: BrowserContext,
  source: Source,
  baseUrl: string,
  turndown: TurndownService
): Promise<FetchResult> {
  const url = `${baseUrl}${source.path}`;
  const startTime = Date.now();
  log(`Starting: ${source.name}`);

  const page = await context.newPage();

  try {
    // Use networkidle to ensure React fully hydrates (other optimizations still apply)
    await page.goto(url, { waitUntil: "networkidle", timeout: TIMEOUT });

    const title = await page.title();
    const html = await extractMainContent(page);
    let markdown = turndown.turndown(html);
    markdown = cleanMarkdown(markdown, title, url);

    const outputPath = join(OUTPUT_DIR, `${source.name}.md`);
    await writeFile(outputPath, markdown, "utf-8");

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`✓ ${source.name} (${duration}s)`, true);

    return { name: source.name, success: true, duration: parseFloat(duration) };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`Failed: ${source.name} - ${errorMessage}`);
    return { name: source.name, success: false, error: errorMessage };
  } finally {
    await page.close();
  }
}

/**
 * Process all sources in parallel (no batching - all at once)
 */
async function processParallel(
  context: BrowserContext,
  sources: Source[],
  baseUrl: string,
  turndown: TurndownService
): Promise<FetchResult[]> {
  log(`Processing all ${sources.length} sources in parallel`);
  return Promise.all(
    sources.map((source) => fetchAndConvert(context, source, baseUrl, turndown))
  );
}

/**
 * Process sources sequentially
 */
async function processSequential(
  context: BrowserContext,
  sources: Source[],
  baseUrl: string,
  turndown: TurndownService
): Promise<FetchResult[]> {
  const results: FetchResult[] = [];

  for (const source of sources) {
    const result = await fetchAndConvert(context, source, baseUrl, turndown);
    results.push(result);
  }

  return results;
}

/**
 * Launch browser with optimizations
 */
async function launchBrowser() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--no-sandbox",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-sync",
      "--disable-translate",
      "--metrics-recording-only",
      "--mute-audio",
      "--no-first-run",
      "--safebrowsing-disable-auto-update",
    ],
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 800, height: 600 },
  });

  // Block unnecessary resources (analytics, fonts, images)
  await context.route("**/*", (route) => {
    const url = route.request().url();
    const resourceType = route.request().resourceType();

    if (
      resourceType === "image" ||
      resourceType === "font" ||
      resourceType === "media" ||
      url.includes("analytics") ||
      url.includes("tracking") ||
      url.includes("gtag") ||
      url.includes("googletagmanager") ||
      url.includes("facebook") ||
      url.includes("hotjar") ||
      url.includes("segment") ||
      url.includes("intercom")
    ) {
      return route.abort();
    }
    return route.continue();
  });

  return { browser, context };
}

/**
 * Main execution
 */
async function main() {
  console.log("=".repeat(60));
  console.log("Claude Code Documentation Cache Updater");
  console.log("=".repeat(60));

  const startTime = Date.now();

  // Start browser launch AND config load in parallel
  const [{ browser, context }, config] = await Promise.all([
    launchBrowser(),
    Promise.resolve(loadSources()),
  ]);

  log(`Loaded ${config.sources.length} sources from ${SOURCES_FILE}`);

  // Filter sources if specific one requested
  let sourcesToFetch = config.sources;
  if (specificSource) {
    sourcesToFetch = config.sources.filter((s) => s.name === specificSource);
    if (sourcesToFetch.length === 0) {
      await browser.close();
      logError(`Source not found: ${specificSource}`);
      console.log("Available sources:", config.sources.map((s) => s.name).join(", "));
      process.exit(1);
    }
  }

  const mode = sequential ? "sequential" : `parallel (${sourcesToFetch.length} concurrent)`;
  log(`Fetching ${sourcesToFetch.length} page(s) in ${mode} mode...`, true);

  const turndown = createTurndownService();

  // Ensure output directory exists before parallel writes
  if (!existsSync(OUTPUT_DIR)) {
    const { mkdirSync } = await import("fs");
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Process sources
  const results = sequential
    ? await processSequential(context, sourcesToFetch, config.baseUrl, turndown)
    : await processParallel(context, sourcesToFetch, config.baseUrl, turndown);

  await browser.close();

  // Summary
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log("\n" + "=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));
  console.log(`Total: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log("\nFailed pages:");
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.error}`));
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nTotal duration: ${duration}s`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Configuration: ${SOURCES_FILE}`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  logError(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
