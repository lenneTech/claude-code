---
description: 'Publish the current lt base repo (or a named one) as a new version and immediately update its downstream base repos. Auto-detects which base repo the current working directory belongs to (nest-server, nuxt-extensions, lt-monorepo, cli, nuxt-base-starter, nest-server-starter, claude-code, claude-code-internal), analyzes its committed AND uncommitted changes, then ASKS whether to refresh dependencies (FULL maintenance) before publishing or publish the change directly, releases per the repo recipe, waits for npm propagation, then bumps + releases the dependent base repos (nest-server → nest-server-starter, nuxt-extensions → nuxt-base-starter), maintaining them too when the gate was answered "Maintain first" — the answer applies to the whole chain. Marketplace repos release via their own bump-version.ts and have no downstream. No smoke test by default (opt-in via --smoke-test). Complements /lt-dev:maintenance:maintain-stack, which cycles ALL base repos with the full release gate.'
argument-hint: '[nest-server|nuxt-extensions|lt-monorepo|cli|nuxt-base-starter|nest-server-starter|claude-code|claude-code-internal] [--release-as=patch|minor|major] [--skip-downstream] [--maintenance|--skip-maintenance] [--smoke-test] [--dry-run]'
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

**Why unrestricted `Bash`:** this command releases across up to eight base
repos with different toolchains and recipes — `git`, `gh`, `npm`/`pnpm`/`yarn`
scripts, `node`, and the secrets-scan hooks — and the exact commands depend on
which repo Step 0 resolves to, so a fixed allowlist would not cover every
target.

## When to use

- You just changed something in a base repo (committed or not) and want it
  released and propagated to the dependent starters NOW: run `/lt-dev:publish`
  right in that repo.
- A specific repo should be published from anywhere: `/lt-dev:publish nest-server`.
- NOT for the periodic full-stack cycle → `/lt-dev:maintenance:maintain-stack`.

## Step 0 — Resolve the target repo

Without an argument, detect which base repo the current working directory
belongs to (walk up to the git root, match the `origin` remote against
`lenneTech/{nest-server,nuxt-extensions,lt-monorepo,cli,nuxt-base-starter,nest-server-starter,claude-code}`
or `gitlab.lenne.tech:intern/claude-code-internal`;
fall back to the directory name). If the cwd is NOT a base repo, stop and
list the valid targets — never guess. An explicit argument always wins.

Note that the marketplace repos can be reached from a nested path: working in
`claude-code/plugins/lt-dev/…` resolves to the `claude-code` repo, since the
git root is what counts.

**Plugin names are accepted as aliases for their marketplace repo**, because
that is how the base repos are usually referred to:

| Argument | Resolves to |
|---|---|
| `lt-dev`, `lt-offers`, `lt-showroom` | `claude-code` |
| `lt-time`, `lt-ops` | `claude-code-internal` |

State the resolution in the report ("lt-dev → releasing claude-code"), since a
marketplace release always bumps ALL of its plugins in lock-step, not just the
named one. If that is not wanted, the change has to be split across releases.

With these two repos, all eight base repos per the user's CLAUDE.md are
covered: the six stack repos plus both marketplaces.

Then summarize what would be published: commits ahead of the remote plus
uncommitted changes (`git status` + `git log @{u}..`). This summary goes
into the release notes analysis and the final report.

## Chains (from the dependency graph)

| Source repo | Downstream updated afterwards |
|---|---|
| `nest-server` | `nest-server-starter` (lock-step version, `pnpm run update`, migration guides) |
| `nuxt-extensions` | `nuxt-base-starter` (bump dep in `nuxt-base-template/`) |
| `lt-monorepo`, `cli`, starters | none (chain ends there) |
| `claude-code`, `claude-code-internal` | none — consumers pull via `lt claude plugins` |

## Marketplace repos (`claude-code`, `claude-code-internal`)

Both marketplaces release identically — **always via the npm script**, never by
editing versions or crafting the commit by hand:

```bash
npm run version:patch "<commit message>"    # or version:minor / version:major
```

`scripts/bump-version.ts` bumps `package.json`, `.claude-plugin/marketplace.json`
and **every** `plugins/*/plugin.json` to the same version, then commits, tags
(`vX.Y.Z`) and pushes. It is a complete release in one step — run it only once
all changes are final.

**Always pass the message.** It becomes the body of the bump commit and the tag
annotation; without it the release reads only "chore: bump version to X.Y.Z".
Quote it as a single argument — `npm run` forwards it as-is, no `--` needed.
Derive it from the change summary of step 0 (`/lt-dev:git:commit-message` is the
helper when the wording is not obvious).

What differs from the npm/template recipes:

- **No npm propagation wait** — nothing is published to a registry. Skip flow step 4.
- **No dependency maintenance** — these repos have no runtime dependencies worth
  refreshing. Default to "publish directly"; only offer the maintenance gate when
  the user explicitly asks.
- **No `check` script** — the release gate is `claude plugin validate plugins/<name>`
  for every changed plugin plus valid JSON in `marketplace.json`. Run
  `/lt-dev:plugin:check` when elements were added or restructured.
- **Version bumping is mandatory, not cosmetic.** Claude Code caches each plugin
  under `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`. Without a bump
  the same folder is overwritten: no rollback, and no way to tell which state runs
  where.
- **`claude-code` is PUBLIC.** The secrets guard (`scripts/scan-secrets.sh` via
  pre-commit/pre-push) blocks the release on customer data, tokens or
  `/Users/<name>/` paths. Never bypass it with `--no-verify` — fix the finding.
- **Push channel:** `claude-code` goes to GitHub (`scripts/check-push-channel.sh` + HTTPS fallback
  per the skill), `claude-code-internal` to `gitlab.lenne.tech` — `gh` does not
  apply there, and there is no GitHub release to create.

Afterwards, tell the user how to pull the new version:

```bash
lt claude plugins        # updates the marketplace cache, then every plugin
```

A restart of Claude Code is required — running sessions keep the old version.

1. **Preflight** (skill rules): correct branch (nest-server: `develop`),
   `git pull` current, `gh auth`, and the push channel via
   `bash "${CLAUDE_PLUGIN_ROOT}/scripts/check-push-channel.sh" <repo-root>` —
   never `ssh-add -l`, which is a permanent false negative on 1Password
   `IdentityAgent` setups (see the skill's Push-channel rule).
   Uncommitted changes in the SOURCE repo are allowed — they are exactly what
   is being published; foreign-looking changes (files unrelated to the stated
   purpose, e.g. agent-memory files) ⇒ stop and list them instead of
   releasing blind.

1b. **Check the previous release's non-blocking gates** (nest-server only, for
   now). Some CI jobs run ALONGSIDE the publish instead of in front of it — the
   regression-evidence gate is the first — so a red one does not stop a release
   and will not stop the NEXT one either unless somebody looks. That somebody is
   this step:

   ```bash
   gh run list --workflow=publish.yml --limit 5 \
     --json databaseId,conclusion,displayTitle,createdAt \
     -q '.[] | "\(.createdAt[0:10])  \(.conclusion)  \(.displayTitle[0:40])"'
   gh issue list --label regression-evidence --state open
   ```

   A failed run or an open `regression-evidence` issue is **not** a hard stop —
   the point of the arrangement is that releases keep flowing. It IS a reporting
   duty: name it before you release, say which mutation went vacuous, and ask
   whether to fix it first or carry it. Carrying it is a legitimate answer; not
   mentioning it is not, because the arrangement's whole safety rests on this
   check being the place where a red gate cannot be walked past silently.

   The distinction that makes carrying it defensible: what failed is the
   EVIDENCE behind the regression tests, not the product. The suite itself still
   gates the release in full. A vacuous regression test does not make the
   package wrong — it makes a future regression harder to catch, which is worth
   fixing soon and rarely worth blocking on.
2. **Maintenance gate — ALWAYS ASK FIRST (default).** This command never
   silently runs dependency maintenance. After the change summary, ask the
   user via `AskUserQuestion` how to proceed:
   - **Publish directly** — skip the dependency refresh and release exactly
     the current change (recommended for a focused fix / hotfix).
   - **Maintain first** — run `/lt-dev:maintenance:maintain` (FULL: frameworks
     first, then packages via the maintainer agent; no commit) so the release
     ships on the latest dependency state, then release.

   **The answer governs the ENTIRE chain, not just the source repo.** It is one
   decision about how much dependency movement this release is allowed to carry,
   and a release is only as focused as its least focused link — maintaining the
   starter while declining to maintain nest-server would put exactly the
   dependency churn the user just refused into the same release round, one repo
   further down. So step 5 applies the same answer to every downstream repo:

   | Answer | Source repo | Downstream repo(s) |
   |---|---|---|
   | Maintain first | maintain + release | bump + **maintain** + `check` + release |
   | Publish directly | release as-is | bump + `check` + release (**no** dependency refresh) |

   Say which repos the answer will cover when asking, so the scope is visible
   before the choice (e.g. "applies to nest-server AND nest-server-starter").

   Recommend the option that fits the change (focused single-file fix →
   "Publish directly"; broad or long-untouched repo → "Maintain first"), but
   the user decides. Bypass the question ONLY when a flag makes the intent
   explicit: `--skip-maintenance` → publish directly (no ask), `--maintenance`
   → maintain first (no ask); `--dry-run` prints the plan without asking. When
   maintenance runs and afterwards there is genuinely NO change to the
   published artifact, stop with "already current — nothing to publish"
   (skill rule: no change → no release).
3. **Release source repo** per skill recipe — for `claude-code` /
   `claude-code-internal` use the marketplace section above instead — (version bump, commit convention,
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
   nest-server-starter), then **apply the step-2 answer here too** — run
   `/lt-dev:maintenance:maintain` (latest frameworks + packages) only when the
   gate was answered "Maintain first" (or `--maintenance` was passed); on
   "Publish directly" / `--skip-maintenance` do the lock-step bump WITHOUT the
   dependency refresh. Either way: iterate `check` green, release. A downstream
   `check` that fails on its own outdated dependencies is the one exception —
   report it and ask, rather than silently upgrading past the user's answer.
6. **Validate**: downstream `check` green is the default gate; for marketplace
   repos it is `claude plugin validate` per changed plugin. With
   `--smoke-test`, run `/lt-dev:fullstack:smoke-test` afterwards (recommended
   when the change touches scaffold-critical paths: build wiring, auth, SSR,
   deploy contract). The smoke test does not apply to marketplace repos.
7. **Report**: versions old→new per repo, release links, what was NOT
   released and why, leftovers (none expected — this flow creates no test
   systems unless `--smoke-test` ran, which cleans up after itself).

## Flags

- `--release-as=…` — force the version jump for the source repo (default:
  derived from the diff).
- `--skip-downstream` — publish the source repo only.
- **Maintenance is interactive by default** — the command ASKS whether to
  refresh dependencies before publishing (see Flow step 2), and the answer
  applies to the WHOLE chain. The two flags below only pre-answer that question
  for non-interactive / scripted runs:
  - `--skip-maintenance` — hotfix mode: publish directly, no ask. Downstream
    still gets its lock-step bump and its `check`, but NO dependency refresh —
    same as answering "Publish directly".
  - `--maintenance` — force the FULL dependency refresh on the source repo AND
    on every downstream repo, no ask.
- `--smoke-test` — run the full smoke-test gate after the chain.
- `--dry-run` — analyze and print the plan (target repo, change summary,
  planned versions), no writes/releases.

## Related

- Skill `maintaining-lt-stack` — **load first**; recipes, gates, pitfalls.
- `/lt-dev:maintenance:maintain-stack` — the full-stack cycle.
- `/lt-dev:fullstack:smoke-test` — optional end-to-end gate.
