# Report Schema

TypeScript interface for the structured project analysis report. Use this as the canonical output format. The report
is stored as `~/.lt-showroom/<slug>/analysis.json` (`screenshot-session.mjs analysis save`) and later as the showcase's
`sourceCodeAnalysis` in the Showroom.

Two scopes:

- **`showcase`** (default for every showroom command): `techStack`, `features`, `pagesInventory`, `startupInfo` and
  `projectFacts`. That is what a showcase shows and what the screenshot run needs.
- **`full`** (only on explicit request, `analyze --full`): additionally dimensions 2 and 4 to 8 (`architecture`,
  `userRoles`, `multiTenancy`, `apiSurface`, `testing`, `uiPatterns`, `security`, `performance`).

```typescript
interface ProjectAnalysisReport {
  /** "showcase" (default) or "full" */
  scope: "showcase" | "full";

  /** The `source` field of `screenshot-session.mjs source <slug>`, unchanged: the showcase's `source` as the Showroom takes it */
  source: {
    repositories: Array<{ provider: "gitlab" | "github" | "other"; url: string; projectPath: string; defaultBranch: string; path?: string }>;
    analyzedCommit: string; // full commit id
    analyzedAt: string;
    analyzedVersion?: string;
    analyzerVersion?: string;
  };

  /** The `fromLocalCheckout` field of the same output: the remote was unreachable, so the commit may not be on it */
  fromLocalCheckout: boolean;

  /** Project name, derived from package.json "name" or root directory name */
  projectName: string;

  /** Short tagline — one sentence describing what the project does */
  tagline: string;

  /** Dimension 1: Technology Stack */
  techStack: {
    /** Primary programming language(s) */
    languages: string[];

    /** Runtime environment with version, e.g. "Node.js 20.x", "Python 3.12" */
    runtime: string;

    /** Main application framework */
    primaryFramework: {
      name: string;
      version: string;
      evidence: string; // "path/to/file:line"
    };

    /** Frontend UI library or framework, if applicable */
    uiLibrary?: {
      name: string;
      version: string;
      evidence: string;
    };

    /** Database system(s) in use */
    databases: Array<{
      name: string;
      version?: string;
      evidence: string;
    }>;

    /** Key dependencies beyond the primary framework */
    keyLibraries: Array<{
      name: string;
      version: string;
      purpose: string;
      evidence: string;
    }>;
  };

  /** Dimension 3: Core Features (both scopes) */
  features: Array<{
    name: string;
    description: string;
    evidence: string;
    /** Lucide icon for the feature-grid, e.g. "i-lucide-shield" */
    icon: string;
    /** Page that demonstrates it best (a path from pagesInventory) */
    page?: string;
  }>;

  /** All routes and views (both scopes), see SKILL.md → "Pages and Views Inventory" */
  pagesInventory: Array<{ path: string; name: string; auth: "public" | "authenticated" | "admin" | string; feature: string }>;

  /** How to start the project (both scopes), schema in startup-detection.md */
  startupInfo: Record<string, unknown>;

  /** Proposals for the showcase key facts (both scopes), see SKILL.md → "Project Facts" */
  projectFacts: {
    /** "unknown" when the history does not tell (a shallow clone has one commit) */
    year?: number | "unknown";
    duration?: string; // "unknown" likewise
    platforms?: Array<"web" | "ios" | "android" | "desktop">;
    contributors?: number;
    evidence: string[];
  };

  /** Dimension 2: Architecture (scope "full" only) */
  architecture?: {
    /** e.g. "MVC", "Clean Architecture", "Monolith", "Microservices" */
    pattern: string;

    /** "monorepo" | "single-package" | "multi-package" */
    structure: string;

    /** Description of module/package breakdown */
    modules: Array<{
      name: string;
      responsibility: string;
      evidence: string;
    }>;

    /** Significant architectural decisions */
    notableDecisions: Array<{
      decision: string;
      rationale?: string;
      evidence: string;
    }>;
  };

  /** Detected user roles (scope "full" only) */
  userRoles?: string[];

  /** Whether the system supports multiple tenants/organizations (scope "full" only) */
  multiTenancy?: boolean;

  /** Dimension 4: API Surface (scope "full" only) */
  apiSurface?: {
    /** "rest" | "graphql" | "grpc" | "websocket" | string[] for multiple */
    type: string | string[];

    /** REST endpoints */
    endpoints?: Array<{
      method: string;
      path: string;
      auth: "public" | "authenticated" | "admin" | string;
      description: string;
      evidence: string;
    }>;

    /** GraphQL operations */
    operations?: Array<{
      type: "Query" | "Mutation" | "Subscription";
      name: string;
      auth: "public" | "authenticated" | "admin" | string;
      description: string;
      evidence: string;
    }>;

    /** Authentication mechanism */
    authentication: {
      mechanism: string;
      evidence: string;
    };

    /** Authorization approach */
    authorization: {
      approach: string;
      evidence: string;
    };
  };

  /** Dimension 5: Testing Strategy (scope "full" only) */
  testing?: {
    frameworks: string[];
    types: Array<{
      type: "unit" | "integration" | "e2e" | "api" | "snapshot";
      fileCount: number;
      coverage: "high" | "medium" | "low" | "unknown";
    }>;
    breadth: string; // e.g. "All modules covered" or "Only auth and user modules have tests"
    assessment: "high" | "medium" | "low" | "minimal";
  };

  /** Dimension 6: UI/UX Patterns (scope "full" only, projects with a frontend) */
  uiPatterns?: {
    componentLibrary?: string;
    styling: string;
    stateManagement?: string;
    responsive: boolean;
    accessibility: "comprehensive" | "partial" | "minimal" | "unknown";
    evidence: string;
  };

  /** Dimension 7: Security Measures (scope "full" only) */
  security?: {
    authentication: string;
    authorization: string;
    inputValidation: { present: boolean; framework?: string; evidence?: string };
    rateLimiting: { present: boolean; evidence?: string };
    secretsManagement: string;
    securityHeaders: { present: boolean; evidence?: string };
    notes: string[];
  };

  /** Dimension 8: Performance Optimizations (scope "full" only) */
  performance?: {
    caching: { present: boolean; description?: string; evidence?: string };
    databaseOptimizations: { present: boolean; description?: string; evidence?: string };
    asyncProcessing: { present: boolean; description?: string; evidence?: string };
    frontendPerformance?: { ssr: boolean; codeSplitting: boolean; evidence?: string };
    notes: string[];
  };
}
```

## Usage Notes

- All `evidence` fields use the format `"path/to/file.ts:42"` (relative to the repository root, the same in the clone
  and in every checkout of that commit)
- Unknown values use `"unknown"` for strings, `false` for booleans, `[]` for arrays
- Never use `null` — use `undefined` for optional fields that cannot be determined; `source` is the script's output
  and stays as it came, because the Showroom takes it as the showcase's `source` and refuses any field it does not know
- The report is JSON: `analysis save` refuses anything else, and one without `source.analyzedCommit`
