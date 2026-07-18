---
name: maintaining-lt-stack
description: 'Single source of truth for stack-wide maintenance of all lt base repos: the dependency graph (nuxt-extensions→nuxt-base-starter, nest-server→nest-server-starter), the exact release recipe per repo (npm packages via GitHub release + publish.yml; templates via standard-version/commit-and-tag-version), npm propagation wait patterns, the HTTPS push fallback for a hanging SSH agent, and the final validation via /lt-dev:fullstack:smoke-test. Activates on "maintain stack", "update base repos", "release all repos", "stack release", or when /lt-dev:maintenance:maintain-stack runs. NOT for maintaining a single package (use maintaining-npm-packages) and NOT for nest-server version upgrades inside customer projects (use nest-server-updating).'
---

# Maintaining the lt Stack (all base repos)

The seven base repos (locally under `~/code/lenneTech/`) are maintained and
released in dependency order. Target end state: every repo current, `check`
green everywhere, npm packages published, templates tagged — proven by a full
`/lt-dev:fullstack:smoke-test` run.

## Dependency graph (dictates the order)

```
Wave 1 (parallelizable):   nuxt-extensions   nest-server   lt-monorepo   cli
                                 │                │
                                 ▼ (wait for npm publish!)
Wave 2 (parallelizable):   nuxt-base-starter  nest-server-starter
                                 │
                                 ▼
Validation:                /lt-dev:fullstack:smoke-test  (exercises ALL repos live)
                                 │
                                 ▼
Wave 3 (only on findings): patch fixes → re-release affected repos
```

**Rule:** A starter is only updated once its npm package actually resolves on
npm (`npm view <pkg> version` == new version), not when the GitHub release
exists — the publish.yml action takes minutes.

## Cross-cutting rules (all repos)

- **No change → no release.** The ONLY case that skips a release is a repo
  where truly NOTHING changed (working tree clean AND no commits since the
  last released version) — never mint a version that contains no changes at
  all. ANY actual repo change — dependency bumps, code, scripts, lockfile,
  tooling pins — justifies a new version; do not second-guess whether a
  change is "release-worthy". An unchanged repo is reported as
  "already current — no release" and skipped.
  The reference is the PUBLISHED ARTIFACT: for npm packages, commits that
  cannot reach the tarball (outside the package.json `files` set — e.g.
  `.claude/agent-memory/**`, CI config) do not trigger a release of their
  own; verify with `npm pack --dry-run` when unsure. Such commits simply
  ride along with the next real release. For templates the artifact is the
  repo itself, so every commit counts.

- **Push channel:** the SSH agent is frequently empty (1Password requires an
  interactive approval). ALWAYS check (`timeout 5 ssh-add -l`); on
  "no identities" push via HTTPS:
  `git -c credential.helper='!gh auth git-credential' push https://github.com/lenneTech/<repo>.git <branch>`.
  `gh release create` is unaffected.
- **Dependency maintenance:** per repo via the `lt-dev:npm-package-maintainer`
  agent (FULL mode, skill `maintaining-npm-packages`) — the agent updates,
  audits and iterates `check` to green but **never commits** (the orchestrator
  commits and releases in a controlled way).
- **Never force-push/squash** where the flow does not call for it; the
  nest-server PR is merged explicitly WITHOUT squash (merge commit).
- **Version convention for npm packages:** set the version manually in
  `package.json`, then `pnpm i`/`npm i` (lockfile!), commit message exactly
  `NEW_VERSION: COMMIT_MESSAGE` (e.g. `1.11.0: update deps, fix X`).
- **Language:** every published artifact — release notes, commit messages,
  PR bodies, migration guides, descriptions — is written in **English**.
- **Release notes are for CONSUMERS, not for the log.** Audience: developers
  who use the release in their projects. Structure: (1) what is this? (one
  sentence, e.g. "Maintenance release — no API changes"), (2) how do I
  update? (copy-paste command), (3) **do I need to do anything?** (concrete
  checks with before/after — the most important part), (4) optional "Under
  the hood" in 1–2 sentences. NEVER in the notes: raw package version lists,
  test counts / "checks green" status, internal override surgery — that
  belongs in the CHANGELOG / migration guide. Link the migration guide
  instead of duplicating it. NEVER include time estimates ("takes ~5
  minutes") in release texts or migration guides — they are usually wrong;
  describe the effort qualitatively ("no code changes for most projects").
- **Tag convention:** `gh release list` shows the repo's pattern
  (nuxt-extensions/nest-server/cli: bare `X.Y.Z`; the templates tag `vX.Y.Z`
  through their release scripts) — follow the existing pattern.

## Recipes per repo

### nuxt-extensions (npm package `@lenne.tech/nuxt-extensions`)

1. Maintenance (agent) → `pnpm i` → `pnpm run check` green.
2. New version in `package.json`, `pnpm i`.
3. `git add . && git commit -am 'NEW_VERSION: MESSAGE'` → push (main).
4. `gh release create` for NEW_VERSION → publish.yml publishes to npm.

### nest-server (npm package `@lenne.tech/nest-server`, branch `develop`)

1. Work on `develop`. Maintenance (agent) → `pnpm i` → `pnpm run check` green.
2. New version in `package.json`, `pnpm i`.
3. **Migration guide**: create `migration-guides/<old>-to-<new>.md` following
   `TEMPLATE.md` — even for dependency-only releases (short: "no code changes
   required").
4. Commit `NEW_VERSION: MESSAGE` → push develop.
5. PR develop→main: `gh pr create -B main -H develop` → wait for CI
   (`gh pr checks --watch`) → `gh pr merge --merge` (**no squash**).
6. `gh release create` on main for NEW_VERSION → publish.yml → npm.

### lt-monorepo (template, not an npm package)

1. Maintenance (agent) → `pnpm run check` green.
2. `git add . && git commit -am 'MESSAGE'`.
3. `pnpm run release[:minor|:major]` (commit-and-tag-version) →
   `git push --follow-tags origin main` (HTTPS fallback applies — the release
   script does NOT push by itself here).

### lt CLI (npm package `@lenne.tech/cli`)

1. Maintenance (agent) → `npm run check` green (note: npm, not pnpm; the
   audit gate aborts on ANY finding — fix via `overrides` + the `//overrides`
   doc object, see cli/CLAUDE.md).
2. New version in `package.json`, `npm i`.
3. Commit `NEW_VERSION: MESSAGE` → push main → `gh release create` → npm.
4. `npm test` must report 0 skipped (repo policy).

### nuxt-base-starter (template; consumes nuxt-extensions)

0. **Wait** until `npm view @lenne.tech/nuxt-extensions version` shows the new version.
1. Bump the dependency in `nuxt-base-template/package.json`.
2. Maintenance (agent) → repo root: `pnpm i` + `pnpm run check`; additionally
   `cd nuxt-base-template && pnpm i && pnpm run check`.
3. Optional but recommended before UI-lib bumps: `pnpm run test:e2e` in the
   template (Playwright is NOT part of `check`).
4. `git add .` → commit (message from diff analysis) → version via
   `pnpm exec standard-version --release-as <patch|minor|major>` → push with
   tags (use the HTTPS fallback INSTEAD of `pnpm run release`, whose built-in
   push dies on the empty SSH agent).

### nest-server-starter (template; consumes nest-server)

0. **Wait** until `npm view @lenne.tech/nest-server version` shows the new version.
1. Set `version` AND `@lenne.tech/nest-server` in `package.json` to the new
   nest-server version (starter version == nest-server version, lock-step).
2. `pnpm run update` → apply the relevant migration guides from
   `nest-server/migration-guides/` → `pnpm run check` green.
3. Maintenance (agent) → `pnpm run check` again.
4. Commit: on a nest-server version change exactly
   `Updated to nest-server version <X.Y.Z>`, otherwise a normal message →
   push main.

## Single-repo fast path (`/lt-dev:publish`)

The same recipes serve a second entry point: publish ONE repo's changes
quickly and update only its downstream chain (nest-server →
nest-server-starter; nuxt-extensions → nuxt-base-starter). The target repo
is auto-detected from the current working directory (origin remote matched
against the six base repos) or passed explicitly. Differences to the full
cycle: uncommitted changes in the source repo are the payload (not a
preflight error — but stop on unrelated-looking files), the smoke test is
opt-in instead of mandatory, and the chain ends after the direct consumers.
Everything else — maintenance agent before release, no-change gate,
release-note conventions, propagation waits — applies unchanged.

## Validation: smoke test as release gate

After wave 2 ALWAYS run `/lt-dev:fullstack:smoke-test` (full run incl.
TurboOps deploy + online checks + residue-free cleanup). Every finding is a
base-repo fix → patch the causing repo → run its recipe again (patch
release) → repeat the smoke-test phase until clean.

**Important:** the smoke test clones the templates from GitHub (`main`) —
fixes only take effect AFTER commit+push/release of the affected repo, never
from the local working tree.

## Cleanliness (leave nothing behind)

- The smoke test cleans up its own systems (TurboOps, GitLab, local); report
  the known policy leftovers (local Mongo DBs behind the confirmation hook,
  server volumes behind the exec blocklist) as manual one-liners — do NOT
  bypass the policies.
- Maintenance runs leave NO branches/stashes: pre-existing stashes stay
  untouched, agents create none, `git stash list` unchanged.
- Never leave a half release: tag without npm publish → check
  `gh run list --workflow publish.yml`, re-run the action instead of
  stacking a new tag.

## Pitfalls (empirical)

- **check green ≠ release ready:** nuxt-extensions has its own `release`
  script gates (format/lint/version:check/test:types/test) — verify them
  before tagging.
- **Same-day majors:** pnpm 11's default 24h release-age gate may silently
  write a `minimumReleaseAgeExclude` entry for a fresh third-party major into
  `pnpm-workspace.yaml`. Never commit such an entry into a template — defer
  the update instead (the entry is dead weight once the package ages past the
  gate).
- **Starter lockfiles:** after bumping a dependency in the template ALWAYS
  run `pnpm i` there too (the template has its OWN lockfile next to the repo
  root's).
- **Agent memory side-effects:** maintainer agents may write
  `.claude/agent-memory/**` files into the repo — commit ONLY
  `package.json`/lockfile (+ intended files), never the agent memory.
- **Release scripts that push themselves** (nuxt-base-starter `release`):
  with an empty SSH agent their embedded `git push` hangs — run the version
  tool directly and push via HTTPS yourself.
- **Husky/simple-git-hooks** run on every commit (lint) — a red hook is a
  real finding, never bypass with `-n`.

## Related

- Skill `maintaining-npm-packages` — the 5 maintenance modes (agents use FULL).
- Skill `running-check-script` — iterate `check` until green.
- Command `/lt-dev:fullstack:smoke-test` — the release gate.
- Skill `deploying-to-turboops` — deploy contract + Trap 5 (Turbo-Dev Traefik).
