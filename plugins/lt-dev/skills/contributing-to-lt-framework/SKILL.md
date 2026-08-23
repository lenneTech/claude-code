---
name: contributing-to-lt-framework
description: 'Guides local development on the lenne.tech framework libraries themselves (@lenne.tech/nest-server, @lenne.tech/nuxt-extensions) and validating those changes from a consuming starter project via `pnpm link`. Activates when the user wants to modify or contribute to nest-server / nuxt-extensions, or mentions "pnpm link" or "test framework locally". NOT for consuming frameworks inside a project (use generating-nest-servers or developing-lt-frontend). NOT for vendored-core workflows (use nest-server-core-vendoring or nuxt-extensions-core-vendoring). NOT for npm version upgrades (use nest-server-updating).'
---

# Contributing to the lt Framework

Framework-level development happens in the **framework repositories**, not in consuming application code. This skill covers the round-trip: edit framework source → link into a starter → run/test → unlink → prepare an upstream contribution.

## When This Skill Activates

- Modifying `@lenne.tech/nest-server` or `@lenne.tech/nuxt-extensions` source code
- Validating a framework change by exercising it from `nest-server-starter` or `nuxt-base-starter`
- Setting up or tearing down `pnpm link` between a framework repo and a starter
- Preparing a pull request against `nest-server` or `nuxt-extensions`

## Skill Boundaries

| User Intent | Correct Skill |
|-------------|---------------|
| "Modify @lenne.tech/nest-server itself" | **THIS SKILL** |
| "Change @lenne.tech/nuxt-extensions source" | **THIS SKILL** |
| "Link framework locally for testing" | **THIS SKILL** |
| "Build a feature in my app" | generating-nest-servers / developing-lt-frontend |
| "Update nest-server version in my project" | nest-server-updating |
| "Sync vendored core from upstream" | nest-server-core-vendoring / nuxt-extensions-core-vendoring |
| "Open a PR with my vendored-core change" | nest-server-core-vendoring → `nest-server-core-contributor` agent |

## The Base Repos ("Grund-Repos")

When the user says **"Grund-Repos"** (or "base repos" / "the foundation repos"), they mean **exactly these seven** — the repositories every customer project inherits from:

| Repo | Role |
|------|------|
| `nest-server` | Backend framework source |
| `nest-server-starter` | Backend template → `projects/api` |
| `nuxt-extensions` | Frontend library source |
| `nuxt-base-starter` | Frontend template → `projects/app` |
| `lt-monorepo` | Fullstack monorepo template |
| `cli` | The `lt` command line (`lt dev`, `lt ticket`, `lt fullstack`, …) |
| `lt-dev` | This Claude Code plugin (`claude-code/plugins/lt-dev`) — commands, agents, skills |

All are cloned from `github.com/lenneTech/` and live side by side in one directory on the user's machine (ask for the path, or detect it — do not hardcode). `lt-dev` is a subdirectory of the `claude-code` marketplace repo, not a repo of its own.

### The rule that makes them matter

**A defect that every project in the stack would inherit belongs in the base repo — not (only) in the customer project.** A local patch fixes one project; the base repo fixes every project that will ever be created.

Two consequences, both easy to get wrong:

1. **Look upstream BEFORE building your own.** When a project-level problem looks structural (test setup, dev-server orchestration, config layout, auth wiring), first check whether the base repo already solved it. Reinventing it locally creates a divergence that breaks on the next framework update — and the base repo's version is usually the better-tested one.
   *Real case:* a customer project's API test suite kept failing at random under parallel runs because all working copies shared one e2e database that the global setup drops on start. `nest-server` and `nest-server-starter` had solved this long before (a database per test RUN, plus a lifecycle reporter that cleans up). The project had simply never adopted it. The fix was to port the framework solution — not to invent a third scheme.
2. **Push project-grown improvements back up.** A guard, fix, or hardening that was written in a project because the framework lacked it is a **contribution owed upstream** (see the workflows below). Same case: the project had a safety guard refusing to drop a database that is not recognizably a test DB — the base repos did **not** have it, and without it a running `lt dev` session (which points `MONGODB_URI` / `NSC__MONGOOSE__URI` at the DEVELOPMENT database) would let a test run wipe the developer's data.

## Parallel sessions on the base repos

Base-repo work is the one place in this stack where **Git shows a parallel session nothing at all.** The house rule is to work directly on the checked-out branch and leave the change uncommitted for the user to integrate, so there is no commit, no branch, and no push for anyone else to read. Meanwhile a `pnpm build` in the framework repo republishes `dist/` to **every** linked consumer on the machine, including the starter that a completely different session is running tests against.

That produces the two failures worth naming:

1. **A session sees foreign changes appear in its own working tree** and cannot explain them, because the peer that made them is in the same clone.
2. **A session's tests start failing against a framework it never touched**, because a peer rebuilt the link underneath it.

### Before you start

Run `ListAgents` and check whether a session is live in this framework repo or in a starter that links it. If one is, `git status` and `git diff` in the framework clone tell you what is already uncommitted there **before** you add your own change on top. Uncommitted work you did not write is a peer's, not a leftover to clean up: leave it, and say so.

This check also covers the session that starts *after* a peer's change landed. Messages are not history, so a later session is never told what happened before it existed. The working tree is.

Read the ledger in the same breath — it is the half that survives a closed terminal:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/peer-ledger.sh read
```

`[held] repo:nest-server` means another session owns this clone right now. `[stale]` means the session that claimed it is gone and you may take over. Claim it yourself before a longer round of framework work (`peer-ledger.sh claim "repo:nest-server" "linking into the starter"`), and release it when you stop. And when a framework change breaks a starter in a way the next session will also hit, record the cause: `peer-ledger.sh note "<topic>" "cause: … fix: …"`. That note reaches sessions a message never can, because they do not exist yet.

### After a change reaches a consumer

Send one `LANDED` message when both hold: the change alters something a consumer sees (an export, a signature, a runtime behaviour), and a peer session is live in a repo that links this framework or vendors its core.

```
[LANDED] nest-server — AuthGuard moved from the CoreModule barrel to core/guards.
Betrifft: this clone is linked into nest-server-starter; your dist is now rebuilt.
Nötig: re-run your api once, and import from core/guards if you referenced the barrel.
```

Do **not** send for a change nothing downstream can observe (a comment, a test, a local refactor behind the same API), and do not report progress. The six occasions and the format are in the `coordinating-peer-sessions` skill. The reverse direction matters just as much here: when a framework change breaks a starter in a way the next session will also hit, one `SOLVED` with the cause saves that diagnosis outright.

### The `pnpm build --watch` trap

A watch build in one session rebuilds the linked `dist/` on every save, so a peer's test run picks up half-finished states with no message involved. When a peer is live against this link, either stop the watch during their run or tell them once that it is on. `pkill -f "build --watch"` is worse than it looks here: it kills **every** watch build on the machine, including the peer's own.

## Prerequisites

For the link workflows below, resolve **`$FRAMEWORK_DIR`** and **`$STARTER_DIR`** to the user's actual clone paths before executing any command.

## Workflow A — Backend Framework (`@lenne.tech/nest-server`)

Let `$FRAMEWORK_DIR` = path to the `nest-server` clone and `$STARTER_DIR` = path to the `nest-server-starter` clone.

### 1. Link the framework into the starter

```bash
# In the framework repo
cd "$FRAMEWORK_DIR"
pnpm install
pnpm build                 # TS → JS output in dist/
pnpm link --global         # register globally

# In the starter
cd "$STARTER_DIR"
pnpm link --global @lenne.tech/nest-server
```

### 2. Iterate

```bash
# Framework side: rebuild on change
cd "$FRAMEWORK_DIR"
pnpm build --watch

# Starter side: prefer lt dev up — it serves under stable HTTPS URLs
# and won't collide with other parallel lt sessions on 3000/3001.
cd "$STARTER_DIR"
lt dev up                  # starts nest-server-starter behind Caddy under https://api.<slug>.localhost
# or (non-lt fallback): pnpm dev    # default port 3000
```

**Use `run_in_background: true` for `pnpm build --watch`. Clean up with `pkill -f "build --watch"` when done.** For the starter dev server, prefer `lt dev up`/`lt dev down` — see `managing-dev-servers` skill.

### 3. Validate

- Run the starter's test suite: `pnpm test`
- Exercise the changed code path via REST/GraphQL (Chrome DevTools MCP or API calls)
- If the change touches auth, cookies, or CORS: verify that `BASE_URL`/`APP_URL` (set automatically by `lt dev up`) propagate correctly. Auth is bound to those env vars, not to fixed port numbers — see `managing-dev-servers` skill.

### 4. Unlink

```bash
cd "$STARTER_DIR"
pnpm unlink --global @lenne.tech/nest-server
pnpm install               # restore the published dependency
```

### 5. Prepare the upstream PR

- Commit framework changes inside `$FRAMEWORK_DIR`
- Add tests under the framework's own test suite (not just starter-side validation)
- Open a PR against `lenneTech/nest-server`

## Workflow B — Frontend Framework (`@lenne.tech/nuxt-extensions`)

Let `$FRAMEWORK_DIR` = path to the `nuxt-extensions` clone and `$STARTER_DIR` = path to the `nuxt-base-starter` clone.

### 1. Link the framework into the starter

```bash
cd "$FRAMEWORK_DIR"
pnpm install
pnpm build                 # Nuxt module build
pnpm link --global

cd "$STARTER_DIR"
pnpm link --global @lenne.tech/nuxt-extensions
```

### 2. Iterate

```bash
# Framework side: rebuild on change (or rely on Nuxt HMR if the module supports it)
cd "$FRAMEWORK_DIR"
pnpm dev                   # framework dev mode, if available
# otherwise: pnpm build --watch

# Starter side
cd "$STARTER_DIR"
lt dev up                  # starts nuxt-base-starter behind Caddy under https://<slug>.localhost
# or (non-lt fallback): pnpm dev    # default port 3001
```

**Same dev-server lifecycle rules apply — prefer `lt dev up`/`down`, use `run_in_background: true` + `pkill` for the framework `pnpm build --watch` side.**

### 3. Validate

- Playwright E2E tests in the starter exercise the integration
- Chrome DevTools MCP for interactive verification
- Auth flows require the backend running — `lt dev up` in the api workspace starts it under `https://api.<slug>.localhost` and exports `NUXT_API_URL` for the app.

### 4. Unlink

```bash
cd "$STARTER_DIR"
pnpm unlink --global @lenne.tech/nuxt-extensions
pnpm install
```

### 5. Prepare the upstream PR

- Commit framework changes inside `$FRAMEWORK_DIR`
- Open a PR against `lenneTech/nuxt-extensions`

## Common Pitfalls

- **Stale linked build** — after a framework edit, nothing happens in the starter. Cause: `pnpm build` was not re-run or `--watch` is not active. Fix: verify the build output timestamp under `dist/`.
- **Version mismatch** — starter expects a peer dependency range that does not match the linked framework version. Usually surfaces as a TS type mismatch. Fix: bump the framework's `package.json` version locally or adjust peer ranges for the test cycle (do NOT commit starter-side peer-range changes from this workflow).
- **Foreign uncommitted changes in the clone** — `git status` shows edits nobody in this session made. Cause: a parallel session is working the same base repo, and the house rule keeps that work uncommitted. Fix: `ListAgents` to confirm, then leave it alone and report it. Never `git checkout --` or stash a peer's work.
- **Forgotten unlink** — starter continues to resolve the linked framework on the next branch or project. Fix: always run the unlink step at the end; verify via `pnpm why @lenne.tech/nest-server`.
- **Port collision** — a leftover dev server from a previous iteration is still bound. Fix: `lt dev status --all` to see which project owns it, then `lt dev down` in that project (or `pkill` the process for non-lt projects).

## Related Skills & Agents

**Skills:**
- `using-lt-cli` — for scaffolding starters via `lt fullstack init`
- `generating-nest-servers` — when the framework change requires reference to NestJS patterns
- `developing-lt-frontend` — when the framework change requires reference to Nuxt patterns
- `nest-server-core-vendoring` / `nuxt-extensions-core-vendoring` — for the **different** pattern where framework source lives inside a project
- `managing-dev-servers` — lifecycle rules for all long-running processes started in this workflow
- `coordinating-peer-sessions` — when a parallel session works the same base repo or a linked consumer

**Agents for upstream contribution from a vendored project (not this workflow, but adjacent):**
- `nest-server-core-contributor` — extracts local vendored-core changes into a framework PR
- `nuxt-extensions-core-contributor` — same, for the frontend framework
