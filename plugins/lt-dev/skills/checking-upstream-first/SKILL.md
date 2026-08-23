---
name: checking-upstream-first
description: 'Before writing a custom fix for a framework- or library-level problem, verifies that the current version does not already solve it. Covers the version check (installed vs latest), reading the dependency''s own code, release notes and issue tracker, and the lt base-repo check. Activates whenever a workaround, shim, patch, wrapper, polyfill or guard is about to be built around a dependency''s behaviour, and on "wir bauen uns das selbst", "workaround", "patchen", "eigene Lösung". NOT for feature work the dependency was never meant to cover. NOT for routine version bumps (use maintaining-npm-packages).'
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

### 4. The lt base repos

For anything in the lt stack, check whether a base repo already solved it before solving it in
a customer project — `nest-server`, `nest-server-starter`, `nuxt-extensions`,
`nuxt-base-starter`, `lt-monorepo`, `cli`. A fix that belongs in a base repo and lands in a
customer project instead is inherited by nobody and re-discovered by everybody.

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
