/**
 * Shared TypeScript types for docs-cache scripts
 *
 * Used by:
 * - update-docs-cache.ts
 * - check-cache-version.ts
 * - check-cache-integrity.ts
 */

// Source types for different fetching strategies
export type SourceType = "md" | "html" | "spa";

// Update behavior options for cache management
export type UpdateBehavior = "never" | "always" | "auto" | "ask" | "askAlways";

// Individual documentation source definition
export interface Source {
  name: string;
  url: string;
  type: SourceType;
  description: string;
}

// Cache metadata stored in sources.json
export interface CacheInfo {
  claudeCodeVersion: string | null;
  lastUpdated: string | null;
  updateBehavior?: UpdateBehavior;
}

// Full sources.json configuration
export interface SourcesConfig {
  $schema?: string;
  description?: string;
  cache: CacheInfo;
  updateBehaviorOptions?: Record<string, string>;
  sourceTypes?: Record<string, string>;
  sources: Source[];
}

// Result of a fetch operation
export interface FetchResult {
  name: string;
  success: boolean;
  error?: string;
  duration?: number;
  usedExistingCache?: boolean;
}

// Result of version check operation
export interface VersionCheckResult {
  cacheVersion: string | null;
  currentVersion: string | null;
  lastUpdated: string | null;
  isOutdated: boolean;
  updateBehavior: UpdateBehavior;
  recommendation: "update" | "skip" | "ask" | "current" | "unknown";
}

// Cache file status for integrity check
export interface CacheFileStatus {
  name: string;
  expected: string;
  exists: boolean;
  size?: number;
  modified?: string;
  source: Source;
}

// Result of integrity check
export interface IntegrityResult {
  total: number;
  present: number;
  missing: number;
  files: CacheFileStatus[];
  cacheVersion: string | null;
  lastUpdated: string | null;
}
