---
name: maintaining-lt-stack
description: 'Single source of truth for stack-wide maintenance and releases of the lt base repos ("Grund-Repos"): the dependency graph (nuxt-extensions to nuxt-base-starter, nest-server to nest-server-starter), the release recipe per repo including both marketplaces, npm propagation waits, the push-channel check and its HTTPS fallback, and the smoke test as release gate. Activates on "maintain stack", "release all repos", "stack release", "Grund-Repos aktualisieren", and behind /lt-dev:publish. NOT for a single npm package (use maintaining-npm-packages). NOT for nest-server upgrades inside customer projects (use nest-server-updating).'
---

# Maintaining the lt Stack (all base repos)

The seven base repos are maintained and released in dependency order. Canonical
source is [github.com/lenneTech](https://github.com/lenneTech); releasing needs a
local clone of each, and that checkout path differs per machine — locate it instead
of assuming one:

```bash
find "$HOME" -maxdepth 5 -type d -name nest-server-starter -not -path '*/node_modules/*' 2>/dev/null
```

If a repo is not checked out anywhere, clone it into the same workspace directory as
its siblings. Target end state: every repo current, `check` green everywhere, npm
packages published, templates tagged — proven by a full
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
npm, not when the GitHub release exists — the publish.yml action takes minutes.

**Ask the version-specific endpoint, not `npm view`.** `npm view` and
`https://registry.npmjs.org/<pkg>` read the same CDN-cached packument, and it
lags minutes behind a publish:

```bash
curl -s -o /dev/null -w '%{http_code}' https://registry.npmjs.org/<pkg>/<version>
# 200 = resolvable now. Alternative: cache-bust with -H 'Cache-Control: no-cache' plus a query param.
```

Measured 2026-09-04: a session polled `npm view` for ten minutes and read "not
published yet" while `@lenne.tech/nest-server@11.41.0` had been up the whole
time — the version-specific endpoint answered 200 immediately. From the
caller's side "not there yet" and "the instrument is reading a cache" look
identical, which is why the endpoint is the one to ask.

## Running the waves across parallel sessions

The waves above say "parallelizable" and that is meant literally: one Claude Code session per repo, in its own terminal, is how a stack release actually goes fast. Wave 1 holds four independent repos and Wave 2 two more, so the wall-clock floor is one repo's release, not six in sequence.

That only works if the sessions coordinate on four things. All of it runs on the [`coordinating-peer-sessions`](${CLAUDE_SKILL_DIR}/../coordinating-peer-sessions/SKILL.md) protocol, and the split by repository is exactly the boundary that protocol asks for: no two sessions ever touch one working tree.

**1. Claim a repo before starting it.** Record it in the ledger first, then announce it:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/peer-ledger.sh" read                          # who already owns what
bash "${CLAUDE_PLUGIN_ROOT}/scripts/peer-ledger.sh" claim "repo:nest-server" "Wave 1 release"
```

The ledger part matters more here than anywhere else: a release round runs for hours, sessions come and go, and a claim that lives only in a message is lost the moment its terminal closes. `claim` refuses a repo another **live** session holds and names it; a claim whose session died reads `[stale]` and is free to take, so a crash never strands a repo. Release with `peer-ledger.sh release "repo:nest-server" "<version>"` when the repo is out. Without any of this, two sessions release `nest-server` and the second mints a version over the first.

```
[CLAIM] nest-server — taking the Wave 1 release for this repo.
Betrifft: the stack release; nobody else should version or publish it.
Nötig: pick a different Wave 1 repo.
Frei: when I report READY with the published version.
```

**2. Signal Wave 2 with `READY`, do not make it poll.** The wait between waves is a real npm propagation delay, and the session waiting on it has no way to know the moment it clears except by asking the registry again and again. The publishing session knows exactly when. It sends one `READY` with the version:

```
[READY] @lenne.tech/nuxt-extensions@5.4.1 is published and resolvable on the registry.
Betrifft: nuxt-base-starter — the Wave 2 dependency bump can start.
Nötig: pnpm add @lenne.tech/nuxt-extensions@5.4.1 and continue.
```

The Wave 2 session may also subscribe with `notify_when_idle` on the Wave 1 session instead of polling. Either way, nobody sits in a `sleep` loop against the registry.

**3. Send `SOLVED` for anything environmental.** The empirical pitfalls in this skill are almost all machine-wide, not repo-specific: a remote read that silently returned nothing, a registry that has not propagated, a CI runner queue backing up, a toolchain version that broke. The first session to diagnose one has already paid for it, and the other five are walking into the same wall. One `SOLVED` and they do not.

```
[SOLVED] `git ls-remote` fails on stderr with empty stdout, so tag checks read as "no tags".
Betrifft: every repo in this release round; your tag verification lies the same way.
Nötig: check the exit code, or read over HTTPS — see the push-channel rule.
```

**4. Report the finish with `LANDED`, so the smoke test starts once.** The validation gate runs after every repo is out. Whoever finishes last starts it; the others say so and stop.

What does **not** go over messages: which repos exist and in which order they go (this skill says so), and which version a repo is on (the registry and the tags say so). And no session assigns another one a repo. The user decides who takes what, or each session claims a free one and says which.

## Cross-cutting rules (all repos)

- **Wire-critical packages move in BOTH framework repos, in one go.** Some
  dependencies are not one repo's business — they are one protocol with two
  ends, and nest-server and nuxt-extensions each own one end. `better-auth` is
  the case that taught us; treat any package both frameworks import the same
  way.

  Both declare it as a **peer** with a range that is byte-identical in the two
  manifests, and narrow: `>=<lowest known-good> <<next minor>`, never `^`.
  better-auth breaks in MINOR releases, so a caret invites the same split one
  release later. Read the current range out of the manifests rather than from
  here — it moves, and a version written into this skill is a version that goes
  stale:

  ```bash
  node -e 'for (const p of ["nest-server","nuxt-extensions"]) console.log(p, require(`${process.env.HOME}/code/lenneTech/${p}/package.json`).peerDependencies["better-auth"])'
  ```

  Bumping it means: raise the range in nest-server AND nuxt-extensions, pin the
  new version in nest-server-starter AND nuxt-base-starter, release all four.
  Never half of it, not even "just to unblock the frontend". Raising only the
  LOWER bound is a bump too — it is what says which patch is known-good, and a
  lower bound that disagrees between the two repos is the same defect as a
  version split, one release earlier.

  **The floor is not a matter of taste: it must satisfy the SIBLING peers too.**
  A package like `better-auth` ships with companions (`@better-auth/passkey`,
  `@better-auth/core`) that peer-require a version of it in turn. A floor below
  what a companion demands blesses a pairing that cannot actually install —
  `>=1.7.0` allowed better-auth 1.7.0 next to passkey 1.7.1, which passkey
  itself rejects (`^1.7.1`). The range was not wrong in general; it admitted
  exactly one invalid cross-combination, which is precisely the kind that no
  install in either repo would ever hit. Derive the floor from the companion's
  manifest, not from intuition:

  ```bash
  node -e 'console.log(require("./node_modules/@better-auth/passkey/package.json").peerDependencies)'
  ```

  nuxt-extensions asserts this mechanically in `test/peer-dependency-ranges.test.ts`
  (floor vs. the companion's requirement, and every range against the devDependency
  actually tested against). Worth copying wherever a peer range has companions.

  What a split costs, measured: nest-server pinned better-auth 1.6.26 as a hard
  dependency while nuxt-extensions declared a peer, so the app moved to 1.7.1
  and the api could not follow. 1.7 gives `twoFactor.enable` a discriminated
  result carrying `method`, which 1.6.26 never sends — every 2FA activation in
  every fullstack project failed, with a generic client error and nothing
  unusual in the server log. Both repos' `check` was green the whole time:
  each was internally consistent, and only the assembled workspace has both
  halves.

  Three guards catch it today, and none of them replaces this rule — they catch
  the mistake, the rule prevents it:

  - **When the manifests are merged** (lt CLI `hoist-workspace-pnpm-config.ts`,
    since 1.45.0). The hoist is last-writer-wins, which is right for root-vs-sub
    and a trap between siblings. Reported: two sub-projects setting one key
    differently in the same run; the incremental case (`add-api` then `add-app`,
    where the earlier run already hoisted and emptied its source); and a repo
    contradicting ITSELF across `package.json#pnpm` and its own
    `pnpm-workspace.yaml`. `allowBuilds` is not merely reported but **merged
    deny-wins** — a warning does not stop an install script that one project
    explicitly refused, and `overrides` stays report-only because there is no
    safe direction for a version.
  - **In the assembled workspace** (`lt-monorepo/scripts/check-workspace-consistency.mjs`,
    since 3.10.0). Fails when api and app resolve a wire-critical package
    differently, when the two frameworks promise different peer ranges, or when a
    member has the package installed but pins it nowhere — `autoInstallPeers`
    defaults to true, so an unpinned peer agrees today and is free to drift on
    the next install.
  - **In behaviour** (`nuxt-base-starter/.github/workflows/test.yml`, job
    `e2e-auth`, green since 2.22.3). Boots MongoDB and nest-server-starter and
    runs the auth suite against a real API. The only layer that sees a broken
    contract rather than a version diff — the other one compares declarations,
    and declarations were green throughout the split.

    Two things it needs that are easy to miss, both found by its own first runs:
    the template's dependencies must be installed separately (it has its own
    lockfile, and its check chain starts with `cross-env` — one of its own
    devDependencies), and an empty database routes every visitor to `/auth/setup`,
    so the first admin has to be created via `POST /system-setup/init` before the
    suite runs.

  The smoke test is the end-to-end gate: it builds a real fullstack project, so
  it is the one place a wire split shows up as a failing flow rather than as a
  version diff.

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

- **Push channel:** ask the script, which decides it functionally:

  ```bash
  bash "${CLAUDE_PLUGIN_ROOT}/scripts/check-push-channel.sh" <repo-root>
  # -> ssh<TAB>github.com<TAB>authenticated as: Hi kaihaase! …
  # -> https<TAB>github.com<TAB>no SSH authentication (…)
  ```

  On `https`, push via HTTPS:
  `git -c credential.helper='!gh auth git-credential' push https://github.com/lenneTech/<repo>.git <branch>`.
  `gh release create` is unaffected either way.

  **Run the check when a push fails on what reads like a rights problem.** Measured
  2026-09-08 on nest-server-starter: `git push origin main` failed with `Please make sure you
  have the correct access rights and the repository exists`, while a push to nest-server over
  SSH worked in the same minutes. Nothing was wrong with the account, the collaborator status
  or the remote URL — SSH to github.com was dead for that path only, the check said
  `https<TAB>github.com<TAB>no response from github.com (timeout or unreachable)`, and the HTTPS
  fallback went through immediately. The message names the last thing git could think of, not
  the cause, and it is per-repo: a working push elsewhere proves nothing. Ask the script before
  investigating permissions.

  **Do NOT use `ssh-add -l` for this.** It is the obvious test and it is wrong here — measured
  2026-08-23, where it reported "The agent has no identities" while `ssh -T git@github.com`
  authenticated fine and had done all along. The reason: `~/.ssh/config` routes SSH to the
  1Password agent via

  ```
  Host *
      IdentityAgent "~/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"
  ```

  but **`IdentityAgent` is an `ssh(1)` option and `ssh-add` does not read `~/.ssh/config` at
  all** — it only ever talks to the agent in `$SSH_AUTH_SOCK`, which on macOS points at the
  (empty) launchd agent. So `ssh-add -l` interrogates an agent SSH never uses. On any
  1Password/IdentityAgent setup it is a permanent false negative, and every HTTPS fallback it
  triggered was unnecessary.

  To inspect the keys SSH really has, aim `ssh-add` at the configured agent instead:
  `SSH_AUTH_SOCK="$HOME/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock" ssh-add -l`.
  But prefer the functional check above — it stays correct regardless of how the agent is wired.

  **The same broken agent makes READ commands lie, not just pushes.** When the agent
  cannot sign, `git ls-remote` exits 128 and prints its complaint on **stderr** while
  stdout stays **empty**. A pipeline that only reads stdout — `git ls-remote --tags origin
  | wc -l`, or a `grep` for one tag — therefore reports "the remote has no tags" and
  "that tag does not exist", which reads exactly like a missing release rather than a
  failed connection. Measured 2026-08-23: two sessions independently concluded a release
  tag had not been pushed; over HTTPS the remote had all 132 tags including that one, and
  `git fetch --quiet` had been failing silently the whole time, so the remote-tracking
  refs were stale on top of it.

  So for any remote read: **check the exit code, or use HTTPS from the start.**

  ```bash
  git -c credential.helper='!gh auth git-credential' ls-remote --tags https://github.com/lenneTech/<repo>.git
  ```

  Never conclude "not on the remote" from an empty result you did not prove was a
  successful call. `git fetch` is the same trap wearing a quieter coat — with `--quiet`
  it fails without a visible word, and every later `origin/<branch>` comparison silently
  answers from stale local refs.

  And once the call DOES succeed, do not count its lines. `ls-remote --tags` prints two
  refs per annotated tag — `refs/tags/X` and the peeled `refs/tags/X^{}` — so `wc -l`
  reported 249 where this repo has 132 tags. Compare names, not line counts:

  ```bash
  … ls-remote --tags <url> | sed 's|.*refs/tags/||; s|\^{}$||' | sort -u
  ```

  The two failure modes stack: a broken agent turns a real list into "nothing", and a
  line count turns a matching list into a phantom difference. Both end as a confident
  claim about a remote nobody actually read.
- **Dependency maintenance:** per repo via the `/lt-dev:maintenance:maintain`
  command (FULL) — it raises the lenne.tech **frameworks first** (npm + vendor
  core), aligns their pinned ecosystem, and only then hands off to the
  `lt-dev:npm-package-maintainer` agent (skill `maintaining-npm-packages`) for
  the surrounding packages, iterating `check` to green. Framework-first is not
  optional: a CVE inside a framework-pinned dependency cannot be fixed with an
  `override`, only by raising the framework. Maintenance **never commits** (the
  orchestrator commits and releases in a controlled way). For a repo that IS a
  framework (nest-server, nuxt-extensions) the framework phase is a no-op and
  it degrades to plain package maintenance.
- **Never force-push/squash** where the flow does not call for it; the
  nest-server PR is merged explicitly WITHOUT squash (merge commit).
- **Version convention for npm packages:** set the version manually in
  `package.json`, then `pnpm i`/`npm i` (lockfile!), commit message exactly
  `NEW_VERSION: COMMIT_MESSAGE` (e.g. `1.11.0: update deps, fix X`).
- **Commit message:** the CONVENTION is non-negotiable — `NEW_VERSION: MESSAGE`
  for npm packages, conventional-commits for templates (so
  `commit-and-tag-version` derives the bump), and the fixed
  `Updated to nest-server version <X.Y.Z>` for a nest-server-starter version
  bump. `/lt-dev:git:commit-message` is the recommended helper for crafting the
  descriptive part — but it is a helper, not a gate: skip it when the change
  already dictates an obvious, convention-compliant message (a focused one-line
  fix, or the fixed starter message). How you arrive at the wording is free;
  the convention is not.
- **Language:** every published artifact — release notes, commit messages,
  PR bodies, migration guides, descriptions — is written in **English**.
- **Release notes are for CONSUMERS, not for the log.** Audience: developers
  who use the release in their projects. Structure: (1) what is this? (one
  sentence, e.g. "Maintenance release — no API changes"), (2) how do I
  update? (copy-paste command), (3) **do I need to do anything?** (concrete
  checks with before/after — the most important part), (4) optional "Under
  the hood" in 1–2 sentences. Keep out of the notes: raw package version lists,
  test counts / "checks green" status, internal override surgery — that
  belongs in the CHANGELOG / migration guide. Link the migration guide
  instead of duplicating it. Leave time estimates ("takes ~5
  minutes") out of release texts and migration guides — they are usually wrong;
  describe the effort qualitatively ("no code changes for most projects").
- **Tag convention:** `gh release list` shows the repo's pattern
  (nuxt-extensions/nest-server/cli: bare `X.Y.Z`; the templates tag `vX.Y.Z`
  through their release scripts) — follow the existing pattern.

## Recipes per repo

Read [recipes.md](recipes.md) before releasing any single repo: it holds the numbered release steps and version-number rules for nuxt-extensions, nest-server (incl. the `publish.yml` job split), lt-monorepo, lt CLI, nuxt-base-starter, nest-server-starter, and the two marketplace repos (`claude-code`, `claude-code-internal`).

## Single-repo fast path (`/lt-dev:publish`)

The same recipes serve a second entry point: publish ONE repo's changes
quickly and update only its downstream chain (nest-server →
nest-server-starter; nuxt-extensions → nuxt-base-starter). The target repo
is auto-detected from the current working directory (origin remote matched
against the six stack repos plus the two marketplace repos) or passed
explicitly. Differences to the full
cycle: uncommitted changes in the source repo are the payload (not a
preflight error — but stop on unrelated-looking files); maintenance is an
interactive gate — the command ASKS "publish directly" vs. "maintain first"
(`/lt-dev:maintenance:maintain`) rather than auto-running it; the smoke test is
opt-in instead of mandatory; and the chain ends after the direct consumers.
Everything else — the no-change gate, commit-message convention, release-note
conventions, propagation waits — applies unchanged.

## Validation: smoke test as release gate

After wave 2, run `/lt-dev:fullstack:smoke-test` (full run incl.
TurboOps deploy + online checks + residue-free cleanup). Every finding is a
base-repo fix → patch the causing repo → run its recipe again (patch
release) → repeat the smoke-test phase until clean.

The smoke test clones the templates from GitHub (`main`), so fixes take
effect only after commit+push/release of the affected repo, never from the
local working tree.

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

## Diagnosing a slow release

Read [release-performance.md](release-performance.md) when a publish run looks slow: it separates runner queue time from work, attributes the work to steps, and records where a nest-server publish actually spends its time.

## Pitfalls (empirical)

- **check green ≠ release ready:** nuxt-extensions has its own `release`
  script gates (format/lint/version:check/test:types/test) — verify them
  before tagging.
- **Same-day majors:** pnpm 11's default 24h release-age gate may silently
  write a `minimumReleaseAgeExclude` entry for a fresh third-party major into
  `pnpm-workspace.yaml`. Never commit such an entry into a template — defer
  the update instead (the entry is dead weight once the package ages past the
  gate).
- **Starter lockfiles:** after bumping a dependency in the template, also
  run `pnpm i` there (the template has its OWN lockfile next to the repo
  root's).
- **Agent memory:** follow the [`managing-agent-memory`](../managing-agent-memory/SKILL.md)
  skill — it resolves the repo's commit policy (asking at most once, then
  remembering the answer in `.claude/settings.local.json`) and curates the notes
  before they are staged. Never leave them in unstaged limbo.
- **Release scripts that push themselves** (nuxt-base-starter `release`): their
  embedded `git push --follow-tags` was refused at v2.25.0 for a reason nobody has
  measured — run the version tool directly and push commit and tag yourself, in
  two steps, on the channel the push-channel rule picks.
- **Husky/simple-git-hooks** run on every commit (lint) — a red hook is a
  real finding, never bypass with `-n`.

## Related Skills & Commands

- Command `/lt-dev:maintenance:maintain` — FULL per-repo maintenance
  (frameworks first, then packages) run before each release; never commits.
- Command `/lt-dev:git:commit-message` — recommended helper for crafting a
  convention-following commit message (helper, not a mandatory gate).
- Skill `maintaining-npm-packages` — the 5 maintenance modes (agents use FULL);
  also the right skill for a single npm package outside a stack release.
- Skill `nest-server-updating` — nest-server upgrades inside customer projects,
  as opposed to releasing the base repos here.
- Skill `managing-agent-memory` — the per-repo commit policy for agent-memory
  notes before a release commit.
- Skill `developing-claude-plugins` — the plugin rules behind the marketplace
  release gate (`claude plugin validate`).
- Skill `running-check-script` — iterate `check` until green.
- Command `/lt-dev:fullstack:smoke-test` — the release gate.
- Skill `deploying-to-turboops` — deploy contract + Trap 5 (Turbo-Dev Traefik).
- Skill `coordinating-peer-sessions` — the message protocol behind the parallel
  wave execution above (CLAIM per repo, READY between waves, SOLVED for
  environmental findings).
