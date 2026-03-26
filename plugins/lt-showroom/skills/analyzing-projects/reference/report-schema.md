# Report Schema

TypeScript interface for the structured project analysis report. Use this as the canonical output format.

```typescript
interface ProjectAnalysisReport {
  /** Project name, derived from package.json "name" or root directory name */
  projectName: string;

  /** Short tagline — one sentence describing what the project does */
  tagline: string;

  /** Absolute or relative path that was analyzed */
  analyzedPath: string;

  /** ISO 8601 timestamp of when the analysis was performed */
  analyzedAt: string;

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

  /** Dimension 2: Architecture */
  architecture: {
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

  /** Dimension 3: Core Features */
  features: Array<{
    name: string;
    description: string;
    evidence: string;
  }>;

  /** Detected user roles */
  userRoles: string[];

  /** Whether the system supports multiple tenants/organizations */
  multiTenancy: boolean;

  /** Dimension 4: API Surface */
  apiSurface: {
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

  /** Dimension 5: Testing Strategy */
  testing: {
    frameworks: string[];
    types: Array<{
      type: "unit" | "integration" | "e2e" | "api" | "snapshot";
      fileCount: number;
      coverage: "high" | "medium" | "low" | "unknown";
    }>;
    breadth: string; // e.g. "All modules covered" or "Only auth and user modules have tests"
    assessment: "high" | "medium" | "low" | "minimal";
  };

  /** Dimension 6: UI/UX Patterns (only for projects with a frontend) */
  uiPatterns?: {
    componentLibrary?: string;
    styling: string;
    stateManagement?: string;
    responsive: boolean;
    accessibility: "comprehensive" | "partial" | "minimal" | "unknown";
    evidence: string;
  };

  /** Dimension 7: Security Measures */
  security: {
    authentication: string;
    authorization: string;
    inputValidation: { present: boolean; framework?: string; evidence?: string };
    rateLimiting: { present: boolean; evidence?: string };
    secretsManagement: string;
    securityHeaders: { present: boolean; evidence?: string };
    notes: string[];
  };

  /** Dimension 8: Performance Optimizations */
  performance: {
    caching: { present: boolean; description?: string; evidence?: string };
    databaseOptimizations: { present: boolean; description?: string; evidence?: string };
    asyncProcessing: { present: boolean; description?: string; evidence?: string };
    frontendPerformance?: { ssr: boolean; codeSplitting: boolean; evidence?: string };
    notes: string[];
  };
}
```

## Usage Notes

- All `evidence` fields use the format `"path/to/file.ts:42"` (relative to project root)
- Unknown values use `"unknown"` for strings, `false` for booleans, `[]` for arrays
- Never use `null` — use `undefined` for optional fields that cannot be determined
- The report should be serializable to JSON for consumption by the `creating-showcases` skill
