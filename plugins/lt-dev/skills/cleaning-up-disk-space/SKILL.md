---
name: cleaning-up-disk-space
description: 'Finds and frees disk space on a developer Mac through deterministic scripts instead of ad-hoc du/find/rm. A read-only audit lists every reclaimable item with size and class: pnpm store generations, npm/yarn/bun caches, unused Docker images, build cache, stopped containers and unused volumes, stale node_modules and build output, throwaway project folders with their git safety, unused Playwright browsers, Xcode and JetBrains leftovers, heap dumps, installer images, MongoDB logs, plus large personal files as advice. An executor deletes only the ids the user picked and re-checks each one first; daily guards keep the pnpm store and MongoDB log from growing back. Activates on "Festplatte voll", "Speicher voll", "Platz schaffen", "Speicherplatz freigeben", "was belegt meine Platte", "pnpm store ist riesig", "Docker belegt", "node_modules aufräumen", "disk full", "free up disk space". NOT for servers or deployed stages (use the TurboOps tools). NOT for dependency updates (use maintaining-npm-packages).'
---

# Cleaning Up Disk Space

Three scripts do the measuring and the deleting; Claude reads their output, the user decides,
and Claude reports. Claude does not run its own `du`, `find`, `rm` or `docker … prune` for this:
the scripts answer the same way on every run, cost about a thousand tokens instead of hundreds
of thousands, and repeat every safety check at the moment of deletion.

| Script | Does | Changes anything |
|---|---|---|
| `scripts/disk-audit.sh` | inventory: one line per finding with id, class, size, evidence | no |
| `scripts/disk-clean.sh` | deletes the ids it is given, after re-checking each | yes |
| `scripts/disk-guards.sh` | installs / reports / removes the daily guards | yes (LaunchAgents) |

## Workflow

### 1. Audit

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/disk-audit.sh" [--throwaway <dir>]... [--code-root <dir>]
```

Run it with a Bash timeout of 600000 ms: on a full disk it takes about three minutes, most of it
sizing photo libraries and scanning the home directory for files over 2 GB (`--no-large-files`
skips that scan). Ask before the run whether the user keeps a folder of throwaway projects (for
example `~/code/tests`); pass each one as `--throwaway`. The project root defaults to `~/code`.

Output, tab-separated, sorted by class and size:

```
# disk-audit free_mb=183681 code_root=~/code stale_days=90 regenerable_mb=21564 data_mb=5452 personal_mb=433419
# id	class	mb	note
docker-build-cache	regenerable	21180	docker builder prune -a
node-modules:~/code/acme/node_modules	regenerable	1100	project untouched 151d (since 2026-05-04)
docker-volume:crm_mongodb_data	data	361	no container uses it; may hold database data
project-dir:~/code/tests/demo	data	965	git=no-remote; last touched 2026-09-15
photos-library:~/Pictures/Photos Library.photoslibrary	personal	152714	with iCloud Photos: …
guard:pnpm-store-guard	info	0	missing; disk-guards.sh install keeps it from growing back
```

| Class | Meaning | How to present it |
|---|---|---|
| `regenerable` | rebuilt or re-downloaded on demand | recommend as one block |
| `data` | may hold work or database contents | one decision per item, with the note |
| `personal` | the user's own files | advice only; the scripts never touch them |
| `info` | context | mention when it changes a decision |

### 2. Present and let the user choose

Show a table per class in the user's language, sizes in GB with one decimal. Say that the sum
of the `mb` column overstates the gain: pnpm imports packages as APFS clones, so `du` counts
shared blocks once per project. The executor measures the real gain with `df`.

Ask with AskUserQuestion (multi-select) which blocks or items to clean. Recommend the whole
`regenerable` class; list each `data` item separately with its note.

### 3. Execute

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/disk-clean.sh" <id> <id> ...
```

Pass the ids verbatim and quote ids that contain spaces. Each id yields one line
(`ok` / `refused` / `failed`, the id, the detail), followed by `# freed_mb=… free_mb=…`.
`--dry-run` shows what would happen without changing anything.

A `refused` line is an answer, not an obstacle: the check that refused it found the project in
use, the volume attached, the generation still referenced, or unsaved work. Report the reason;
do not work around it with a hand-written command.

`--accept-data-loss` is the only override, and it covers only `project-dir` ids whose git state
is not `safe`. Use it only after the user has seen that state for that exact folder and said yes.
For such a folder the audit also offers `node-modules-all:<dir>`, which frees most of the space
and keeps the work: offer that first.

### 4. Keep it from growing back

When the audit shows `guard:… missing`, offer the guards:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/disk-guards.sh" install   # also: status, uninstall
```

| Guard | Runs | Acts |
|---|---|---|
| `pnpm-store-guard` | daily 13:00 | prunes the pnpm store above 15 GB, at most every 14 days, never during an install |
| `mongo-log-guard` | daily 13:05 | rotates a Homebrew MongoDB log above 1 GB via `logRotate`, keeps the newest rotated file |

The guard scripts are copied to `~/.local/share/lt-dev/guards`, so a plugin update cannot break
the LaunchAgents; run `install` again after an update to refresh them. macOS only.

## Ids the executor accepts

| Id | Action | Re-checked before acting |
|---|---|---|
| `pnpm-store:vN` | `pnpm store prune` | is the active generation; no pnpm install running |
| `pnpm-store-old:vN` | remove the generation | older than the active one; no `links/` (global virtual store) |
| `npm-cache`, `yarn-cache`, `bun-cache` | clear the cache | `_npx` / yarn / bun not in use |
| `docker-build-cache`, `docker-images` | `docker builder prune -a`, `docker image prune -a` | — |
| `docker-container:<name>` | `docker rm` | still stopped |
| `docker-volume:<name>`, `docker-volumes-anonymous` | `docker volume rm` | still attached to no container |
| `node-modules:<path>` | remove | a `node_modules` dir below the code root; project not in use |
| `node-modules-all:<dir>` | remove every `node_modules` inside | not in use |
| `build-output:<path>` | remove `.nuxt` / `.output` / `dist` / `coverage` / `.turbo` / `.next` | inside a project; not in use |
| `project-dir:<dir>` | remove the folder | not top-level; not in use; git `safe` or `no-git` (else `--accept-data-loss`) |
| `playwright-browser:<name>` | remove the browser | no installed Playwright references the revision |
| `jetbrains-old:<path>` | remove the old version dir | a newer version exists; the IDE is not running |
| `junk-file:<path>` | remove | `.hprof`, `.iso` or `.dmg` below `$HOME`; not open |
| `mongo-log` | `logRotate`, delete rotated files | mongod reachable; file not open |
| `xcode-derived-data`, `xcode-device-support`, `xcode-simulators-unavailable` | empty / `simctl delete unavailable` | Xcode not running |

"In use" means a running process names a path inside the project or has its working directory
there — that is how dev servers of parallel sessions are protected.

## Rules and their reasons

- **The scripts act, Claude does not.** Hand-written cleanup failed three times in the session
  these scripts were built from (2026-10-02): a zsh loop variable named `path` overwrote `PATH`,
  `[ "$a" \< "$b" ]` is not valid in zsh, and a test folder described as "from January" held a
  repository last committed in September with no remote. Each is now a check in the scripts.
- **Measure with `df`, never with `du`.** APFS clones make `du` count shared blocks repeatedly:
  emptying a 30 GB pnpm store freed 23 GB.
- **A pnpm prune empties the whole store on APFS.** pnpm imports by clone, so every store file
  has link count 1, which is exactly what `pnpm store prune` deletes. Existing `node_modules`
  keep working; every project downloads again on its next install. Treat it as a reset, not as
  routine maintenance — that is why the guard uses a size threshold.
- **Data first gets a decision.** An unused Docker volume can be a project's only copy of its
  database. Volumes of containers removed in the same run become unused only afterwards and do
  not appear in that run's audit; they show up in the next one, as `data`.
- **Personal files get advice, not actions**: optimise the photo library through iCloud, archive
  video, `ollama rm` unused models, shut a VM down instead of suspending it.

## Why stores and caches grow back

| Cause | Effect | Fix |
|---|---|---|
| `pnpm install --force` | installs native binaries for all 19 platforms; ~60 % of a 30 GB store were foreign-platform binaries (2026-10-02) | do not use `--force` for a clean reinstall; delete lockfile and `node_modules` instead |
| `supportedArchitectures` in `pnpm-workspace.yaml` | adds every listed platform to store and `node_modules` | list only platforms built on this machine |
| projects pinned to an older pnpm major | keep a second store generation (`v10` next to `v11`) alive | move them to the current pnpm |
| `pnpm store prune` / `npm cache clean --force` inside a project script | empties the cache of every other project and races parallel installs | keep project scripts project-scoped |
| test suites against a local MongoDB | connection logging fills `mongo.log` (15 GB in nine months) | `mongo-log-guard` |

## Related Skills

- `maintaining-npm-packages` — dependency updates and audits, not disk space
- `managing-dev-servers` — stopping dev servers; a running server keeps its project "in use"
- `coordinating-peer-sessions` — other sessions' installs and servers are what the in-use checks protect
- `deploying-to-turboops` — disk space on servers and stages, via the TurboOps tools
