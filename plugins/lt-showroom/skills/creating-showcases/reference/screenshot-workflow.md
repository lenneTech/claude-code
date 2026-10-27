# Screenshot Workflow

The complete procedure behind `/lt-showroom:showroom:screenshot` and the `screenshot-generator` agent. One run
captures one project: it starts the project from a throwaway clone with realistic demo data, takes desktop and mobile
screenshots per feature as WebP, and tears everything down again. Where the project cannot run locally, a fixed
fallback chain takes over.

## Ground Rules

Each rule exists because the opposite already went wrong, or would on a machine where ten Claude sessions run at once.

1. **Work in a throwaway clone, never in the developer's checkout.** `lt dev up` in an existing checkout serves the
   developer's database (`<slug>-local`) and collides with a stack another session already runs there. The clone lives
   in `~/.lt-showroom/<slug>/checkout`, and everything it changes disappears with it.
2. **Nothing leaves the clone.** No push, no change to any repository: showroom work never alters a project.
   `clone` gives every remote a push URL no transport accepts, which covers the `lt ticket` worktree too.
3. **Stop only what this run started.** Processes, the `lt ticket` stack, Compose projects, containers and volumes are
   recorded in the run's `session.json` and torn down from there. Never `pkill` by name, never `kill` by port, never
   `docker compose down` without the run's own project name: each of those hits processes of other sessions.
4. **Seed only into the run's own database, after proving it is local.** Never into a database that already existed,
   never into a remote one, never with production data or a dump.
5. **Local demo data is the run's own; live data never is.** In the run's database records may be created and
   changed freely until a screen shows what it should, so local captures need no DOM manipulation. On a live system
   the run only reads; production data is replaced in the browser before the capture, and apart from the data the
   screenshot shows the original.
6. **No production data on any image.** Local captures use demo data; live and legacy images are checked one by one.
7. **Clean up always**, also after an error or an interruption.

## The Session Script

Every state-changing step goes through `scripts/screenshot-session.mjs` of this plugin, so cleanup knows exactly
what to undo. `<plugin-root>` below is the plugin's install path: the `screenshot-generator` agent and the
`/lt-showroom:showroom:screenshot` command state it as an absolute path, because a reference file read with Read
keeps the placeholder as written and the Bash environment carries no plugin variable.

```bash
node "<plugin-root>/scripts/screenshot-session.mjs" <command> …
```

`$S` in the examples below stands for that path. Shell variables do not survive from one Bash call to the next, so
write the full path in each call (or set `S=…` within the same call).

| Command | Use |
|---|---|
| `slug <path-or-url>` | Work-folder name: the repository name in kebab-case. A folder that already holds this repository (or, for a `--name` run, this name) keeps its slug; when another project of the same name holds the plain one, the namespace (`beta-website`) or a hash of the source tells them apart. A folder whose source nothing records counts as taken as soon as it holds screenshots or an analysis. Always take the slug from this command, never form it by hand |
| `start <slug> --source <path-or-url>` | Opens the run; cleans an abandoned earlier run of the same slug; refuses (exit 3) while another live Claude session runs it, and `SLUG_TAKEN` (exit 5) when the folder holds another project's run, or deliverables of a run whose source is not recorded: its manifest, analysis and screenshots stay untouched, and `slug <source>` names the right folder |
| `clone <slug> <path-or-url> [--ref <branch>]` | Clones the remote's default branch (falls back to the local checkout when the remote is unreachable), disables pushing, records the commit and the repository the folder belongs to; `SLUG_TAKEN` (exit 5) like `start` |
| `run <slug> <name> --cwd <dir> [--env K=V]… -- <cmd…>` | Starts a dev server or worker in its own process group, logs to `logs/<name>.log` |
| `compose-file <slug> --cwd <dir> [--files a.yml,b.yml]` | Writes an isolated copy of the Compose project and records it: fixed volume, network and container names dropped, bind mounts outside the clone refused (exit 2) |
| `record <slug> lt-ticket\|compose\|container\|volume <value> [--cwd <dir>]` | Records a stack the run started by other means |
| `check-db --scan <dir>` / `check-db <uri>…` | Exit 2 unless every database URI points at this machine or a service of the run's own Compose project |
| `connections <slug>` | Exit 2 if a process of the run holds a connection to a remote database port |
| `wait-http <url>` | Waits until a local URL answers below 500 |
| `free-port` | A free port on 127.0.0.1 |
| `elapsed <slug>` | Minutes used of the 45-minute budget |
| `capture-path <slug> <feature> <device>` | The file path for `take_screenshot`, in the temp folder the browser MCP may write to |
| `manifest add\|remove\|meta\|show <slug> …` | Records each image and moves a capture into `screenshots/` (refuses a capture whose size does not match its device); `remove` drops an image that failed the visual check |
| `cleanup <slug> [--keep-checkout]` | Tears the run down; `--keep-checkout` stops the stack but keeps clone and session for the fallback chain |
| `status [<slug>]` | Open runs and what they hold |
| `verify-source <slug>` | Exit 2 if the local checkout given to `start` changed during the run |

## Work Folder

```
~/.lt-showroom/<slug>/
├── checkout/                    throwaway clone (removed by cleanup)
├── <name>-showroom/             lt ticket worktree, lt projects only (removed by cleanup)
├── logs/                        output of `run` processes (removed by cleanup)
├── session.json                 what the run started (removed by cleanup)
├── screenshots/                 the deliverable, kept
│   ├── overview-desktop.webp
│   ├── overview-mobile.webp
│   ├── <feature-slug>-desktop.webp
│   └── <feature-slug>-mobile.webp
├── manifest.json                one entry per image plus run metadata, kept
└── analysis.json                the analysis report (`analyze`), kept until create/update stores it in the Showroom
```

Nothing is written into the project repository: not the screenshots, not `SHOWCASE.md`, not a `.gitkeep`.

## Phase 1: Inputs

- **Source:** a local path, a repository URL, or the current directory. A local checkout is only read, and only to
  find its remote; the run clones from the remote.
- **What to capture:** the feature list and pages from the analysis report (`analysis show <slug>`, or an older
  `SHOWCASE.md` a project still carries, read only) or, without either, a page inventory from the `analyzing-projects` skill (`reference/startup-detection.md` and the pages
  of the frontend). Always add the overview (landing page or dashboard).
- **Project notes:** an organization can keep start quirks, live URLs and demo access per project in its own internal
  plugin or the project's `CLAUDE.md`. Read them before starting. They decide more than detection does.
- **Live URL** for the fallback chain: the showcase's links, the project notes, `README.md`, deployment config.

## Phase 2: Session and Clone

```bash
SLUG=$(node "$S" slug <source>)
node "$S" start "$SLUG" --source <source>
node "$S" clone "$SLUG" <source>            # --ref <branch> only when the user names one
```

The clone is the run's own: copying `.env.example` to `.env`, installing dependencies, pointing the config at the
run's database or a free port is all allowed there, and all of it disappears with the clone.

## Phase 3: Start the Project

### Project Types

| Type | Detection (in the clone) | Start |
|---|---|---|
| **lt project** | `projects/api` + `projects/app`, or a standalone API/App on the current lt stack; `lt dev doctor` passes | `TMPDIR=/tmp lt ticket start showroom --base origin/<branch> --noConfirm --no-up` in `checkout/`, then `node "$S" record "$SLUG" lt-ticket showroom --cwd <checkout>`, then `TMPDIR=/tmp lt dev up --no-prune` in the worktree; URLs from `lt dev status` there |
| **Compose stack** | A compose file that defines the app services | `node "$S" compose-file <slug> --cwd <checkout>` (records the project), then the `docker compose -p showroom-<slug> -f <file> up -d` it prints |
| **Lerna monorepo** (older lt stack) | `lerna.json` | Install (`npm run init` or `npm install`), database of the run (below), then `run … app -- npm run start` |
| **pnpm workspace** without lt dev | `pnpm-workspace.yaml` | `pnpm install`, database of the run, `run … app -- pnpm run start` |
| **Single frontend** | `nuxt.config.*`, `next.config.*`, `vite.config.*` | `run … app --env PORT=<free-port> -- <pm> run dev` |
| **Headless CMS frontend** | Directus, Strapi or Contentful URL in the env | Frontend only; the CMS is external and is only read |
| **Desktop app (Tauri)** | `src-tauri/` | Only the web dev server, never the Tauri wrapper |
| **Backend only** | No frontend | API only; capture Swagger (`/swagger`) and the GraphQL IDE (`/graphql`, GraphiQL or an older project's Playground) |
| **Library, CLI, framework** | `tsconfig.build.json`, no pages | Not screenshottable: go straight to the fallback chain, stage 3 |

`lt ticket start` gives the run its own URLs (`<name>-showroom.localhost`), its own ports and Caddy block and its own
empty database `<base>-showroom`; `lt ticket stop` removes all of it. `--no-up` keeps it from starting the stack itself:
its own start is a bare `lt dev up`, whose prune would run from the clone. `TMPDIR=/tmp` avoids the macOS socket-path limit
that crashes Nuxt SSR under `lt dev`.

Restart a crashed lt stack inside the worktree with `TMPDIR=/tmp lt dev up --no-prune`. A bare `lt dev up` also
prunes orphaned databases and registry entries of the developer's other environments; that housekeeping is the
developer's, and a screenshot run changes only what it started.

### Nothing Leaves the Machine, Nothing Is Hogged

- **Analytics and error reporting off in the clone** (Plausible, Matomo, Google Analytics, Sentry, feedback widgets):
  set the project's switch in `.env`, or remove the snippet in the clone. A local run otherwise sends page views to the
  project's production account. Observed 2026-10-11: a production build in a verification run reported its page views
  to plausible.io.
- **Heavy shared services belong to the developer.** A local LLM in the host's Ollama, a GPU or a host database are
  shared with every other session: use a stub or the smallest model the feature needs, and name it in the report.
  Observed 2026-10-11: a 14B model loaded for a RAG screenshot took 17.7 GB and slowed down the other sessions.

Install dependencies with the package manager of the lockfile (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn,
`package-lock.json` or `lerna.json` → npm). Repair a broken install inside the clone only.

### Ports

`lt dev` needs no fixed ports. Elsewhere, when a hard-coded port (3000, 3001) is taken, give the clone another one:
the `PORT` variable, or edit the port in the clone's config to a value from `free-port`. The process holding the port
belongs to someone else and keeps running.

### Database of the Run

| Start | Database |
|---|---|
| lt ticket | `<base>-showroom` on 127.0.0.1, created empty, dropped by `lt ticket stop` |
| Compose | The database service of the Compose project, started from the `compose-file` copy; its volumes go with `cleanup` |
| Everything else | A container of its own: `docker run -d --name showroom-<slug>-mongo -p 127.0.0.1:<free-port>:27017 mongo:7`, then `record … container showroom-<slug>-mongo`; point the clone's config or env at it |

Never use a database that existed before the run. A Compose file whose volume has a fixed `name:` (or is `external`)
would mount the developer's real volume under any project name, and a seed that empties collections first would wipe
it; `compose-file` makes every volume, network and container the run's own (verified 2026-10-11: a second Compose
project with the same fixed volume name read the first project's data). An older project's `config.env.ts` often hard-codes
`mongodb://127.0.0.1/<project>-local`: that is a developer's data, so change the URI in the clone instead.

Three checks keep the data local:

```bash
node "$S" check-db --scan "$HOME/.lt-showroom/$SLUG/checkout"   # before the start: env and Compose files
node "$S" check-db "<effective URI>"                            # before every seed, with the URI the seed uses
node "$S" connections "$SLUG"                                   # after the start: no process talks to a remote DB
```

`check-db --scan` reads env files only; for a `config.env.ts` pass the URI of the environment the start uses
explicitly. Exit 2 means stop: fix the URI in the clone, or leave the local route.

### Readiness

```bash
node "$S" wait-http "https://showroom-name-showroom.localhost" --timeout 240
```

On a timeout read `logs/<name>.log` (or `.lt-dev/*.log` in the lt worktree), fix what is fixable in the clone, and
check the time budget.

## Phase 4: Demo Data

Order: the project's own seed script (`seed`, `db:seed`, `demo`, `fixtures`, `populate`, `init:data`), then the API,
then the UI.

- **API (TestHelper pattern):** lt projects create the first admin through `POST /system-setup/init` (works only on an
  empty database), sign in, then create records through REST or GraphQL as the app's own frontend would.
- **UI:** through Chrome DevTools MCP when no API route fits.

The data is the run's own: when a capture shows an empty list, an odd state or a bad example, change or add records
and capture again. Demo data must make the feature readable at a glance:

- German, realistic, and fitting the customer's industry: fictitious people and companies, plausible amounts and dates,
  never "Test", "foo" or lorem ipsum
- E-mail addresses on `example.com`; phone numbers and IBANs in demo form
- At least three records per main entity, in different states (open, in progress, done), so lists, filters and
  status badges show something
- Never production data, never a dump, never content copied from the live system

## Phase 5: Capture

One browser page per run, in an isolated context, closed at the end:

```
new_page          url=<start URL>  isolatedContext="showroom-<slug>"
emulate           viewport="1440x900x1"                       # desktop
emulate           viewport="390x844x2,mobile,touch"           # mobile
navigate_page     type="reload"                               # after every emulation change
evaluate_script   function=<content of <plugin-root>/scripts/browser/prepare-page.js>
evaluate_script   function=<content of <plugin-root>/scripts/browser/anonymize-dom.js>  # live and older pages only
take_screenshot   format="webp"  quality=80  filePath=<output of: node "$S" capture-path <slug> <feature> <device>>
```

- **`emulate`, not `resize_page`.** `resize_page` keeps the host's pixel density, so a Retina Mac delivers 2880×1800
  PNGs of about 1.2 MB. With the emulation above a desktop capture is exactly 1440×900, a mobile capture 780×1688.
- **Viewport screenshots**, never `fullPage`: one screen per feature, the way a visitor sees it.
- **Capture into the temp folder.** Chrome DevTools MCP writes files only below the session's workspace roots and the
  temp folder, so `take_screenshot` into `~/.lt-showroom` fails with "not within any of the configured workspace
  roots". `capture-path` names a file in the temp folder, and `manifest add` moves it into `screenshots/`.
- **Reload after switching the device.** Many layouts decide on load whether they are mobile.
- **`prepare-page.js`** scrolls once through the page (lazy images, scroll-reveal), hides cookie banners, chat launchers
  and dev overlays, freezes animations and waits for fonts and images. Its `horizontalOverflow` answer is the mobile
  check.
- **Mobile only where the app is usable on a phone:** no horizontal overflow at 390 px and a viewport meta tag.
  Otherwise record `manifest meta <slug> notes.mobile="not responsive"` and capture desktop only.
- **Record every image:**

  ```bash
  node "$S" manifest add "$SLUG" --file <capture path> \
    --feature overview --device desktop --level local [--customer-branding] [--anonymized]
  ```

  `--customer-branding` marks an image that shows the customer's logo or name (anonymous showcases need a variant
  without it); `--shows-people` one with real people from the repository's own content; `--anonymized` marks a live or older image whose data was replaced. The command refuses a capture whose
  size does not match the device, which catches a missed emulation, and leaves it where it was.
- **Look at the images.** Open each saved file once (Read) before it counts. A blank page, an error page, a spinner or a
  leftover banner is a failed capture: `manifest remove <slug> <feature> <device>`, fix the cause, capture again.
- **Real people in the repository's own content** (a website's team page with names, photos and phone numbers) are
  shipped content, not demo data. Keep the image, record it with `--shows-people`, and name it in the report so the
  editor decides whether the showcase shows it. On a live system the same people are blurred (stage 1 and 2 rules).

Filenames: `<feature-slug>-<device>.webp`, kebab-case, always including `overview-desktop.webp` and
`overview-mobile.webp`.

**Still images only.** An upload ticket takes images and stores each as WebP; an animated WebP keeps only its first
frame (measured: 48 frames and 313 KB in, one frame and 7 KB out). A turntable or a recorded flow goes in as single
frames in a `screenshot-gallery`, or as an MP4 or WebM loop that an editor uploads in the Showroom admin for a `video`
block (`content.fileId`, see `content-blocks.md`). Upload tickets do not take videos.

## Phase 6: Fallback Chain

The local route is first choice. It is abandoned when the project cannot be started or seeded, or when
`node "$S" elapsed "$SLUG"` reports the budget exceeded (about 45 minutes per project; check it at every phase
boundary). Stop the local stack with `node "$S" cleanup "$SLUG" --keep-checkout`: the clone stays for the comparison
below. Then, in this order:

| Stage | Source | Condition |
|---|---|---|
| 1 | Demo tenant or demo access on the live system | The live system matches the repository, and demo credentials are documented (project notes) or given by the user |
| 2 | Public pages of the live system, no login | The live system matches the repository |
| 3 | Older screenshots | Earlier runs in `screenshots/`, `docs/showcase/screenshots/` in a local checkout (read only), screenshots of the existing showcase on the platform |
| 4 | Branded teaser cover | Always possible |

A feature can be covered at different stages: take the highest stage per feature, not per project.

### Does the Live System Still Match the Repository?

Live stages only count when the live system still runs this code. Many old projects are offline or were replaced by
another provider's website. Compare with plain GET requests (`curl -sL`), never by logging in:

- 3 to 5 routes from the repository's pages answer on the live host, and none is a generic 404 page
- distinctive texts from the repository (page titles, meta description, i18n strings, hero copy) appear in the live
  HTML
- the framework fingerprint matches (`/_nuxt/` or `__NUXT__`, `/_next/`, `ng-version="<major>"` against
  `package.json`)
- where exposed, a version or build marker matches the clone's `package.json` or commit

Record the verdict with its evidence:

```bash
node "$S" manifest meta "$SLUG" liveCheck.url=<url> liveCheck.matchesRepo=false \
  liveCheck.evidence="routes 0/4, title differs, WordPress instead of Nuxt"
```

`matchesRepo=false` or an unreachable host skips stages 1 and 2. Without a repository there is nothing to compare
against: the live system is used only when the user confirms it still runs this project's code
(`liveCheck.evidence="confirmed by the user"`). A live URL passed to the command is an address, not that confirmation. The screenshots then come from the repository: the
local route once more after fixing what blocked it, if budget remains, otherwise stage 3.

### Live Systems (Stages 1 and 2)

Nothing on the system or its production data changes. Reading is fine, by whatever means the page itself uses
(GET requests, GraphQL queries, search endpoints).

- **Allowed:** navigating, scrolling, opening tabs, menus and accordions, filters, sorting and search that only change
  the view, and the login with demo access.
- **Never:** submitting a form other than the login; clicking save, send, delete, create, upload, accept, order, book or
  pay; changing settings; starting exports that send mail; creating accounts; resetting passwords.
- **Replace the data before every capture** with `anonymize-dom.js`: fill `REPLACEMENTS` with every person, company,
  address, amount and free text visible on the page (read it from `take_snapshot`), and `BLUR` with selectors for
  photos, avatars, canvas charts, maps and embedded documents. Every recognizable person in a photo or video still
  counts as personal data and is blurred, children always; public marketing content is no exception on a live system.
  Re-run until its `remaining` lists are empty, then check the saved image. Content that can be neither replaced nor blurred in the DOM is covered in the image before saving;
  an image that still shows real data is deleted, not recorded.
- **Check the network after every page:** `list_network_requests`, then look at every request that is not a GET. The
  login and read-only requests (a GraphQL `query`, a search) are fine. Any request that writes (a GraphQL `mutation`
  other than the login, PUT, PATCH, DELETE, a POST to a create or update endpoint) stops the live capture at once:
  report method and path, and do not use the images of that page.
- The isolated browser context ends with the page, so no live session cookie outlives the run. Credentials are never
  written to a file.

### Older Screenshots (Stage 3)

Convert them into the capture folder as WebP (the original stays where it is): with
`cwebp -q 80 <in.png> -o <capture path>` where installed, otherwise open the PNG via `file://` with the emulation set to
its size and capture it as WebP. Check each one for production data like a live capture. Record with
`--level legacy`; their size is not checked.

### Teaser Cover (Stage 4)

```
navigate_page  url="file://<plugin-root>/scripts/browser/teaser-cover.html?title=<name>&subtitle=<category>&tags=Nuxt,NestJS&accent=<hex>&org=<company>&year=<year>"
emulate        viewport="1440x900x1"
take_screenshot format="webp" quality=80 filePath=<output of: node "$S" capture-path <slug> cover desktop>
```

Use the name the showcase shows (the alias when the customer stays anonymous), no customer logo. Record it with
`--feature cover --device desktop --level teaser` and mark the run:

```bash
node "$S" manifest meta "$SLUG" pendingTag=screenshots-ausstehend
```

The screenshot run writes nothing to the Showroom: the tag and the images reach the showcase when it is created or
updated. The cover stands in for missing screenshots; the showcase's teaser comes from `generate_teaser` after saving,
which shows title and tags when no screenshot is there.

## Phase 7: Cleanup

Always, also after a failure:

1. Close the browser page the run opened (`close_page`).
2. `node "$S" cleanup "$SLUG"`: stops the recorded processes (by process group, checked against their start time),
   runs `lt ticket stop showroom --force --noConfirm` (which also drops the run's database), takes the Compose project
   down with its volumes, removes the run's containers, and deletes everything in the work folder except
   `screenshots/` and `manifest.json`, plus the run's capture folder in the temp folder.
3. Exit 0 and an empty `leftovers` list mean done. Anything listed is reported verbatim with the command that removes it.
4. If the source was a local checkout, `node "$S" verify-source "$SLUG"` exits 0: its HEAD and `git status` are
   what `start` recorded.

An interrupted run is cleaned by the next run of the same slug (`start`), by the `SessionEnd` hook when the session
ends, or explicitly with `/lt-showroom:showroom:screenshot <source> --cleanup`.

## Error Recovery

| Error | Recovery |
|---|---|
| `start` exits 3 (BUSY) | Another live session runs this project. Wait, or work on another project |
| `start` or `clone` exits 5 (`SLUG_TAKEN`) | The slug belongs to another project of the same name, or to a run whose source is not recorded. Take the slug `slug <source>` prints and start again; never move or delete the other project's files to make room |
| Clone fails | Remote unreachable and no local checkout: ask the user for access, or go to stage 3 |
| `lt ticket start` fails | Read its output; `lt dev doctor`; fall back to the Lerna/pnpm route with a database of the run |
| Port taken | Another port in the clone; never stop the owner |
| `check-db` exits 2 | Point the clone at the run's database; never seed until it passes |
| Startup timeout | Read the log, fix in the clone, watch the budget |
| `system-setup/init` answers 403 | The database is not empty, so it is not the run's own: stop and check the URI |
| Seed fails | Demo data through the API or UI; an empty state is not a showcase image |
| Capture fails | Continue with the remaining features, report the missing ones |
| `manifest add` refuses the size | Set the emulation again, reload, capture again |
| Cleanup lists leftovers | Report them with exact commands; never widen the cleanup to processes the run did not start |

## Libraries and Frameworks

Packages such as nest-server, nuxt-extensions or a CLI are not applications. Skip the local route: older screenshots,
terminal output or an architecture diagram, otherwise the teaser cover.
