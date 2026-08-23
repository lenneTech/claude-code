---
name: checking-upstream-first
description: 'Before writing a custom fix for a framework- or library-level problem, verifies that the current version does not already solve it. Covers the version actually resolved vs. the current one, reading the dependency''s own code in node_modules, release notes and issue tracker, and whether an lt base repo already solved it. Activates whenever a workaround, shim, patch, wrapper, polyfill or guard is about to be built around a dependency''s behaviour, and on "workaround", "patchen", "wir bauen uns das selbst", "eigene Lösung". NOT for feature work the dependency was never meant to cover. NOT for routine version bumps (use maintaining-npm-packages).'
---

# Check Upstream Before Building It Yourself

The most expensive code is the code that did not need to be written. A workaround built around a
dependency's behaviour has to be designed, reviewed, tested, documented, and then carried
forever — and if the dependency already fixed it, all of that is waste that also has to be
un-built later.

## When This Skill Activates

Any time the plan is to work *around* something rather than *with* it:

- A shim, polyfill, wrapper, patch, guard, or "our own version of X"
- A `patch-package` entry, a vendored copy of third-party code, a monkey-patch
- Re-implementing behaviour a framework already owns (routing, hydration, form state,
  serialisation, auth, validation)
- Any sentence of the form "the framework doesn't do X, so we…"

**And — just as often missed — any time a file that CAME FROM a base repo is about to be
edited**, whatever the reason: a bug in it, a gap in it, a tweak to it. Not only workarounds.
These files arrive with a project and then quietly diverge, so the version in front of you is
a snapshot of the template on the day the project was created, not the template as it is now.
Both halves of the stack are affected the same way — the frontend is not the exception:

**Backend, `projects/api/` (from `nest-server-starter`, `nest-server`):**

- `Dockerfile`, `docker-entrypoint.sh`, `.dockerignore`, `.gitlab-ci.yml`
- `tsconfig*.json`, `nest-cli.json`, `.oxlintrc.json`, `vitest*.config.ts`
- `scripts/**` (`check.mjs`, `check-envs.sh`, `check-server-start.sh`), the `check:*` /
  `copy:*` / `migrate:*` chains in `package.json`
- `src/config.env.ts`, `.env.example`, `src/main.ts`, `src/server/server.module.ts`,
  `migrations/**`
- Anything under a vendored `src/core/`

**Frontend, `projects/app/` (from `nuxt-base-starter`, `nuxt-extensions`):**

- `Dockerfile`, `.dockerignore`, `.gitlab-ci.yml`
- `nuxt.config.ts`, `app/app.config.ts`, `app/app.vue`, `app/error.vue`, `openapi-ts.config.ts`
- `tsconfig*.json`, `oxlint.json`, `.oxfmtrc.jsonc`, `vitest.config.ts`, `playwright.config.ts`
- `scripts/**` (`check.mjs`, `check-server-start.sh`, `generate-types.mjs`,
  `resolve-api-url.mjs`), the `check:*` chain in `package.json`
- `.env.example`, `server/**` (Nitro routes and plugins), `app/middleware/**`, `app/layouts/**`
- Anything under a vendored `app/core/`

**Monorepo root (from `lt-monorepo`):** `docker-compose.yml`, the root `package.json` scripts,
`scripts/**`.

It does NOT apply to ordinary feature work the dependency was never meant to cover.

## The Rule

**Do not build a workaround until you have checked, in this order, that no one upstream has
already solved it — and recorded what you found.**

Skipping the check is not a time saving. It moves the cost from ten minutes of research to a
full design-and-review cycle plus permanent maintenance.

## The Check

### 1. Installed version vs. current version

The single most common cause of a needless workaround is a dependency that is simply behind.

```bash
node -e "console.log(require('<pkg>/package.json').version)"   # what is actually resolved
npm view <pkg> version                                          # what exists
```

Check what is *resolved*, not what `package.json` requests — a transitive pin or a monorepo
hoist can hold a package back while the range looks current. In pnpm workspaces, grep the
lockfile: a package can resolve differently per project.

### 2. Read the dependency's own code

Faster and more reliable than searching for prose about it. The behaviour you are about to
work around is a few lines in `node_modules`, and reading them answers the question exactly —
including the edge the docs do not mention.

```bash
grep -n "<the symbol you care about>" node_modules/<pkg>/dist/*.js
```

### 3. Upstream tracker and release notes

Search the dependency's issue tracker and changelog for the symptom, not for your intended
solution. Look for: a merged PR (which version shipped it?), an open issue (is it triaged,
assigned, milestoned?), and any deliberate scope limit — a fix that covers half the cases is
the case most likely to be missed.

### 4. The lt base repos — in their CURRENT state, not the one the project was born with

For anything in the lt stack, check whether a base repo already solved it before solving it in
a customer project — `nest-server`, `nest-server-starter`, `nuxt-extensions`,
`nuxt-base-starter`, `lt-monorepo`, `cli`. A fix that belongs in a base repo and lands in a
customer project instead is inherited by nobody and re-discovered by everybody.

**Know which repo the file came from.** Backend and frontend have separate lineages, and the
frontend one is the one people forget. All repos are public under
[github.com/lenneTech](https://github.com/lenneTech):

| The file lives in | Base repo | Branch | Path inside the repo |
|---|---|---|---|
| `projects/api/**` | [nest-server-starter](https://github.com/lenneTech/nest-server-starter) | `main` | same path, at the repo root |
| `projects/api/src/core/**` (vendored) | [nest-server](https://github.com/lenneTech/nest-server) | `develop` | `src/core/**` — plus the flatten-fix, see `nest-server-core-vendoring` |
| `projects/app/**` | [nuxt-base-starter](https://github.com/lenneTech/nuxt-base-starter) | `main` | same path, but **under `nuxt-base-template/`**, not at the repo root |
| `projects/app/app/core/**` (vendored) | [nuxt-extensions](https://github.com/lenneTech/nuxt-extensions) | `main` | `src/runtime/**` — flat, no rewriting, see `nuxt-extensions-core-vendoring` |
| monorepo root (`docker-compose.yml`, root `package.json`, root `scripts/**`) | [lt-monorepo](https://github.com/lenneTech/lt-monorepo) | `main` | same path, at the repo root |

**Read GitHub, not a local checkout.** Not everyone has the base repos cloned, those who do keep
them in different places, and a clone is only as current as its last pull — a repo that fixed the
problem last month looks exactly like one that never had it. GitHub is the same for everyone and
always current, so it is the reference. Read the file the project version came from, rather than
searching for prose about it:

```bash
# backend: compare a project file against its base-repo original
curl -fsSL https://raw.githubusercontent.com/lenneTech/nest-server-starter/main/<file> \
  | diff - projects/api/<file>

# frontend: note the nuxt-base-template/ segment
curl -fsSL https://raw.githubusercontent.com/lenneTech/nuxt-base-starter/main/nuxt-base-template/<file> \
  | diff - projects/app/<file>
```

`curl -fsSL` fails loudly on a 404 instead of piping a GitHub error page into the diff.

To find out what a repo actually contains, list it and search it rather than guessing filenames:

```bash
gh api repos/lenneTech/nest-server-starter/contents/scripts --jq '.[].name'
gh api repos/lenneTech/nuxt-base-starter/contents/nuxt-base-template/scripts --jq '.[].name'
gh search code --repo lenneTech/nest-server-starter "<the symbol you care about>"
```

Without `gh`, the same listing works over the plain API
(`curl -fsSL https://api.github.com/repos/lenneTech/<repo>/contents/<dir>`), and `WebFetch` on the
GitHub file view answers a single-file question.

Mind the branch: `nest-server` releases from `develop`, the others from `main`. A raw URL against
the wrong branch returns 404, which says nothing about whether the repo has the file.

A local clone, where one exists, is a shortcut and not the source. Run `git pull --ff-only` in it
first, and when its answer decides anything, confirm it against GitHub.

**When the base repo has it: adopt, do not re-derive.** Copy the solution over, keep the
comment that explains it, and note any deliberate deviation in the project's own comment. A
re-derived fix that solves the same problem differently is worse than no fix at all in the long
run: the next `lt fullstack update` overwrites it, and the reasoning behind the divergence is
gone. What the base repo already carries has also been reviewed, released, and run in other
projects — a private version has none of that behind it.

**When it does not have it: fix it there, then adopt.** Same reasoning in the other direction.

#### Why this one is easy to skip

The base-repo check is the step people drop under time pressure, and time pressure is exactly
when a project is being repaired. A real case: a production deploy failed because the container
could not migrate (`Cannot find module 'ts-node'` — migrations were shipped as `.ts` and the
compiler needs `ts-node`, a devDependency pruned from the production tree). Under pressure the
"obvious" fix went in: move `ts-node` and `typescript` into `dependencies`.

`nest-server-starter` had solved it long before — by compiling the migrations
(`tsconfig.build.json` includes `migrations/`), so the production image needs no TypeScript at
all. The quick fix would have shipped a compiler into every production image, and it would have
been silently overwritten by the next template sync. Ten minutes of reading beat it on every
axis.

One detail from that case worth copying: the search was `find . -name "entrypoint*.sh"`, which
found nothing, and "nothing found" was read as "the base repo does not have it". The file is
called `docker-entrypoint.sh`. **A negative result from one search pattern is not evidence of
absence** — list the directory, search the content, read the `package.json` scripts. Two ways to
hit the same wall against GitHub: a raw URL on the wrong branch (`nest-server` releases from
`develop`) and the frontend path offset, where everything sits under `nuxt-base-template/` and a
URL against the `nuxt-base-starter` repo root 404s for every file in the repo.

The case above is a backend one, but nothing in it is backend-specific. The worked example at
the end of this skill is the same story on the frontend side — a Nuxt/Vue workaround built in a
customer project and then generalised into `nuxt-extensions`, where reading upstream first would
have cut it to a fraction of its size.

## Deciding After the Check

| What you found | What to do |
|---|---|
| Fixed in a newer version | Upgrade. Do not build anything. Remove any existing local workaround in the same change. |
| Fixed in a base repo | Adopt the base repo. Do not build anything. |
| Fixed upstream but **partially** — a documented scope limit | Build only for the uncovered part, and pin the covered part with a test (below). |
| Open upstream, no fix | Building is justified. Link the upstream issue in the code. |
| Never in scope upstream | Ordinary feature work. Build it. |

## When You Do Build: Make It Removable

A justified workaround is still temporary. Give it a removal signal so it does not outlive its
reason:

- **Link the upstream issue or PR in the code**, with the version that shipped any partial fix.
- **Pin the current upstream behaviour in a test.** When upstream widens its fix, that test
  fails — which is the notification to delete the workaround. A comment saying "remove when
  fixed upstream" is not a notification; nobody re-reads it.
- **Say it is a stopgap** in the code, the CHANGELOG entry, and the option's documentation, so
  a consumer knows it is expected to disappear.

## Record the Finding

Whether you build or not, write down what you learned — the next person must not repeat the
research:

- In the ticket or MR: installed version, current version, the upstream issue/PR, and what it
  does and does not cover.
- In an agent-memory note when it will matter again (see `managing-agent-memory`).
- Where a version floor is now load-bearing, say so next to the dependency, not only in prose.

## Worked Example

A pre-hydration input bug: text typed before a Nuxt page hydrated was silently erased by
`v-model`'s mounted write. A component-level `readonly` guard was built in a customer project,
then generalised into `nuxt-extensions` as a build-time wrapper around three Nuxt UI
components, with a Vite `resolveId` plugin, generated templates, and an `@nuxt/ui`
devDependency.

Reading `node_modules/@vue/runtime-dom` afterwards took two minutes and showed that Vue 3.5.41
already adopts the typed value into the model on hydration — but only for `type="text"` and
`textarea`. The customer project was on Vue 3.5.34, which is why the bug was real there.

Outcome after the check: the wrapper architecture was deleted, the base repo kept a ~60-line
plugin for the input types Vue's fix deliberately excludes (`email`, `password`, `tel`, `url`,
`search`, `number` — a sign-in form, in other words), and a test pins Vue's current gate so the
plugin's removal is triggered automatically when upstream widens it.

The check would have cost minutes at the start. Skipped, it cost a full design, review, and
rewrite cycle.
