# Release recipes per repo

Part of the [`maintaining-lt-stack`](SKILL.md) skill. Where a step says "see the propagation rule above", "the push-channel rule above" or "the no-change gate", the rule lives in SKILL.md under "Dependency graph" and "Cross-cutting rules".

## Recipes per repo

### nuxt-extensions (npm package `@lenne.tech/nuxt-extensions`)

> **Picking the number: a breaking change is a MINOR here, never a major.**
> Same rule as nest-server below, different anchor: the MAJOR digit tracks the **Nuxt**
> major this module targets — `1.x` is Nuxt 4 — so it moves when, and only when, Nuxt
> moves. Everything of our own ships in a minor, breaking changes included: a removed
> composable, a changed option shape, a **narrowed peer range**.
>
> This half was unwritten until 1.15.0 narrowed `better-auth` from `>=1.0.0` to
> `>=1.7.1 <1.8.0` — an install-breaking change for anyone below the floor, shipped as a
> minor with nothing stating why the digit stayed. Strict semver would call that a major;
> the anchor is what overrides it, and the anchor only holds if it is written down.
>
> The `### Breaking` CHANGELOG heading plus a `migration-guides/` entry carry the warning
> instead. Say up front that the minor contains breaking changes and why the digit stays.

1. Maintenance (`/lt-dev:maintenance:maintain`) → `pnpm i` → `pnpm run check` green.
2. New version in `package.json`, `pnpm i`.
3. `git add . && git commit -am 'NEW_VERSION: MESSAGE'` → push (main).
4. `gh release create` for NEW_VERSION → publish.yml publishes to npm.

### nest-server (npm package `@lenne.tech/nest-server`, branch `develop`)

> **Picking the number: a breaking change is a MINOR here, never a major.**
> The MAJOR digit tracks the NestJS major this package targets — 11.x is NestJS 11 — so it
> moves when, and only when, NestJS moves. Everything of our own ships in a minor, breaking
> changes included: removed APIs, changed signatures, a dependency turned into a required
> peer. Do not "promote" a breaking change to a major because semver would elsewhere; that
> would decouple the digit from NestJS and cost the meaning it carries.
>
> The consumer half of this rule is already in `nest-server-updating` ("Minor = Major, treat
> it as such"). This is the producing half — and the one that is easy to get backwards while
> writing the release, because the change genuinely IS breaking.
>
> The migration guide (step 3) is what carries the weight instead: say up front that the
> minor contains breaking changes and why the digit stays, so nobody reads the version number
> as a promise it does not make.

1. Work on `develop`. Maintenance (`/lt-dev:maintenance:maintain`) → `pnpm i` → `pnpm run check` green.
2. New version in `package.json`, `pnpm i`.
3. **Migration guide**: create `migration-guides/<old>-to-<new>.md` following
   `TEMPLATE.md` — even for dependency-only releases (short: "no code changes
   required").
4. Commit `NEW_VERSION: MESSAGE` → push develop.
5. PR develop→main: `gh pr create -B main -H develop` → wait for CI
   (`gh pr checks --watch`) → `gh pr merge --merge` (**no squash**).
6. `gh release create` on main for NEW_VERSION → publish.yml → npm.

> **`publish.yml` runs two jobs in parallel, and only one of them gates the release.**
>
> | Job | Blocks the release? | What it proves |
> |---|---|---|
> | `publish` | yes | the artifact: audit, full suite, TDZ guard, build, consumer gate, then npm |
> | `regression-evidence` | **no** | that the ~57 registered regression tests still observe their defects |
>
> The evidence job cost ~13 of the former ~18 minutes and held every release behind it. What it
> protects is the freshness of the safety net, not the correctness of the artifact: a regression
> test that has gone vacuous does not make the package wrong, it makes a FUTURE regression harder
> to catch. Worth fixing promptly, rarely worth blocking a release on. So it now runs alongside.
>
> **That trade is only honest because a red run cannot be missed**, and it takes all three of these:
>
> 1. the workflow run is marked failed (the publish has already happened by then),
> 2. an issue labelled `regression-evidence` is opened automatically,
> 3. `/lt-dev:publish` reads the last conclusion in its preflight (step 1b) and reports it before
>    starting the next release.
>
> Remove any one and this becomes a job nobody reads — which is strictly worse than the old
> blocking version, because it still looks like a safety net. If you ever make another gate
> non-blocking, port all three or leave it blocking.
>
> Carrying a red evidence run into the next release is a legitimate decision; making it silently
> is not. Name the failing mutation, then decide.

### lt-monorepo (template, not an npm package)

1. Maintenance (`/lt-dev:maintenance:maintain`) → `pnpm run check` green.
2. `git add . && git commit -am 'MESSAGE'`.
3. `pnpm run release[:minor|:major]` (commit-and-tag-version) →
   `git push --follow-tags origin main` (HTTPS fallback applies — the release
   script does NOT push by itself here).

### lt CLI (npm package `@lenne.tech/cli`)

1. Maintenance (`/lt-dev:maintenance:maintain`) → `npm run check` green (note: npm, not pnpm; the
   audit gate aborts on ANY finding — fix via `overrides` + the `//overrides`
   doc object, see cli/CLAUDE.md).

   **`pnpm run check` here does not just fail, it leaves a mess.** This repo is
   npm-based (`package-lock.json`). pnpm runs its own install first, dies on
   `ERR_PNPM_IGNORED_BUILDS` (`@lenne.tech/npm-package-helper`, `bcrypt`,
   `unrs-resolver`) — and by then has written a `pnpm-lock.yaml` and a stub
   `pnpm-workspace.yaml` that have no business in this repo. Delete both if the
   wrong command ran; the failure is loud, the two files are not.
2. New version in `package.json`, `npm i`.
3. Commit `NEW_VERSION: MESSAGE` → push main → `gh release create` → npm.
4. `npm test` must report 0 skipped (repo policy).

### nuxt-base-starter (template; consumes nuxt-extensions)

0. **Wait** until `@lenne.tech/nuxt-extensions@<version>` resolves — version-specific
   endpoint, see the propagation rule above (`npm view` reads a lagging cache).
1. Bump the dependency in `nuxt-base-template/package.json`.
2. Maintenance (`/lt-dev:maintenance:maintain`) → repo root: `pnpm i` + `pnpm run check`; additionally
   `cd nuxt-base-template && pnpm i && pnpm run check`.
3. Optional but recommended before UI-lib bumps: `pnpm run test:e2e` in the
   template (Playwright is NOT part of `check`).
4. `git add .` → commit (message from diff analysis) → version via
   `pnpm exec standard-version --release-as <patch|minor|major>` → then push the
   commit and the tag **in two steps**, NOT via `pnpm run release`:

   ```bash
   git push origin main
   git push origin refs/tags/vX.Y.Z
   ```

   Pick the channel with the push-channel rule above — **do not assume HTTPS.**
   `pnpm run release` (root `package.json`) appends `git push --follow-tags origin
   main`, and that combined push was refused at v2.25.0 (2026-09-02).
   **Why it was refused is unmeasured.** This skill used to blame an empty SSH
   agent — but that is the exact false negative `ssh-add -l` produces here, and on
   2026-09-04 the functional check reported `ssh … push normally` with two keys in
   the 1Password agent. A force-push guard on `--follow-tags` is the other
   candidate and is equally unproven: there is no deny rule and no push hook in
   `~/.claude/settings.json`, so it would have to be the built-in harness
   protection. The two-step push worked at v2.25.0 and v2.25.1 — use it, and leave
   the cause open instead of repeating a guess.
5. **Then stop — the GitHub release makes itself.** A workflow reacts to the tag
   push and creates the release. A follow-up `gh release create vX.Y.Z` fails with
   `HTTP 422: Release.tag_name already exists` — within seconds and reliably, so it
   is the workflow having won, not a race and not an error. Verify with
   `gh release view vX.Y.Z` plus both workflows (Release, Tests) green, **never**
   from the exit code of your own `create` call: it reports failure on a release
   that exists, and a session reading that as "the release did not happen" will
   try to fix a release that is already live. Measured 2026-09-04 on v2.25.1.

### nest-server-starter (template; consumes nest-server)

0. **Wait** until `@lenne.tech/nest-server@<version>` resolves — version-specific
   endpoint, see the propagation rule above (`npm view` reads a lagging cache).
1. Set `version` AND `@lenne.tech/nest-server` in `package.json` to the new
   nest-server version (starter version == nest-server version, lock-step).
   `spectaql.yml` inherits `version` via the `spectaql:sync` step, so raising
   only the dependency leaves the GraphQL docs advertising the previous
   release — and nothing catches it: `check` passes with the two fields out of
   sync. Verify by hand before committing the bump:

   ```bash
   node -e "const p=require('./package.json');process.exit(p.version===p.dependencies['@lenne.tech/nest-server']?0:1)" && echo "version matches" || echo "MISMATCH"
   ```

   **Lock-step is a rule of the starter REPOSITORY, never of projects generated
   from it.** A generated project carries its own version and upgrades the
   framework independently, so there the two fields are expected to differ.
   That is also why this stays a manual check with no guard in
   `scripts/check.mjs`: the check script ships with the template, so a guard
   would travel into every generated project and fail there on a perfectly
   correct state. Decided by Kai 2026-09-04 — do not "fix" the missing guard.
2. `pnpm run update` → apply the relevant migration guides from
   `nest-server/migration-guides/` → `pnpm run check` green. **"Apply the
   migration guide" is NOT only about code changes.** A guide that says "no
   code changes required for most projects" still routinely introduces new
   opt-in configuration (env vars, Docker knobs) that the starter — as the
   REFERENCE project consumers copy — must surface. So for every guide, also
   check its "What's new / config" section against the starter's reference
   config surfaces (`.env.example`, `docker-entrypoint.sh`, `src/config.env.ts`)
   and document any new opt-in knob there (commented-out, default-off), even
   when zero code lines change. A pure lock-step version bump is an incomplete
   downstream update. Applies in publish-directly mode too (this is part of the
   recipe, not the dependency-maintenance step that `--skip-maintenance` skips).
3. Maintenance (`/lt-dev:maintenance:maintain`) → `pnpm run check` again.
4. Commit: on a nest-server version change exactly
   `Updated to nest-server version <X.Y.Z>`, otherwise a normal message →
   push main.
5. **Then stop — the tag makes itself.** `.github/workflows/tag.yml` fires on a push
   to main that touched `package.json`, reads the version out of the manifest and
   pushes an annotated `vX.Y.Z` onto the bump commit. So do not reach for `git tag`
   because the tag series looks incomplete: the push comes back `already exists`, and
   a lightweight tag set locally before the workflow lands diverges from the annotated
   one on the remote (delete it, then `git fetch --tags`). Skip `pnpm run release`
   (standard-version) too: besides tagging, which the workflow already does, it bumps
   the version, and step 1 already set that by hand, so the version would rise a
   second time (11.41.1 → 11.41.2).

### Marketplace repos (`claude-code` public, `claude-code-internal` private)

Not part of the stack waves — they ship Claude Code plugins, not application
code, and nothing consumes them via npm. Both use the same one-step release,
**always through the npm script**, never a hand-made version edit or commit:

```bash
npm run version:patch "<commit message>"   # or version:minor / version:major
```

`scripts/bump-version.ts` bumps `package.json`, `.claude-plugin/marketplace.json`
and every `plugins/*/plugin.json` to the same version, commits, tags `vX.Y.Z`
and pushes — a complete release, so run it only when everything is final. The
message is mandatory: it becomes the commit body and the tag annotation. Quote
it as one argument; `npm run` forwards it without a `--` separator.

- **Release gate:** `claude plugin validate plugins/<name>` per changed plugin
  (plus `/lt-dev:plugin:check` when elements were added or restructured). No
  `check` script, no smoke test, no npm propagation wait.
- **Version bumps are mandatory.** Plugins run from the versioned cache
  `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`; without a bump the
  same folder is overwritten, which costs rollback and traceability.
- **`bump-version.ts` stages the whole tree (`git add .`), so a peer's uncommitted
  work rides along.** This repo is worked in parallel more than most, because
  stack-wide findings are supposed to land here, so foreign changes in the tree are
  the normal case rather than an edge one. `git:ship` and `dev-submit` gate against
  this; the publish path cannot, because the npm script owns the commit. So the gate
  is manual and belongs before the bump:

  ```bash
  bash "${CLAUDE_PLUGIN_ROOT}/scripts/change-provenance.sh"
  git stash push -m "held out of <version>" -- <foreign paths>
  npm run version:minor "<message>"
  git stash pop
  ```

  Tell the affected sessions before the stash (`CONFLICT`) and after the pop
  (`READY`) — the window is seconds, but a parallel writer turns it into a conflict.

  Observed on 2026-09-01 during the 8.9.0 release: two foreign files were in the
  tree, both finished, both describing versions that did not exist — nuxt-extensions
  1.16.0 and nest-server 11.38.0 against npm's 1.15.1 and 11.37.0, plus lt CLI guards
  absent from 1.44.0. Asking their authors (`ORIGIN`) is what surfaced it; the diffs
  alone read as ready to ship.

- **Check the versions a documentation change references, not just the change.**
  Same release, one line further: the guard list already contained a claim about
  `lt fullstack init` behaviour that shipped in 8.9.0 because only the foreign
  addition had been verified, not the text it was added to. A skill that promises a
  guard nobody can install sends its reader looking for something that is not there.
  `npm view <pkg> version` for packages, `ls-remote --tags` for templates, and
  `git show <tag>:<path>` to prove the tag actually contains what the text claims.

- **Secrets guard:** `scripts/scan-secrets.sh` runs via pre-commit/pre-push and
  aborts the release on findings — critical for the PUBLIC `claude-code`. Fix
  findings, never bypass with `--no-verify`.
- **Push channel:** `claude-code` → GitHub (SSH-agent check + HTTPS fallback as
  above); `claude-code-internal` → `gitlab.lenne.tech:intern/claude-code-internal`,
  where `gh` does not apply and no GitHub release is created.
- **Consumers:** `lt claude plugins` refreshes the marketplace cache and updates
  every plugin; a Claude Code restart applies it.
