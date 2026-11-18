# ADR-017: lt-offers and lt-showroom are tenant-neutral: company data comes from the signed-in platform account through MCP, and platform maintenance stays out of the public plugins

**Date:** 2026-09-25 · **Status:** accepted · **Topic:** Plugin design
**Origin:** reconstructed 2026-11-18 from git history, plugins/lt-offers/README.md, plugins/lt-showroom/README.md

## Context

lt-offers (2026-03-22) and lt-showroom (2026-03-26) began with lenne.Tech's own company data built in, and with
commands and hooks for maintaining the platforms themselves. Version 8.15.0 (354845d, 2026-09-25) made both
"tenant-neutral". The same day the secret scanner gained its denylist after customer and project names had been found
in lt-showroom and lt-dev (ADR-013).

## Decision

- lt-offers and lt-showroom carry no company data of their own. Company profile, services, team, references,
  testimonials, logo and booking link come from the signed-in account through the platform's MCP server
  (`get_offer_context`, `get_showroom_context`).
- When an offer needs something the account's knowledge base lacks, the workflow asks and offers to store the answer
  in the account.
- Commands and hooks for developing or maintaining the Offers and Showroom platforms are not part of the public
  plugins.
- The plugins reach the platforms only through their HTTP MCP servers with OAuth sign-in (`offers-api`,
  `offers-api-demo`, `showroom-api`).

## Rationale

- 354845d body: "Company data comes from the signed-in account (knowledge base, company settings) instead of built-in
  [lenne.Tech] data" and "Platform-maintenance commands and platform-repository hooks moved out of the public plugins".
- `plugins/lt-offers/README.md:3`: everything company-specific "comes from the signed-in account's knowledge base, so
  the plugin works for any company with an account on the platform."
- [inferred] Built-in company data also kept real references and customer names in a public repository (ADR-014);
  inferred from the scanner incident of the same day (`scripts/scan-secrets.sh`, incident 2026-09-25).

## Rejected alternatives

- **Company data built into the plugins** (until 354845d).

## Consequences

- The plugins work for any company with an account on the platform.
- An offer or showcase is only as good as the account's knowledge base; the plugin has no defaults to fall back on.
- A change of a platform's API reaches the plugins through their MCP tools, and the schema notes inside the plugins
  follow the platform (070797e, "docs(lt-showroom): sync with the Showroom platform's current API").
- OAuth failures of these servers are fixed in the platform repositories, not in the plugins (house rule 24a).

## Evidence

- 354845d (2026-09-25) "chore: bump version to 8.15.0"
- 070797e (2026-10-14) "docs(lt-showroom): sync with the Showroom platform's current API"
- `plugins/lt-offers/README.md:3`, `:27` ("The plugin carries no company data of its own");
  `plugins/lt-showroom/README.md:33-37` ("Your company data")
- `plugins/lt-offers/.mcp.json`, `plugins/lt-showroom/.mcp.json`; house rule 24a
