# lenne.Tech Claude Code Plugins

The `lenne-tech` marketplace: Claude Code plugins for development in the lenne.Tech stack (NestJS with
`@lenne.tech/nest-server`, Nuxt 4 with `@lenne.tech/nuxt-extensions`, the `lt` CLI), plus tools for offers, project
showcases and everyday work.

## Plugins

| Plugin | What it does | Details |
|--------|--------------|---------|
| `lt-dev` | Skills, commands, agents and hooks for the lenne.Tech stack: backend and frontend development, test-driven tickets from Linear, code review, framework and dependency updates, Docker and CI | [plugins/lt-dev](plugins/lt-dev/README.md) |
| `lt-offers` | Business offers on [angebote.lenne.tech](https://angebote.lenne.tech) and concept folders (Konzeptmappen) on konzept.lenne.tech through MCP | [plugins/lt-offers](plugins/lt-offers/README.md) |
| `lt-showroom` | Project analysis and showcases on [showroom.lenne.tech](https://showroom.lenne.tech) through MCP, with screenshots taken from a throwaway clone | [plugins/lt-showroom](plugins/lt-showroom/README.md) |
| `lt-tools` | General-purpose tools: saves a complete website as an offline copy and checks it against the live site in headless Chrome | [plugins/lt-tools](plugins/lt-tools/README.md) |

`lt-offers` and `lt-showroom` work with an account on the respective platform; everything company-specific comes
from that account. Each plugin's README lists its skills, commands, agents and MCP servers.

## Installation

### Through the lenne.Tech CLI (recommended)

```bash
npm i -g @lenne.tech/cli

lt claude plugins                  # install or update every plugin of the marketplace
lt claude plugins lt-dev lt-tools  # install or update the named plugins
```

The CLI adds and refreshes the marketplace, installs or updates the plugins, and copies the Bash permissions from
`plugins/lt-dev/permissions.json` into `~/.claude/settings.json` (see [Permissions](#permissions)).

### Manual

```
/plugin marketplace add lenneTech/claude-code
/plugin install lt-dev@lenne-tech
```

A manual installation sets no permissions. To get the same rules, copy the `pattern` values from
`plugins/lt-dev/permissions.json` into the `permissions.allow` array of `~/.claude/settings.json`.

### Companion plugins

The Figma commands of `lt-dev` (`/lt-dev:frontend:figma-*` and the `--figma=<url>` flag of the ticket commands) need
the official `figma` plugin: `claude plugin install figma@claude-plugins-official`. Everything else works without it.

## Requirements

- Claude Code
- Node.js 22 or newer for the plugin scripts
- `jq`, which the hooks use to read their input
- Google Chrome (or Chrome Canary) for browser checks through the Chrome DevTools MCP server and for the `lt-tools`
  website comparison
- The lenne.Tech CLI for the automatic permission setup

## Permissions

### Recommended permission mode: auto

Work in **auto mode** (`Shift+Tab`, or `permissions.defaultMode: "auto"`). A classifier approves routine actions and
asks only for risky ones, which is the balance these plugins are built for: protected by default, nobody slowed down,
a prompt only for a rare or sensitive action. Manual (`default`) mode is not practical for agentic work with these
plugins, whatever the allow list says: measured over 151 real lt-dev sessions, it would ask about 131 times per
session (median), and only about a third of those prompts could be removed by any allow rule at all, because Claude
Code asks for shell constructs such as variables, `$(…)` or paths outside the project regardless of rules.

### Allow rules

The allow rules still matter in auto mode: a rule resolves an action before the classifier sees it, so every rule is
kept narrow (it would otherwise skip the safety check), and the frequent harmless ones save the classifier round trip.

`plugins/lt-dev/permissions.json` lists the narrow Bash commands the skills and agents run without a prompt. The CLI
copies it into `~/.claude/settings.json`, where every rule applies in every project. A rule the plugin narrowed or
dropped is listed in the file's `formerPatterns` array, and the CLI removes it once from your settings; a rule you add
again by hand afterwards stays. Broad tools (`curl`, `node`, `docker run`/`exec`, `git push`, `rm`, `cp`, `mv`) are not
listed: the commands that need them grant them for their own turn through `allowed-tools`.

Plugin helper scripts are not in `permissions.json` either. Settings do not expand `${CLAUDE_PLUGIN_ROOT}`, and a `*`
in a script path also matches `../`, so a rule such as `Bash(bash <plugin dir>/*/scripts/*)` would approve
`bash <plugin dir>/x/scripts/../../../dev/stdin`, that is, any code. The commands that run these scripts grant each one
by exact name for their own turn; do not add a wildcard rule for them by hand.

A skill or agent that runs a new CLI command gets a `permissions.json` entry no broader than its description:

```json
{
  "pattern": "Bash(pnpm run test:*)",
  "description": "Run the project's test scripts",
  "usedBy": ["skill-or-agent-name"]
}
```

## Development

This repository is public. Customer names, internal hosts, tokens, `.env` files and local user paths never belong
in it; plugins ship anonymized examples only.

- **Secret guard:** after cloning, run `scripts/install-hooks.sh` once. The pre-commit and pre-push hooks run
  `scripts/scan-secrets.sh`; `.github/workflows/secrets-guard.yml` repeats the scan in CI.
- **Checks:** `claude plugin validate plugins/<plugin>` validates a plugin. Plugin CI (`.github/workflows/plugin-ci.yml`)
  also runs the script tests, the context budgets and the rule invariants.
- **Release:** commit the content first, then run `bun run version:patch|minor|major "<description>"`. The script
  raises the version in `package.json`, `.claude-plugin/marketplace.json` and every `plugin.json`, commits only that
  bump (it stops when the index already holds staged changes), tags `v<version>` and pushes branch and tag.
- **Working with Claude Code:** [CLAUDE.md](CLAUDE.md) holds the conventions for plugin elements, the documentation
  cache under `.claude/docs-cache/` and the `/optimize` command for this repository.

## Structure

```
claude-code/
├── .claude-plugin/marketplace.json   # Marketplace definition
├── .claude/                          # Repository-only tooling: docs cache, optimizer skill, agents and command
├── .github/workflows/                # Plugin CI and secret guard
├── .githooks/                        # pre-commit and pre-push secret scan
├── plugins/
│   ├── lt-dev/                       # Stack development: skills, commands, agents, hooks, scripts, evals
│   ├── lt-offers/                    # Offers and concept folders (MCP)
│   ├── lt-showroom/                  # Project analysis and showcases (MCP)
│   └── lt-tools/                     # General-purpose tools
└── scripts/                          # Release script, hook installer, secret scanner
```

## License

MIT License, lenne.Tech GmbH
