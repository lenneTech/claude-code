---
description: 'Publish the current lt base repo (or a named one) as a new version and immediately update its downstream base repos. Auto-detects which base repo the current working directory belongs to (nest-server, nuxt-extensions, lt-monorepo, cli, nuxt-base-starter, nest-server-starter), analyzes its committed AND uncommitted changes, then ASKS whether to refresh dependencies (FULL maintenance) before publishing or publish the change directly, releases per the repo recipe, waits for npm propagation, then bumps + maintains + releases the dependent base repos (nest-server → nest-server-starter, nuxt-extensions → nuxt-base-starter). No smoke test by default (opt-in via --smoke-test). Complements /lt-dev:maintenance:maintain-stack, which cycles ALL base repos with the full release gate.'
argument-hint: '[nest-server|nuxt-extensions|lt-monorepo|cli|nuxt-base-starter|nest-server-starter] [--release-as=patch|minor|major] [--skip-downstream] [--maintenance|--skip-maintenance] [--smoke-test] [--dry-run]'
allowed-tools: Read, Edit, Write, Grep, Glob, Bash, Agent, AskUserQuestion, SlashCommand, TodoWrite, ToolSearch
disable-model-invocation: true
effort: high
---

# Publish (current base repo + downstream chain)

Publishes the changes of ONE base repo as a new version — with dependencies
freshly maintained — and then updates every base repo that consumes it,
likewise on the latest dependency state. All recipes, wait patterns and
gates come from the skill **`maintaining-lt-stack`** (load it first); this
command only narrows the orchestration to a single chain.

## When to use

- You just changed something in a base repo (committed or not) and want it
  released and propagated to the dependent starters NOW: run `/lt-dev:publish`
  right in that repo.
- A specific repo should be published from anywhere: `/lt-dev:publish nest-server`.
- NOT for the periodic full-stack cycle → `/lt-dev:maintenance:maintain-stack`.

## Step 0 — Resolve the target repo

Without an argument, detect which base repo the current working directory
belongs to (walk up to the git root, match the `origin` remote against
`lenneTech/{nest-server,nuxt-extensions,lt-monorepo,cli,nuxt-base-starter,nest-server-starter}`;
fall back to the directory name). If the cwd is NOT a base repo, stop and
list the valid targets — never guess. An explicit argument always wins.

Then summarize what would be published: commits ahead of the remote plus
uncommitted changes (`git status` + `git log @{u}..`). This summary goes
into the release notes analysis and the final report.

## Chains (from the dependency graph)

| Source repo | Downstream updated afterwards |
|---|---|
| `nest-server` | `nest-server-starter` (lock-step version, `pnpm run update`, migration guides) |
| `nuxt-extensions` | `nuxt-base-starter` (bump dep in `nuxt-base-template/`) |
| `lt-monorepo`, `cli`, starters | none (chain ends there) |

## Flow

1. **Preflight** (skill rules): correct branch (nest-server: `develop`),
   `git pull` current, `gh auth` + SSH-agent check (HTTPS fallback).
   Uncommitted changes in the SOURCE repo are allowed — they are exactly what
   is being published; foreign-looking changes (files unrelated to the stated
   purpose, e.g. agent-memory files) ⇒ stop and list them instead of
   releasing blind.
2. **Maintenance gate — ALWAYS ASK FIRST (default).** This command never
   silently runs dependency maintenance. After the change summary, ask the
   user via `AskUserQuestion` how to proceed:
   - **Publish directly** — skip the dependency refresh and release exactly
     the current change (recommended for a focused fix / hotfix).
   - **Maintain first** — run `/lt-dev:maintenance:maintain` (FULL: frameworks
     first, then packages via the maintainer agent; no commit) so the release
     ships on the latest dependency state, then release.

   Recommend the option that fits the change (focused single-file fix →
   "Publish directly"; broad or long-untouched repo → "Maintain first"), but
   the user decides. Bypass the question ONLY when a flag makes the intent
   explicit: `--skip-maintenance` → publish directly (no ask), `--maintenance`
   → maintain first (no ask); `--dry-run` prints the plan without asking. When
   maintenance runs and afterwards there is genuinely NO change to the
   published artifact, stop with "already current — nothing to publish"
   (skill rule: no change → no release).
3. **Release source repo** per skill recipe (version bump, commit convention,
   PR flow for nest-server incl. migration guide, `gh release create`,
   consumer-oriented English notes, no time estimates). For the commit message,
   follow the repo convention (`NEW_VERSION: MESSAGE` for npm packages,
   conventional-commits for templates); `/lt-dev:git:commit-message` is the
   recommended helper for the wording, but skip it when the change already
   dictates an obvious, convention-compliant message (a focused one-line fix,
   or the fixed `Updated to nest-server version <X.Y.Z>`). If after maintenance
   there is genuinely NO change to the published artifact: stop with
   "already current — nothing to publish" (skill rule: no change → no release).
4. **Wait for npm propagation** (`npm view <pkg> version`), npm packages only.
5. **Update downstream** (unless `--skip-downstream`): bump to the new
   version per its recipe (lock-step + migration guides for
   nest-server-starter), run `/lt-dev:maintenance:maintain` (latest frameworks
   + packages), iterate `check` green, release.
6. **Validate**: downstream `check` green is the default gate. With
   `--smoke-test`, run `/lt-dev:fullstack:smoke-test` afterwards (recommended
   when the change touches scaffold-critical paths: build wiring, auth, SSR,
   deploy contract).
7. **Report**: versions old→new per repo, release links, what was NOT
   released and why, leftovers (none expected — this flow creates no test
   systems unless `--smoke-test` ran, which cleans up after itself).

## Flags

- `--release-as=…` — force the version jump for the source repo (default:
  derived from the diff).
- `--skip-downstream` — publish the source repo only.
- **Maintenance is interactive by default** — the command ASKS whether to
  refresh dependencies before publishing (see Flow step 2). The two flags
  below only pre-answer that question for non-interactive / scripted runs:
  - `--skip-maintenance` — hotfix mode: publish directly, no ask (downstream
    still gets its lock-step bump).
  - `--maintenance` — force the FULL dependency refresh, no ask.
- `--smoke-test` — run the full smoke-test gate after the chain.
- `--dry-run` — analyze and print the plan (target repo, change summary,
  planned versions), no writes/releases.

## Related

- Skill `maintaining-lt-stack` — **load first**; recipes, gates, pitfalls.
- `/lt-dev:maintenance:maintain-stack` — the full-stack cycle.
- `/lt-dev:fullstack:smoke-test` — optional end-to-end gate.
