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
> The MAJOR digit tracks the NestJS major this package targets — 12.x is NestJS 12 — so it
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

### Release commit for the templates (lt-monorepo, nuxt-base-starter, ng-base-starter; also ng-base)

These repos are released by hand, without a release tool: the version jump is
`/lt-dev:publish`'s decision (`--release-as`, otherwise derived from the diff), and the
CHANGELOG section is written directly.

1. **Version.** Raise `version` in the root `package.json` to `X.Y.Z`. lt-monorepo
   carries it a second time, in the `// @lt-check-wrapper X.Y.Z` line at the top of
   `scripts/check.mjs`: the lt CLI reads that marker so `lt fullstack update` never
   replaces a project's wrapper with an older one, and
   `scripts/check-wrapper-version.test.mjs` fails when it differs from `package.json`.
   Set both.
2. **CHANGELOG section.** Insert it at the top of `CHANGELOG.md`, below the intro
   paragraph, in the layout the repo already uses: the topmost entry is the template.
   List the commits since the previous tag, without merges and without earlier
   `chore(release)` commits:

   ```bash
   git log vA.B.C..HEAD --no-merges --format='%h %H %s'
   ```

   One line per commit under the section of its conventional-commit type, built from
   the subject line only: `* **scope:** subject ([<short>](https://github.com/lenneTech/<repo>/commit/<full>))`,
   `* subject (…)` without a scope. A commit without a conventional type goes under the
   section its change fits.
   - **nuxt-base-starter:** a patch is headed
     `### [X.Y.Z](https://github.com/lenneTech/nuxt-base-starter/compare/vA.B.C...vX.Y.Z) (YYYY-MM-DD)`,
     a minor or major `## [X.Y.Z](…)`; below it `### Features`, `### Bug Fixes`,
     `### Documentation`, and further sections only for types that occur.
     `.github/workflows/release.yml` turns exactly the lines this commit adds to
     `CHANGELOG.md` into the GitHub release notes (a `diff` against
     `HEAD~1:CHANGELOG.md`), so the section only has to be consistent in itself, and
     the section must arrive in the release commit, not in an earlier one.
   - **lt-monorepo:** every release is headed
     `## [X.Y.Z](https://github.com/lenneTech/lt-monorepo/compare/vA.B.C...vX.Y.Z) (YYYY-MM-DD)`;
     sections in this order, each only when it has entries: Features, Bug Fixes,
     Performance, Refactoring, Documentation, CI/CD, Build System, Tests, Chores.
     `style` commits stay out.
   - **ng-base-starter:** headed as in nuxt-base-starter, with compare links to `lenneTech/ng-base-starter`.
     Its `.github/workflows/release.yml` diffs against `HEAD~1:CHANGELOG.md`, so the release notes are
     exactly the lines that are new in the release commit, and a line that was already committed never
     reaches them, wherever it moves. Renaming an `## Unreleased` heading, or moving its entries under a new
     heading, adds the heading line and nothing else. So `CHANGELOG.md` stays out of every commit before the
     release commit; where `Unreleased` entries were committed earlier, the content commit removes them, and
     the release commit writes them under the version heading.
   - **ng-base:** Keep a Changelog, every release, patches included, headed `## [X.Y.Z] - YYYY-MM-DD`
     (the repo's own format). Its `publish.yml` cuts the release notes from exactly that `## [X.Y.Z]`
     section; a `### [X.Y.Z]` heading yields none, and the release reads only "See CHANGELOG.md".
3. **Commit, tag, push.** Stage exactly the release files (`git add package.json
   CHANGELOG.md`, in lt-monorepo plus `scripts/check.mjs`, in ng-base plus every file
   `pnpm run version:sync` wrote, see the ng-base recipe), then:

   ```bash
   git commit -m "chore(release): X.Y.Z"
   git tag -a vX.Y.Z -m "chore(release): X.Y.Z"
   git push origin main
   git push origin refs/tags/vX.Y.Z
   ```

   The tag is annotated like every earlier release tag. The push goes in two steps
   (nuxt-base-starter step 4 has the reason); pick the channel with the push-channel
   rule above.

### lt-monorepo (template, not an npm package)

1. Maintenance (`/lt-dev:maintenance:maintain`) → `pnpm run check` green.
2. `git add . && git commit -am 'MESSAGE'`.
3. Release commit, tag and push as in "Release commit for the templates" above
   (HTTPS fallback applies).
4. GitHub release by hand: no workflow creates it here, and every version since 3.10.0
   has one. After the tag push, `gh release create vX.Y.Z --verify-tag --title X.Y.Z
   --notes-file <notes>`, with notes written for consumers (SKILL.md, "Release notes
   are for CONSUMERS"). `--verify-tag` aborts when the tag push did not land, instead
   of creating a lightweight tag on the remote.

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
4. Stage the paths this update changed (`git add <paths>`, never `git add .`: the checkout can
   hold a live session's uncommitted work) → commit (message from diff analysis) → release
   commit, tag and push as in "Release commit for the templates" above. The push of commit
   and tag goes **in two steps**, never as one combined `git push --follow-tags`:

   ```bash
   git push origin main
   git push origin refs/tags/vX.Y.Z
   ```

   Pick the channel with the push-channel rule above — **do not assume HTTPS.**
   The combined `git push --follow-tags origin main`, which the repo's release
   script ran at the time, was refused at v2.25.0 (2026-09-02).
   **Why it was refused is unmeasured.** This skill used to blame an empty SSH
   agent — but that is the exact false negative `ssh-add -l` produces here, and on
   2026-09-04 the functional check reported `ssh … push normally` with two keys in
   the 1Password agent. A force-push guard on `--follow-tags` is the other
   candidate, and that guard did exist: lt-dev's own `block-dangerous-bash.sh`
   matched `-f` as a substring and denied a typed `git push --follow-tags origin
   main` as a force push (measured 2026-10-09 on the lt-monorepo v3.15.1 release;
   fixed since, the flag must now be a whole token). Whether it caused v2.25.0 is
   still open: the hook reads only the command typed into the tool, so it can deny
   a direct `git push --follow-tags`, but not the push inside that script.
   The two-step push worked at v2.25.0 and v2.25.1 — use it, and leave the cause
   open instead of repeating a guess.
5. **Then stop — the GitHub release makes itself.** A workflow reacts to the tag
   push and creates the release. A follow-up `gh release create vX.Y.Z` fails with
   `HTTP 422: Release.tag_name already exists` — within seconds and reliably, so it
   is the workflow having won, not a race and not an error. Verify with
   `gh release view vX.Y.Z` plus both workflows (Release, Tests) green, **never**
   from the exit code of your own `create` call: it reports failure on a release
   that exists, and a session reading that as "the release did not happen" will
   try to fix a release that is already live. Measured 2026-09-04 on v2.25.1.

### ng-base (npm package `@lenne.tech/ng-base`; Angular frontend library, consumed by ng-base-starter)

> **The MAJOR digit is the Angular major** (`22.x` is Angular 22), the way nuxt-extensions' tracks Nuxt.
> **The tag carries a `v`, the npm version does not:** tag `v22.0.0`, package `22.0.0`, unlike
> nuxt-extensions' bare `1.25.0`. Vendor mode clones the tag `v<version>`, so a missing or
> differently spelled tag breaks every vendored project's update.

**The repo states its own recipe** in the header comment of `.github/workflows/publish.yml`. Read it first:
where it differs from the steps below, the workflow wins, because it is what runs on the tag.

1. Maintenance (`/lt-dev:maintenance:maintain`, when the step-2 answer asks for it) → `pnpm i` →
   `pnpm run check` green. Then commit the release content: stage the paths the release carries, the
   lockfile included (`git add <paths>`, never `git add .`: the checkout can hold a live session's
   uncommitted work), with a conventional message. `publish.yml` installs with a frozen lockfile and checks
   the tagged commit, so whatever stays uncommitted is not in the release.
2. **Version.** Raise `version` in the root `package.json`, then `pnpm run version:sync`. It writes the
   version into `projects/ng-base/package.json` (the manifest published from `dist/ng-base`) **and** into the
   `LT_NG_BASE_VERSION` constant in the library's `version.ts`. `pnpm run version:check` confirms all of them
   agree, and `git status --short` then lists every file the sync changed: all of them go into the release
   commit. A `version.ts` left out keeps the local `check` green (the synced file sits in the working tree)
   while `publish.yml`'s `check:raw` fails on the tag, after the tag is already public.
3. CHANGELOG section (`## [X.Y.Z] - YYYY-MM-DD`), commit, annotated tag `vX.Y.Z` and the two-step push as in
   "Release commit for the templates" above. Before the tag, `git status --short` shows no version file left
   behind.
4. **Then stop: the tag does the rest.** On `v*`, `.github/workflows/publish.yml` checks that the tag matches
   the version, runs `check:raw`, publishes `dist/ng-base` to npm with provenance, and creates the GitHub
   release from the CHANGELOG section. A `gh release create` of your own would collide with it. Verify with
   `gh run list --workflow publish.yml` green, `gh release view vX.Y.Z`, and
   `curl -s -o /dev/null -w '%{http_code}' https://registry.npmjs.org/@lenne.tech/ng-base/X.Y.Z` answering
   200 (version without `v`). A run that failed for a passing reason (runner, registry) is re-run; one
   that failed on the tagged content cannot pass on a re-run and needs the fix in the next patch version.
   A published tag is never moved or deleted: vendored projects may already have cloned it.

### ng-base-starter (template; consumes ng-base)

Released like nuxt-base-starter: an annotated tag `vX.Y.Z` plus a GitHub release, no npm package. Its
version is SemVer of its own within the Angular major (it starts at `22.0.0`), with no lock-step to
ng-base. Unlike nuxt-base-starter it is **flat**: the repository root is the app, with `package.json`
and `pnpm-lock.yaml` at the root and no `*-template/` folder.

0. **Wait** until `@lenne.tech/ng-base@<version>` resolves on the version-specific endpoint (see the
   propagation rule above).
1. Pin the new version **exactly** (`"@lenne.tech/ng-base": "X.Y.Z"`, no range) in the root
   `package.json`, then `pnpm i`.
2. Maintenance (`/lt-dev:maintenance:maintain`, when the step-2 answer asks for it) → `pnpm run check`
   green, and `pnpm run test:e2e` before UI-library bumps, as in nuxt-base-starter.
3. **Gate: the starter resolves ng-base from the registry.** Local integration may run on an injected
   `file:` dependency (`"file:../ng-base/dist/ng-base"` plus `dependenciesMeta.injected`), and that must never
   ship: every project cloned from the template would point at a folder that does not exist there. Before the
   tag, all three hold, otherwise nothing is released:

   ```bash
   node -e 'const p=require("./package.json"); const v=(p.dependencies||{})["@lenne.tech/ng-base"];
     if (!/^\d+\.\d+\.\d+$/.test(v||"")) { console.error("ng-base pin is not a published version: "+v); process.exit(1) }
     if ((p.dependenciesMeta||{})["@lenne.tech/ng-base"]) { console.error("dependenciesMeta still injects ng-base"); process.exit(1) }'
   # the lockfile names the package on one line and its specifier and version on the next two
   if grep -A2 -E "@lenne.tech/ng-base" pnpm-lock.yaml | grep -qE "file:|link:|workspace:"; then
     echo "pnpm-lock.yaml still resolves ng-base locally"; false; fi
   pnpm run check                                                                    # green against that version
   ```

   The pinned version answers 200 on the version-specific endpoint (step 0).
4. Stage the paths this update changed (`git add <paths>`, never `git add .`), with `CHANGELOG.md` kept out
   of this content commit (the ng-base-starter CHANGELOG rule above), commit, then the release commit, tag
   and two-step push as in "Release commit for the templates" above.
5. **Then stop: the GitHub release makes itself** from the tag (`.github/workflows/release.yml`), as in
   nuxt-base-starter step 5. Verify with `gh release view vX.Y.Z` and the workflows green.

### nest-server-starter (template; consumes nest-server)

**The starter follows nest-server, release for release** (Kai, 2026-11-03; the starter's
`CLAUDE.md` states the same rule):

1. **Same number.** `version` equals the `@lenne.tech/nest-server` version (step 1).
2. **Every nest-server version gets its starter version.** Each version published to npm is
   followed by the bump commit `Updated to nest-server version <X.Y.Z>` and its tag
   `v<X.Y.Z>`, also when the bump is the only change. nest-server's maintenance line
   (`release/11.x`, dist-tag `latest-11`) is followed on the starter branch of the same name:
   the steps below run there, and its push replaces the push to `main`. A route that skips
   the starter leaves a gap in the tag series; close it before the next release, one bump and
   one push per missing version, oldest first (`tag.yml` tags only the version of the pushed
   head).
3. **Nothing else changes the version.** Starter changes between two nest-server releases are
   committed and pushed with a normal message and leave `version` as it is: no patch bump, no
   starter-only release, no tag. They ship under the next nest-server version.

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
4. Commit the paths this update changed (`git add <paths>`, never `git add .`, as in
   nuxt-base-starter step 4): on a nest-server version change exactly
   `Updated to nest-server version <X.Y.Z>`, otherwise a normal message with
   `version` unchanged (rule 3: no bump, no tag) → push main (`release/11.x` for
   the maintenance line).
5. **Then stop — the tag makes itself.** `.github/workflows/tag.yml` fires on a push
   to `main` or a `release/**` branch that touched `package.json`, reads the version
   out of the manifest and pushes an annotated `vX.Y.Z` onto the bump commit. So do not reach for `git tag`
   because the tag series looks incomplete: the push comes back `already exists`, and
   a lightweight tag set locally before the workflow lands diverges from the annotated
   one on the remote (delete it, then `git fetch --tags`). Bump nothing a second time
   either: step 1 already set the version, and a release tool run on top of it raised
   the version twice (11.41.1 → 11.41.2).

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
- **What the bump commit contains differs per repo.** Both repos are worked in
  parallel more than most, because stack-wide findings are supposed to land here, so
  foreign uncommitted changes in the tree are the normal case rather than an edge one.
  - **`claude-code`** commits **only the version bump** on top of `HEAD` and refuses
    to start while anything is staged; it never sweeps the tree. The release content
    is what is already committed, so commit the final changes first, with explicit
    paths, then bump:

    ```bash
    bash "${CLAUDE_PLUGIN_ROOT}/scripts/change-provenance.sh"   # whose work is in the tree
    git add <final paths> && git commit -m "<conventional message>"
    npm run version:minor "<message>"
    ```

    Run the bump over uncommitted content and the release carries a version number
    without that content.
  - **`claude-code-internal`** still stages the whole tree (`git add .`), so a peer's
    uncommitted work rides along. Hold foreign paths out around the bump, and tell the
    affected sessions before the stash (`CONFLICT`) and after the pop (`READY`):

    ```bash
    git stash push -m "held out of <version>" -- <foreign paths>
    npm run version:minor "<message>"
    git stash pop
    ```

  Either way, decide per foreign group whether it is final before it ships.
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
  above); `claude-code-internal` → the self-hosted GitLab its `origin` names,
  where `gh` does not apply and no GitHub release is created.
- **Consumers:** `lt claude plugins` refreshes the marketplace cache and updates
  every plugin; a Claude Code restart applies it.
